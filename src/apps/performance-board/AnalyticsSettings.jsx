// src/apps/performance-board/AnalyticsSettings.jsx
// アナリティクス設定画面 - タブコンポーネントを統合

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Database,
  Calculator,
  Filter,
  Layers,
  Save,
  Loader2,
  Download,
  Upload,
  X,
  Check,
  Clock,
  BarChart3,
  Layout,
  Trophy,
  AlignLeft
} from 'lucide-react';

// 抽出済みタブコンポーネント
import {
  ConnectionTab,
  FiltersTab,
  IndicatorTab,
  AggregationTab,
  ScheduleTab,
  ChartsTab,
  LayoutTab,
  RankingTab,
  HeadingTab
} from './components/settings';
import { usePermission } from '../../hooks/usePermission';
import { SUPPORTED_SOURCE_TYPES } from '../../constants';
import salesforceApi from './services/salesforceApi';

export const normalizeDataSourceTypes = (dataSources) => {
  if (!Array.isArray(dataSources)) return dataSources;
  return dataSources.map((source) => ({
    ...source,
    sourceType: SUPPORTED_SOURCE_TYPES.includes(source.sourceType) ? source.sourceType : 'spreadsheet',
  }));
};

export const normalizeConfigSourceTypes = (dashboardConfig) => ({
  ...dashboardConfig,
  dataSources: normalizeDataSourceTypes(dashboardConfig?.dataSources),
});

