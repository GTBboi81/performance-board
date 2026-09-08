// src/apps/performance-board/utils/dateFilters.js
// 日付フィルター関連のユーティリティ関数

import { normalizeDate } from '../../../utils/dateUtils';

/**
 * 日付をローカルフォーマット（YYYY/MM/DD）に変換
 */
const formatDateLocal = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${dd}`;
};

/**
 * デフォルト日付フィルターを設定に基づいて取得
 * @param {string} dateRange - 'today' | 'yesterdayToToday' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'last3Months' | 'thisYear' | 'all'
 * @returns {object} 日付フィルターオブジェクト
 */
export const getDefaultDateFilter = (dateRange = 'lastMonth') => {
  const today = new Date();
  let start, end;

  switch (dateRange) {
    case 'today':
      start = today;
      end = today;
      break;
    case 'yesterdayToToday': {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      start = yesterday;
      end = today;
      break;
    }
    case 'thisWeek': {
      const dayOfWeek = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      start = monday;
      end = today;
      break;
    }
    case 'thisMonth':
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0); // 月末日
      break;
    case 'thisMonthToToday':
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = today;
      break;
    case 'thisMonth1stToYesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      // 1日の場合は先月1日〜先月末
      if (today.getDate() === 1) {
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = yesterday;
      } else {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = yesterday;
      }
      break;
    }
    case 'lastMonth':
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = today;
      break;
    case 'last3Months':
      start = new Date(today.getFullYear(), today.getMonth() - 3, 1);
      end = today;
      break;
    case 'thisYear':
      start = new Date(today.getFullYear(), 0, 1);
      end = today;
      break;
    case 'all':
      return {}; // フィルターなし
    default:
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = today;
  }

  return {
    date: {
      start: formatDateLocal(start),
      end: formatDateLocal(end)
    }
  };
};

/**
 * デフォルトフィルター全体を取得（日付＋除外フィルター）
 * @param {object} defaultFilters - デフォルトフィルター設定
 * @returns {object} フィルターオブジェクト
 */
export const getDefaultFilters = (defaultFilters = {}) => {
  const dateRange = defaultFilters.dateRange || 'lastMonth';
  const dateFilter = getDefaultDateFilter(dateRange);

  // 除外フィルター（指定された値を除外）
  const excludeFilters = defaultFilters.excludeFilters || {};

  return {
    ...dateFilter,
    _exclude: excludeFilters
  };
};

/**
 * 日付が指定範囲内かチェック
 * @param {string} targetDateStr - チェック対象の日付文字列
 * @param {string} startStr - 開始日付文字列
 * @param {string} endStr - 終了日付文字列
 * @returns {boolean} 範囲内ならtrue
 */
export const isDateInRange = (targetDateStr, startStr, endStr) => {
  if (!targetDateStr) return false;
  const target = normalizeDate(targetDateStr);
  const start = normalizeDate(startStr);
  const end = normalizeDate(endStr);
  if (!target) return false;
  return target >= start && target <= end;
};

/**
 * 日付をフォーマット（YYYY/MM/DD）
 * @param {Date} d - 日付オブジェクト
 * @returns {string} フォーマットされた日付文字列
 */
export const formatDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${dd}`;
};

/**
 * SOQL用: soqlDateFilter設定からWHERE句を生成
 * @param {object} filter - { enabled, fieldName, preset, year, month, customStart, customEnd }
 * @returns {string} SOQL WHERE句の断片（例: "Field163__c >= 2026-02-01 AND Field163__c < 2026-03-01"）。無効時は空文字
 */
/**
 * 複数の日付フィルター条件からWHERE句を生成
 * @param {object|object[]} filterOrFilters - 単一フィルタ or 配列
 * @returns {string} WHERE句の断片（AND/OR結合済み）
 */
export const buildSoqlDateFiltersClause = (filterOrFilters) => {
  if (!filterOrFilters) return '';
  // 単一フィルタ（後方互換）
  if (!Array.isArray(filterOrFilters)) {
    return buildSoqlDateFilterClause(filterOrFilters);
  }
  // 配列: 各フィルタのclauseを生成して結合
  // 各clauseは「Field >= X AND Field < Y」の形（AND含み）なので、
  // OR結合時は各clauseを括弧で囲む（SOQLはAND/OR混在時に括弧必須）
  const clauses = filterOrFilters
    .map(f => buildSoqlDateFilterClause(f))
    .filter(Boolean);
  if (clauses.length === 0) return '';
  if (clauses.length === 1) return clauses[0];
  const joinMode = filterOrFilters[0]?.joinMode || 'OR';
  const wrapped = clauses.map(c => c.includes(' AND ') || c.includes(' OR ') ? `(${c})` : c);
  if (joinMode === 'AND') return wrapped.join(' AND ');
  return `(${wrapped.join(' OR ')})`;
};

export const buildSoqlDateFilterClause = (filter) => {
  if (!filter?.enabled || !filter.fieldName || !filter.preset || filter.preset === 'none') return '';

  const f = filter.fieldName;
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-indexed

  const fmt = (date) => {
    const yy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  let start, end;

  switch (filter.preset) {
    case 'thisMonth':
      start = new Date(y, m, 1);
      end = new Date(y, m + 1, 1);
      break;
    case 'lastMonth':
      start = new Date(y, m - 1, 1);
      end = new Date(y, m, 1);
      break;
    case 'lastAndThisMonth':
      start = new Date(y, m - 1, 1);
      end = new Date(y, m + 1, 1);
      break;
    case 'thisQuarter': {
      const qStart = Math.floor(m / 3) * 3;
      start = new Date(y, qStart, 1);
      end = new Date(y, qStart + 3, 1);
      break;
    }
    case 'last3Months':
      start = new Date(y, m - 3, 1);
      end = new Date(y, m, 1);
      break;
    case 'thisYear':
      start = new Date(y, 0, 1);
      end = new Date(y + 1, 0, 1);
      break;
    case 'yearMonth': {
      const fy = filter.year || y;
      const fm = (filter.month || 1) - 1;
      start = new Date(fy, fm, 1);
      end = new Date(fy, fm + 1, 1);
      break;
    }
    case 'custom':
      if (filter.customStart && filter.customEnd) {
        return `${f} >= ${filter.customStart} AND ${f} <= ${filter.customEnd}`;
      }
      return '';
    default:
      return '';
  }

  return `${f} >= ${fmt(start)} AND ${f} < ${fmt(end)}`;
};
