// src/apps/performance-board/components/settings/ConnectionTab.jsx
// 接続設定タブ

import React, { useState } from 'react';
import {
  Database,
  Layers,
  Plus,
  Trash2,
  Key,
  Info,
  RefreshCw,
  Calendar,
  Table,
  GitCommit,
  Settings,
  Loader2,
  Filter,
  ChevronDown,
  ChevronRight,
  Copy,
  Upload
} from 'lucide-react';
import ReshapeSettingsPanel from './ReshapeSettingsPanel';
import SoqlFieldPicker from './SoqlFieldPicker';
import SfCredentialPanel from './SfCredentialPanel';
import { buildSoqlDateFilterClause } from '../../utils/dateFilters';

const ConnectionTab = ({
  localConfig,
  updateLocalConfig,
  localApiKey,
  setLocalApiKey,
  setIsDirty,
  handleAddSource,
  handleRemoveSource,
  updateSource,
  updatePivotSettings,
  updateReshapeSettings,
  updateReshapeSettingsBatch,
  updateReshapeGroups,
  handleFetchHeadersLocal,
  isHeaderLoading,
  switchDashboard,
  allDashboards,
  theme,
  glassClass,
  inputClass,
  textClass,
  labelClass,
  labelSmClass,
  labelXsClass,
  cardClass,
  borderClass,
  optionClass,
  textMutedClass,
  sourceCache,
  onTenantChange,
  currentTenantId
}) => {
  // ソースカード折りたたみ状態: { [sourceId]: boolean }
  const [collapsedSources, setCollapsedSources] = useState({});
  const toggleSourceCollapse = (sourceId) => {
    setCollapsedSources(prev => ({ ...prev, [sourceId]: !prev[sourceId] }));
  };
  // インポート時に SoqlFieldPicker を強制再マウントさせるカウンター
  const [importCounter, setImportCounter] = useState({});

  return (
    <div className="space-y-6">
      {/* SF接続設定（テナント管理） */}
      <SfCredentialPanel
        glassClass={glassClass}
        inputClass={inputClass}
        textClass={textClass}
        labelClass={labelClass}
        labelSmClass={labelSmClass}
        labelXsClass={labelXsClass}
        cardClass={cardClass}
        borderClass={borderClass}
        optionClass={optionClass}
        onTenantChange={onTenantChange}
        currentTenantId={currentTenantId}
      />

      {/* ダッシュボード設定 */}
      <div className={`rounded-2xl p-6 ${glassClass}`}>
        <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${textClass}`}>
          <Settings size={20} className="text-sky-400" /> ダッシュボード設定
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`text-sm ${labelClass} block mb-1`}>ダッシュボード名</label>
            <input
              type="text"
              value={localConfig.name || ''}
              onChange={(e) => updateLocalConfig('name', e.target.value)}
              className={`w-full ${inputClass} rounded-lg px-4 py-2 text-sm focus:border-sky-500 outline-none transition-all`}
              placeholder="ダッシュボード名を入力"
            />
            <p className={`text-xs ${labelXsClass} mt-1`}>サイドバーに表示される名前</p>
          </div>
          <div>
            <label className={`text-sm ${labelClass} block mb-1`}>デフォルト日付フィルター</label>
            <select
              value={localConfig.defaultFilters?.dateRange || 'lastMonth'}
              onChange={(e) => updateLocalConfig('defaultFilters', { ...localConfig.defaultFilters, dateRange: e.target.value })}
              className={`w-full ${inputClass} rounded-lg px-4 py-2 text-sm focus:border-sky-500 outline-none transition-all`}
            >
              <option value="today" className={optionClass}>今日</option>
              <option value="yesterdayToToday" className={optionClass}>昨日から今日</option>
              <option value="thisWeek" className={optionClass}>今週</option>
              <option value="thisMonth" className={optionClass}>今月（月末まで）</option>
              <option value="thisMonthToToday" className={optionClass}>今月1日〜今日</option>
              <option value="thisMonth1stToYesterday" className={optionClass}>今月1日〜昨日</option>
              <option value="lastMonth" className={optionClass}>先月1日〜今日</option>
              <option value="last3Months" className={optionClass}>過去3ヶ月</option>
              <option value="thisYear" className={optionClass}>今年</option>
              <option value="all" className={optionClass}>すべて（フィルターなし）</option>
            </select>
            <p className={`text-xs ${labelXsClass} mt-1`}>ダッシュボード表示時の初期日付フィルター</p>
          </div>
        </div>

        {/* デフォルトフィルター設定 */}
        {localConfig.filters && localConfig.filters.length > 0 && (
          <div className={`mt-6 pt-6 border-t ${borderClass}`}>
            <h4 className={`text-sm font-semibold mb-3 ${textClass}`}>デフォルトフィルター</h4>
            <p className={`text-xs ${labelXsClass} mb-4`}>ダッシュボード表示時に自動的にフィルターする値を設定できます</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {localConfig.filters.map((filter) => {
                const filterConfig = localConfig.defaultFilters?.excludeFilters?.[filter.field] || {};
                const currentValues = Array.isArray(filterConfig) ? filterConfig : (filterConfig.values || []);
                const currentMode = Array.isArray(filterConfig) ? 'exclude' : (filterConfig.mode || 'exclude');
                const isIncludeMode = currentMode === 'include';
                return (
                  <div key={filter.id} className={`p-3 rounded-lg border ${cardClass}`}>
                    <div className="flex items-center justify-between mb-2">
                      <label className={`text-xs ${labelSmClass}`}>{filter.label}</label>
                      <button
                        onClick={() => {
                          const newMode = isIncludeMode ? 'exclude' : 'include';
                          updateLocalConfig('defaultFilters', {
                            ...localConfig.defaultFilters,
                            excludeFilters: {
                              ...(localConfig.defaultFilters?.excludeFilters || {}),
                              [filter.field]: { values: currentValues, mode: newMode }
                            }
                          });
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                          isIncludeMode
                            ? (theme === 'dark' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700')
                            : (theme === 'dark' ? 'bg-rose-500/20 text-rose-300' : 'bg-rose-100 text-rose-700')
                        }`}
                      >
                        {isIncludeMode ? '含む' : '除外'}
                      </button>
                    </div>
                    <input
                      type="text"
                      defaultValue={currentValues.join(', ')}
                      key={`${filter.field}-${currentValues.join(',')}`}
                      onBlur={(e) => {
                        const rawVal = e.target.value;
                        const newVal = rawVal ? rawVal.split(',').map(v => v.trim()).filter(v => v) : [];
                        updateLocalConfig('defaultFilters', {
                          ...localConfig.defaultFilters,
                          excludeFilters: {
                            ...(localConfig.defaultFilters?.excludeFilters || {}),
                            [filter.field]: { values: newVal, mode: currentMode }
                          }
                        });
                      }}
                      className={`w-full ${inputClass} rounded px-3 py-2 text-sm`}
                      placeholder={isIncludeMode ? '表示する値をカンマ区切りで入力' : '除外する値をカンマ区切りで入力'}
                    />
                    <p className={`text-[10px] ${textMutedClass} mt-1`}>
                      {isIncludeMode ? '指定した値のみ表示されます' : '指定した値は非表示になります'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 共通API設定 */}
      <div className={`rounded-2xl p-6 ${glassClass}`}>
        <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${textClass}`}>
          <Database size={20} className="text-emerald-400" /> 共通API設定
        </h3>
        <div>
          <label className={`text-sm ${labelClass} block mb-1`}>Google Sheets API Key</label>
          <input
            type="password"
            value={localApiKey}
            onChange={(e) => {
              setLocalApiKey(e.target.value);
              setIsDirty(true);
            }}
            className={`w-full ${inputClass} rounded-lg px-4 py-2 font-mono text-sm focus:border-indigo-500 outline-none transition-all`}
            placeholder="AIzaSy..."
          />
        </div>
      </div>

      {/* データソース設定 */}
      <div className={`rounded-2xl p-6 ${glassClass}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h3 className={`text-lg font-semibold flex items-center gap-2 ${textClass}`}>
            <Layers size={20} className="text-blue-400" /> データソース設定
          </h3>
          <div className={`flex items-center gap-3 px-3 py-1.5 rounded-lg border ${cardClass}`}>
            <span className={`text-xs ${labelSmClass} whitespace-nowrap`}>設定対象:</span>
            <select
              value={localConfig.id}
              onChange={(e) => switchDashboard(e.target.value)}
              className={`bg-transparent text-sm font-bold outline-none cursor-pointer ${textClass}`}
            >
              {(allDashboards ? Object.values(allDashboards) : []).map(d => (
                <option key={d.id} value={d.id} className={optionClass}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-4">
          {localConfig.dataSources.map((source, index) => (
            <div key={`${source.id}-${importCounter[source.id] || 0}`} className={`rounded-xl border ${cardClass}`}>
              <div
                className={`flex justify-between items-center px-4 py-3 cursor-pointer rounded-t-xl transition-colors ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                onClick={() => toggleSourceCollapse(source.id)}
              >
                <div className="flex items-center gap-2">
                  {collapsedSources[source.id]
                    ? <ChevronRight size={14} className={textMutedClass} />
                    : <ChevronDown size={14} className={textMutedClass} />
                  }
                  <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                    theme === 'dark' ? 'text-white/80 bg-white/10' : 'text-gray-700 bg-gray-200'
                  }`}>
                    ソース {index + 1}
                  </span>
                  {source.name && (
                    <span className={`text-xs ${textMutedClass}`}>{source.name}</span>
                  )}
                  {collapsedSources[source.id] && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${theme === 'dark' ? 'bg-sky-500/10 text-sky-400' : 'bg-sky-50 text-sky-600'}`}>
                      {source.sourceType || 'spreadsheet'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {/* ソース設定エクスポート */}
                  <button
                    onClick={() => {
                      const exportData = { ...source };
                      delete exportData.id; // IDは移行先で新規生成
                      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `source_${source.name || 'config'}_${new Date().toISOString().slice(0, 10)}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className={`${textMutedClass} hover:text-sky-400`}
                    title="ソース設定をエクスポート"
                  >
                    <Copy size={14} />
                  </button>
                  {/* ソース設定インポート */}
                  <button
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.json';
                      input.onchange = (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          try {
                            const imported = JSON.parse(ev.target.result);
                            // IDは既存を維持、その他を上書き
                            const merged = { ...source, ...imported, id: source.id };
                            updateLocalConfig('dataSources', localConfig.dataSources.map(s =>
                              s.id === source.id ? merged : s
                            ));
                            // SoqlFieldPicker を強制再マウントしてローカル state をリセット
                            setImportCounter(prev => ({ ...prev, [source.id]: (prev[source.id] || 0) + 1 }));
                          } catch (err) {
                            alert('JSONの読み込みに失敗しました: ' + err.message);
                          }
                        };
                        reader.readAsText(file);
                      };
                      input.click();
                    }}
                    className={`${textMutedClass} hover:text-emerald-400`}
                    title="ソース設定をインポート"
                  >
                    <Upload size={14} />
                  </button>
                  {localConfig.dataSources.length > 1 && (
                    <button
                      onClick={() => handleRemoveSource(source.id)}
                      className={`${textMutedClass} hover:text-rose-400`}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {!collapsedSources[source.id] && (
              <div className="px-4 pb-4 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className={`text-xs ${labelSmClass} block mb-1`}>表示名</label>
                  <input
                    type="text"
                    value={source.name}
                    onChange={(e) => updateSource(source.id, 'name', e.target.value)}
                    className={`w-full ${inputClass} rounded px-3 py-2 text-sm`}
                  />
                </div>
                <div>
                  <label className={`text-xs ${labelSmClass} block mb-1`}>ソースタイプ</label>
                  <select
                    value={source.sourceType || 'spreadsheet'}
                    onChange={(e) => updateSource(source.id, 'sourceType', e.target.value)}
                    className={`w-full ${inputClass} rounded px-3 py-2 text-sm`}
                  >
                    <option value="spreadsheet" className={optionClass}>スプレッドシート</option>
                    <option value="salesforce" className={optionClass}>Salesforce Report</option>
                    <option value="salesforce-soql" className={optionClass}>Salesforce SOQL</option>
                  </select>
                </div>
                {(source.sourceType || 'spreadsheet') === 'spreadsheet' ? (
                  <>
                    <div>
                      <label className={`text-xs ${labelSmClass} block mb-1`}>スプレッドシートID</label>
                      <input
                        type="text"
                        value={source.spreadsheetId}
                        onChange={(e) => updateSource(source.id, 'spreadsheetId', e.target.value)}
                        className={`w-full ${inputClass} rounded px-3 py-2 text-sm font-mono`}
                        placeholder="1BxiM..."
                      />
                    </div>
                    <div>
                      <label className={`text-xs ${labelSmClass} block mb-1`}>シート名</label>
                      <input
                        type="text"
                        value={source.sheetName}
                        onChange={(e) => updateSource(source.id, 'sheetName', e.target.value)}
                        className={`w-full ${inputClass} rounded px-3 py-2 text-sm`}
                        placeholder="Sheet1"
                      />
                    </div>
                  </>
                ) : source.sourceType === 'salesforce' ? (
                  <div className="md:col-span-2">
                    <label className={`text-xs ${labelSmClass} block mb-1`}>Salesforce レポートID</label>
                    <input
                      type="text"
                      value={source.reportId || ''}
                      onChange={(e) => updateSource(source.id, 'reportId', e.target.value)}
                      className={`w-full ${inputClass} rounded px-3 py-2 text-sm font-mono`}
                      placeholder="00OTL00000B3YV32AN"
                    />
                    <p className={`text-xs mt-1 ${labelXsClass}`}>SalesforceレポートURLの末尾18桁のID</p>
                  </div>
                ) : source.sourceType === 'salesforce-soql' ? (
                  <>
                    {/* SOQLフィールドピッカー（オブジェクト入力 + フィールド選択UI） */}
                    <div className="md:col-span-4">
                      <SoqlFieldPicker
                        source={source}
                        onSourceUpdate={(sourceId, updates) => {
                          updateLocalConfig('dataSources', localConfig.dataSources.map(s =>
                            s.id === sourceId ? { ...s, ...updates } : s
                          ));
                        }}
                        localConfig={localConfig}
                        updateLocalConfig={updateLocalConfig}
                        sourceCache={sourceCache}
                        theme={theme}
                        inputClass={inputClass}
                        labelSmClass={labelSmClass}
                        labelXsClass={labelXsClass}
                        borderClass={borderClass}
                        textClass={textClass}
                        textMutedClass={textMutedClass}
                        optionClass={optionClass}
                      />
                    </div>
                    {/* WHERE条件はSoqlFieldPicker内に移動済み */}
                    {/* データ取得フィルター（複数条件対応） */}
                    <div className="md:col-span-4">
                      {(() => {
                        // 後方互換: soqlDateFilter（単一）→ soqlDateFilters（配列）にマイグレーション
                        const filters = source.soqlDateFilters
                          || (source.soqlDateFilter?.enabled ? [source.soqlDateFilter] : []);
                        const joinMode = source._dateFilterJoinMode || 'OR';
                        const isEnabled = filters.length > 0;

                        const setFilters = (newFilters, newJoinMode) => {
                          updateLocalConfig('dataSources', localConfig.dataSources.map(s =>
                            s.id === source.id ? {
                              ...s,
                              soqlDateFilters: newFilters,
                              soqlDateFilter: newFilters[0] || { enabled: false },
                              _dateFilterJoinMode: newJoinMode ?? joinMode,
                            } : s
                          ));
                        };
                        const addFilter = () => {
                          setFilters([...filters, { enabled: true, fieldName: '', preset: 'none' }]);
                        };
                        const removeFilter = (idx) => {
                          const next = filters.filter((_, i) => i !== idx);
                          setFilters(next);
                        };
                        const updateFilter = (idx, key, val) => {
                          const next = filters.map((f, i) => i === idx ? { ...f, [key]: val } : f);
                          setFilters(next);
                        };

                        const fieldMeta = source.fieldMetadata || {};
                        const rawHeaders = (source._rawHeaders || source.headers || []).length > 0
                          ? (source._rawHeaders || source.headers)
                          : Object.keys(fieldMeta);
                        const dateHeaders = rawHeaders.filter(h => {
                          const label = fieldMeta[h] || '';
                          return label.includes('日付') || label.includes('Date') || label.includes('日') || h.toLowerCase().includes('date');
                        });
                        const otherHeaders = rawHeaders.filter(h => !dateHeaders.includes(h));
                        const presetOptions = [
                          { value: 'none', label: 'フィルターなし' },
                          { value: 'thisMonth', label: '今月' },
                          { value: 'lastMonth', label: '先月' },
                          { value: 'lastAndThisMonth', label: '先月～今月' },
                          { value: 'thisQuarter', label: '今四半期' },
                          { value: 'last3Months', label: '過去3ヶ月' },
                          { value: 'thisYear', label: '今年' },
                          { value: 'yearMonth', label: '年月指定' },
                          { value: 'custom', label: 'カスタム期間' },
                        ];
                        const now = new Date();
                        const yearOptions = [];
                        for (let yr = now.getFullYear() - 3; yr <= now.getFullYear() + 1; yr++) yearOptions.push(yr);

                        // 全フィルタのWHERE句を生成
                        const allClauses = filters.map(f => buildSoqlDateFilterClause(f)).filter(Boolean);
                        const combinedClause = allClauses.length <= 1
                          ? allClauses[0] || ''
                          : (joinMode === 'AND' ? allClauses.join(' AND ') : `(${allClauses.join(' OR ')})`);

                        return (
                          <div className={`p-3 rounded-lg border ${
                            isEnabled
                              ? (theme === 'dark' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-emerald-300 bg-emerald-50')
                              : borderClass
                          }`}>
                            <div className="flex items-center justify-between">
                              <label className={`flex items-center gap-2 text-xs cursor-pointer ${
                                theme === 'dark' ? 'text-emerald-300/80' : 'text-emerald-600'
                              }`}>
                                <Filter size={12} /> データ取得フィルター
                                <span className={labelXsClass}>（取得時にSOQL WHERE句を自動追加）</span>
                              </label>
                              {filters.length > 1 && (
                                <select
                                  value={joinMode}
                                  onChange={(e) => setFilters(filters, e.target.value)}
                                  className={`text-[10px] px-2 py-0.5 rounded ${inputClass} ${optionClass}`}
                                >
                                  <option value="OR" className={optionClass}>OR（いずれかに一致）</option>
                                  <option value="AND" className={optionClass}>AND（すべてに一致）</option>
                                </select>
                              )}
                            </div>

                            <div className="mt-2 space-y-2">
                              {filters.map((df, fIdx) => (
                                <div key={fIdx} className={`grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end ${fIdx > 0 ? `pt-2 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}` : ''}`}>
                                  <div>
                                    <label className={`text-[10px] ${labelSmClass} block mb-0.5`}>フィルター列</label>
                                    <select
                                      value={df.fieldName || ''}
                                      onChange={(e) => updateFilter(fIdx, 'fieldName', e.target.value)}
                                      className={`w-full ${inputClass} ${optionClass} rounded px-2 py-1.5 text-xs`}
                                    >
                                      <option value="" className={optionClass}>- 選択 -</option>
                                      {dateHeaders.length > 0 && (
                                        <optgroup label="日付フィールド" className={optionClass}>
                                          {dateHeaders.map((h, i) => (
                                            <option key={`d-${i}`} value={h} className={optionClass}>
                                              {fieldMeta[h] ? `${fieldMeta[h]} (${h})` : h}
                                            </option>
                                          ))}
                                        </optgroup>
                                      )}
                                      <optgroup label="その他" className={optionClass}>
                                        {otherHeaders.map((h, i) => (
                                          <option key={`o-${i}`} value={h} className={optionClass}>
                                            {fieldMeta[h] ? `${fieldMeta[h]} (${h})` : h}
                                          </option>
                                        ))}
                                      </optgroup>
                                    </select>
                                  </div>
                                  <div>
                                    <label className={`text-[10px] ${labelSmClass} block mb-0.5`}>期間</label>
                                    <select
                                      value={df.preset || 'none'}
                                      onChange={(e) => updateFilter(fIdx, 'preset', e.target.value)}
                                      className={`w-full ${inputClass} ${optionClass} rounded px-2 py-1.5 text-xs`}
                                    >
                                      {presetOptions.map(o => (
                                        <option key={o.value} value={o.value} className={optionClass}>{o.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    {df.preset === 'yearMonth' && (
                                      <div className="flex gap-1">
                                        <select
                                          value={df.year || now.getFullYear()}
                                          onChange={(e) => updateFilter(fIdx, 'year', parseInt(e.target.value))}
                                          className={`${inputClass} ${optionClass} rounded px-1.5 py-1.5 text-xs flex-1`}
                                        >
                                          {yearOptions.map(yr => (
                                            <option key={yr} value={yr} className={optionClass}>{yr}年</option>
                                          ))}
                                        </select>
                                        <select
                                          value={df.month || (now.getMonth() + 1)}
                                          onChange={(e) => updateFilter(fIdx, 'month', parseInt(e.target.value))}
                                          className={`${inputClass} ${optionClass} rounded px-1.5 py-1.5 text-xs w-16`}
                                        >
                                          {[...Array(12)].map((_, i) => (
                                            <option key={i + 1} value={i + 1} className={optionClass}>{i + 1}月</option>
                                          ))}
                                        </select>
                                      </div>
                                    )}
                                    {df.preset === 'custom' && (
                                      <div className="flex items-center gap-1">
                                        <input type="date" value={df.customStart || ''} onChange={(e) => updateFilter(fIdx, 'customStart', e.target.value)} className={`${inputClass} rounded px-1.5 py-1 text-xs flex-1`} />
                                        <span className={`text-xs ${textMutedClass}`}>〜</span>
                                        <input type="date" value={df.customEnd || ''} onChange={(e) => updateFilter(fIdx, 'customEnd', e.target.value)} className={`${inputClass} rounded px-1.5 py-1 text-xs flex-1`} />
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => removeFilter(fIdx)}
                                    className={`p-1.5 rounded self-end ${theme === 'dark' ? 'hover:bg-rose-500/20 text-rose-300' : 'hover:bg-rose-100 text-rose-500'}`}
                                    title="削除"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ))}

                              <button
                                onClick={addFilter}
                                className={`text-[10px] px-2 py-1 rounded flex items-center gap-1 ${
                                  theme === 'dark' ? 'text-emerald-300 hover:bg-emerald-500/10' : 'text-emerald-600 hover:bg-emerald-50'
                                }`}
                              >
                                <Plus size={10} /> 条件追加
                              </button>

                              {combinedClause && (
                                <div className={`text-[10px] font-mono px-2 py-1 rounded ${
                                  theme === 'dark' ? 'bg-black/30 text-emerald-300/70' : 'bg-white text-emerald-700/70'
                                }`}>
                                  WHERE: {combinedClause}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    {/* ORDER BYはSoqlFieldPicker内に移動済み */}
                    {/* サーバーキャッシュ設定 */}
                    <div className="col-span-full flex items-center gap-3 mt-1">
                      <label className={`flex items-center gap-2 text-xs ${labelSmClass}`}>
                        <input
                          type="checkbox"
                          checked={source.serverCacheEnabled || false}
                          onChange={(e) => updateSource(source.id, 'serverCacheEnabled', e.target.checked)}
                          className="accent-emerald-500"
                        />
                        サーバーキャッシュ（差分取得）
                      </label>
                      <span className={`text-[10px] ${labelXsClass}`}>
                        大量データの取得を高速化。初回は全件取得、以降は差分のみ取得します
                      </span>
                    </div>
                  </>
                ) : null}
              </div>

              <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t ${borderClass}`}>
                <div>
                  <label className={`text-xs flex items-center gap-1 mb-1 ${theme === 'dark' ? 'text-amber-300/80' : 'text-amber-600'}`}>
                    <Key size={10} /> このソースのキー列
                  </label>
                  <select
                    value={source.keyColumnIndex ?? ''}
                    onChange={(e) => {
                      const idx = e.target.value === '' ? null : parseInt(e.target.value);
                      updateLocalConfig('dataSources', localConfig.dataSources.map(s =>
                        s.id === source.id ? { ...s, keyColumnIndex: idx, keyColumnName: idx !== null ? source.headers[idx] || '' : '' } : s
                      ));
                    }}
                    className={`w-full ${inputClass} ${theme === 'dark' ? 'border-amber-500/30' : 'border-amber-400'} rounded px-2 py-2 text-sm outline-none`}
                    disabled={source.headers.length === 0}
                  >
                    <option value="" className={optionClass}>-</option>
                    {source.headers.map((h, i) => (
                      <option key={i} value={i} className={optionClass}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`text-xs flex items-center gap-1 mb-1 ${theme === 'dark' ? 'text-sky-300/80' : 'text-sky-600'}`}>
                    <Calendar size={10} /> このソースの日付列
                  </label>
                  <select
                    value={source.dateColumnIndex ?? ''}
                    onChange={(e) => {
                      const idx = e.target.value === '' ? null : parseInt(e.target.value);
                      updateLocalConfig('dataSources', localConfig.dataSources.map(s =>
                        s.id === source.id ? { ...s, dateColumnIndex: idx, dateColumnName: idx !== null ? source.headers[idx] || '' : '' } : s
                      ));
                    }}
                    className={`w-full ${inputClass} ${theme === 'dark' ? 'border-sky-500/30' : 'border-sky-400'} rounded px-2 py-2 text-sm outline-none`}
                    disabled={source.headers.length === 0}
                  >
                    <option value="" className={optionClass}>-</option>
                    {source.headers.map((h, i) => (
                      <option key={i} value={i} className={optionClass}>{h}</option>
                    ))}
                  </select>
                </div>
                {/* ピボット設定UI */}
                <div className="space-y-2">
                  <label className={`flex items-center gap-2 text-xs cursor-pointer ${theme === 'dark' ? 'text-purple-300/80' : 'text-purple-600'}`}>
                    <input
                      type="checkbox"
                      checked={source.pivotSettings?.enabled || false}
                      onChange={(e) => updatePivotSettings(source.id, 'enabled', e.target.checked)}
                      className="accent-purple-500"
                    />
                    <GitCommit size={10} /> ピボット変換を有効化
                  </label>
                  {source.pivotSettings?.enabled && (
                    <div className={`flex gap-2 p-2 rounded-lg border border-purple-500/30 ${theme === 'dark' ? 'bg-black/20' : 'bg-purple-50'}`}>
                      <div className="flex-1">
                        <label className={`text-[10px] ${labelSmClass} block mb-1`}>ラベル列</label>
                        <select
                          value={source.pivotSettings.labelColumnIndex ?? ''}
                          onChange={(e) => {
                            const idx = e.target.value === '' ? null : parseInt(e.target.value);
                            updateLocalConfig('dataSources', localConfig.dataSources.map(s =>
                              s.id === source.id ? { ...s, pivotSettings: { ...(s.pivotSettings || {}), labelColumnIndex: idx, labelColumnName: idx !== null ? source.headers[idx] || '' : '' } } : s
                            ));
                          }}
                          className={`w-full ${inputClass} rounded px-2 py-1 text-xs`}
                          disabled={source.headers.length === 0}
                        >
                          <option value="" className={optionClass}>-</option>
                          {source.headers.map((h, i) => (
                            <option key={i} value={i} className={optionClass}>{h}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className={`text-[10px] ${labelSmClass} block mb-1`}>値列</label>
                        <select
                          value={source.pivotSettings.valueColumnIndex ?? ''}
                          onChange={(e) => {
                            const idx = e.target.value === '' ? null : parseInt(e.target.value);
                            updateLocalConfig('dataSources', localConfig.dataSources.map(s =>
                              s.id === source.id ? { ...s, pivotSettings: { ...(s.pivotSettings || {}), valueColumnIndex: idx, valueColumnName: idx !== null ? source.headers[idx] || '' : '' } } : s
                            ));
                          }}
                          className={`w-full ${inputClass} rounded px-2 py-1 text-xs`}
                          disabled={source.headers.length === 0}
                        >
                          <option value="" className={optionClass}>-</option>
                          {source.headers.map((h, i) => (
                            <option key={i} value={i} className={optionClass}>{h}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 稼働実績用変換設定（SOQLソースのみ） — フル幅で配置 */}
              {source.sourceType === 'salesforce-soql' && (
                <ReshapeSettingsPanel
                  source={source}
                  updateReshapeSettings={updateReshapeSettings}
                  updateReshapeSettingsBatch={updateReshapeSettingsBatch}
                  updateReshapeGroups={updateReshapeGroups}
                  theme={theme}
                  inputClass={inputClass}
                  labelSmClass={labelSmClass}
                  labelXsClass={labelXsClass}
                  borderClass={borderClass}
                  optionClass={optionClass}
                  sourceCache={sourceCache}
                  mainKeyInfo={(() => {
                    const mainSrc = localConfig.dataSources[0];
                    if (!mainSrc || mainSrc.id === source.id) return null;
                    const keyName = mainSrc.keyColumnName || (mainSrc.keyColumnIndex != null ? mainSrc.headers?.[mainSrc.keyColumnIndex] : null);
                    return keyName ? { sourceName: mainSrc.name || 'ソース1', keyColumnName: keyName } : null;
                  })()}
                />
              )}

              <div className="mt-3">
                {source.headers.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    <span className={`text-xs ${labelXsClass} flex items-center gap-1`}>
                      <Table size={12} /> 取得済み:
                    </span>
                    {source.headers.slice(0, 5).map(h => (
                      <span key={h} className={`text-xs px-1.5 py-0.5 rounded ${
                        theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {h}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className={`text-xs ${labelXsClass} flex items-center gap-1`}>
                    <Info size={12} /> IDとシート名を入力後、下のボタンでヘッダーを取得してください
                  </div>
                )}
              </div>
              </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={handleAddSource}
            className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${
              theme === 'dark' ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300' : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
            }`}
          >
            <Plus size={16} /> ソース追加
          </button>
          <button
            onClick={handleFetchHeadersLocal}
            disabled={isHeaderLoading}
            className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium shadow-lg flex items-center gap-2 disabled:opacity-50"
          >
            {isHeaderLoading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
            全ソースのヘッダーを取得・更新
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectionTab;
