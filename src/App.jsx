// src/App.jsx
import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, Suspense, lazy } from 'react';
import {
  LayoutDashboard,
  Activity,
  Settings,
  Menu,
  X,
  Plus,
  Trash2,
  LogOut,
  ShieldCheck,
  Eye,
  RefreshCw,
  Sun,
  Moon,
  Copy,
  GripVertical,
  StopCircle,
  Cloud,
  CalendarDays,
  List,
  User,
  CalendarX2,
  UserPlus,
  Cog,
  PhoneCall,
  Briefcase,
  ChevronsRight,
  ChevronsLeft,
  ChevronDown,
  PanelLeft,
  Archive,
  BookOpen,
  FileEdit,
  MessageSquarePlus,
  Stethoscope,
  FileText
} from 'lucide-react';
import LoginView from './components/LoginView';
import { APP_REGISTRY, getEnabledApps, getBoardDisplayName } from './apps';
import { usePermission } from './hooks/usePermission';

// 権限定義を読み込み（サイドバー表示前に登録を完了させる）
// 単独版では実績ボードのみ
import './apps/performance-board/permissions';

// 遅延読み込み用のコンポーネント
const GlobalSettingsView = lazy(() => import('./components/GlobalSettingsView'));
const PerformanceBoardApp = lazy(() => import('./apps/performance-board'));

