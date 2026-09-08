// src/apps/performance-board/utils/processDataTablePure.js
// DataTable処理の純粋関数版（useDataTableProcessingから抽出）
// SF連携の統合インポートなど、React Hook外からも呼び出し可能

import { transformDateValue } from './dateTransform';
import { applyArithmeticCalc, normalizeDate } from './dataTableUtils';

// === フィールド別集計ヘルパー ===
export function initFieldValue(method) {
  if (method === 'max') return -Infinity;
  return 0; // sum, first, avg
}
export function aggregateField(group, fieldId, newVal, method) {
  if (method === 'first') { if (group[fieldId] === 0 || group[fieldId] === undefined) group[fieldId] = newVal; return; }
  if (method === 'max') { group[fieldId] = Math.max(group[fieldId], newVal); return; }
  group[fieldId] += newVal; // sum, avg（avg は finalize で _count 割り）
}
export function finalizeGroup(group, numericFields, extraAggMethodMap) {
  numericFields.forEach(f => {
    const m = f.aggregationMethod;
    if (m === 'avg') group[f.id] = group._count ? group[f.id] / group._count : 0;
    if (m === 'max' && group[f.id] === -Infinity) group[f.id] = 0;
  });
  if (extraAggMethodMap) {
    Object.entries(extraAggMethodMap).forEach(([id, m]) => {
      if (m === 'avg') group[id] = group._count ? group[id] / group._count : 0;
      if (m === 'max' && group[id] === -Infinity) group[id] = 0;
    });
  }
}

/**
 * フィールド分類とarithmetic計算の依存順ソート
 */
export function computeFieldClassifications(systemFields = [], calculations = []) {
  const numericFields = systemFields.filter(f => f.type === 'number');
  const stringFields = systemFields.filter(f => f.type === 'string');
  const constantCalcs = calculations.filter(c => c.type === 'constant');
  const nonArithmeticCalcs = calculations.filter(c => c.type !== 'arithmetic' && c.type !== 'constant');
  // LOOKUP型を先に実行（後続のrelationでLOOKUP結果をキーとして使えるようにする）
  nonArithmeticCalcs.sort((a, b) => (a.aggType === 'lookup' ? -1 : 0) - (b.aggType === 'lookup' ? -1 : 0));

  // トポロジカルソートで計算順序を決定
  const arithmetics = calculations.filter(c => c.type === 'arithmetic');
  const visited = new Set();
  const sorted = [];
  const calcMap = new Map(arithmetics.map(c => [c.id, c]));

  const visit = (calcId) => {
    if (!calcMap.has(calcId) || visited.has(calcId)) return;
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
  arithmetics.forEach(c => { if (!visited.has(c.id)) visit(c.id); });
  const arithmeticCalcs = sorted;

  // 算術計算で必要となる追加の集計フィールド
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
    ...constantCalcs.map(c => c.id),
  ]);
  const extraAggregationFields = Array.from(required).filter(id => !coveredFields.has(id));

  // extraAggregationFields の集計方法マップ（systemFieldsから引く）
  const fieldMap = new Map(systemFields.map(f => [f.id, f]));
  const extraAggMethodMap = {};
  extraAggregationFields.forEach(id => {
    extraAggMethodMap[id] = fieldMap.get(id)?.aggregationMethod || 'sum';
  });

  return { numericFields, stringFields, constantCalcs, nonArithmeticCalcs, arithmeticCalcs, extraAggregationFields, extraAggMethodMap };
}

/**
 * メインのDataTable処理（useDataTableProcessing.jsのprocessedData useMemoと同等）
 * hook外から呼び出し可能な純粋関数版
 */
