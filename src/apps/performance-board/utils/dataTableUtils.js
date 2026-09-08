// src/apps/performance-board/utils/dataTableUtils.js
// DataTable用ユーティリティ関数

/**
 * 算術計算を適用する共通関数
 * @param {object} group - グループ化されたデータ
 * @param {object} calc - 計算設定
 * @returns {number} 計算結果
 */
export const applyArithmeticCalc = (group, calc) => {
  let res = 0;
  if (calc.terms && calc.terms.length > 0) {
    res = group[calc.terms[0].field] || 0;
    for (let i = 1; i < calc.terms.length; i++) {
      const term = calc.terms[i];
      const val = group[term.field] || 0;
      if (term.operator === '+') res += val;
      else if (term.operator === '-') res -= val;
      else if (term.operator === '*') res *= val;
      else if (term.operator === '/') res = val !== 0 ? res / val : 0;
    }
  } else {
    const a = group[calc.fieldA] || 0;
    const b = group[calc.fieldB] || 0;
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

/**
 * 指標グループの除算結果を、表示単位に必要な精度で丸める。
 * % 表示は表示時に100倍するため、小数点以下4桁を保持する。
 */
export const roundIndicatorGroupFormulaValue = (value, operator = '/', unit = '') => {
  if (operator !== '/' || !Number.isFinite(value)) return value;
  const decimals = unit === '%' ? 4 : 2;
  return Number(value.toFixed(decimals));
};

/**
 * 書式を持たない指標グループの除算値を表示用に整形する。
 * 対象外の場合は null を返し、呼び出し元の既存書式処理へ委ねる。
 */
export const formatIndicatorGroupFormulaValue = (value, column) => {
  const operator = column?._formula?.operator || '/';
  if (
    typeof value !== 'number' ||
    !column?._isGroup ||
    column._aggregation !== 'formula' ||
    operator !== '/'
  ) {
    return null;
  }

  if (column._unit === '%') {
    return `${(value * 100).toFixed(2)}%`;
  }

  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return column._unit ? `${formatted}${column._unit}` : formatted;
};

/**
 * 日付正規化関数（ISO形式対応）
 * @param {string|Date} val - 日付値
 * @returns {string} 正規化された日付文字列 (YYYY/MM/DD形式)
 */
export const normalizeDate = (val) => {
  if (!val) return "";
  let str = String(val).trim();
  // タイムスタンプ部分を除去（ISO形式対応: 2023-06-01T15:00:00.000Z）
  if (str.includes('T')) {
    str = str.split('T')[0];
  }
  str = str.replace(/[\.\-]/g, '/');
  const parts = str.split('/');
  if (parts.length === 3) {
    const y = parts[0];
    const m = parts[1].padStart(2, '0');
    const d = parts[2].padStart(2, '0');
    return `${y}/${m}/${d}`;
  }
  return str;
};

/**
 * 文字列の表示幅を計算（全角文字は2倍としてカウント）
 * @param {string} text - 計算対象の文字列
 * @returns {number} 表示幅
 */
export const getTextWidth = (text) => {
  if (!text) return 0;
  const str = String(text);
  let width = 0;
  for (const char of str) {
    // 全角文字（日本語、全角記号など）は2倍の幅
    if (/[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF]/.test(char)) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
};

/**
 * 条件付き書式ルールを評価する関数
 * @param {number|string|null} value - セルの生データ値
 * @param {Array} rules - conditionalRules配列
 * @param {string} [format] - 'percent'の場合はvalue*100で比較
 * @returns {object|null} マッチしたルール、またはnull
 */
export const evaluateConditionalRules = (value, rules, format) => {
  if (!rules || rules.length === 0 || typeof value !== 'number') return null;
  const compareValue = format === 'percent' ? value * 100 : value;
  for (const rule of rules) {
    const threshold = parseFloat(rule.value);
    if (isNaN(threshold)) continue;
    let matches = false;
    switch (rule.operator) {
      case 'gt':  matches = compareValue > threshold; break;
      case 'gte': matches = compareValue >= threshold; break;
      case 'lt':  matches = compareValue < threshold; break;
      case 'lte': matches = compareValue <= threshold; break;
      case 'eq':  matches = compareValue === threshold; break;
      default: break;
    }
    if (matches) return rule;
  }
  return null;
};

/**
 * 値をフォーマットする関数（幅計算用）
 * @param {*} val - フォーマット対象の値
 * @param {string} colId - カラムID
 * @param {Map} calcMap - 計算設定Map
 * @param {Map} fieldMap - フィールド設定Map
 * @returns {string} フォーマットされた文字列
 */
export const formatValueForWidth = (val, colId, calcMap, fieldMap) => {
  if (val === null || val === undefined) return '';
  const calc = calcMap.get(colId);
  const sysField = fieldMap.get(colId);
  if (typeof val === 'number') {
    if (calc && calc.format === 'percent') {
      const decimals = calc.decimals ?? 2;
      return val.toFixed(decimals) + '%';
    } else if (calc && (calc.format === 'number') && typeof calc.decimals === 'number') {
      return val.toLocaleString(undefined, { minimumFractionDigits: calc.decimals, maximumFractionDigits: calc.decimals });
    } else if (sysField && typeof sysField.decimals === 'number' && sysField.decimals > 0) {
      return val.toLocaleString(undefined, { minimumFractionDigits: sysField.decimals, maximumFractionDigits: sysField.decimals });
    }
    return val.toLocaleString();
  }
  return String(val);
};
