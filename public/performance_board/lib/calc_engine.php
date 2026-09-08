<?php
set_time_limit(300);
ini_set('memory_limit', '512M');
date_default_timezone_set('Asia/Tokyo');

// pb_validateSoqlIdentifier を使用するため date_utils を読み込む
require_once __DIR__ . '/date_utils.php';

/**
 * 計算フィールドの依存関係をトポロジカルソートで解決する。
 * arithmetic 型が他の計算フィールドを参照する場合の評価順を決定する。
 *
 * @param array $calculations 計算フィールド設定配列
 * @return array ソート済み計算フィールド配列
 */
function pb_topologicalSort($calculations) {
    $calcIds = [];
    foreach ($calculations as $c) {
        $calcIds[$c['id']] = true;
    }

    // 依存グラフを構築
    $graph = [];
    foreach ($calculations as $c) {
        $deps = [];
        if (($c['type'] ?? '') === 'arithmetic' && !empty($c['terms'])) {
            foreach ($c['terms'] as $term) {
                if (isset($term['field']) && isset($calcIds[$term['field']])) {
                    $deps[] = $term['field'];
                }
            }
        }
        $graph[$c['id']] = $deps;
    }

    $sorted   = [];
    $visited  = [];
    $visiting = [];
    $calcMap  = [];
    foreach ($calculations as $c) {
        $calcMap[$c['id']] = $c;
    }

    $visit = null;
    $visit = function($id) use (&$visit, &$sorted, &$visited, &$visiting, &$graph) {
        if (isset($visited[$id]))  return;
        if (isset($visiting[$id])) return; // 循環参照は無視
        $visiting[$id] = true;
        foreach ($graph[$id] ?? [] as $dep) {
            $visit($dep);
        }
        unset($visiting[$id]);
        $visited[$id] = true;
        $sorted[] = $id;
    };

    foreach ($calculations as $c) {
        $visit($c['id']);
    }

    return array_values(array_filter(
        array_map(fn($id) => $calcMap[$id] ?? null, $sorted)
    ));
}

/**
 * 四則演算を実行して結果を返す。
 * terms 形式と旧形式（fieldA / fieldB / operator）の両方に対応。
 *
 * @param array $row   行データ（連想配列）
 * @param array $calc  計算フィールド設定
 * @return int|float
 */
function pb_applyArithmetic($row, $calc) {
    $terms = $calc['terms'] ?? [];

    if (empty($terms)) {
        // 旧形式: fieldA, fieldB, operator
        $a  = (float)($row[$calc['fieldA'] ?? ''] ?? 0);
        $b  = (float)($row[$calc['fieldB'] ?? ''] ?? 0);
        $op = $calc['operator'] ?? '+';
        if ($op === '/' && $b == 0) return 0;
        switch ($op) {
            case '+': $result = $a + $b; break;
            case '-': $result = $a - $b; break;
            case '*': $result = $a * $b; break;
            case '/': $result = $a / $b; break;
            default:  $result = 0;
        }
    } else {
        // terms 形式: [{field: 'A'}, {operator: '+', field: 'B'}, ...]
        $result = (float)($row[$terms[0]['field'] ?? ''] ?? 0);
        for ($i = 1; $i < count($terms); $i++) {
            $op  = $terms[$i]['operator'] ?? '+';
            $val = (float)($row[$terms[$i]['field'] ?? ''] ?? 0);
            if ($op === '/' && $val == 0) {
                $result = 0;
                continue;
            }
            switch ($op) {
                case '+': $result += $val; break;
                case '-': $result -= $val; break;
                case '*': $result *= $val; break;
                case '/': $result /= $val; break;
            }
        }
    }

    $format   = $calc['format']   ?? '';
    $decimals = $calc['decimals'] ?? 2;
    if ($format === 'percent')  return round($result * 100, $decimals);
    if ($format === 'integer')  return (int)round($result);
    return round($result, $decimals);
}

/**
 * 条件カウント・条件合計を評価する。
 *
 * @param array $row   行データ（連想配列）
 * @param array $calc  計算フィールド設定
 * @return int|float
 */
function pb_evaluateConditional($row, $calc) {
    $targetValue = $row[$calc['targetField'] ?? ''] ?? null;
    $rules       = $calc['rules'] ?? [];

    $matches = true;
    foreach ($rules as $rule) {
        $ruleVal = $rule['value']    ?? '';
        $op      = $rule['operator'] ?? 'eq';
        switch ($op) {
            case 'eq':
            case '===':
                $matches = $matches && ((string)$targetValue === (string)$ruleVal);
                break;
            case 'neq':
            case '!==':
                $matches = $matches && ((string)$targetValue !== (string)$ruleVal);
                break;
            case 'gt':
            case '>':
                $matches = $matches && ((float)$targetValue > (float)$ruleVal);
                break;
            case 'gte':
            case '>=':
                $matches = $matches && ((float)$targetValue >= (float)$ruleVal);
                break;
            case 'lt':
            case '<':
                $matches = $matches && ((float)$targetValue < (float)$ruleVal);
                break;
            case 'lte':
            case '<=':
                $matches = $matches && ((float)$targetValue <= (float)$ruleVal);
                break;
            case 'contains':
                $matches = $matches && (strpos((string)($targetValue ?? ''), (string)$ruleVal) !== false);
                break;
            default:
                $matches = false;
        }
    }

    $aggType = $calc['aggType'] ?? 'count';
    if ($aggType === 'count') return $matches ? 1 : 0;
    if ($aggType === 'sum')   return $matches ? (float)($row[$calc['sumField'] ?? ''] ?? 0) : 0;
    return 0;
}

