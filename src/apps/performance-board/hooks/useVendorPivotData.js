// src/apps/performance-board/hooks/useVendorPivotData.js
// 販社ピボットテーブル用データ集計フック

import { useMemo } from 'react';
import {
  transformDateByGranularity,
  getMonthSortKey,
  aggregateMetrics,
  filterRowsByConditions
} from '../utils/vendorPivotUtils';

/**
 * 販社ピボットデータを集計するフック
 * @param {Object} options - オプション
 * @param {Array} options.sourceData - ソースの生データ配列
 * @param {Array} options.headers - ヘッダー配列
 * @param {string} options.rowField - 行軸フィールド（ET月）
 * @param {string} options.columnField - 列軸フィールド（販社名）
 * @param {Array} options.metrics - 指標設定配列
 * @param {string} options.sortOrder - ソート順序 ('asc' | 'desc')
 * @param {boolean} options.showTotalRow - 合計行を表示するか
 * @param {Object} options.activeFilters - アクティブなフィルター値
 * @param {Object} options.filterMappings - フィルターフィールドからカラムインデックスへのマッピング
 * @returns {Object} - { pivotData, vendors, totalRow, isProcessing }
 */
export const useVendorPivotData = ({
  sourceData = [],
  headers = [],
  rowField = '',
  columnField = '',
  metrics = [],
  sortOrder = 'desc',
  showTotalRow = true,
  activeFilters = {},
  filterMappings = {},
  rowGranularity = 'month',
  conditionGroups = [],
  conditionLogic = 'AND',
  tableFilters = [],
  tableFilterValues = {},
}) => {
  // ヘッダーからフィールドインデックスを取得
  const fieldIndexMap = useMemo(() => {
    const map = {};
    headers.forEach((header, index) => {
      map[header] = index;
    });
    return map;
  }, [headers]);

  // フィールド値取得関数
  const getFieldValue = useMemo(() => {
    return (row, fieldName) => {
      const index = fieldIndexMap[fieldName];
      if (index === undefined) return null;
      return row[index];
    };
  }, [fieldIndexMap]);

  // 日付文字列を正規化（比較用）
  const normalizeDate = (dateVal) => {
    if (!dateVal) return null;
    const str = String(dateVal).trim();

    // ISO形式
    if (str.includes('T')) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    }

    // YYYY/MM/DD または YYYY-MM-DD
    const match = str.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (match) {
      return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
    }

    return null;
  };

  // テーブル専用フィルターのマッピングを作成（field名 → headerIndex）
  const tableFilterFieldIndexMap = useMemo(() => {
    const map = {};
    tableFilters.forEach(filter => {
      if (filter.field) {
        const idx = headers.indexOf(filter.field);
        if (idx !== -1) {
          map[filter.id] = idx;
        }
      }
    });
    return map;
  }, [tableFilters, headers]);

  // フィルター適用済みデータ
  const filteredSourceData = useMemo(() => {
    if (!sourceData.length) return [];

    // filterMappingsが空でactiveFiltersにも有効なフィルターがなければそのまま返す
    const mappingEntries = Object.entries(filterMappings);
    const excludeFilters = activeFilters._exclude || {};
    const hasExcludeFilters = Object.keys(excludeFilters).length > 0;
    const hasTableFilters = Object.keys(tableFilterValues).some(
      filterId => tableFilterValues[filterId]?.length > 0
    );

    if (mappingEntries.length === 0 && !hasExcludeFilters && !hasTableFilters) return sourceData;

    return sourceData.filter(row => {
      // 除外フィルターのチェック（_exclude）
      for (const [excludeField, filterConfig] of Object.entries(excludeFilters)) {
        // 日付フィルターは除外フィルターで処理しない
        if (excludeField === 'date') continue;

        // filterMappingsからカラムインデックスを取得
        const colIdxStr = filterMappings[excludeField];
        if (colIdxStr === undefined) continue;

        const colIndex = parseInt(colIdxStr);
        if (isNaN(colIndex)) continue;

        // filterConfigの形式: 配列 または { values: [], mode: 'exclude' | 'include' }
        const values = Array.isArray(filterConfig) ? filterConfig : (filterConfig?.values || []);
        const mode = Array.isArray(filterConfig) ? 'exclude' : (filterConfig?.mode || 'exclude');

        if (values.length === 0) continue;

        const cellValue = row[colIndex];
        const cellStr = String(cellValue ?? '');

        if (mode === 'exclude') {
          // 除外モード: 値が含まれていたら除外
          if (values.includes(cellStr)) {
            return false;
          }
        } else if (mode === 'include') {
          // 包含モード: 値が含まれていなければ除外
          if (!values.includes(cellStr)) {
            return false;
          }
        }
      }

      // 各フィルターマッピングをチェック
      for (const [filterField, colIndexStr] of mappingEntries) {
        const filterValue = activeFilters[filterField];

        // フィルター値が設定されていない場合はスキップ
        if (!filterValue) continue;

        const colIndex = parseInt(colIndexStr);
        if (isNaN(colIndex)) continue;

        // 日付フィルターの判定（構造で判定：start/endを持つオブジェクト）
        const isDateRangeFilter = (
          typeof filterValue === 'object' &&
          filterValue !== null &&
          !Array.isArray(filterValue) &&
          ('start' in filterValue || 'end' in filterValue || 'startDate' in filterValue || 'endDate' in filterValue)
        );

        if (isDateRangeFilter) {
          const startDateRaw = filterValue.start || filterValue.startDate || '';
          const endDateRaw = filterValue.end || filterValue.endDate || '';

          // 日付範囲が設定されていない場合はスキップ
          if (!startDateRaw && !endDateRaw) continue;

          const cellDate = normalizeDate(row[colIndex]);

          // 日付が解析できない場合は除外（フィルター期間外として扱う）
          if (!cellDate) return false;

          // 日付形式を統一（YYYY/MM/DD → YYYY-MM-DD）
          const startDate = startDateRaw ? startDateRaw.replace(/\//g, '-') : '';
          const endDate = endDateRaw ? endDateRaw.replace(/\//g, '-') : '';

          if (startDate && cellDate < startDate) {
            return false;
          }
          if (endDate && cellDate > endDate) {
            return false;
          }
          continue;
        }

        const cellValue = row[colIndex];
        const isBlank = cellValue === undefined || cellValue === null || cellValue === '';

        // 配列の場合（複数選択）
        if (Array.isArray(filterValue) && filterValue.length > 0) {
          const filterSet = new Set(filterValue);
          const hasBlank = filterSet.has('(空白)');

          // 空白チェックまたは値チェック
          if (!((hasBlank && isBlank) || filterSet.has(String(cellValue)))) {
            return false;
          }
        } else if (typeof filterValue === 'string' && filterValue !== '') {
          // 単一値の場合
          const isBlankFilter = filterValue === '(空白)';
          if (!((isBlankFilter && isBlank) || String(cellValue) === String(filterValue))) {
            return false;
          }
        }
      }

      // テーブル専用フィルターのチェック
      for (const [filterId, selectedValues] of Object.entries(tableFilterValues)) {
        if (!selectedValues || selectedValues.length === 0) continue;

        const colIndex = tableFilterFieldIndexMap[filterId];
        if (colIndex === undefined) continue;

        // フィルター設定からタイプを取得
        const filterConfig = tableFilters.find(f => f.id === filterId);
        const filterType = filterConfig?.type;

        const cellValue = row[colIndex];

        if (filterType === 'dateMonth') {
          // 日付月別フィルター: セル値を月形式に変換してマッチング
          const cellMonth = transformDateByGranularity(cellValue, 'month');
          if (!cellMonth || !selectedValues.includes(cellMonth)) {
            return false;
          }
        } else {
          // 通常フィルター: 文字列完全一致
          const cellStr = String(cellValue ?? '');
          if (!selectedValues.includes(cellStr)) {
            return false;
          }
        }
      }

      return true;
    });
  }, [sourceData, activeFilters, filterMappings, tableFilterValues, tableFilterFieldIndexMap, tableFilters]);

  // 列軸の有無を判定
  const hasColumnField = !!columnField;

  // 行×列でグループ化したデータ
  const groupedData = useMemo(() => {
    if (!filteredSourceData.length || !rowField) {
      return new Map();
    }

    const groups = new Map(); // Map<rowKey, Map<colKey, rows[]>>

    filteredSourceData.forEach(row => {
      const rowValue = getFieldValue(row, rowField);

      // 行値が空の場合はスキップ
      if (rowValue === null || rowValue === undefined || rowValue === '') return;

      // 列軸なしの場合は「_all」をキーとして使用
      let colKey;
      if (hasColumnField) {
        const colValue = getFieldValue(row, columnField);
        // 列値が空の場合はスキップ
        if (colValue === null || colValue === undefined || colValue === '') return;
        colKey = String(colValue);
      } else {
        colKey = '_all';
      }

      // 日付形式の場合は指定した粒度で変換、それ以外はそのまま使用
      const transformedValue = transformDateByGranularity(rowValue, rowGranularity);
      const rowKey = transformedValue || String(rowValue);

      if (!groups.has(rowKey)) {
        groups.set(rowKey, new Map());
      }
      if (!groups.get(rowKey).has(colKey)) {
        groups.get(rowKey).set(colKey, []);
      }
      groups.get(rowKey).get(colKey).push(row);
    });

    return groups;
  }, [filteredSourceData, rowField, columnField, hasColumnField, getFieldValue, rowGranularity]);

  // 列ヘッダーリストを取得（旧vendors）
  const vendors = useMemo(() => {
    const colSet = new Set();

    groupedData.forEach((colMap) => {
      colMap.forEach((_, colKey) => {
        colSet.add(colKey);
      });
    });

    // 列ヘッダーをソート
    return Array.from(colSet).sort((a, b) => {
      // 「*」は先頭に
      if (a === '*') return -1;
      if (b === '*') return 1;
      return String(a).localeCompare(String(b), 'ja');
    });
  }, [groupedData]);

  // 有効な条件グループを取得（デフォルト: 単一グループ）
  const effectiveConditionGroups = useMemo(() => {
    if (conditionGroups && conditionGroups.length > 0) {
      return conditionGroups;
    }
    // 条件グループが未設定の場合はデフォルトグループ（フィルターなし）
    return [{ id: '_default', label: '', conditions: [] }];
  }, [conditionGroups]);

  // 集計データを計算（3階層対応: vendor → conditionGroup → metrics）
  const pivotData = useMemo(() => {
    if (!groupedData.size || !metrics.length) {
      return [];
    }

    const rows = [];
    const hasConditionGroups = effectiveConditionGroups.length > 1 || effectiveConditionGroups[0].id !== '_default';

    groupedData.forEach((colMap, rowKey) => {
      // 月形式かどうかを判定してソートキーを生成
      const monthSortKey = getMonthSortKey(rowKey);
      const isMonthFormat = monthSortKey > 0;

      const rowData = {
        month: rowKey,  // 互換性のため'month'キーを維持
        sortKey: isMonthFormat ? monthSortKey : 0,
        sortLabel: rowKey,  // 文字列ソート用
        vendors: {}
      };

      // 全列に対してデータを設定
      vendors.forEach(colKey => {
        const cellRows = colMap.get(colKey) || [];

        if (hasConditionGroups) {
          // 3階層構造: vendor → conditionGroup → metrics
          rowData.vendors[colKey] = {};
          effectiveConditionGroups.forEach(group => {
            const filteredRows = filterRowsByConditions(cellRows, group.conditions, getFieldValue, conditionLogic);
            if (filteredRows.length > 0) {
              rowData.vendors[colKey][group.id] = aggregateMetrics(filteredRows, metrics, getFieldValue);
            } else {
              // データがない場合は0で埋める
              const emptyData = {};
              metrics.forEach(metric => {
                emptyData[metric.id] = 0;
              });
              rowData.vendors[colKey][group.id] = emptyData;
            }
          });
        } else {
          // 後方互換性: 2階層構造（条件グループなし）
          if (cellRows.length > 0) {
            rowData.vendors[colKey] = aggregateMetrics(cellRows, metrics, getFieldValue);
          } else {
            const emptyData = {};
            metrics.forEach(metric => {
              emptyData[metric.id] = 0;
            });
            rowData.vendors[colKey] = emptyData;
          }
        }
      });

      rows.push(rowData);
    });

    // ソート（月形式なら数値ソート、それ以外は文字列ソート）
    rows.sort((a, b) => {
      if (a.sortKey > 0 && b.sortKey > 0) {
        // 両方とも月形式の場合は数値でソート
        return sortOrder === 'desc' ? b.sortKey - a.sortKey : a.sortKey - b.sortKey;
      }
      // それ以外は文字列でソート
      const cmp = String(a.sortLabel).localeCompare(String(b.sortLabel), 'ja');
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    return rows;
  }, [groupedData, metrics, vendors, sortOrder, getFieldValue, effectiveConditionGroups, conditionLogic]);

  // 合計行の計算（3階層対応）
  const totalRow = useMemo(() => {
    if (!showTotalRow || !filteredSourceData.length || !metrics.length) {
      return null;
    }

    const hasConditionGroups = effectiveConditionGroups.length > 1 || effectiveConditionGroups[0].id !== '_default';
    const totals = { vendors: {} };

    vendors.forEach(vendor => {
      // 列軸なしの場合は全データを使用
      const vendorRows = hasColumnField
        ? filteredSourceData.filter(row => getFieldValue(row, columnField) === vendor)
        : filteredSourceData;

      if (hasConditionGroups) {
        // 3階層構造
        totals.vendors[vendor] = {};
        effectiveConditionGroups.forEach(group => {
          const filteredRows = filterRowsByConditions(vendorRows, group.conditions, getFieldValue, conditionLogic);
          totals.vendors[vendor][group.id] = aggregateMetrics(filteredRows, metrics, getFieldValue);
        });
      } else {
        // 後方互換性: 2階層構造
        totals.vendors[vendor] = aggregateMetrics(vendorRows, metrics, getFieldValue);
      }
    });

    return totals;
  }, [showTotalRow, filteredSourceData, vendors, metrics, getFieldValue, columnField, hasColumnField, effectiveConditionGroups, conditionLogic]);

  return {
    pivotData,
    vendors,
    totalRow,
    isProcessing: false,
  };
};

export default useVendorPivotData;
