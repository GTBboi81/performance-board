// src/apps/performance-board/utils/fetchBoardData.js
// 任意ボードのデータを取得・計算するスタンドアロンユーティリティ
// 非アクティブボードのデータを統合インポートUI内で取得するために使用

import { loadAllFromCache } from '../../../indexedDBCache';
import { normalizeDate } from '../../../utils/dateUtils';
import { combineSourceDataInWorker } from './combineSourceDataWorker';

// --- normalizeDate (Worker用: スラッシュ区切り版) ---
const normalizeDateForCalc = (val) => {
  if (!val) return '';
  let str = String(val).trim();
  if (str.includes('T')) str = str.split('T')[0];
  str = str.replace(/[.\-]/g, '/');
  const parts = str.split('/');
  if (parts.length === 3) {
    return `${parts[0]}/${parts[1].padStart(2, '0')}/${parts[2].padStart(2, '0')}`;
  }
  return str;
};

// --- 算術計算 (calculationWorker.js と同一) ---
const applyArithmetic = (row, calc) => {
  let res = 0;
  if (calc.terms && calc.terms.length > 0) {
    res = row[calc.terms[0].field] || 0;
    for (let i = 1; i < calc.terms.length; i++) {
      const term = calc.terms[i];
      const val = row[term.field] || 0;
      if (term.operator === '+') res += val;
      else if (term.operator === '-') res -= val;
      else if (term.operator === '*') res *= val;
      else if (term.operator === '/') res = val !== 0 ? res / val : 0;
    }
  } else {
    const a = row[calc.fieldA] || 0;
    const b = row[calc.fieldB] || 0;
    if (calc.operator === '+') res = a + b;
    else if (calc.operator === '-') res = a - b;
    else if (calc.operator === '*') res = a * b;
    else if (calc.operator === '/') res = b !== 0 ? a / b : 0;
  }

  const decimals = calc.decimals ?? (calc.format === 'percent' ? 2 : 2);
  if (calc.format === 'percent') return parseFloat((res * 100).toFixed(decimals));
  else if (calc.format === 'integer') return Math.round(res);
  else return parseFloat(res.toFixed(decimals));
};

// --- sourceIndices構築 (useAnalyticsData.js と同一ロジック) ---
function buildSourceIndices(calculations, sourceCache) {
  const indices = {};
  const relationCalcs = calculations.filter(c => c.type === 'relation' || c.type === 'conditionalCount');

  relationCalcs.forEach(calc => {
    if (!calc.targetSourceId) return;

    const sourceRows = sourceCache[calc.targetSourceId] || [];
    if (sourceRows.length === 0) return;

    const foreignKeyIdx = calc.foreignKeyIndex !== '' && calc.foreignKeyIndex !== undefined
      ? parseInt(calc.foreignKeyIndex)
      : 0;

    const indexKey = `${calc.targetSourceId}:${calc.id}`;
    const indexMap = new Map();

    sourceRows.forEach(row => {
      const rawKey = row[foreignKeyIdx];
      const key = (rawKey === undefined || rawKey === null || rawKey === '') ? '(空白)' : String(rawKey);
      if (!indexMap.has(key)) indexMap.set(key, []);
      indexMap.get(key).push(row);
    });

    indices[indexKey] = indexMap;
  });

  return indices;
}

// --- 静的フィルター評価 (calculationWorker.js と同一) ---
function evaluateStaticFilter(sourceRow, filter) {
  const colIdx = parseInt(filter.colIndex);
  if (isNaN(colIdx)) return true;

  const val = sourceRow[colIdx];
  const valStr = String(val ?? '');
  const numVal = parseFloat(valStr.replace(/,/g, ''));
  const filterNum = parseFloat(String(filter.value).replace(/,/g, ''));
  const filterNum2 = filter.value2 ? parseFloat(String(filter.value2).replace(/,/g, '')) : NaN;

  switch (filter.conditionType) {
    case 'equals': return valStr === filter.value;
    case 'notEquals': return valStr !== filter.value;
    case 'contains': return valStr.includes(filter.value || '');
    case 'notContains': return !valStr.includes(filter.value || '');
    case 'isEmpty': return !val || val === '';
    case 'isNotEmpty': return val && val !== '';
    case 'greaterThan': return !isNaN(numVal) && !isNaN(filterNum) && numVal > filterNum;
    case 'lessThan': return !isNaN(numVal) && !isNaN(filterNum) && numVal < filterNum;
    case 'greaterOrEqual': return !isNaN(numVal) && !isNaN(filterNum) && numVal >= filterNum;
    case 'lessOrEqual': return !isNaN(numVal) && !isNaN(filterNum) && numVal <= filterNum;
    case 'between': return !isNaN(numVal) && !isNaN(filterNum) && !isNaN(filterNum2) && numVal >= filterNum && numVal <= filterNum2;
    default: return true;
  }
}

