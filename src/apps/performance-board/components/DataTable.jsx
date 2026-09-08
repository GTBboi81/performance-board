// src/apps/performance-board/components/DataTable.jsx
// データテーブルコンポーネント（単一スクロールコンテナ + 独自仮想スクロール）

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import DataTableRow from './DataTableRow';
import DataTableToolbar from './DataTableToolbar';
import DataTableColumnHeader from './DataTableColumnHeader';
import DataTableSummaryRow from './DataTableSummaryRow';
import DataTableColumnEditPopup from './DataTableColumnEditPopup';
import DataTableSettingsPopup from './DataTableSettingsPopup';
import Encoding from 'encoding-japanese';

// カスタムフック
import { useAggregationConfig } from '../hooks/useAggregationConfig';
import { useSegmentManagement } from '../hooks/useSegmentManagement';
import { useDataTableProcessing } from '../hooks/useDataTableProcessing';
import { useDataTableLayout } from '../hooks/useDataTableLayout';

// ユーティリティ
import { applyArithmeticCalc, roundIndicatorGroupFormulaValue } from '../utils/dataTableUtils';
import { resolveDataTableDensity } from '../utils/dataTableHeaderLayout';
import { extractUniqueEmployees, applyEmployeeWhitelist } from '../utils/employeeWhitelist';

