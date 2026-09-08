// src/apps/performance-board/index.jsx
// 実績ボード - analyticsクローン（自己完結版）

// 権限定義を登録（インポート時に自動実行）
import './permissions';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ShieldAlert, ChevronsLeft, ChevronsRight, LayoutDashboard, Plus, Activity, Settings, Cloud, XCircle } from 'lucide-react';
import DashboardView from './DashboardView';
import AnalyticsSettings from './AnalyticsSettings';
import ErrorActionModal from './components/ErrorActionModal';
import SalesforceSync from './components/SalesforceSync';
import VersionBadge from './components/VersionBadge';
import { usePermission } from '../../hooks/usePermission';
import { useAnalyticsData, useFilterStorage, useAnalyticsStore } from './hooks';
import { getDefaultFilters } from './utils/dateFilters';
import { savePbConfigMerged } from './hooks/useConfigUpdates';
import { DEFAULT_DASHBOARD_CONFIG } from '../../constants';

const DEFAULT_ROLES = {};

const PerformanceBoardApp = ({
  theme,
  user,
  roles: appRoles,
  glassClass,
  sidebarCollapsed,
  sidebarHovered,
  subSidebarExpanded,
  setSubSidebarExpanded,
}) => {
  const { hasPermission, isAdmin } = usePermission(user, appRoles);
  const roles = appRoles || DEFAULT_ROLES;

  // ====== config.json からの読み込み（App.jsxのL140-215相当） ======
  const [store, setStore] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const [globalLoadingMessage, setGlobalLoadingMessage] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [isFilterApplying, setIsFilterApplying] = useState(false);
  const [configLoadError, setConfigLoadError] = useState(null);
  const initialFilterSavedRef = useRef(false);

  // フィルター用ストレージキー（analytics互換プレフィックス）
  const getFilterStorageKey = (id) => `pb_filters_${id}`;

  const loadConfig = useCallback(async () => {
    setConfigLoadError(null);
    setIsConfigLoading(true);
    setGlobalLoadingMessage('設定を読み込み中...');
    try {
      const res = await fetch(`./performance_board/save_pb_config.php?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const configData = await res.json();

      if (configData && configData.dashboards) {
        Object.keys(configData.dashboards).forEach(key => {
          configData.dashboards[key].savedFilters = {};
        });
      }

      const activeConfig = configData?.dashboards?.[configData?.activeId] || {};
      const defaultExcludeFilters = activeConfig.defaultFilters?.excludeFilters || {};
      const savedKey = getFilterStorageKey(configData?.activeId);
      let savedFilters = null;
      try {
        const savedRaw = localStorage.getItem(savedKey);
        if (savedRaw) savedFilters = JSON.parse(savedRaw);
      } catch { /* ignore */ }

      const hasSaved = !!savedFilters;
      initialFilterSavedRef.current = hasSaved;

      if (savedFilters) {
        setActiveFilters({ ...savedFilters, _exclude: defaultExcludeFilters });
      } else {
        setActiveFilters(getDefaultFilters(activeConfig.defaultFilters || {}));
      }

      setStore(configData);
      setIsLoading(false);
      if (!configData?.activeId) {
        // activeIdがなければメッセージクリア（fetchData呼び出しなし）
        setGlobalLoadingMessage('');
      } else {
        // activeIdがあればfetchData用メッセージに切り替え（オーバーレイ継続表示）
        setGlobalLoadingMessage('データ更新中...');
      }
    } catch (e) {
      console.error('Failed to load config:', e);
      setConfigLoadError(e?.message || String(e));
      setStore(null);
      setIsLoading(false);
      setGlobalLoadingMessage('');
    } finally {
      setIsConfigLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // safeConfig: 現在のダッシュボード設定
  const safeConfig = useMemo(() => {
    if (store?.dashboards && store.activeId) {
      return store.dashboards[store.activeId] || DEFAULT_DASHBOARD_CONFIG;
    }
    return DEFAULT_DASHBOARD_CONFIG;
  }, [store]);

  // ====== useFilterStorage（App.jsxのL234-241相当） ======
  const filterStorage = useFilterStorage({
    dashboardId: store?.activeId,
    activeFilters,
    setActiveFilters,
    setGlobalLoadingMessage,
    setIsFilterApplying,
    defaultFilters: safeConfig.defaultFilters || {},
  });

  // init useEffectで設定した初期値をfilterStorageに同期
  useEffect(() => {
    if (initialFilterSavedRef.current) {
      filterStorage.setFilterSaved(true);
      initialFilterSavedRef.current = false;
    }
  }, [filterStorage.setFilterSaved]);

  // ====== useAnalyticsStore（App.jsxのL252-262相当） ======
  const analyticsStore = useAnalyticsStore({
    store,
    setStore,
    user,
    safeConfig,
    setIsLoading,
    setGlobalLoadingMessage,
    activeFilters,
    setActiveFilters,
    filterStorage,
  });

  // マウント時・activeId確定時・ボード切替時の自動fetch
  // boardId別に「fetch済みか」を管理することで、複数ボード対応
  // fetchData は useCallback の deps 変化で都度新参照になるため ref 経由で最新版を参照
  // （useEffect の deps から外せば stale closure を回避しつつ activeId のみで発火できる）
  const hasFetchedRef = useRef({});
  const fetchDataRef = useRef(analyticsStore.fetchData);
  fetchDataRef.current = analyticsStore.fetchData;
  useEffect(() => {
    const activeId = store?.activeId;
    if (!activeId) return;
    // ボード切替時は前ボードの残留 error をクリア（Important: Phase 5.3 review）
    if (analyticsStore.error) analyticsStore.setError?.(null);
    if (hasFetchedRef.current[activeId]) return;
    hasFetchedRef.current[activeId] = true;
    fetchDataRef.current(false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.activeId]);

  // ====== useAnalyticsData（App.jsxのL326-349相当） ======
  const {
    calculatedData,
    filteredData,
    summaryData,
    sourceIndices,
    isCalculating,
    calcProgress,
    calculationWarnings,
    numericFieldIds,
    allNumericFieldIds,
    cancelCalculation,
    triggerRecalculation,
  } = useAnalyticsData({
    rawData: analyticsStore.rawData,
    sourceCache: analyticsStore.sourceCache,
    config: safeConfig,
    activeFilters,
    dashboardId: store?.activeId,
    calculatedDataCache: analyticsStore.calculatedDataCache,
    setCalculatedDataCache: analyticsStore.setCalculatedDataCache,
    setIsLoading,
    setIsBackgroundRefreshing: analyticsStore.setIsBackgroundRefreshing,
    setGlobalLoadingMessage,
    isFetching: analyticsStore.isFetching,
  });

  const dashboardWarnings = useMemo(
    () => [...(analyticsStore.columnWarnings || []), ...calculationWarnings],
    [analyticsStore.columnWarnings, calculationWarnings]
  );

  // グローバル設定関連
  const setGlobalApiKey = (key) => {
    setStore(prev => ({ ...prev, apiKey: key }));
    if (user?.role === 'admin') savePbConfigMerged(latest => ({ ...latest, apiKey: key }));
  };

  const updateAccounts = (newAccounts) => {
    setStore(prev => ({ ...prev, accounts: newAccounts }));
    if (user?.role === 'admin') savePbConfigMerged(latest => ({ ...latest, accounts: newAccounts }));
  };

  // onCacheRebuild: App.jsxのL1097-1100相当
  const handleCacheRebuild = () => {
    if (user?.isGuest) return;
    const sources = safeConfig?.dataSources || [];
    sources.forEach(s => { if (s.serverCacheEnabled) analyticsStore.triggerCacheRebuild(s.id); });
    analyticsStore.fetchData(true, false);
  };

  // ====== タブ制御 ======
  const [activeTab, setActiveTab] = useState('View');
  const [viewRendered, setViewRendered] = useState(true);
  const [settingsRendered, setSettingsRendered] = useState(false);

  useEffect(() => {
    if (activeTab === 'View') setViewRendered(true);
    if (activeTab === 'Settings') setSettingsRendered(true);
  }, [activeTab]);

  // analyticsStore.subTab をactiveTabに接続
  useEffect(() => {
    analyticsStore.setSubTab(activeTab);
  }, [activeTab]);

  // 設定読込失敗時はエラーモーダルを表示（isConfigLoadingより先に判定）
  if (configLoadError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className={`absolute inset-0 ${theme === 'dark' ? 'bg-slate-900/90' : 'bg-white/90'}`} />
        <div className={`relative flex flex-col items-center gap-4 p-8 rounded-2xl ${
          theme === 'dark' ? 'bg-slate-800/90 border border-white/10' : 'bg-white/90 border border-gray-200'
        } shadow-2xl min-w-[320px] max-w-md`}>
          <ShieldAlert className={`w-12 h-12 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} />
          <div className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            設定ファイルの読込に失敗しました
          </div>
          <div className={`text-sm text-center ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
            {configLoadError}
          </div>
          <button
            onClick={loadConfig}
            className={`px-6 py-2 rounded-lg font-medium transition ${
              theme === 'dark'
                ? 'bg-indigo-500 hover:bg-indigo-400 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            リトライ
          </button>
        </div>
      </div>
    );
  }

  // isConfigLoading中はグローバルオーバーレイを表示（早期returnではなく下のオーバーレイに委ねる）
  if (isConfigLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className={`absolute inset-0 ${theme === 'dark' ? 'bg-slate-900/90' : 'bg-white/90'}`} />
        <div className={`relative flex flex-col items-center gap-4 p-8 rounded-2xl ${
          theme === 'dark' ? 'bg-slate-800/90 border border-white/10' : 'bg-white/90 border border-gray-200'
        } shadow-2xl min-w-[280px]`}>
          <div className="relative">
            <div className={`w-12 h-12 rounded-full border-4 border-t-transparent animate-spin ${
              theme === 'dark' ? 'border-indigo-500' : 'border-indigo-600'
            }`} />
          </div>
          <div className={`text-sm font-medium text-center ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
            {globalLoadingMessage || '設定を読み込み中...'}
          </div>
        </div>
      </div>
    );
  }

  // 権限チェック
  const canViewDashboard = isAdmin || hasPermission('performance-board.view');
  const canCreateDashboard = !user?.isGuest && (isAdmin
    || hasPermission('performance-board.dashboard.create')
    || hasPermission('analytics.dashboard.create'));
  const canOpenSettings = user?.isGuest || isAdmin || hasPermission('performance-board.settings');
  if (!canViewDashboard) {
    return (
      <div className={`flex flex-col items-center justify-center h-[60vh] ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
        <div className={`p-8 rounded-2xl ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
          <div className="text-center">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-rose-500/20' : 'bg-rose-100'}`}>
              <ShieldAlert size={32} className="text-rose-400" />
            </div>
            <h3 className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
              アクセス権限がありません
            </h3>
          </div>
        </div>
      </div>
    );
  }

  // SalesforceSync タブ
  if (activeTab === 'SalesforceSync') {
    return (
      <SalesforceSync
        theme={theme}
        glassClass={glassClass}
        config={safeConfig}
        allRows={calculatedData}
        sourceCache={analyticsStore.sourceCache}
        activeFilters={activeFilters}
        allDashboards={store?.dashboards}
        switchDashboard={analyticsStore.switchDashboard}
        updateConfig={analyticsStore.updateConfig}
        isLoading={isLoading}
        onRefresh={user?.isGuest ? undefined : () => analyticsStore.fetchData(true, false)}
        sourceCacheByDashboard={analyticsStore.sourceCacheByDashboard}
        calculatedDataCache={analyticsStore.calculatedDataCache}
        globalApiKey={store?.apiKey || ''}
      />
    );
  }

  // ボードビュー一覧（サブサイドバー用）
  const visibleDashboards = analyticsStore.getVisibleDashboards
    ? analyticsStore.getVisibleDashboards(user, roles)
    : Object.values(store?.dashboards || {});

  const subExpanded = subSidebarExpanded || !sidebarCollapsed;

  return (
    <>
      {/* サブサイドバー（analytics L662-822 完全同ロジック） */}
      <aside
        className={`hidden md:flex fixed top-0 h-full ${subExpanded ? 'w-48' : 'w-12'} ${glassClass} z-40 transition-all duration-300 flex-col overflow-hidden
          ${sidebarCollapsed && !sidebarHovered ? 'left-16' : 'left-64'}
        `}
      >
        {/* 折りたたみ表示（アイコンのみ） */}
        <div className={`flex flex-col h-full absolute inset-0 transition-opacity duration-200 ${!subExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          {sidebarCollapsed && (
            <button
              onClick={() => setSubSidebarExpanded(true)}
              className={`flex items-center justify-center p-2 mx-1 mt-3 rounded-lg transition-all ${theme === 'dark' ? 'text-white/40 hover:bg-white/10 hover:text-white' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'}`}
              title="サイドバーを展開"
            >
              <ChevronsRight size={14} />
            </button>
          )}
          <div className="flex-1 overflow-y-auto py-4 px-1 space-y-1">
            {visibleDashboards.map(dashboard => {
              const isActiveDash = store?.activeId === dashboard.id;
              return (
                <button
                  key={dashboard.id}
                  onClick={() => analyticsStore.switchDashboard(dashboard.id)}
                  className={`w-full flex items-center justify-center p-2 rounded-lg transition-all ${isActiveDash
                    ? (theme === 'dark' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800')
                    : (theme === 'dark' ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800')
                    }`}
                  title={dashboard.name}
                >
                  <LayoutDashboard size={14} />
                </button>
              );
            })}
            {canCreateDashboard && (
              <button onClick={analyticsStore.createDashboard} className={`w-full flex items-center justify-center p-2 rounded-lg border transition-all ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white' : 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-600'}`} title="新規作成">
                <Plus size={14} />
              </button>
            )}
            {store?.activeId && (
              <>
                <div className={`mx-1 my-2 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`} />
                <button onClick={() => setActiveTab('View')} className={`w-full flex items-center justify-center p-2 rounded-lg transition-all ${activeTab === 'View' ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700') : (theme === 'dark' ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800')}`} title="アナリティクス">
                  <Activity size={14} />
                </button>
                {canOpenSettings && (
                  <button onClick={() => setActiveTab('Settings')} className={`w-full flex items-center justify-center p-2 rounded-lg transition-all ${activeTab === 'Settings' ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700') : (theme === 'dark' ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800')}`} title="設定 & データ">
                    <Settings size={14} />
                  </button>
                )}
                {(isAdmin || hasPermission('performance-board.salesforce')) && (
                  <button onClick={() => setActiveTab('SalesforceSync')} className={`w-full flex items-center justify-center p-2 rounded-lg transition-all ${activeTab === 'SalesforceSync' ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700') : (theme === 'dark' ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800')}`} title="SF連携">
                    <Cloud size={14} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* 展開表示（テキスト付き） */}
        <div className={`flex flex-col h-full min-w-[192px] transition-opacity duration-200 delay-75 ${subExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          {sidebarCollapsed && (
            <button
              onClick={() => setSubSidebarExpanded(false)}
              className={`flex items-center gap-2 px-3 py-2 mx-2 mt-3 rounded-lg transition-all text-xs ${theme === 'dark' ? 'text-white/40 hover:bg-white/10 hover:text-white' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'}`}
              title="サイドバーを折りたたむ"
            >
              <ChevronsLeft size={14} />
              <span>閉じる</span>
            </button>
          )}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>ボードビュー</div>
              <div className="space-y-1">
                {visibleDashboards.map(dashboard => {
                  const isActiveDash = store?.activeId === dashboard.id;
                  return (
                    <button
                      key={dashboard.id}
                      onClick={() => analyticsStore.switchDashboard(dashboard.id)}
                      className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-all text-xs text-left ${isActiveDash
                        ? (theme === 'dark' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800')
                        : (theme === 'dark' ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800')
                        }`}
                    >
                      <LayoutDashboard size={14} />
                      <span className="truncate flex-1 text-left">{dashboard.name}</span>
                    </button>
                  );
                })}
              </div>
              {canCreateDashboard && (
                <button
                  onClick={analyticsStore.createDashboard}
                  className={`w-full flex items-center justify-center gap-1 px-3 py-2 mt-2 rounded-lg border text-xs transition-all ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white' : 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-600'}`}
                >
                  <Plus size={14} />
                  <span>新規作成</span>
                </button>
              )}
            </div>
            {store?.activeId && (
              <div className={`pt-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>表示</div>
                <div className="space-y-1">
                  <button onClick={() => setActiveTab('View')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-xs ${activeTab === 'View' ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700') : (theme === 'dark' ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800')}`}>
                    <Activity size={14} /><span>アナリティクス</span>
                  </button>
                  {canOpenSettings && (
                    <button onClick={() => setActiveTab('Settings')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-xs ${activeTab === 'Settings' ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700') : (theme === 'dark' ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800')}`}>
                      <Settings size={14} /><span>設定 & データ</span>
                    </button>
                  )}
                  {(isAdmin || hasPermission('performance-board.salesforce')) && (
                    <button onClick={() => setActiveTab('SalesforceSync')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-xs ${activeTab === 'SalesforceSync' ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700') : (theme === 'dark' ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800')}`}>
                      <Cloud size={14} /><span>SF連携</span>
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className={`pt-3 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
              <VersionBadge theme={theme} />
            </div>
          </div>
        </div>
      </aside>

      {/* コンテンツエリア（aside の外。main の md:ml-* がマージンを確保） */}
      <div className="px-6">
        {/* View タブ（Keep-Alive） */}
        {viewRendered && (
          <div style={{ display: activeTab === 'View' ? undefined : 'none' }}>
            <DashboardView
              glassClass={glassClass}
              allRows={calculatedData}
              filteredRows={filteredData}
              summaryData={summaryData}
              config={safeConfig}
              filters={safeConfig?.filters}
              activeFilters={activeFilters}
              setActiveFilters={setActiveFilters}
              systemFields={safeConfig?.systemFields}
              calculations={safeConfig?.calculations}
              isLoading={isLoading || isFilterApplying}
              isConnected={analyticsStore.isConnected}
              error={analyticsStore.error}
              onRefresh={user?.isGuest ? undefined : () => analyticsStore.fetchData(true, false)}
              onCancelFetch={analyticsStore.cancelFetch}
              user={user}
              onUpdateSectionFields={analyticsStore.updateSectionFields}
              lastUpdated={analyticsStore.lastUpdated}
              theme={theme}
              sourceCache={analyticsStore.sourceCache}
              saveFilters={filterStorage.saveFilters}
              clearSavedFilters={filterStorage.clearSavedFilters}
              hasSavedFilters={filterStorage.filterSaved}
              setIsFilterApplying={setIsFilterApplying}
              isBackgroundRefreshing={analyticsStore.isBackgroundRefreshing}
              cacheStatus={analyticsStore.cacheStatus}
              onColumnColorsChange={analyticsStore.updateDataTableColumnColors}
              onColumnAliasChange={analyticsStore.updateDataTableColumnAliases}
              onVisibleEmployeeIdsChange={analyticsStore.updateDataTableVisibleEmployeeIds}
              onStickyColumnsChange={analyticsStore.updateDataTableStickyColumns}
              onMaxHeightChange={analyticsStore.updateDataTableMaxHeight}
              onFontSizeChange={analyticsStore.updateDataTableFontSize}
              onHeaderFontSizeChange={analyticsStore.updateDataTableHeaderFontSize}
              onSummaryFontSizeChange={analyticsStore.updateDataTableSummaryFontSize}
              onDataFontSizeChange={analyticsStore.updateDataTableDataFontSize}
              onDataRowHeightChange={analyticsStore.updateDataTableDataRowHeight}
              onHeaderRowHeightChange={analyticsStore.updateDataTableHeaderRowHeight}
              onSummaryRowHeightChange={analyticsStore.updateDataTableSummaryRowHeight}
              onColumnWidthsChange={analyticsStore.updateDataTableColumnWidths}
              onComparisonTableConfigChange={analyticsStore.updateComparisonTableConfig}
              onVendorPivotMetricColorsChange={analyticsStore.updateVendorPivotTableMetricColors}
              onVendorPivotTableFilterChange={analyticsStore.updateVendorPivotTableFilterValues}
              onCalculationsChange={analyticsStore.updateCalculations}
              onDataTableSettingsChange={analyticsStore.updateDataTableSettings}
              onAddDataTable={analyticsStore.addDataTable}
              onDeleteDataTable={analyticsStore.deleteDataTable}
              onRecalculate={triggerRecalculation}
              serverCacheInfo={analyticsStore.serverCacheInfo}
              onCacheRebuild={user?.isGuest ? undefined : handleCacheRebuild}
              columnWarnings={dashboardWarnings}
              onToggleMobileSubSidebar={() => {}}
              mobileSubSidebarOpen={false}
              isCalculating={isCalculating}
              calcProgress={calcProgress}
            />
          </div>
        )}

        {/* Settings タブ（Keep-Alive） */}
        {settingsRendered && (
          <div style={{ display: activeTab === 'Settings' ? undefined : 'none' }}>
            <AnalyticsSettings
              glassClass={glassClass}
              globalApiKey={store?.apiKey || ''}
              setGlobalApiKey={setGlobalApiKey}
              config={safeConfig}
              updateConfig={analyticsStore.updateConfig}
              saveDashboardConfig={analyticsStore.saveDashboardConfig}
              allDashboards={store?.dashboards}
              switchDashboard={analyticsStore.switchDashboard}
              onFetchHeaders={analyticsStore.handleFetchHeaders}
              isLoading={isLoading}
              error={analyticsStore.error}
              onUpdateTableFieldsOrder={analyticsStore.updateTableFieldsOrder}
              theme={theme}
              accounts={store?.accounts || {}}
              updateAccounts={updateAccounts}
              user={user}
              roles={roles}
              sourceCache={analyticsStore.sourceCache}
            />
          </div>
        )}

        {/* エラーアクションモーダル（error state が object の場合のみ） */}
        {analyticsStore.error && typeof analyticsStore.error === 'object' && (
          <ErrorActionModal
            error={analyticsStore.error}
            theme={theme}
            onRetry={() => {
              if (user?.isGuest) return;
              analyticsStore.setError?.(null);
              analyticsStore.fetchData(true, false);
            }}
            onGenerate={() => {
              if (user?.isGuest) return;
              analyticsStore.fetchData(true, false);
            }}
            onOpenSettings={() => {
              setActiveTab('Settings');
            }}
            onDismiss={() => {
              analyticsStore.setError?.(null);
            }}
          />
        )}

        {/* グローバルローディングオーバーレイ（全ての読み込み時・計算時・更新時に表示） */}
        {/* Critical fix (Phase 5.3 review): エラー時はモーダル優先でオーバーレイを隠す */}
        {(isLoading || isCalculating || isFilterApplying || analyticsStore.isBackgroundRefreshing || globalLoadingMessage) && !analyticsStore.error && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className={`absolute inset-0 ${theme === 'dark' ? 'bg-slate-900/90' : 'bg-white/90'}`} />
            <div className={`relative flex flex-col items-center gap-4 p-8 rounded-2xl ${theme === 'dark' ? 'bg-slate-800/90 border border-white/10' : 'bg-white/90 border border-gray-200'} shadow-2xl min-w-[280px]`}>
              <div className="relative">
                <div className={`w-12 h-12 rounded-full border-4 border-t-transparent animate-spin ${theme === 'dark' ? 'border-indigo-500' : 'border-indigo-600'}`} />
              </div>
              <div className={`text-sm font-medium text-center ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
                {globalLoadingMessage || (isCalculating ? `計算処理中... ${calcProgress}%` : isFilterApplying ? 'フィルター適用中...' : analyticsStore.isBackgroundRefreshing ? '更新中...' : isLoading ? 'データ読み込み中...' : '読み込み中...')}
              </div>
              {/* 進捗バー（generate.php 処理中のポーリング進捗） */}
              {analyticsStore.loadingProgress?.total > 0 && (
                <div className="w-full">
                  <div className={`text-xs mb-1 ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
                    {analyticsStore.loadingProgress.phase === 'combine'
                      ? analyticsStore.loadingProgress.stage
                      : analyticsStore.loadingProgress.currentSource
                      ? `ソース ${analyticsStore.loadingProgress.current + 1}/${analyticsStore.loadingProgress.total}: ${analyticsStore.loadingProgress.currentSource}`
                      : `${analyticsStore.loadingProgress.current}/${analyticsStore.loadingProgress.total} 完了`}
                  </div>
                  <div className={`w-full h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}>
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${theme === 'dark' ? 'bg-indigo-500' : 'bg-indigo-600'}`}
                      style={{ width: `${analyticsStore.loadingProgress.percentage || 0}%` }}
                    />
                  </div>
                  <div className={`text-xs mt-1 text-right ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
                    {analyticsStore.loadingProgress.percentage || 0}%
                  </div>
                </div>
              )}
              {/* 進捗バー（isCalculating 時の計算進捗） */}
              {isCalculating && (
                <div className="w-full">
                  <div className={`w-full h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}>
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${theme === 'dark' ? 'bg-indigo-500' : 'bg-indigo-600'}`}
                      style={{ width: `${calcProgress}%` }}
                    />
                  </div>
                </div>
              )}
              {(analyticsStore.loadingProgress?.phase === 'combine' || isCalculating) && (
                <button
                  type="button"
                  onClick={() => {
                    analyticsStore.cancelFetch();
                    cancelCalculation();
                  }}
                  className={`mt-1 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${theme === 'dark' ? 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white' : 'border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-800'}`}
                >
                  <XCircle size={16} />
                  キャンセル
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PerformanceBoardApp;
