// src/apps/performance-board/components/EmployeePickerDropdown.jsx
// 担当者ホワイトリスト選択ドロップダウン

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

const EmployeePickerDropdown = ({ options, selectedIds, onSave, onCancel, anchorRect, theme = 'dark' }) => {
  // selectedIds が null/undefined なら全IDを初期選択とみなす
  const allIds = useMemo(() => options.map((o) => o.id), [options]);
  const [checked, setChecked] = useState(() =>
    Array.isArray(selectedIds) ? new Set(selectedIds) : new Set(allIds)
  );
  const [search, setSearch] = useState('');

  const filteredOptions = useMemo(() =>
    search.trim()
      ? options.filter(o => o.name.includes(search.trim()) || o.id.includes(search.trim()))
      : options,
    [options, search]
  );
  const areAllSelected = useMemo(() => allIds.every(id => checked.has(id)), [allIds, checked]);

  // ESC でキャンセル（onCancelRef パターンでイベント再登録を防ぐ）
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') onCancelRef.current?.(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleOne = (id) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setChecked(areAllSelected ? new Set() : new Set(allIds));
  };

  const handleSave = () => {
    // 全選択なら null（全表示＝未設定と同義）
    const ids = [...checked];
    onSave(ids.length === allIds.length ? null : ids);
  };

  const darkPanel = 'bg-slate-800 border border-white/10';
  const lightPanel = 'bg-white border border-gray-300';
  const panelClass = theme === 'dark' ? darkPanel : lightPanel;
  const textClass = theme === 'dark' ? 'text-white/80' : 'text-gray-700';
  const hoverClass = theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100';

  const top = anchorRect ? anchorRect.bottom + 4 : 100;
  const left = anchorRect ? anchorRect.left : 100;

  return (
    <>
      <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={onCancel} />
      <div
        className={`fixed rounded-lg shadow-xl pointer-events-auto ${panelClass}`}
        style={{ top, left, zIndex: 9999, width: 260, maxHeight: 360, display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 検索 */}
        <div className={`flex items-center gap-2 px-3 py-2 border-b ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
          <Search size={12} className="opacity-50 shrink-0" />
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="担当者を検索..."
            className={`flex-1 bg-transparent text-xs outline-none ${textClass}`}
          />
          {search && (
            <button onClick={() => setSearch('')} className="opacity-50 hover:opacity-80">
              <X size={12} />
            </button>
          )}
        </div>

        {/* 全選択トグル */}
        <button
          onClick={toggleAll}
          className={`flex items-center gap-2 px-3 py-2 text-xs border-b transition-colors ${hoverClass} ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}
        >
          <input type="checkbox" readOnly checked={areAllSelected} className="pointer-events-none" />
          <span className={`font-medium ${textClass}`}>全員</span>
          <span className="ml-auto opacity-50 text-xs">{allIds.length}人</span>
        </button>

        {/* 候補リスト */}
        <div className="overflow-y-auto flex-1">
          {filteredOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => toggleOne(opt.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${hoverClass}`}
            >
              <input type="checkbox" readOnly checked={checked.has(opt.id)} className="pointer-events-none" />
              <span className={textClass}>{opt.name}</span>
            </button>
          ))}
          {filteredOptions.length === 0 && (
            <p className="px-3 py-4 text-xs opacity-50 text-center">該当なし</p>
          )}
        </div>

        {/* 保存/キャンセル */}
        <div className={`flex gap-2 px-3 py-2 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
          <button
            onClick={onCancel}
            className={`flex-1 px-2 py-1.5 text-xs rounded transition-colors ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white/60' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-2 py-1.5 text-xs rounded transition-colors bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            保存 ({checked.size}人)
          </button>
        </div>
      </div>
    </>
  );
};

export default EmployeePickerDropdown;