const AnalyticsSettings = ({
  glassClass,
  globalApiKey,
  setGlobalApiKey,
  config,
  updateConfig,
  saveDashboardConfig,
  allDashboards,
  switchDashboard,
  onFetchHeaders,
  isLoading,
  error,
  onUpdateTableFieldsOrder,
  theme,
  accounts,
  updateAccounts,
  user,
  roles,
  sourceCache
}) => {
  // 権限チェック
  const { hasPermission, isAdmin } = usePermission(user, roles);
  const isGuest = user?.isGuest === true;
  const canExport = isAdmin || hasPermission('performance-board.export');

  // タブ状態
  const [activeSettingTab, setActiveSettingTab] = useState('connection');

  // 設定管理
  const [localConfig, setLocalConfig] = useState(() => normalizeConfigSourceTypes(config));
  const [localApiKey, setLocalApiKey] = useState(globalApiKey);
  const [isDirty, setIsDirty] = useState(false);
  const [isHeaderLoading, setIsHeaderLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // エクスポート/インポート
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    name: true,
    dataSources: true,
    systemFields: true,
    mapping: true,
    calculations: true,
    compositeCards: true,
    filters: true,
    defaultFilters: true,
    dataTables: true,
    pivotTables: true,
    vendorPivotTables: true,
    aggregationConfigs: true,
    comparisonTables: true,
    dateSettings: true,
    mainKey: true,
    visibleFields: true,
    allowedRoles: true,
    indicatorGroups: true,
    indicatorFolders: true,
  });
  const [importData, setImportData] = useState(null);
  const [importFileName, setImportFileName] = useState('');

  // テナントID（SF接続先）— Analyticsボード全体で共有（localStorage）
  const [sfTenantId, setSfTenantId] = useState(() => {
    const saved = localStorage.getItem('analytics_sf_tenant_id');
    if (saved) salesforceApi.setTenantId(saved);
    return saved || '';
  });

  // テナント変更ハンドラ
  const handleTenantChange = useCallback((tenantId) => {
    const tid = tenantId || '';
    setSfTenantId(tid);
    salesforceApi.setTenantId(tid);
    if (tid) {
      localStorage.setItem('analytics_sf_tenant_id', tid);
    } else {
      localStorage.removeItem('analytics_sf_tenant_id');
    }
  }, []);

  // エクスポート項目の定義
  const exportItems = [
    { key: 'name', label: 'ダッシュボード名', description: 'ダッシュボードの表示名' },
    { key: 'dataSources', label: 'データソース設定', description: 'スプレッドシートID、シート名、キー列、ヘッダーなど' },
    { key: 'systemFields', label: 'システムフィールド', description: 'ID、日付、数値フィールドの定義' },
    { key: 'mapping', label: 'マッピング設定', description: 'フィールドとカラムの対応付け' },
    { key: 'calculations', label: '計算ロジック（指標）', description: '四則演算、リレーション指標、固定値' },
    { key: 'compositeCards', label: '複合カード設定', description: '複数指標を1つのカードに表示' },
    { key: 'filters', label: 'フィルター設定', description: 'ダッシュボードのフィルター定義' },
    { key: 'defaultFilters', label: 'デフォルトフィルター', description: '初期表示時のフィルター値（日付範囲など）' },
    { key: 'dataTables', label: 'データテーブル設定', description: 'テーブルの列設定' },
    { key: 'pivotTables', label: 'ピボットテーブル設定', description: 'ピボット集計の設定' },
    { key: 'vendorPivotTables', label: 'クロス集計テーブル設定', description: '販社×月別などのクロス集計設定' },
    { key: 'aggregationConfigs', label: '集計設定', description: 'テーブルの集計軸・方法' },
    { key: 'comparisonTables', label: '比較テーブル設定', description: 'セグメント別比較の設定' },
    { key: 'dateSettings', label: '日付設定', description: '日付の取得方法' },
    { key: 'mainKey', label: 'メインキー設定', description: '結合用のキー設定' },
    { key: 'visibleFields', label: '表示フィールド設定', description: '表示するフィールドの設定' },
    { key: 'allowedRoles', label: 'ロール表示制限', description: '閲覧可能なロールの設定' },
    { key: 'indicatorGroups', label: '指標グループ設定', description: 'リレーション指標のグループ化設定' },
    { key: 'indicatorFolders', label: '指標フォルダ設定', description: '計算指標のフォルダ分類設定' },
  ];

  // config変更時にlocalConfigを更新
  useEffect(() => {
    setLocalConfig(normalizeConfigSourceTypes(config));
    setIsDirty(false);
  }, [config.id]);

  useEffect(() => {
    setLocalApiKey(globalApiKey);
  }, [globalApiKey]);

  // 設定更新関数
  const updateLocalConfig = (key, value) => {
    if (isGuest) {
      alert('デモ環境では変更を保存できません');
      return;
    }
    setLocalConfig(prev => ({
      ...prev,
      [key]: value
    }));
    setIsDirty(true);
  };

  // ── VLOOKUP → systemFields + mapping 自動同期（追加・削除・ラベル変更を一括管理） ──
  useEffect(() => {
    if (!localConfig?.dataSources) return;

    // 現在のVLOOKUP一覧から期待されるsystemFieldsを構築
    const expectedFields = new Map(); // fieldId → { id, label, type, sourceId, columnIndex, columnName }
    for (const src of localConfig.dataSources) {
      if (!src.vlookups?.length) continue;
      const headers = src.headers || [];
      for (const vl of src.vlookups) {
        const fieldId = `vlookup_${vl.id}`;
        const label = vl.outputLabel || `${vl.targetObjectLabel || vl.targetObject}.${vl.targetValueField}`;
        expectedFields.set(fieldId, { id: fieldId, label, type: 'string', sourceId: src.id, columnIndex: headers.indexOf(label), columnName: label });
      }
    }

    // 現在のsystemFieldsと比較
    const currentFields = localConfig.systemFields || [];
    const currentMapping = localConfig.mapping || {};
    const existingVlookupIds = new Set(currentFields.filter(f => f.id.startsWith('vlookup_')).map(f => f.id));

    // 追加が必要なもの
    const toAdd = [...expectedFields.entries()].filter(([id]) => !existingVlookupIds.has(id));
    // 削除が必要なもの
    const toRemove = [...existingVlookupIds].filter(id => !expectedFields.has(id));
    // ラベル変更が必要なもの
    const toUpdate = currentFields.filter(f => f.id.startsWith('vlookup_') && expectedFields.has(f.id) && expectedFields.get(f.id).label !== f.label);

    if (toAdd.length === 0 && toRemove.length === 0 && toUpdate.length === 0) return;

    const removeSet = new Set(toRemove);
    const updateMap = new Map(toUpdate.map(f => [f.id, expectedFields.get(f.id).label]));

    setLocalConfig(prev => {
      const newSystemFields = [
        ...(prev.systemFields || [])
          .filter(f => !removeSet.has(f.id))
          .map(f => updateMap.has(f.id) ? { ...f, label: updateMap.get(f.id) } : f),
        ...toAdd.map(([, info]) => ({ id: info.id, label: info.label, type: info.type })),
      ];
      const newMapping = { ...(prev.mapping || {}) };
      for (const id of toRemove) delete newMapping[id];
      for (const [id, info] of toAdd) newMapping[id] = { sourceId: info.sourceId, columnIndex: info.columnIndex, columnName: info.columnName };
      for (const f of toUpdate) {
        const info = expectedFields.get(f.id);
        if (newMapping[f.id]) newMapping[f.id] = { ...newMapping[f.id], columnIndex: info.columnIndex, columnName: info.columnName };
      }
      return { ...prev, systemFields: newSystemFields, mapping: newMapping };
    });
    setIsDirty(true);
  }, [localConfig?.dataSources]);

  // データソース操作関数
  const handleAddSource = () => {
    const newSource = {
      id: `src_${Date.now()}`,
      name: `ソース${(localConfig.dataSources?.length || 0) + 1}`,
      sourceType: 'spreadsheet',
      spreadsheetId: '',
      sheetName: '',
      reportId: '',
      headers: [],
      keyColumnIndex: null,
      keyColumnName: '',
      dateColumnIndex: null,
      dateColumnName: '',
      serverCacheEnabled: false,
      pivotSettings: { enabled: false, labelColumnName: '', valueColumnName: '' },
      reshapeSettings: {
        enabled: false,
        dateColumnName: '',
        fixedColumnNames: [],
        groups: [],
        generatedDateColumnName: '稼働日',
        skipEmptyDays: true,
      }
    };
    updateLocalConfig('dataSources', [...(localConfig.dataSources || []), newSource]);
  };

  const handleRemoveSource = (sourceId) => {
    if (!confirm('このデータソースを削除しますか？')) return;
    updateLocalConfig('dataSources', localConfig.dataSources.filter(s => s.id !== sourceId));
  };

  const updateSource = (sourceId, key, value) => {
    updateLocalConfig('dataSources', localConfig.dataSources.map(s =>
      s.id === sourceId ? { ...s, [key]: value } : s
    ));
  };

  const updatePivotSettings = (sourceId, key, value) => {
    updateLocalConfig('dataSources', localConfig.dataSources.map(s =>
      s.id === sourceId
        ? { ...s, pivotSettings: { ...(s.pivotSettings || {}), [key]: value } }
        : s
    ));
  };

  const updateReshapeSettings = (sourceId, key, value) => {
    updateLocalConfig('dataSources', localConfig.dataSources.map(s =>
      s.id === sourceId
        ? { ...s, reshapeSettings: { ...(s.reshapeSettings || {}), [key]: value } }
        : s
    ));
  };

  const updateReshapeSettingsBatch = (sourceId, updates) => {
    updateLocalConfig('dataSources', localConfig.dataSources.map(s =>
      s.id === sourceId
        ? { ...s, reshapeSettings: { ...(s.reshapeSettings || {}), ...updates } }
        : s
    ));
  };

  const updateReshapeGroups = (sourceId, groups) => {
    updateLocalConfig('dataSources', localConfig.dataSources.map(s =>
      s.id === sourceId
        ? { ...s, reshapeSettings: { ...(s.reshapeSettings || {}), groups } }
        : s
    ));
  };

  const handleFetchHeadersLocal = async () => {
    setIsHeaderLoading(true);
    try {
      const result = await onFetchHeaders(localConfig.dataSources, localApiKey);
      // reconcile済みの全設定をlocalConfigに反映（保存時にstoreの復旧値を上書きしないようにする）
      if (result && result.reconciledConfig) {
        setLocalConfig(prev => ({
          ...prev,
          dataSources: result.reconciledConfig.dataSources,
          ...(result.reconciledConfig.mapping && { mapping: result.reconciledConfig.mapping }),
          ...(result.reconciledConfig.calculations && { calculations: result.reconciledConfig.calculations }),
          ...(result.reconciledConfig.mainKey && { mainKey: result.reconciledConfig.mainKey }),
          ...(result.reconciledConfig.aggregationConfigs && { aggregationConfigs: result.reconciledConfig.aggregationConfigs }),
        }));
        setIsDirty(true);
      } else if (result && Array.isArray(result)) {
        // 後方互換: 古い形式（配列）が返された場合
        updateLocalConfig('dataSources', result);
      }
    } finally {
      setIsHeaderLoading(false);
    }
  };

  // 保存処理（リアルタイム保存された columnColors 等を最新 config からマージ）
  const handleSaveChanges = async () => {
    if (isGuest) {
      alert('デモ環境では変更を保存できません');
      return;
    }
    setIsSaving(true);
    // localConfig に最新のリアルタイム保存プロパティをマージ（設定画面外での変更を保持）
    const mergedConfig = { ...localConfig };
    if (mergedConfig.dataTables && config.dataTables) {
      mergedConfig.dataTables = mergedConfig.dataTables.map(lt => {
        const current = config.dataTables.find(ct => ct.id === lt.id);
        if (!current) return lt;
        const merged = { ...lt };
        // localConfig に columnColors がなければサーバー最新値を採用（ビュー画面での変更を保持）
        // localConfig に既にある場合はそちらを優先（インポート時のデータを守る）
        if (!lt.columnColors && current.columnColors) merged.columnColors = current.columnColors;
        if (!lt.columnAliases && current.columnAliases) merged.columnAliases = current.columnAliases;
        return merged;
      });
    }
    if (mergedConfig.vendorPivotTables && config.vendorPivotTables) {
      mergedConfig.vendorPivotTables = mergedConfig.vendorPivotTables.map(lt => {
        const current = config.vendorPivotTables.find(ct => ct.id === lt.id);
        if (!current) return lt;
        const merged = { ...lt };
        if (current.metricColors) merged.metricColors = current.metricColors;
        if (current.tableFilterValues) merged.tableFilterValues = current.tableFilterValues;
        return merged;
      });
    }
    await saveDashboardConfig(mergedConfig, localApiKey);
    setIsDirty(false);
    setIsSaving(false);
  };

  // エクスポート実行
  const handleExport = () => {
    const exportData = { _exportVersion: 2, _exportDate: new Date().toISOString() };
    if (exportOptions.name) exportData.name = localConfig.name;
    if (exportOptions.dataSources) exportData.dataSources = localConfig.dataSources;
    if (exportOptions.systemFields) exportData.systemFields = localConfig.systemFields;
    if (exportOptions.mapping) exportData.mapping = localConfig.mapping;
    if (exportOptions.calculations) exportData.calculations = localConfig.calculations;
    if (exportOptions.compositeCards) exportData.compositeCards = localConfig.compositeCards;
    if (exportOptions.filters) exportData.filters = localConfig.filters;
    if (exportOptions.defaultFilters) exportData.defaultFilters = localConfig.defaultFilters;
    if (exportOptions.dataTables) {
      // columnColors/columnAliases はビュー画面でリアルタイム保存されるため、
      // localConfig より config（最新のサーバー保存値）を優先してマージ
      const serverTables = config.dataTables || [];
      exportData.dataTables = (localConfig.dataTables || []).map(lt => {
        const st = serverTables.find(s => s.id === lt.id);
        if (!st) return lt;
        return { ...lt, columnColors: st.columnColors || lt.columnColors, columnAliases: st.columnAliases || lt.columnAliases };
      });
    }
    if (exportOptions.pivotTables) exportData.pivotTables = localConfig.pivotTables;
    if (exportOptions.vendorPivotTables) exportData.vendorPivotTables = localConfig.vendorPivotTables;
    if (exportOptions.aggregationConfigs) exportData.aggregationConfigs = localConfig.aggregationConfigs;
    if (exportOptions.comparisonTables) exportData.comparisonTables = localConfig.comparisonTables;
    if (exportOptions.dateSettings) exportData.dateSettings = localConfig.dateSettings;
    if (exportOptions.mainKey) exportData.mainKey = localConfig.mainKey;
    if (exportOptions.visibleFields) exportData.visibleFields = localConfig.visibleFields;
    if (exportOptions.allowedRoles) exportData.allowedRoles = localConfig.allowedRoles;
    if (exportOptions.indicatorGroups) exportData.indicatorGroups = localConfig.indicatorGroups;
    if (exportOptions.indicatorFolders) exportData.indicatorFolders = localConfig.indicatorFolders;

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const boardName = (localConfig.name || 'dashboard').replace(/[\\/:*?"<>|]/g, '_');
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    a.download = `${boardName}_${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  // インポートファイル選択
  const handleImportFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        setImportData(data);
      } catch {
        alert('JSONファイルの解析に失敗しました。');
        setImportData(null);
        setImportFileName('');
      }
    };
    reader.readAsText(file);
  };

  // インポート実行
  const handleImport = () => {
    if (!importData) return;
    if (!confirm('選択した設定をインポートしますか？\n既存の設定が上書きされます。')) return;

    const newConfig = { ...localConfig };
    if (importData.name) newConfig.name = importData.name;
    if (importData.dataSources) newConfig.dataSources = normalizeDataSourceTypes(importData.dataSources);
    if (importData.systemFields) newConfig.systemFields = importData.systemFields;
    if (importData.mapping) newConfig.mapping = importData.mapping;
    if (importData.calculations) newConfig.calculations = importData.calculations;
    if (importData.compositeCards) newConfig.compositeCards = importData.compositeCards;
    if (importData.filters) newConfig.filters = importData.filters;
    if (importData.defaultFilters) newConfig.defaultFilters = importData.defaultFilters;
    if (importData.dataTables) newConfig.dataTables = importData.dataTables;
    if (importData.pivotTables) newConfig.pivotTables = importData.pivotTables;
    if (importData.vendorPivotTables) newConfig.vendorPivotTables = importData.vendorPivotTables;
    if (importData.aggregationConfigs) newConfig.aggregationConfigs = importData.aggregationConfigs;
    if (importData.comparisonTables) newConfig.comparisonTables = importData.comparisonTables;
    if (importData.dateSettings) newConfig.dateSettings = importData.dateSettings;
    if (importData.mainKey) newConfig.mainKey = importData.mainKey;
    if (importData.visibleFields) newConfig.visibleFields = importData.visibleFields;
    if (importData.allowedRoles) newConfig.allowedRoles = importData.allowedRoles;
    if (importData.indicatorGroups) newConfig.indicatorGroups = importData.indicatorGroups;
    if (importData.indicatorFolders) newConfig.indicatorFolders = importData.indicatorFolders;

    setLocalConfig(newConfig);
    setIsDirty(true);
    setShowImportModal(false);
    setImportData(null);
    setImportFileName('');
    alert('インポートが完了しました。\n「設定を保存」ボタンで保存してください。');
  };

  // 計算済みフィールド（指標グループも選択可能項目として含める）
  const allFields = useMemo(() => [
    ...localConfig.systemFields,
    ...(localConfig.calculations || []).map(c => ({ id: c.id, label: c.label, type: 'number' })),
    ...(localConfig.indicatorGroups || []).map(g => ({ id: g.id, label: g.label, type: 'number', _isIndicatorGroup: true })),
    ...(localConfig.compositeCards || []).map(cc => ({ id: cc.id, label: cc.label, type: 'composite', isComposite: true }))
  ], [localConfig.systemFields, localConfig.calculations, localConfig.compositeCards, localConfig.indicatorGroups]);

  // スタイルヘルパー
  const inputClass = theme === 'dark'
    ? "bg-white/5 border border-white/10 text-white placeholder:text-white/30"
    : "bg-gray-50 border border-gray-300 text-gray-800 placeholder:text-gray-400";
  const labelClass = theme === 'dark' ? "text-white/70" : "text-gray-600";
  const labelSmClass = theme === 'dark' ? "text-white/60" : "text-gray-600";
  const labelXsClass = theme === 'dark' ? "text-white/40" : "text-gray-500";
  const cardClass = theme === 'dark' ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-300";
  const textClass = theme === 'dark' ? "text-white" : "text-gray-800";
  const textMutedClass = theme === 'dark' ? "text-white/50" : "text-gray-500";
  const borderClass = theme === 'dark' ? "border-white/10" : "border-gray-300";
  const optionClass = theme === 'dark' ? "bg-slate-900 text-white" : "bg-white text-gray-800";

  // 共通props
  const commonTabProps = {
    localConfig,
    updateLocalConfig,
    updateConfig,
    theme,
    glassClass,
    cardClass,
    inputClass,
    optionClass,
    textClass,
    textMutedClass,
    labelClass,
    labelSmClass,
    labelXsClass,
    borderClass,
    allFields,
    isLoading,
    onUpdateTableFieldsOrder,
    sourceCache
  };

  // タブ定義
  const tabs = [
    { id: 'connection', icon: Database, label: '接続' },
    { id: 'indicator', icon: Calculator, label: '指標設定' },
    { id: 'filters', icon: Filter, label: 'フィルター' },
    { id: 'aggregation', icon: Layers, label: 'データテーブル設定' },
    { id: 'charts', icon: BarChart3, label: 'グラフ設定' },
    { id: 'ranking', icon: Trophy, label: 'ランキング設定' },
    { id: 'heading', icon: AlignLeft, label: '見出し設定' },
    { id: 'layout', icon: Layout, label: 'レイアウト設定' },
    { id: 'schedule', icon: Clock, label: '自動更新' },
  ];

  // タブコンテンツのレンダリング
  const renderTabContent = () => {
    switch (activeSettingTab) {
      case 'connection':
        return (
          <ConnectionTab
            {...commonTabProps}
            localApiKey={localApiKey}
            setLocalApiKey={setLocalApiKey}
            setIsDirty={setIsDirty}
            handleAddSource={handleAddSource}
            handleRemoveSource={handleRemoveSource}
            updateSource={updateSource}
            updatePivotSettings={updatePivotSettings}
            updateReshapeSettings={updateReshapeSettings}
            updateReshapeSettingsBatch={updateReshapeSettingsBatch}
            updateReshapeGroups={updateReshapeGroups}
            handleFetchHeadersLocal={handleFetchHeadersLocal}
            isHeaderLoading={isHeaderLoading}
            switchDashboard={switchDashboard}
            allDashboards={allDashboards}
            sourceCache={sourceCache}
            onTenantChange={handleTenantChange}
            currentTenantId={sfTenantId}
          />
        );
      case 'indicator':
        return <IndicatorTab {...commonTabProps} />;
      case 'filters':
        return <FiltersTab {...commonTabProps} />;
      case 'aggregation':
        return <AggregationTab {...commonTabProps} />;
      case 'charts':
        return <ChartsTab {...commonTabProps} />;
      case 'ranking':
        return <RankingTab {...commonTabProps} />;
      case 'heading':
        return <HeadingTab {...commonTabProps} />;
      case 'layout':
        return <LayoutTab {...commonTabProps} />;
      case 'schedule':
        return <ScheduleTab {...commonTabProps} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto pt-6 pb-24">
      {/* タブナビゲーション */}
      <div className={`border-b ${borderClass} pb-4`}>
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <style>{`.settings-tabs::-webkit-scrollbar { display: none; }`}</style>
          <div className="settings-tabs flex gap-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSettingTab(tab.id)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors whitespace-nowrap ${activeSettingTab === tab.id
                  ? theme === 'dark' ? 'bg-white/10 text-white' : 'bg-indigo-100 text-indigo-700'
                  : theme === 'dark' ? 'text-white/50 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
              >
                <tab.icon size={16} /> {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 固定保存ボタン */}
      <div className={`fixed bottom-0 left-0 md:left-64 right-0 p-4 z-30 border-t ${
        theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-gray-200'
      }`}>
        <div className="max-w-7xl mx-auto flex gap-3">
          {canExport && (
            <>
              <button
                onClick={() => setShowExportModal(true)}
                className={`px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-medium transition-all ${
                  theme === 'dark' ? 'bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30' : 'bg-sky-100 hover:bg-sky-200 text-sky-700 border border-sky-300'
                }`}
                title="設定をエクスポート"
              >
                <Download size={18} />
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className={`px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-medium transition-all ${
                  theme === 'dark' ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30' : 'bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-300'
                }`}
                title="設定をインポート"
              >
                <Upload size={18} />
              </button>
            </>
          )}
          {!isGuest && (
            <button
              onClick={handleSaveChanges}
              disabled={!isDirty || isSaving}
              className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg transition-all ${isDirty
                ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                : theme === 'dark' ? 'bg-white/10 text-white/30 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {isSaving ? '保存中...' : '設定を保存'}
            </button>
          )}
        </div>
      </div>

      {/* タブコンテンツ */}
      {renderTabContent()}

      {/* エクスポートモーダル */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowExportModal(false)}>
          <div
            className={`w-full max-w-lg rounded-2xl p-6 ${theme === 'dark' ? 'bg-slate-800 border border-white/10' : 'bg-white border border-gray-200'} shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-bold flex items-center gap-2 ${textClass}`}>
                <Download size={20} className="text-sky-400" /> 設定エクスポート
              </h3>
              <button onClick={() => setShowExportModal(false)} className={`p-1 rounded hover:bg-white/10 ${textMutedClass}`}>
                <X size={20} />
              </button>
            </div>
            <p className={`text-sm mb-4 ${textMutedClass}`}>
              エクスポートする項目を選択してください。
            </p>
            <div className="space-y-2 max-h-80 overflow-y-auto mb-4">
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => {
                    const allSelected = Object.values(exportOptions).every(v => v);
                    const newValue = !allSelected;
                    setExportOptions(Object.fromEntries(exportItems.map(item => [item.key, newValue])));
                  }}
                  className={`text-xs px-2 py-1 rounded ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white/70' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                >
                  {Object.values(exportOptions).every(v => v) ? '全て解除' : '全て選択'}
                </button>
              </div>
              {exportItems.map(item => (
                <label
                  key={item.key}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    exportOptions[item.key]
                      ? (theme === 'dark' ? 'bg-sky-500/20 border border-sky-500/30' : 'bg-sky-50 border border-sky-200')
                      : (theme === 'dark' ? 'bg-white/5 border border-white/10 hover:bg-white/10' : 'bg-gray-50 border border-gray-200 hover:bg-gray-100')
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={exportOptions[item.key]}
                    onChange={(e) => setExportOptions({ ...exportOptions, [item.key]: e.target.checked })}
                    className="mt-1"
                  />
                  <div>
                    <div className={`font-medium text-sm ${textClass}`}>{item.label}</div>
                    <div className={`text-xs ${textMutedClass}`}>{item.description}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowExportModal(false)}
                className={`flex-1 py-2.5 rounded-xl font-medium transition-all ${
                  theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white/70' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                キャンセル
              </button>
              <button
                onClick={handleExport}
                disabled={!Object.values(exportOptions).some(v => v)}
                className={`flex-1 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                  Object.values(exportOptions).some(v => v)
                    ? 'bg-sky-500 hover:bg-sky-400 text-white'
                    : (theme === 'dark' ? 'bg-white/10 text-white/30 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                }`}
              >
                <Download size={16} /> ダウンロード
              </button>
            </div>
          </div>
        </div>
      )}

      {/* インポートモーダル */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => { setShowImportModal(false); setImportData(null); setImportFileName(''); }}>
          <div
            className={`w-full max-w-lg rounded-2xl p-6 ${theme === 'dark' ? 'bg-slate-800 border border-white/10' : 'bg-white border border-gray-200'} shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-bold flex items-center gap-2 ${textClass}`}>
                <Upload size={20} className="text-amber-400" /> 設定インポート
              </h3>
              <button onClick={() => { setShowImportModal(false); setImportData(null); setImportFileName(''); }} className={`p-1 rounded hover:bg-white/10 ${textMutedClass}`}>
                <X size={20} />
              </button>
            </div>
            <p className={`text-sm mb-4 ${textMutedClass}`}>
              エクスポートしたJSONファイルを選択してください。<br />
              ファイル内に含まれる設定が現在の設定に上書きされます。
            </p>

            <div className={`border-2 border-dashed rounded-xl p-6 text-center mb-4 transition-colors ${
              importData
                ? (theme === 'dark' ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-emerald-400 bg-emerald-50')
                : (theme === 'dark' ? 'border-white/20 hover:border-white/40' : 'border-gray-300 hover:border-gray-400')
            }`}>
              <input
                type="file"
                accept=".json"
                onChange={handleImportFileSelect}
                className="hidden"
                id="import-file-input"
              />
              <label htmlFor="import-file-input" className="cursor-pointer">
                {importData ? (
                  <div>
                    <Check size={32} className="mx-auto mb-2 text-emerald-400" />
                    <div className={`font-medium ${textClass}`}>{importFileName}</div>
                    <div className={`text-xs mt-1 ${textMutedClass}`}>クリックして別のファイルを選択</div>
                  </div>
                ) : (
                  <div>
                    <Upload size={32} className={`mx-auto mb-2 ${textMutedClass}`} />
                    <div className={textMutedClass}>クリックしてファイルを選択</div>
                    <div className={`text-xs mt-1 ${textMutedClass}`}>または、ファイルをドロップ</div>
                  </div>
                )}
              </label>
            </div>

            {importData && (
              <div className={`rounded-lg p-3 mb-4 ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                <div className={`text-xs font-medium mb-2 ${textClass}`}>インポートされる項目:</div>
                <div className="flex flex-wrap gap-1">
                  {exportItems.filter(item => importData[item.key]).map(item => (
                    <span key={item.key} className={`text-xs px-2 py-1 rounded ${theme === 'dark' ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
                      {item.label}
                    </span>
                  ))}
                </div>
                {importData._exportDate && (
                  <div className={`text-xs mt-2 ${textMutedClass}`}>
                    エクスポート日時: {new Date(importData._exportDate).toLocaleString('ja-JP')}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setShowImportModal(false); setImportData(null); setImportFileName(''); }}
                className={`flex-1 py-2.5 rounded-xl font-medium transition-all ${
                  theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white/70' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                キャンセル
              </button>
              <button
                onClick={handleImport}
                disabled={!importData}
                className={`flex-1 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                  importData
                    ? 'bg-amber-500 hover:bg-amber-400 text-white'
                    : (theme === 'dark' ? 'bg-white/10 text-white/30 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                }`}
              >
                <Upload size={16} /> インポート
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsSettings;