// --- 条件フィルター評価 (calculationWorker.js と同一) ---
function evaluateConditionFilter(sourceRow, cond) {
  const colIdx = parseInt(cond.columnIndex);
  if (isNaN(colIdx)) return true;

  const val = sourceRow[colIdx];
  const valStr = String(val ?? '');
  const numVal = parseFloat(valStr.replace(/,/g, ''));
  const condNum = parseFloat(String(cond.value).replace(/,/g, ''));
  const condNum2 = cond.value2 ? parseFloat(String(cond.value2).replace(/,/g, '')) : NaN;

  switch (cond.operator) {
    case 'notEmpty': return val !== undefined && val !== null && val !== '';
    case 'empty': return val === undefined || val === null || val === '';
    case 'equals': return valStr === cond.value;
    case 'notEquals': return valStr !== cond.value;
    case 'contains': return valStr.includes(cond.value || '');
    case 'notContains': return !valStr.includes(cond.value || '');
    case 'greaterThan': return !isNaN(numVal) && !isNaN(condNum) && numVal > condNum;
    case 'lessThan': return !isNaN(numVal) && !isNaN(condNum) && numVal < condNum;
    case 'greaterOrEqual': return !isNaN(numVal) && !isNaN(condNum) && numVal >= condNum;
    case 'lessOrEqual': return !isNaN(numVal) && !isNaN(condNum) && numVal <= condNum;
    case 'between': return !isNaN(numVal) && !isNaN(condNum) && !isNaN(condNum2) && numVal >= condNum && numVal <= condNum2;
    default: return true;
  }
}

// --- リレーション/条件カウント共通: マッチング行のフィルタリング ---
function filterMatchingRows(matchingRows, calc, newRow) {
  let filtered = matchingRows;

  // 日付フィルター
  if (calc.dateColumnIndex !== '' && calc.dateColumnIndex !== undefined) {
    const dateColIdx = parseInt(calc.dateColumnIndex);
    if (!isNaN(dateColIdx) && newRow.date) {
      const targetDate = normalizeDateForCalc(newRow.date);
      filtered = filtered.filter(r => normalizeDateForCalc(r[dateColIdx]) === targetDate);
    }
  }
  // 追加日付カラム (ボード日付範囲フィルタ)
  // ※ 統合インポートではactiveFiltersが空のためスキップ

  // filterMappings フィルター（activeFilters={}のため基本スキップ）
  // 統合インポートではactiveFiltersは空のため省略

  // 静的フィルター
  if (calc.filters && calc.filters.length > 0) {
    filtered = filtered.filter(sourceRow => {
      for (const filter of calc.filters) {
        if (!evaluateStaticFilter(sourceRow, filter)) return false;
      }
      return true;
    });
  }

  // 条件フィルター (conditionalCount用)
  if (calc.conditions && calc.conditions.length > 0) {
    filtered = filtered.filter(sourceRow => {
      for (const cond of calc.conditions) {
        if (!evaluateConditionFilter(sourceRow, cond)) return false;
      }
      return true;
    });
  }

  return filtered;
}

/**
 * 計算を同期実行（Worker不要版）
 * calculationWorker.jsと同一ロジック、activeFilters={}前提
 */
