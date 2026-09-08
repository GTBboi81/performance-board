// src/apps/performance-board/components/DateRangeDropdown.jsx
// 日付範囲指定用ドロップダウン

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { formatDateForInput } from '../utils';

const DateRangeDropdown = ({ label, value, onChange, theme = 'dark' }) => {
  const [isOpen, setIsOpen] = useState(false);
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

  const handlePreset = (preset) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === 'today') {
      // no changes needed
    }
    else if (preset === 'yesterday') {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
    }
    else if (preset === 'yesterdayToToday') {
      start.setDate(start.getDate() - 1);
      // end is already today
    }
    else if (preset === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
    else if (preset === 'thisMonthToToday') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      // end is already today
    }
    else if (preset === 'thisMonth1stToYesterday') {
      // 1日の場合は先月1日〜先月末日
      if (now.getDate() === 1) {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
      } else {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      }
    }
    else if (preset === 'lastMonth') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    }

    onChange({ start: formatDateForInput(start), end: formatDateForInput(end) });
  };

  const val = (typeof value === 'object' && value) ? value : { start: '', end: '' };

  const displayText = (val.start || val.end)
    ? `${val.start.replace(/-/g, '/')} ~ ${val.end.replace(/-/g, '/')}`
    : `${label}: 期間指定なし`;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full appearance-none bg-transparent pl-3 pr-2 py-2 md:py-1 text-sm md:text-xs outline-none cursor-pointer min-w-0 md:min-w-[180px] min-h-[40px] md:min-h-0 ${theme === 'dark' ? 'hover:bg-white/5 text-white/80 focus:text-white' : 'hover:bg-gray-100 text-gray-700 focus:text-gray-900'}`}
      >
        <span className="min-w-0 flex-1 whitespace-nowrap text-left">{displayText}</span>
        <ChevronDown size={12} className={`ml-1 shrink-0 ${theme === 'dark' ? 'text-white/50' : 'text-gray-400'}`} />
      </button>

      {isOpen && (
        <div className={`absolute top-full left-0 md:left-auto md:right-0 mt-1 w-[calc(100vw-2rem)] md:w-64 rounded-xl border shadow-2xl z-50 flex flex-col p-3 gap-3 ${theme === 'dark' ? 'border-white/20 bg-[#0f172a]/95' : 'border-gray-300 bg-white/95'}`}>
          <div className="flex flex-col gap-2">
            <label className={`text-xs ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>プリセット</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => handlePreset('today')} className={`text-sm md:text-xs py-2 md:py-1 rounded transition-colors ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>今日</button>
              <button onClick={() => handlePreset('yesterday')} className={`text-sm md:text-xs py-2 md:py-1 rounded transition-colors ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>昨日</button>
              <button onClick={() => handlePreset('yesterdayToToday')} className={`text-sm md:text-xs py-2 md:py-1 rounded transition-colors col-span-2 ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>昨日から今日</button>
              <button onClick={() => handlePreset('thisMonthToToday')} className={`text-sm md:text-xs py-2 md:py-1 rounded transition-colors col-span-2 ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>今月1日〜今日</button>
              <button onClick={() => handlePreset('thisMonth1stToYesterday')} className={`text-sm md:text-xs py-2 md:py-1 rounded transition-colors col-span-2 ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>今月1日〜昨日</button>
              <button onClick={() => handlePreset('thisMonth')} className={`text-sm md:text-xs py-2 md:py-1 rounded transition-colors ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>今月（月末まで）</button>
              <button onClick={() => handlePreset('lastMonth')} className={`text-sm md:text-xs py-2 md:py-1 rounded transition-colors ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>先月</button>
            </div>
          </div>
          <div className={`h-px w-full ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`} />
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className={`text-xs ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>開始日</label>
              <input
                type="date"
                value={val.start || ''}
                onChange={(e) => onChange({ ...val, start: e.target.value })}
                className={`rounded px-2 py-1 text-xs w-32 focus:border-indigo-500 outline-none ${theme === 'dark' ? 'bg-slate-800 border border-white/10 text-white' : 'bg-gray-50 border border-gray-300 text-gray-800'}`}
              />
            </div>
            <div className="flex items-center justify-between">
              <label className={`text-xs ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>終了日</label>
              <input
                type="date"
                value={val.end || ''}
                onChange={(e) => onChange({ ...val, end: e.target.value })}
                className={`rounded px-2 py-1 text-xs w-32 focus:border-indigo-500 outline-none ${theme === 'dark' ? 'bg-slate-800 border border-white/10 text-white' : 'bg-gray-50 border border-gray-300 text-gray-800'}`}
              />
            </div>
          </div>
          <div className={`h-px w-full ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`} />
          <button onClick={() => onChange({ start: '', end: '' })} className={`w-full py-1 text-xs transition-colors flex items-center justify-center gap-1 ${theme === 'dark' ? 'text-white/50 hover:text-rose-300' : 'text-gray-500 hover:text-rose-500'}`}>
            <X size={12} /> クリア
          </button>
        </div>
      )}
    </div>
  );
};

export default DateRangeDropdown;
