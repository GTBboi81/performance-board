<?php
/**
 * 実績ボード — データ生成
 *
 * HTTP: POST /performance_board/generate.php?boardId=xxx
 * CLI:  php generate.php <boardId>
 */
set_time_limit(300);
ini_set('memory_limit', '512M');
date_default_timezone_set('Asia/Tokyo');

// CLI/HTTP判定。HTTP 経由はセッション必須。
// 未認証だと boardId 由来のファイルを cache/ に無制限に作れてしまうため、
// cache_read.php と同じ条件で、ライブラリを読み込む前に遮断する。
// cron は CLI で実行するのでこの分岐に入らない。
$isCli = php_sapi_name() === 'cli';
if (!$isCli) {
    header('Content-Type: application/json; charset=utf-8');
    require_once __DIR__ . '/../auth_session.php';
    $scriptPath = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '/');
    $cookiePath = rtrim(dirname(dirname($scriptPath)), '/') . '/';
    app_start_session(__DIR__ . '/../sessions', $cookiePath);
    if ((string) ($_SESSION['userId'] ?? '') === '') {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Authentication required']);
        exit;
    }
}

// ライブラリ読み込み
require_once __DIR__ . '/lib/sf_auth.php';
require_once __DIR__ . '/lib/sf_query.php';
require_once __DIR__ . '/lib/config_reader.php';
require_once __DIR__ . '/lib/date_utils.php';
require_once __DIR__ . '/lib/vlookup.php';
require_once __DIR__ . '/lib/reshape.php';
require_once __DIR__ . '/lib/calc_engine.php';

// 進捗ファイル書き込みヘルパー（失敗しても処理継続）
function pb_writeProgress($boardId, $data) {
    $cacheDir = __DIR__ . '/cache';
    if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);
    $safeBoardId = preg_replace('/[^a-zA-Z0-9_-]/', '_', $boardId);
    $file = "$cacheDir/board_{$safeBoardId}_progress.json";
    $data['boardId'] = $boardId;
    $data['updatedAt'] = date('c');
    @file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE), LOCK_EX);
}

function pb_deleteProgress($boardId) {
    $cacheDir = __DIR__ . '/cache';
    $safeBoardId = preg_replace('/[^a-zA-Z0-9_-]/', '_', $boardId);
    @unlink("$cacheDir/board_{$safeBoardId}_progress.json");
}

// $isCli の判定と HTTP 経由の 401 ガードは、ライブラリ読み込みより前
// （このファイル冒頭）で実施済み。ここへ到達する時点で HTTP リクエストは
// 認証済みセッションを持つ。

// boardId取得
$boardId = $isCli ? ($argv[1] ?? '') : ($_GET['boardId'] ?? $_POST['boardId'] ?? '');
if (!$boardId) {
    $msg = 'boardId is required';
    if ($isCli) { fwrite(STDERR, $msg . "\n"); exit(1); }
    echo json_encode(['status' => 'error', 'message' => $msg]); exit;
}

