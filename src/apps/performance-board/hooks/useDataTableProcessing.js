// src/apps/performance-board/hooks/useDataTableProcessing.js
// DataTable用データ処理フック

import { useMemo } from 'react';
import { normalizeDate } from '../utils/dataTableUtils';
import { computeProcessedData, buildHierarchicalRows } from '../utils/processDataTablePure';

/**
 * DataTable用のデータ処理フック
 * @param {object} options
 * @param {array} options.allRows - 元データ
 * @param {object} options.tableConfig - テーブル設定
 * @param {array} options.systemFields - システムフィールド
 * @param {array} options.calculations - 計算設定
 * @param {object} options.currentAggConfig - 現在の集計設定
 * @param {array} options.groupByFields - グループ化フィールド
 * @param {object} options.dateTransforms - 日付変換設定
 * @param {boolean} options.isSourceExpandMode - ソース展開モード
 * @param {object} options.sourceExpand - ソース展開設定
 * @param {object} options.sourceCache - ソースキャッシュ
 * @param {array} options.dataSources - データソース設定
 * @param {object} options.activeFilters - アクティブフィルター
 * @param {object} options.mapping - マッピング設定
 * @returns {object} 処理済みデータと関連情報
 */
export const useDataTableProcessing = ({
  allRows = [],
  tableConfig,
  systemFields = [],
  calculations = [],
  currentAggConfig,
  groupByFields = [],
  dateTransforms = {},
  isSourceExpandMode = false,
  sourceExpand,
  sourceCache = {},
  dataSources = [],
  activeFilters = {},
  mapping = {},
  filters = [],
}) => {
  // パフォーマンス最適化: フィールドのフィルタ結果をキャッシュ
  const numericFields = useMemo(
    () => systemFields.filter(f => f.type === 'number'),
    [systemFields]
  );

  const stringFields = useMemo(
    () => systemFields.filter(f => f.type === 'string'),
    [systemFields]
  );

  const constantCalcs = useMemo(
    () => calculations.filter(c => c.type === 'constant'),
    [calculations]
  );

  const nonArithmeticCalcs = useMemo(
    () => calculations.filter(c => c.type !== 'arithmetic' && c.type !== 'constant'),
    [calculations]
  );

  const arithmeticCalcs = useMemo(
    () => {
      const arithmetics = calculations.filter(c => c.type === 'arithmetic');

      // トポロジカルソートで計算順序を決定
      const visited = new Set();
      const sorted = [];
      const calcMap = new Map(arithmetics.map(c => [c.id, c]));

      const visit = (calcId) => {
        if (!calcMap.has(calcId)) return;
        if (visited.has(calcId)) return;
        visited.add(calcId);

        const calc = calcMap.get(calcId);
        if (calc.terms && calc.terms.length > 0) {
          calc.terms.forEach(term => visit(term.field));
        } else {
          if (calc.fieldA) visit(calc.fieldA);
          if (calc.fieldB) visit(calc.fieldB);
        }
        sorted.push(calc);
      };

      arithmetics.forEach(c => {
        if (!visited.has(c.id)) visit(c.id);
      });

      return sorted;
    },
    [calculations]
  );

  // 算術計算で必要となる追加の集計フィールド
  const extraAggregationFields = useMemo(() => {
    const required = new Set();
    arithmeticCalcs.forEach(calc => {
      if (calc.terms && calc.terms.length > 0) {
        calc.terms.forEach(term => required.add(term.field));
      } else {
        if (calc.fieldA) required.add(calc.fieldA);
        if (calc.fieldB) required.add(calc.fieldB);
      }
    });
    const coveredFields = new Set([
      ...numericFields.map(f => f.id),
      ...nonArithmeticCalcs.map(c => c.id),
      ...constantCalcs.map(c => c.id)
    ]);

    return Array.from(required).filter(id => !coveredFields.has(id));
  }, [arithmeticCalcs, numericFields, nonArithmeticCalcs, constantCalcs]);

  // extraAggregationFields の集計方法マップ
  const extraAggMethodMap = useMemo(() => {
    const fieldMap = new Map(systemFields.map(f => [f.id, f]));
    const map = {};
    extraAggregationFields.forEach(id => {
      map[id] = fieldMap.get(id)?.aggregationMethod || 'sum';
    });
    return map;
  }, [extraAggregationFields, systemFields]);

  // ソース参照展開: 元ソースを「日付×ID×分割カラム」でグループ化して集計
  const expandedRows = useMemo(() => {
    if (!isSourceExpandMode) return null;

    const sourceId = sourceExpand.sourceId;
    const sourceRows = sourceCache[sourceId] || [];
    const sourceConfig = dataSources.find(s => s.id === sourceId);

    if (!sourceRows.length || !sourceConfig) return null;

    const dateColIdx = sourceConfig.dateColumnIndex;
    const keyColIdx = sourceConfig.keyColumnIndex;
    const expandColIdx = parseInt(sourceExpand.expandColumnIndex);
    const valueColIdx = sourceExpand.valueColumnIndex !== undefined && sourceExpand.valueColumnIndex !== ''
      ? parseInt(sourceExpand.valueColumnIndex)
      : null;

    if (dateColIdx === null || dateColIdx === undefined || keyColIdx === null || keyColIdx === undefined || isNaN(expandColIdx)) {
      return null;
    }

    // allRowsを日付×IDでインデックス化
    const masterIndex = new Map();
    if (allRows && allRows.length > 0) {
      allRows.forEach(row => {
        const pairKey = `${row.date}|${row.id}`;
        if (!masterIndex.has(pairKey)) {
          masterIndex.set(pairKey, row);
        }
      });
    }

    // 元ソースを「日付×ID×分割カラム」でグループ化
    const expandedGroups = new Map();
    sourceRows.forEach(sourceRow => {
      const dateVal = normalizeDate(sourceRow[dateColIdx]);
      const keyVal = sourceRow[keyColIdx];
      const expandVal = sourceRow[expandColIdx] || '(空白)';
      if (!dateVal || !keyVal) return;

      const masterKey = `${dateVal}|${keyVal}`;
      if (!masterIndex.has(masterKey)) return;

      const groupKey = `${dateVal}|${keyVal}|${expandVal}`;
      if (!expandedGroups.has(groupKey)) {
        expandedGroups.set(groupKey, {
          date: dateVal,
          id: keyVal,
          expandValue: expandVal,
          sourceRows: []
        });
      }
      expandedGroups.get(groupKey).sourceRows.push(sourceRow);
    });

    // 展開ソースからマッピングされている数値フィールドを特定
    const fieldsFromExpandSource = [];
    systemFields.forEach(field => {
      if (field.type === 'number') {
        const fieldMapping = mapping[field.id];
        if (fieldMapping && fieldMapping.sourceId === sourceId) {
          fieldsFromExpandSource.push({
            fieldId: field.id,
            colIdx: fieldMapping.columnIndex
          });
        }
      }
    });

    const dateIdFirstGroup = new Set();
    const result = [];
    let rowIndex = 0;

    expandedGroups.forEach((group) => {
      const masterKey = `${group.date}|${group.id}`;
      const masterRow = masterIndex.get(masterKey);
      if (!masterRow) return;

      const isFirstGroupOfDateId = !dateIdFirstGroup.has(masterKey);
      if (isFirstGroupOfDateId) {
        dateIdFirstGroup.add(masterKey);
      }

      const newRow = {
        _rowIndex: rowIndex++,
        date: group.date,
        id: group.id,
        _expandValue: group.expandValue,
        _count: group.sourceRows.length,
      };

      systemFields.forEach(field => {
        if (field.type === 'string' && field.id !== 'date' && field.id !== 'id') {
          newRow[field.id] = masterRow[field.id] || '';
        }
      });

      systemFields.forEach(field => {
        if (field.type === 'number') {
          const expandSourceField = fieldsFromExpandSource.find(f => f.fieldId === field.id);
          if (expandSourceField) {
            const total = group.sourceRows.reduce((sum, sr) => {
              const v = parseFloat(String(sr[expandSourceField.colIdx]).replace(/,/g, '')) || 0;
              return sum + v;
            }, 0);
            newRow[field.id] = total;
          } else {
            if (isFirstGroupOfDateId) {
              newRow[field.id] = masterRow[field.id] || 0;
            } else {
              newRow[field.id] = 0;
            }
          }
        }
      });

      if (valueColIdx !== null && !isNaN(valueColIdx)) {
        const total = group.sourceRows.reduce((sum, sr) => {
          const v = parseFloat(String(sr[valueColIdx]).replace(/,/g, '')) || 0;
          return sum + v;
        }, 0);
        newRow._expandNumericValue = total;
      }

      result.push(newRow);
    });

    return result;
  }, [isSourceExpandMode, allRows, sourceExpand, sourceCache, dataSources, systemFields, mapping]);

  // メインのデータ処理 - 純粋関数に委譲
  const processedData = useMemo(() => {
    return computeProcessedData({
      allRows,
      groupByFields,
      dateTransforms,
      currentAggConfig,
      sourceCache,
      dataSources,
      activeFilters,
      numericFields,
      stringFields,
      constantCalcs,
      nonArithmeticCalcs,
      arithmeticCalcs,
      extraAggregationFields,
      extraAggMethodMap,
      isSourceExpandMode,
      expandedRows,
      sourceExpand,
    });
  }, [allRows, groupByFields, stringFields, numericFields, constantCalcs, nonArithmeticCalcs, arithmeticCalcs, isSourceExpandMode, expandedRows, dateTransforms, currentAggConfig, sourceCache, dataSources, activeFilters, extraAggregationFields, extraAggMethodMap, sourceExpand]);

  // 階層モード: processedDataをグループヘッダー＋小計行に変換
  const hierarchicalData = useMemo(() => {
    if (!currentAggConfig?.hierarchyEnabled || !currentAggConfig?.hierarchyFields?.length) {
      return processedData;
    }
    const hierarchyFields = currentAggConfig.hierarchyFields.filter(f => groupByFields.includes(f));
    if (hierarchyFields.length === 0) {
      return processedData;
    }
    // 先月モード用フィールドオーバーライド
    const quickDateMode = activeFilters._quickDateMode;
    const fieldOverrides = {};
    if (quickDateMode === 'lastMonth') {
      (filters || []).forEach(f => {
        if (f.lastMonthField) fieldOverrides[f.field] = f.lastMonthField;
      });
    }
    return buildHierarchicalRows(processedData, hierarchyFields, groupByFields, {
      numericFields,
      arithmeticCalcs,
      nonArithmeticCalcs,
      constantCalcs,
      stringFields,
      extraAggregationFields,
      extraAggMethodMap,
      fieldOverrides,
    });
  }, [processedData, currentAggConfig?.hierarchyEnabled, currentAggConfig?.hierarchyFields, groupByFields, numericFields, arithmeticCalcs, nonArithmeticCalcs, constantCalcs, stringFields, extraAggregationFields, extraAggMethodMap, activeFilters._quickDateMode, filters]);

  return {
    // Field categories
    numericFields,
    stringFields,
    constantCalcs,
    nonArithmeticCalcs,
    arithmeticCalcs,
    extraAggregationFields,

    // Processed data
    expandedRows,
    processedData: hierarchicalData,
  };
};

export default useDataTableProcessing;
