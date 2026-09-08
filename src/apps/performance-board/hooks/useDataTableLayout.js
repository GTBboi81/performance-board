// src/apps/performance-board/hooks/useDataTableLayout.js
// DataTable用レイアウト計算フック

import { useMemo, useState, useEffect } from 'react';
import { HEIGHT_UNITS } from '../../../constants';
import { getTextWidth, formatValueForWidth, formatIndicatorGroupFormulaValue } from '../utils/dataTableUtils';
import { resolveDataTableDensity } from '../utils/dataTableHeaderLayout';

/**
 * DataTable用のレイアウト計算フック
 * @param {object} options
 * @param {object} options.tableConfig - テーブル設定
 * @param {array} options.systemFields - システムフィールド
 * @param {array} options.calculations - 計算設定
 * @param {array} options.groupByFields - グループ化フィールド
 * @param {array} options.additionalSegments - 追加セグメント
 * @param {array} options.stringFields - 文字列フィールド
 * @param {object} options.currentAggConfig - 現在の集計設定
 * @param {boolean} options.isSourceExpandMode - ソース展開モード
 * @param {object} options.sourceExpand - ソース展開設定
 * @param {array} options.dataSources - データソース設定
 * @param {array} options.sortedData - ソート済みデータ
 * @param {Map} options.calcMap - 計算設定Map
 * @param {Map} options.fieldMap - フィールド設定Map
 * @returns {object} レイアウト関連の計算結果
 */