export function computeProcessedData({
  allRows = [],
  groupByFields = [],
  dateTransforms = {},
  currentAggConfig,
  sourceCache = {},
  dataSources = [],
  activeFilters = {},
  numericFields,
  stringFields,
  constantCalcs,
  nonArithmeticCalcs,
  arithmeticCalcs,
  extraAggregationFields,
  extraAggMethodMap = {},
  isSourceExpandMode = false,
  expandedRows = null,
  sourceExpand,
}) {
  // ピボットモード
  if (currentAggConfig?.pivotEnabled && currentAggConfig?.pivotSourceId) {
    const pivotSourceId = currentAggConfig.pivotSourceId;
    const pivotDateColIdx = parseInt(currentAggConfig.pivotDateColumnIndex);
    const pivotGranularity = currentAggConfig.pivotGranularity || 'month';
    const sourceRows = sourceCache?.[pivotSourceId] || [];

    if (!sourceRows.length || isNaN(pivotDateColIdx)) {
      return [];
    }

    const groups = {};

    try {
      for (let idx = 0; idx < sourceRows.length; idx++) {
        const row = sourceRows[idx];
        const dateVal = row[pivotDateColIdx];
        const period = transformDateValue(dateVal, pivotGranularity);
        if (!period) continue;

        if (!groups[period]) {
          groups[period] = { _period: period, _count: 0 };
          (currentAggConfig.pivotCountColumns || []).forEach(col => {
            groups[period][col.id] = 0;
          });
          constantCalcs.forEach(calc => {
            groups[period][calc.id] = calc.constantValue;
          });
          nonArithmeticCalcs.forEach(calc => {
            groups[period][calc.id] = 0;
          });
          arithmeticCalcs.forEach(calc => {
            groups[period][calc.id] = 0;
          });
        }

        groups[period]._count += 1;

        (currentAggConfig.pivotCountColumns || []).forEach(col => {
          const colVal = row[col.columnIndex];
          if (colVal && String(colVal).trim()) {
            groups[period][col.id] += 1;
          }
        });
      }

      // リレーション計算
      nonArithmeticCalcs.forEach(calc => {
        if (calc.type === 'relation') {
          const targetSourceId = calc.targetSourceId;
          const targetRows = sourceCache[targetSourceId] || [];
          const targetSource = dataSources.find(s => s.id === targetSourceId);
          if (!targetSource || !targetRows.length) return;

          const targetDateColIdx = calc.dateColumnIndex !== undefined && calc.dateColumnIndex !== ''
            ? parseInt(calc.dateColumnIndex)
            : targetSource.dateColumnIndex;

          if (isNaN(targetDateColIdx) || targetDateColIdx === undefined) return;

          targetRows.forEach(targetRow => {
            if (calc.filters && calc.filters.length > 0) {
              const passesFilters = calc.filters.every(filter => {
                const colIdx = parseInt(filter.colIndex);
                if (isNaN(colIdx)) return true;
                const val = targetRow[colIdx];
                if (filter.conditionType === 'equals') return String(val) === filter.value;
                if (filter.conditionType === 'contains') return String(val).includes(filter.value);
                if (filter.conditionType === 'isEmpty') return !val || val === '';
                if (filter.conditionType === 'isNotEmpty') return val && val !== '';
                return true;
              });
              if (!passesFilters) return;
            }

            if (calc.filterMappings && activeFilters) {
              for (const [filterId, targetColIdxStr] of Object.entries(calc.filterMappings)) {
                const targetColIdx = parseInt(targetColIdxStr);
                const filterValue = activeFilters[filterId];
                if (filterValue && !isNaN(targetColIdx)) {
                  const cellValue = targetRow[targetColIdx];
                  const isBlank = cellValue === undefined || cellValue === null || cellValue === '';
                  if (Array.isArray(filterValue) && filterValue.length > 0) {
                    const filterSet = new Set(filterValue);
                    const hasBlank = filterSet.has('(空白)');
                    if (!((hasBlank && isBlank) || filterSet.has(String(cellValue)))) {
                      return;
                    }
                  } else if (typeof filterValue !== 'object') {
                    const isBlankFilter = filterValue === '(空白)';
                    if (!((isBlankFilter && isBlank) || String(cellValue) === String(filterValue))) {
                      return;
                    }
                  }
                }
              }
            }

            const targetDateVal = targetRow[targetDateColIdx];
            const targetPeriod = transformDateValue(targetDateVal, pivotGranularity);
            if (!targetPeriod || !groups[targetPeriod]) return;

            if (calc.aggType === 'lookup') {
              const lookupIdx = parseInt(calc.aggTargetIndex);
              if (!isNaN(lookupIdx) && !groups[targetPeriod][calc.id]) {
                groups[targetPeriod][calc.id] = targetRow[lookupIdx] ?? '';
              }
            } else if (calc.aggType === 'sum') {
              const sumTargetIdx = parseInt(calc.aggTargetIndex);
              const v = parseFloat(String(targetRow[sumTargetIdx]).replace(/,/g, ''));
              if (!isNaN(v)) {
                groups[targetPeriod][calc.id] += v;
              }
            } else {
              if (calc.aggTargetIndex !== '' && calc.aggTargetIndex !== undefined) {
                const targetIdx = parseInt(calc.aggTargetIndex);
                if (targetRow[targetIdx] && targetRow[targetIdx] !== '') {
                  groups[targetPeriod][calc.id] += 1;
                }
              } else {
                groups[targetPeriod][calc.id] += 1;
              }
            }
          });
        }
      });
    } catch (err) {
      console.error('ピボット処理エラー:', err);
      return [];
    }

    const groupValues = Object.values(groups);
    groupValues.forEach(group => {
      arithmeticCalcs.forEach(calc => {
        group[calc.id] = applyArithmeticCalc(group, calc);
      });
    });

    return groupValues.sort((a, b) => {
      const parseYM = (s) => {
        const str = String(s || '');
        const match = str.match(/(\d+)年(\d+)月/);
        if (match) return parseInt(match[1]) * 100 + parseInt(match[2]);
        const yearMatch = str.match(/(\d+)年/);
        if (yearMatch) return parseInt(yearMatch[1]) * 100;
        return 0;
      };
      return parseYM(b._period) - parseYM(a._period);
    });
  }

  // ソース参照展開モードでグループ化
  if (isSourceExpandMode && expandedRows && expandedRows.length > 0 && groupByFields.length > 0) {
    const expandSourceId = sourceExpand.sourceId;
    const expandColIdx = parseInt(sourceExpand.expandColumnIndex);

    const rowsWithRelations = expandedRows.map(row => {
      const newRow = { ...row };
      const expandValue = row._expandValue;

      constantCalcs.forEach(calc => {
        newRow[calc.id] = calc.constantValue;
      });

      nonArithmeticCalcs.forEach(calc => {
        if (calc.type === 'relation') {
          const targetSourceId = calc.targetSourceId;
          const targetRows = sourceCache[targetSourceId] || [];
          const targetSource = dataSources.find(s => s.id === targetSourceId);
          if (!targetSource) {
            newRow[calc.id] = 0;
            return;
          }

          const targetKeyIdx = calc.foreignKeyIndex !== '' && calc.foreignKeyIndex !== undefined
            ? parseInt(calc.foreignKeyIndex)
            : targetSource.keyColumnIndex;

          const localKey = String(row[calc.localKeyId] || row.id || '');
          let matchingRows = targetRows.filter(tr => String(tr[targetKeyIdx]) === localKey);

          if (calc.dateColumnIndex !== undefined && calc.dateColumnIndex !== '') {
            const dateColIdx = parseInt(calc.dateColumnIndex);
            if (!isNaN(dateColIdx) && row.date) {
              const normalizedRowDate = normalizeDate(row.date);
              matchingRows = matchingRows.filter(r => normalizeDate(r[dateColIdx]) === normalizedRowDate);
            }
          }
          // 追加日付カラム (ボード日付範囲フィルタ)
          if (calc.extraDateColumnIndices?.length > 0) {
            const dateRange = activeFilters?.date;
            const rangeStart = dateRange?.start ? normalizeDate(dateRange.start) : null;
            const rangeEnd = dateRange?.end ? normalizeDate(dateRange.end) : null;
            if (rangeStart && rangeEnd) {
              for (const extraIdxStr of calc.extraDateColumnIndices) {
                const extraIdx = parseInt(extraIdxStr);
                if (!isNaN(extraIdx)) {
                  matchingRows = matchingRows.filter(r => {
                    const d = normalizeDate(r[extraIdx]);
                    return d && d >= rangeStart && d <= rangeEnd;
                  });
                }
              }
            }
          }

          if (calc.filters && calc.filters.length > 0) {
            matchingRows = matchingRows.filter(r => {
              return calc.filters.every(filter => {
                const colIdx = parseInt(filter.colIndex);
                if (isNaN(colIdx)) return true;
                const val = r[colIdx];
                if (filter.conditionType === 'equals') return String(val) === filter.value;
                if (filter.conditionType === 'contains') return String(val).includes(filter.value);
                if (filter.conditionType === 'isEmpty') return !val || val === '';
                if (filter.conditionType === 'isNotEmpty') return val && val !== '';
                return true;
              });
            });
          }

          if (calc.filterMappings && activeFilters) {
            matchingRows = matchingRows.filter(r => {
              for (const [filterId, targetColIdxStr] of Object.entries(calc.filterMappings)) {
                const targetColIdx = parseInt(targetColIdxStr);
                const filterValue = activeFilters[filterId];
                if (filterValue && !isNaN(targetColIdx)) {
                  const cellValue = r[targetColIdx];
                  const isBlank = cellValue === undefined || cellValue === null || cellValue === '';
                  if (Array.isArray(filterValue) && filterValue.length > 0) {
                    const filterSet = new Set(filterValue);
                    const hasBlank = filterSet.has('(空白)');
                    if (!((hasBlank && isBlank) || filterSet.has(String(cellValue)))) {
                      return false;
                    }
                  } else if (typeof filterValue !== 'object') {
                    const isBlankFilter = filterValue === '(空白)';
                    if (!((isBlankFilter && isBlank) || String(cellValue) === String(filterValue))) {
                      return false;
                    }
                  }
                }
              }
              return true;
            });
          }

          if (targetSourceId === expandSourceId && expandValue) {
            matchingRows = matchingRows.filter(tr => {
              const trExpandVal = tr[expandColIdx] || '';
              if (expandValue === '(空白)') {
                return trExpandVal === '' || trExpandVal === '(空白)';
              }
              return trExpandVal === expandValue;
            });
          }

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
        } else {
          newRow[calc.id] = 0;
        }
      });

      arithmeticCalcs.forEach(calc => {
        newRow[calc.id] = applyArithmeticCalc(newRow, calc);
      });

      return newRow;
    });

    const groups = {};

    rowsWithRelations.forEach(row => {
      const expandValueStr = String(row._expandValue || '(空白)');
      const keyParts = groupByFields.map(field => {
        if (field === '_expandValue') return expandValueStr;
        const rawValue = row[field];
        const transformType = dateTransforms[field];
        if (transformType && transformType !== 'none') {
          return String(transformDateValue(rawValue, transformType) || '(空白)');
        }
        return String(rawValue || '(空白)');
      });
      const compositeKeyBase = keyParts.join('|||');
      const compositeKey = groupByFields.includes('_expandValue')
        ? compositeKeyBase
        : `${compositeKeyBase}|||${expandValueStr}`;

      if (!groups[compositeKey]) {
        groups[compositeKey] = { _count: 0, _expandValue: expandValueStr };
        groupByFields.forEach((field, idx) => {
          groups[compositeKey][field] = keyParts[idx];
        });
        stringFields.forEach(f => {
          if (!groupByFields.includes(f.id) && f.id !== '_expandValue') {
            groups[compositeKey][f.id] = row[f.id] || '';
          }
        });
        numericFields.forEach(f => groups[compositeKey][f.id] = initFieldValue(f.aggregationMethod));
        nonArithmeticCalcs.forEach(calc => groups[compositeKey][calc.id] = 0);
        arithmeticCalcs.forEach(calc => groups[compositeKey][calc.id] = 0);
        groups[compositeKey]._expandNumericValue = 0;
      }

      const group = groups[compositeKey];
      group._count++;
      numericFields.forEach(f => aggregateField(group, f.id, row[f.id] || 0, f.aggregationMethod));
      nonArithmeticCalcs.forEach(calc => {
        group[calc.id] += (row[calc.id] || 0);
      });
      if (row._expandNumericValue !== undefined) {
        group._expandNumericValue += row._expandNumericValue;
      }
    });

    const groupValues = Object.values(groups);
    return groupValues.map(group => {
      finalizeGroup(group, numericFields);
      arithmeticCalcs.forEach(calc => {
        group[calc.id] = applyArithmeticCalc(group, calc);
      });
      return group;
    });
  }

  // ソース参照展開モードで集計なし
  if (isSourceExpandMode && expandedRows && expandedRows.length > 0 && groupByFields.length === 0) {
    const expandSourceId = sourceExpand.sourceId;
    const expandColIdx = parseInt(sourceExpand.expandColumnIndex);

    return expandedRows.map(row => {
      const newRow = { ...row };
      constantCalcs.forEach(calc => {
        newRow[calc.id] = calc.constantValue;
      });

      nonArithmeticCalcs.forEach(calc => {
        if (calc.type === 'relation') {
          const targetSourceId = calc.targetSourceId;
          const targetRows = sourceCache[targetSourceId] || [];
          const targetSource = dataSources.find(s => s.id === targetSourceId);
          if (!targetSource) {
            newRow[calc.id] = 0;
            return;
          }

          const targetKeyIdx = calc.foreignKeyIndex !== '' && calc.foreignKeyIndex !== undefined
            ? parseInt(calc.foreignKeyIndex)
            : targetSource.keyColumnIndex;

          const localKey = String(row[calc.localKeyId] || row.id || '');
          const expandValue = row._expandValue;

          let matchingRows = targetRows.filter(tr => String(tr[targetKeyIdx]) === localKey);

          if (calc.dateColumnIndex !== undefined && calc.dateColumnIndex !== '') {
            const dateColIdx = parseInt(calc.dateColumnIndex);
            if (!isNaN(dateColIdx) && row.date) {
              const normalizedRowDate = normalizeDate(row.date);
              matchingRows = matchingRows.filter(r => normalizeDate(r[dateColIdx]) === normalizedRowDate);
            }
          }
          // 追加日付カラム (ボード日付範囲フィルタ)
          if (calc.extraDateColumnIndices?.length > 0) {
            const dateRange = activeFilters?.date;
            const rangeStart = dateRange?.start ? normalizeDate(dateRange.start) : null;
            const rangeEnd = dateRange?.end ? normalizeDate(dateRange.end) : null;
            if (rangeStart && rangeEnd) {
              for (const extraIdxStr of calc.extraDateColumnIndices) {
                const extraIdx = parseInt(extraIdxStr);
                if (!isNaN(extraIdx)) {
                  matchingRows = matchingRows.filter(r => {
                    const d = normalizeDate(r[extraIdx]);
                    return d && d >= rangeStart && d <= rangeEnd;
                  });
                }
              }
            }
          }

          if (calc.filters && calc.filters.length > 0) {
            matchingRows = matchingRows.filter(r => {
              return calc.filters.every(filter => {
                const colIdx = parseInt(filter.colIndex);
                if (isNaN(colIdx)) return true;
                const val = r[colIdx];
                if (filter.conditionType === 'equals') return String(val) === filter.value;
                if (filter.conditionType === 'contains') return String(val).includes(filter.value);
                if (filter.conditionType === 'isEmpty') return !val || val === '';
                if (filter.conditionType === 'isNotEmpty') return val && val !== '';
                return true;
              });
            });
          }

          if (calc.filterMappings && activeFilters) {
            matchingRows = matchingRows.filter(r => {
              for (const [filterId, targetColIdxStr] of Object.entries(calc.filterMappings)) {
                const targetColIdx = parseInt(targetColIdxStr);
                const filterValue = activeFilters[filterId];
                if (filterValue && !isNaN(targetColIdx)) {
                  const cellValue = r[targetColIdx];
                  const isBlank = cellValue === undefined || cellValue === null || cellValue === '';
                  if (Array.isArray(filterValue) && filterValue.length > 0) {
                    const filterSet = new Set(filterValue);
                    const hasBlank = filterSet.has('(空白)');
                    if (!((hasBlank && isBlank) || filterSet.has(String(cellValue)))) {
                      return false;
                    }
                  } else if (typeof filterValue !== 'object') {
                    const isBlankFilter = filterValue === '(空白)';
                    if (!((isBlankFilter && isBlank) || String(cellValue) === String(filterValue))) {
                      return false;
                    }
                  }
                }
              }
              return true;
            });
          }

          if (targetSourceId === expandSourceId && expandValue) {
            matchingRows = matchingRows.filter(tr => {
              const trExpandVal = tr[expandColIdx] || '';
              if (expandValue === '(空白)') {
                return trExpandVal === '' || trExpandVal === '(空白)';
              }
              return trExpandVal === expandValue;
            });
          }

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
        }
      });

      arithmeticCalcs.forEach(calc => {
        newRow[calc.id] = applyArithmeticCalc(newRow, calc);
      });
      return newRow;
    });
  }

  // 通常モード
  if (!allRows || allRows.length === 0) return [];
  if (groupByFields.length === 0) {
    return allRows.map(row => {
      const newRow = { ...row };
      arithmeticCalcs.forEach(calc => {
        newRow[calc.id] = applyArithmeticCalc(newRow, calc);
      });
      return newRow;
    });
  }

  const groups = {};

  allRows.forEach(row => {
    const keyParts = groupByFields.map(field => {
      const rawValue = row[field];
      const transformType = dateTransforms[field];
      if (transformType && transformType !== 'none') {
        return String(transformDateValue(rawValue, transformType) || '(空白)');
      }
      return String(rawValue || '(空白)');
    });
    const compositeKey = keyParts.join('|||');

    if (!groups[compositeKey]) {
      groups[compositeKey] = { _count: 0 };
      groupByFields.forEach((field, idx) => {
        groups[compositeKey][field] = keyParts[idx];
      });
      stringFields.forEach(f => {
        if (!groupByFields.includes(f.id) && !groups[compositeKey][f.id]) {
          groups[compositeKey][f.id] = row[f.id];
        }
      });
      numericFields.forEach(f => groups[compositeKey][f.id] = initFieldValue(f.aggregationMethod));
      extraAggregationFields.forEach(id => groups[compositeKey][id] = initFieldValue(extraAggMethodMap[id]));
      constantCalcs.forEach(c => groups[compositeKey][c.id] = c.constantValue);
      nonArithmeticCalcs.forEach(c => groups[compositeKey][c.id] = 0);
    }
    const group = groups[compositeKey];
    group._count++;
    numericFields.forEach(f => {
      const val = parseFloat(String(row[f.id] || '').replace(/,/g, ''));
      aggregateField(group, f.id, isNaN(val) ? 0 : val, f.aggregationMethod);
    });
    extraAggregationFields.forEach(id => {
      const val = parseFloat(String(row[id] || '').replace(/,/g, ''));
      aggregateField(group, id, isNaN(val) ? 0 : val, extraAggMethodMap[id]);
    });
    nonArithmeticCalcs.forEach(c => group[c.id] += (row[c.id] || 0));
  });

  return Object.values(groups).map(group => {
    finalizeGroup(group, numericFields, extraAggMethodMap);
    arithmeticCalcs.forEach(calc => {
      group[calc.id] = applyArithmeticCalc(group, calc);
    });
    return group;
  });
}

