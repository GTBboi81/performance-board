<?php
set_time_limit(300);
ini_set('memory_limit', '512M');
date_default_timezone_set('Asia/Tokyo');

/**
 * SOQLクローズに危険な文字が含まれていないかチェックする。
 * セミコロン、コメント記号（--）、ブロックコメント（/* * /）を拒否する。
 *
 * @param string|null $str チェック対象の文字列
 * @return bool 許容できる場合 true
 */
function pb_validateSoqlIdentifier($str) {
    if ($str === '' || $str === null) return true;
    if (preg_match('/;|--|\\/\\*|\\*\\//', $str)) return false;
    return true;
}

/**
 * SOQLクローズを安全化する。検証失敗時は空文字を返し、ログに記録する。
 *
 * @param string|null $clause チェック対象の文字列
 * @return string 安全な文字列（検証失敗時は空文字）
 */
function pb_sanitizeSoqlClause($clause) {
    if (!$clause) return '';
    if (!pb_validateSoqlIdentifier($clause)) {
        error_log("[PB date_utils] Invalid SOQL clause rejected: $clause");
        return '';
    }
    return $clause;
}

/**
 * 日付文字列を YYYY/MM/DD 形式に正規化する。
 *
 * @param string $val  ISO 形式・スラッシュ形式など
 * @return string      正規化後の日付文字列（認識できない場合はそのまま）
 */
function pb_normalizeDate($val) {
    if (!$val) return '';

    // ISO 形式: 2026-04-01T00:00:00.000Z → 2026/04/01
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $val, $m)) {
        return $m[1] . '/' . $m[2] . '/' . $m[3];
    }

    // スラッシュ形式: 先頭10文字をそのまま返す
    if (preg_match('/^\d{4}\/\d{2}\/\d{2}/', $val)) {
        return substr($val, 0, 10);
    }

    return $val;
}

/**
 * 単一の日付フィルタ設定から SOQL WHERE 句フラグメントを生成する。
 *
 * @param array|null $filter  日付フィルタ設定
 * @return string             WHERE 句フラグメント（空の場合は空文字列）
 */
function pb_buildDateFilterClause($filter) {
    if (!$filter || !($filter['enabled'] ?? false) || !($filter['fieldName'] ?? '')) {
        return '';
    }

    $field  = $filter['fieldName'];
    $preset = $filter['preset'] ?? 'none';
    $now    = new \DateTime('now', new \DateTimeZone('Asia/Tokyo'));

    switch ($preset) {
        case 'thisMonth':
            $start = $now->format('Y-m-01');
            $end   = (clone $now)->modify('last day of this month')->format('Y-m-d');
            return "$field >= $start AND $field <= $end";

        case 'lastMonth':
            $s = (clone $now)->modify('first day of last month');
            $e = (clone $now)->modify('last day of last month');
            return "$field >= " . $s->format('Y-m-d') . " AND $field <= " . $e->format('Y-m-d');

        case 'lastAndThisMonth':
            $s = (clone $now)->modify('first day of last month');
            $e = (clone $now)->modify('last day of this month');
            return "$field >= " . $s->format('Y-m-d') . " AND $field <= " . $e->format('Y-m-d');

        case 'thisYear':
            $y = $now->format('Y');
            return "$field >= {$y}-01-01 AND $field <= {$y}-12-31";

        case 'yearMonth':
            $y       = $filter['year']  ?? $now->format('Y');
            $m       = str_pad($filter['month'] ?? $now->format('n'), 2, '0', STR_PAD_LEFT);
            $lastDay = date('t', mktime(0, 0, 0, (int)$m, 1, (int)$y));
            return "$field >= $y-$m-01 AND $field <= $y-$m-{$lastDay}";

        case 'custom':
            $parts = [];
            $start = $filter['customStart'] ?? '';
            $end   = $filter['customEnd']   ?? '';
            // YYYY-MM-DD形式のみ許可
            if ($start && preg_match('/^\d{4}-\d{2}-\d{2}$/', $start)) {
                $parts[] = "$field >= $start";
            }
            if ($end && preg_match('/^\d{4}-\d{2}-\d{2}$/', $end)) {
                $parts[] = "$field <= $end";
            }
            return implode(' AND ', $parts);

        default:
            return '';
    }
}

/**
 * ソース設定から WHERE 句全体を構築する。
 * soqlWhere と soqlDateFilters を結合する。
 *
 * @param array $source  ソース設定（soqlWhere, soqlDateFilters, _dateFilterJoinMode）
 * @return string        WHERE 句フラグメント（空の場合は空文字列）
 */
function pb_buildWhereClause($source) {
    $parts = [];

    if (!empty($source['soqlWhere'])) {
        $safe = pb_sanitizeSoqlClause($source['soqlWhere']);
        if ($safe) $parts[] = $safe;
    }

    $dateFilters = $source['soqlDateFilters'] ?? [];
    $joinMode    = $source['_dateFilterJoinMode'] ?? 'AND';
    $dateClauses = [];

    foreach ($dateFilters as $df) {
        $clause = pb_buildDateFilterClause($df);
        if ($clause) {
            $dateClauses[] = (strpos($clause, ' AND ') !== false) ? "($clause)" : $clause;
        }
    }

    if (count($dateClauses) === 1) {
        $parts[] = $dateClauses[0];
    } elseif (count($dateClauses) > 1) {
        $combined = ($joinMode === 'OR')
            ? '(' . implode(' OR ', $dateClauses) . ')'
            : implode(' AND ', $dateClauses);
        $parts[] = $combined;
    }

    return implode(' AND ', $parts);
}