function applyCalculationsSync(rawData, calculations, sourceCache) {
  if (!calculations || calculations.length === 0) return rawData;

  const sourceIndices = buildSourceIndices(calculations, sourceCache);

  // 計算順序: 固定値 → リレーション(LOOKUP先行) → 条件カウント → 四則演算
  const relCalcs = calculations.filter(c => c.type === 'relation');
  relCalcs.sort((a, b) => (a.aggType === 'lookup' ? -1 : 0) - (b.aggType === 'lookup' ? -1 : 0));
  const orderedCalcs = [
    ...calculations.filter(c => c.type === 'constant'),
    ...relCalcs,
    ...calculations.filter(c => c.type === 'conditionalCount'),
    ...calculations.filter(c => c.type === 'arithmetic'),
  ];

  return rawData.map(row => {
    const newRow = { ...row };

    for (const calc of orderedCalcs) {
      if (calc.type === 'constant') {
        newRow[calc.id] = calc.constantValue;

      } else if (calc.type === 'arithmetic') {
        newRow[calc.id] = applyArithmetic(newRow, calc);

      } else if (calc.type === 'relation') {
        const indexKey = `${calc.targetSourceId}:${calc.id}`;
        const indexMap = sourceIndices[indexKey];

        const rawKey = newRow[calc.localKeyId] ?? newRow.id;
        const myKey = (rawKey === undefined || rawKey === null || rawKey === '') ? '(空白)' : String(rawKey);

        let matchingRows = indexMap ? (indexMap.get(myKey) || []) : [];
        matchingRows = filterMatchingRows(matchingRows, calc, newRow);

        // 集計
        if (calc.aggType === 'lookup') {
          const lookupIdx = parseInt(calc.aggTargetIndex);
          newRow[calc.id] = (matchingRows.length > 0 && !isNaN(lookupIdx)) ? (matchingRows[0][lookupIdx] ?? '') : '';
        } else if (calc.aggType === 'sum') {
          const sumTargetIdx = parseInt(calc.aggTargetIndex);
          newRow[calc.id] = matchingRows.reduce((sum, r) => {
            const v = parseFloat(String(r[sumTargetIdx]).replace(/,/g, ''));
            return sum + (isNaN(v) ? 0 : v);
          }, 0);
        } else {
          if (calc.aggTargetIndex !== '' && calc.aggTargetIndex !== undefined) {
            const targetIdx = parseInt(calc.aggTargetIndex);
            newRow[calc.id] = matchingRows.filter(r => r[targetIdx] && r[targetIdx] !== '').length;
          } else {
            newRow[calc.id] = matchingRows.length;
          }
        }

      } else if (calc.type === 'conditionalCount') {
        const indexKey = `${calc.targetSourceId}:${calc.id}`;
        const indexMap = sourceIndices[indexKey];

        const rawKey = newRow[calc.localKeyId] ?? newRow.id;
        const myKey = (rawKey === undefined || rawKey === null || rawKey === '') ? '(空白)' : String(rawKey);

        let matchingRows = indexMap ? (indexMap.get(myKey) || []) : [];
        matchingRows = filterMatchingRows(matchingRows, calc, newRow);

        newRow[calc.id] = matchingRows.length;
      }
    }

    return newRow;
  });
}

/**
 * 任意ボードのデータを取得・計算する（非アクティブボード用）
 * パイプライン: IndexedDB → Google Sheets / Salesforce → combineSourceData → 計算(同期)
 *
 * @param {object} params
 * @param {string} params.boardId - ダッシュボードID
 * @param {object} params.boardConfig - ダッシュボード設定（allDashboards[boardId]）
 * @param {string} params.globalApiKey - Google Sheets APIキー
 * @param {AbortSignal} [params.signal] - 読み込み・結合のキャンセルsignal
 * @param {function} [params.onProgress] - 結合進捗コールバック
 * @param {function} [params.onMetrics] - 結合計測結果コールバック
 * @returns {{ calculatedData: array|null, sourceCache: object|null, error: string|null }}
 */
