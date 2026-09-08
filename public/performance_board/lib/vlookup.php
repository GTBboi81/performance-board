<?php
set_time_limit(300);
ini_set('memory_limit', '512M');
date_default_timezone_set('Asia/Tokyo');

/**
 * SalesforceのAPIフィールド名として有効かチェックする。
 * 英数字・アンダースコア・ドット（リレーション参照）のみ許可。
 *
 * @param string|null $name チェック対象の文字列
 * @return bool 有効な場合 true
 */
function pb_isValidSfIdentifier($name) {
    return (bool)preg_match('/^[a-zA-Z0-9_.]+$/', $name ?? '');
}

/**
 * VLOOKUP 結合を rows に適用する。
 * 各 vlookup 設定に従い SF から参照テーブルを取得し、
 * localKeyField をキーに行を突き合わせて新しい列を追加する。
 *
 * @param array  $rows      2次元配列（参照渡し）
 * @param array  $headers   列名配列（参照渡し）
 * @param array  $vlookups  VLOOKUP 設定配列
 * @param string $instance  SFインスタンスホスト名
 * @param string $sessionId SFセッションID
 * @return void
 */
function pb_applyVlookups(&$rows, &$headers, $vlookups, $instance, $sessionId) {
    if (empty($vlookups)) return;

    foreach ($vlookups as $vl) {
        $targetObject = $vl['targetObject']      ?? '';
        $targetKey    = $vl['targetKeyField']    ?? '';
        $targetVal    = $vl['targetValueField']  ?? '';
        $localKey     = $vl['localKeyField']     ?? '';

        // SF APIフィールド名・オブジェクト名を検証（SQLインジェクション対策）
        if (!pb_isValidSfIdentifier($targetObject) ||
            !pb_isValidSfIdentifier($targetKey)    ||
            !pb_isValidSfIdentifier($targetVal)    ||
            !pb_isValidSfIdentifier($localKey)) {
            error_log("[PB vlookup] Invalid VLOOKUP identifiers rejected: object=$targetObject key=$targetKey val=$targetVal local=$localKey");
            continue;
        }

        $label = $vl['outputLabel']
            ?? ($targetObject . '.' . $targetVal);

        try {
            $soql    = 'SELECT ' . $targetKey . ', ' . $targetVal
                     . ' FROM ' . $targetObject;
            $records = pb_queryAll($instance, $sessionId, $soql);

            // ルックアップマップを構築
            $lookupMap = [];
            foreach ($records as $rec) {
                $key = (string)($rec[$targetKey] ?? '');
                if ($key !== '') {
                    $lookupMap[$key] = $rec[$targetVal] ?? '';
                }
            }

            // ローカルキー列のインデックスを解決
            $localIdx = array_search($localKey, $headers);

            // 各行に突き合わせ値を追加
            foreach ($rows as &$row) {
                if ($localIdx !== false && isset($row[$localIdx])) {
                    $key   = (string)$row[$localIdx];
                    $row[] = $lookupMap[$key] ?? '';
                } else {
                    $row[] = '';
                }
            }
            unset($row);

            $headers[] = $label;

        } catch (\Throwable $e) {
            error_log("[PB VLOOKUP] Error for {$targetObject}: " . $e->getMessage());
            // エラー時は空値で列を追加してヘッダーとの整合を保つ
            foreach ($rows as &$row) {
                $row[] = '';
            }
            unset($row);
            $headers[] = $label;
        }
    }
}
