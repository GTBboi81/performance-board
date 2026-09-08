<?php
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit;
}
/**
 * 実績ボード — cron定期実行
 *
 * さくらコンパネで登録:
 * 0 * * * * /usr/local/bin/php /path/to/performance_board/cron_runner.php >> /dev/null 2>&1
 */
set_time_limit(300);
ini_set('memory_limit', '512M');
date_default_timezone_set('Asia/Tokyo');

require_once __DIR__ . '/lib/config_reader.php';

// ログ
$logFile = __DIR__ . '/cache/cron.log';

function cronLog($msg) {
    global $logFile;
    $line = '[' . date('Y-m-d H:i:s') . '] ' . $msg . "\n";
    // 最大50行に制限
    $existing = file_exists($logFile) ? file($logFile) : [];
    $existing[] = $line;
    if (count($existing) > 50) $existing = array_slice($existing, -50);
    file_put_contents($logFile, implode('', $existing), LOCK_EX);
}

// 多重実行防止
$lockFile = __DIR__ . '/cache/cron_runner.lock';
$lockFp = fopen($lockFile, 'c');
if (!flock($lockFp, LOCK_EX | LOCK_NB)) {
    cronLog('SKIP: 前回の実行がまだ完了していません');
    exit(0);
}

try {
    cronLog('START: cron実行開始');

    $boardIds = pb_loadAllBoardIds();
    if (empty($boardIds)) {
        cronLog('SKIP: ボードが存在しません');
        exit(0);
    }

    $successCount = 0;
    $errorCount = 0;

    foreach ($boardIds as $boardId) {
        $board = pb_loadBoardConfig($boardId);
        if (!$board) continue;

        // スケジュール設定の評価
        $schedule = $board['schedule'] ?? [];
        if (!($schedule['enabled'] ?? true)) {
            cronLog("SKIP(disabled): board=$boardId");
            continue;
        }

        // 現在の時刻
        $now = new \DateTime('now', new \DateTimeZone('Asia/Tokyo'));
        $currentDay    = (int)$now->format('w'); // 0=日, 1=月, ..., 6=土
        $currentHour   = (int)$now->format('G'); // 0-23
        $currentMinute = (int)$now->format('i'); // 0-59

        // 曜日フィルタ（配列が設定されていれば適用）
        $dayOfWeek = $schedule['dayOfWeek'] ?? null;
        if (is_array($dayOfWeek) && !empty($dayOfWeek)) {
            if (!in_array($currentDay, array_map('intval', $dayOfWeek), true)) {
                cronLog("SKIP(day): board=$boardId, today=$currentDay, allowed=" . implode(',', $dayOfWeek));
                continue;
            }
        }

        // 時刻フィルタ: hour が設定されている場合のみチェック
        if (isset($schedule['hour']) && $schedule['hour'] !== '' && $schedule['hour'] !== null) {
            if ($currentHour !== (int)$schedule['hour']) {
                cronLog("SKIP(hour): board=$boardId, now=$currentHour, target={$schedule['hour']}");
                continue;
            }
        }

        // 分フィルタ: minute が設定されていれば ±15分 の許容窓でチェック（cron 実行粒度への耐性）
        if (isset($schedule['minute']) && $schedule['minute'] !== '' && $schedule['minute'] !== null) {
            $targetMinute = (int)$schedule['minute'];
            $diff = abs($currentMinute - $targetMinute);
            // wrap-around（分境界を跨ぐ場合）も考慮
            $wrapDiff = min($diff, 60 - $diff);
            if ($wrapDiff > 15) {
                cronLog("SKIP(minute): board=$boardId, now=$currentMinute, target=$targetMinute, diff=$wrapDiff");
                continue;
            }
        }

        // データソースがないボードはスキップ
        if (empty($board['dataSources'])) continue;

        cronLog("EXEC: board=$boardId ({$board['name']})");

        // generate.phpをCLIで子プロセス実行（メモリ隔離）
        $cmd = 'php ' . escapeshellarg(__DIR__ . '/generate.php') . ' ' . escapeshellarg($boardId) . ' 2>&1';
        $output = [];
        $returnCode = 0;
        exec($cmd, $output, $returnCode);

        if ($returnCode === 0) {
            $successCount++;
            cronLog("OK: board=$boardId");
        } else {
            $errorCount++;
            cronLog("ERROR: board=$boardId, code=$returnCode, output=" . implode(' ', $output));
        }
    }

    cronLog("END: success=$successCount, error=$errorCount");

} catch (\Throwable $e) {
    cronLog('FATAL: ' . $e->getMessage());
} finally {
    flock($lockFp, LOCK_UN);
    fclose($lockFp);
}