export async function fetchBoardData({
  boardId,
  boardConfig,
  globalApiKey,
  signal,
  onProgress,
  onMetrics,
}) {
  const throwIfAborted = () => {
    if (!signal?.aborted) return;
    const error = new Error('データ読込をキャンセルしました。');
    error.name = 'AbortError';
    throw error;
  };

  throwIfAborted();
  if (!boardConfig) {
    return { calculatedData: null, sourceCache: null, error: 'ボード設定が見つかりません' };
  }

  const dataSources = boardConfig.dataSources || [];
  const sourceIds = dataSources.map(s => s.id);

  if (sourceIds.length === 0) {
    return { calculatedData: null, sourceCache: null, error: 'データソースが設定されていません' };
  }

  // 1. IndexedDBキャッシュから読み込み
  let sourceData = {};
  try {
    sourceData = await loadAllFromCache(boardId, sourceIds);
  } catch {
    // キャッシュ読み込み失敗時は空で続行
  }
  throwIfAborted();

  // 2. 不足分をフェッチ
  const missingIds = sourceIds.filter(id => !sourceData[id]);

  if (missingIds.length > 0) {
    // Google Sheetsソース取得
    const sheetSources = dataSources.filter(s =>
      missingIds.includes(s.id) && (s.sourceType || 'spreadsheet') === 'spreadsheet'
    );

    if (sheetSources.length > 0 && globalApiKey) {
      for (const source of sheetSources) {
        if (!source.spreadsheetId || !source.sheetName) {
          sourceData[source.id] = [];
          continue;
        }

        try {
          const range = `'${source.sheetName}'!A2:ZZZ`;
          const url = `https://sheets.googleapis.com/v4/spreadsheets/${source.spreadsheetId}/values/${encodeURIComponent(range)}?key=${globalApiKey}`;
          const res = await fetch(url, { signal });

          if (!res.ok) {
            const errorBody = await res.text();
            let errorDetail = res.statusText;
            try {
              const errorJson = JSON.parse(errorBody);
              errorDetail = errorJson.error?.message || errorBody;
            } catch { /* ignore */ }
            return { calculatedData: null, sourceCache: null, error: `"${source.name}" の取得に失敗: ${res.status} ${errorDetail}` };
          }

          const json = await res.json();
          sourceData[source.id] = json.values || [];
        } catch (e) {
          if (e?.name === 'AbortError') throw e;
          return { calculatedData: null, sourceCache: null, error: `"${source.name}" の取得に失敗: ${e.message}` };
        }
      }
    }

    // Salesforceソース取得
    const sfSources = dataSources.filter(s =>
      missingIds.includes(s.id) && s.sourceType === 'salesforce' && s.reportId
    );

    for (const source of sfSources) {
      try {
        const res = await fetch(
          `./fetch_sf_report.php?action=execute&reportId=${encodeURIComponent(source.reportId)}`,
          { signal }
        );
        if (!res.ok) throw new Error(`SF fetch failed: ${res.status}`);
        const json = await res.json();
        if (json.status !== 'success' || !json.data) throw new Error(json.message || 'SF data error');

        const rows = json.data.rows || [];
        const dateColIdx = source.dateColumnIndex;
        const hasDateCol = dateColIdx !== null && dateColIdx !== undefined;

        sourceData[source.id] = rows.map(row => {
          const newRow = [...row];
          if (hasDateCol && newRow[dateColIdx]) {
            newRow[dateColIdx] = normalizeDate(newRow[dateColIdx]);
          }
          return newRow;
        });
      } catch (e) {
        if (e?.name === 'AbortError') throw e;
        return { calculatedData: null, sourceCache: null, error: `"${source.name}" のSF取得に失敗: ${e.message}` };
      }
    }

    // まだ不足がある場合（APIキーなし等）
    const stillMissing = sourceIds.filter(id => !sourceData[id]);
    if (stillMissing.length > 0) {
      const missingNames = stillMissing.map(id => {
        const src = dataSources.find(s => s.id === id);
        return src?.name || id;
      }).join(', ');
      return { calculatedData: null, sourceCache: null, error: `データソース取得不可: ${missingNames}（APIキーまたは接続設定を確認してください）` };
    }
  }

  // 3. combineSourceData で結合
  throwIfAborted();
  const combinedRows = await combineSourceDataInWorker(sourceData, boardConfig, {
    signal,
    onProgress,
    onMetrics,
  });
  throwIfAborted();

  if (combinedRows.length === 0) {
    return { calculatedData: [], sourceCache: sourceData, error: null };
  }

  // 4. 計算を同期適用
  const calculatedData = applyCalculationsSync(combinedRows, boardConfig.calculations || [], sourceData);

  return { calculatedData, sourceCache: sourceData, error: null };
}