export const useDataTableLayout = ({
  tableConfig,
  systemFields = [],
  calculations = [],
  groupByFields = [],
  additionalSegments = [],
  stringFields = [],
  currentAggConfig,
  isSourceExpandMode = false,
  sourceExpand,
  dataSources = [],
  sortedData = [],
  calcMap,
  fieldMap,
  indicatorGroups = [],
  expandedIndicatorGroups = new Set(),
  columnAliases = {},
}) => {
  // テーブルヘッダーを生成（グループ適用前のベース）
  const baseTableHeaders = useMemo(() => {
    // ピボットモードの場合
    if (currentAggConfig?.pivotEnabled && currentAggConfig?.pivotSourceId) {
      const periodLabel = currentAggConfig.pivotGranularity === 'year' ? '年' : '月';
      const periodHeader = { id: '_period', label: periodLabel, type: 'string' };
      const baseCountHeader = { id: '_count', label: '件数', type: 'number' };

      const pivotCountHeaders = (currentAggConfig.pivotCountColumns || []).map(col => ({
        id: col.id,
        label: col.label,
        type: 'number'
      }));

      const tableFieldIds = tableConfig.fields || [];
      const calcHeaders = calculations
        .filter(calc => tableFieldIds.includes(calc.id))
        .map(calc => ({
          id: calc.id,
          label: calc.label,
          type: 'number'
        }));

      return [periodHeader, baseCountHeader, ...pivotCountHeaders, ...calcHeaders];
    }

    // 指標グループもフィールド候補に含める（グループIDがtableConfig.fieldsに入るため）
    const groupFields = (indicatorGroups || []).map(g => ({ id: g.id, label: g.label, type: 'number' }));
    const allPotentialFields = [...systemFields, ...calculations, ...groupFields];
    const tableFieldIds = tableConfig.fields || [];

    // セグメント追加時に非表示にする文字列フィールドを特定
    const stringFieldIdsToHide = additionalSegments.length > 0
      ? stringFields
        .map(f => f.id)
        .filter(id => !groupByFields.includes(id))
      : [];

    // ソース参照展開モードの場合
    if (isSourceExpandMode && sourceExpand) {
      const sourceConfig = dataSources.find(s => s.id === sourceExpand.sourceId);
      const headers = sourceConfig?.headers || [];
      const expandColIdx = parseInt(sourceExpand.expandColumnIndex);
      const expandLabel = headers[expandColIdx] || '展開カラム';

      const expandField = { id: '_expandValue', label: expandLabel, type: 'string' };
      const countField = { id: '_count', label: '件数', type: 'number' };

      let valueField = null;
      if (sourceExpand.valueColumnIndex !== undefined && sourceExpand.valueColumnIndex !== '') {
        const valueColIdx = parseInt(sourceExpand.valueColumnIndex);
        const valueLabel = headers[valueColIdx] || '値';
        valueField = { id: '_expandNumericValue', label: valueLabel, type: 'number' };
      }

      const extendedFields = valueField
        ? [...allPotentialFields, expandField, countField, valueField]
        : [...allPotentialFields, expandField, countField];

      const extendedTableFieldIds = [...tableFieldIds, '_expandValue', '_count', '_expandNumericValue'];

      if (groupByFields.length > 0) {
        const keyCols = groupByFields.map(fieldId => {
          if (fieldId === '_expandValue') return expandField;
          const label = systemFields.find(f => f.id === fieldId)?.label || fieldId;
          return { id: fieldId, label };
        });

        const otherFieldIds = extendedTableFieldIds.filter(id =>
          !groupByFields.includes(id) && !stringFieldIdsToHide.includes(id)
        );
        const otherCols = otherFieldIds.map(id => extendedFields.find(f => f.id === id)).filter(Boolean);

        return [...keyCols, ...otherCols];
      } else {
        return extendedTableFieldIds.map(id => extendedFields.find(f => f.id === id)).filter(Boolean);
      }
    }

    // 通常モード
    if (groupByFields.length > 0) {
      // 階層モード: hierarchyFieldsはグループヘッダーで表示するのでカラムから除外
      const hierarchyFieldIds = currentAggConfig?.hierarchyEnabled
        ? new Set(currentAggConfig.hierarchyFields || [])
        : new Set();

      const keyCols = groupByFields
        .filter(fieldId => !hierarchyFieldIds.has(fieldId))
        .map(fieldId => {
          const label = systemFields.find(f => f.id === fieldId)?.label || fieldId;
          return { id: fieldId, label };
        });

      const otherFieldIds = tableFieldIds.filter(id =>
        !groupByFields.includes(id) && !stringFieldIdsToHide.includes(id)
      );
      const otherCols = otherFieldIds.map(id => allPotentialFields.find(f => f.id === id)).filter(Boolean);

      return [...keyCols, ...otherCols];
    } else {
      return tableFieldIds.map(id => allPotentialFields.find(f => f.id === id)).filter(Boolean);
    }
  }, [groupByFields, systemFields, calculations, isSourceExpandMode, sourceExpand, dataSources, tableConfig.fields, additionalSegments, stringFields, currentAggConfig, indicatorGroups]);

  // 指標グループの適用:
  // - グループIDがbaseTableHeadersにある場合 → グループカラム + メンバー展開
  // - メンバーIDが個別にbaseTableHeadersにある場合 → 自動的にグループ化
  const tableHeaders = useMemo(() => {
    if (!indicatorGroups || indicatorGroups.length === 0) return baseTableHeaders;

    // グループIDマップとメンバー→グループマップを構築
    const groupMap = new Map();
    const memberToGroup = new Map();
    indicatorGroups.forEach(group => {
      if (group.memberCalcIds && group.memberCalcIds.length > 0) {
        groupMap.set(group.id, group);
        group.memberCalcIds.forEach(calcId => {
          memberToGroup.set(calcId, group);
        });
      }
    });

    if (groupMap.size === 0 && memberToGroup.size === 0) return baseTableHeaders;

    const result = [];
    const insertedGroups = new Set();

    for (const header of baseTableHeaders) {
      // ケース1: ヘッダーがグループID → グループカラムとメンバーに展開
      const groupById = groupMap.get(header.id);
      if (groupById) {
        if (!insertedGroups.has(groupById.id)) {
          insertedGroups.add(groupById.id);
          result.push({
            id: groupById.id,
            label: groupById.label,
            type: 'number',
            _isGroup: true,
            _memberCalcIds: groupById.memberCalcIds,
            _aggregation: groupById.aggregation || 'sum',
            _totalCalcId: groupById.totalCalcId || '',
            _formula: groupById.formula || null,
            _showPercent: groupById.showPercent || false,
            _unit: groupById.unit || '',
          });
          // 展開中ならメンバーカラムも追加
          if (expandedIndicatorGroups.has(groupById.id)) {
            const validMembers = groupById.memberCalcIds.filter(mid => calculations.some(c => c.id === mid));
            const memberTotal = validMembers.length;
            validMembers.forEach((memberId, memberIdx) => {
              const memberCalc = calculations.find(c => c.id === memberId);
              if (memberCalc) {
                result.push({
                  id: memberCalc.id,
                  label: memberCalc.label,
                  type: 'number',
                  _groupMemberOf: groupById.id,
                  _memberIndex: memberIdx,
                  _memberTotal: memberTotal,
                  _showPercent: groupById.showPercent || false,
                  _memberCalcIds: groupById.memberCalcIds,
                });
              }
            });
          }
        }
        continue;
      }

      // ケース2: ヘッダーがグループのメンバー（個別選択されている場合）
      const groupByMember = memberToGroup.get(header.id);
      if (groupByMember) {
        if (!insertedGroups.has(groupByMember.id)) {
          insertedGroups.add(groupByMember.id);
          // baseTableHeadersに含まれるメンバーだけを対象
          const presentMemberIds = groupByMember.memberCalcIds.filter(mid =>
            baseTableHeaders.some(h => h.id === mid)
          );
          result.push({
            id: groupByMember.id,
            label: groupByMember.label,
            type: 'number',
            _isGroup: true,
            _memberCalcIds: presentMemberIds,
            _aggregation: groupByMember.aggregation || 'sum',
            _totalCalcId: groupByMember.totalCalcId || '',
            _formula: groupByMember.formula || null,
            _showPercent: groupByMember.showPercent || false,
            _unit: groupByMember.unit || '',
          });
        }
        // 展開中ならメンバーカラムも追加
        if (expandedIndicatorGroups.has(groupByMember.id)) {
          const presentMemberIdsForIdx = groupByMember.memberCalcIds.filter(mid =>
            baseTableHeaders.some(h => h.id === mid)
          );
          const memberIdx = presentMemberIdsForIdx.indexOf(header.id);
          result.push({ ...header, _groupMemberOf: groupByMember.id, _memberIndex: memberIdx >= 0 ? memberIdx : 0, _memberTotal: presentMemberIdsForIdx.length, _showPercent: groupByMember.showPercent || false, _memberCalcIds: presentMemberIdsForIdx });
        }
        continue;
      }

      // ケース3: グループに属さない通常ヘッダー
      result.push(header);
    }

    return result;
  }, [baseTableHeaders, indicatorGroups, expandedIndicatorGroups, calculations]);

  // モバイル判定（768px未満）
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 列幅の計算
  const columnWidths = useMemo(() => {
    const MIN_WIDTH = isMobile ? 60 : 80;
    const MAX_WIDTH = isMobile ? 200 : 400;
    const CHAR_WIDTH = isMobile ? 6 : 8;
    const PADDING = isMobile ? 12 : 24;

    const isHierarchy = currentAggConfig?.hierarchyEnabled && currentAggConfig?.hierarchyFields?.length > 0;

    return tableHeaders.map((col, colIdx) => {
      // エイリアスがあればその文字幅でヘッダー幅を計算
      const headerLabel = columnAliases[col.id] || col.label || '';
      const headerTextWidth = getTextWidth(headerLabel);
      const headerUiExtra = 16 + (col._isGroup ? 24 : 0);
      const headerWidth = headerTextWidth * CHAR_WIDTH + PADDING + headerUiExtra;

      const sampleData = sortedData.slice(0, 100);
      let maxDataWidth = 0;
      sampleData.forEach(row => {
        // 階層モードの最初のカラム: グループ行のラベル幅も考慮
        if (colIdx === 0 && isHierarchy && row._rowType === 'group') {
          const indentChars = (row._level || 0) * 20 / CHAR_WIDTH;
          const labelText = `${row._label} (${row._childCount})`;
          const labelWidth = (getTextWidth(labelText) + indentChars) * CHAR_WIDTH + PADDING + 28;
          if (labelWidth > maxDataWidth) maxDataWidth = labelWidth;
          return;
        }
        // グループカラムの場合、メンバー値の合算から幅を計算
        let cellVal = row[col.id];
        if (col._isGroup && (cellVal === undefined || cellVal === null)) {
          cellVal = (col._memberCalcIds || []).reduce((sum, mid) =>
            sum + (typeof row[mid] === 'number' ? row[mid] : (parseFloat(row[mid]) || 0)), 0);
        }
        const displayVal = formatIndicatorGroupFormulaValue(cellVal, col)
          ?? formatValueForWidth(cellVal, col.id, calcMap, fieldMap);
        const textWidth = getTextWidth(displayVal);
        let width = textWidth * CHAR_WIDTH + PADDING;
        // パーセント表示ありのメンバーカラム: "100.0%" 6文字 + スペーサー最低幅 + 右余白
        if (col._groupMemberOf && col._showPercent) {
          width += 6 * CHAR_WIDTH + 8;
        }
        if (width > maxDataWidth) maxDataWidth = width;
      });

      const calculatedWidth = Math.max(headerWidth, maxDataWidth);
      const autoWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, calculatedWidth));
      // 手動設定優先
      const manualWidth = tableConfig.columnWidths?.[col.id];
      return manualWidth ? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, manualWidth)) : autoWidth;
    });
  }, [tableHeaders, sortedData, calcMap, fieldMap, isMobile, columnAliases, tableConfig.columnWidths]);

  // 全体の幅を計算
  const totalWidth = useMemo(() => {
    return columnWidths.reduce((sum, w) => sum + w, 0);
  }, [columnWidths]);

  // テーブルの高さ設定
  const tableHeight = useMemo(() => {
    // maxHeight: tableConfig.maxHeight (px数値) または旧フォーマットからのフォールバック
    const legacyHeightMap = { small: 350, medium: 500, large: 700 };
    let maxH = tableConfig.maxHeight
      || (tableConfig.height && HEIGHT_UNITS[tableConfig.height])
      || (tableConfig.size && legacyHeightMap[tableConfig.size])
      || 600;

    // 各行タイプのフォントサイズ・行高さ（個別設定 > 自動算出。resolveDataTableDensity に統一）
    const { headerRowHeight: HEADER_HEIGHT, summaryRowHeight: SUMMARY_HEIGHT, dataRowHeight: rowH } =
      resolveDataTableDensity(tableConfig);

    const TOOLBAR_HEIGHT = 34;

    const rowCount = sortedData ? sortedData.length : 0;
    // 単一スクロールコンテナ化により横スクロールバーがコンテナ内部の高さを消費する分のバッファ
    const SCROLLBAR_H = 17;
    const contentH = rowCount * rowH + TOOLBAR_HEIGHT + HEADER_HEIGHT + SUMMARY_HEIGHT + SCROLLBAR_H + 4;
    return `${Math.min(contentH, maxH)}px`;
  }, [tableConfig, sortedData]);

  // テーブルの横幅クラス
  const widthClass = useMemo(() => {
    const widthClasses = {
      full: 'w-full',
      twoThird: 'w-full lg:w-[calc(66.666%-5.33px)]',
      half: 'w-full lg:w-[calc(50%-8px)]',
      third: 'w-full md:w-[calc(50%-8px)] lg:w-[calc(33.333%-10.67px)]',
    };
    return widthClasses[tableConfig.width] || 'w-full';
  }, [tableConfig.width]);

  return {
    tableHeaders,
    columnWidths,
    totalWidth,
    tableHeight,
    widthClass,
  };
};

export default useDataTableLayout;
