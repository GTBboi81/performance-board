<?php
set_time_limit(300);
ini_set('memory_limit', '512M');
date_default_timezone_set('Asia/Tokyo');

/**
 * ワイド形式（1行=1人×N日分の列）をロング形式（1行=1人×1日）に変換する。
 * analytics の JS 実装と同等のロジック。
 *
 * @param array $rows     2次元配列（元データ）
 * @param array $headers  列名配列
 * @param array $settings reshapeWideToLong 設定
 * @return array{headers: array, rows: array}
 */
function pb_reshapeWideToLong($rows, $headers, $settings) {
    if (empty($rows) || !($settings['enabled'] ?? false)) {
        return ['headers' => $headers, 'rows' => $rows];
    }

    // 固定列のインデックスを解決
    $fixedNames   = $settings['fixedColumnNames'] ?? [];
    $fixedIndices = [];
    foreach ($fixedNames as $name) {
        $idx = array_search($name, $headers);
        if ($idx !== false) $fixedIndices[] = $idx;
    }

    // 日付・月列のインデックス
    $dateColName  = $settings['dateColumnName']  ?? '';
    $dateColIdx   = $dateColName  ? array_search($dateColName,  $headers) : false;
    $monthColName = $settings['monthColumnName'] ?? '';
    $monthColIdx  = $monthColName ? array_search($monthColName, $headers) : false;

    $groups = $settings['groups'] ?? [];
    if (empty($groups)) {
        return ['headers' => $headers, 'rows' => $rows];
    }

    // 出力ヘッダーを構築
    $genDateCol     = $settings['generatedDateColumnName'] ?? '稼働日';
    $outHeaders     = [$genDateCol];
    foreach ($fixedIndices as $idx) {
        $outHeaders[] = $headers[$idx];
    }

    // グループ内の列ラベル（最初のグループから取得）
    if (!empty($groups[0]['columns'])) {
        foreach ($groups[0]['columns'] as $col) {
            $outHeaders[] = $col['outputName'] ?? $col['sourceName'] ?? '';
        }
    }

    $skipEmpty   = $settings['skipEmptyDays']    ?? true;
    $convertTime = $settings['convertTimeToHours'] ?? false;
    $outRows     = [];

    foreach ($rows as $row) {
        // 年月を取得
        $dateVal  = ($dateColIdx  !== false) ? ($row[$dateColIdx]  ?? '') : '';
        $monthVal = ($monthColIdx !== false) ? ($row[$monthColIdx] ?? '') : '';
        $yearMonth = pb_parseDateColumn($dateVal, $monthVal);

        foreach ($groups as $group) {
            $dayNumber = $group['dayNumber'] ?? ($group['dayIndex'] ?? 1);
            $columns   = $group['columns']   ?? [];

            // 日付文字列を構築
            $dateStr = pb_buildDate($yearMonth['year'], $yearMonth['month'], $dayNumber);
            if (!$dateStr) continue;

            // グループの各値を収集
            $values   = [];
            $allEmpty = true;
            foreach ($columns as $col) {
                $srcName = $col['sourceName'] ?? '';
                $srcIdx  = $srcName ? array_search($srcName, $headers) : false;
                $val     = ($srcIdx !== false) ? ($row[$srcIdx] ?? null) : null;

                if ($convertTime && $val !== null && is_string($val)
                        && preg_match('/^\d{1,2}:\d{2}/', $val)) {
                    $val = pb_timeToHours($val);
                }

                if ($val !== null && $val !== '') $allEmpty = false;
                $values[] = $val;
            }

            if ($skipEmpty && $allEmpty) continue;

            // 出力行を組み立て
            $outRow = [$dateStr];
            foreach ($fixedIndices as $idx) {
                $outRow[] = $row[$idx] ?? '';
            }
            foreach ($values as $v) {
                $outRow[] = $v;
            }
            $outRows[] = $outRow;
        }
    }

    return ['headers' => $outHeaders, 'rows' => $outRows];
}

/**
 * 日付・月列の値から年・月を取得する。
 *
 * @param string $dateVal  日付列の値
 * @param string $monthVal 月列の値（補助）
 * @return array{year: int|string, month: int}
 */
function pb_parseDateColumn($dateVal, $monthVal = '') {
    $year  = (int)date('Y');
    $month = (int)date('n');

    if (preg_match('/^(\d{4})[\/\-](\d{1,2})/', $dateVal, $m)) {
        $year  = (int)$m[1];
        $month = (int)$m[2];
    } elseif (preg_match('/(\d{4})年\s*(\d{1,2})月/', $dateVal, $m)) {
        $year  = (int)$m[1];
        $month = (int)$m[2];
    } elseif ($monthVal && preg_match('/(\d{1,2})/', $monthVal, $m)) {
        $month = (int)$m[1];
    }

    return ['year' => $year, 'month' => $month];
}

/**
 * 年・月・日から YYYY/MM/DD 文字列を生成する。
 * 月末を超える日は null を返す。
 *
 * @param int|string $year
 * @param int        $month
 * @param int        $day
 * @return string|null
 */
function pb_buildDate($year, $month, $day) {
    $lastDay = (int)date('t', mktime(0, 0, 0, (int)$month, 1, (int)$year));
    if ($day < 1 || $day > $lastDay) return null;
    return sprintf('%04d/%02d/%02d', (int)$year, (int)$month, (int)$day);
}

/**
 * "HH:MM" 形式の文字列を時間数（小数）に変換する。
 *
 * @param string $val  "8:30" など
 * @return float|string 変換できない場合は元の値を返す
 */
function pb_timeToHours($val) {
    if (preg_match('/^(\d{1,2}):(\d{2})/', $val, $m)) {
        return round((int)$m[1] + (int)$m[2] / 60, 2);
    }
    return $val;
}
