// src/apps/performance-board/components/settings/AggregationTab.jsx
// データテーブル・集計条件設定タブ

import React, { useState, useMemo, useEffect } from 'react';
import {
  List,
  Layers,
  TrendingUp,
  GitCompare,
  Grid3X3,
  Plus,
  Trash2,
  Copy,
  GripVertical,
  Activity,
  Calendar,
  Square,
  CheckSquare,
  X,
  Filter,
  ChevronUp,
  ChevronDown,
  Network,
  Table2,
  ArrowUpDown,
  LayoutTemplate
} from 'lucide-react';
import {
  HEIGHT_OPTIONS,
  DEFAULT_AGGREGATION_CONFIGS,
  DATE_TRANSFORM_OPTIONS,
  CONDITIONAL_OPERATORS
} from '../../../../constants';
import PivotTableSettings from '../shared/PivotTableSettings';
import { resolveDataTableDensity } from '../../utils/dataTableHeaderLayout';

const AggregationTab = ({
  localConfig,
  updateLocalConfig,
  theme,
  glassClass,
  cardClass,
  inputClass,
  optionClass,
  textClass,
  textMutedClass,
  labelSmClass,
  labelXsClass,
  labelClass,
  borderClass,
  allFields
}) => {
  // サブタブ状態
  const [dataTableSubTab, setDataTableSubTab] = useState('tables');

  // テーブル管理
  const dataTables = localConfig.dataTables || [];
  const [selectedTableId, setSelectedTableId] = useState(dataTables[0]?.id || null);
  // dataTables が外部から差し替わった場合（ダッシュボード切替・設定再読込）に selectedTableId を同期
  useEffect(() => {
    if (!dataTables.find(t => t.id === selectedTableId)) {
      setSelectedTableId(dataTables[0]?.id || null);
    }
  }, [dataTables]);
  const activeTable = dataTables.find(t => t.id === selectedTableId);
  const activeTableFields = useMemo(() => {
    if (!activeTable) return [];
    return (activeTable.fields || [])
      .map(fieldId => allFields.find(f => f.id === fieldId))
      .filter(Boolean);
  }, [activeTable, allFields]);

  // ピボットテーブル管理
  const pivotTables = localConfig.pivotTables || [];
  const [activePivotId, setActivePivotId] = useState(pivotTables[0]?.id || '');

  // ドラッグ状態
  const [dragState, setDragState] = useState({ dragging: null, hoverIdx: null });

  // vendorPivot指標用ドラッグ状態
  const [metricDragState, setMetricDragState] = useState({ dragging: null, hoverIdx: null, tableId: null });

  // アコーディオン状態
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [fieldsOpen, setFieldsOpen] = useState(true);

  // フィールド検索
  const [fieldSearch, setFieldSearch] = useState('');

  // テーブル追加
  const handleAddTable = () => {
    const id = `table_${Date.now()}`;
    const newTable = { id, name: '新しいテーブル', sourceId: '', fields: [] };
    updateLocalConfig('dataTables', [...dataTables, newTable]);
    setSelectedTableId(id);
  };

  // テーブル削除
  const handleRemoveTable = (id) => {
    if (dataTables.length <= 1) return;
    const newTables = dataTables.filter(t => t.id !== id);
    updateLocalConfig('dataTables', newTables);
    if (selectedTableId === id) setSelectedTableId(newTables[0].id);
  };

  // テーブル複製
  const handleDuplicateTable = (id) => {
    const sourceTable = dataTables.find(t => t.id === id);
    if (!sourceTable) return;

    const newId = `table_${Date.now()}`;
    const duplicatedTable = {
      ...sourceTable,
      id: newId,
      name: `${sourceTable.name} (コピー)`,
      fields: [...sourceTable.fields],
      columnColors: sourceTable.columnColors ? { ...sourceTable.columnColors } : {},
      metricFilters: sourceTable.metricFilters ? sourceTable.metricFilters.map(mf => ({ ...mf, id: `mf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` })) : [],
      columnFilters: sourceTable.columnFilters ? sourceTable.columnFilters.map(cf => ({ ...cf, id: `cf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` })) : [],
    };
    updateLocalConfig('dataTables', [...dataTables, duplicatedTable]);
    setSelectedTableId(newId);
  };

  // テーブル設定更新
  const updateTableConfig = (id, key, value) => {
    updateLocalConfig('dataTables', dataTables.map(t => t.id === id ? { ...t, [key]: value } : t));
  };

  // テーブルフィールドトグル
  const toggleTableField = (tableId, fieldId) => {
    const table = dataTables.find(t => t.id === tableId);
    if (!table) return;

    let newFields;
    if (table.fields.includes(fieldId)) {
      newFields = table.fields.filter(id => id !== fieldId);
    } else {
      newFields = [...table.fields, fieldId];
    }
    updateTableConfig(tableId, 'fields', newFields);
  };

  return (
    <div className="space-y-6">
      {/* サブタブ */}
      <div className={`flex gap-2 p-1 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
        <button
          onClick={() => setDataTableSubTab('tables')}
          className={`flex-1 py-2 px-4 text-sm rounded-md font-medium transition-colors ${
            dataTableSubTab === 'tables'
              ? (theme === 'dark' ? 'bg-white/20 text-white' : 'bg-white text-gray-800 shadow')
              : (theme === 'dark' ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-800')
          }`}
        >
          <List size={14} className="inline mr-2" />データテーブル
        </button>
        <button
          onClick={() => setDataTableSubTab('aggregation')}
          className={`flex-1 py-2 px-4 text-sm rounded-md font-medium transition-colors ${
            dataTableSubTab === 'aggregation'
              ? (theme === 'dark' ? 'bg-white/20 text-white' : 'bg-white text-gray-800 shadow')
              : (theme === 'dark' ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-800')
          }`}
        >
          <Layers size={14} className="inline mr-2" />集計条件
        </button>
        <button
          onClick={() => setDataTableSubTab('pivot')}
          className={`flex-1 py-2 px-4 text-sm rounded-md font-medium transition-colors ${
            dataTableSubTab === 'pivot'
              ? (theme === 'dark' ? 'bg-white/20 text-white' : 'bg-white text-gray-800 shadow')
              : (theme === 'dark' ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-800')
          }`}
        >
          <TrendingUp size={14} className="inline mr-2" />ピボット
        </button>
        <button
          onClick={() => setDataTableSubTab('comparison')}
          className={`flex-1 py-2 px-4 text-sm rounded-md font-medium transition-colors ${
            dataTableSubTab === 'comparison'
              ? (theme === 'dark' ? 'bg-white/20 text-white' : 'bg-white text-gray-800 shadow')
              : (theme === 'dark' ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-800')
          }`}
        >
          <GitCompare size={14} className="inline mr-2" />比較テーブル
        </button>
        <button
          onClick={() => setDataTableSubTab('vendorPivot')}
          className={`flex-1 py-2 px-4 text-sm rounded-md font-medium transition-colors ${
            dataTableSubTab === 'vendorPivot'
              ? (theme === 'dark' ? 'bg-white/20 text-white' : 'bg-white text-gray-800 shadow')
              : (theme === 'dark' ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-800')
          }`}
        >
          <Grid3X3 size={14} className="inline mr-2" />クロス集計
        </button>
      </div>

      {/* データテーブルサブタブ — 2カラム プロパティインスペクター */}
      {dataTableSubTab === 'tables' && (() => {
        // 共通スタイル定数
        const lbl = `block text-xs font-medium ${labelSmClass}`;
        const inp = `${inputClass} rounded-lg px-3 py-2 text-sm h-auto outline-none transition-colors focus:border-indigo-500`;
        const sel = `${inputClass} rounded-lg px-3 py-2 text-sm h-auto outline-none cursor-pointer focus:border-indigo-500`;
        const sepCls = `border-t pt-2 ${theme === 'dark' ? 'border-white/[0.06]' : 'border-gray-100'}`;

        // フィールド検索フィルタ
        const availableFields = allFields.filter(f => !f.isComposite);
        const filteredFields = availableFields.filter(f =>
          !fieldSearch || (f.label || f.id).toLowerCase().includes(fieldSearch.toLowerCase())
        );

        const metricFilterCount = (activeTable?.metricFilters || []).length + (activeTable?.columnFilters || []).length;

        return (
          <div className="flex h-full min-h-0 gap-0" style={{ minHeight: '480px' }}>
            {/* 左ペイン: テーブル一覧 */}
            <div className={`w-36 flex-shrink-0 border-r flex flex-col ${theme === 'dark' ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex-1 overflow-y-auto">
                {dataTables.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTableId(t.id)}
                    className={`w-full text-left px-3 py-2 text-[11px] border-b transition-colors ${
                      selectedTableId === t.id
                        ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300 border-white/5' : 'bg-indigo-50 text-indigo-700 border-gray-200')
                        : (theme === 'dark' ? 'text-white/60 hover:text-white hover:bg-white/5 border-white/5' : 'text-gray-600 hover:bg-gray-100 border-gray-100')
                    }`}
                  >
                    {t.name || t.id}
                  </button>
                ))}
              </div>
              <div className={`p-2 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                <button
                  onClick={handleAddTable}
                  className={`w-full text-[10px] py-1.5 rounded border border-dashed transition-colors ${theme === 'dark' ? 'border-white/20 text-white/40 hover:border-white/40 hover:text-white/60' : 'border-gray-300 text-gray-400 hover:text-gray-600'}`}
                >
                  + テーブル追加
                </button>
              </div>
            </div>

            {/* 右ペイン: 選択中テーブルの設定 */}
            {activeTable ? (
              <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                {/* ヘッダー: テーブル名 + アクション */}
                <div className={`flex items-center justify-between px-3 py-2 border-b flex-shrink-0 ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                  <span className={`text-[11px] font-semibold truncate mr-2 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{activeTable.name || activeTable.id}</span>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleDuplicateTable(activeTable.id)}
                      className={`text-[10px] px-2 py-1 rounded flex items-center gap-1 ${theme === 'dark' ? 'bg-sky-500/20 hover:bg-sky-500/30 text-sky-300' : 'bg-sky-100 hover:bg-sky-200 text-sky-700'}`}
                    >
                      <Copy size={10} /> 複製
                    </button>
                    {dataTables.length > 1 && (
                      <button
                        onClick={() => handleRemoveTable(activeTable.id)}
                        className={`text-[10px] px-2 py-1 rounded flex items-center gap-1 ${theme === 'dark' ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300' : 'bg-rose-100 hover:bg-rose-200 text-rose-700'}`}
                      >
                        <Trash2 size={10} /> 削除
                      </button>
                    )}
                  </div>
                </div>

                {/* スクロール可能な設定フォーム */}
                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0">

                  {/* セクション1: 基本 */}
                  <div className="space-y-2 pb-2">
                    <div>
                      <label className={lbl}>テーブル名</label>
                      <input
                        type="text"
                        value={activeTable.name}
                        onChange={(e) => updateTableConfig(activeTable.id, 'name', e.target.value)}
                        className={`${inp} w-full mt-0.5`}
                      />
                    </div>
                    <div>
                      <label className={lbl}>デフォルト集計条件</label>
                      <select
                        value={activeTable.defaultGroupBy || ''}
                        onChange={(e) => updateTableConfig(activeTable.id, 'defaultGroupBy', e.target.value)}
                        className={`${sel} w-full mt-0.5`}
                      >
                        <option value="" className={optionClass}>集計条件なし（表示項目を使用）</option>
                        {(localConfig.aggregationConfigs || []).map(agg => (
                          <option key={agg.id} value={agg.id} className={optionClass}>{agg.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className={lbl}>横幅</label>
                        <select
                          value={activeTable.width || 'full'}
                          onChange={(e) => updateTableConfig(activeTable.id, 'width', e.target.value)}
                          className={`${sel} w-full mt-0.5`}
                        >
                          <option value="full" className={optionClass}>100%</option>
                          <option value="twoThird" className={optionClass}>2/3</option>
                          <option value="half" className={optionClass}>1/2</option>
                          <option value="third" className={optionClass}>1/3</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className={lbl}>表示件数</label>
                        <input
                          type="number"
                          min="0"
                          value={activeTable.displayLimit ?? 0}
                          onChange={(e) => updateTableConfig(activeTable.id, 'displayLimit', parseInt(e.target.value) || 0)}
                          className={`${inp} w-full mt-0.5`}
                          placeholder="0=全件"
                        />
                      </div>
                    </div>
                  </div>

                  {/* セクション2: ソート */}
                  <div className={`${sepCls} space-y-2 pb-2`}>
                    <div className="flex gap-2">
                      <div className="flex-[2]">
                        <label className={lbl}>ソート項目</label>
                        <select
                          value={activeTable.defaultSortField || ''}
                          onChange={(e) => updateTableConfig(activeTable.id, 'defaultSortField', e.target.value)}
                          className={`${sel} w-full mt-0.5`}
                        >
                          <option value="" className={optionClass}>なし</option>
                          {allFields.map(f => (
                            <option key={f.id} value={f.id} className={optionClass}>{f.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className={lbl}>順</label>
                        <select
                          value={activeTable.defaultSortDirection || 'asc'}
                          onChange={(e) => updateTableConfig(activeTable.id, 'defaultSortDirection', e.target.value)}
                          className={`${sel} w-full mt-0.5`}
                        >
                          <option value="asc" className={optionClass}>昇順 ↑</option>
                          <option value="desc" className={optionClass}>降順 ↓</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* セクション3: レイアウト */}
                  <div className={`${sepCls} space-y-2 pb-2`}>
                    <div className="flex gap-2">
                      <div className="w-1/4">
                        <label className={lbl}>固定列数</label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={activeTable.stickyColumns ?? 0}
                          onChange={(e) => updateTableConfig(activeTable.id, 'stickyColumns', parseInt(e.target.value) || 0)}
                          className={`${inp} w-full mt-0.5`}
                        />
                      </div>
                      <div className="w-1/2">
                        <label className={lbl}>最大高さ px</label>
                        <input
                          type="number"
                          min={100}
                          max={2000}
                          step={50}
                          value={activeTable.maxHeight || 600}
                          onChange={(e) => updateTableConfig(activeTable.id, 'maxHeight', parseInt(e.target.value) || 600)}
                          className={`${inp} w-full mt-0.5`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* セクション4: 文字サイズ */}
                  <div className={`${sepCls} space-y-1 pb-2`}>
                    <div className={`mb-2 text-xs font-semibold ${labelSmClass}`}>文字サイズ (px)</div>
                    <div className="flex gap-1">
                      <div className="flex-1">
                        <label className={lbl}>全体</label>
                        <input
                          type="number"
                          min={8}
                          max={20}
                          value={activeTable.fontSize || 12}
                          onChange={(e) => updateTableConfig(activeTable.id, 'fontSize', parseInt(e.target.value) || 12)}
                          className={`${inp} w-full mt-0.5`}
                        />
                      </div>
                      <div className="flex-1">
                        <label className={lbl}>ヘッダー</label>
                        <input
                          type="number"
                          min={8}
                          max={20}
                          value={activeTable.headerFontSize || ''}
                          placeholder="自動"
                          onChange={(e) => updateTableConfig(activeTable.id, 'headerFontSize', parseInt(e.target.value) || null)}
                          className={`${inp} w-full mt-0.5`}
                        />
                      </div>
                      <div className="flex-1">
                        <label className={lbl}>合計値</label>
                        <input
                          type="number"
                          min={8}
                          max={20}
                          value={activeTable.summaryFontSize || ''}
                          placeholder="自動"
                          onChange={(e) => updateTableConfig(activeTable.id, 'summaryFontSize', parseInt(e.target.value) || null)}
                          className={`${inp} w-full mt-0.5`}
                        />
                      </div>
                      <div className="flex-1">
                        <label className={lbl}>データ行</label>
                        <input
                          type="number"
                          min={8}
                          max={20}
                          value={activeTable.dataFontSize || ''}
                          placeholder="自動"
                          onChange={(e) => updateTableConfig(activeTable.id, 'dataFontSize', parseInt(e.target.value) || null)}
                          className={`${inp} w-full mt-0.5`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* セクション5: 行高さ */}
                  {(() => {
                    // プレースホルダの「自動(N)」は実際の描画（resolveDataTableDensity）と同じ値にする。
                    // ここがずれると設定画面とボードの見た目が食い違う。
                    const autoDensity = resolveDataTableDensity(activeTable);
                    return (
                  <div className={`${sepCls} space-y-1 pb-2`}>
                    <div className={`mb-2 text-xs font-semibold ${labelSmClass}`}>行高さ (px)</div>
                    <div className="flex gap-1">
                      <div className="flex-1">
                        <label className={lbl}>ヘッダー</label>
                        <input
                          type="number"
                          min={16}
                          max={80}
                          value={activeTable.headerRowHeight || ''}
                          placeholder={`自動(${autoDensity.headerRowHeight})`}
                          onChange={(e) => updateTableConfig(activeTable.id, 'headerRowHeight', e.target.value ? parseInt(e.target.value) : null)}
                          className={`${inp} w-full mt-0.5`}
                        />
                      </div>
                      <div className="flex-1">
                        <label className={lbl}>合計値</label>
                        <input
                          type="number"
                          min={16}
                          max={80}
                          value={activeTable.summaryRowHeight || ''}
                          placeholder={`自動(${autoDensity.summaryRowHeight})`}
                          onChange={(e) => updateTableConfig(activeTable.id, 'summaryRowHeight', e.target.value ? parseInt(e.target.value) : null)}
                          className={`${inp} w-full mt-0.5`}
                        />
                      </div>
                      <div className="flex-1">
                        <label className={lbl}>データ行</label>
                        <input
                          type="number"
                          min={16}
                          max={80}
                          value={activeTable.dataRowHeight || ''}
                          placeholder={`自動(${autoDensity.dataRowHeight})`}
                          onChange={(e) => updateTableConfig(activeTable.id, 'dataRowHeight', e.target.value ? parseInt(e.target.value) : null)}
                          className={`${inp} w-full mt-0.5`}
                        />
                      </div>
                    </div>
                  </div>
                    );
                  })()}

                  {/* セクション6: 指標フィルター (accordion) */}
                  <div className={sepCls}>
                    <button
                      onClick={() => setFiltersOpen(v => !v)}
                      className={`w-full flex items-center justify-between py-1 text-[10px] font-semibold ${theme === 'dark' ? 'text-white/50 hover:text-white/80' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
                    >
                      <span className="flex items-center gap-1">
                        <Filter size={9} />
                        指標フィルター
                        {metricFilterCount > 0 && (
                          <span className={`ml-1 rounded px-1 text-[9px] ${theme === 'dark' ? 'bg-white/10 text-white/50' : 'bg-gray-200 text-gray-500'}`}>{metricFilterCount}</span>
                        )}
                      </span>
                      {filtersOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    </button>
                    {filtersOpen && (
                      <div className="mt-1 space-y-1 pb-2">
                        {/* 指標フィルター */}
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs ${labelXsClass}`}>指標値フィルター</span>
                          <button
                            onClick={() => {
                              const current = activeTable.metricFilters || [];
                              updateTableConfig(activeTable.id, 'metricFilters', [
                                ...current,
                                { id: `mf_${Date.now()}`, field: '', operator: 'equals', value: 0, action: 'exclude' }
                              ]);
                            }}
                            className={`text-[9px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${theme === 'dark' ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300' : 'bg-amber-100 hover:bg-amber-200 text-amber-700'}`}
                          >
                            <Plus size={8} /> 追加
                          </button>
                        </div>
                        {(activeTable.metricFilters || []).length === 0 && (
                          <p className={`text-[9px] ${theme === 'dark' ? 'text-white/25' : 'text-gray-400'}`}>指標の値で行をフィルター</p>
                        )}
                        {(activeTable.metricFilters || []).map((mf, mfIdx) => (
                          <div key={mf.id} className={`flex items-center gap-1 p-1.5 rounded ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                            <select
                              value={mf.field}
                              onChange={(e) => {
                                const updated = [...(activeTable.metricFilters || [])];
                                updated[mfIdx] = { ...mf, field: e.target.value };
                                updateTableConfig(activeTable.id, 'metricFilters', updated);
                              }}
                              className={`${sel} flex-1 min-w-0`}
                            >
                              <option value="" className={optionClass}>指標を選択</option>
                              {allFields.filter(f => f.type === 'number').map(f => (
                                <option key={f.id} value={f.id} className={optionClass}>{f.label}</option>
                              ))}
                            </select>
                            <select
                              value={mf.operator}
                              onChange={(e) => {
                                const updated = [...(activeTable.metricFilters || [])];
                                updated[mfIdx] = { ...mf, operator: e.target.value };
                                updateTableConfig(activeTable.id, 'metricFilters', updated);
                              }}
                              className={`${sel} w-12`}
                            >
                              <option value="equals" className={optionClass}>=</option>
                              <option value="notEquals" className={optionClass}>≠</option>
                              <option value="greaterThan" className={optionClass}>{'>'}</option>
                              <option value="lessThan" className={optionClass}>{'<'}</option>
                              <option value="greaterOrEqual" className={optionClass}>≥</option>
                              <option value="lessOrEqual" className={optionClass}>≤</option>
                            </select>
                            <input
                              type="number"
                              value={mf.value}
                              onChange={(e) => {
                                const updated = [...(activeTable.metricFilters || [])];
                                updated[mfIdx] = { ...mf, value: parseFloat(e.target.value) || 0 };
                                updateTableConfig(activeTable.id, 'metricFilters', updated);
                              }}
                              className={`${inp} w-14`}
                            />
                            <select
                              value={mf.action}
                              onChange={(e) => {
                                const updated = [...(activeTable.metricFilters || [])];
                                updated[mfIdx] = { ...mf, action: e.target.value };
                                updateTableConfig(activeTable.id, 'metricFilters', updated);
                              }}
                              className={`${sel} w-14`}
                            >
                              <option value="exclude" className={optionClass}>除外</option>
                              <option value="include" className={optionClass}>のみ</option>
                            </select>
                            <button
                              onClick={() => {
                                const updated = (activeTable.metricFilters || []).filter((_, i) => i !== mfIdx);
                                updateTableConfig(activeTable.id, 'metricFilters', updated);
                              }}
                              className={`p-0.5 rounded hover:bg-rose-500/20 ${theme === 'dark' ? 'text-white/30 hover:text-rose-300' : 'text-gray-400 hover:text-rose-500'}`}
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}

                        {/* カラム値フィルター */}
                        <div className={`mt-2 pt-2 border-t ${theme === 'dark' ? 'border-white/[0.06]' : 'border-gray-100'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs ${labelXsClass}`}>カラム値フィルター</span>
                            <button
                              onClick={() => {
                                const current = activeTable.columnFilters || [];
                                updateTableConfig(activeTable.id, 'columnFilters', [
                                  ...current,
                                  { id: `cf_${Date.now()}`, field: '', operator: 'equals', value: '', action: 'include' }
                                ]);
                              }}
                              className={`text-[9px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${theme === 'dark' ? 'bg-teal-500/20 hover:bg-teal-500/30 text-teal-300' : 'bg-teal-100 hover:bg-teal-200 text-teal-700'}`}
                            >
                              <Plus size={8} /> 追加
                            </button>
                          </div>
                          {(activeTable.columnFilters || []).length === 0 && (
                            <p className={`text-[9px] ${theme === 'dark' ? 'text-white/25' : 'text-gray-400'}`}>カンマ区切りで複数値指定可</p>
                          )}
                          {(activeTable.columnFilters || []).map((cf, cfIdx) => (
                            <div key={cf.id} className={`flex items-center gap-1 mb-1 p-1.5 rounded ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                              <select
                                value={cf.field}
                                onChange={(e) => {
                                  const updated = [...(activeTable.columnFilters || [])];
                                  updated[cfIdx] = { ...cf, field: e.target.value };
                                  updateTableConfig(activeTable.id, 'columnFilters', updated);
                                }}
                                className={`${sel} flex-1 min-w-0`}
                              >
                                <option value="" className={optionClass}>カラムを選択</option>
                                {allFields.map(f => (
                                  <option key={f.id} value={f.id} className={optionClass}>{f.label}</option>
                                ))}
                              </select>
                              <select
                                value={cf.operator}
                                onChange={(e) => {
                                  const updated = [...(activeTable.columnFilters || [])];
                                  updated[cfIdx] = { ...cf, operator: e.target.value };
                                  updateTableConfig(activeTable.id, 'columnFilters', updated);
                                }}
                                className={`${sel} w-16`}
                              >
                                <option value="equals" className={optionClass}>一致</option>
                                <option value="notEquals" className={optionClass}>不一致</option>
                                <option value="contains" className={optionClass}>含む</option>
                                <option value="notContains" className={optionClass}>含まない</option>
                              </select>
                              <input
                                type="text"
                                value={cf.value}
                                onChange={(e) => {
                                  const updated = [...(activeTable.columnFilters || [])];
                                  updated[cfIdx] = { ...cf, value: e.target.value };
                                  updateTableConfig(activeTable.id, 'columnFilters', updated);
                                }}
                                className={`${inp} flex-1 min-w-0`}
                                placeholder="値1, 値2..."
                              />
                              <select
                                value={cf.action}
                                onChange={(e) => {
                                  const updated = [...(activeTable.columnFilters || [])];
                                  updated[cfIdx] = { ...cf, action: e.target.value };
                                  updateTableConfig(activeTable.id, 'columnFilters', updated);
                                }}
                                className={`${sel} w-12`}
                              >
                                <option value="include" className={optionClass}>のみ</option>
                                <option value="exclude" className={optionClass}>除外</option>
                              </select>
                              <button
                                onClick={() => {
                                  const updated = (activeTable.columnFilters || []).filter((_, i) => i !== cfIdx);
                                  updateTableConfig(activeTable.id, 'columnFilters', updated);
                                }}
                                className={`p-0.5 rounded hover:bg-rose-500/20 ${theme === 'dark' ? 'text-white/30 hover:text-rose-300' : 'text-gray-400 hover:text-rose-500'}`}
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* セクション7: 表示フィールド順序 (accordion) */}
                  <div className={sepCls}>
                    <button
                      onClick={() => setFieldsOpen(v => !v)}
                      className={`w-full flex items-center justify-between py-1 text-[10px] font-semibold ${theme === 'dark' ? 'text-white/50 hover:text-white/80' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
                    >
                      <span className="flex items-center gap-1">
                        <List size={9} />
                        表示フィールド順序
                      </span>
                      {fieldsOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    </button>
                    {fieldsOpen && (
                      <div className="mt-1 pb-2 space-y-2">
                        {/* ドラッグ並び替え */}
                        <p className={`text-[9px] ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>ドラッグ&ドロップで並び替え</p>
                        <div className="flex flex-wrap items-center justify-start">
                          {activeTableFields.map((field, idx) => {
                            const isDragging = dragState.dragging === field.id;
                            return (
                              <React.Fragment key={`sort_${field.id}`}>
                                {idx > 0 && (
                                  <div
                                    className={`h-7 rounded transition-all duration-150 ${dragState.hoverIdx === idx && dragState.dragging && !isDragging ? 'w-16 bg-indigo-400/30' : isDragging ? 'w-0' : 'w-2'}`}
                                    onDragOver={(e) => { e.preventDefault(); setDragState(s => ({ ...s, hoverIdx: idx })); }}
                                    onDragLeave={() => setDragState(s => ({ ...s, hoverIdx: null }))}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      if (!dragState.dragging || dragState.dragging === field.id) return;
                                      const fields = [...activeTable.fields];
                                      const fromIdx = fields.indexOf(dragState.dragging);
                                      if (fromIdx === -1) return;
                                      fields.splice(fromIdx, 1);
                                      const toIdx = fields.indexOf(field.id);
                                      fields.splice(toIdx, 0, dragState.dragging);
                                      updateTableConfig(activeTable.id, 'fields', fields);
                                      setDragState({ dragging: null, hoverIdx: null });
                                    }}
                                  />
                                )}
                                <div
                                  draggable
                                  onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragState({ dragging: field.id, hoverIdx: null }); }}
                                  onDragEnd={() => setDragState({ dragging: null, hoverIdx: null })}
                                  onDragOver={(e) => { e.preventDefault(); setDragState(s => ({ ...s, hoverIdx: idx })); }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    if (!dragState.dragging || dragState.dragging === field.id) return;
                                    const fields = [...activeTable.fields];
                                    const fromIdx = fields.indexOf(dragState.dragging);
                                    if (fromIdx === -1) return;
                                    fields.splice(fromIdx, 1);
                                    const toIdx = fields.indexOf(field.id);
                                    fields.splice(toIdx, 0, dragState.dragging);
                                    updateTableConfig(activeTable.id, 'fields', fields);
                                    setDragState({ dragging: null, hoverIdx: null });
                                  }}
                                  className={`flex items-center gap-1 px-2 py-1 my-0.5 rounded cursor-move transition-all duration-150 text-[10px] ${field._isIndicatorGroup ? (theme === 'dark' ? 'bg-purple-500/20 text-purple-200 border border-purple-500/30 hover:bg-purple-500/30' : 'bg-purple-100 text-purple-800 border border-purple-300 hover:bg-purple-200') : (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 hover:bg-indigo-500/30' : 'bg-indigo-100 text-indigo-800 border border-indigo-300 hover:bg-indigo-200')} ${isDragging ? 'opacity-40' : ''}`}
                                >
                                  <GripVertical size={10} className="opacity-50" />
                                  <span className="whitespace-nowrap">{field.label}</span>
                                  {field._isIndicatorGroup && <span className={`text-[8px] px-0.5 py-0.5 rounded ${theme === 'dark' ? 'bg-purple-500/30 text-purple-200' : 'bg-purple-200 text-purple-700'}`}>G</span>}
                                </div>
                              </React.Fragment>
                            );
                          })}
                          <div
                            className={`h-7 rounded transition-all duration-150 ${dragState.hoverIdx === activeTableFields.length && dragState.dragging ? 'w-16 bg-indigo-400/30' : 'w-2'}`}
                            onDragOver={(e) => { e.preventDefault(); setDragState(s => ({ ...s, hoverIdx: activeTableFields.length })); }}
                            onDragLeave={() => setDragState(s => ({ ...s, hoverIdx: null }))}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (!dragState.dragging) return;
                              const fields = [...activeTable.fields];
                              const fromIdx = fields.indexOf(dragState.dragging);
                              if (fromIdx === -1) return;
                              fields.splice(fromIdx, 1);
                              fields.push(dragState.dragging);
                              updateTableConfig(activeTable.id, 'fields', fields);
                              setDragState({ dragging: null, hoverIdx: null });
                            }}
                          />
                        </div>

                        {/* フィールド検索ボックス */}
                        <div className="relative">
                          <input
                            type="text"
                            value={fieldSearch}
                            onChange={e => setFieldSearch(e.target.value)}
                            placeholder="フィールドを検索..."
                            className={`${inp} w-full pr-5`}
                          />
                          {fieldSearch && (
                            <button
                              onClick={() => setFieldSearch('')}
                              className={`absolute right-1 top-1/2 -translate-y-1/2 opacity-50 ${theme === 'dark' ? 'text-white' : 'text-gray-600'}`}
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>

                        {/* チェックボックスリスト */}
                        <div className="grid grid-cols-4 gap-1">
                          {filteredFields.map((field) => {
                            const isSelected = activeTable.fields.includes(field.id);
                            const isGroup = field._isIndicatorGroup;
                            const belongsToGroup = !isGroup && (localConfig.indicatorGroups || []).find(g =>
                              (g.memberCalcIds || []).includes(field.id)
                            );
                            return (
                              <button
                                key={`tbl_${activeTable.id}_${field.id}`}
                                onClick={() => toggleTableField(activeTable.id, field.id)}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded text-left text-[10px] transition-all ${
                                  isSelected
                                    ? (isGroup
                                        ? (theme === 'dark' ? 'bg-purple-500/20 text-purple-100 border border-purple-500/30' : 'bg-purple-100 text-purple-800 border border-purple-300')
                                        : (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-100 border border-indigo-500/30' : 'bg-indigo-100 text-indigo-800 border border-indigo-300'))
                                    : ((theme === 'dark' ? 'text-white/40 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100') + ' border border-transparent')
                                }`}
                              >
                                {isSelected ? <CheckSquare size={11} /> : <Square size={11} />}
                                <span className="truncate">{field.label}</span>
                                {isGroup && <span className={`text-[8px] px-0.5 rounded flex-shrink-0 ${theme === 'dark' ? 'bg-purple-500/30 text-purple-200' : 'bg-purple-200 text-purple-700'}`}>G</span>}
                                {belongsToGroup && <span className={`text-[8px] px-0.5 rounded flex-shrink-0 ${theme === 'dark' ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-600'}`}>{belongsToGroup.label}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 保存ボタン用スペーサー */}
                  <div className="h-12" />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className={`text-[11px] ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>テーブルを選択してください</p>
              </div>
            )}
          </div>
        );
      })()}

      {/* 集計条件サブタブ */}
      {dataTableSubTab === 'aggregation' && (
        <div className={`rounded-2xl p-6 ${glassClass}`}>
          <div className="flex justify-between items-center mb-6">
            <h3 className={`text-lg font-semibold flex items-center gap-2 ${textClass}`}>
              <Layers size={20} className="text-purple-400" /> 集計条件設定
            </h3>
            <button
              onClick={() => {
                const newId = `agg_${Date.now()}`;
                const baseConfigs = localConfig.aggregationConfigs && localConfig.aggregationConfigs.length > 0
                  ? localConfig.aggregationConfigs
                  : DEFAULT_AGGREGATION_CONFIGS;
                const defaultDisplayFields = activeTable ? [...activeTable.fields] : [];
                const newConfigs = [...baseConfigs, {
                  id: newId,
                  label: '新しい集計',
                  groupByField: '',
                  displayFields: defaultDisplayFields
                }];
                updateLocalConfig('aggregationConfigs', newConfigs);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors ${theme === 'dark' ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300' : 'bg-purple-100 hover:bg-purple-200 text-purple-700'}`}
            >
              <Plus size={16} /> 集計条件を追加
            </button>
          </div>

          <div className="space-y-4">
            {(localConfig.aggregationConfigs && localConfig.aggregationConfigs.length > 0
              ? localConfig.aggregationConfigs
              : DEFAULT_AGGREGATION_CONFIGS
            ).map((aggConfig, index) => {
              const currentConfigs = localConfig.aggregationConfigs && localConfig.aggregationConfigs.length > 0
                ? localConfig.aggregationConfigs
                : DEFAULT_AGGREGATION_CONFIGS;

              return (
                <div key={aggConfig.id} className={`p-5 rounded-xl border relative ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold px-2 py-0.5 rounded ${theme === 'dark' ? 'text-white/80 bg-white/10' : 'text-gray-700 bg-gray-200'}`}>
                        集計 {index + 1}
                      </span>
                      <input
                        type="text"
                        value={aggConfig.label}
                        onChange={(e) => {
                          const baseConfigs = localConfig.aggregationConfigs && localConfig.aggregationConfigs.length > 0
                            ? localConfig.aggregationConfigs
                            : DEFAULT_AGGREGATION_CONFIGS;
                          const updated = baseConfigs.map(a =>
                            a.id === aggConfig.id ? { ...a, label: e.target.value } : a
                          );
                          updateLocalConfig('aggregationConfigs', updated);
                        }}
                        className={`bg-transparent border-b px-2 py-1 text-sm font-medium outline-none focus:border-purple-500 ${theme === 'dark' ? 'border-white/20 text-white' : 'border-gray-300 text-gray-800'}`}
                        placeholder="集計条件名"
                      />
                    </div>
                    {currentConfigs.length > 1 && (
                      <button
                        onClick={() => {
                          const baseConfigs = localConfig.aggregationConfigs && localConfig.aggregationConfigs.length > 0
                            ? localConfig.aggregationConfigs
                            : DEFAULT_AGGREGATION_CONFIGS;
                          const updated = baseConfigs.filter(a => a.id !== aggConfig.id);
                          updateLocalConfig('aggregationConfigs', updated);
                        }}
                        className={`hover:text-rose-400 ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  {/* ピボット集計設定 */}
                  <div className={`mb-4 p-3 rounded-lg border ${theme === 'dark' ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-indigo-50 border-indigo-200'}`}>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={aggConfig.pivotEnabled || false}
                        onChange={(e) => {
                          const baseConfigs = localConfig.aggregationConfigs?.length > 0 ? localConfig.aggregationConfigs : DEFAULT_AGGREGATION_CONFIGS;
                          const updated = baseConfigs.map(a =>
                            a.id === aggConfig.id ? { ...a, pivotEnabled: e.target.checked } : a
                          );
                          updateLocalConfig('aggregationConfigs', updated);
                        }}
                        className="text-indigo-500 rounded"
                      />
                      <span className={`text-xs font-medium ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-700'}`}>ピボット集計（月別/年別）</span>
                    </label>
                    <p className={`text-[10px] mt-1 ${theme === 'dark' ? 'text-indigo-300/60' : 'text-indigo-600'}`}>
                      日付カラムを月別/年別に変換して集計。リレーション指標も使用可能。
                    </p>

                    {aggConfig.pivotEnabled && (
                      <div className="mt-3 space-y-3">
                        <div>
                          <label className={`text-[10px] block mb-1 ${theme === 'dark' ? 'text-indigo-300/80' : 'text-indigo-600'}`}>データソース</label>
                          <select
                            value={aggConfig.pivotSourceId || ''}
                            onChange={(e) => {
                              const baseConfigs = localConfig.aggregationConfigs?.length > 0 ? localConfig.aggregationConfigs : DEFAULT_AGGREGATION_CONFIGS;
                              const updated = baseConfigs.map(a =>
                                a.id === aggConfig.id ? { ...a, pivotSourceId: e.target.value, pivotDateColumnIndex: '', pivotCountColumns: [] } : a
                              );
                              updateLocalConfig('aggregationConfigs', updated);
                            }}
                            className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs`}
                          >
                            <option value="" className={optionClass}>ソースを選択...</option>
                            {localConfig.dataSources.map(src => (
                              <option key={src.id} value={src.id} className={optionClass}>{src.name}</option>
                            ))}
                          </select>
                        </div>

                        {aggConfig.pivotSourceId && (() => {
                          const selectedSource = localConfig.dataSources.find(s => s.id === aggConfig.pivotSourceId);
                          const headers = selectedSource?.headers || [];
                          return (
                            <>
                              <div>
                                <label className={`text-[10px] block mb-1 ${theme === 'dark' ? 'text-indigo-300/80' : 'text-indigo-600'}`}>グループ化する日付カラム</label>
                                <select
                                  value={aggConfig.pivotDateColumnIndex ?? ''}
                                  onChange={(e) => {
                                    const idx = e.target.value;
                                    const colName = idx !== '' ? headers[parseInt(idx)] || '' : '';
                                    const baseConfigs = localConfig.aggregationConfigs?.length > 0 ? localConfig.aggregationConfigs : DEFAULT_AGGREGATION_CONFIGS;
                                    const updated = baseConfigs.map(a =>
                                      a.id === aggConfig.id ? { ...a, pivotDateColumnIndex: idx, pivotDateColumnName: colName } : a
                                    );
                                    updateLocalConfig('aggregationConfigs', updated);
                                  }}
                                  className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs`}
                                >
                                  <option value="" className={optionClass}>カラム選択...</option>
                                  {headers.map((h, i) => (
                                    <option key={i} value={i} className={optionClass}>{h}</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className={`text-[10px] block mb-1 ${theme === 'dark' ? 'text-indigo-300/80' : 'text-indigo-600'}`}>集計粒度</label>
                                <select
                                  value={aggConfig.pivotGranularity || 'month'}
                                  onChange={(e) => {
                                    const baseConfigs = localConfig.aggregationConfigs?.length > 0 ? localConfig.aggregationConfigs : DEFAULT_AGGREGATION_CONFIGS;
                                    const updated = baseConfigs.map(a =>
                                      a.id === aggConfig.id ? { ...a, pivotGranularity: e.target.value } : a
                                    );
                                    updateLocalConfig('aggregationConfigs', updated);
                                  }}
                                  className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs`}
                                >
                                  <option value="month" className={optionClass}>月別</option>
                                  <option value="year" className={optionClass}>年別</option>
                                </select>
                              </div>

                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <label className={`text-[10px] ${theme === 'dark' ? 'text-indigo-300/80' : 'text-indigo-600'}`}>カウント列（任意：各カラムの値有無をカウント）</label>
                                  <button
                                    onClick={() => {
                                      const newCol = {
                                        id: `pivcnt_${Date.now()}`,
                                        label: '件数',
                                        columnIndex: 0
                                      };
                                      const baseConfigs = localConfig.aggregationConfigs?.length > 0 ? localConfig.aggregationConfigs : DEFAULT_AGGREGATION_CONFIGS;
                                      const updated = baseConfigs.map(a =>
                                        a.id === aggConfig.id ? { ...a, pivotCountColumns: [...(a.pivotCountColumns || []), newCol] } : a
                                      );
                                      updateLocalConfig('aggregationConfigs', updated);
                                    }}
                                    className={`text-xs px-2 py-1 rounded ${theme === 'dark' ? 'bg-indigo-500/30 hover:bg-indigo-500/40 text-indigo-300' : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700'}`}
                                  >
                                    + 追加
                                  </button>
                                </div>

                                <div className="space-y-2">
                                  {(aggConfig.pivotCountColumns || []).map((col, colIdx) => (
                                    <div key={col.id} className={`flex gap-2 items-center p-2 rounded ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-white'}`}>
                                      <input
                                        type="text"
                                        placeholder="列名"
                                        value={col.label}
                                        onChange={(e) => {
                                          const baseConfigs = localConfig.aggregationConfigs?.length > 0 ? localConfig.aggregationConfigs : DEFAULT_AGGREGATION_CONFIGS;
                                          const updated = baseConfigs.map(a => {
                                            if (a.id !== aggConfig.id) return a;
                                            const newCols = (a.pivotCountColumns || []).map((c, i) =>
                                              i === colIdx ? { ...c, label: e.target.value } : c
                                            );
                                            return { ...a, pivotCountColumns: newCols };
                                          });
                                          updateLocalConfig('aggregationConfigs', updated);
                                        }}
                                        className={`w-24 ${inputClass} rounded px-2 py-1 text-xs`}
                                      />
                                      <select
                                        value={col.columnIndex}
                                        onChange={(e) => {
                                          const idx = parseInt(e.target.value);
                                          const colName = !isNaN(idx) ? headers[idx] || '' : '';
                                          const baseConfigs = localConfig.aggregationConfigs?.length > 0 ? localConfig.aggregationConfigs : DEFAULT_AGGREGATION_CONFIGS;
                                          const updated = baseConfigs.map(a => {
                                            if (a.id !== aggConfig.id) return a;
                                            const newCols = (a.pivotCountColumns || []).map((c, i) =>
                                              i === colIdx ? { ...c, columnIndex: idx, columnName: colName } : c
                                            );
                                            return { ...a, pivotCountColumns: newCols };
                                          });
                                          updateLocalConfig('aggregationConfigs', updated);
                                        }}
                                        className={`flex-1 ${inputClass} rounded px-2 py-1 text-xs`}
                                      >
                                        <option value="" className={optionClass}>カラム...</option>
                                        {headers.map((h, i) => (
                                          <option key={i} value={i} className={optionClass}>{h}</option>
                                        ))}
                                      </select>
                                      <button
                                        onClick={() => {
                                          const baseConfigs = localConfig.aggregationConfigs?.length > 0 ? localConfig.aggregationConfigs : DEFAULT_AGGREGATION_CONFIGS;
                                          const updated = baseConfigs.map(a => {
                                            if (a.id !== aggConfig.id) return a;
                                            return { ...a, pivotCountColumns: (a.pivotCountColumns || []).filter((_, i) => i !== colIdx) };
                                          });
                                          updateLocalConfig('aggregationConfigs', updated);
                                        }}
                                        className={`p-1 rounded hover:bg-rose-500/20 ${theme === 'dark' ? 'text-white/40 hover:text-rose-400' : 'text-gray-400 hover:text-rose-500'}`}
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <p className={`text-[10px] p-2 rounded ${theme === 'dark' ? 'bg-indigo-900/30 text-indigo-200' : 'bg-indigo-100 text-indigo-800'}`}>
                                リレーション指標・四則演算も自動的に月別/年別で集計されます
                              </p>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* ピボットOFF時のみ表示 */}
                  {!aggConfig.pivotEnabled && (
                    <>
                      {/* ソース参照展開 */}
                      <div className={`mb-4 p-3 rounded-lg border ${theme === 'dark' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={aggConfig.sourceExpand?.enabled || false}
                            onChange={(e) => {
                              const baseConfigs = localConfig.aggregationConfigs?.length > 0 ? localConfig.aggregationConfigs : DEFAULT_AGGREGATION_CONFIGS;
                              const updated = baseConfigs.map(a =>
                                a.id === aggConfig.id ? { ...a, sourceExpand: { ...a.sourceExpand, enabled: e.target.checked } } : a
                              );
                              updateLocalConfig('aggregationConfigs', updated);
                            }}
                            className="text-amber-500 rounded"
                          />
                          <span className={`text-xs font-medium ${theme === 'dark' ? 'text-amber-300' : 'text-amber-700'}`}>ソース参照展開</span>
                        </label>
                        <p className={`text-[10px] mt-1 ${theme === 'dark' ? 'text-amber-300/60' : 'text-amber-600'}`}>
                          日付×IDの行を元ソースの行ごとに展開して集計（商材別集計など）。指標計算も適用されます。
                        </p>

                        {aggConfig.sourceExpand?.enabled && (
                          <div className="mt-3 space-y-3">
                            <div>
                              <label className={`text-[10px] block mb-1 ${theme === 'dark' ? 'text-amber-300/80' : 'text-amber-600'}`}>参照ソース（日付・キーカラム設定済みのもの）</label>
                              <select
                                value={aggConfig.sourceExpand?.sourceId || ''}
                                onChange={(e) => {
                                  const baseConfigs = localConfig.aggregationConfigs?.length > 0 ? localConfig.aggregationConfigs : DEFAULT_AGGREGATION_CONFIGS;
                                  const updated = baseConfigs.map(a =>
                                    a.id === aggConfig.id ? { ...a, sourceExpand: { ...a.sourceExpand, sourceId: e.target.value, expandColumnIndex: '', valueColumnIndex: '' } } : a
                                  );
                                  updateLocalConfig('aggregationConfigs', updated);
                                }}
                                className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs`}
                              >
                                <option value="" className={optionClass}>ソースを選択...</option>
                                {localConfig.dataSources.filter(src =>
                                  src.dateColumnIndex !== null && src.dateColumnIndex !== undefined &&
                                  src.keyColumnIndex !== null && src.keyColumnIndex !== undefined
                                ).map(src => (
                                  <option key={src.id} value={src.id} className={optionClass}>{src.name}</option>
                                ))}
                              </select>
                            </div>

                            {aggConfig.sourceExpand?.sourceId && (() => {
                              const selectedSource = localConfig.dataSources.find(s => s.id === aggConfig.sourceExpand.sourceId);
                              const headers = selectedSource?.headers || [];
                              return (
                                <>
                                  <div>
                                    <label className={`text-[10px] block mb-1 ${theme === 'dark' ? 'text-amber-300/80' : 'text-amber-600'}`}>展開カラム（例：商材）</label>
                                    <select
                                      value={aggConfig.sourceExpand?.expandColumnIndex ?? ''}
                                      onChange={(e) => {
                                        const baseConfigs = localConfig.aggregationConfigs?.length > 0 ? localConfig.aggregationConfigs : DEFAULT_AGGREGATION_CONFIGS;
                                        const updated = baseConfigs.map(a =>
                                          a.id === aggConfig.id ? { ...a, sourceExpand: { ...a.sourceExpand, expandColumnIndex: e.target.value } } : a
                                        );
                                        updateLocalConfig('aggregationConfigs', updated);
                                      }}
                                      className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs`}
                                    >
                                      <option value="" className={optionClass}>カラム選択...</option>
                                      {headers.map((h, i) => (
                                        <option key={i} value={i} className={optionClass}>{h}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className={`text-[10px] block mb-1 ${theme === 'dark' ? 'text-amber-300/80' : 'text-amber-600'}`}>値カラム（任意：この値で集計）</label>
                                    <select
                                      value={aggConfig.sourceExpand?.valueColumnIndex ?? ''}
                                      onChange={(e) => {
                                        const baseConfigs = localConfig.aggregationConfigs?.length > 0 ? localConfig.aggregationConfigs : DEFAULT_AGGREGATION_CONFIGS;
                                        const updated = baseConfigs.map(a =>
                                          a.id === aggConfig.id ? { ...a, sourceExpand: { ...a.sourceExpand, valueColumnIndex: e.target.value } } : a
                                        );
                                        updateLocalConfig('aggregationConfigs', updated);
                                      }}
                                      className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs`}
                                    >
                                      <option value="" className={optionClass}>指定なし（既存の指標を使用）</option>
                                      {headers.map((h, i) => (
                                        <option key={i} value={i} className={optionClass}>{h}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <p className={`text-[10px] p-2 rounded ${theme === 'dark' ? 'bg-amber-900/30 text-amber-200' : 'bg-amber-100 text-amber-800'}`}>
                                    集計軸で「{headers[parseInt(aggConfig.sourceExpand?.expandColumnIndex)] || '展開カラム'}」を選択すると商材別に集計されます
                                  </p>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      {/* 集計軸設定 */}
                      <div>
                        <label className={`text-xs flex items-center gap-1 mb-2 ${theme === 'dark' ? 'text-purple-300/80' : 'text-purple-600'}`}>
                          <Activity size={12} /> 集計軸カラム（複数選択でクロス集計）
                        </label>
                        <div className={`rounded p-3 max-h-48 overflow-y-auto ${theme === 'dark' ? 'bg-slate-900/50 border border-purple-500/30' : 'bg-white border border-purple-300'}`}>
                          <div className="space-y-1">
                            {/* ソース参照展開の展開カラムを追加 */}
                            {aggConfig.sourceExpand?.enabled && aggConfig.sourceExpand?.sourceId && aggConfig.sourceExpand?.expandColumnIndex !== '' && (() => {
                              const selectedSource = localConfig.dataSources.find(s => s.id === aggConfig.sourceExpand.sourceId);
                              const headers = selectedSource?.headers || [];
                              const expandLabel = headers[parseInt(aggConfig.sourceExpand.expandColumnIndex)] || '展開カラム';
                              const currentGroupByFields = aggConfig.groupByFields || (aggConfig.groupByField ? [aggConfig.groupByField] : []);
                              const isSelected = currentGroupByFields.includes('_expandValue');
                              const selectionIndex = currentGroupByFields.indexOf('_expandValue');
                              return (
                                <button
                                  key="_expandValue"
                                  onClick={() => {
                                    const newFields = isSelected
                                      ? currentGroupByFields.filter(id => id !== '_expandValue')
                                      : [...currentGroupByFields, '_expandValue'];
                                    const baseConfigs = localConfig.aggregationConfigs && localConfig.aggregationConfigs.length > 0
                                      ? localConfig.aggregationConfigs
                                      : DEFAULT_AGGREGATION_CONFIGS;
                                    const updated = baseConfigs.map(a =>
                                      a.id === aggConfig.id ? { ...a, groupByFields: newFields, groupByField: newFields[0] || '' } : a
                                    );
                                    updateLocalConfig('aggregationConfigs', updated);
                                  }}
                                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-all ${
                                    isSelected
                                      ? (theme === 'dark' ? 'bg-amber-500/20 text-amber-100 border border-amber-500/30' : 'bg-amber-100 text-amber-800 border border-amber-300')
                                      : (theme === 'dark' ? 'text-amber-300/60 hover:bg-white/5 border border-transparent' : 'text-amber-600 hover:bg-amber-50 border border-transparent')
                                  }`}
                                >
                                  {isSelected ? (
                                    <span className="w-4 h-4 flex items-center justify-center bg-amber-500 text-white rounded text-[10px] font-bold">{selectionIndex + 1}</span>
                                  ) : (
                                    <Square size={12} />
                                  )}
                                  <span className="truncate">{expandLabel}（展開）</span>
                                </button>
                              );
                            })()}
                            {localConfig.systemFields.filter(f => f.type === 'string' || f.type === 'date').map(field => {
                              const currentGroupByFields = aggConfig.groupByFields || (aggConfig.groupByField ? [aggConfig.groupByField] : []);
                              const isSelected = currentGroupByFields.includes(field.id);
                              const selectionIndex = currentGroupByFields.indexOf(field.id);
                              return (
                                <button
                                  key={field.id}
                                  onClick={() => {
                                    const newFields = isSelected
                                      ? currentGroupByFields.filter(id => id !== field.id)
                                      : [...currentGroupByFields, field.id];
                                    const baseConfigs = localConfig.aggregationConfigs && localConfig.aggregationConfigs.length > 0
                                      ? localConfig.aggregationConfigs
                                      : DEFAULT_AGGREGATION_CONFIGS;
                                    const updated = baseConfigs.map(a =>
                                      a.id === aggConfig.id ? { ...a, groupByFields: newFields, groupByField: newFields[0] || '' } : a
                                    );
                                    updateLocalConfig('aggregationConfigs', updated);
                                  }}
                                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-all ${
                                    isSelected
                                      ? (theme === 'dark' ? 'bg-purple-500/20 text-purple-100 border border-purple-500/30' : 'bg-purple-100 text-purple-800 border border-purple-300')
                                      : (theme === 'dark' ? 'text-white/40 hover:bg-white/5 border border-transparent' : 'text-gray-500 hover:bg-gray-100 border border-transparent')
                                  }`}
                                >
                                  {isSelected ? (
                                    <span className="w-4 h-4 flex items-center justify-center bg-purple-500 text-white rounded text-[10px] font-bold">{selectionIndex + 1}</span>
                                  ) : (
                                    <Square size={12} />
                                  )}
                                  <span className="truncate">{field.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <p className={`text-[10px] mt-1 ${labelXsClass}`}>
                          選択順に軸が適用されます（例: 日付→リスト→部署）
                        </p>
                      </div>

                      {/* 日付変換設定 */}
                      {(() => {
                        const currentGroupByFields = aggConfig.groupByFields || (aggConfig.groupByField ? [aggConfig.groupByField] : []);
                        const dateFieldsInGroup = localConfig.systemFields.filter(f => f.type === 'date' && currentGroupByFields.includes(f.id));
                        if (dateFieldsInGroup.length === 0) return null;

                        return (
                          <div className={`mt-4 p-3 rounded-lg border ${theme === 'dark' ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-indigo-50 border-indigo-200'}`}>
                            <label className={`text-xs flex items-center gap-1 mb-2 ${theme === 'dark' ? 'text-indigo-300/80' : 'text-indigo-600'}`}>
                              <Calendar size={12} /> 日付変換（集計単位）
                            </label>
                            {dateFieldsInGroup.map(dateField => (
                              <div key={dateField.id} className="mb-2 last:mb-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs min-w-[60px] ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>{dateField.label}:</span>
                                  <select
                                    value={(aggConfig.dateTransforms && aggConfig.dateTransforms[dateField.id]) || 'none'}
                                    onChange={(e) => {
                                      const baseConfigs = localConfig.aggregationConfigs?.length > 0 ? localConfig.aggregationConfigs : DEFAULT_AGGREGATION_CONFIGS;
                                      const newDateTransforms = { ...(aggConfig.dateTransforms || {}), [dateField.id]: e.target.value };
                                      const updated = baseConfigs.map(a =>
                                        a.id === aggConfig.id ? { ...a, dateTransforms: newDateTransforms } : a
                                      );
                                      updateLocalConfig('aggregationConfigs', updated);
                                    }}
                                    className={`flex-1 ${inputClass} rounded px-2 py-1.5 text-xs`}
                                  >
                                    {DATE_TRANSFORM_OPTIONS.map(opt => (
                                      <option key={opt.id} value={opt.id} className={optionClass}>{opt.label}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            ))}
                            <p className={`text-[10px] mt-2 ${theme === 'dark' ? 'text-indigo-300/60' : 'text-indigo-500'}`}>
                              日付フィールドを月単位や年単位で集計できます
                            </p>
                          </div>
                        );
                      })()}

                      {/* 階層表示設定 */}
                      <div className={`mt-4 p-3 rounded-lg border ${theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'}`}>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={aggConfig.hierarchyEnabled || false}
                            onChange={(e) => {
                              const baseConfigs = localConfig.aggregationConfigs?.length > 0 ? localConfig.aggregationConfigs : DEFAULT_AGGREGATION_CONFIGS;
                              const updated = baseConfigs.map(a =>
                                a.id === aggConfig.id ? { ...a, hierarchyEnabled: e.target.checked } : a
                              );
                              updateLocalConfig('aggregationConfigs', updated);
                            }}
                            className="text-emerald-500 rounded"
                          />
                          <Network size={12} className={theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'} />
                          <span className={`text-xs font-medium ${theme === 'dark' ? 'text-emerald-300' : 'text-emerald-700'}`}>階層表示（グループ小計付き）</span>
                        </label>
                        <p className={`text-[10px] mt-1 ${theme === 'dark' ? 'text-emerald-300/60' : 'text-emerald-600'}`}>
                          集計軸カラムを階層レベルとして使用し、各レベルの小計行を表示します。
                        </p>

                        {aggConfig.hierarchyEnabled && (() => {
                          const currentGroupByFields = aggConfig.groupByFields || (aggConfig.groupByField ? [aggConfig.groupByField] : []);
                          const hierarchyFields = aggConfig.hierarchyFields || [];

                          if (currentGroupByFields.length < 2) {
                            return (
                              <p className={`text-[10px] mt-2 ${theme === 'dark' ? 'text-amber-300/80' : 'text-amber-600'}`}>
                                ※ 階層表示には集計軸カラムを2つ以上選択してください
                              </p>
                            );
                          }

                          // 階層フィールドとして使うのは集計軸のうち最後の1つ以外
                          // hierarchyFieldsが未設定の場合、最後の集計軸以外を自動設定
                          const validHierarchyFields = hierarchyFields.filter(f => currentGroupByFields.includes(f));

                          return (
                            <div className="mt-3 space-y-2">
                              <label className={`text-[10px] block ${theme === 'dark' ? 'text-emerald-300/80' : 'text-emerald-600'}`}>
                                階層レベル（上から順に親→子）
                              </label>
                              <div className={`rounded p-2 space-y-1 ${theme === 'dark' ? 'bg-slate-900/50 border border-emerald-500/30' : 'bg-white border border-emerald-300'}`}>
                                {/* 設定済み階層フィールド */}
                                {validHierarchyFields.map((fieldId, idx) => {
                                  const field = localConfig.systemFields.find(f => f.id === fieldId);
                                  const label = fieldId === '_expandValue' ? '展開カラム' : (field?.label || fieldId);
                                  return (
                                    <div key={fieldId} className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${theme === 'dark' ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'}`}>
                                      <span className="w-5 h-5 flex items-center justify-center bg-emerald-500 text-white rounded text-[10px] font-bold">
                                        {idx + 1}
                                      </span>
                                      <span className="flex-1 truncate">{label}</span>
                                      <div className="flex gap-1">
                                        <button
                                          disabled={idx === 0}
                                          onClick={() => {
                                            if (idx === 0) return;
                                            const newFields = [...validHierarchyFields];
                                            [newFields[idx - 1], newFields[idx]] = [newFields[idx], newFields[idx - 1]];
                                            const baseConfigs = localConfig.aggregationConfigs?.length > 0 ? localConfig.aggregationConfigs : DEFAULT_AGGREGATION_CONFIGS;
                                            const updated = baseConfigs.map(a =>
                                              a.id === aggConfig.id ? { ...a, hierarchyFields: newFields } : a
                                            );
                                            updateLocalConfig('aggregationConfigs', updated);
                                          }}
                                          className={`p-0.5 rounded ${idx === 0 ? 'opacity-30' : 'hover:bg-white/10'}`}
                                        >
                                          <ChevronUp size={12} />
                                        </button>
                                        <button
                                          disabled={idx === validHierarchyFields.length - 1}
                                          onClick={() => {
                                            if (idx === validHierarchyFields.length - 1) return;
                                            const newFields = [...validHierarchyFields];
                                            [newFields[idx], newFields[idx + 1]] = [newFields[idx + 1], newFields[idx]];
                                            const baseConfigs = localConfig.aggregationConfigs?.length > 0 ? localConfig.aggregationConfigs : DEFAULT_AGGREGATION_CONFIGS;
                                            const updated = baseConfigs.map(a =>
                                              a.id === aggConfig.id ? { ...a, hierarchyFields: newFields } : a
                                            );
                                            updateLocalConfig('aggregationConfigs', updated);
                                          }}
                                          className={`p-0.5 rounded ${idx === validHierarchyFields.length - 1 ? 'opacity-30' : 'hover:bg-white/10'}`}
                                        >
                                          <ChevronDown size={12} />
                                        </button>
                                        <button
                                          onClick={() => {
                                            const newFields = validHierarchyFields.filter(f => f !== fieldId);
                                            const baseConfigs = localConfig.aggregationConfigs?.length > 0 ? localConfig.aggregationConfigs : DEFAULT_AGGREGATION_CONFIGS;
                                            const updated = baseConfigs.map(a =>
                                              a.id === aggConfig.id ? { ...a, hierarchyFields: newFields } : a
                                            );
                                            updateLocalConfig('aggregationConfigs', updated);
                                          }}
                                          className="p-0.5 rounded hover:bg-rose-500/20 hover:text-rose-300"
                                        >
                                          <X size={12} />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* 追加可能なフィールド */}
                                {currentGroupByFields.filter(f => !validHierarchyFields.includes(f)).length > 0 && (
                                  <div className={`mt-1 pt-1 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                                    <span className={`text-[10px] ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>追加:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {currentGroupByFields.filter(f => !validHierarchyFields.includes(f)).map(fieldId => {
                                        const field = localConfig.systemFields.find(f => f.id === fieldId);
                                        const label = fieldId === '_expandValue' ? '展開カラム' : (field?.label || fieldId);
                                        return (
                                          <button
                                            key={fieldId}
                                            onClick={() => {
                                              const newFields = [...validHierarchyFields, fieldId];
                                              const baseConfigs = localConfig.aggregationConfigs?.length > 0 ? localConfig.aggregationConfigs : DEFAULT_AGGREGATION_CONFIGS;
                                              const updated = baseConfigs.map(a =>
                                                a.id === aggConfig.id ? { ...a, hierarchyFields: newFields } : a
                                              );
                                              updateLocalConfig('aggregationConfigs', updated);
                                            }}
                                            className={`px-2 py-1 rounded text-[10px] transition-all ${theme === 'dark' ? 'text-white/50 hover:bg-emerald-500/20 hover:text-emerald-300 border border-white/10' : 'text-gray-500 hover:bg-emerald-100 hover:text-emerald-700 border border-gray-200'}`}
                                          >
                                            + {label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <p className={`text-[10px] ${theme === 'dark' ? 'text-emerald-300/60' : 'text-emerald-500'}`}>
                                階層レベルに含まれない集計軸はデータ行として表示されます
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ピボットサブタブ */}
      {dataTableSubTab === 'pivot' && (
        <div className={`rounded-2xl p-6 ${glassClass}`}>
          <h4 className={`text-sm font-bold ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'} mb-4 flex items-center gap-2`}>
            <GitCompare size={14} className="text-teal-400" /> ピボット集計テーブル
          </h4>
          <p className={`text-xs ${labelXsClass} mb-4`}>
            複数の日付カラムを月別に集計し、1つのテーブルで比較表示します（例: 申込日でET数、開通日で工事完了数）
          </p>

          <PivotTableSettings
            pivotTables={pivotTables}
            activePivotId={activePivotId}
            setActivePivotId={setActivePivotId}
            localConfig={localConfig}
            updateLocalConfig={updateLocalConfig}
            theme={theme}
            inputClass={inputClass}
            labelSmClass={labelSmClass}
            labelXsClass={labelXsClass}
            labelClass={labelClass}
            cardClass={cardClass}
            borderClass={borderClass}
            optionClass={optionClass}
          />
        </div>
      )}

      {/* 比較テーブルサブタブ */}
      {dataTableSubTab === 'comparison' && (
        <div className={`rounded-2xl p-6 ${glassClass}`}>
          <div className="flex justify-between items-center mb-6">
            <h3 className={`text-lg font-semibold flex items-center gap-2 ${textClass}`}>
              <GitCompare size={20} className="text-cyan-400" /> 比較テーブル設定
            </h3>
            <button
              onClick={() => {
                const newId = `comp_${Date.now()}`;
                const newTable = {
                  id: newId,
                  label: '新規比較テーブル',
                  enabled: true,
                  segments: [],
                  layout: 'horizontal',
                  showDiff: true,
                  baseSegmentId: null,
                  width: 'full',
                  height: '1'
                };
                updateLocalConfig('comparisonTables', [...(localConfig.comparisonTables || []), newTable]);
              }}
              className="px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30 text-sm flex items-center gap-2 transition-all"
            >
              <Plus size={16} /> 比較テーブルを追加
            </button>
          </div>

          {(!localConfig.comparisonTables || localConfig.comparisonTables.length === 0) ? (
            <div className={`text-center py-12 ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>
              <GitCompare size={48} className="mx-auto mb-4 opacity-30" />
              <p>比較テーブルがありません</p>
              <p className="text-xs mt-2">「比較テーブルを追加」ボタンから作成してください</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(localConfig.comparisonTables || []).map((table, idx) => (
                <div key={table.id} className={`p-4 rounded-xl border ${cardClass}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={table.enabled !== false}
                        onChange={(e) => {
                          const updated = localConfig.comparisonTables.map(t =>
                            t.id === table.id ? { ...t, enabled: e.target.checked } : t
                          );
                          updateLocalConfig('comparisonTables', updated);
                        }}
                        className="w-4 h-4 rounded"
                      />
                      <input
                        type="text"
                        value={table.label || ''}
                        onChange={(e) => {
                          const updated = localConfig.comparisonTables.map(t =>
                            t.id === table.id ? { ...t, label: e.target.value } : t
                          );
                          updateLocalConfig('comparisonTables', updated);
                        }}
                        className={`${inputClass} rounded-lg px-3 py-1.5 text-sm font-medium`}
                        placeholder="テーブル名"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const updated = localConfig.comparisonTables.filter(t => t.id !== table.id);
                        updateLocalConfig('comparisonTables', updated);
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className={`text-xs ${labelXsClass} block mb-1`}>横幅</label>
                      <select
                        value={table.width || 'full'}
                        onChange={(e) => {
                          const updated = localConfig.comparisonTables.map(t =>
                            t.id === table.id ? { ...t, width: e.target.value } : t
                          );
                          updateLocalConfig('comparisonTables', updated);
                        }}
                        className={`w-full ${inputClass} rounded-lg px-3 py-2 text-sm outline-none cursor-pointer`}
                      >
                        <option value="oneThird" className={optionClass}>1/3</option>
                        <option value="half" className={optionClass}>1/2</option>
                        <option value="twoThird" className={optionClass}>2/3</option>
                        <option value="full" className={optionClass}>全幅</option>
                      </select>
                    </div>

                    <div>
                      <label className={`text-xs ${labelXsClass} block mb-1`}>高さ</label>
                      <select
                        value={table.height || '1'}
                        onChange={(e) => {
                          const updated = localConfig.comparisonTables.map(t =>
                            t.id === table.id ? { ...t, height: e.target.value } : t
                          );
                          updateLocalConfig('comparisonTables', updated);
                        }}
                        className={`w-full ${inputClass} rounded-lg px-3 py-2 text-sm outline-none cursor-pointer`}
                      >
                        {HEIGHT_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value} className={optionClass}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 表示指標選択 */}
                  <div className="mt-4">
                    <p className={`text-xs ${textMutedClass} mb-2`}>表示項目の並び替え (ドラッグ&ドロップ)</p>
                    <div className="flex flex-wrap items-center justify-start mb-4">
                      {(table.displayFieldIds || []).map((fieldId, fieldIdx) => {
                        const field = localConfig.systemFields?.find(f => f.id === fieldId);
                        const calc = (localConfig.calculations || []).find(c => c.id === fieldId);
                        const label = field?.label || calc?.label || fieldId;
                        const compDragId = `comp_${table.id}_${fieldId}`;
                        const isDragging = dragState.dragging === compDragId;
                        return (
                          <React.Fragment key={`comp_sort_${table.id}_${fieldId}`}>
                            {fieldIdx > 0 && (
                              <div
                                className={`h-8 rounded transition-all duration-150 ${dragState.hoverIdx === fieldIdx && dragState.dragging?.startsWith(`comp_${table.id}_`) && !isDragging ? 'w-20 bg-indigo-400/30' : isDragging ? 'w-0' : 'w-3'}`}
                                onDragOver={(e) => { e.preventDefault(); setDragState(s => ({ ...s, hoverIdx: fieldIdx })); }}
                                onDragLeave={() => setDragState(s => ({ ...s, hoverIdx: null }))}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  if (!dragState.dragging?.startsWith(`comp_${table.id}_`) || dragState.dragging === compDragId) return;
                                  const dragFieldId = dragState.dragging.replace(`comp_${table.id}_`, '');
                                  const ids = [...(table.displayFieldIds || [])];
                                  const fromIdx = ids.indexOf(dragFieldId);
                                  if (fromIdx === -1) return;
                                  ids.splice(fromIdx, 1);
                                  const toIdx = ids.indexOf(fieldId);
                                  ids.splice(toIdx, 0, dragFieldId);
                                  const updated = localConfig.comparisonTables.map(t =>
                                    t.id === table.id ? { ...t, displayFieldIds: ids } : t
                                  );
                                  updateLocalConfig('comparisonTables', updated);
                                  setDragState({ dragging: null, hoverIdx: null });
                                }}
                              />
                            )}
                            <div
                              draggable
                              onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragState({ dragging: compDragId, hoverIdx: null }); }}
                              onDragEnd={() => setDragState({ dragging: null, hoverIdx: null })}
                              onDragOver={(e) => { e.preventDefault(); setDragState(s => ({ ...s, hoverIdx: fieldIdx })); }}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (!dragState.dragging?.startsWith(`comp_${table.id}_`) || dragState.dragging === compDragId) return;
                                const dragFieldId = dragState.dragging.replace(`comp_${table.id}_`, '');
                                const ids = [...(table.displayFieldIds || [])];
                                const fromIdx = ids.indexOf(dragFieldId);
                                if (fromIdx === -1) return;
                                ids.splice(fromIdx, 1);
                                const toIdx = ids.indexOf(fieldId);
                                ids.splice(toIdx, 0, dragFieldId);
                                const updated = localConfig.comparisonTables.map(t =>
                                  t.id === table.id ? { ...t, displayFieldIds: ids } : t
                                );
                                updateLocalConfig('comparisonTables', updated);
                                setDragState({ dragging: null, hoverIdx: null });
                              }}
                              className={`flex items-center gap-2 px-3 py-1.5 my-1 rounded cursor-move transition-all duration-150 ${theme === 'dark' ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 hover:bg-indigo-500/30' : 'bg-indigo-100 text-indigo-800 border border-indigo-300 hover:bg-indigo-200'} ${
                                isDragging ? 'opacity-40' : ''
                              }`}
                            >
                              <GripVertical size={12} className="opacity-50" />
                              <span className="text-xs whitespace-nowrap">{label}</span>
                            </div>
                          </React.Fragment>
                        );
                      })}
                      {(table.displayFieldIds || []).length > 0 && (
                        <div
                          className={`h-8 rounded transition-all duration-150 ${dragState.hoverIdx === (table.displayFieldIds || []).length && dragState.dragging?.startsWith(`comp_${table.id}_`) ? 'w-20 bg-indigo-400/30' : 'w-3'}`}
                          onDragOver={(e) => { e.preventDefault(); setDragState(s => ({ ...s, hoverIdx: (table.displayFieldIds || []).length })); }}
                          onDragLeave={() => setDragState(s => ({ ...s, hoverIdx: null }))}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (!dragState.dragging?.startsWith(`comp_${table.id}_`)) return;
                            const dragFieldId = dragState.dragging.replace(`comp_${table.id}_`, '');
                            const ids = [...(table.displayFieldIds || [])];
                            const fromIdx = ids.indexOf(dragFieldId);
                            if (fromIdx === -1) return;
                            ids.splice(fromIdx, 1);
                            ids.push(dragFieldId);
                            const updated = localConfig.comparisonTables.map(t =>
                              t.id === table.id ? { ...t, displayFieldIds: ids } : t
                            );
                            updateLocalConfig('comparisonTables', updated);
                            setDragState({ dragging: null, hoverIdx: null });
                          }}
                        />
                      )}
                    </div>

                    <p className={`text-xs ${textMutedClass} mb-2`}>表示項目の選択</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {localConfig.systemFields?.filter(f => f.type === 'number').map(field => {
                        const isSelected = (table.displayFieldIds || []).includes(field.id);
                        return (
                          <button
                            key={`comp_${table.id}_field_${field.id}`}
                            onClick={() => {
                              const ids = table.displayFieldIds || [];
                              const newIds = isSelected
                                ? ids.filter(id => id !== field.id)
                                : [...ids, field.id];
                              const updated = localConfig.comparisonTables.map(t =>
                                t.id === table.id ? { ...t, displayFieldIds: newIds } : t
                              );
                              updateLocalConfig('comparisonTables', updated);
                            }}
                            className={`flex items-center gap-2 p-2 rounded text-left text-xs transition-all ${isSelected ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-100 border border-indigo-500/30' : 'bg-indigo-100 text-indigo-800 border border-indigo-300') : (theme === 'dark' ? 'text-white/40 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100') + ' border border-transparent'}`}
                          >
                            {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                            <span className="truncate">{field.label}</span>
                          </button>
                        );
                      })}
                      {(localConfig.calculations || []).map(calc => {
                        const isSelected = (table.displayFieldIds || []).includes(calc.id);
                        return (
                          <button
                            key={`comp_${table.id}_calc_${calc.id}`}
                            onClick={() => {
                              const ids = table.displayFieldIds || [];
                              const newIds = isSelected
                                ? ids.filter(id => id !== calc.id)
                                : [...ids, calc.id];
                              const updated = localConfig.comparisonTables.map(t =>
                                t.id === table.id ? { ...t, displayFieldIds: newIds } : t
                              );
                              updateLocalConfig('comparisonTables', updated);
                            }}
                            className={`flex items-center gap-2 p-2 rounded text-left text-xs transition-all ${isSelected ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-100 border border-indigo-500/30' : 'bg-indigo-100 text-indigo-800 border border-indigo-300') : (theme === 'dark' ? 'text-white/40 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100') + ' border border-transparent'}`}
                          >
                            {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                            <span className="truncate">{calc.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className={`text-xs ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'} mt-2`}>
                      未選択の場合は全ての指標を表示します
                    </p>
                  </div>

                  <div className={`text-xs ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'} mt-4`}>
                    セグメントの追加・編集はダッシュボード画面のテーブル内で行ってください
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* クロス集計サブタブ */}
      {dataTableSubTab === 'vendorPivot' && (
        <div className={`rounded-2xl p-6 ${glassClass}`}>
          <div className="flex justify-between items-center mb-6">
            <h3 className={`text-lg font-semibold flex items-center gap-2 ${textClass}`}>
              <Grid3X3 size={20} className="text-amber-400" /> クロス集計テーブル設定
            </h3>
            <button
              onClick={() => {
                const newId = `vendor_pivot_${Date.now()}`;
                const newTable = {
                  id: newId,
                  name: '新しいクロス集計テーブル',
                  enabled: true,
                  width: 'full',
                  height: '1.5',
                  sourceId: '',
                  rowField: '',
                  columnField: '',
                  metrics: [],
                  sortOrder: 'desc',
                  showTotalRow: true,
                  vendorColors: {}
                };
                updateLocalConfig('vendorPivotTables', [...(localConfig.vendorPivotTables || []), newTable]);
              }}
              className={`text-sm px-4 py-2 rounded-lg flex items-center gap-2 ${theme === 'dark' ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200' : 'bg-amber-100 hover:bg-amber-200 text-amber-700'}`}
            >
              <Plus size={16} /> テーブル追加
            </button>
          </div>

          {(localConfig.vendorPivotTables || []).length === 0 ? (
            <div className={`text-center py-12 ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>
              <Grid3X3 size={48} className="mx-auto mb-4 opacity-50" />
              <p>クロス集計テーブルがありません</p>
              <p className="text-sm mt-2">「テーブル追加」ボタンで作成してください</p>
            </div>
          ) : (
            <div className="space-y-6">
              {(localConfig.vendorPivotTables || []).map((table, tableIndex) => (
                <div key={table.id} className={`border rounded-xl p-4 ${cardClass}`}>
                  {/* ヘッダー */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b" style={{ borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={table.enabled !== false}
                        onChange={(e) => {
                          const updated = localConfig.vendorPivotTables.map(t =>
                            t.id === table.id ? { ...t, enabled: e.target.checked } : t
                          );
                          updateLocalConfig('vendorPivotTables', updated);
                        }}
                        className="rounded"
                      />
                      <input
                        type="text"
                        value={table.name}
                        onChange={(e) => {
                          const updated = localConfig.vendorPivotTables.map(t =>
                            t.id === table.id ? { ...t, name: e.target.value } : t
                          );
                          updateLocalConfig('vendorPivotTables', updated);
                        }}
                        className={`${inputClass} rounded px-3 py-1 text-sm font-medium`}
                        style={{ width: '200px' }}
                      />
                    </div>
                    <button
                      onClick={() => {
                        const updated = localConfig.vendorPivotTables.filter(t => t.id !== table.id);
                        updateLocalConfig('vendorPivotTables', updated);
                      }}
                      className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-rose-500/20 text-white/40 hover:text-rose-400' : 'hover:bg-rose-100 text-gray-400 hover:text-rose-600'}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* 基本設定 */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className={`text-xs ${labelSmClass} block mb-1`}>データソース</label>
                      <select
                        value={table.sourceId || ''}
                        onChange={(e) => {
                          const updated = localConfig.vendorPivotTables.map(t =>
                            t.id === table.id ? { ...t, sourceId: e.target.value } : t
                          );
                          updateLocalConfig('vendorPivotTables', updated);
                        }}
                        className={`w-full ${inputClass} rounded px-3 py-2 text-sm`}
                      >
                        <option value="" className={optionClass}>選択してください</option>
                        {(localConfig.dataSources || []).map(src => (
                          <option key={src.id} value={src.id} className={optionClass}>{src.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={`text-xs ${labelSmClass} block mb-1`}>横幅</label>
                      <select
                        value={table.width || 'full'}
                        onChange={(e) => {
                          const updated = localConfig.vendorPivotTables.map(t =>
                            t.id === table.id ? { ...t, width: e.target.value } : t
                          );
                          updateLocalConfig('vendorPivotTables', updated);
                        }}
                        className={`w-full ${inputClass} rounded px-3 py-2 text-sm`}
                      >
                        <option value="full" className={optionClass}>100%</option>
                        <option value="twoThird" className={optionClass}>2/3</option>
                        <option value="half" className={optionClass}>1/2</option>
                        <option value="third" className={optionClass}>1/3</option>
                      </select>
                    </div>
                    <div>
                      <label className={`text-xs ${labelSmClass} block mb-1`}>高さ</label>
                      <select
                        value={table.height || '1.5'}
                        onChange={(e) => {
                          const updated = localConfig.vendorPivotTables.map(t =>
                            t.id === table.id ? { ...t, height: e.target.value } : t
                          );
                          updateLocalConfig('vendorPivotTables', updated);
                        }}
                        className={`w-full ${inputClass} rounded px-3 py-2 text-sm`}
                      >
                        {HEIGHT_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value} className={optionClass}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={`text-xs ${labelSmClass} block mb-1`}>ソート順</label>
                      <select
                        value={table.sortOrder || 'desc'}
                        onChange={(e) => {
                          const updated = localConfig.vendorPivotTables.map(t =>
                            t.id === table.id ? { ...t, sortOrder: e.target.value } : t
                          );
                          updateLocalConfig('vendorPivotTables', updated);
                        }}
                        className={`w-full ${inputClass} rounded px-3 py-2 text-sm`}
                      >
                        <option value="desc" className={optionClass}>新しい順（降順）</option>
                        <option value="asc" className={optionClass}>古い順（昇順）</option>
                      </select>
                    </div>
                  </div>

                  {/* 軸設定 */}
                  {table.sourceId && (() => {
                    const sourceConfig = (localConfig.dataSources || []).find(s => s.id === table.sourceId);
                    const headers = sourceConfig?.headers || [];
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className={`text-xs ${labelSmClass} block mb-1`}>行軸（期間）</label>
                          <select
                            value={table.rowField || ''}
                            onChange={(e) => {
                              const updated = localConfig.vendorPivotTables.map(t =>
                                t.id === table.id ? { ...t, rowField: e.target.value } : t
                              );
                              updateLocalConfig('vendorPivotTables', updated);
                            }}
                            className={`w-full ${inputClass} rounded px-3 py-2 text-sm`}
                          >
                            <option value="" className={optionClass}>選択してください</option>
                            {headers.map((h, i) => (
                              <option key={i} value={h} className={optionClass}>{h}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={`text-xs ${labelSmClass} block mb-1`}>列軸（カテゴリ）</label>
                          <select
                            value={table.columnField || ''}
                            onChange={(e) => {
                              const updated = localConfig.vendorPivotTables.map(t =>
                                t.id === table.id ? { ...t, columnField: e.target.value } : t
                              );
                              updateLocalConfig('vendorPivotTables', updated);
                            }}
                            className={`w-full ${inputClass} rounded px-3 py-2 text-sm`}
                          >
                            <option value="" className={optionClass}>選択してください</option>
                            {headers.map((h, i) => (
                              <option key={i} value={h} className={optionClass}>{h}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 指標設定 */}
                  {table.sourceId && (() => {
                    const sourceConfig = (localConfig.dataSources || []).find(s => s.id === table.sourceId);
                    const headers = sourceConfig?.headers || [];
                    return (
                      <div className="mb-4">
                        <label className={`text-xs ${labelSmClass} block mb-2`}>指標設定</label>
                        <div className="space-y-2">
                          {(table.metrics || []).map((metric, metricIndex) => (
                            <div
                              key={metric.id}
                              draggable
                              onDragStart={() => setMetricDragState({ dragging: metric.id, hoverIdx: null, tableId: table.id })}
                              onDragEnd={() => setMetricDragState({ dragging: null, hoverIdx: null, tableId: null })}
                              onDragOver={(e) => {
                                e.preventDefault();
                                if (metricDragState.tableId === table.id) {
                                  setMetricDragState(prev => ({ ...prev, hoverIdx: metricIndex }));
                                }
                              }}
                              onDrop={() => {
                                if (metricDragState.tableId !== table.id || !metricDragState.dragging) return;
                                const metrics = [...table.metrics];
                                const fromIdx = metrics.findIndex(m => m.id === metricDragState.dragging);
                                if (fromIdx === -1 || fromIdx === metricIndex) return;
                                const [moved] = metrics.splice(fromIdx, 1);
                                metrics.splice(metricIndex, 0, moved);
                                const updated = localConfig.vendorPivotTables.map(t =>
                                  t.id === table.id ? { ...t, metrics } : t
                                );
                                updateLocalConfig('vendorPivotTables', updated);
                              }}
                              className={`flex items-center gap-2 p-2 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'} ${
                                metricDragState.tableId === table.id && metricDragState.hoverIdx === metricIndex ? 'ring-2 ring-indigo-500' : ''
                              }`}
                            >
                              <GripVertical size={14} className={`cursor-grab flex-shrink-0 ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`} />
                              <input
                                type="text"
                                value={metric.label}
                                onChange={(e) => {
                                  const newMetrics = [...table.metrics];
                                  newMetrics[metricIndex] = { ...metric, label: e.target.value };
                                  const updated = localConfig.vendorPivotTables.map(t =>
                                    t.id === table.id ? { ...t, metrics: newMetrics } : t
                                  );
                                  updateLocalConfig('vendorPivotTables', updated);
                                }}
                                placeholder="ラベル"
                                className={`${inputClass} rounded px-2 py-1 text-xs w-24`}
                              />
                              {metric.type !== 'calculated' ? (
                                <>
                                  {/* 集計タイプ選択 */}
                                  <select
                                    value={metric.aggregation || 'sum'}
                                    onChange={(e) => {
                                      const newMetrics = [...table.metrics];
                                      newMetrics[metricIndex] = { ...metric, aggregation: e.target.value };
                                      const updated = localConfig.vendorPivotTables.map(t =>
                                        t.id === table.id ? { ...t, metrics: newMetrics } : t
                                      );
                                      updateLocalConfig('vendorPivotTables', updated);
                                    }}
                                    className={`${inputClass} rounded px-2 py-1 text-xs w-24`}
                                  >
                                    <option value="sum" className={optionClass}>合計</option>
                                    <option value="count" className={optionClass}>件数</option>
                                    <option value="conditionalCount" className={optionClass}>条件付き</option>
                                    <option value="avg" className={optionClass}>平均</option>
                                  </select>

                                  {/* 条件付きカウントの場合 */}
                                  {metric.aggregation === 'conditionalCount' ? (
                                    <>
                                      <select
                                        value={metric.conditionField || ''}
                                        onChange={(e) => {
                                          const newMetrics = [...table.metrics];
                                          newMetrics[metricIndex] = { ...metric, conditionField: e.target.value };
                                          const updated = localConfig.vendorPivotTables.map(t =>
                                            t.id === table.id ? { ...t, metrics: newMetrics } : t
                                          );
                                          updateLocalConfig('vendorPivotTables', updated);
                                        }}
                                        className={`${inputClass} rounded px-2 py-1 text-xs flex-1`}
                                      >
                                        <option value="" className={optionClass}>条件フィールド</option>
                                        {headers.map((h, i) => (
                                          <option key={i} value={h} className={optionClass}>{h}</option>
                                        ))}
                                      </select>
                                      <span className={`text-xs ${textMutedClass}`}>=</span>
                                      <input
                                        type="text"
                                        value={metric.conditionValue || ''}
                                        onChange={(e) => {
                                          const newMetrics = [...table.metrics];
                                          newMetrics[metricIndex] = { ...metric, conditionValue: e.target.value };
                                          const updated = localConfig.vendorPivotTables.map(t =>
                                            t.id === table.id ? { ...t, metrics: newMetrics } : t
                                          );
                                          updateLocalConfig('vendorPivotTables', updated);
                                        }}
                                        placeholder="条件値"
                                        className={`${inputClass} rounded px-2 py-1 text-xs w-24`}
                                      />
                                    </>
                                  ) : (
                                    /* 通常の集計（合計/件数/平均）の場合 */
                                    <select
                                      value={metric.field || ''}
                                      onChange={(e) => {
                                        const newMetrics = [...table.metrics];
                                        newMetrics[metricIndex] = { ...metric, field: e.target.value };
                                        const updated = localConfig.vendorPivotTables.map(t =>
                                          t.id === table.id ? { ...t, metrics: newMetrics } : t
                                        );
                                        updateLocalConfig('vendorPivotTables', updated);
                                      }}
                                      className={`${inputClass} rounded px-2 py-1 text-xs flex-1`}
                                    >
                                      <option value="" className={optionClass}>フィールド選択</option>
                                      {headers.map((h, i) => (
                                        <option key={i} value={h} className={optionClass}>{h}</option>
                                      ))}
                                    </select>
                                  )}
                                </>
                              ) : (
                                /* 計算指標（割合）の設定 */
                                <>
                                  <select
                                    value={metric.numerator || ''}
                                    onChange={(e) => {
                                      const newMetrics = [...table.metrics];
                                      newMetrics[metricIndex] = { ...metric, numerator: e.target.value };
                                      const updated = localConfig.vendorPivotTables.map(t =>
                                        t.id === table.id ? { ...t, metrics: newMetrics } : t
                                      );
                                      updateLocalConfig('vendorPivotTables', updated);
                                    }}
                                    className={`${inputClass} rounded px-2 py-1 text-xs flex-1`}
                                  >
                                    <option value="" className={optionClass}>分子</option>
                                    {table.metrics.filter(m => m.type !== 'calculated').map(m => (
                                      <option key={m.id} value={m.id} className={optionClass}>{m.label}</option>
                                    ))}
                                  </select>
                                  <span className={`text-xs ${textMutedClass}`}>÷</span>
                                  <select
                                    value={metric.denominator || ''}
                                    onChange={(e) => {
                                      const newMetrics = [...table.metrics];
                                      newMetrics[metricIndex] = { ...metric, denominator: e.target.value };
                                      const updated = localConfig.vendorPivotTables.map(t =>
                                        t.id === table.id ? { ...t, metrics: newMetrics } : t
                                      );
                                      updateLocalConfig('vendorPivotTables', updated);
                                    }}
                                    className={`${inputClass} rounded px-2 py-1 text-xs flex-1`}
                                  >
                                    <option value="" className={optionClass}>分母</option>
                                    {table.metrics.filter(m => m.type !== 'calculated').map(m => (
                                      <option key={m.id} value={m.id} className={optionClass}>{m.label}</option>
                                    ))}
                                  </select>
                                  <span className={`text-xs ${textMutedClass}`}>×100</span>
                                </>
                              )}
                              <select
                                value={metric.format || 'number'}
                                onChange={(e) => {
                                  const newMetrics = [...table.metrics];
                                  newMetrics[metricIndex] = { ...metric, format: e.target.value };
                                  const updated = localConfig.vendorPivotTables.map(t =>
                                    t.id === table.id ? { ...t, metrics: newMetrics } : t
                                  );
                                  updateLocalConfig('vendorPivotTables', updated);
                                }}
                                className={`${inputClass} rounded px-2 py-1 text-xs w-20`}
                              >
                                <option value="number" className={optionClass}>数値</option>
                                <option value="percent" className={optionClass}>%</option>
                              </select>
                              <button
                                onClick={() => {
                                  const newMetrics = table.metrics.filter((_, i) => i !== metricIndex);
                                  const updated = localConfig.vendorPivotTables.map(t =>
                                    t.id === table.id ? { ...t, metrics: newMetrics } : t
                                  );
                                  updateLocalConfig('vendorPivotTables', updated);
                                }}
                                className={`p-1 rounded ${theme === 'dark' ? 'hover:bg-rose-500/20 text-white/40 hover:text-rose-400' : 'hover:bg-rose-100 text-gray-400 hover:text-rose-600'}`}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const newId = `metric_${Date.now()}`;
                                const newMetric = { id: newId, label: '新しい指標', field: '', aggregation: 'sum', format: 'number' };
                                const newMetrics = [...(table.metrics || []), newMetric];
                                const updated = localConfig.vendorPivotTables.map(t =>
                                  t.id === table.id ? { ...t, metrics: newMetrics } : t
                                );
                                updateLocalConfig('vendorPivotTables', updated);
                              }}
                              className={`text-xs px-3 py-1 rounded flex items-center gap-1 ${theme === 'dark' ? 'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200' : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700'}`}
                            >
                              <Plus size={12} /> 指標追加
                            </button>
                            <button
                              onClick={() => {
                                const newId = `metric_${Date.now()}`;
                                const newMetric = { id: newId, label: '割合', type: 'calculated', numerator: '', denominator: '', format: 'percent' };
                                const newMetrics = [...(table.metrics || []), newMetric];
                                const updated = localConfig.vendorPivotTables.map(t =>
                                  t.id === table.id ? { ...t, metrics: newMetrics } : t
                                );
                                updateLocalConfig('vendorPivotTables', updated);
                              }}
                              className={`text-xs px-3 py-1 rounded flex items-center gap-1 ${theme === 'dark' ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200' : 'bg-amber-100 hover:bg-amber-200 text-amber-700'}`}
                            >
                              <Plus size={12} /> 計算式追加
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 条件グループ設定 */}
                  {table.sourceId && (() => {
                    const sourceConfig = (localConfig.dataSources || []).find(s => s.id === table.sourceId);
                    const headers = sourceConfig?.headers || [];
                    const conditionGroups = table.conditionGroups || [];

                    const addConditionGroup = () => {
                      const newGroupId = `group_${Date.now()}`;
                      const newGroup = { id: newGroupId, label: '', conditions: [] };
                      const updated = localConfig.vendorPivotTables.map(t =>
                        t.id === table.id ? { ...t, conditionGroups: [...conditionGroups, newGroup] } : t
                      );
                      updateLocalConfig('vendorPivotTables', updated);
                    };

                    const removeConditionGroup = (groupIndex) => {
                      const newGroups = conditionGroups.filter((_, i) => i !== groupIndex);
                      const updated = localConfig.vendorPivotTables.map(t =>
                        t.id === table.id ? { ...t, conditionGroups: newGroups } : t
                      );
                      updateLocalConfig('vendorPivotTables', updated);
                    };

                    const updateGroupLabel = (groupIndex, label) => {
                      const newGroups = [...conditionGroups];
                      newGroups[groupIndex] = { ...newGroups[groupIndex], label };
                      const updated = localConfig.vendorPivotTables.map(t =>
                        t.id === table.id ? { ...t, conditionGroups: newGroups } : t
                      );
                      updateLocalConfig('vendorPivotTables', updated);
                    };

                    const addCondition = (groupIndex) => {
                      const newGroups = [...conditionGroups];
                      const newCondition = { field: '', operator: 'notEmpty', value: '', value2: '' };
                      newGroups[groupIndex] = {
                        ...newGroups[groupIndex],
                        conditions: [...(newGroups[groupIndex].conditions || []), newCondition]
                      };
                      const updated = localConfig.vendorPivotTables.map(t =>
                        t.id === table.id ? { ...t, conditionGroups: newGroups } : t
                      );
                      updateLocalConfig('vendorPivotTables', updated);
                    };

                    const removeCondition = (groupIndex, condIndex) => {
                      const newGroups = [...conditionGroups];
                      newGroups[groupIndex] = {
                        ...newGroups[groupIndex],
                        conditions: newGroups[groupIndex].conditions.filter((_, i) => i !== condIndex)
                      };
                      const updated = localConfig.vendorPivotTables.map(t =>
                        t.id === table.id ? { ...t, conditionGroups: newGroups } : t
                      );
                      updateLocalConfig('vendorPivotTables', updated);
                    };

                    const updateCondition = (groupIndex, condIndex, key, value) => {
                      const newGroups = [...conditionGroups];
                      const newConditions = [...newGroups[groupIndex].conditions];
                      newConditions[condIndex] = { ...newConditions[condIndex], [key]: value };
                      newGroups[groupIndex] = { ...newGroups[groupIndex], conditions: newConditions };
                      const updated = localConfig.vendorPivotTables.map(t =>
                        t.id === table.id ? { ...t, conditionGroups: newGroups } : t
                      );
                      updateLocalConfig('vendorPivotTables', updated);
                    };

                    const getOperator = (operatorId) => CONDITIONAL_OPERATORS.find(op => op.id === operatorId);

                    return (
                      <div className={`mb-4 p-3 rounded-lg ${theme === 'dark' ? 'bg-purple-500/10 border border-purple-500/30' : 'bg-purple-50 border border-purple-200'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <label className={`text-xs flex items-center gap-1 font-medium ${theme === 'dark' ? 'text-purple-300/80' : 'text-purple-600'}`}>
                            <Layers size={12} /> 条件グループ（3階層ヘッダー）
                          </label>
                          <button
                            onClick={addConditionGroup}
                            className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${theme === 'dark' ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-200' : 'bg-purple-100 hover:bg-purple-200 text-purple-700'}`}
                          >
                            <Plus size={12} /> グループ追加
                          </button>
                        </div>

                        {conditionGroups.length === 0 ? (
                          <p className={`text-[10px] ${theme === 'dark' ? 'text-purple-300/60' : 'text-purple-500'}`}>
                            条件グループを追加すると、列軸とメトリクスの間に条件別の集計が表示されます（例: ALL, 登録済み, 未登録）
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {conditionGroups.map((group, groupIndex) => (
                              <div key={group.id} className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-white'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <input
                                    type="text"
                                    value={group.label}
                                    onChange={(e) => updateGroupLabel(groupIndex, e.target.value)}
                                    placeholder="グループ名（例: ALL, 登録済み）"
                                    className={`${inputClass} rounded px-2 py-1 text-xs flex-1`}
                                  />
                                  <button
                                    onClick={() => removeConditionGroup(groupIndex)}
                                    className={`p-1 rounded ${theme === 'dark' ? 'hover:bg-rose-500/20 text-white/40 hover:text-rose-400' : 'hover:bg-rose-100 text-gray-400 hover:text-rose-600'}`}
                                  >
                                    <X size={14} />
                                  </button>
                                </div>

                                {/* 条件リスト */}
                                <div className="space-y-2">
                                  {(group.conditions || []).map((cond, condIndex) => {
                                    const operator = getOperator(cond.operator);
                                    return (
                                      <div key={condIndex} className="flex items-center gap-2 flex-wrap">
                                        <select
                                          value={cond.field || ''}
                                          onChange={(e) => updateCondition(groupIndex, condIndex, 'field', e.target.value)}
                                          className={`${inputClass} rounded px-2 py-1 text-xs`}
                                          style={{ minWidth: '120px' }}
                                        >
                                          <option value="" className={optionClass}>フィールド</option>
                                          {headers.map((h, i) => (
                                            <option key={i} value={h} className={optionClass}>{h}</option>
                                          ))}
                                        </select>
                                        <select
                                          value={cond.operator || 'notEmpty'}
                                          onChange={(e) => updateCondition(groupIndex, condIndex, 'operator', e.target.value)}
                                          className={`${inputClass} rounded px-2 py-1 text-xs`}
                                          style={{ minWidth: '100px' }}
                                        >
                                          {CONDITIONAL_OPERATORS.map(op => (
                                            <option key={op.id} value={op.id} className={optionClass}>{op.label}</option>
                                          ))}
                                        </select>
                                        {operator?.needsValue && (
                                          <input
                                            type="text"
                                            value={cond.value || ''}
                                            onChange={(e) => updateCondition(groupIndex, condIndex, 'value', e.target.value)}
                                            placeholder="値"
                                            className={`${inputClass} rounded px-2 py-1 text-xs w-20`}
                                          />
                                        )}
                                        {operator?.needsValue2 && (
                                          <>
                                            <span className={`text-xs ${textMutedClass}`}>〜</span>
                                            <input
                                              type="text"
                                              value={cond.value2 || ''}
                                              onChange={(e) => updateCondition(groupIndex, condIndex, 'value2', e.target.value)}
                                              placeholder="値2"
                                              className={`${inputClass} rounded px-2 py-1 text-xs w-20`}
                                            />
                                          </>
                                        )}
                                        <button
                                          onClick={() => removeCondition(groupIndex, condIndex)}
                                          className={`p-1 rounded ${theme === 'dark' ? 'hover:bg-rose-500/20 text-white/40 hover:text-rose-400' : 'hover:bg-rose-100 text-gray-400 hover:text-rose-600'}`}
                                        >
                                          <X size={12} />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>

                                <button
                                  onClick={() => addCondition(groupIndex)}
                                  className={`text-[10px] px-2 py-0.5 mt-2 rounded flex items-center gap-1 ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white/60' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
                                >
                                  <Plus size={10} /> 条件追加
                                </button>
                                {(group.conditions || []).length === 0 && (
                                  <p className={`text-[10px] mt-1 ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>
                                    条件なし = 全データ (ALL)
                                  </p>
                                )}
                              </div>
                            ))}

                            {/* 条件結合方法 */}
                            {conditionGroups.some(g => (g.conditions || []).length > 1) && (
                              <div className="flex items-center gap-2 mt-2">
                                <span className={`text-xs ${textMutedClass}`}>複数条件の結合:</span>
                                <select
                                  value={table.conditionLogic || 'AND'}
                                  onChange={(e) => {
                                    const updated = localConfig.vendorPivotTables.map(t =>
                                      t.id === table.id ? { ...t, conditionLogic: e.target.value } : t
                                    );
                                    updateLocalConfig('vendorPivotTables', updated);
                                  }}
                                  className={`${inputClass} rounded px-2 py-1 text-xs`}
                                >
                                  <option value="AND" className={optionClass}>AND（すべて満たす）</option>
                                  <option value="OR" className={optionClass}>OR（いずれか満たす）</option>
                                </select>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* オプション */}
                  <div className="flex flex-wrap items-center gap-4 mb-4">
                    <label className={`flex items-center gap-2 text-sm ${textClass}`}>
                      <input
                        type="checkbox"
                        checked={table.showTotalRow !== false}
                        onChange={(e) => {
                          const updated = localConfig.vendorPivotTables.map(t =>
                            t.id === table.id ? { ...t, showTotalRow: e.target.checked } : t
                          );
                          updateLocalConfig('vendorPivotTables', updated);
                        }}
                        className="rounded"
                      />
                      合計行を表示
                    </label>
                    <label className={`flex items-center gap-2 text-sm ${textClass}`}>
                      <input
                        type="checkbox"
                        checked={table.showMetricHeader !== false}
                        onChange={(e) => {
                          const updated = localConfig.vendorPivotTables.map(t =>
                            t.id === table.id ? { ...t, showMetricHeader: e.target.checked } : t
                          );
                          updateLocalConfig('vendorPivotTables', updated);
                        }}
                        className="rounded"
                      />
                      指標名ヘッダーを表示
                    </label>
                  </div>

                  {/* 日付粒度設定 */}
                  {table.sourceId && table.rowField && (() => {
                    return (
                      <div className={`mb-4 p-3 rounded-lg ${theme === 'dark' ? 'bg-indigo-500/10 border border-indigo-500/30' : 'bg-indigo-50 border border-indigo-200'}`}>
                        <label className={`text-xs flex items-center gap-1 mb-2 ${theme === 'dark' ? 'text-indigo-300/80' : 'text-indigo-600'}`}>
                          <Calendar size={12} /> 行軸の集計単位
                        </label>
                        <select
                          value={table.rowGranularity || 'month'}
                          onChange={(e) => {
                            const updated = localConfig.vendorPivotTables.map(t =>
                              t.id === table.id ? { ...t, rowGranularity: e.target.value } : t
                            );
                            updateLocalConfig('vendorPivotTables', updated);
                          }}
                          className={`${inputClass} rounded px-2 py-1.5 text-xs`}
                        >
                          {DATE_TRANSFORM_OPTIONS.map(opt => (
                            <option key={opt.id} value={opt.id} className={optionClass}>{opt.label}</option>
                          ))}
                        </select>
                        <p className={`text-[10px] mt-2 ${theme === 'dark' ? 'text-indigo-300/60' : 'text-indigo-500'}`}>
                          行軸（期間）の日付データをどの単位で集計するか選択できます
                        </p>
                      </div>
                    );
                  })()}

                  {/* テーブル専用フィルター設定 */}
                  {table.sourceId && (() => {
                    const sourceConfig = (localConfig.dataSources || []).find(s => s.id === table.sourceId);
                    const headers = sourceConfig?.headers || [];
                    const tableFilters = table.tableFilters || [];

                    const addTableFilter = () => {
                      const newId = `tableFilter_${Date.now()}`;
                      const newFilter = { id: newId, field: '', label: '', type: 'multiSelect' };
                      const updated = localConfig.vendorPivotTables.map(t =>
                        t.id === table.id ? { ...t, tableFilters: [...tableFilters, newFilter] } : t
                      );
                      updateLocalConfig('vendorPivotTables', updated);
                    };

                    const removeTableFilter = (filterIndex) => {
                      const newFilters = tableFilters.filter((_, i) => i !== filterIndex);
                      // フィルター値も削除
                      const newFilterValues = { ...(table.tableFilterValues || {}) };
                      const removedFilter = tableFilters[filterIndex];
                      if (removedFilter) delete newFilterValues[removedFilter.id];
                      const updated = localConfig.vendorPivotTables.map(t =>
                        t.id === table.id ? { ...t, tableFilters: newFilters, tableFilterValues: newFilterValues } : t
                      );
                      updateLocalConfig('vendorPivotTables', updated);
                    };

                    const updateTableFilter = (filterIndex, key, value) => {
                      const newFilters = [...tableFilters];
                      newFilters[filterIndex] = { ...newFilters[filterIndex], [key]: value };
                      const updated = localConfig.vendorPivotTables.map(t =>
                        t.id === table.id ? { ...t, tableFilters: newFilters } : t
                      );
                      updateLocalConfig('vendorPivotTables', updated);
                    };

                    return (
                      <div className={`mb-4 p-3 rounded-lg ${theme === 'dark' ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-cyan-50 border border-cyan-200'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <label className={`text-xs flex items-center gap-1 font-medium ${theme === 'dark' ? 'text-cyan-300/80' : 'text-cyan-600'}`}>
                            <Filter size={12} /> テーブル専用フィルター
                          </label>
                          <button
                            onClick={addTableFilter}
                            className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${theme === 'dark' ? 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200' : 'bg-cyan-100 hover:bg-cyan-200 text-cyan-700'}`}
                          >
                            <Plus size={12} /> フィルター追加
                          </button>
                        </div>

                        {tableFilters.length === 0 ? (
                          <p className={`text-[10px] ${theme === 'dark' ? 'text-cyan-300/60' : 'text-cyan-500'}`}>
                            テーブル上部にプルダウンフィルターを追加できます（グローバルフィルターとは独立）
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {tableFilters.map((filter, filterIndex) => (
                              <div key={filter.id} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={filter.label || ''}
                                  onChange={(e) => updateTableFilter(filterIndex, 'label', e.target.value)}
                                  placeholder="ラベル"
                                  className={`${inputClass} rounded px-2 py-1 text-xs w-24`}
                                />
                                <select
                                  value={filter.field || ''}
                                  onChange={(e) => updateTableFilter(filterIndex, 'field', e.target.value)}
                                  className={`${inputClass} rounded px-2 py-1 text-xs flex-1`}
                                >
                                  <option value="" className={optionClass}>カラム選択</option>
                                  {headers.map((h, i) => (
                                    <option key={i} value={h} className={optionClass}>{h}</option>
                                  ))}
                                </select>
                                <select
                                  value={filter.type || 'multiSelect'}
                                  onChange={(e) => updateTableFilter(filterIndex, 'type', e.target.value)}
                                  className={`${inputClass} rounded px-2 py-1 text-xs w-24`}
                                >
                                  <option value="select" className={optionClass}>単一選択</option>
                                  <option value="multiSelect" className={optionClass}>複数選択</option>
                                  <option value="dateMonth" className={optionClass}>月別選択</option>
                                </select>
                                <button
                                  onClick={() => removeTableFilter(filterIndex)}
                                  className={`p-1 rounded ${theme === 'dark' ? 'hover:bg-rose-500/20 text-white/40 hover:text-rose-400' : 'hover:bg-rose-100 text-gray-400 hover:text-rose-600'}`}
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* フィルターマッピング */}
                  {(() => {
                    const tableSourceConfig = (localConfig.dataSources || []).find(s => s.id === table.sourceId);
                    const tableSourceHeaders = tableSourceConfig?.headers || [];
                    const availableFilters = localConfig.filters || [];

                    if (availableFilters.length === 0) return null;

                    return (
                      <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                        <div className={`text-xs font-medium mb-2 ${textMutedClass}`}>フィルター連携設定</div>
                        <div className="space-y-2">
                          {availableFilters.map(filter => (
                            <div key={filter.id} className="flex items-center gap-2">
                              <span className={`text-xs w-24 ${textClass}`}>{filter.label}:</span>
                              <select
                                value={table.filterMappings?.[filter.field] ?? ''}
                                onChange={(e) => {
                                  const newMappings = { ...(table.filterMappings || {}) };
                                  if (e.target.value === '') {
                                    delete newMappings[filter.field];
                                  } else {
                                    newMappings[filter.field] = e.target.value;
                                  }
                                  const updated = localConfig.vendorPivotTables.map(t =>
                                    t.id === table.id ? { ...t, filterMappings: newMappings } : t
                                  );
                                  updateLocalConfig('vendorPivotTables', updated);
                                }}
                                className={`${inputClass} rounded px-2 py-1 text-xs flex-1`}
                              >
                                <option value="" className={optionClass}>-- 未設定 --</option>
                                {tableSourceHeaders.map((header, idx) => (
                                  <option key={idx} value={idx} className={optionClass}>
                                    {idx}: {header}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                        <div className={`text-[10px] mt-2 ${textMutedClass}`}>
                          ダッシュボードのフィルターをこのテーブルのデータソースに適用します
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AggregationTab;
