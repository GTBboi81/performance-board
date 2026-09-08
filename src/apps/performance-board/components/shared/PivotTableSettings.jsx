// src/apps/performance-board/components/shared/PivotTableSettings.jsx
// ピボットテーブル設定コンポーネント（複数タブで共有）

import React from 'react';
import { Plus, Trash2, X } from 'lucide-react';

const PivotTableSettings = ({
  pivotTables,
  activePivotId,
  setActivePivotId,
  localConfig,
  updateLocalConfig,
  theme,
  inputClass,
  labelSmClass,
  labelXsClass,
  labelClass,
  cardClass,
  borderClass,
  optionClass
}) => {
  const activePivot = pivotTables.find(p => p.id === activePivotId) || pivotTables[0];

  const handleAddPivot = () => {
    const newId = `pivot_${Date.now()}`;
    const newPivot = {
      id: newId,
      name: '新規ピボットテーブル',
      sourceId: (localConfig.dataSources || [])[0]?.id || '',
      dateTransform: 'month',
      columns: [],
      width: 'full',
      height: '1'
    };
    updateLocalConfig('pivotTables', [...pivotTables, newPivot]);
    setActivePivotId(newId);
  };

  const handleRemovePivot = (id) => {
    const newTables = pivotTables.filter(p => p.id !== id);
    updateLocalConfig('pivotTables', newTables);
    if (activePivotId === id) {
      setActivePivotId(newTables[0]?.id || null);
    }
  };

  const updatePivotConfig = (id, key, value) => {
    updateLocalConfig('pivotTables', pivotTables.map(p =>
      p.id === id ? { ...p, [key]: value } : p
    ));
  };

  const addPivotColumn = (pivotId) => {
    const pivot = pivotTables.find(p => p.id === pivotId);
    if (!pivot) return;
    const newCol = {
      id: `col_${Date.now()}`,
      label: '新規列',
      columnIndex: 0,
      aggregation: 'count'
    };
    updatePivotConfig(pivotId, 'columns', [...(pivot.columns || []), newCol]);
  };

  const updatePivotColumn = (pivotId, colId, key, value) => {
    const pivot = pivotTables.find(p => p.id === pivotId);
    if (!pivot) return;
    const newCols = pivot.columns.map(c =>
      c.id === colId ? { ...c, [key]: value } : c
    );
    updatePivotConfig(pivotId, 'columns', newCols);
  };

  const removePivotColumn = (pivotId, colId) => {
    const pivot = pivotTables.find(p => p.id === pivotId);
    if (!pivot) return;
    updatePivotConfig(pivotId, 'columns', pivot.columns.filter(c => c.id !== colId));
  };

  const dataSources = localConfig.dataSources || [];
  const selectedSource = activePivot ? dataSources.find(s => s.id === activePivot.sourceId) : null;
  const sourceHeaders = selectedSource?.headers || [];

  return (
    <div className="space-y-4">
      <div className={`flex items-center gap-3 p-3 rounded-xl border ${cardClass}`}>
        <label className={`text-xs ${labelSmClass}`}>編集するテーブル:</label>
        <select
          value={activePivotId || ''}
          onChange={(e) => setActivePivotId(e.target.value)}
          className={`${inputClass} rounded px-2 py-1 text-xs outline-none`}
        >
          {pivotTables.length === 0 && <option value="" className={optionClass}>テーブルがありません</option>}
          {pivotTables.map(p => <option key={p.id} value={p.id} className={optionClass}>{p.name}</option>)}
        </select>
        <button onClick={handleAddPivot} className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${theme === 'dark' ? 'bg-teal-500/30 hover:bg-teal-500/50 text-teal-200' : 'bg-teal-100 hover:bg-teal-200 text-teal-700'}`}>
          <Plus size={12} /> 追加
        </button>
        {pivotTables.length > 0 && (
          <button onClick={() => handleRemovePivot(activePivotId)} className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${theme === 'dark' ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300' : 'bg-rose-100 hover:bg-rose-200 text-rose-700'}`}>
            <Trash2 size={12} /> 削除
          </button>
        )}
      </div>

      {activePivot && (
        <div className={`rounded-xl border p-4 ${cardClass}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className={`text-xs ${labelSmClass} block mb-1`}>テーブル名</label>
              <input
                type="text"
                value={activePivot.name}
                onChange={(e) => updatePivotConfig(activePivot.id, 'name', e.target.value)}
                className={`w-full ${inputClass} rounded px-3 py-2 text-sm`}
              />
            </div>
            <div>
              <label className={`text-xs ${labelSmClass} block mb-1`}>データソース</label>
              <select
                value={activePivot.sourceId || ''}
                onChange={(e) => updatePivotConfig(activePivot.id, 'sourceId', e.target.value)}
                className={`w-full ${inputClass} rounded px-3 py-2 text-sm`}
              >
                <option value="" className={optionClass}>ソース選択...</option>
                {dataSources.map(src => (
                  <option key={src.id} value={src.id} className={optionClass}>{src.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={`text-xs ${labelSmClass} block mb-1`}>集計単位</label>
              <select
                value={activePivot.dateTransform || 'month'}
                onChange={(e) => updatePivotConfig(activePivot.id, 'dateTransform', e.target.value)}
                className={`w-full ${inputClass} rounded px-3 py-2 text-sm`}
              >
                <option value="month" className={optionClass}>月別</option>
                <option value="year" className={optionClass}>年別</option>
              </select>
            </div>
          </div>

          <div className={`border-t pt-4 ${borderClass}`}>
            <div className="flex justify-between items-center mb-3">
              <label className={`text-xs font-medium ${labelClass}`}>集計列の設定</label>
              <button
                onClick={() => addPivotColumn(activePivot.id)}
                className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${theme === 'dark' ? 'bg-teal-500/20 hover:bg-teal-500/30 text-teal-300' : 'bg-teal-100 hover:bg-teal-200 text-teal-700'}`}
              >
                <Plus size={12} /> 列を追加
              </button>
            </div>

            {(activePivot.columns || []).length === 0 ? (
              <p className={`text-xs ${labelXsClass} py-4 text-center`}>
                「列を追加」ボタンで集計列を追加してください
              </p>
            ) : (
              <div className="space-y-2">
                {activePivot.columns.map((col, idx) => (
                  <div key={col.id} className={`flex items-center gap-2 p-2 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <span className={`text-xs ${labelXsClass} w-6`}>{idx + 1}.</span>
                    <input
                      type="text"
                      value={col.label}
                      onChange={(e) => updatePivotColumn(activePivot.id, col.id, 'label', e.target.value)}
                      placeholder="列名（例: ET数）"
                      className={`flex-1 ${inputClass} rounded px-2 py-1.5 text-xs`}
                    />
                    <select
                      value={col.columnIndex ?? ''}
                      onChange={(e) => updatePivotColumn(activePivot.id, col.id, 'columnIndex', parseInt(e.target.value))}
                      className={`flex-1 ${inputClass} rounded px-2 py-1.5 text-xs`}
                    >
                      <option value="" className={optionClass}>日付カラム選択...</option>
                      {sourceHeaders.map((h, i) => (
                        <option key={i} value={i} className={optionClass}>{h}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => removePivotColumn(activePivot.id, col.id)}
                      className="text-rose-400 hover:text-rose-300 p-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PivotTableSettings;
