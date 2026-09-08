// src/apps/performance-board/utils/dateTransform.js
// 日付変換・集計用ユーティリティ関数

/**
 * 日付オブジェクトを input type="date" 形式 (YYYY-MM-DD) に変換
 * @param {Date} d - 日付オブジェクト
 * @returns {string} フォーマットされた日付文字列
 */
export const formatDateForInput = (d) => {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

/**
 * 曜日名の定数配列
 */
export const WEEKDAY_NAMES = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];

/**
 * 日付値を集計用に変換（月年、年、曜日など）
 * @param {string|Date} dateValue - 日付値
 * @param {string} transformType - 変換タイプ ('none' | 'month' | 'year' | 'weekday')
 * @returns {string} 変換された日付文字列
 */
export const transformDateValue = (dateValue, transformType) => {
  if (!dateValue || transformType === 'none') return dateValue;

  // 日付文字列をパース（yyyy/mm/dd, yyyy-mm-dd形式対応）
  let date;
  let strVal = String(dateValue).trim();

  // タイムスタンプ部分を除去（ISO形式対応: 2023-06-01T15:00:00.000Z, 2023/06/01T15:00:00/000Z）
  if (strVal.includes('T')) {
    strVal = strVal.split('T')[0];
  }

  if (strVal.includes('/')) {
    const parts = strVal.split('/');
    if (parts.length >= 3) {
      date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
  } else if (strVal.includes('-')) {
    const parts = strVal.split('-');
    if (parts.length >= 3) {
      date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
  }

  if (!date || isNaN(date.getTime())) return dateValue;

  switch (transformType) {
    case 'month':
      return `${date.getFullYear()}年${date.getMonth() + 1}月`;
    case 'year':
      return `${date.getFullYear()}年`;
    case 'weekday':
      return WEEKDAY_NAMES[date.getDay()];
    default:
      return dateValue;
  }
};
