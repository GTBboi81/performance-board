// src/apps/performance-board/components/DataTableSummaryRow.jsx
// データテーブルの合計行

import React from 'react';
import { formatIndicatorGroupFormulaValue } from '../utils/dataTableUtils';

const DataTableSummaryRow = ({
  tableHeaders,
  summaryRow,
  columnWidths,
  stickyColumns,
  stickyLeftPositions,
  calcMap,
  fieldMap,
  totalWidth,
  theme = 'dark',
  fontSize = 12,
  summaryRowHeight = null,
}) => {
  if (!summaryRow) return null;

  // summaryRowHeight 指定時: 動的padding計算（DataTableRow/ColumnHeaderと同方式）
  const vertPad = summaryRowHeight ? Math.max(2, Math.round((summaryRowHeight - fontSize - 4) / 2)) : null;

  return (
    <div
      className={`flex border-y ${theme === 'dark' ? 'bg-indigo-950/60 border-indigo-400/25' : 'bg-indigo-50 border-indigo-200'}`}
      style={{ minWidth: totalWidth, ...(summaryRowHeight ? { height: `${summaryRowHeight}px` } : {}) }}
    >
      {tableHeaders.map((col, colIndex) => {
        const colWidth = columnWidths[colIndex] || 120;
        // summaryRow に計算済みの値を使う（グループ合計値はDataTable.jsxで一元計算済み）
        const val = summaryRow[col.id];
        const calc = col._isGroup ? null : calcMap.get(col.id);
        const sysField = fieldMap.get(col.id);
        const groupFormulaDisplay = formatIndicatorGroupFormulaValue(val, col);
        let displayVal = '';

        if (val !== null && val !== undefined) {
          if (typeof val === 'number') {
            if (groupFormulaDisplay !== null) {
              displayVal = groupFormulaDisplay;
            } else if (calc && calc.format === 'percent') {
              const decimals = calc.decimals ?? 2;
              displayVal = val.toFixed(decimals) + '%';
            } else if (calc && calc.format === 'number' && typeof calc.decimals === 'number') {
              displayVal = val.toLocaleString(undefined, { minimumFractionDigits: calc.decimals, maximumFractionDigits: calc.decimals });
            } else if (sysField && typeof sysField.decimals === 'number' && sysField.decimals > 0) {
              displayVal = val.toLocaleString(undefined, { minimumFractionDigits: sysField.decimals, maximumFractionDigits: sysField.decimals });
            } else if (col._isGroup && col._aggregation === 'average') {
              displayVal = val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
            } else {
              displayVal = val.toLocaleString();
            }
            // グループカラムの単位表示（formula + % の場合は100倍してフォーマット）
            if (col._isGroup && col._unit && groupFormulaDisplay === null) {
              if (col._aggregation === 'formula' && col._unit === '%' && typeof val === 'number') {
                displayVal = (val * 100).toFixed(2) + '%';
              } else {
                displayVal = displayVal + col._unit;
              }
            }
          } else if (typeof val === 'string') {
            displayVal = val;
          }
        }

        const isSticky = colIndex < stickyColumns;
        const stickyStyle = isSticky ? {
          position: 'sticky',
          left: stickyLeftPositions[colIndex],
          zIndex: 2,
        } : { position: 'relative', zIndex: 0 };

        // メンバーカラムの割合(%)計算
        const isMemberCol = !!col._groupMemberOf;
        let percentDisplay = null;
        if (isMemberCol && col._showPercent && typeof val === 'number' && val !== 0) {
          const groupTotal = (col._memberCalcIds || []).reduce((sum, memberId) => sum + (typeof summaryRow[memberId] === 'number' ? summaryRow[memberId] : 0), 0);
          if (groupTotal !== 0) {
            percentDisplay = ((val / groupTotal) * 100).toFixed(1) + '%';
          }
        }

        // sticky セルは不透明背景をインラインスタイルで強制（overflow:scroll内でCSSスティッキーが機能するよう）
        const stickyBg = isSticky
          ? {
              // dark はボード背景にindigo-950/60を合成した近似色、lightはindigo-50相当。
              backgroundColor: theme === 'dark' ? '#1a1f3d' : '#eef2ff',
            }
          : {};

        return (
          <div
            key={col.id}
            style={{ width: colWidth, minWidth: colWidth, fontSize: `${fontSize}px`, ...(vertPad !== null ? { paddingTop: vertPad, paddingBottom: vertPad } : {}), ...stickyStyle, ...stickyBg }}
            className={`px-1.5 ${summaryRowHeight ? '' : 'py-1 md:py-1.5'} md:px-2 text-[11px] md:text-xs font-bold whitespace-nowrap flex items-center border-r ${theme === 'dark' ? 'border-white/10 text-indigo-50' : 'border-gray-200 text-indigo-900'} ${!isSticky && isMemberCol ? (theme === 'dark' ? 'bg-white/[0.03]' : 'bg-gray-100/80') : ''} ${typeof val === 'number' ? 'font-mono tabular-nums justify-end' : ''}`}
          >
            {(isMemberCol && col._showPercent) ? (
              <span style={{ fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'baseline', width: '100%' }}>
                <span style={{ flex: '1 1 auto' }}>{displayVal}</span>
                <span style={{ width: '3.8em', textAlign: 'right', flexShrink: 0 }} className={`text-xs font-normal ${percentDisplay ? (theme === 'dark' ? 'text-white/40' : 'text-gray-400') : ''}`}>{percentDisplay || ''}</span>
              </span>
            ) : displayVal}
          </div>
        );
      })}
    </div>
  );
};

export default DataTableSummaryRow;