/**
 * リレーション計算を評価する。
 *
 * @param array $row           行データ（連想配列）
 * @param array $calc          計算フィールド設定
 * @param array $lookupDataMap pb_buildLookupDataMap が返すマップ
 * @return int|float|string
 */
function pb_evaluateRelation($row, $calc, $lookupDataMap) {
    $calcId = $calc['id'];
    if (!isset($lookupDataMap[$calcId])) return 0;

    $joinValue   = (string)($row[$calc['joinField'] ?? ''] ?? '');
    $matchingRows = $lookupDataMap[$calcId][$joinValue] ?? [];

    // フィルタ適用
    if (!empty($calc['filters'])) {
        $matchingRows = array_values(array_filter($matchingRows, function($lr) use ($calc) {
            foreach ($calc['filters'] as $f) {
                $v  = $lr[$f['field'] ?? ''] ?? null;
                $fv = $f['value'] ?? '';
                switch ($f['op'] ?? 'eq') {
                    case 'eq':  if ((string)$v !== (string)$fv) return false; break;
                    case 'neq': if ((string)$v === (string)$fv) return false; break;
                    case 'gt':  if ((float)$v  <= (float)$fv)   return false; break;
                    case 'gte': if ((float)$v  <  (float)$fv)   return false; break;
                    case 'lt':  if ((float)$v  >= (float)$fv)   return false; break;
                    case 'lte': if ((float)$v  >  (float)$fv)   return false; break;
                }
            }
            return true;
        }));
    }

    $aggType = $calc['aggType']       ?? 'count';
    $field   = $calc['aggTargetField'] ?? '';

    switch ($aggType) {
        case 'count':
            return count($matchingRows);
        case 'sum':
            return array_sum(array_map(fn($r) => (float)($r[$field] ?? 0), $matchingRows));
        case 'lookup':
            return !empty($matchingRows) ? ($matchingRows[0][$field] ?? '') : '';
        default:
            return 0;
    }
}

/**
 * 行レベルの計算を全行に適用する。
 * 評価順: constant → conditional → relation → arithmetic（トポロジカルソート）
 *
 * @param array $rowObjects     連想配列の行配列（参照渡し）
 * @param array $calculations   計算フィールド設定配列
 * @param array $lookupDataMap  pb_buildLookupDataMap が返すマップ
 * @return void
 */
function pb_applyRowCalculations(&$rowObjects, $calculations, $lookupDataMap = []) {
    $sortedCalcs = pb_topologicalSort($calculations);

    foreach ($rowObjects as &$obj) {
        // 固定値
        foreach ($calculations as $calc) {
            if (($calc['type'] ?? '') === 'constant') {
                $obj[$calc['id']] = $calc['value'] ?? 0;
            }
        }

        // 条件カウント・条件合計
        foreach ($calculations as $calc) {
            if (($calc['type'] ?? '') === 'conditional') {
                $obj[$calc['id']] = pb_evaluateConditional($obj, $calc);
            }
        }

        // リレーション
        foreach ($calculations as $calc) {
            if (($calc['type'] ?? '') === 'relation') {
                $obj[$calc['id']] = pb_evaluateRelation($obj, $calc, $lookupDataMap);
            }
        }

        // 四則演算（依存関係順）
        foreach ($sortedCalcs as $calc) {
            if (($calc['type'] ?? '') === 'arithmetic') {
                $obj[$calc['id']] = pb_applyArithmetic($obj, $calc);
            }
        }
    }
    unset($obj);
}

/**
 * リレーション計算用の lookupDataMap を SF から取得して構築する。
 * キー: 計算フィールドID、値: [targetJoinField の値 => レコード配列] のマップ
 *
 * @param array  $calculations 計算フィールド設定配列
 * @param string $instance     SFインスタンスホスト名
 * @param string $sessionId    SFセッションID
 * @return array
 */
function pb_buildLookupDataMap($calculations, $instance, $sessionId) {
    $map = [];

    foreach ($calculations as $calc) {
        if (($calc['type'] ?? '') !== 'relation' || empty($calc['sourceQuery'])) {
            continue;
        }

        if (!pb_validateSoqlIdentifier($calc['sourceQuery'])) {
            error_log("[PB calc_engine] Invalid sourceQuery rejected: " . $calc['sourceQuery']);
            continue;
        }

        try {
            $records   = pb_queryAll($instance, $sessionId, $calc['sourceQuery']);
            $joinField = $calc['targetJoinField'] ?? '';
            $index     = [];
            foreach ($records as $rec) {
                $key = (string)($rec[$joinField] ?? '');
                if (!isset($index[$key])) $index[$key] = [];
                $index[$key][] = $rec;
            }
            $map[$calc['id']] = $index;
        } catch (\Throwable $e) {
            error_log("[PB Relation] Error for calc {$calc['id']}: " . $e->getMessage());
            $map[$calc['id']] = [];
        }
    }

    return $map;
}
