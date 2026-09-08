// src/apps/performance-board/components/DataTableInlinePopup.jsx
// 汎用ポータルポップアップ（列編集用）

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Trash2 } from 'lucide-react';

const VIEWPORT_MARGIN = 16;
const ANCHOR_GAP = 8;
const MIN_POPUP_HEIGHT = 160;
const MIN_SPACE_BELOW = 240;

const DataTableInlinePopup = ({
  open,
  anchorRect,
  title,
  children,
  onClose,
  onSave,
  onDelete = null,
  theme = 'dark',
  maxWidth = 400,
  saveLabel = '保存',
  deleteLabel = '削除',
}) => {
  const popupRef = useRef(null);
  const [, setViewportRevision] = useState(0);

  // Escape キーで閉じる
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // 画面サイズ変更時に位置と利用可能高を再計算する。
  useEffect(() => {
    if (!open) return;
    const handleResize = () => setViewportRevision(revision => revision + 1);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [open]);

  // ポップアップ外クリックで閉じる
  const handleBackdropClick = useCallback((e) => {
    if (popupRef.current && !popupRef.current.contains(e.target)) {
      onClose();
    }
  }, [onClose]);

  if (!open) return null;

  // ポジション計算（anchorRect が null の場合は画面中央に配置）
  let top, bottom, left, availableHeight;
  const estimatedHeight = 480;
  const viewportMaxHeight = Math.max(MIN_POPUP_HEIGHT, window.innerHeight - VIEWPORT_MARGIN * 2);
  const fitToViewport = (height) => Math.min(
    viewportMaxHeight,
    Math.max(MIN_POPUP_HEIGHT, height)
  );
  if (!anchorRect) {
    top = Math.max(8, (window.innerHeight - estimatedHeight) / 2);
    left = Math.max(8, (window.innerWidth - maxWidth) / 2);
    availableHeight = fitToViewport(window.innerHeight - top - VIEWPORT_MARGIN);
  } else {
    const belowTop = anchorRect.bottom + ANCHOR_GAP;
    const spaceBelow = window.innerHeight - belowTop - VIEWPORT_MARGIN;
    const spaceAbove = anchorRect.top - ANCHOR_GAP - VIEWPORT_MARGIN;
    const openAbove = spaceBelow < MIN_SPACE_BELOW && spaceAbove > spaceBelow;

    left = anchorRect.left;
    // 右端チェック
    if (left + maxWidth > window.innerWidth - VIEWPORT_MARGIN) {
      left = Math.max(8, window.innerWidth - maxWidth - VIEWPORT_MARGIN);
    }

    if (openAbove) {
      // bottom 基準にすることで、内容が短い列設定ポップアップもアンカー直上に保つ。
      bottom = Math.max(VIEWPORT_MARGIN, window.innerHeight - anchorRect.top + ANCHOR_GAP);
      availableHeight = fitToViewport(spaceAbove);
    } else {
      top = belowTop;
      availableHeight = fitToViewport(spaceBelow);
    }
  }

  const isDark = theme === 'dark';
  const containerClass = isDark
    ? 'bg-[#1e2940] border border-white/20 rounded-xl shadow-2xl text-white'
    : 'bg-white border border-gray-200 rounded-xl shadow-xl text-gray-900';

  return createPortal(
    <>
      {/* バックドロップ（透明） */}
      <div
        className="fixed inset-0 z-[9998]"
        onClick={handleBackdropClick}
      />
      {/* ポップアップ本体 */}
      <div
        ref={popupRef}
        className={`fixed z-[9999] ${containerClass}`}
        style={{
          top,
          bottom,
          left,
          width: maxWidth,
          maxWidth: `calc(100vw - 16px)`,
          maxHeight: availableHeight,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ヘッダー */}
        <div className={`flex items-center justify-between px-4 py-3 border-b flex-shrink-0 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
          <span className="font-semibold text-sm truncate">{title}</span>
          <button
            onClick={onClose}
            className={`ml-2 p-1 rounded transition-colors flex-shrink-0 ${isDark ? 'hover:bg-white/10 text-white/60 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'}`}
          >
            <X size={14} />
          </button>
        </div>

        {/* コンテンツ（スクロール可能） */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 min-h-0">
          {children}
        </div>

        {/* フッター */}
        <div className={`flex items-center gap-2 px-4 py-3 border-t flex-shrink-0 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
          {onDelete && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors"
            >
              <Trash2 size={12} />
              {deleteLabel}
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isDark ? 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            キャンセル
          </button>
          {onSave && (
            <button
              onClick={onSave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
            >
              <Save size={12} />
              {saveLabel}
            </button>
          )}
        </div>
      </div>
    </>,
    document.body
  );
};

export default DataTableInlinePopup;