// register_shutdown_function: Fatal error キャッチ用（try/catch で捕捉できない致命的エラー対策）
if ($boardId) {
    $shutdownBoardId = $boardId;
    register_shutdown_function(function() use ($shutdownBoardId) {
        $err = error_get_last();
        if (!$err) return;
        // Fatal error 系のみ記録（E_NOTICE 等は無視）
        $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
        if (!in_array($err['type'], $fatalTypes, true)) return;
        $cacheDir = __DIR__ . '/cache';
        if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);
        $safeId = preg_replace('/[^a-zA-Z0-9_-]/', '_', $shutdownBoardId);
        @file_put_contents("$cacheDir/board_{$safeId}_meta.json", json_encode([
            'boardId' => $shutdownBoardId,
            'generatedAt' => date('c'),
            'error' => 'Fatal error occurred during generation',
            'error_type' => 'FATAL',
            'error_detail' => $err['message'] . ' in ' . basename($err['file']) . ':' . $err['line'],
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
        error_log("[PB generate] Shutdown with fatal error for board {$shutdownBoardId}: " . $err['message']);
    });
}

try {
    // 1. ボード設定読み込み
    $board = pb_loadBoardConfig($boardId);
    if (!$board) throw new \RuntimeException('CONFIG_FAIL:Board not found: ' . $boardId);

    $dataSources = $board['dataSources'] ?? [];
    if (empty($dataSources)) throw new \RuntimeException('CONFIG_FAIL:データソースが設定されていません');

    $tenantId = $board['connection']['tenantId'] ?? $board['sfTenantId'] ?? '';

    // 進捗: データソース数確定 → start
    $salesforceSources = array_filter($dataSources, fn($s) => ($s['sourceType'] ?? 'salesforce-soql') === 'salesforce-soql');
    $processableSources = array_filter($salesforceSources, fn($s) => !empty($s['soqlObject']) && !empty($s['soqlFields']));
    $totalSources = count($processableSources);
    pb_writeProgress($boardId, [
        'stage' => 'start',
        'current' => 0,
        'total' => $totalSources,
        'currentSource' => '',
        'percentage' => 0,
    ]);

    // 2. SF認証
    if (count($salesforceSources) === 0) {
        $cacheDir = __DIR__ . '/cache';
        $safeBoardId = preg_replace('/[^a-zA-Z0-9_-]/', '_', $boardId);
        $dataFile = "$cacheDir/board_{$safeBoardId}.json.gz";
        if (is_file($dataFile)) {
            pb_deleteProgress($boardId);
            $result = [
                'status' => 'success',
                'boardId' => $boardId,
                'generatedAt' => date('c'),
            ];
            if ($isCli) {
                echo json_encode($result) . "\n";
            } else {
                echo json_encode($result);
            }
            exit;
        }
        throw new \RuntimeException('CONFIG_FAIL:デモ環境ではデータ生成を行いません');
    }

    try {
        $auth = pb_soapLogin($tenantId ?: null);
    } catch (\Throwable $authErr) {
        throw new \RuntimeException('AUTH_FAIL:' . $authErr->getMessage(), 0, $authErr);
    }
    $instance = $auth['instance'];
    $sessionId = $auth['sessionId'];

    $sourceCacheData = [];
    $processedCount = 0;

    foreach ($dataSources as $source) {
        $srcType = $source['sourceType'] ?? 'salesforce-soql';
        if ($srcType !== 'salesforce-soql') continue;

        $objectName = $source['soqlObject'] ?? '';
        $fieldsStr = $source['soqlFields'] ?? '';
        if (!$objectName || !$fieldsStr) continue;

        $fields = array_filter(array_map('trim', explode(',', $fieldsStr)));
        if (empty($fields)) continue;

        // 進捗: SOQL実行前
        $sourceName = $source['name'] ?? $objectName;
        pb_writeProgress($boardId, [
            'stage' => 'soql',
            'current' => $processedCount,
            'total' => $totalSources,
            'currentSource' => $sourceName,
            'percentage' => (int)(($processedCount / max($totalSources, 1)) * 100),
        ]);

        // 3. WHERE句構築
        $where = pb_buildWhereClause($source);
        $orderBy = $source['soqlOrderBy'] ?? '';
        if ($orderBy && !pb_validateSoqlIdentifier($orderBy)) {
            error_log("[PB generate] Invalid orderBy rejected: $orderBy");
            $orderBy = '';
        }

        // 4. SOQL実行
        try {
            $result = pb_executeSoql($instance, $sessionId, $objectName, $fields, $where, $orderBy);
        } catch (\Throwable $soqlErr) {
            throw new \RuntimeException('SOQL_FAIL:' . $soqlErr->getMessage(), 0, $soqlErr);
        }
        $headers = $result['columns'];
        $rows = $result['rows'];

        // 5. 日付正規化
        $dateColIdx = (int)($source['dateColumnIndex'] ?? -1);
        if ($dateColIdx >= 0 && $dateColIdx < count($headers)) {
            foreach ($rows as &$row) {
                if (isset($row[$dateColIdx])) {
                    $row[$dateColIdx] = pb_normalizeDate($row[$dateColIdx]);
                }
            }
            unset($row);
        }

        // 進捗: VLOOKUP実行前
        pb_writeProgress($boardId, [
            'stage' => 'vlookup',
            'current' => $processedCount,
            'total' => $totalSources,
            'currentSource' => $sourceName,
            'percentage' => (int)((($processedCount + 0.5) / max($totalSources, 1)) * 100),
        ]);

        // 6. VLOOKUP結合
        try {
            pb_applyVlookups($rows, $headers, $source['vlookups'] ?? [], $instance, $sessionId);
        } catch (\Throwable $vlErr) {
            throw new \RuntimeException('VLOOKUP_FAIL:' . $vlErr->getMessage(), 0, $vlErr);
        }

        // 7. Reshape変換
        if (!empty($source['reshapeSettings']['enabled'])) {
            try {
                $reshaped = pb_reshapeWideToLong($rows, $headers, $source['reshapeSettings']);
            } catch (\Throwable $reshapeErr) {
                throw new \RuntimeException('RESHAPE_FAIL:' . $reshapeErr->getMessage(), 0, $reshapeErr);
            }
            $headers = $reshaped['headers'];
            $rows = $reshaped['rows'];
        }

        // 8. sourceCache形式で保存
        $sourceId = $source['id'] ?? $source['soqlObject'] ?? 'src_unknown';
        $sourceCacheData[$sourceId] = [
            'columns' => $headers,
            'rows' => $rows,
        ];
        unset($rows, $result);

        $processedCount++;
    }

    // 進捗: 全ソース完了
    pb_writeProgress($boardId, [
        'stage' => 'complete',
        'current' => $totalSources,
        'total' => $totalSources,
        'currentSource' => '',
        'percentage' => 100,
    ]);

    // 9. JSON保存（sourceCache形式）
    $output = [
        'meta' => [
            'boardId' => $boardId,
            'boardName' => $board['name'] ?? '',
            'generatedAt' => date('c'),
            'sources' => array_map(fn($s) => ['rowCount' => count($s['rows'])], $sourceCacheData),
        ],
        'sourceCache' => $sourceCacheData,
    ];

    $cacheDir = __DIR__ . '/cache';
    if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);
    $safeBoardId = preg_replace('/[^a-zA-Z0-9_-]/', '_', $boardId);
    $dataFile = "$cacheDir/board_{$safeBoardId}.json.gz";

    $json = json_encode($output, JSON_UNESCAPED_UNICODE);
    $tmpFile = $dataFile . '.tmp.' . getmypid();
    if (file_put_contents($tmpFile, gzencode($json, 6), LOCK_EX) === false) {
        @unlink($tmpFile);
        throw new \RuntimeException('WRITE_FAIL:一時ファイルの書き込みに失敗しました');
    }
    if (!rename($tmpFile, $dataFile)) {
        @unlink($tmpFile);
        throw new \RuntimeException('WRITE_FAIL:データファイルの置換に失敗しました');
    }
    unset($json, $output, $sourceCacheData);

    // 進捗ファイル削除（ポーリング終了シグナル）
    pb_deleteProgress($boardId);

    $result = [
        'status' => 'success',
        'boardId' => $boardId,
        'generatedAt' => date('c'),
    ];

    if ($isCli) {
        echo json_encode($result) . "\n";
    } else {
        echo json_encode($result);
    }

} catch (\Throwable $e) {
    error_log("[PB generate] Error for board $boardId: " . $e->getMessage());
    pb_deleteProgress($boardId);

    // error_type 抽出
    $msg = $e->getMessage();
    $errorType = 'UNKNOWN';
    $userMessage = 'データ生成に失敗しました';
    $knownTypes = ['CONFIG_FAIL', 'AUTH_FAIL', 'SOQL_FAIL', 'VLOOKUP_FAIL', 'RESHAPE_FAIL', 'WRITE_FAIL'];
    foreach ($knownTypes as $t) {
        if (strpos($msg, $t . ':') === 0) {
            $errorType = $t;
            $userMessage = substr($msg, strlen($t) + 1);
            break;
        }
    }

    // エラー時もメタファイルにエラー記録
    $cacheDir = __DIR__ . '/cache';
    if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);
    $safeBoardId = preg_replace('/[^a-zA-Z0-9_-]/', '_', $boardId);
    @file_put_contents("$cacheDir/board_{$safeBoardId}_meta.json", json_encode([
        'boardId' => $boardId,
        'generatedAt' => date('c'),
        'error' => $userMessage,
        'error_type' => $errorType,
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);

    $err = [
        'status' => 'error',
        'error_type' => $errorType,
        'message' => $userMessage,
    ];
    if ($isCli) {
        fwrite(STDERR, $e->getMessage() . "\n");
        echo json_encode($err) . "\n";
        exit(1);
    } else {
        http_response_code(500);
        echo json_encode($err, JSON_UNESCAPED_UNICODE);
    }
}
