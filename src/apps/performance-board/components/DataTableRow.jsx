// src/apps/performance-board/components/DataTableRow.jsx
// 仮想スクロール用のメモ化されたテーブル行コンポーネント

import React from 'react';
import { PRESET_COLORS, CONDITIONAL_FORMAT_COLORS, CONDITIONAL_FORMAT_WEIGHTS } from '../../../constants';
import { evaluateConditionalRules, formatIndicatorGroupFormulaValue } from '../utils/dataTableUtils';

const DataTableRow = React.memo(({
  data,
  index,
  style
}) => {
  const {
    row,
    tableHeaders,
    calcMap,
    fieldMap,
    theme,
    groupByFields,
    columnWidths,
    totalWidth,
    stickyColumns,
    stickyLeftPositions,
    selectedRowIndex,
    columnColors,
    onRowClick,
    isHierarchyMode,
    collapsedGroups,
    onToggleGroup,
    groupAnimActive,
    fontSize = 12,
    dataRowHeight = null,
  } = data;

  if (!row) return null;

  const isGroupRow = isHierarchyMode && row._rowType === 'group';
  const isDataRow = isHierarchyMode && row._rowType === 'data';
  const isCollapsed = isGroupRow && collapsedGroups?.has(row._groupKey);
  const isSelected = selectedRowIndex === index;

  // 固定カラムがある場合は縞々なしで統一背景色
  const rowBgClass = stickyColumns > 0
    ? (isSelected
      ? (theme === 'dark' ? 'bg-indigo-500/20' : 'bg-indigo-100')
      : (theme === 'dark' ? 'bg-[#0f172a]' : 'bg-white'))
    : '';

  // グループ行の背景色（ボード既存テーマに合わせた控えめなスタイル）
  const getGroupRowBg = () => {
    if (!isGroupRow) return '';
    const level = row._level || 0;
    if (theme === 'dark') {
      return level === 0 ? 'bg-[#192033]' : 'bg-[#141c2e]';
    }
    return level === 0 ? 'bg-gray-100' : 'bg-gray-50';
  };
  const groupBgClass = getGroupRowBg();

  // グループ行のボーダー（上: level 0のみ、下: 全グループ行）
  const groupBorderClass = isGroupRow
    ? [
        (row._level || 0) === 0 ? (theme === 'dark' ? 'border-t border-t-white/10' : 'border-t border-t-gray-200') : '',
        theme === 'dark' ? 'border-b border-b-white/[0.06]' : 'border-b border-b-gray-200/60',
      ].filter(Boolean).join(' ')
    : '';

  // 行全体の背景色
  const rowContainerBgClass = isGroupRow
    ? groupBgClass
    : stickyColumns > 0
      ? ''
      : isSelected
        ? (theme === 'dark' ? 'bg-indigo-500/20' : 'bg-indigo-100')
        : (index % 2 === 0 ? '' : (theme === 'dark' ? 'bg-white/[0.02]' : 'bg-gray-50/50'));

  const handleClick = () => {
    if (isGroupRow && onToggleGroup) {
      onToggleGroup(row._groupKey);
    } else {
      onRowClick(index);
    }
  };

  return (
    <div
      style={{ ...style, minWidth: totalWidth }}
      className={`flex items-center text-sm cursor-pointer ${theme === 'dark' ? 'text-white hover:bg-white/5' : 'text-gray-800 hover:bg-gray-50'} ${rowContainerBgClass} ${groupBorderClass}`}
      onClick={handleClick}
    >
      {tableHeaders.map((col, colIndex) => {
        // グループカラムも通常カラムも row[col.id] を使う（enrichedData で全グループ合計値を注入済み）
        const isGroupCol = col._isGroup;
        const val = row[col.id];
        let displayVal = val;
        const calc = isGroupCol ? null : calcMap.get(col.id);
        const sysField = fieldMap.get(col.id);
        const groupFormulaDisplay = formatIndicatorGroupFormulaValue(val, col);

        // グループ行の最初のカラム: 展開/折りたたみアイコン + ラベル
        const isFirstCol = colIndex === 0;
        const showGroupLabel = isGroupRow && isFirstCol;

        if (!showGroupLabel) {
          if (typeof val === 'number') {
            if (groupFormulaDisplay !== null) {
              displayVal = groupFormulaDisplay;
            } else if (calc && calc.format === 'percent') {
              const decimals = calc.decimals ?? 2;
              displayVal = val.toFixed(decimals) + '%';
            } else if (calc && (calc.format === 'number') && typeof calc.decimals === 'number') {
              displayVal = val.toLocaleString(undefined, { minimumFractionDigits: calc.decimals, maximumFractionDigits: calc.decimals });
            } else if (sysField && typeof sysField.decimals === 'number' && sysField.decimals > 0) {
              displayVal = val.toLocaleString(undefined, { minimumFractionDigits: sysField.decimals, maximumFractionDigits: sysField.decimals });
            } else if (isGroupCol && col._aggregation === 'average') {
              displayVal = val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
            }
            else displayVal = val.toLocaleString();
          }
          // グループカラムの単位表示（formula + % の場合は100倍してフォーマット）
          if (isGroupCol && col._unit && groupFormulaDisplay === null) {
            if (col._aggregation === 'formula' && col._unit === '%' && typeof val === 'number') {
              displayVal = (val * 100).toFixed(2) + '%';
            } else if (displayVal !== '\u00A0') {
              displayVal = displayVal + col._unit;
            }
          }
        }

        // 空白値の場合はノーブレークスペースを表示して高さを維持
        if (!showGroupLabel && (displayVal === '' || displayVal === null || displayVal === undefined)) {
          displayVal = '\u00A0';
        }

        // 条件付き書式の評価
        const field = sysField || calc;
        const conditionalRule = (!isGroupRow && field?.conditionalRules)
          ? evaluateConditionalRules(val, field.conditionalRules, calc?.format)
          : null;
        const condColorClass = conditionalRule
          ? (CONDITIONAL_FORMAT_COLORS.find(c => c.id === conditionalRule.color)?.[theme === 'dark' ? 'dark' : 'light'] || '')
          : '';
        const condWeightClass = conditionalRule
          ? (CONDITIONAL_FORMAT_WEIGHTS.find(w => w.id === conditionalRule.fontWeight)?.class || '')
          : '';

        const isKeyColumn = groupByFields.includes(col.id);
        const colWidth = columnWidths[colIndex] || 120;
        const isSticky = colIndex < stickyColumns;
        const stickyStyle = isSticky ? {
          position: 'sticky',
          left: stickyLeftPositions[colIndex],
          zIndex: 2,
        } : { position: 'relative', zIndex: 0 };

        // カラム色を取得
        const colColorId = columnColors[col.id];
        const colColor = colColorId ? PRESET_COLORS.find(c => c.id === colColorId) : null;
        const colorClass = isGroupRow ? '' : (conditionalRule ? condColorClass : (colColor ? (theme === 'dark' ? colColor.dark : colColor.light) : ''));
        // 列カラーのセル背景は廃止（ダークで濃すぎて数値が読みにくいため）。
        // 色はヘッダー下の3pxラインと文字色（colorClass）で表現する。
        // sticky セルは常にインラインで不透明な背景を指定（overflow:scroll内でCSSスティッキーが機能するよう、背景抜けを防止）
        const stickyBg = isSticky && !isGroupRow
          ? (isSelected
            ? {
                background: theme === 'dark'
                  ? 'linear-gradient(rgba(99,102,241,0.20),rgba(99,102,241,0.20)),#0f172a'
                  : 'linear-gradient(rgba(99,102,241,0.10),rgba(99,102,241,0.10)),#ffffff',
              }
            : { backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff' })
          : {};
        const stickySelectedBg = stickyBg; // 後方互換のために変数名を維持
        const cellBgClass = isGroupRow
          ? groupBgClass
          : isSticky
            ? '' // sticky はインラインスタイル(stickyBg)で背景管理
            : isSelected
              ? (theme === 'dark' ? 'bg-indigo-500/20' : 'bg-indigo-100')
              : rowBgClass;

        // 縦の列区切り。横の行区切りは edgeShadow で別に描画する。
        const borderClass = theme === 'dark' ? 'border-white/5' : 'border-gray-100';
        const rightBorderClass = 'border-r';
        const isMemberCol = !!col._groupMemberOf;

        // メンバーカラムの割合(%)計算
        let percentDisplay = null;
        if (isMemberCol && col._showPercent && typeof val === 'number' && val !== 0 && !isGroupRow) {
          const groupTotal = (col._memberCalcIds || []).reduce((sum, memberId) => sum + (typeof row[memberId] === 'number' ? row[memberId] : (parseFloat(row[memberId]) || 0)), 0);
          if (groupTotal !== 0) {
            percentDisplay = ((val / groupTotal) * 100).toFixed(1) + '%';
          }
        }

        // グループ外枠: 先頭メンバーは左、末尾メンバーは右を太く
        // メンバーカラム: 背景暗め + アニメーション（左右ボーダーは通常）
        const memberAnimStyle = isMemberCol && groupAnimActive ? { animation: `grpSlideIn 0.25s ease-out ${(col._memberIndex || 0) * 0.04}s both` } : {};
        const memberBgClass = isMemberCol && !isGroupRow ? (theme === 'dark' ? 'bg-white/[0.03]' : 'bg-gray-100/80') : '';
        // sticky セルが行コンテナの装飾を覆うため、選択辺と通常の行区切りは全セルの内側に描画する。
        // inset shadow はセルの描画領域を消費せず、選択切替でも行高が変わらない。
        const selEdgeColor = theme === 'dark' ? 'rgba(129,140,248,0.85)' : 'rgb(99,102,241)';
        const sepColor = theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
        const edgeShadow = isSelected
          ? `inset 0 1px 0 0 ${selEdgeColor}, inset 0 -1px 0 0 ${selEdgeColor}`
          : (isGroupRow ? '' : `inset 0 -1px 0 0 ${sepColor}`);

        const rowEdgeStyle = edgeShadow ? { boxShadow: edgeShadow } : {};

        // 数値セル判定（グループ行でない場合のみ）
        const isNumericCell = !isGroupRow && (typeof row[col.id] === 'number');

        // 階層インデント
        const indent = isHierarchyMode
          ? (isGroupRow ? row._level * 20 : (row._level || 0) * 20)
          : 0;

        // グループ行テキストスタイル
        const groupTextClass = isGroupRow
          ? (theme === 'dark' ? 'font-semibold text-white/90' : 'font-semibold text-gray-700')
          : '';

        // dataRowHeight 指定時: パディングをインラインで計算してCSS py-1.5 との競合を解消
        const vertPad = dataRowHeight ? Math.max(2, Math.round((dataRowHeight - fontSize - 4) / 2)) : null;

        return (
          <div
            key={col.id}
            style={{ width: colWidth, minWidth: colWidth, height: '100%', fontSize: `${fontSize}px`, ...(vertPad !== null ? { paddingTop: vertPad, paddingBottom: vertPad } : {}), ...stickyStyle, ...stickySelectedBg, ...rowEdgeStyle, ...memberAnimStyle }}
            className={`px-1.5 ${dataRowHeight ? '' : 'py-1 md:py-1.5'} md:px-2 text-[11px] md:text-xs whitespace-nowrap overflow-hidden text-ellipsis flex items-center ${rightBorderClass} ${borderClass} ${groupTextClass} ${isKeyColumn && !isGroupRow ? 'font-bold text-indigo-400' : ''} ${colorClass} ${memberBgClass || cellBgClass} ${isNumericCell ? 'font-mono tabular-nums justify-end' : ''}`}
          >
            {showGroupLabel ? (
              <div className="flex items-center gap-1.5 overflow-hidden" style={{ paddingLeft: indent }}>
                <span className={`flex-shrink-0 text-xs select-none ${theme === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>
                  {isCollapsed ? '▶' : '▼'}
                </span>
                <span className="truncate">{row._label}</span>
                <span className={`ml-0.5 text-[10px] flex-shrink-0 ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>
                  ({row._childCount})
                </span>
              </div>
            ) : (isMemberCol && col._showPercent && !isGroupRow) ? (
              <span style={{ paddingLeft: isFirstCol && isDataRow ? indent : undefined, fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'baseline', width: '100%' }} className={condWeightClass || undefined}>
                <span style={{ flexShrink: 0 }}>{displayVal}</span>
                <span style={{ flex: '1 0 0.5em' }} />
                <span style={{ flexShrink: 0 }} className={`text-xs ${percentDisplay ? (theme === 'dark' ? 'text-white/40' : 'text-gray-400') : ''}`}>{percentDisplay || ''}</span>
              </span>
            ) : (
              <span style={isFirstCol && isDataRow ? { paddingLeft: indent } : undefined} className={condWeightClass || undefined}>
                {displayVal}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}, (prevProps, nextProps) => {
  const prevData = prevProps.data;
  const nextData = nextProps.data;

  // テーマ変更
  if (prevData.theme !== nextData.theme) return false;
  // 行データ変更
  if (prevData.row !== nextData.row) return false;
  // 選択状態（この行だけ）
  const prevIsSelected = prevData.selectedRowIndex === prevProps.index;
  const nextIsSelected = nextData.selectedRowIndex === nextProps.index;
  if (prevIsSelected !== nextIsSelected) return false;
  // 垂直スクロール位置
  if (prevProps.style.top !== nextProps.style.top) return false;
  // カラム色バージョン
  if (prevData.colorVersion !== nextData.colorVersion) return false;
  // 条件付き書式ルール
  if (prevData.fieldMap !== nextData.fieldMap) return false;
  if (prevData.calcMap !== nextData.calcMap) return false;
  // ヘッダー定義（グループ展開/折りたたみで変わる）
  if (prevData.tableHeaders !== nextData.tableHeaders) return false;
  // グループアニメーション
  if (prevData.groupAnimActive !== nextData.groupAnimActive) return false;
  // グループ化フィールド（キー列ハイライトに影響）
  if (prevData.groupByFields !== nextData.groupByFields) return false;
  // 階層モード切替（行レイアウト全体に影響）
  if (prevData.isHierarchyMode !== nextData.isHierarchyMode) return false;
  // 列幅（ドラッグリサイズ・設定変更で変わる）
  if (prevData.columnWidths !== nextData.columnWidths) return false;
  // 全体幅（列追加/削除で変わる）
  if (prevData.totalWidth !== nextData.totalWidth) return false;
  // 固定カラム数（設定変更で変わる）
  if (prevData.stickyColumns !== nextData.stickyColumns) return false;
  // 固定カラムの左位置（stickyColumns変更で変わる）
  if (prevData.stickyLeftPositions !== nextData.stickyLeftPositions) return false;
  // データ行フォントサイズ（設定変更で変わる）
  if (prevData.fontSize !== nextData.fontSize) return false; // itemData の key は fontSize (= dataFontSize)
  // データ行高さ（設定変更で変わる）
  if (prevData.dataRowHeight !== nextData.dataRowHeight) return false;
  // 階層モードの折りたたみ状態
  if (prevData.isHierarchyMode && prevData.row?._rowType === 'group') {
    const prevCollapsed = prevData.collapsedGroups?.has(prevData.row._groupKey);
    const nextCollapsed = nextData.collapsedGroups?.has(nextData.row._groupKey);
    if (prevCollapsed !== nextCollapsed) return false;
  }

  return true;
});

DataTableRow.displayName = 'DataTableRow';

export default DataTableRow;
