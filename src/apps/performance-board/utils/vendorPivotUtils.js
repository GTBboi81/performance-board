// src/apps/performance-board/utils/vendorPivotUtils.js
// 販社ピボットテーブル用ユーティリティ関数

/**
 * 文字列から日付オブジェクトを解析
 * @param {string|Date} dateValue - 日付値
 * @returns {Date|null} - Dateオブジェクト
 */
const parseDateValue = (dateValue) => {
  if (!dateValue) return null;

  const strVal = String(dateValue).trim();
  let date;

  // ISO形式 (YYYY-MM-DDTHH:MM:SS) を先にチェック
  if (strVal.includes('T')) {
    const isoDate = new Date(strVal);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }
  }

  // YYYY/MM/DD 形式
  if (strVal.includes('/')) {
    const parts = strVal.split('/');
    if (parts.length >= 3) {
      date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else if (parts.length === 2) {
      date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
    }
  }
  // YYYY-MM-DD 形式
  else if (strVal.includes('-')) {
    const parts = strVal.split('-');
    if (parts.length >= 3) {
      date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else if (parts.length === 2) {
      date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
    }
  }
  // 数値のみの場合（Excelシリアル値 or YYYYMMDD形式）
  else if (/^\d+$/.test(strVal)) {
    const num = parseInt(strVal);
    if (strVal.length === 8) {
      const year = Math.floor(num / 10000);
      const month = Math.floor((num % 10000) / 100);
      const day = num % 100;
      date = new Date(year, month - 1, day);
    } else if (num > 25569 && num < 2958466) {
      const excelEpoch = new Date(1899, 11, 30);
      date = new Date(excelEpoch.getTime() + num * 24 * 60 * 60 * 1000);
    }
  }

  if (!date || isNaN(date.getTime())) return null;
  return date;
};

/**
 * 日付値を指定した粒度で変換
 * @param {string|Date} dateValue - 日付値
 * @param {string} granularity - 粒度 ('none' | 'month' | 'year' | 'weekday')
 * @returns {string|null} - 変換後の文字列
 */
export const transformDateByGranularity = (dateValue, granularity = 'month') => {
  if (!dateValue) return null;

  const strVal = String(dateValue).trim();

  // 既に変換済みかチェック
  if (granularity === 'month' && strVal.match(/^\d{4}年\d{1,2}月$/)) {
    return strVal;
  }
  if (granularity === 'year' && strVal.match(/^\d{4}年$/)) {
    return strVal;
  }

  const date = parseDateValue(dateValue);
  if (!date) return strVal; // 日付解析失敗時はそのまま返す

  const weekdays = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];

  switch (granularity) {
    case 'none':
      return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    case 'month':
      return `${date.getFullYear()}年${date.getMonth() + 1}月`;
    case 'year':
      return `${date.getFullYear()}年`;
    case 'weekday':
      return weekdays[date.getDay()];
    default:
      return `${date.getFullYear()}年${date.getMonth() + 1}月`;
  }
};

/**
 * 日付値を「YYYY年MM月」形式に変換（後方互換性のため維持）
 * @param {string|Date} dateValue - 日付値
 * @returns {string|null} - 変換後の月文字列
 */
export const transformToMonth = (dateValue) => {
  return transformDateByGranularity(dateValue, 'month');
};

/**
 * 日付文字列からソートキーを生成
 * @param {string} dateStr - 日付文字列（様々な形式に対応）
 * @returns {number} - ソートキー（数値）
 */
export const getMonthSortKey = (dateStr) => {
  if (!dateStr) return 0;

  // 「YYYY年MM月」形式
  const monthMatch = dateStr.match(/(\d+)年(\d+)月/);
  if (monthMatch) {
    return parseInt(monthMatch[1]) * 100 + parseInt(monthMatch[2]);
  }

  // 「YYYY年」形式
  const yearMatch = dateStr.match(/^(\d{4})年$/);
  if (yearMatch) {
    return parseInt(yearMatch[1]) * 10000;
  }

  // 「YYYY/MM/DD」形式
  const dateMatch = dateStr.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (dateMatch) {
    return parseInt(dateMatch[1]) * 10000 + parseInt(dateMatch[2]) * 100 + parseInt(dateMatch[3]);
  }

  // 曜日の場合（月曜日〜日曜日）
  const weekdays = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'];
  const weekdayIndex = weekdays.indexOf(dateStr);
  if (weekdayIndex >= 0) {
    return weekdayIndex + 1;
  }

  return 0;
};

/**
 * 数値をフォーマット
 * @param {number} value - 数値
 * @param {string} format - フォーマット種別 ('percent' | 'number' | 'integer')
 * @param {number} decimals - 小数点以下の桁数
 * @returns {string} - フォーマット済み文字列
 */
export const formatMetricValue = (value, format = 'number', decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return '-';

  switch (format) {
    case 'percent':
      return `${value.toFixed(decimals)}%`;
    case 'integer':
      return Math.round(value).toLocaleString('ja-JP');
    case 'number':
    default:
      if (Number.isInteger(value)) {
        return value.toLocaleString('ja-JP');
      }
      return value.toLocaleString('ja-JP', {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals
      });
  }
};

/**
 * 条件を評価する
 * @param {*} value - 評価対象の値
 * @param {string} operator - 条件演算子
 * @param {string} condValue - 条件値
 * @param {string} condValue2 - 条件値2（betweenの場合）
 * @returns {boolean} - 条件を満たすかどうか
 */
