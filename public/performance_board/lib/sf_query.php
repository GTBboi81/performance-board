<?php
set_time_limit(300);
ini_set('memory_limit', '512M');
date_default_timezone_set('Asia/Tokyo');

/**
 * SOQL を実行しレコード全件を返す（ページネーション対応）。
 *
 * @param string $instance   SFインスタンスホスト名
 * @param string $sessionId  SFセッションID
 * @param string $soql       SOQL文字列
 * @return array  SF レコードの配列（各要素は連想配列）
 * @throws \Exception HTTP エラー時
 */
function pb_queryAll($instance, $sessionId, $soql) {
    $allRecords = [];
    $apiVersion = defined('SF_API_VERSION') ? SF_API_VERSION : 'v57.0';
    $url        = "https://$instance/services/data/$apiVersion/query?q=" . urlencode($soql);

    while ($url) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 300,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_HTTPHEADER     => ["Authorization: Bearer $sessionId"],
        ]);
        $response = curl_exec($ch);
        $curlErr  = curl_error($ch);
        $code     = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($curlErr) {
            error_log("[PB sf_query] cURL error: $curlErr");
            throw new \Exception('SOQLクエリ通信エラー');
        }

        if ($code !== 200) {
            $decoded = json_decode($response, true);
            $msg     = is_array($decoded) && isset($decoded[0]['message'])
                ? $decoded[0]['message']
                : "HTTP $code";
            error_log("[PB sf_query] SOQL error ($code): $msg | SOQL: $soql");
            throw new \Exception("SOQLエラー: $msg");
        }

        $result = json_decode($response, true);
        if (isset($result['records'])) {
            foreach ($result['records'] as $rec) {
                unset($rec['attributes']);
                $allRecords[] = $rec;
            }
        }

        $url = (isset($result['done']) && !$result['done'] && isset($result['nextRecordsUrl']))
            ? "https://$instance" . $result['nextRecordsUrl']
            : null;
    }

    return $allRecords;
}

/**
 * SF レコード配列を [columns, rows(2D array)] 形式に変換する。
 * ドット記法（リレーション）も解決する。例: "Account.Name"
 *
 * @param array $records SF レコード配列
 * @param array $fields  取得フィールド名配列
 * @return array{columns: array, rows: array}
 */
function pb_recordsToArrays($records, $fields) {
    $columns = $fields;
    $rows    = [];

    foreach ($records as $rec) {
        $row = [];
        foreach ($fields as $f) {
            // ドット記法対応: "Account.Name" → $rec['Account']['Name']
            $val = $rec;
            foreach (explode('.', $f) as $part) {
                $val = is_array($val) ? ($val[$part] ?? null) : null;
            }
            $row[] = $val;
        }
        $rows[] = $row;
    }

    return ['columns' => $columns, 'rows' => $rows];
}

/**
 * SOQL を実行して [columns, rows] 形式で返すメイン関数。
 *
 * @param string $instance
 * @param string $sessionId
 * @param string $objectName  SFオブジェクト名
 * @param array  $fields      SELECTするフィールド名配列
 * @param string $where       WHERE 句（"AND ..." は不要、条件のみ）
 * @param string $orderBy     ORDER BY 句（フィールド名のみ）
 * @return array{columns: array, rows: array}
 */
function pb_executeSoql($instance, $sessionId, $objectName, $fields, $where = '', $orderBy = '') {
    $soql = 'SELECT ' . implode(', ', $fields) . ' FROM ' . $objectName;
    if ($where)   $soql .= ' WHERE '    . $where;
    if ($orderBy) $soql .= ' ORDER BY ' . $orderBy;

    $records = pb_queryAll($instance, $sessionId, $soql);
    return pb_recordsToArrays($records, $fields);
}