/**
 * 階層データ構築: フラット行をhierarchyFieldsに基づきグループヘッダー＋小計行に変換
 * react-windowと互換性を維持するためフラット配列で返す
 *
 * @param {Array} rows - computeProcessedDataの出力（未グルーピングの全行）
 * @param {Array} hierarchyFields - 階層フィールド配列（上位→下位の順）
 * @param {Array} groupByFields - 全集計軸フィールド（hierarchyFields + データ行フィールド）
 * @param {Array} numericFields - 数値フィールド定義
 * @param {Array} arithmeticCalcs - 算術計算定義
 * @param {Array} nonArithmeticCalcs - 非算術計算定義
 * @param {Array} constantCalcs - 定数計算定義
 * @param {Array} stringFields - 文字列フィールド定義
 * @param {Array} extraAggregationFields - 追加集計フィールド
 * @returns {Array} _rowType / _level / _label / _groupKey / _parentKeys 付きフラット配列
 */
export function buildHierarchicalRows(
  rows,
  hierarchyFields,
  groupByFields,
  { numericFields = [], arithmeticCalcs = [], nonArithmeticCalcs = [], constantCalcs = [], stringFields = [], extraAggregationFields = [], extraAggMethodMap = {}, fieldOverrides = {} }
) {
  if (!rows || rows.length === 0 || !hierarchyFields || hierarchyFields.length === 0) {
    return rows || [];
  }

  // 再帰的にツリーを構築
  function buildTree(currentRows, levelIdx, parentKeys) {
    if (levelIdx >= hierarchyFields.length) {
      // 末端: データ行として返す
      return currentRows.map(row => ({
        ...row,
        _rowType: 'data',
        _level: hierarchyFields.length,
        _parentKeys: [...parentKeys],
      }));
    }

    const fieldId = hierarchyFields[levelIdx];
    const overrideFieldId = fieldOverrides[fieldId];

    // このレベルでグループ化（先月モード時は代替フィールドを参照、空白なら元フィールドにフォールバック）
    const groupMap = new Map();
    currentRows.forEach(row => {
      let val;
      if (overrideFieldId) {
        val = row[overrideFieldId];
        if (val === undefined || val === null || val === '') val = row[fieldId];
      } else {
        val = row[fieldId];
      }
      const key = String(val || '(空白)');
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key).push(row);
    });

    const result = [];

    // グループをキー名でソート（文字列昇順）
    const sortedKeys = Array.from(groupMap.keys()).sort((a, b) => a.localeCompare(b, 'ja'));

    sortedKeys.forEach(key => {
      const groupRows = groupMap.get(key);
      const groupKey = [...parentKeys, key].join('|||');

      // 小計を計算
      const subtotal = { _count: 0 };
      numericFields.forEach(f => { subtotal[f.id] = initFieldValue(f.aggregationMethod); });
      extraAggregationFields.forEach(id => { subtotal[id] = initFieldValue(extraAggMethodMap[id]); });
      nonArithmeticCalcs.forEach(c => { subtotal[c.id] = 0; });
      constantCalcs.forEach(c => { subtotal[c.id] = c.constantValue; });

      groupRows.forEach(row => {
        subtotal._count += (row._count || 1);
        numericFields.forEach(f => {
          const val = typeof row[f.id] === 'number' ? row[f.id] : (parseFloat(String(row[f.id] || '').replace(/,/g, '')) || 0);
          aggregateField(subtotal, f.id, val, f.aggregationMethod === 'first' ? 'sum' : f.aggregationMethod);
        });
        extraAggregationFields.forEach(id => {
          const val = typeof row[id] === 'number' ? row[id] : (parseFloat(String(row[id] || '').replace(/,/g, '')) || 0);
          const eMethod = extraAggMethodMap[id];
          aggregateField(subtotal, id, val, eMethod === 'first' ? 'sum' : eMethod);
        });
        nonArithmeticCalcs.forEach(c => {
          subtotal[c.id] += (row[c.id] || 0);
        });
      });

      finalizeGroup(subtotal, numericFields, extraAggMethodMap);
      // 算術計算を小計値から再計算
      arithmeticCalcs.forEach(calc => {
        subtotal[calc.id] = applyArithmeticCalc(subtotal, calc);
      });

      // グループ行のstring fieldsは最初のデータ行から継承
      stringFields.forEach(f => {
        if (f.id !== fieldId && !hierarchyFields.includes(f.id)) {
          subtotal[f.id] = '';
        }
      });
      // このレベルのフィールド値をセット
      subtotal[fieldId] = key;

      // グループヘッダー行
      const groupRow = {
        ...subtotal,
        _rowType: 'group',
        _level: levelIdx,
        _label: key,
        _groupKey: groupKey,
        _parentKeys: [...parentKeys],
        _expanded: true,
        _childCount: groupRows.length,
      };

      result.push(groupRow);

      // 子レベルを再帰構築
      const children = buildTree(groupRows, levelIdx + 1, [...parentKeys, key]);
      result.push(...children);
    });

    return result;
  }

  return buildTree(rows, 0, []);
}

/**
 * 高レベル便利関数: フィールド分類 + DataTable処理を一括実行
 * SF連携の統合インポートなどhook外から直接呼び出す用
 */
export function processDataTablePure({
  allRows = [],
  systemFields = [],
  calculations = [],
  currentAggConfig,
  groupByFields = [],
  dateTransforms = {},
  sourceCache = {},
  dataSources = [],
  activeFilters = {},
  mapping = {},
}) {
  const fields = computeFieldClassifications(systemFields, calculations);
  const processedData = computeProcessedData({
    allRows,
    groupByFields,
    dateTransforms,
    currentAggConfig,
    sourceCache,
    dataSources,
    activeFilters,
    ...fields,
    isSourceExpandMode: false,
    expandedRows: null,
    sourceExpand: null,
  });

  return { processedData, ...fields };
}
