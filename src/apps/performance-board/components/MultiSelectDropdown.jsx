// src/apps/performance-board/components/MultiSelectDropdown.jsx
// 多機能プルダウンコンポーネント (チェックボックス修正版)

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

const MultiSelectDropdown = ({ label, options, value, onChange, glassClass, theme = 'dark' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    String(opt).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);
  // value未設定(undefined/null) = デフォルト全選択、[] = 明示的全解除
  const isDefaultAll = !Array.isArray(value) && !value;

  // 全選択判定: デフォルト全選択 OR 明示的に全オプション選択
  const areAllSelected = options.length > 0 && (isDefaultAll || selectedValues.length === options.length);

  const handleToggle = (val) => {
    const strVal = String(val);
    if (isDefaultAll) {
      // デフォルト全選択状態 → 1つ外す = 全オプション - クリックしたもの
      onChange(options.map(String).filter(v => v !== strVal));
      return;
    }
    let newValues;
    if (selectedValues.includes(strVal)) {
      newValues = selectedValues.filter(v => v !== strVal);
    } else {
      newValues = [...selectedValues, strVal];
    }
    onChange(newValues);
  };

  // 全選択/全解除のトグル処理
  const handleSelectAllToggle = () => {
    if (areAllSelected) {
      onChange([]); // 全解除（明示的空配列）
    } else {
      onChange(options.map(String)); // 全選択
    }
  };


  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full appearance-none bg-transparent pl-3 pr-2 py-2 md:py-1 text-sm md:text-xs outline-none cursor-pointer min-w-0 md:min-w-[120px] min-h-[40px] md:min-h-0 ${theme === 'dark' ? 'hover:bg-white/5 text-white/80 focus:text-white' : 'hover:bg-gray-100 text-gray-700 focus:text-gray-900'}`}
      >
        <span className="break-words">
          {areAllSelected ? `${label}: すべて` :
            selectedValues.length === 0 ? `${label}: 0件選択済み` :
              selectedValues.length === 1 ? `${label}: ${selectedValues[0]}` :
                `${label}: ${selectedValues.length}件選択中`}
        </span>
        <ChevronDown size={12} className={`ml-1 ${theme === 'dark' ? 'text-white/50' : 'text-gray-400'}`} />
      </button>

      {isOpen && (
        <div className={`absolute top-full left-0 md:left-auto md:right-0 mt-1 w-[calc(100vw-2rem)] md:w-56 max-h-64 overflow-hidden rounded-xl border shadow-2xl z-50 flex flex-col ${theme === 'dark' ? 'border-white/20 bg-[#0f172a]/95' : 'border-gray-300 bg-white/95'}`}>
          <div className={`p-2 border-b ${theme === 'dark' ? 'border-white/10' : 'border-gray-300'}`}>
            <div className="relative">
              <Search size={12} className={`absolute left-2 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full rounded px-2 pl-7 py-1 text-xs outline-none focus:border-indigo-500 ${theme === 'dark' ? 'bg-white/5 border border-white/10 text-white placeholder:text-white/20' : 'bg-gray-50 border border-gray-300 text-gray-800 placeholder:text-gray-400'}`}
                placeholder="検索..."
                autoFocus
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
            {/* 全選択/全解除ボタン */}
            <div onClick={handleSelectAllToggle} className={`flex items-center gap-2 px-3 py-2.5 md:px-2 md:py-1.5 rounded cursor-pointer text-sm md:text-xs ${theme === 'dark' ? 'hover:bg-white/10 text-white/70 hover:text-white' : 'hover:bg-gray-100 text-gray-600 hover:text-gray-800'}`}>
              <div className={`w-4 h-4 md:w-3 md:h-3 rounded border flex items-center justify-center ${areAllSelected ? 'bg-indigo-500 border-indigo-500' : theme === 'dark' ? 'border-white/30' : 'border-gray-300'}`}>
                {areAllSelected && <Check size={10} className="text-white md:hidden" />}
                {areAllSelected && <Check size={8} className="text-white hidden md:block" />}
              </div>
              <span>すべて選択 / 解除</span>
            </div>
            {filteredOptions.map(opt => {
              const isSelected = isDefaultAll || selectedValues.includes(String(opt));
              return (
                <div key={opt} onClick={() => handleToggle(opt)} className={`flex items-center gap-2 px-3 py-2.5 md:px-2 md:py-1.5 rounded cursor-pointer text-sm md:text-xs ${theme === 'dark' ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-100 text-gray-800'}`}>
                  <div className={`w-4 h-4 md:w-3 md:h-3 rounded border flex items-center justify-center ${isSelected ? 'bg-indigo-500 border-indigo-500' : theme === 'dark' ? 'border-white/30' : 'border-gray-300'}`}>
                    {isSelected && <Check size={10} className="text-white md:hidden" />}
                    {isSelected && <Check size={8} className="text-white hidden md:block" />}
                  </div>
                  <span className="truncate">{opt}</span>
                </div>
              );
            })}
            {filteredOptions.length === 0 && <div className={`text-center py-2 text-xs ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>該当なし</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelectDropdown;