const DataTable = React.memo(({
  tableConfig: savedTableConfig,
  allRows,
  systemFields,
  calculations,
  glassClass,
  aggregationConfigs = [],
  theme = 'dark',
  sourceCache = {},
  dataSources = [],
  activeFilters = {},
  mapping = {},
  filters = [],
  setIsFilterApplying,
  onColumnColorsChange,
  onColumnAliasChange,
  onStickyColumnsChange,
  onVisibleEmployeeIdsChange,
  onMaxHeightChange,
  onFontSizeChange,
  onHeaderFontSizeChange,
  onSummaryFontSizeChange,
  onDataFontSizeChange,
  onColumnWidthsChange,
  onHeaderRowHeightChange,
  onSummaryRowHeightChange,
  onDataRowHeightChange,
  indicatorGroups = [],
  user,
  getFormulaInfo,
  onCalculationsChange,
  onDataTableSettingsChange,
  onDeleteDataTable,
}) => {
  const [pendingTableSettings, setPendingTableSettings] = useState(null); // 保存前のライブプレビュー値
  const tableConfig = useMemo(() => (
    pendingTableSettings
      ? { ...savedTableConfig, ...pendingTableSettings }
      : savedTableConfig
  ), [savedTableConfig, pendingTableSettings]);

  const isAdmin = user?.roleId === 'admin' || user?.role === 'admin';
  const isViewer = !isAdmin;

  // === 集計設定管理 ===
  const {
    selectedAggConfigId,
    setSelectedAggConfigId,
    safeAggregationConfigs,
    currentAggConfig,
    dateTransforms,
    sourceExpand,
    isSourceExpandMode,
  } = useAggregationConfig({
    tableConfig,
    aggregationConfigs,
  });

  // === セグメント管理 ===
  const {
    additionalSegments,
    groupByFields,
    availableSegmentFields,
    handleAddSegment,
    handleRemoveSegment,
  } = useSegmentManagement({
    currentAggConfig,
    systemFields,
    setIsFilterApplying,
  });

  // === 編集モード基盤 ===
  const [isEditMode, setIsEditMode] = useState(false);
  const [pendingCalcUpdates, setPendingCalcUpdates] = useState(new Map()); // Map<calcId, updatedCalc>

  // 効果的な計算式（pending を優先）
  const effectiveCalculations = useMemo(() => {
    if (pendingCalcUpdates.size === 0) return calculations;
    return calculations.map(c => pendingCalcUpdates.get(c.id) || c);
  }, [calculations, pendingCalcUpdates]);

  // 編集モード保存ハンドラ
  const handleEditSave = useCallback(() => {
    if (pendingCalcUpdates.size > 0) {
      onCalculationsChange?.(prevCalcs =>
        prevCalcs.map(c => pendingCalcUpdates.get(c.id) || c)
      );
      setPendingCalcUpdates(new Map());
    }
    if (pendingTableSettings) {
      onDataTableSettingsChange?.(pendingTableSettings);
      setPendingTableSettings(null);
    }
    setIsEditMode(false);
  }, [pendingCalcUpdates, pendingTableSettings, onCalculationsChange, onDataTableSettingsChange]);

  // 編集モードキャンセルハンドラ
  const handleEditCancel = useCallback(() => {
    setPendingCalcUpdates(new Map());
    setPendingTableSettings(null);
    setIsEditMode(false);
  }, []);

  // ポップアップから計算式を更新（ライブプレビュー用）
  const handleCalcUpdate = useCallback((updatedCalc) => {
    setPendingCalcUpdates(prev => {
      const next = new Map(prev);
      next.set(updatedCalc.id, updatedCalc);
      return next;
    });
  }, []);

  // ポップアップからテーブル設定を更新（ライブプレビュー用）
  const handleTableSettingsUpdate = useCallback((updates) => {
    setPendingTableSettings(updates);
  }, []);

  // === テーブル設定ポップアップ ===
  const [tableSettingsPopup, setTableSettingsPopup] = useState({ open: false, anchorRef: null });

  const handleTableNameClick = useCallback((anchorRef) => {
    setTableSettingsPopup({ open: true, anchorRef });
  }, []);

  const handleTableSettingsClose = useCallback(() => {
    setPendingTableSettings(null);
    setTableSettingsPopup(prev => ({ ...prev, open: false }));
  }, []);

  const handleTableSettingsSave = useCallback((settings) => {
    onDataTableSettingsChange?.(settings);
    setPendingTableSettings(null);
    setTableSettingsPopup(prev => ({ ...prev, open: false }));
  }, [onDataTableSettingsChange]);

  const handleTableSettingsDelete = useCallback(() => {
    onDeleteDataTable?.();
  }, [onDeleteDataTable]);

  // === 列編集ポップアップ ===
  const [columnEditPopup, setColumnEditPopup] = useState({
    open: false,
    colId: null,
    anchorRef: null,
  });

  const handleColumnEditClick = useCallback((colId, anchorRef) => {
    setColumnEditPopup({ open: true, colId, anchorRef });
  }, []);

  const handleColumnEditClose = useCallback(() => {
    setColumnEditPopup(prev => ({ ...prev, open: false }));
  }, []);

  const handleColumnEditSave = useCallback((updatedCalc) => {
    if (columnEditPopup.colId === '__new__') {
      // 新規計算式として config に追加
      const newCalc = { ...updatedCalc };
      onCalculationsChange?.(prev => [...prev, newCalc]);
      // テーブルの fields にも追加
      onDataTableSettingsChange?.({ fields: [...(tableConfig.fields || []), newCalc.id] });
    } else {
      handleCalcUpdate(updatedCalc);
    }
    handleColumnEditClose();
  }, [columnEditPopup.colId, onCalculationsChange, onDataTableSettingsChange, tableConfig.fields, handleCalcUpdate, handleColumnEditClose]);

  const handleColumnEditDelete = useCallback((calcId) => {
    onCalculationsChange?.(prev => prev.filter(c => c.id !== calcId));
    handleColumnEditClose();
  }, [onCalculationsChange, handleColumnEditClose]);

  // === 新規指標追加 ===
  const handleAddCalc = useCallback(() => {
    setColumnEditPopup({
      open: true,
      colId: '__new__',
      anchorRef: null,
    });
  }, []);

  // === データ処理 ===
  const {
    numericFields,
    stringFields,
    constantCalcs,
    nonArithmeticCalcs,
    arithmeticCalcs,
    processedData,
  } = useDataTableProcessing({
    allRows,
    tableConfig,
    systemFields,
    calculations: effectiveCalculations,
    currentAggConfig,
    groupByFields,
    dateTransforms,
    isSourceExpandMode,
    sourceExpand,
    sourceCache,
    dataSources,
    activeFilters,
    mapping,
    filters,
  });

  // === 階層モード ===
  const isHierarchyMode = currentAggConfig?.hierarchyEnabled && currentAggConfig?.hierarchyFields?.length > 0;

  // 担当者フィルタ用: 現在選択中の集計設定の mainKey フィールドID
  const mainKeyFieldId = currentAggConfig?.mainKey?.fieldId || null;

  // 担当者フィルタ用: 名前表示に使う文字列フィールドID
  const nameFieldId = useMemo(() => {
    if (!systemFields) return null;
    const nameLike = systemFields.find(f => f.type === 'string' && /name|名前|担当|氏名/i.test(f.label || f.id));
    return nameLike?.id || systemFields.find(f => f.type === 'string')?.id || null;
  }, [systemFields]);

  // allRows から担当者候補一覧を抽出
  const uniqueEmployees = useMemo(() =>
    extractUniqueEmployees(allRows, mainKeyFieldId, nameFieldId),
    [allRows, mainKeyFieldId, nameFieldId]
  );

  const [collapsedGroups, setCollapsedGroups] = useState(new Set());

  const toggleGroup = useCallback((groupKey) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }, []);

  // === フォントサイズ・行高さ（個別設定 > 自動算出。resolveDataTableDensity に統一） ===
  const {
    headerFontSize, summaryFontSize, dataFontSize,
    headerRowHeight, summaryRowHeight, dataRowHeight: ROW_HEIGHT_BASE,
  } = resolveDataTableDensity(tableConfig);
  // 後方互換のため fontSize は dataFontSize として扱う
  const fontSize = dataFontSize;

  const [localColumnWidths, setLocalColumnWidths] = useState(tableConfig.columnWidths || {});
  useEffect(() => {
    setLocalColumnWidths(tableConfig.columnWidths || {});
  }, [tableConfig.columnWidths]);

  // ドラッグ中の幅を同期的に読めるよう ref でミラーリング
  const localColumnWidthsRef = useRef(localColumnWidths);
  useEffect(() => { localColumnWidthsRef.current = localColumnWidths; }, [localColumnWidths]);
  const onColumnWidthsChangeRef = useRef(onColumnWidthsChange);
  onColumnWidthsChangeRef.current = onColumnWidthsChange;
  const tableIdRef = useRef(tableConfig.id);
  tableIdRef.current = tableConfig.id;

  const [draggingColId, setDraggingColId] = useState(null);
  const dragStateRef = useRef(null);

  // リスナーはドラッグ開始時にのみ登録し mouseup で即解除（常時登録コストを回避）
  const handleColumnWidthStart = useCallback((colId, startX, currentWidth) => {
    dragStateRef.current = { colId, startX, startWidth: currentWidth };
    setDraggingColId(colId);

    const handleMouseMove = (e) => {
      if (!dragStateRef.current) return;
      const { colId: dCol, startX: dX, startWidth: dW } = dragStateRef.current;
      const newWidth = Math.max(40, dW + (e.clientX - dX));
      setLocalColumnWidths(prev => ({ ...prev, [dCol]: newWidth }));
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      dragStateRef.current = null;
      setDraggingColId(null);
      // updater 外で副作用を呼ぶ（C1対応）
      onColumnWidthsChangeRef.current?.(tableIdRef.current, localColumnWidthsRef.current);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  // layout計算用: localColumnWidthsをtableConfigにマージ
  const mergedTableConfig = useMemo(() => ({
    ...tableConfig,
    columnWidths: localColumnWidths,
  }), [tableConfig, localColumnWidths]);

  // === ローカルState ===
  const [sortConfig, setSortConfig] = useState(() => ({
    key: tableConfig.defaultSortField || null,
    direction: tableConfig.defaultSortDirection || 'asc'
  }));
  const [localStickyColumns, setLocalStickyColumns] = useState(tableConfig.stickyColumns || 0);
  // 設定画面で tableConfig.stickyColumns が変わったらローカルに同期（ツールバー/設定画面の競合解消）
  useEffect(() => {
    setLocalStickyColumns(tableConfig.stickyColumns || 0);
  }, [tableConfig.stickyColumns]);
  // ツールバーから変更された時に config にも保存するラッパー
  const handleStickyColumnsChange = (num) => {
    setLocalStickyColumns(num);
    if (onStickyColumnsChange) {
      onStickyColumnsChange(tableConfig.id, num);
    }
  };

  const [selectedRowIndex, setSelectedRowIndex] = useState(null);
  const [columnColors, setColumnColors] = useState(tableConfig.columnColors || {});
  const [colorVersion, setColorVersion] = useState(0);
  const [expandedIndicatorGroups, setExpandedIndicatorGroups] = useState(() => {
    // デフォルトで全グループを展開状態にする
    const allGroupIds = (indicatorGroups || []).filter(g => g.memberCalcIds?.length > 0).map(g => g.id);
    return new Set(allGroupIds);
  });
  const [groupAnimActive, setGroupAnimActive] = useState(false);
  const groupAnimTimerRef = useRef(null);

  const toggleIndicatorGroup = useCallback((groupId) => {
    setExpandedIndicatorGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
    setGroupAnimActive(true);
    if (groupAnimTimerRef.current) clearTimeout(groupAnimTimerRef.current);
    groupAnimTimerRef.current = setTimeout(() => setGroupAnimActive(false), 300);
  }, []);

  // 単一スクロールコンテナ ref
  const containerRef = useRef(null);

  // tableConfig.columnColorsが変更された時に同期
  useEffect(() => {
    setColumnColors(tableConfig.columnColors || {});
  }, [tableConfig.columnColors]);

  // カラムエイリアス（表示名のカスタマイズ）
  const columnAliases = tableConfig.columnAliases || {};
  const handleColumnAliasChange = useCallback((colId, newName) => {
    const newAliases = { ...columnAliases };
    if (!newName || newName.trim() === '') {
      delete newAliases[colId];
    } else {
      newAliases[colId] = newName.trim();
    }
    if (onColumnAliasChange) {
      onColumnAliasChange(tableConfig.id, newAliases);
    }
  }, [columnAliases, onColumnAliasChange, tableConfig.id]);

  // カラム色変更ハンドラ（グループカラムの色変更時はメンバーにも同じ色を適用）
  const handleColumnColorChange = useCallback((fieldId, colorId) => {
    const newColors = { ...columnColors };
    if (colorId === 'default' || !colorId) {
      delete newColors[fieldId];
    } else {
      newColors[fieldId] = colorId;
    }
    // グループカラムの場合、メンバー指標にも同じ色を設定
    const group = (indicatorGroups || []).find(g => g.id === fieldId);
    if (group) {
      (group.memberCalcIds || []).forEach(memberId => {
        if (colorId === 'default' || !colorId) {
          delete newColors[memberId];
        } else {
          newColors[memberId] = colorId;
        }
      });
    }
    setColumnColors(newColors);
    setColorVersion(v => v + 1);
    if (onColumnColorsChange) {
      onColumnColorsChange(tableConfig.id, newColors);
    }
  }, [columnColors, onColumnColorsChange, tableConfig.id, indicatorGroups]);

  // === グループ合計値を各行に注入（四則演算でグループIDを参照可能にする） ===
  const enrichedData = useMemo(() => {
    if (!processedData || processedData.length === 0 || !indicatorGroups?.length) return processedData;
    // グループIDを参照する四則演算を特定
    const groupIds = new Set(indicatorGroups.map(g => g.id));
    const dependentCalcs = effectiveCalculations.filter(c =>
      c.type === 'arithmetic' && c.terms?.some(t => groupIds.has(t.field))
    );
    return processedData.map(row => {
      const enriched = { ...row };
      // グループ合計値を注入（非formula）
      indicatorGroups.forEach(group => {
        if (group.aggregation === 'formula') return; // 2パス目で処理
        const memberIds = group.memberCalcIds || [];
        if (group.aggregation === 'calc' && group.totalCalcId) {
          enriched[group.id] = typeof enriched[group.totalCalcId] === 'number' ? enriched[group.totalCalcId] : 0;
        } else if (group.aggregation === 'average') {
          const rawSum = memberIds.reduce((sum, mid) => sum + (typeof row[mid] === 'number' ? row[mid] : 0), 0);
          const nonZeroCount = memberIds.filter(mid => typeof row[mid] === 'number' && row[mid] > 0).length;
          enriched[group.id] = nonZeroCount > 0 ? rawSum / nonZeroCount : 0;
        } else {
          enriched[group.id] = memberIds.reduce((sum, mid) => sum + (typeof row[mid] === 'number' ? row[mid] : 0), 0);
        }
      });
      // グループIDを参照する四則演算を再計算
      dependentCalcs.forEach(calc => {
        enriched[calc.id] = applyArithmeticCalc(enriched, calc);
      });
      // formula タイプのグループ: 他グループ合計値同士の四則演算（2パス目）
      indicatorGroups.forEach(group => {
        if (group.aggregation === 'formula' && group.formula) {
          const a = enriched[group.formula.fieldA] || 0;
          const b = enriched[group.formula.fieldB] || 0;
          const op = group.formula.operator || '/';
          let result;
          if (op === '+') result = a + b;
          else if (op === '-') result = a - b;
          else if (op === '*') result = a * b;
          else if (op === '/') result = b !== 0 ? a / b : 0;
          else result = 0;
          enriched[group.id] = roundIndicatorGroupFormulaValue(result, op, group.unit);
        }
      });
      return enriched;
    });
  }, [processedData, indicatorGroups, calculations]);

  // 数値列IDリスト（ホワイトリストのゼロ埋め対象）
  const numericFieldIds = useMemo(() =>
    [...(systemFields || []).filter(f => f.type === 'number').map(f => f.id),
     ...(calculations || []).filter(c => c.type !== 'arithmetic').map(c => c.id)],
    [systemFields, calculations]
  );

  // 担当者ホワイトリストを適用してフィルタ + ゼロ行補完
  const visibleData = useMemo(() =>
    applyEmployeeWhitelist(
      enrichedData,
      tableConfig?.visibleEmployeeIds,
      mainKeyFieldId,
      numericFieldIds,
      systemFields || [],
      { nameFieldId, skip: isHierarchyMode }
    ),
    [enrichedData, tableConfig?.visibleEmployeeIds, mainKeyFieldId, nameFieldId, numericFieldIds, systemFields, isHierarchyMode]
  );

  // 全グループキーを取得
  const allGroupKeys = useMemo(() => {
    if (!isHierarchyMode || !visibleData) return [];
    return visibleData.filter(r => r._rowType === 'group').map(r => r._groupKey);
  }, [isHierarchyMode, visibleData]);

  const allCollapsed = isHierarchyMode && allGroupKeys.length > 0 && allGroupKeys.every(k => collapsedGroups.has(k));
  const collapseAll = useCallback(() => setCollapsedGroups(new Set(allGroupKeys)), [allGroupKeys]);
  const expandAll = useCallback(() => setCollapsedGroups(new Set()), []);

  // === 指標フィルター・ソート・サマリー計算 ===
  const sortedData = useMemo(() => {
    if (!visibleData || visibleData.length === 0) return [];

    // カラム値フィルター適用（指標フィルターの前に実行）
    let data = visibleData;
    const columnFilters = tableConfig.columnFilters || [];
    if (columnFilters.length > 0) {
      data = data.filter(row => {
        if (row._rowType === 'group') return true;
        return columnFilters.every(cf => {
          if (!cf.field || cf.value === '' || cf.value === undefined) return true;
          const cellVal = String(row[cf.field] ?? '');
          const filterVals = String(cf.value).split(',').map(v => v.trim()).filter(Boolean);
          if (filterVals.length === 0) return true;
          let matches;
          switch (cf.operator) {
            case 'equals': matches = filterVals.some(fv => cellVal === fv); break;
            case 'notEquals': matches = filterVals.every(fv => cellVal !== fv); break;
            case 'contains': matches = filterVals.some(fv => cellVal.includes(fv)); break;
            case 'notContains': matches = filterVals.every(fv => !cellVal.includes(fv)); break;
            default: matches = true;
          }
          return cf.action === 'exclude' ? !matches : matches;
        });
      });
    }

    // 指標フィルター適用（階層モードではデータ行のみフィルタ、グループ行は保持）
    const metricFilters = tableConfig.metricFilters || [];
    if (metricFilters.length > 0) {
      data = data.filter(row => {
        if (row._rowType === 'group') return true;
        return metricFilters.every(mf => {
          if (!mf.field) return true;
          const val = row[mf.field];
          const numVal = typeof val === 'number' ? val : parseFloat(val) || 0;
          const target = parseFloat(mf.value) || 0;
          let matches;
          switch (mf.operator) {
            case 'equals': matches = numVal === target; break;
            case 'notEquals': matches = numVal !== target; break;
            case 'greaterThan': matches = numVal > target; break;
            case 'lessThan': matches = numVal < target; break;
            case 'greaterOrEqual': matches = numVal >= target; break;
            case 'lessOrEqual': matches = numVal <= target; break;
            default: matches = true;
          }
          return mf.action === 'exclude' ? !matches : matches;
        });
      });
    }

    // 階層モード: フィルター後のデータ行からグループ行の集計値を再計算
    const hasFilters = columnFilters.length > 0 || metricFilters.length > 0;
    if (isHierarchyMode && hasFilters) {
      // グループ行ごとに、その直下のデータ行を再集計
      const numericFieldIds = [...systemFields.filter(f => f.type === 'number').map(f => f.id), ...effectiveCalculations.filter(c => c.type !== 'arithmetic').map(c => c.id)];
      const arithmeticCalcs = effectiveCalculations.filter(c => c.type === 'arithmetic');

      // 各グループ行のインデックスとその配下のデータ行を収集
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row._rowType !== 'group') continue;

        // このグループの配下のデータ行を収集（次の同レベル以上のグループまで）
        const childDataRows = [];
        for (let j = i + 1; j < data.length; j++) {
          if (data[j]._rowType === 'group' && data[j]._level <= row._level) break;
          if (data[j]._rowType !== 'group') childDataRows.push(data[j]);
        }

        // 再集計
        const recalc = { ...row, _count: childDataRows.length, _childCount: childDataRows.length };
        numericFieldIds.forEach(fid => { recalc[fid] = 0; });
        childDataRows.forEach(dr => {
          numericFieldIds.forEach(fid => {
            recalc[fid] += (typeof dr[fid] === 'number' ? dr[fid] : parseFloat(dr[fid]) || 0);
          });
        });
        arithmeticCalcs.forEach(calc => {
          recalc[calc.id] = applyArithmeticCalc(recalc, calc);
        });
        data[i] = recalc;
      }
    }

    // 階層モード: ソートはグループ内で適用、折りたたみフィルタリング
    if (isHierarchyMode) {
      // グループ内ソート
      if (sortConfig.key) {
        // 階層構造を保持したまま同一親内のデータ行をソート
        const result = [];
        let i = 0;
        while (i < data.length) {
          const row = data[i];
          if (row._rowType === 'group') {
            result.push(row);
            i++;
          } else {
            // 連続するデータ行を収集してソート
            const dataChunk = [];
            while (i < data.length && data[i]._rowType !== 'group') {
              dataChunk.push(data[i]);
              i++;
            }
            dataChunk.sort((a, b) => {
              const valA = a[sortConfig.key];
              const valB = b[sortConfig.key];
              if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
              if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
              return 0;
            });
            result.push(...dataChunk);
          }
        }
        data = result;
      }

      // 合計行用: 折りたたみ前のトップレベルグループ行を保持
      data._topLevelGroups = data.filter(row => row._rowType === 'group' && row._level === 0);

      // 折りたたみフィルタ: 親グループが折りたたまれている行を非表示
      if (collapsedGroups.size > 0) {
        data = data.filter(row => {
          if (!row._parentKeys || row._parentKeys.length === 0) return true;
          // 親キーチェーンの中で折りたたまれているものがあれば非表示
          for (let k = 0; k < row._parentKeys.length; k++) {
            const ancestorKey = row._parentKeys.slice(0, k + 1).join('|||');
            if (collapsedGroups.has(ancestorKey)) return false;
          }
          return true;
        });
      }
    } else {
      if (sortConfig.key) {
        data = [...data];
        data.sort((a, b) => {
          const valA = a[sortConfig.key];
          const valB = b[sortConfig.key];
          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        });
      }
    }

    const displayLimit = tableConfig.displayLimit || 0;
    if (displayLimit > 0 && data.length > displayLimit) {
      return data.slice(0, displayLimit);
    }

    return data;
  }, [visibleData, sortConfig, tableConfig.displayLimit, tableConfig.metricFilters, tableConfig.columnFilters, isHierarchyMode, collapsedGroups]);

  // セル計算用のMap
  const calcMap = useMemo(() => new Map(effectiveCalculations.map(c => [c.id, c])), [effectiveCalculations]);
  const fieldMap = useMemo(() => new Map(systemFields.map(f => [f.id, f])), [systemFields]);

  // === レイアウト計算 ===
  const {
    tableHeaders,
    columnWidths,
    totalWidth,
    tableHeight,
    widthClass,
  } = useDataTableLayout({
    tableConfig: mergedTableConfig,
    systemFields,
    calculations: effectiveCalculations,
    groupByFields,
    additionalSegments,
    stringFields,
    currentAggConfig,
    isSourceExpandMode,
    sourceExpand,
    dataSources,
    sortedData,
    calcMap,
    fieldMap,
    indicatorGroups,
    expandedIndicatorGroups,
    columnAliases,
  });

  // 固定列の left オフセット。帯・ヘッダー・合計・明細行の全てで共有する単一の実体。
  const stickyLeftPositions = useMemo(() => {
    const positions = [];
    let cumulative = 0;
    for (let i = 0; i < localStickyColumns && i < columnWidths.length; i++) {
      positions.push(cumulative);
      cumulative += columnWidths[i] || 120;
    }
    return positions;
  }, [localStickyColumns, columnWidths]);

  // 合計行の計算
  const summaryRow = useMemo(() => {
    if (!sortedData || sortedData.length === 0) return null;

    // 階層モード: 折りたたみ前のトップレベルグループ行から合計（折りたたみ状態に影響されない）
    const summarySource = isHierarchyMode
      ? (sortedData._topLevelGroups || sortedData.filter(row => row._rowType === 'group' && row._level === 0))
      : sortedData;

    if (summarySource.length === 0) return null;

    const summary = {};

    const sumFieldValue = (fieldId) =>
      summarySource.reduce((sum, row) => sum + (typeof row[fieldId] === 'number' ? row[fieldId] : 0), 0);

    // 展開/折りたたみに関係なく、全フィールドの合計を計算（見た目の切り替えで値が変わらないようにする）
    // 特殊カラム
    summary['_expandValue'] = '合計';
    summary['_count'] = sumFieldValue('_count');
    summary['_expandNumericValue'] = sumFieldValue('_expandNumericValue');

    // systemFields
    systemFields.forEach(f => {
      if (f.type === 'number') summary[f.id] = sumFieldValue(f.id);
    });

    // calculations（非arithmetic → arithmetic の順で計算）
    effectiveCalculations.forEach(calc => {
      if (calc.type === 'constant') {
        summary[calc.id] = calc.constantValue;
      } else if (calc.type !== 'arithmetic') {
        summary[calc.id] = sumFieldValue(calc.id);
      }
    });
    effectiveCalculations.forEach(calc => {
      if (calc.type === 'arithmetic') {
        const termSums = {};
        if (calc.terms && calc.terms.length > 0) {
          calc.terms.forEach(term => {
            if (term.field && termSums[term.field] === undefined) {
              termSums[term.field] = summary[term.field] !== undefined ? summary[term.field] : sumFieldValue(term.field);
            }
          });
        } else if (calc.fieldA && calc.fieldB) {
          termSums[calc.fieldA] = summary[calc.fieldA] !== undefined ? summary[calc.fieldA] : sumFieldValue(calc.fieldA);
          termSums[calc.fieldB] = summary[calc.fieldB] !== undefined ? summary[calc.fieldB] : sumFieldValue(calc.fieldB);
        }
        summary[calc.id] = applyArithmeticCalc(termSums, calc);
      }
    });

    // 指標グループの合計値を計算（非formula → formula の順）
    (indicatorGroups || []).filter(g => g.aggregation !== 'formula').forEach(group => {
      const memberIds = group.memberCalcIds || [];
      if (group.aggregation === 'calc' && group.totalCalcId) {
        summary[group.id] = typeof summary[group.totalCalcId] === 'number' ? summary[group.totalCalcId] : 0;
      } else if (group.aggregation === 'average') {
        const rawSum = memberIds.reduce((sum, mid) => sum + (typeof summary[mid] === 'number' ? summary[mid] : 0), 0);
        const nonZeroCount = memberIds.filter(mid => typeof summary[mid] === 'number' && summary[mid] > 0).length;
        summary[group.id] = nonZeroCount > 0 ? rawSum / nonZeroCount : 0;
      } else {
        summary[group.id] = memberIds.reduce((sum, mid) => sum + (typeof summary[mid] === 'number' ? summary[mid] : 0), 0);
      }
    });
    (indicatorGroups || []).filter(g => g.aggregation === 'formula' && g.formula).forEach(group => {
      const a = summary[group.formula.fieldA] || 0;
      const b = summary[group.formula.fieldB] || 0;
      const op = group.formula.operator || '/';
      let result = 0;
      if (op === '+') result = a + b;
      else if (op === '-') result = a - b;
      else if (op === '*') result = a * b;
      else if (op === '/') result = b !== 0 ? a / b : 0;
      summary[group.id] = roundIndicatorGroupFormulaValue(result, op, group.unit);
    });

    return summary;
  }, [sortedData, systemFields, effectiveCalculations, isHierarchyMode, indicatorGroups]);

  // === CSVエクスポート ===
  const exportToCSV = useCallback(() => {
    if (!tableHeaders.length || !sortedData.length) return;

    const esc = (v) => {
      let s = String(v ?? '');
      // CSVインジェクション対策: 数式実行を防止
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = [];
    // ヘッダー行
    rows.push(tableHeaders.map(col => esc(col.label)).join(','));
    // データ行（階層モード: グループ行は最初のカラムにインデント付きラベル）
    sortedData.forEach(row => {
      rows.push(tableHeaders.map((col, colIdx) => {
        if (isHierarchyMode && row._rowType === 'group' && colIdx === 0) {
          const indent = '  '.repeat(row._level);
          return esc(`${indent}${row._label}`);
        }
        if (isHierarchyMode && row._rowType === 'data' && colIdx === 0) {
          const indent = '  '.repeat(row._level || 0);
          return esc(`${indent}${row[col.id] ?? ''}`);
        }
        // グループカラムも通常カラムも row[col.id] を使う（enrichedData で注入済み）
        return esc(row[col.id]);
      }).join(','));
    });
    // 合計行
    if (summaryRow) {
      rows.push(tableHeaders.map((col, i) => {
        if (i === 0 && (summaryRow[col.id] === null || summaryRow[col.id] === undefined)) return esc('合計');
        return esc(summaryRow[col.id]);
      }).join(','));
    }

    const csvStr = rows.join('\r\n');
    const unicodeArray = Encoding.stringToCode(csvStr);
    const sjisArray = Encoding.convert(unicodeArray, { to: 'SJIS', from: 'UNICODE' });
    const uint8Array = new Uint8Array(sjisArray);
    const blob = new Blob([uint8Array], { type: 'application/octet-stream' });

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const fileName = `${tableConfig.name || 'datatable'}_${dateStr}.csv`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [tableHeaders, sortedData, summaryRow, tableConfig.name]);

  // === イベントハンドラ ===
  const handleSort = useCallback((key) => {
    // グループカラムはソート不可（展開/折りたたみで制御）
    const header = tableHeaders.find(h => h.id === key);
    if (header?._isGroup) return;
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  }, [sortConfig, tableHeaders]);

  const handleRowClick = useCallback((index) => {
    setSelectedRowIndex(prev => prev === index ? null : index);
  }, []);

  // === 独自仮想スクロール ===
  const ROW_HEIGHT = ROW_HEIGHT_BASE;

  const [scrollTop, setScrollTop] = useState(0);
  const [containerClientH, setContainerClientH] = useState(0);

  // コンテナのクライアント高さを ResizeObserver で計測
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerClientH(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleContainerScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // スティッキーエリアの高さ（ヘッダー行 + 合計行）
  // headerRowHeight/summaryRowHeight は resolveDataTableDensity で解決済みの値をそのまま使う
  // （ここで別計算すると実際の描画高さとずれ、仮想スクロールの可視範囲がずれて行が欠ける）。
  const STICKY_H = useMemo(() => {
    return headerRowHeight + summaryRowHeight;
  }, [headerRowHeight, summaryRowHeight]);

  const OVERSCAN = 3;

  const visibleRows = useMemo(() => {
    // containerClientH が未計測の間は全行レンダリングして安全側に倒す
    if (containerClientH <= 0) {
      return sortedData.map((row, i) => ({ index: i, row }));
    }
    const dataTop = Math.max(0, scrollTop - STICKY_H);
    const dataBottom = dataTop + Math.max(0, containerClientH - STICKY_H);
    const startIdx = Math.max(0, Math.floor(dataTop / ROW_HEIGHT) - OVERSCAN);
    const endIdx = Math.min(sortedData.length, Math.ceil(dataBottom / ROW_HEIGHT) + OVERSCAN);
    const result = [];
    for (let i = startIdx; i < endIdx; i++) {
      result.push({ index: i, row: sortedData[i] });
    }
    return result;
  }, [scrollTop, containerClientH, STICKY_H, ROW_HEIGHT, sortedData, OVERSCAN]);

  // DataTableRow に渡す共通データ（rows キーなし）
  const itemData = useMemo(() => ({
    tableHeaders,
    calcMap,
    fieldMap,
    theme,
    groupByFields,
    columnWidths,
    totalWidth,
    stickyColumns: localStickyColumns,
    stickyLeftPositions,
    selectedRowIndex,
    columnColors,
    colorVersion,
    onRowClick: handleRowClick,
    isHierarchyMode,
    collapsedGroups,
    onToggleGroup: toggleGroup,
    groupAnimActive,
    fontSize: dataFontSize,
    dataRowHeight: tableConfig.dataRowHeight || null,
  }), [tableHeaders, calcMap, fieldMap, theme, groupByFields, columnWidths, totalWidth, localStickyColumns, stickyLeftPositions, selectedRowIndex, columnColors, colorVersion, handleRowClick, isHierarchyMode, collapsedGroups, toggleGroup, groupAnimActive, dataFontSize, tableConfig.dataRowHeight]);

  // スティッキーエリアの背景色
  const stickyBg = theme === 'dark' ? '#0f172a' : '#f3f4f6';

  // === JSX ===
  return (
    <>
    <div
      className={`rounded-lg overflow-hidden flex flex-col max-h-[70vh] md:max-h-none ${glassClass} ${widthClass}`}
      style={{ height: tableHeight }}
    >
      <style>{`
        @keyframes grpSlideIn {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes grpCollapseIn {
          from { opacity: 0.5; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <DataTableToolbar
        tableConfig={tableConfig}
        theme={theme}
        safeAggregationConfigs={safeAggregationConfigs}
        selectedAggConfigId={selectedAggConfigId}
        setSelectedAggConfigId={setSelectedAggConfigId}
        additionalSegments={additionalSegments}
        systemFields={systemFields}
        availableSegmentFields={availableSegmentFields}
        onAddSegment={handleAddSegment}
        onRemoveSegment={handleRemoveSegment}
        dataCount={sortedData.length}
        onExportCSV={exportToCSV}
        isHierarchyMode={isHierarchyMode}
        allCollapsed={allCollapsed}
        onCollapseAll={collapseAll}
        onExpandAll={expandAll}
        uniqueEmployees={uniqueEmployees}
        visibleEmployeeIds={tableConfig?.visibleEmployeeIds}
        onVisibleEmployeeIdsChange={(ids) => onVisibleEmployeeIdsChange?.(tableConfig.id, ids)}
        hasMainKey={!!mainKeyFieldId}
        isEditMode={isEditMode}
        onToggleEditMode={() => setIsEditMode(v => !v)}
        onEditSave={handleEditSave}
        onEditCancel={handleEditCancel}
        isDirty={pendingCalcUpdates.size > 0 || pendingTableSettings !== null}
        onTableNameClick={handleTableNameClick}
        onAddCalc={handleAddCalc}
      />

      {/* 単一スクロールコンテナ: ヘッダー・合計行・データ行を1つのスクロールコンテナで管理 */}
      <div
        ref={containerRef}
        className="flex-1"
        style={{ overflowX: 'auto', overflowY: 'auto' }}
        onScroll={handleContainerScroll}
      >
        {/* スティッキーヘッダー + 合計行 */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 3,
            minWidth: totalWidth,
            background: stickyBg,
          }}
        >
          <div className="flex" style={{ minWidth: totalWidth }}>
            {tableHeaders.map((col, colIndex) => {
              const colWidth = columnWidths[colIndex] || 120;
              const isSticky = colIndex < localStickyColumns;
              const stickyStyle = isSticky ? {
                position: 'sticky',
                left: stickyLeftPositions[colIndex],
                zIndex: 2,
              } : { position: 'relative', zIndex: 0 };

              return (
                <DataTableColumnHeader
                  key={col.id}
                  col={col}
                  colIndex={colIndex}
                  colWidth={colWidth}
                  isSticky={isSticky}
                  stickyStyle={stickyStyle}
                  theme={theme}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  columnColors={columnColors}
                  columnAliases={columnAliases}
                  isViewer={isViewer}
                  onToggleIndicatorGroup={col._isGroup ? toggleIndicatorGroup : undefined}
                  isExpandedGroup={col._isGroup ? expandedIndicatorGroups.has(col.id) : false}
                  formulaInfo={getFormulaInfo ? getFormulaInfo(col.id) : null}
                  onColumnWidthStart={handleColumnWidthStart}
                  isDraggingResize={draggingColId === col.id}
                  fontSize={headerFontSize}
                  rowHeight={headerRowHeight}
                  isEditMode={isEditMode}
                  onEditModeClick={handleColumnEditClick}
                />
              );
            })}
          </div>
          {/* 合計行 */}
          <DataTableSummaryRow
            tableHeaders={tableHeaders}
            summaryRow={summaryRow}
            columnWidths={columnWidths}
            stickyColumns={localStickyColumns}
            stickyLeftPositions={stickyLeftPositions}
            calcMap={calcMap}
            fieldMap={fieldMap}
            totalWidth={totalWidth}
            theme={theme}
            fontSize={summaryFontSize}
            summaryRowHeight={summaryRowHeight}
          />
        </div>

        {/* 仮想スクロールデータエリア: 全行分の高さを確保し、可視行のみ absolute で描画 */}
        <div
          style={{
            position: 'relative',
            height: sortedData.length * ROW_HEIGHT,
            minWidth: totalWidth,
          }}
        >
          {visibleRows.map(({ index }) => (
            <div
              key={index}
              style={{
                position: 'absolute',
                top: index * ROW_HEIGHT,
                left: 0,
                right: 0,
                height: ROW_HEIGHT,
              }}
            >
              <DataTableRow
                index={index}
                style={{ height: '100%', width: '100%' }}
                data={{ ...itemData, row: sortedData[index] }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* テーブル設定ポップアップ */}
    {tableSettingsPopup.open && (
      <DataTableSettingsPopup
        open={tableSettingsPopup.open}
        anchorRef={tableSettingsPopup.anchorRef}
        tableConfig={tableConfig}
        aggregationConfigs={safeAggregationConfigs}
        theme={theme}
        onChange={handleTableSettingsUpdate}
        onSave={handleTableSettingsSave}
        onDelete={handleTableSettingsDelete}
        onClose={handleTableSettingsClose}
      />
    )}

    {/* 列編集ポップアップ（Portal でレンダリング） */}
    {columnEditPopup.open && (() => {
      // 新規作成モード
      if (columnEditPopup.colId === '__new__') {
        const newCol = { id: '__new__', label: '新規指標', type: 'number' };
        return (
          <DataTableColumnEditPopup
            open={columnEditPopup.open}
            anchorRef={columnEditPopup.anchorRef}
            col={newCol}
            calc={null}
            systemFields={systemFields}
            dataSources={dataSources}
            aggregationConfigs={safeAggregationConfigs}
            allCalcs={effectiveCalculations}
            theme={theme}
            isEditMode={true}
            onCalcChange={() => {}}
            onCalcSave={handleColumnEditSave}
            onCalcDelete={null}
            onClose={handleColumnEditClose}
          />
        );
      }
      // 既存列の編集モード（anchorRef が必要）
      if (!columnEditPopup.anchorRef) return null;
      const col = tableHeaders.find(h => h.id === columnEditPopup.colId);
      const calcItem = effectiveCalculations.find(c => c.id === columnEditPopup.colId) || null;
      if (!col) return null;
      return (
        <DataTableColumnEditPopup
          open={columnEditPopup.open}
          anchorRef={columnEditPopup.anchorRef}
          col={col}
          calc={calcItem}
          systemFields={systemFields}
          dataSources={dataSources}
          aggregationConfigs={safeAggregationConfigs}
          allCalcs={effectiveCalculations}
          theme={theme}
          isEditMode={isEditMode}
          onCalcChange={handleCalcUpdate}
          onCalcSave={handleColumnEditSave}
          onCalcDelete={handleColumnEditDelete}
          onClose={handleColumnEditClose}
          columnAliases={columnAliases}
          columnColors={columnColors}
          onAliasChange={handleColumnAliasChange}
          onColorChange={handleColumnColorChange}
        />
      );
    })()}
    </>
  );
});

export default DataTable;
