// src/apps/performance-board/components/DataTableColumnHeader.jsx
// データテーブルのカラムヘッダー（ソートボタン・カラム名編集）

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, ChevronRight, Pencil, Info } from 'lucide-react';
import { PRESET_COLORS } from '../../../constants';
import { getDataTableHeaderLineHeight, getDefaultDataTableHeaderRowHeight } from '../utils/dataTableHeaderLayout';

const DataTableColumnHeader = ({
  col,
  colIndex,
  colWidth,
  isSticky,
  stickyStyle,
  theme = 'dark',
  sortConfig,
  onSort,
  columnColors,
  columnAliases = {},
  isViewer = false,
  onToggleIndicatorGroup,
  isExpandedGroup,
  formulaInfo,
  onColumnWidthStart,
  onColumnWidthChange,
  onColumnWidthEnd,
  isDraggingResize = false,
  fontSize = 12,
  rowHeight = null,
  isEditMode = false,
  onEditModeClick,
}) => {
  const [showFormula, setShowFormula] = useState(false);
  const [formulaPos, setFormulaPos] = useState({ top: 0, left: 0 });
  const headerCellRef = useRef(null);
  const formulaTimerRef = useRef(null);

  const currentColorId = columnColors[col.id] || 'default';
  const currentColor = PRESET_COLORS.find(c => c.id === currentColorId) || PRESET_COLORS[0];

  // エイリアス表示名（設定済みならエイリアス、なければ元のラベル）
  const displayName = columnAliases[col.id] || col.label;
  const originalName = col.label;
  const hasAlias = !!columnAliases[col.id];

  // ヘッダー下ボーダー
  const isMember = !!col._groupMemberOf;
  const headerBorderStyle = currentColor.hex
    ? { borderBottomWidth: '3px', borderBottomColor: currentColor.hex }
    : isMember
      ? {} // カラーピッカー未設定のメンバーはボーダーなし
      : {};
  const preferredLineHeight = getDataTableHeaderLineHeight(fontSize);
  const effectiveRowHeight = rowHeight || getDefaultDataTableHeaderRowHeight(fontSize);
  const headerBorderWidth = currentColor.hex ? 3 : 1;
  const availableTextHeight = Math.max(fontSize, effectiveRowHeight - headerBorderWidth);
  const headerLineCount = availableTextHeight >= preferredLineHeight * 2 ? 2 : 1;
  const headerLineHeight = Math.min(
    preferredLineHeight,
    Math.floor(availableTextHeight / headerLineCount)
  );
  const headerVerticalPadding = Math.max(
    0,
    Math.floor((effectiveRowHeight - (headerLineHeight * headerLineCount) - headerBorderWidth) / 2)
  );
  const showAliasEditButton = colWidth >= 96;

  // 鉛筆アイコンから、編集モード外でも列設定を開く
  const handleEditClick = (e) => {
    e.stopPropagation();
    onEditModeClick?.(col.id, headerCellRef);
  };

  // ツールチップ: エイリアス設定済みなら元の指標名を表示
  const tooltipText = hasAlias ? `指標名: ${originalName}` : (col._sfApiName ? `${originalName} (${col._sfApiName})` : originalName);

  // 計算式ツールチップ: ホバーで表示
  const handleFormulaMouseEnter = () => {
    if (!formulaInfo) return;
    formulaTimerRef.current = setTimeout(() => {
      if (headerCellRef.current) {
        const rect = headerCellRef.current.getBoundingClientRect();
        setFormulaPos({ top: rect.bottom + 4, left: rect.left });
        setShowFormula(true);
      }
    }, 400);
  };
  const handleFormulaMouseLeave = () => {
    if (formulaTimerRef.current) clearTimeout(formulaTimerRef.current);
    setShowFormula(false);
  };

  // アンマウント時・スクロール時にツールチップを確実にクリア
  useEffect(() => {
    return () => {
      if (formulaTimerRef.current) clearTimeout(formulaTimerRef.current);
      setShowFormula(false);
    };
  }, []);
  useEffect(() => {
    if (!showFormula) return;
    const handleScroll = () => setShowFormula(false);
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [showFormula]);

  return (
    <>
    <div
      ref={headerCellRef}
      onMouseEnter={handleFormulaMouseEnter}
      onMouseLeave={handleFormulaMouseLeave}
      style={{
        width: colWidth, minWidth: colWidth, ...stickyStyle, ...headerBorderStyle,
        fontSize: `${fontSize}px`,
        lineHeight: `${headerLineHeight}px`,
        // sticky セルは不透明背景をインラインで強制（メンバー列の半透明クラスより優先）
        ...(isSticky ? { backgroundColor: theme === 'dark' ? '#0f172a' : '#f3f4f6' } : {}),
        // 明示高を優先し、未設定時は2行分の既定高を固定して仮想スクロールの予測と揃える。
        height: `${effectiveRowHeight}px`,
        paddingTop: headerVerticalPadding,
        paddingBottom: headerVerticalPadding,
        // アニメーション
        ...(isMember ? { animation: `grpSlideIn 0.25s ease-out ${(col._memberIndex || 0) * 0.04}s both` } : {}),
        ...(col._isGroup ? { animation: 'grpCollapseIn 0.2s ease-out both' } : {}),
      }}
      className={`relative px-1.5 md:px-2 flex items-center overflow-hidden text-[11px] md:text-xs font-medium border-b border-r ${theme === 'dark' ? 'border-white/10 text-indigo-200/70 hover:text-indigo-100' : 'border-gray-200 text-slate-500 hover:text-slate-800'} ${!isSticky && isMember ? (theme === 'dark' ? 'bg-white/[0.04]' : 'bg-gray-200/60') : ''} ${isEditMode ? (theme === 'dark' ? 'border-indigo-300/30 hover:border-indigo-400/60' : 'border-indigo-300/50 hover:border-indigo-400/70') : ''}`}
    >
      <div className="group/label flex gap-1 items-center w-full min-w-0">
        {/* グループ展開/折りたたみアイコン */}
        {col._isGroup && onToggleIndicatorGroup && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleIndicatorGroup(col.id); }}
            className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center transition-all ${
              isExpandedGroup
                ? (theme === 'dark' ? 'bg-purple-500/30 text-purple-200 hover:bg-purple-500/50' : 'bg-purple-200 text-purple-700 hover:bg-purple-300')
                : (theme === 'dark' ? 'bg-white/10 text-white/50 hover:bg-purple-500/20 hover:text-purple-300' : 'bg-gray-200 text-gray-500 hover:bg-purple-100 hover:text-purple-600')
            }`}
            title={isExpandedGroup ? '折りたたむ' : '展開'}
          >
            {isExpandedGroup ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
        )}
        {/* ラベルとソートアイコン */}
        <span
          className={`cursor-pointer flex-1 min-w-0 whitespace-normal ${isEditMode ? (theme === 'dark' ? 'hover:text-indigo-300' : 'hover:text-indigo-600') : ''}`}
          onClick={() => {
            if (isEditMode && onEditModeClick) {
              onEditModeClick(col.id, headerCellRef);
            } else if (col._isGroup && onToggleIndicatorGroup) {
              onToggleIndicatorGroup(col.id);
            } else {
              onSort(col.id);
            }
          }}
          title={isEditMode ? `クリックして「${displayName}」を編集` : tooltipText}
        >
          <span className={`${headerLineCount === 2 ? 'line-clamp-2' : 'line-clamp-1'} break-words ${hasAlias ? 'italic' : ''}`}>{displayName}</span>
        </span>
        {!col._isGroup && sortConfig.key === col.id && (sortConfig.direction === 'asc' ? <ChevronUp size={12} className="flex-shrink-0" /> : <ChevronDown size={12} className="flex-shrink-0" />)}
        {!isViewer && onEditModeClick && showAliasEditButton && (
          <button
            onClick={handleEditClick}
            className={`flex-shrink-0 opacity-0 group-hover/label:opacity-100 transition-opacity p-0.5 rounded ${theme === 'dark' ? 'text-white/50 hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'}`}
            title="列の設定（表示名・色）"
          >
            <Pencil size={10} />
          </button>
        )}
      </div>
      {/* カラムリサイズハンドル */}
      <div
        className={`absolute right-0 top-0 h-full cursor-col-resize select-none z-10 transition-colors ${isDraggingResize ? 'bg-indigo-400' : 'hover:bg-indigo-400/50'}`}
        style={{ width: '4px' }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onColumnWidthStart?.(col.id, e.clientX, colWidth);
        }}
      />
    </div>
    {showFormula && formulaInfo && createPortal(
      <div
        style={{
          position: 'fixed',
          top: formulaPos.top,
          left: Math.min(formulaPos.left, window.innerWidth - 320),
          maxWidth: 'calc(100vw - 1rem)',
          zIndex: 9999,
        }}
        className={`rounded-lg shadow-xl p-3 text-xs pointer-events-none ${
          theme === 'dark'
            ? 'bg-slate-800 border border-white/20 text-white'
            : 'bg-white border border-gray-300 text-gray-800 shadow-lg'
        }`}
      >
        <div className={`text-[10px] uppercase tracking-wider mb-1 ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>
          {formulaInfo.type === 'calc' ? '計算指標' : formulaInfo.type === 'composite' ? '複合指標' : 'フィールド'}
        </div>
        <div className={`font-mono ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-600'}`}>
          {formulaInfo.formula}
        </div>
        {formulaInfo.details && (
          <div className={`mt-1.5 pt-1.5 border-t whitespace-pre-wrap break-all ${theme === 'dark' ? 'border-white/10 text-white/60' : 'border-gray-200 text-gray-500'}`}>
            {formulaInfo.details}
          </div>
        )}
        {formulaInfo.subFormulas && formulaInfo.subFormulas.length > 0 && (
          <div className={`mt-2 pt-2 border-t space-y-1.5 ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
            {formulaInfo.subFormulas.map((sub, idx) => (
              <div key={idx}>
                <div className={`text-[10px] ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>{sub.label}</div>
                <div className={`font-mono text-[11px] ${theme === 'dark' ? 'text-indigo-300/80' : 'text-indigo-500'}`}>{sub.formula}</div>
              </div>
            ))}
          </div>
        )}
      </div>,
      document.body
    )}
    </>
  );
};

export default DataTableColumnHeader;