// SalesHub サブサイドバー用ナビアイテム
const SalesHubNavItem = ({ label, Icon, active, theme, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-all rounded-none ${active
      ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300 border-r-2 border-indigo-400' : 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-500')
      : (theme === 'dark' ? 'text-white/60 hover:bg-white/8 hover:text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800')
      }`}
  >
    <Icon size={15} strokeWidth={1.8} className="shrink-0" />
    <span className="truncate">{label}</span>
  </button>
);
import {
  loadAuthData,
  saveAuthData,
  fetchServerConfig,
  saveConfigMerged,
  setUnauthorizedHandler,
  getStoragePrefix,
} from './utils';
import { DEFAULT_DASHBOARD_CONFIG, DEFAULT_ACCOUNTS, DEFAULT_GLOBAL_SETTINGS, DEFAULT_ROLES } from './constants';
// 単独版では analytics を同梱しないため、同一APIを持つ実績ボード側のフックを使用
import { useAnalyticsData, useFilterStorage, useAnalyticsStore } from './apps/performance-board/hooks';
import { getDefaultFilters } from './apps/performance-board/utils';

// BackgroundBubbles コンポーネント
const BackgroundBubbles = React.memo(({ theme }) => (
  <div className={`fixed inset-0 -z-10 overflow-hidden ${theme === 'dark' ? 'bg-slate-900' : 'bg-gray-100'}`}>
    {/* 静的なグラデーション背景（パフォーマンス最適化済み） */}
    <div
      className="absolute inset-0"
      style={{
        background: theme === 'dark'
          ? 'radial-gradient(ellipse 80% 60% at 10% 20%, rgba(124, 58, 237, 0.15) 0%, transparent 50%), radial-gradient(ellipse 60% 50% at 90% 30%, rgba(59, 130, 246, 0.12) 0%, transparent 50%), radial-gradient(ellipse 70% 60% at 40% 90%, rgba(99, 102, 241, 0.1) 0%, transparent 50%)'
          : 'radial-gradient(ellipse 80% 60% at 10% 20%, rgba(192, 132, 252, 0.2) 0%, transparent 50%), radial-gradient(ellipse 60% 50% at 90% 30%, rgba(147, 197, 253, 0.2) 0%, transparent 50%), radial-gradient(ellipse 70% 60% at 40% 90%, rgba(165, 180, 252, 0.15) 0%, transparent 50%)'
      }}
    />
  </div>
));

const App = () => {
  // === グローバルState（App.jsxで管理） ===
  const [user, setUser] = useState(loadAuthData);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [subSidebarExpanded, setSubSidebarExpanded] = useState(true);
  const [mobileDashSwitcherOpen, setMobileDashSwitcherOpen] = useState(false);
  const [mobileSubSidebarOpen, setMobileSubSidebarOpen] = useState(false);
  const [store, setStore] = useState(null);
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem(`${getStoragePrefix()}theme`) || 'dark');
  const [globalLoadingMessage, setGlobalLoadingMessage] = useState('');

  // アプリ切り替え用state
  // 単独版は実績ボードのみ。管理者は下の自動切替（isAdminでreturn）を通らないため初期値で指定する
  const [activeApp, setActiveApp] = useState('performance-board');
  const [salesHubView, setSalesHubView] = useState('preconfirm');
  const [analyticsRendered, setAnalyticsRendered] = useState(false);
  const [pbRendered, setPbRendered] = useState(false);
  const enabledApps = getEnabledApps();

  // ローディング・フィルター状態
  const [activeFilters, setActiveFilters] = useState(() => getDefaultFilters({}));
  const [isLoading, setIsLoading] = useState(false);
  const [isFilterApplying, setIsFilterApplying] = useState(false);

  // 権限チェック用フック
  const { hasPermission, isAdmin } = usePermission(user, store?.roles || DEFAULT_ROLES);

  useEffect(() => {
    saveAuthData(user);
  }, [user]);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  // テーマ切り替えの永続化とHTML classの更新
  useEffect(() => {
    localStorage.setItem(`${getStoragePrefix()}theme`, theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // フィルター読み込み用のヘルパー関数（init useEffect用）
  const getFilterStorageKeyHelper = (id) => `${getStoragePrefix()}filters_${id}`;
  const loadSavedFiltersHelper = (id) => {
    try {
      const saved = localStorage.getItem(getFilterStorageKeyHelper(id));
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return null;
  };
  const checkSavedFiltersHelper = (id) => {
    if (!id) return false;
    return localStorage.getItem(getFilterStorageKeyHelper(id)) !== null;
  };

  // filterSavedの初期値を保持するためのref
  const initialFilterSavedRef = useRef(false);

  // 初期設定読み込み
  useEffect(() => {
    const init = async () => {
      setIsConfigLoading(true);
      setGlobalLoadingMessage('設定を読み込み中...');

      if (user) {
        try {
          const response = await fetch('./login.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'check' })
          });
          if (response.status === 401) {
            setUser(null);
          } else if (response.ok) {
            const data = await response.json();
            if (data?.user) {
              setUser({
                ...data.user,
                role: data.user.roleId
              });
            }
          }
        } catch {
          // セッション確認に失敗しても設定の読み込みは続行する
        }
      }

      const configData = await fetchServerConfig();

      if (configData && configData.dashboards) {
        Object.keys(configData.dashboards).forEach(key => {
          configData.dashboards[key].savedFilters = {};
        });
      }

      // globalSettings がない場合はマイグレーション（既存のappNameを引き継ぐ）
      if (configData && !configData.globalSettings) {
        const firstDashboard = configData.dashboards?.[configData.activeId] ||
          Object.values(configData.dashboards || {})[0];
        const existingAppName = firstDashboard?.appName || DEFAULT_GLOBAL_SETTINGS.appName;
        configData.globalSettings = {
          ...DEFAULT_GLOBAL_SETTINGS,
          appName: existingAppName
        };
      }

      // 保存されたフィルターがあれば読み込み、なければデフォルトを適用
      // デフォルト除外フィルターは常に適用する
      const activeConfig = configData?.dashboards?.[configData?.activeId] || {};
      const defaultExcludeFilters = activeConfig.defaultFilters?.excludeFilters || {};
      const savedFilters = loadSavedFiltersHelper(configData?.activeId);
      const hasSaved = checkSavedFiltersHelper(configData?.activeId);
      initialFilterSavedRef.current = hasSaved;
      if (savedFilters) {
        // 保存されたフィルターにデフォルト除外フィルターをマージ
        setActiveFilters({
          ...savedFilters,
          _exclude: defaultExcludeFilters
        });
      } else {
        setActiveFilters(getDefaultFilters(activeConfig.defaultFilters || {}));
      }

      setStore(configData);
      // isLoadingはanalyticsアプリ専用のため、他アプリでは使用しない
      // useAnalyticsStoreのuseEffectでキャッシュ確認後にfalseにされる
      setIsLoading(false);
      setGlobalLoadingMessage('');
      setIsConfigLoading(false);
    };
    init();
  }, [user?.id]);

  // safeConfig: 現在のダッシュボード設定
  const safeConfig = useMemo(() => {
    if (store && store.dashboards && store.activeId) {
      return store.dashboards[store.activeId] || DEFAULT_DASHBOARD_CONFIG;
    }
    return DEFAULT_DASHBOARD_CONFIG;
  }, [store]);

  // 共通設定（globalSettings）を安全に取得
  const safeGlobalSettings = useMemo(() => {
    if (store && store.globalSettings) {
      return { ...DEFAULT_GLOBAL_SETTINGS, ...store.globalSettings };
    }
    return DEFAULT_GLOBAL_SETTINGS;
  }, [store]);

  // ★ フィルター永続化フック
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
      initialFilterSavedRef.current = false; // 一度だけ実行
    }
  }, [filterStorage.setFilterSaved]);

  // ★ Analytics Store フック（State・データ取得・ダッシュボード操作を統合）
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

  // Analytics Keep-Alive: 一度表示したらマウント維持フラグ
  useEffect(() => {
    if (activeApp === 'analytics') setAnalyticsRendered(true);
    if (activeApp === 'performance-board') setPbRendered(true);
  }, [activeApp]);

  // コールデータボード・給与計算選択時にサイドバーを自動折りたたみ（useLayoutEffect でペイント前に確定させ、二段階 transition を回避）
  useLayoutEffect(() => {
    const hasViewPermission = isAdmin || hasPermission('analytics.view');
    const hasPbViewPermission = isAdmin || hasPermission('performance-board.view');
    if (activeApp === 'analytics' && analyticsStore.subTab !== 'GlobalSettings' && hasViewPermission) {
      setSidebarCollapsed(true);
    } else if (activeApp === 'performance-board' && analyticsStore.subTab !== 'GlobalSettings' && hasPbViewPermission) {
      setSidebarCollapsed(true);
    } else if (activeApp === 'sales-hub' && analyticsStore.subTab !== 'GlobalSettings') {
      setSidebarCollapsed(true);
    } else {
      setSidebarCollapsed(false);
    }
  }, [activeApp, analyticsStore.subTab, isAdmin, hasPermission]);

  // ブラウザタブのタイトルを動的に更新
  useEffect(() => {
    const appName = safeGlobalSettings.appName || 'CallData Analysis';
    document.title = appName;
  }, [safeGlobalSettings.appName]);

  // ボードの表示可否を判定するヘルパー関数
  // 条件: hiddenBoardsに含まれない AND ロールに{boardId}.view権限がある（adminは常にtrue）
  const isBoardVisible = (boardId) => {
    if (isAdmin) return true;
    const hiddenBoards = safeGlobalSettings.hiddenBoards || [];
    if (hiddenBoards.includes(boardId)) return false;
    return hasPermission(`${boardId}.view`);
  };

  // 閲覧権限ユーザーがアクセス不可ボードにいた場合、表示可能なボードに切り替え
  useEffect(() => {
    if (isAdmin) return; // 管理者は全ボードにアクセス可能

    // 現在のボードがアクセス不可の場合、表示可能な最初のボードに切り替え
    if (!isBoardVisible(activeApp)) {
      const visibleApp = APP_REGISTRY.find(app => isBoardVisible(app.id));
      if (visibleApp) {
        setActiveApp(visibleApp.id);
      } else {
        // 全てのボードがアクセス不可の場合
        setActiveApp(null);
      }
    }
  }, [isAdmin, hasPermission, safeGlobalSettings.hiddenBoards, activeApp]);

  // アクティブダッシュボードがロール制限で非表示の場合、表示可能なダッシュボードに自動切替
  useEffect(() => {
    if (isAdmin || !store?.dashboards || !user) return;
    const visibleDashboards = analyticsStore.getVisibleDashboards(user, store.roles || DEFAULT_ROLES);
    if (visibleDashboards.length === 0) return;
    const activeVisible = visibleDashboards.some(d => d.id === store.activeId);
    if (!activeVisible) {
      analyticsStore.switchDashboard(visibleDashboards[0].id);
    }
  }, [store?.activeId, store?.dashboards, user, isAdmin, store?.roles]);

  // ★ useAnalyticsData フックで計算ロジックを実行
  const {
    calculatedData,
    filteredData,
    summaryData,
    sourceIndices,
    isCalculating,
    calcProgress,
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

  // グローバル設定関連（Analytics以外でも使用）
  // マージ保存: 最新configを取得→変更部分だけマージ→保存（競合防止）
  const setGlobalApiKey = (key) => {
    setStore(prev => ({ ...prev, apiKey: key }));
    if (user?.role === 'admin') saveConfigMerged(latest => ({ ...latest, apiKey: key }));
  };

  const updateAccounts = (newAccounts) => {
    setStore(prev => ({ ...prev, accounts: newAccounts }));
    if (user?.role === 'admin') saveConfigMerged(latest => ({ ...latest, accounts: newAccounts }));
  };

  const updateGlobalSettings = (newGlobalSettings) => {
    setStore(prev => ({ ...prev, globalSettings: newGlobalSettings }));
    if (user?.role === 'admin') saveConfigMerged(latest => ({ ...latest, globalSettings: newGlobalSettings }));
  };

  // ロール更新関数
  const updateRoles = (newRoles) => {
    setStore(prev => ({ ...prev, roles: newRoles }));
    if (user?.role === 'admin') saveConfigMerged(latest => ({ ...latest, roles: newRoles }));
  };

  // ダッシュボード更新関数（ロール管理からのallowedRoles変更用）
  const updateDashboards = (newDashboards) => {
    setStore(prev => ({ ...prev, dashboards: newDashboards }));
    if (user?.role === 'admin') saveConfigMerged(latest => ({ ...latest, dashboards: newDashboards }));
  };

  // ログイン・ログアウト
  const handleLogin = async (id, pass) => {
    const handleDevLogin = () => {
      const accounts = store.accounts || DEFAULT_ACCOUNTS;
      const currentRoles = store.roles || DEFAULT_ROLES;
      const account = accounts[id];
      if (!account) return false;

      const roleId = account.roleId || account.role || '';
      const role = currentRoles[roleId];
      const effectivePassword = account.password || (account.sfSync ? role?.password : '');
      if (!effectivePassword || effectivePassword !== pass || !roleId) return false;

      setUser({
        id,
        name: account.name,
        roleId,
        role: roleId,
        dashboardAccess: account.dashboardAccess || []
      });
      return true;
    };

    try {
      const response = await fetch('./login.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, password: pass })
      });
      let data;
      try {
        data = await response.json();
      } catch {
        return import.meta.env.DEV ? handleDevLogin() : false;
      }
      if (response.status === 401 || !response.ok) return false;
      if (!data?.user) return false;

      setUser({
        ...data.user,
        role: data.user.roleId  // 互換性のため（既存コードで user.role を参照している箇所用）
      });
      return true;
    } catch {
      return import.meta.env.DEV ? handleDevLogin() : false;
    }
  };

  const handleGuestLogin = async () => {
    try {
      const response = await fetch('./login.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'guest' })
      });
      if (!response.ok) return false;
      const data = await response.json();
      if (!data?.user || data.user.roleId !== 'guest') return false;
      setUser({ ...data.user, role: data.user.roleId, isGuest: true });
      return true;
    } catch {
      return false;
    }
  };

  const handleLogout = async () => {
    if (confirm('ログアウトしますか？')) {
      try {
        await fetch('./login.php', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'logout' })
        });
      } catch {
        // 通信に失敗してもクライアント側はログアウトする
      }
      setUser(null);
      analyticsStore.setSubTab('View');
      setSidebarOpen(false);
    }
  };

  const glassClass = theme === 'dark'
    ? "bg-slate-800/95 border border-white/10 shadow-xl"
    : "bg-white/95 border border-gray-200 shadow-lg";

  if (isConfigLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-500 ${theme === 'dark' ? 'bg-slate-900' : 'bg-gray-100'}`}>
        <div className={`flex flex-col items-center gap-4 p-8 rounded-2xl ${theme === 'dark' ? 'bg-slate-800/90 border border-white/10' : 'bg-white/90 border border-gray-200'} shadow-2xl`}>
          <div className="relative">
            <div className={`w-12 h-12 rounded-full border-4 border-t-transparent animate-spin ${theme === 'dark' ? 'border-indigo-500' : 'border-indigo-600'}`} />
          </div>
          <div className={`text-sm font-medium ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
            {globalLoadingMessage || '設定を読み込み中...'}
          </div>
          <div className={`w-48 h-1.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}>
            <div className={`h-full rounded-full animate-pulse ${theme === 'dark' ? 'bg-indigo-500' : 'bg-indigo-600'}`} style={{ width: '60%', animation: 'loading-bar 1.5s ease-in-out infinite' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <BackgroundBubbles theme={theme} />
        <LoginView onLogin={handleLogin} onGuestLogin={handleGuestLogin} glassClass={glassClass} appName={safeGlobalSettings.appName} logoLight={safeGlobalSettings.logoLight} logoDark={safeGlobalSettings.logoDark} theme={theme} toggleTheme={toggleTheme} />
      </>
    );
  }

  return (
    <div className={`min-h-screen font-sans selection:bg-indigo-500 selection:text-white pb-10 transition-colors duration-500 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
      <style>{`
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}; }
        ::-webkit-scrollbar-thumb { background: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'}; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}; }
      `}</style>
      <BackgroundBubbles theme={theme} />

      {sidebarOpen && <div className="fixed inset-0 bg-black/70 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* メインサイドバー */}
      <aside
        className={`fixed top-0 left-0 h-full ${glassClass} z-50 transition-all duration-300 flex flex-col overflow-hidden
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${sidebarCollapsed && !sidebarHovered ? 'md:w-16' : 'w-64'}
        `}
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
      >
        {/* 折りたたみ時（PC・アイコンのみ表示） - フェードアウト */}
        <div className={`hidden md:flex flex-col h-full absolute inset-0 transition-opacity duration-200
          ${sidebarCollapsed && !sidebarHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}>
          <div className="p-3 flex justify-center">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}>
              <Activity size={20} className={theme === 'dark' ? 'text-white' : 'text-gray-800'} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
            {APP_REGISTRY.filter(app => isBoardVisible(app.id)).map(app => {
              const isActive = activeApp === app.id;
              const IconComponent = app.icon;
              return (
                <button
                  key={app.id}
                  onClick={() => { setActiveApp(app.id); analyticsStore.setSubTab('View'); }}
                  className={`w-full flex items-center justify-center p-3 rounded-lg transition-all duration-200 ${isActive
                    ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700')
                    : (theme === 'dark' ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800')
                    }`}
                  title={getBoardDisplayName(app.id, safeGlobalSettings)}
                >
                  <IconComponent size={20} />
                </button>
              );
            })}
          </div>
          {/* 共通設定ボタン（折りたたみ時） */}
          {user.role === 'admin' && (
            <div className="p-2 border-t border-white/10">
              <button
                onClick={() => analyticsStore.setSubTab('GlobalSettings')}
                className={`w-full flex items-center justify-center p-3 rounded-lg transition-all ${analyticsStore.subTab === 'GlobalSettings' ? (theme === 'dark' ? 'bg-indigo-500/30 text-indigo-300' : 'bg-indigo-100 text-indigo-700') : (theme === 'dark' ? 'text-white/60 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100')}`}
                title="共通設定"
              >
                <ShieldCheck size={20} />
              </button>
            </div>
          )}
        </div>

        {/* 展開時の通常表示 - フェードイン */}
        <div className={`flex flex-col h-full min-w-[256px] transition-opacity duration-200 delay-75
          ${sidebarCollapsed && !sidebarHovered ? 'md:opacity-0 md:pointer-events-none' : 'md:opacity-100'}
        `}>
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {/* ロゴ画像またはアプリ名 */}
              {(theme === 'dark' ? safeGlobalSettings.logoDark || safeGlobalSettings.logoLight : safeGlobalSettings.logoLight) ? (
                <img
                  src={theme === 'dark' ? (safeGlobalSettings.logoDark || safeGlobalSettings.logoLight) : safeGlobalSettings.logoLight}
                  alt={safeGlobalSettings.appName}
                  className="h-[60px] max-w-[180px] object-contain"
                />
              ) : (
                <h1 className={`text-xl font-bold tracking-tight truncate ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                  {safeGlobalSettings.appName || 'CallData Analysis'}
                </h1>
              )}
            </div>
            <button onClick={() => setSidebarOpen(false)} className={`md:hidden flex-shrink-0 ${theme === 'dark' ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}><X size={24} /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6">
            {/* アプリ一覧 */}
            <div>
              <div className={`text-xs font-bold uppercase tracking-wider mb-2 px-2 ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>ボード</div>
              <div className="space-y-1">
                {APP_REGISTRY.filter(app => isBoardVisible(app.id)).map(app => {
                  const isActive = activeApp === app.id;
                  const isDisabled = !app.enabled;
                  const IconComponent = app.icon;
                  return (
                    <button
                      key={app.id}
                      onClick={() => { setActiveApp(app.id); analyticsStore.setSubTab('View'); setSidebarOpen(false); }}
                      className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm border whitespace-nowrap overflow-hidden ${isActive
                        ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-indigo-100 text-indigo-700 border-indigo-300')
                        : (theme === 'dark' ? 'text-white/60 hover:bg-white/10 hover:text-white border-transparent' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800 border-transparent')
                        }`}
                    >
                      <IconComponent size={16} className={isDisabled ? 'opacity-40' : ''} />
                      <span className="truncate text-left flex-1">{getBoardDisplayName(app.id, safeGlobalSettings)}</span>
                      {isDisabled && <span className={`text-[10px] ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>開発中</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ダッシュボード一覧（モバイル時のみ表示 - PC時はサブサイドバーに表示） */}
            {activeApp === 'analytics' && (isAdmin || hasPermission('analytics.view')) && (
              <div className="md:hidden">
                <div className={`flex items-center gap-2 mb-2 px-2`}>
                  <LayoutDashboard size={14} className={theme === 'dark' ? 'text-indigo-400' : 'text-indigo-500'} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-indigo-400/80' : 'text-indigo-600'}`}>ボードビュー一覧</span>
                </div>
                <div className="space-y-1">
                  {analyticsStore.getVisibleDashboards(user, store.roles || DEFAULT_ROLES).map(dashboard => {
                    const isActive = store.activeId === dashboard.id;
                    const isDragging = analyticsStore.draggedDashboardId === dashboard.id;
                    const isDragOver = analyticsStore.dragOverDashboardId === dashboard.id;
                    return (
                      <div
                        key={dashboard.id}
                        className={`flex items-center group relative ${isDragging ? 'opacity-50' : ''} ${isDragOver ? (theme === 'dark' ? 'border-t-2 border-indigo-400' : 'border-t-2 border-indigo-500') : ''}`}
                        draggable={user.role === 'admin'}
                        onDragStart={(e) => analyticsStore.handleDashboardDragStart(e, dashboard.id)}
                        onDragOver={(e) => analyticsStore.handleDashboardDragOver(e, dashboard.id)}
                        onDragEnd={analyticsStore.handleDashboardDragEnd}
                      >
                        {user.role === 'admin' && (
                          <div className={`cursor-grab active:cursor-grabbing px-1 ${theme === 'dark' ? 'text-white/30 hover:text-white/60' : 'text-gray-400 hover:text-gray-600'}`}>
                            <GripVertical size={14} />
                          </div>
                        )}
                        <button onClick={() => { analyticsStore.switchDashboard(dashboard.id); setSidebarOpen(false); }} className={`flex-1 flex items-center space-x-3 px-3 py-3 rounded-lg transition-all duration-200 text-sm border whitespace-nowrap overflow-hidden min-h-[44px] ${isActive ? (theme === 'dark' ? 'bg-white/20 text-white shadow-lg border-white/10' : 'bg-indigo-100 text-indigo-800 shadow-lg border-indigo-200') : (theme === 'dark' ? 'text-white/60 hover:bg-white/10 hover:text-white border-transparent' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800 border-transparent')}`}>
                          <LayoutDashboard size={16} /><span className="truncate text-left flex-1">{dashboard.name}</span>
                          {isActive && <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${theme === 'dark' ? 'bg-indigo-400' : 'bg-indigo-500'}`} />}
                        </button>
                        {(isAdmin || hasPermission('analytics.dashboard.create') || hasPermission('analytics.dashboard.delete')) && (
                          <div className="absolute right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {(isAdmin || hasPermission('analytics.dashboard.create')) && <button onClick={(e) => analyticsStore.duplicateDashboard(dashboard.id, e)} className={`p-2 hover:text-blue-400 rounded ${theme === 'dark' ? 'text-white/30 bg-slate-800' : 'text-gray-400 bg-gray-200'}`} title="複製"><Copy size={14} /></button>}
                            {Object.keys(store.dashboards).length > 1 && (isAdmin || hasPermission('analytics.dashboard.delete')) && <button onClick={(e) => analyticsStore.deleteDashboard(dashboard.id, e)} className={`p-2 hover:text-rose-400 rounded ${theme === 'dark' ? 'text-white/30 bg-slate-800' : 'text-gray-400 bg-gray-200'}`} title="削除"><Trash2 size={14} /></button>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {activeApp === 'analytics' && (isAdmin || hasPermission('analytics.dashboard.create')) && <button onClick={analyticsStore.createDashboard} className={`md:hidden w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl border text-sm transition-all min-h-[44px] ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 border-white/5 hover:border-white/20 text-white/80 hover:text-white' : 'bg-gray-100 hover:bg-gray-200 border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-800'}`}><Plus size={16} /><span>新規作成</span></button>}
            {activeApp === 'analytics' && store.activeId && (
              <div className={`md:hidden pt-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                <div className={`flex items-center gap-2 mb-2 px-2`}>
                  <Activity size={14} className={theme === 'dark' ? 'text-indigo-400' : 'text-indigo-500'} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-indigo-400/80' : 'text-indigo-600'}`}>現在のビュー</span>
                </div>
                <div className="space-y-1">
                  <button onClick={() => { analyticsStore.handleTabChange('View'); setSidebarOpen(false); }} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg transition-all duration-200 text-sm border min-h-[44px] ${analyticsStore.subTab === 'View' ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-indigo-100 text-indigo-700 border-indigo-300') : (theme === 'dark' ? 'text-white/60 hover:bg-white/10 hover:text-white border-transparent' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800 border-transparent')}`}>
                    <Activity size={16} /><span>アナリティクス</span>
                  </button>
                  {(isAdmin || hasPermission('analytics.settings')) && (
                    <button onClick={() => { analyticsStore.handleTabChange('Settings'); setSidebarOpen(false); }} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg transition-all duration-200 text-sm border min-h-[44px] ${analyticsStore.subTab === 'Settings' ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-indigo-100 text-indigo-700 border-indigo-300') : (theme === 'dark' ? 'text-white/60 hover:bg-white/10 hover:text-white border-transparent' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800 border-transparent')}`}>
                      <Settings size={16} /><span>設定 & データ</span>
                    </button>
                  )}
                  {(isAdmin || hasPermission('analytics.salesforce')) && (
                    <button onClick={() => { analyticsStore.handleTabChange('SalesforceSync'); setSidebarOpen(false); }} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg transition-all duration-200 text-sm border min-h-[44px] ${analyticsStore.subTab === 'SalesforceSync' ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-indigo-100 text-indigo-700 border-indigo-300') : (theme === 'dark' ? 'text-white/60 hover:bg-white/10 hover:text-white border-transparent' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800 border-transparent')}`}>
                      <Cloud size={16} /><span>SF連携</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className={`p-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
            {user.role === 'admin' && (
              <button
                onClick={() => {
                  analyticsStore.setSubTab('GlobalSettings');
                  setSalesHubView(null);
                }}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg mb-2 transition-all duration-300 whitespace-nowrap overflow-hidden ${analyticsStore.subTab === 'GlobalSettings' ? (theme === 'dark' ? 'bg-indigo-500/30 text-indigo-300' : 'bg-indigo-100 text-indigo-700') : (theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white/80' : 'bg-gray-100 hover:bg-gray-200 text-gray-600')}`}
              >
                <ShieldCheck size={16} /><span className="text-sm">共通設定</span>
              </button>
            )}
            <button
              onClick={toggleTheme}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg mb-2 transition-all duration-300 whitespace-nowrap overflow-hidden ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-yellow-300' : 'bg-gray-100 hover:bg-gray-200 text-indigo-600'}`}
              title={theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              <span className="text-sm">{theme === 'dark' ? 'ライトモード' : 'ダークモード'}</span>
            </button>
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-sm transition-colors whitespace-nowrap overflow-hidden"><LogOut size={16} /> ログアウト</button>
          </div>
        </div>{/* 展開時の通常表示の閉じタグ */}
      </aside>

      {/* サブサイドバー（コールデータボード選択時のボードビュー一覧） */}
      {activeApp === 'analytics' && analyticsStore.subTab !== 'GlobalSettings' && (isAdmin || hasPermission('analytics.view')) && (() => {
        const subExpanded = subSidebarExpanded || !sidebarCollapsed;
        return (
        <aside
          className={`hidden md:flex fixed top-0 h-full ${subExpanded ? 'w-48' : 'w-12'} ${glassClass} z-40 transition-all duration-300 flex-col overflow-hidden
            ${sidebarCollapsed && !sidebarHovered ? 'left-16' : 'left-64'}
          `}
        >
          {/* 折りたたみ表示（アイコンのみ） */}
          <div className={`flex flex-col h-full absolute inset-0 transition-opacity duration-200 ${!subExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {/* 展開トグルボタン（上部） */}
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
              {analyticsStore.getVisibleDashboards(user, store.roles || DEFAULT_ROLES).map(dashboard => {
                const isActive = store.activeId === dashboard.id;
                return (
                  <button
                    key={dashboard.id}
                    onClick={() => analyticsStore.switchDashboard(dashboard.id)}
                    className={`w-full flex items-center justify-center p-2 rounded-lg transition-all ${isActive
                      ? (theme === 'dark' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800')
                      : (theme === 'dark' ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800')
                      }`}
                    title={dashboard.name}
                  >
                    <LayoutDashboard size={14} />
                  </button>
                );
              })}
              {(isAdmin || hasPermission('analytics.dashboard.create')) && (
                <button onClick={analyticsStore.createDashboard} className={`w-full flex items-center justify-center p-2 rounded-lg border transition-all ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white' : 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-600'}`} title="新規作成">
                  <Plus size={14} />
                </button>
              )}
              {store.activeId && (
                <>
                  <div className={`mx-1 my-2 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`} />
                  <button onClick={() => analyticsStore.handleTabChange('View')} className={`w-full flex items-center justify-center p-2 rounded-lg transition-all ${analyticsStore.subTab === 'View' ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700') : (theme === 'dark' ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800')}`} title="アナリティクス">
                    <Activity size={14} />
                  </button>
                  {(isAdmin || hasPermission('analytics.settings')) && (
                    <button onClick={() => analyticsStore.handleTabChange('Settings')} className={`w-full flex items-center justify-center p-2 rounded-lg transition-all ${analyticsStore.subTab === 'Settings' ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700') : (theme === 'dark' ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800')}`} title="設定 & データ">
                      <Settings size={14} />
                    </button>
                  )}
                  {(isAdmin || hasPermission('analytics.salesforce')) && (
                    <button onClick={() => analyticsStore.handleTabChange('SalesforceSync')} className={`w-full flex items-center justify-center p-2 rounded-lg transition-all ${analyticsStore.subTab === 'SalesforceSync' ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700') : (theme === 'dark' ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800')}`} title="SF連携">
                      <Cloud size={14} />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 展開表示（テキスト付き） */}
          <div className={`flex flex-col h-full min-w-[192px] transition-opacity duration-200 delay-75 ${subExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {/* 折りたたみトグルボタン（上部・メインサイドバー折りたたみ時のみ） */}
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
                  {analyticsStore.getVisibleDashboards(user, store.roles || DEFAULT_ROLES).map(dashboard => {
                    const isActive = store.activeId === dashboard.id;
                    const isDragging = analyticsStore.draggedDashboardId === dashboard.id;
                    const isDragOver = analyticsStore.dragOverDashboardId === dashboard.id;
                    return (
                      <div
                        key={dashboard.id}
                        className={`flex items-center group relative ${isDragging ? 'opacity-50' : ''} ${isDragOver ? (theme === 'dark' ? 'border-t-2 border-indigo-400' : 'border-t-2 border-indigo-500') : ''}`}
                        draggable={user.role === 'admin'}
                        onDragStart={(e) => analyticsStore.handleDashboardDragStart(e, dashboard.id)}
                        onDragOver={(e) => analyticsStore.handleDashboardDragOver(e, dashboard.id)}
                        onDragEnd={analyticsStore.handleDashboardDragEnd}
                      >
                        {user.role === 'admin' && (
                          <div className={`cursor-grab active:cursor-grabbing px-0.5 ${theme === 'dark' ? 'text-white/30 hover:text-white/60' : 'text-gray-400 hover:text-gray-600'}`}>
                            <GripVertical size={12} />
                          </div>
                        )}
                        <button
                          onClick={() => analyticsStore.switchDashboard(dashboard.id)}
                          className={`flex-1 flex items-center gap-2 px-2 py-2 rounded-lg transition-all text-xs ${isActive
                            ? (theme === 'dark' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800')
                            : (theme === 'dark' ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800')
                            }`}
                        >
                          <LayoutDashboard size={14} />
                          <span className="truncate flex-1 text-left">{dashboard.name}</span>
                        </button>
                        {(isAdmin || hasPermission('analytics.dashboard.create') || hasPermission('analytics.dashboard.delete')) && (
                          <div className="absolute right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {(isAdmin || hasPermission('analytics.dashboard.create')) && (
                              <button onClick={(e) => analyticsStore.duplicateDashboard(dashboard.id, e)} className={`p-1 hover:text-blue-400 rounded ${theme === 'dark' ? 'text-white/30 bg-slate-800' : 'text-gray-400 bg-gray-200'}`} title="複製">
                                <Copy size={10} />
                              </button>
                            )}
                            {Object.keys(store.dashboards).length > 1 && (isAdmin || hasPermission('analytics.dashboard.delete')) && (
                              <button onClick={(e) => analyticsStore.deleteDashboard(dashboard.id, e)} className={`p-1 hover:text-rose-400 rounded ${theme === 'dark' ? 'text-white/30 bg-slate-800' : 'text-gray-400 bg-gray-200'}`} title="削除">
                                <Trash2 size={10} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {(isAdmin || hasPermission('analytics.dashboard.create')) && (
                  <button
                    onClick={analyticsStore.createDashboard}
                    className={`w-full flex items-center justify-center gap-1 px-3 py-2 mt-2 rounded-lg border text-xs transition-all ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white' : 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-600'}`}
                  >
                    <Plus size={14} />
                    <span>新規作成</span>
                  </button>
                )}
              </div>
              {store.activeId && (
                <div className={`pt-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                  <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>表示</div>
                  <div className="space-y-1">
                    <button onClick={() => analyticsStore.handleTabChange('View')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-xs ${analyticsStore.subTab === 'View' ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700') : (theme === 'dark' ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800')}`}>
                      <Activity size={14} /><span>アナリティクス</span>
                    </button>
                    {(isAdmin || hasPermission('analytics.settings')) && (
                      <button onClick={() => analyticsStore.handleTabChange('Settings')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-xs ${analyticsStore.subTab === 'Settings' ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700') : (theme === 'dark' ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800')}`}>
                        <Settings size={14} /><span>設定 & データ</span>
                      </button>
                    )}
                    {(isAdmin || hasPermission('analytics.salesforce')) && (
                      <button onClick={() => analyticsStore.handleTabChange('SalesforceSync')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-xs ${analyticsStore.subTab === 'SalesforceSync' ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700') : (theme === 'dark' ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800')}`}>
                        <Cloud size={14} /><span>SF連携</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
        );
      })()}

      {/* SalesHub サブサイドバー */}
      {activeApp === 'sales-hub' && analyticsStore.subTab !== 'GlobalSettings' && (
        <aside
          className={`hidden md:flex fixed top-0 h-full w-48 ${glassClass} z-40 transition-all duration-300 flex-col
            ${sidebarCollapsed && !sidebarHovered ? 'left-16' : 'left-64'}
          `}
        >
          <div className="flex-1 overflow-y-auto py-4 space-y-1">

            {/* ── 前確セクション ── */}
            {(isAdmin || hasPermission('sales-hub.view')) && (
              <>
                <div className={`px-4 pb-1 text-[10px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>前確</div>
                <SalesHubNavItem label="前確リスト" Icon={PhoneCall}
                  active={salesHubView === 'preconfirm'} theme={theme} onClick={() => setSalesHubView('preconfirm')} />
                <SalesHubNavItem label="前確カレンダー" Icon={CalendarDays}
                  active={salesHubView === 'calendar'} theme={theme} onClick={() => setSalesHubView('calendar')} />
              </>
            )}

            {/* ── 罫線 ── */}
            {(isAdmin || hasPermission('sales-hub.meetings')) && (
              <div className={`mx-4 my-2 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`} />
            )}

            {/* ── 商談セクション ── */}
            {(isAdmin || hasPermission('sales-hub.meetings')) && (
              <>
                <div className={`px-4 pb-1 text-[10px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>商談</div>
                <SalesHubNavItem label="商談スケジュール" Icon={User}
                  active={salesHubView === 'dashboard'} theme={theme} onClick={() => setSalesHubView('dashboard')} />
                <SalesHubNavItem label="商談調整" Icon={Briefcase}
                  active={salesHubView === 'deals'} theme={theme} onClick={() => setSalesHubView('deals')} />
                <SalesHubNavItem label="商談検索" Icon={List}
                  active={salesHubView === 'table'} theme={theme} onClick={() => setSalesHubView('table')} />
                {(isAdmin || hasPermission('sales-hub.doyou_request')) && (
                  <SalesHubNavItem label="Do you?制作依頼" Icon={FileEdit}
                    active={salesHubView === 'doyou_request'} theme={theme} onClick={() => setSalesHubView('doyou_request')} />
                )}
                <SalesHubNavItem label="休み登録" Icon={CalendarX2}
                  active={salesHubView === 'absences'} theme={theme} onClick={() => setSalesHubView('absences')} />
                <SalesHubNavItem label="スタッフ登録" Icon={UserPlus}
                  active={salesHubView === 'staff'} theme={theme} onClick={() => setSalesHubView('staff')} />
              </>
            )}

            {/* ── 罫線（BY 業務セクション前: BY系権限あり かつ meetings なし のとき） ── */}
            {(isAdmin || hasPermission('sales-hub.chatboost_request') || hasPermission('sales-hub.neoglyph_request') || hasPermission('sales-hub.bank_form_request')) && !(isAdmin || hasPermission('sales-hub.meetings')) && (
              <div className={`mx-4 my-2 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`} />
            )}

            {/* ── BY 業務セクション ── */}
            {(isAdmin || hasPermission('sales-hub.chatboost_request') || hasPermission('sales-hub.neoglyph_request') || hasPermission('sales-hub.bank_form_request')) && (
              <>
                <div className={`px-4 pb-1 text-[10px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>BY 業務</div>
                {(isAdmin || hasPermission('sales-hub.chatboost_request')) && (
                  <SalesHubNavItem label="チャットブースト 取次ID" Icon={MessageSquarePlus}
                    active={salesHubView === 'chatboost_request'} theme={theme} onClick={() => setSalesHubView('chatboost_request')} />
                )}
                {(isAdmin || hasPermission('sales-hub.neoglyph_request')) && (
                  <SalesHubNavItem label="ネオグリフ 取次ID" Icon={Stethoscope}
                    active={salesHubView === 'neoglyph_request'} theme={theme} onClick={() => setSalesHubView('neoglyph_request')} />
                )}
                {(isAdmin || hasPermission('sales-hub.bank_form_request')) && (
                  <SalesHubNavItem label="口座登録用紙" Icon={FileText}
                    active={salesHubView === 'bank_form_request'} theme={theme} onClick={() => setSalesHubView('bank_form_request')} />
                )}
              </>
            )}

            {/* ── 罫線 ── */}
            {(isAdmin || hasPermission('sales-hub.archive')) && (
              <div className={`mx-4 my-2 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`} />
            )}

            {/* ── アーカイブセクション ── */}
            {(isAdmin || hasPermission('sales-hub.archive') || hasPermission('sales-hub.training_archive')) && (
              <>
                <div className={`px-4 pb-1 text-[10px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>アーカイブ</div>
                {(isAdmin || hasPermission('sales-hub.archive')) && (
                  <SalesHubNavItem label="録画検索" Icon={Archive}
                    active={salesHubView === 'archive'} theme={theme} onClick={() => setSalesHubView('archive')} />
                )}
                {(isAdmin || hasPermission('sales-hub.training_archive')) && (
                  <SalesHubNavItem label="研修動画" Icon={BookOpen}
                    active={salesHubView === 'training_archive'} theme={theme} onClick={() => setSalesHubView('training_archive')} />
                )}
              </>
            )}

            {/* ── 罫線 ── */}
            {(isAdmin || hasPermission('sales-hub.settings')) && (
              <div className={`mx-4 my-2 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`} />
            )}

            {/* ── 管理セクション ── */}
            {(isAdmin || hasPermission('sales-hub.settings')) && (
              <>
                <div className={`px-4 pb-1 text-[10px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>管理</div>
                <SalesHubNavItem label="システム設定" Icon={Cog}
                  active={salesHubView === 'settings'} theme={theme} onClick={() => setSalesHubView('settings')} />
              </>
            )}

          </div>
        </aside>
      )}

      {/* モバイル用固定ヘッダー（全アプリ共通） */}
      <header className={`md:hidden fixed top-0 left-0 right-0 h-14 z-30 flex items-center px-4 backdrop-blur-md border-b
        ${theme === 'dark' ? 'bg-slate-900/90 border-white/10' : 'bg-white/90 border-gray-200'}
      `}>
        <button
          onClick={() => setSidebarOpen(true)}
          className={`p-2 rounded-lg ${theme === 'dark' ? 'text-white/70 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          <Menu size={24} />
        </button>
        <span className={`ml-3 font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
          {getBoardDisplayName(activeApp, safeGlobalSettings)}
        </span>
      </header>

      <main className={`transition-all duration-300 pt-14 md:pt-0
        ${activeApp === 'sales-hub' && analyticsStore.subTab !== 'GlobalSettings' ? 'h-screen overflow-hidden' : 'min-h-screen'}
        ${activeApp === 'analytics' && analyticsStore.subTab !== 'GlobalSettings' && (isAdmin || hasPermission('analytics.view'))
          ? (sidebarCollapsed && !sidebarHovered
            ? (subSidebarExpanded ? 'md:ml-[256px]' : 'md:ml-28')
            : 'md:ml-[304px]')
          : activeApp === 'performance-board' && (isAdmin || hasPermission('performance-board.view'))
            ? (sidebarCollapsed && !sidebarHovered
              ? (subSidebarExpanded ? 'md:ml-[256px]' : 'md:ml-28')
              : 'md:ml-[304px]')
            : activeApp === 'sales-hub'
              ? (sidebarCollapsed && !sidebarHovered ? 'md:ml-64' : 'md:ml-[304px]')
              : 'md:ml-64'
        }
      `}>
        {/* 共通設定は完全に独立（ヘッダーなし） */}
        {analyticsStore.subTab === 'GlobalSettings' && user.role === 'admin' ? (
          <div className="px-6 pt-6 max-w-full mx-auto pb-10">
            <Suspense fallback={<div className={`flex items-center justify-center h-64 ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>共通設定を読み込み中...</div>}>
              <GlobalSettingsView
                glassClass={glassClass}
                theme={theme}
                globalSettings={safeGlobalSettings}
                updateGlobalSettings={updateGlobalSettings}
                accounts={store.accounts || DEFAULT_ACCOUNTS}
                updateAccounts={updateAccounts}
                roles={store.roles || DEFAULT_ROLES}
                updateRoles={updateRoles}
                allDashboards={store.dashboards}
                updateDashboards={updateDashboards}
              />
            </Suspense>
          </div>
        ) : activeApp === 'home' ? (
          // ホームページ
          <Suspense fallback={<div className={`flex items-center justify-center h-64 ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>読み込み中...</div>}>
            <HomeApp
              theme={theme}
              user={user}
            />
          </Suspense>
        ) : (
          <>
            {/* ダッシュボードアプリ以外ではヘッダーを非表示（閲覧権限がない場合も非表示） */}
            {activeApp === 'analytics' && (isAdmin || hasPermission('analytics.view')) && (
              <header className={`px-3 sm:px-6 py-2 bg-transparent border-b flex justify-between items-center mb-6 w-full ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                  {/* デスクトップ: 編集可能なダッシュボード名 */}
                  <div className="hidden md:flex flex-1 min-w-0">
                    {user.role === 'admin' ? (
                      <input type="text" value={safeConfig.name} onChange={(e) => analyticsStore.updateConfig('name', e.target.value)} className={`bg-transparent text-lg sm:text-xl font-bold outline-none focus:border-b px-1 min-w-0 flex-1 truncate ${theme === 'dark' ? 'text-white focus:border-white/50' : 'text-gray-800 focus:border-gray-400'}`} />
                    ) : (
                      <h2 className={`text-lg sm:text-xl font-bold px-1 truncate ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{safeConfig.name}</h2>
                    )}
                  </div>
                  {/* モバイル: ダッシュボード名タップでドロップダウン切替 */}
                  <div className="md:hidden flex-1 min-w-0">
                    <button
                      onClick={() => setMobileDashSwitcherOpen(prev => !prev)}
                      className={`flex items-center gap-1.5 max-w-full py-1 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                    >
                      <span className={`text-lg font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                        {safeConfig.name}
                      </span>
                      <ChevronDown size={16} className={`shrink-0 transition-transform ${mobileDashSwitcherOpen ? 'rotate-180' : ''} ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                  <div className="hidden md:flex flex-col items-end mr-2">
                    <span className={`text-[10px] uppercase tracking-wider flex items-center gap-1 ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>
                      {isAdmin ? <ShieldCheck size={10} className="text-emerald-500" /> : <Eye size={10} className="text-blue-500" />}
                      {user.roleId || user.role}
                    </span>
                    <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{user.name}</span>
                  </div>
                </div>
              </header>
            )}
            {/* モバイル用ボードビュードロップダウン（headerの外に配置してclipping回避） */}
            {mobileDashSwitcherOpen && activeApp === 'analytics' && (
              <>
                <div className="md:hidden fixed inset-0 z-[60]" onClick={() => setMobileDashSwitcherOpen(false)} />
                <div className={`md:hidden fixed left-3 right-3 z-[61] rounded-xl border shadow-xl max-h-[60vh] overflow-y-auto
                  ${theme === 'dark' ? 'bg-slate-800 border-white/10' : 'bg-white border-gray-200'}`}
                  style={{ top: '100px' }}
                >
                  <div className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>ボードビュー</div>
                  {analyticsStore.getVisibleDashboards(user, store.roles || DEFAULT_ROLES).map(dashboard => {
                    const isActive = store.activeId === dashboard.id;
                    return (
                      <button
                        key={dashboard.id}
                        onClick={() => { analyticsStore.switchDashboard(dashboard.id); setMobileDashSwitcherOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-3 text-sm transition-colors ${isActive
                          ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-50 text-indigo-700')
                          : (theme === 'dark' ? 'text-white/70 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-50')
                        }`}
                      >
                        <LayoutDashboard size={16} className="shrink-0" />
                        <span className="truncate">{dashboard.name}</span>
                        {isActive && <div className={`ml-auto w-1.5 h-1.5 rounded-full shrink-0 ${theme === 'dark' ? 'bg-indigo-400' : 'bg-indigo-500'}`} />}
                      </button>
                    );
                  })}
                  {(isAdmin || hasPermission('analytics.dashboard.create')) && (
                    <button
                      onClick={() => { analyticsStore.createDashboard(); setMobileDashSwitcherOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-3 text-sm border-t transition-colors ${theme === 'dark' ? 'border-white/10 text-white/50 hover:bg-white/10' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}
                    >
                      <Plus size={16} className="shrink-0" />
                      <span>新規作成</span>
                    </button>
                  )}
                  <div className={`border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-100'}`}>
                    <div className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>表示</div>
                    <button onClick={() => { analyticsStore.handleTabChange('View'); setMobileDashSwitcherOpen(false); }} className={`w-full flex items-center gap-2.5 px-3 py-3 text-sm transition-colors ${analyticsStore.subTab === 'View' ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-50 text-indigo-700') : (theme === 'dark' ? 'text-white/70 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-50')}`}>
                      <Activity size={16} className="shrink-0" /><span>アナリティクス</span>
                    </button>
                    {(isAdmin || hasPermission('analytics.settings')) && (
                      <button onClick={() => { analyticsStore.handleTabChange('Settings'); setMobileDashSwitcherOpen(false); }} className={`w-full flex items-center gap-2.5 px-3 py-3 text-sm transition-colors ${analyticsStore.subTab === 'Settings' ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-50 text-indigo-700') : (theme === 'dark' ? 'text-white/70 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-50')}`}>
                        <Settings size={16} className="shrink-0" /><span>設定 & データ</span>
                      </button>
                    )}
                    {(isAdmin || hasPermission('analytics.salesforce')) && (
                      <button onClick={() => { analyticsStore.handleTabChange('SalesforceSync'); setMobileDashSwitcherOpen(false); }} className={`w-full flex items-center gap-2.5 px-3 py-3 text-sm transition-colors ${analyticsStore.subTab === 'SalesforceSync' ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-50 text-indigo-700') : (theme === 'dark' ? 'text-white/70 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-50')}`}>
                        <Cloud size={16} className="shrink-0" /><span>SF連携</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="max-w-full mx-auto pb-10 px-6">
              {/* アプリコンテンツエリア */}


              {/* Performance-Board Keep-Alive: 一度表示後はマウント維持 */}
              {pbRendered && (
                <div style={{ display: activeApp === 'performance-board' ? undefined : 'none' }}>
                  <Suspense fallback={<div className={`flex items-center justify-center h-64 ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>読み込み中...</div>}>
                    <PerformanceBoardApp
                      theme={theme}
                      user={user}
                      roles={store.roles || DEFAULT_ROLES}
                      glassClass={glassClass}
                      sidebarCollapsed={sidebarCollapsed}
                      sidebarHovered={sidebarHovered}
                      subSidebarExpanded={subSidebarExpanded}
                      setSubSidebarExpanded={setSubSidebarExpanded}
                    />
                  </Suspense>
                </div>
              )}

              {/* 実績ボード以外は未実装。権限が無い場合はメッセージを表示 */}
              {activeApp === 'performance-board' ? null : (
                // 表示可能なボードがない場合（analyticsはKeep-Aliveで別途表示）
                <div className={`flex flex-col items-center justify-center h-[60vh] ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
                  <div className={`p-8 rounded-2xl ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                    <div className="text-center">
                      <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}>
                        <Eye size={32} className={theme === 'dark' ? 'text-white/40' : 'text-gray-400'} />
                      </div>
                      <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
                        表示できるページがありません
                      </h3>
                      <p className={`text-sm ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
                        管理者にお問い合わせください
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* グローバルローディングオーバーレイ（全ての読み込み時・計算時・更新時に表示） */}
        {(analyticsStore.isViewTransitioning || isFilterApplying || isLoading || isCalculating || analyticsStore.isBackgroundRefreshing || globalLoadingMessage) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className={`absolute inset-0 ${theme === 'dark' ? 'bg-slate-900/90' : 'bg-white/90'}`} />
            <div className={`relative flex flex-col items-center gap-4 p-8 rounded-2xl ${theme === 'dark' ? 'bg-slate-800/90 border border-white/10' : 'bg-white/90 border border-gray-200'} shadow-2xl min-w-[280px]`}>
              <div className="relative">
                <div className={`w-12 h-12 rounded-full border-4 border-t-transparent animate-spin ${theme === 'dark' ? 'border-indigo-500' : 'border-indigo-600'}`} />
              </div>
              <div className={`text-sm font-medium text-center ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
                {globalLoadingMessage || (isCalculating ? `計算処理中... ${calcProgress}%` : isFilterApplying ? 'フィルター適用中...' : analyticsStore.isBackgroundRefreshing ? '更新中...' : isLoading ? 'データ読み込み中...' : '読み込み中...')}
              </div>
              {/* 進捗バー */}
              {isCalculating ? (
                <div className="w-full">
                  <div className={`w-full h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}>
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${theme === 'dark' ? 'bg-indigo-500' : 'bg-indigo-600'}`}
                      style={{ width: `${calcProgress}%` }}
                    />
                  </div>
                  <div className={`text-xs mt-2 text-center ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
                    {analyticsStore.rawData.length.toLocaleString()}行を処理中
                  </div>
                </div>
              ) : analyticsStore.loadingProgress.total > 0 ? (
                <div className="w-full">
                  <div className={`w-full h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}>
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${theme === 'dark' ? 'bg-indigo-500' : 'bg-indigo-600'}`}
                      style={{ width: `${Math.round((analyticsStore.loadingProgress.current / analyticsStore.loadingProgress.total) * 100)}%` }}
                    />
                  </div>
                  {analyticsStore.loadingProgress.currentSource && (
                    <div className={`text-xs mt-2 text-center truncate ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
                      {analyticsStore.loadingProgress.currentSource}
                    </div>
                  )}
                </div>
              ) : (
                <div className={`w-48 h-1.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}>
                  <div className={`h-full rounded-full ${theme === 'dark' ? 'bg-indigo-500' : 'bg-indigo-600'}`} style={{ width: '60%', animation: 'loading-bar 1.5s ease-in-out infinite' }} />
                </div>
              )}
              {/* 中断ボタン（データ取得中・計算中・更新中に表示） */}
              {(isLoading || isCalculating || analyticsStore.isBackgroundRefreshing) && (
                <button
                  onClick={() => {
                    analyticsStore.handleAbortFetch();
                    cancelCalculation();
                  }}
                  className={`mt-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${theme === 'dark'
                    ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30'
                    : 'bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-300'
                    }`}
                >
                  <StopCircle size={14} />
                  中断
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