export const evaluateCondition = (value, operator, condValue, condValue2) => {
  const strVal = String(value ?? '');
  const isEmpty = value === null || value === undefined || value === '';

  switch (operator) {
    case 'empty':
      return isEmpty;
    case 'notEmpty':
      return !isEmpty;
    case 'equals':
      return strVal === String(condValue ?? '');
    case 'notEquals':
      return strVal !== String(condValue ?? '');
    case 'contains':
      return strVal.includes(String(condValue || ''));
    case 'notContains':
      return !strVal.includes(String(condValue || ''));
    case 'greaterThan': {
      const num = parseFloat(strVal);
      const condNum = parseFloat(condValue);
      return !isNaN(num) && !isNaN(condNum) && num > condNum;
    }
    case 'lessThan': {
      const num = parseFloat(strVal);
      const condNum = parseFloat(condValue);
      return !isNaN(num) && !isNaN(condNum) && num < condNum;
    }
    case 'greaterOrEqual': {
      const num = parseFloat(strVal);
      const condNum = parseFloat(condValue);
      return !isNaN(num) && !isNaN(condNum) && num >= condNum;
    }
    case 'lessOrEqual': {
      const num = parseFloat(strVal);
      const condNum = parseFloat(condValue);
      return !isNaN(num) && !isNaN(condNum) && num <= condNum;
    }
    case 'between': {
      const num = parseFloat(strVal);
      const min = parseFloat(condValue);
      const max = parseFloat(condValue2);
      return !isNaN(num) && !isNaN(min) && !isNaN(max) && num >= min && num <= max;
    }
    default:
      return true;
  }
};

/**
 * 条件グループでデータをフィルタリング
 * @param {Array} rows - フィルタリング対象の行配列
 * @param {Array} conditions - 条件配列 [{ field, operator, value, value2 }]
 * @param {Function} getFieldValue - フィールド値取得関数
 * @param {string} logic - 条件結合方法 ('AND' | 'OR')
 * @returns {Array} - フィルタリング済み行配列
 */
export const filterRowsByConditions = (rows, conditions, getFieldValue, logic = 'AND') => {
  if (!conditions || conditions.length === 0) return rows;

  return rows.filter(row => {
    const results = conditions.map(cond => {
      const val = getFieldValue(row, cond.field);
      return evaluateCondition(val, cond.operator, cond.value, cond.value2);
    });
    return logic === 'AND' ? results.every(r => r) : results.some(r => r);
  });
};

/**
 * 指標の集計を行う
 * @param {Array} rows - 集計対象の行配列
 * @param {Array} metrics - 指標設定配列
 * @param {number} columnIndex - 値を取得するカラムインデックス
 * @returns {Object} - 集計結果 { metricId: value }
 */
export const aggregateMetrics = (rows, metrics, getFieldValue) => {
  const result = {};

  // 通常指標を先に集計
  metrics.forEach(metric => {
    if (metric.type === 'calculated') {
      result[metric.id] = null; // 後で計算
    } else {
      switch (metric.aggregation) {
        case 'sum': {
          const values = rows.map(row => {
            const val = getFieldValue(row, metric.field);
            return parseFloat(val) || 0;
          });
          result[metric.id] = values.reduce((sum, v) => sum + v, 0);
          break;
        }
        case 'count': {
          // フィールドが指定されている場合は、そのフィールドに値がある行をカウント
          if (metric.field) {
            const count = rows.filter(row => {
              const val = getFieldValue(row, metric.field);
              return val !== null && val !== undefined && val !== '';
            }).length;
            result[metric.id] = count;
          } else {
            // フィールド未指定の場合は全行数
            result[metric.id] = rows.length;
          }
          break;
        }
        case 'conditionalCount': {
          // 条件付きカウント: 指定フィールドが指定値と一致する行をカウント
          const filtered = rows.filter(row => {
            const val = getFieldValue(row, metric.conditionField);
            return String(val) === String(metric.conditionValue);
          });
          result[metric.id] = filtered.length;
          break;
        }
        case 'avg': {
          const values = rows.map(row => {
            const val = getFieldValue(row, metric.field);
            return parseFloat(val) || 0;
          });
          result[metric.id] = values.length > 0
            ? values.reduce((sum, v) => sum + v, 0) / values.length
            : 0;
          break;
        }
        default: {
          const values = rows.map(row => {
            const val = getFieldValue(row, metric.field);
            return parseFloat(val) || 0;
          });
          result[metric.id] = values.reduce((sum, v) => sum + v, 0);
        }
      }
    }
  });

  // 計算指標を計算
  metrics.forEach(metric => {
    if (metric.type === 'calculated') {
      const numerator = result[metric.numerator] || 0;
      const denominator = result[metric.denominator] || 0;

      if (denominator === 0) {
        result[metric.id] = 0;
      } else {
        result[metric.id] = (numerator / denominator) * 100;
      }
    }
  });

  return result;
};

/**
 * 合計行を計算
 * @param {Array} rows - 全データ行
 * @param {Array} vendors - 販社リスト
 * @param {Array} metrics - 指標設定
 * @param {Function} getFieldValue - フィールド値取得関数
 * @param {string} columnField - 販社フィールド名
 * @returns {Object} - 合計行データ { vendors: { vendorName: { metricId: value } } }
 */
export const calculateTotalRow = (rows, vendors, metrics, getFieldValue, columnField) => {
  const totals = { vendors: {} };

  vendors.forEach(vendor => {
    const vendorRows = rows.filter(row => getFieldValue(row, columnField) === vendor);
    totals.vendors[vendor] = aggregateMetrics(vendorRows, metrics, getFieldValue);
  });

  return totals;
};
