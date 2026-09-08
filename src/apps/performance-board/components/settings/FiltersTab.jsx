// src/apps/performance-board/components/settings/FiltersTab.jsx
// フィルター設定タブ

import React, { useState } from 'react';
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react';

const FiltersTab = ({
  localConfig,
  updateLocalConfig,
  theme,
  glassClass,
  inputClass,
  textClass,
  textMutedClass,
  labelSmClass,
  optionClass
}) => {
  const [newFilterField, setNewFilterField] = useState('');

  const handleAddFilter = () => {
    if (!newFilterField) return;
    const fieldObj = localConfig.systemFields.find(f => f.id === newFilterField);
    if (!fieldObj) return;
    const id = `filter_${newFilterField}_${Date.now()}`;
    updateLocalConfig('filters', [...localConfig.filters, { id, field: newFilterField, label: fieldObj.label }]);
    setNewFilterField('');
  };

  const handleDeleteFilter = (id) => {
    updateLocalConfig('filters', localConfig.filters.filter(f => f.id !== id));
  };

  return (
    <div className={`rounded-2xl p-6 ${glassClass}`}>
      <div className="flex gap-3 mb-8 items-end max-w-xl">
        <div className="flex-1">
          <label className={`text-xs block mb-1 ${labelSmClass}`}>追加する項目</label>
          <select
            value={newFilterField}
            onChange={(e) => setNewFilterField(e.target.value)}
            className={`w-full ${inputClass} rounded-lg px-3 py-2 text-sm`}
          >
            <option value="" className={optionClass}>選択...</option>
            {localConfig.systemFields.map(f => (
              <option
                key={f.id}
                value={f.id}
                disabled={localConfig.filters.some(fl => fl.field === f.id)}
                className={optionClass}
              >
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleAddFilter}
          disabled={!newFilterField}
          className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm"
        >
          追加
        </button>
      </div>
      <p className={`text-xs mb-3 ${textMutedClass}`}>ダッシュボード上の表示順序（左から右）</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {localConfig.filters.map((filter, idx) => (
          <div
            key={filter.id}
            className={`p-4 rounded-xl border ${
              theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => {
                      if (idx === 0) return;
                      const newFilters = [...localConfig.filters];
                      [newFilters[idx - 1], newFilters[idx]] = [newFilters[idx], newFilters[idx - 1]];
                      updateLocalConfig('filters', newFilters);
                    }}
                    disabled={idx === 0}
                    className={`p-0.5 rounded ${
                      idx === 0
                        ? (theme === 'dark' ? 'text-white/10' : 'text-gray-300') + ' cursor-not-allowed'
                        : (theme === 'dark' ? 'text-white/40 hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100')
                    }`}
                    title="左に移動"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => {
                      if (idx === localConfig.filters.length - 1) return;
                      const newFilters = [...localConfig.filters];
                      [newFilters[idx], newFilters[idx + 1]] = [newFilters[idx + 1], newFilters[idx]];
                      updateLocalConfig('filters', newFilters);
                    }}
                    disabled={idx === localConfig.filters.length - 1}
                    className={`p-0.5 rounded ${
                      idx === localConfig.filters.length - 1
                        ? (theme === 'dark' ? 'text-white/10' : 'text-gray-300') + ' cursor-not-allowed'
                        : (theme === 'dark' ? 'text-white/40 hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100')
                    }`}
                    title="右に移動"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
                <span className={`font-medium ${textClass}`}>{filter.label}</span>
              </div>
              <button
                onClick={() => handleDeleteFilter(filter.id)}
                className={`hover:text-rose-400 ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
            {filter.field !== 'date' && (
              <div className="mt-2 flex items-center gap-2">
                <label className={`text-[10px] whitespace-nowrap ${textMutedClass}`}>先月用</label>
                <select
                  value={filter.lastMonthField || ''}
                  onChange={(e) => {
                    const newFilters = [...localConfig.filters];
                    newFilters[idx] = { ...newFilters[idx], lastMonthField: e.target.value || undefined };
                    updateLocalConfig('filters', newFilters);
                  }}
                  className={`flex-1 ${inputClass} rounded px-2 py-1 text-xs`}
                >
                  <option value="" className={optionClass}>なし</option>
                  {localConfig.systemFields.map(f => (
                    <option key={f.id} value={f.id} className={optionClass}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FiltersTab;
