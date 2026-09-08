// src/apps/performance-board/hooks/useAnalyticsStore.js
// Analytics専用のState管理・データ取得を統合するフック（オーケストレーター）

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { reshapeWideToLong } from '../utils/reshapeUtils';
import { buildSoqlDateFilterClause } from '../utils/dateFilters';
// サブモジュール
import { useConfigUpdates } from './useConfigUpdates';
import { useDashboardCRUD } from './useDashboardCRUD';
import { useColumnReconcile } from './useColumnReconcile';
import { useCacheManager } from './useCacheManager';
import { combineSourceDataInWorker } from '../utils/combineSourceDataWorker';

/**
 * Analytics専用のState管理フック
 * @param {object} params
 * @param {object} params.store - グローバルstore
 * @param {function} params.setStore - store更新関数
 * @param {object} params.user - ログインユーザー
 * @param {object} params.safeConfig - 現在のダッシュボード設定（App.jsxで計算）
 * @param {function} params.setIsLoading - ローディング状態設定
 * @param {function} params.setGlobalLoadingMessage - ローディングメッセージ設定
 * @param {object} params.activeFilters - アクティブフィルター
 * @param {function} params.setActiveFilters - フィルター更新関数
 * @param {object} params.filterStorage - useFilterStorageの戻り値
 */
export const useAnalyticsStore = ({
  store,
  setStore,
  user,
  safeConfig,
  setIsLoading,
  setGlobalLoadingMessage,
  activeFilters,
  setActiveFilters,
  filterStorage,
}) => {
  // === Analytics専用State ===
  const [rawData, setRawData] = useState([]);
  const [sourceCache, setSourceCache] = useState({});
  const [dashboardDataCache, setDashboardDataCache] = useState({});
  const [sourceCacheByDashboard, setSourceCacheByDashboard] = useState({});
  const [calculatedDataCache, setCalculatedDataCache] = useState({});

  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  // ボード別の接続状態・最終更新・サーバーキャッシュメタ（ボード切替時の混線防止）
  const [isConnectedByDashboard, setIsConnectedByDashboard] = useState({});
  const [lastUpdatedByDashboard, setLastUpdatedByDashboard] = useState({});
  const [serverCacheInfoByDashboard, setServerCacheInfoByDashboard] = useState({});

  const [subTab, setSubTab] = useState('View');
  const [error, setError] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0, currentSource: '' });
  const [combineMetrics, setCombineMetrics] = useState(null);

  // 現在アクティブなボードの導出値
  const activeBoardId = store?.activeId;
  const isConnected = activeBoardId ? !!isConnectedByDashboard[activeBoardId] : false;
  const lastUpdated = activeBoardId ? (lastUpdatedByDashboard[activeBoardId] || null) : null;
  // オブジェクトは参照安定性のため useMemo で囲む（不要な再レンダー防止）
  const serverCacheInfo = useMemo(
    () => (activeBoardId && serverCacheInfoByDashboard[activeBoardId]) || {},
    [activeBoardId, serverCacheInfoByDashboard]
  );

  // 旧API互換: 現在ボードの値のみを更新するセッター（サブフック経由で呼ばれる）
  const setIsConnected = useCallback((value) => {
    if (!activeBoardId) return;
    setIsConnectedByDashboard(prev => ({ ...prev, [activeBoardId]: !!value }));
  }, [activeBoardId]);

  // Refs
  const abortControllerRef = useRef(null);
  const fetchGenerationRef = useRef(0);
  const isInitialMount = useRef(true);
  const forceFullRefreshSourceRef = useRef(null);

  const invalidateFetch = useCallback(() => {
    fetchGenerationRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsFetching(false);
    setIsBackgroundRefreshing(false);
    setLoadingProgress({ current: 0, total: 0, currentSource: '' });
  }, []);

  useEffect(() => () => invalidateFetch(), [invalidateFetch]);

  // 画面遷移中フラグ
  const [isViewTransitioning, setIsViewTransitioning] = useState(false);

  // フェッチ中フラグ
  const [isFetching, setIsFetching] = useState(false);

  // === サブフック: 設定更新 ===
  const configUpdates = useConfigUpdates({
    store,
    setStore,
    safeConfig,
    setGlobalLoadingMessage,
    setCalculatedDataCache,
    setSourceCacheByDashboard,
    setDashboardDataCache,
    user,
    roles: store?.roles,
  });

  // === サブフック: カラム復旧＋マイグレーション ===
  const { reconcileColumnIndices, columnWarnings, setColumnWarnings } = useColumnReconcile({
    store,
    safeConfig,
    configUpdates,
  });

  // === サブフック: IndexedDBキャッシュ管理 ===
  const { cacheStatus, setCacheStatus } = useCacheManager({
    store,
    user,
    safeConfig,
    sourceCache,
    sourceCacheByDashboard,
    setSourceCache,
    setSourceCacheByDashboard,
    setIsLoading,
    setGlobalLoadingMessage,
    setIsConnected,
    abortControllerRef,
  });

  // === サブフック: ダッシュボードCRUD ===
  const dashboardCRUD = useDashboardCRUD({
    store,
    setStore,
    saveStoreToServer: configUpdates.saveStoreToServer,
    setGlobalLoadingMessage,
    setActiveFilters,
    filterStorage,
    setRawData,
    setSourceCache,
    setDashboardDataCache,
    setSourceCacheByDashboard,
    setCalculatedDataCache,
    setSubTab,
    setIsLoading,
    setIsConnected,
    setIsConnectedByDashboard,
    setIsViewTransitioning,
    dashboardDataCache,
    sourceCacheByDashboard,
    invalidateFetch,
  });

  // === タブ切り替え ===
  const handleTabChange = useCallback((newTab) => {
    if (newTab === subTab) return;

    const hasCachedData = calculatedDataCache[store?.activeId]?.data?.length > 0;
    if (hasCachedData && newTab === 'View') {
      setSubTab(newTab);
      return;
    }

    setIsViewTransitioning(true);
    const loadingMessages = { View: 'アナリティクス画面を読み込み中...', Settings: '設定画面を読み込み中...', SalesforceSync: 'SF連携画面を読み込み中...' };
    setGlobalLoadingMessage(loadingMessages[newTab] || '読み込み中...');

    requestAnimationFrame(() => {
      setSubTab(newTab);
      requestAnimationFrame(() => {
        setIsViewTransitioning(false);
        setGlobalLoadingMessage('');
      });
    });
  }, [subTab, calculatedDataCache, store?.activeId, setGlobalLoadingMessage]);

  // === フェッチ中断 ===
  const handleAbortFetch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setGlobalLoadingMessage('');
    setLoadingProgress({ current: 0, total: 0, currentSource: '' });
    setIsBackgroundRefreshing(false);
  }, [setIsLoading, setGlobalLoadingMessage]);

  const cancelFetch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setGlobalLoadingMessage('');
    setLoadingProgress({ current: 0, total: 0, currentSource: '' });
    setError(null);
    setIsBackgroundRefreshing(false);
  }, [setIsLoading, setGlobalLoadingMessage]);

  // === カラムインデックス自動復旧は useColumnReconcile に分離 ===
  // reconcileColumnIndices / columnWarnings / setColumnWarnings は上で取得済み

  // === ヘッダー取得 ===
  const handleFetchHeaders = useCallback(async (customDataSources) => {
    setError(null);
    setIsLoading(true);
    setGlobalLoadingMessage('ヘッダーを取得中...');

    const targetSources = customDataSources || safeConfig.dataSources;

    try {
      const updatedSources = await Promise.all(targetSources.map(async (src) => {
        // Salesforceソースの場合
        if (src.sourceType === 'salesforce' && src.reportId) {
          try {
            const res = await fetch(`./fetch_sf_report.php?action=describe&reportId=${encodeURIComponent(src.reportId)}`);
            if (!res.ok) throw new Error(`SF describe failed: ${res.status}`);
            const json = await res.json();
            if (json.status !== 'success' || !json.columns) throw new Error(json.message || 'SF describe error');
            let newHeaders = json.columns.map(col => col.label || col.apiName);
            // VLOOKUPカラムを維持
            const vlookupLabels = (src.vlookups || []).map(vl => vl.outputLabel || `${vl.targetObjectLabel || vl.targetObject}.${vl.targetValueField}`);
            if (vlookupLabels.length > 0) {
              newHeaders = [...newHeaders, ...vlookupLabels.filter(l => !newHeaders.includes(l))];
            }
            const updated = { ...src, headers: newHeaders };
            if (src.keyColumnName) {
              const idx = newHeaders.indexOf(src.keyColumnName);
              if (idx >= 0) updated.keyColumnIndex = idx;
            }
            if (src.dateColumnName) {
              const idx = newHeaders.indexOf(src.dateColumnName);
              if (idx >= 0) updated.dateColumnIndex = idx;
            }
            return updated;
          } catch (e) {
            console.error('SF header fetch error:', e);
            return src;
          }
        }

        // Salesforce SOQLソースの場合
        if (src.sourceType === 'salesforce-soql' && src.soqlObject && src.soqlFields) {
          try {
            const fields = src.soqlFields.split(',').map(f => f.trim()).filter(Boolean);
            const res = await fetch('./sf_upsert.php?action=queryForAnalytics', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                objectName: src.soqlObject,
                fields,
                whereClause: [src.soqlWhere, buildSoqlDateFilterClause(src.soqlDateFilter)].filter(Boolean).join(' AND ') || '',
                orderBy: src.soqlOrderBy || '',
                limitCount: 1
              })
            });
            if (!res.ok) throw new Error(`SF SOQL describe failed: ${res.status}`);
            const json = await res.json();
            if (json.status !== 'success' || !json.data?.columns) throw new Error(json.message || 'SF SOQL describe error');
            let newHeaders = json.data.columns;
            // VLOOKUPカラムを維持（ヘッダー再取得でVLOOKUP出力ラベルが消えないように）
            const vlookupLabels = (src.vlookups || []).map(vl => vl.outputLabel || `${vl.targetObjectLabel || vl.targetObject}.${vl.targetValueField}`);
            if (vlookupLabels.length > 0) {
              newHeaders = [...newHeaders, ...vlookupLabels.filter(l => !newHeaders.includes(l))];
            }
            const updated = { ...src, headers: newHeaders };
            if (src.keyColumnName) {
              const idx = newHeaders.indexOf(src.keyColumnName);
              if (idx >= 0) updated.keyColumnIndex = idx;
            }
            if (src.dateColumnName) {
              const idx = newHeaders.indexOf(src.dateColumnName);
              if (idx >= 0) updated.dateColumnIndex = idx;
            }
            // reshape有効時: 整形後ヘッダーに変換（生ヘッダーは_rawHeadersに保存）
            if (src.reshapeSettings?.enabled && src.reshapeSettings?.groups?.length > 0) {
              updated._rawHeaders = newHeaders;
              updated._originalDateColumnName = src.dateColumnName; // 元のdateColumnNameを保存
              const { headers: reshapedHeaders } = reshapeWideToLong([], newHeaders, src.reshapeSettings);
              updated.headers = reshapedHeaders;
              const dateColName = src.reshapeSettings.generatedDateColumnName || '稼働日';
              const newDateIdx = reshapedHeaders.indexOf(dateColName);
              if (newDateIdx >= 0) {
                updated.dateColumnIndex = newDateIdx;
                updated.dateColumnName = dateColName; // reconcileColumnIndicesと整合性を保つ
              }
              // キーカラム解決: reshapeKeyColumn → 既存名 → fixedColumns先頭
              let descKeyResolved = false;
              const descReshapeKey = src.reshapeSettings.reshapeKeyColumn;
              if (descReshapeKey) {
                const idx = reshapedHeaders.indexOf(descReshapeKey);
                if (idx >= 0) { updated.keyColumnIndex = idx; updated.keyColumnName = descReshapeKey; descKeyResolved = true; }
              }
              if (!descKeyResolved && src.keyColumnName) {
                const newKeyIdx = reshapedHeaders.indexOf(src.keyColumnName);
                if (newKeyIdx >= 0) { updated.keyColumnIndex = newKeyIdx; descKeyResolved = true; }
              }
              if (!descKeyResolved) {
                const fixedCols = src.reshapeSettings.fixedColumnNames || [];
                for (const fc of fixedCols) {
                  const idx = reshapedHeaders.indexOf(fc);
                  if (idx >= 0) { updated.keyColumnIndex = idx; updated.keyColumnName = fc; break; }
                }
              }
            } else if (src._rawHeaders) {
              // reshape無効化時: 生ヘッダーを復元
              updated.headers = src._rawHeaders;
              updated._rawHeaders = undefined;
              // dateColumnNameを元に戻す
              if (src._originalDateColumnName) {
                updated.dateColumnName = src._originalDateColumnName;
                updated._originalDateColumnName = undefined;
              }
              if (src.keyColumnName) {
                const idx = src._rawHeaders.indexOf(src.keyColumnName);
                if (idx >= 0) updated.keyColumnIndex = idx;
              }
              if (updated.dateColumnName) {
                const idx = src._rawHeaders.indexOf(updated.dateColumnName);
                if (idx >= 0) updated.dateColumnIndex = idx;
              }
            }
            return updated;
          } catch (e) {
            console.error('SF SOQL header fetch error:', e);
            return src;
          }
        }

        // スプレッドシートソースの場合
        if (!src.spreadsheetId || !src.sheetName) return src;
        if (!store || !store.apiKey) return src;
        const range = `'${src.sheetName}'!1:1`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${src.spreadsheetId}/values/${encodeURIComponent(range)}?key=${store.apiKey}`;
        const res = await fetch(url);
        const json = await res.json();
        const newHeaders = json.values ? json.values[0] : [];
        const updated = { ...src, headers: newHeaders };
        if (src.keyColumnName) {
          const newIdx = newHeaders.indexOf(src.keyColumnName);
          if (newIdx >= 0) updated.keyColumnIndex = newIdx;
        }
        if (src.dateColumnName) {
          const newIdx = newHeaders.indexOf(src.dateColumnName);
          if (newIdx >= 0) updated.dateColumnIndex = newIdx;
        }
        return updated;
      }));
      // reconcileColumnIndicesがヘッダー更新+インデックス復旧を一括保存
      const { reconciledConfig } = reconcileColumnIndices(updatedSources);
      return { updatedSources: reconciledConfig.dataSources, reconciledConfig };
    } catch (e) {
      setError({ type: 'HEADER_FETCH_FAIL', message: "ヘッダー取得エラー: " + e.message });
      return null;
    } finally {
      setIsLoading(false);
      setGlobalLoadingMessage('');
    }
  }, [store?.apiKey, safeConfig, configUpdates, reconcileColumnIndices, setIsLoading, setGlobalLoadingMessage]);

  // === データ取得 ===
  const fetchData = useCallback(async (forceRefresh = false, backgroundMode = false) => {
    if (!store || !store.activeId) return;

    const boardId = store.activeId;
    invalidateFetch();
    const fetchController = new AbortController();
    abortControllerRef.current = fetchController;
    const fetchGeneration = fetchGenerationRef.current;
    const isCurrentGeneration = () => fetchGenerationRef.current === fetchGeneration;
    const isCurrentFetch = () => isCurrentGeneration() && !fetchController.signal.aborted;

    // 新規ボード（dataSources が空）は fetch せず空データで正常終了（エラーモーダル抑止）
    const sources = safeConfig?.dataSources || [];
    if (sources.length === 0) {
      setRawData([]);
      setSourceCache({});
      setDashboardDataCache(prev => ({ ...prev, [boardId]: [] }));
      setSourceCacheByDashboard(prev => ({ ...prev, [boardId]: {} }));
      setError(null);
      setIsConnectedByDashboard(prev => ({ ...prev, [boardId]: false }));
      setIsFetching(false);
      if (!backgroundMode) {
        setIsLoading(false);
        setGlobalLoadingMessage('');
      }
      if (abortControllerRef.current === fetchController) {
        abortControllerRef.current = null;
      }
      return;
    }

    setError(null);
    setIsFetching(true);
    if (!backgroundMode) {
      setIsLoading(true);
      // 統一メッセージ: fetch→計算の全フェーズで同一文言（useAnalyticsData まで引き継ぎ）
      setGlobalLoadingMessage('データ更新中...');
    }

    try {
      let cacheData = null;

      // Step 1: forceRefreshでない場合、まず既存キャッシュを確認
      if (!forceRefresh) {
        try {
          const firstCacheRes = await fetch(
            `./performance_board/cache_read.php?boardId=${encodeURIComponent(boardId)}&t=${Date.now()}`,
            { signal: fetchController.signal }
          );
          if (firstCacheRes.ok) {
            cacheData = await firstCacheRes.json();
            // 既存キャッシュが取得できた → generate.phpをスキップ
          }
        } catch (e) {
          if (e?.name === 'AbortError') throw e;
          // cache_read.phpへの接続エラーは無視してgenerate.phpへフォールバック
        }
      }

      // Step 2: キャッシュがない or forceRefresh=trueならgenerate.phpで生成
      if (!cacheData) {
        // 進捗ポーリング開始
        let progressInterval = null;
        const pollProgress = async () => {
          if (!isCurrentFetch()) return;
          try {
            const res = await fetch(
              `./performance_board/progress_read.php?boardId=${encodeURIComponent(boardId)}&t=${Date.now()}`,
              { cache: 'no-store', signal: fetchController.signal }
            );
            if (!res.ok) return;
            const json = await res.json();
            if (isCurrentFetch() && json.status === 'ok' && json.progress) {
              setLoadingProgress({
                current: json.progress.current || 0,
                total: json.progress.total || 0,
                currentSource: json.progress.currentSource || '',
                percentage: json.progress.percentage || 0,
                stage: json.progress.stage || '',
              });
            }
          } catch { /* ignore polling errors */ }
        };

        pollProgress(); // 即時1回
        progressInterval = setInterval(pollProgress, 1000);

        try {
          const genRes = await fetch(`./performance_board/generate.php?boardId=${encodeURIComponent(boardId)}`, {
            method: 'POST',
            signal: fetchController.signal,
          });
          const genResult = await genRes.json();
          if (genResult.status !== 'success') {
            const err = new Error(genResult.message || 'データ生成に失敗しました');
            err.type = genResult.error_type || 'GENERATE_FAIL';
            throw err;
          }

          // Step 3: 生成後にキャッシュを取得（ファイル同期待ち race 対策で最大 2 回リトライ）
          let cacheRes;
          const maxRetries = 2;
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            cacheRes = await fetch(
              `./performance_board/cache_read.php?boardId=${encodeURIComponent(boardId)}&t=${Date.now()}`,
              { signal: fetchController.signal }
            );
            if (cacheRes.ok) break;
            if (attempt < maxRetries) {
              // 100ms → 300ms の短い backoff でファイルシステム同期を待つ
              await new Promise(r => setTimeout(r, 100 * Math.pow(3, attempt)));
            }
          }
          if (!cacheRes.ok) {
            const err = new Error('生成済みデータが見つかりません。設定を確認してください。');
            err.type = '404';
            throw err;
          }
          cacheData = await cacheRes.json();
        } finally {
          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
          }
        }
      }

      // Step 3: sourceCacheをセット → combineSourceData → rawDataの通常フロー
      // サーバー形式 { src_id: {columns, rows} } → クライアント形式 { src_id: rows[] } に変換
      const serverSourceCache = cacheData.sourceCache || {};
      const convertedSourceCache = {};
      Object.keys(serverSourceCache).forEach(sourceId => {
        const sourceData = serverSourceCache[sourceId];
        if (sourceData && typeof sourceData === 'object' && Array.isArray(sourceData.rows)) {
          convertedSourceCache[sourceId] = sourceData.rows;
        } else if (Array.isArray(sourceData)) {
          convertedSourceCache[sourceId] = sourceData;
        } else {
          convertedSourceCache[sourceId] = [];
        }
      });

      if (!isCurrentFetch()) return;
      setSourceCache(convertedSourceCache);
      setSourceCacheByDashboard(prev => ({ ...prev, [boardId]: convertedSourceCache }));

      const combinedRows = await combineSourceDataInWorker(convertedSourceCache, safeConfig, {
        signal: fetchController.signal,
        onProgress: ({ percentage, stage }) => {
          if (!isCurrentFetch()) return;
          setLoadingProgress({
            current: percentage,
            total: 100,
            currentSource: '',
            percentage,
            stage,
            phase: 'combine',
          });
        },
        onMetrics: metrics => {
          if (isCurrentFetch()) setCombineMetrics({ boardId, ...metrics });
        },
      });

      if (!isCurrentFetch()) return;
      setRawData(combinedRows);
      setDashboardDataCache(prev => ({ ...prev, [boardId]: combinedRows }));

      // ボード別に状態を保存（ボード切替時の混線防止）
      setIsConnectedByDashboard(prev => ({ ...prev, [boardId]: true }));
      setLastUpdatedByDashboard(prev => ({ ...prev, [boardId]: cacheData.meta?.generatedAt || new Date().toISOString() }));
      setServerCacheInfoByDashboard(prev => ({ ...prev, [boardId]: cacheData.meta || null }));
      // ★ UX改善: isLoading / globalLoadingMessage をここでクリアせず useAnalyticsData の
      // Worker 計算完了までオーバーレイを維持（render 間のチラつきを防ぐ）。
      // useAnalyticsData の Worker 完了パス / 空データパス / 計算不要パスで最終 clear される。
      setIsBackgroundRefreshing(false);
      setIsFetching(false);
      setLoadingProgress({ current: 0, total: 0, currentSource: '', percentage: 0, stage: '' });
      return;
    } catch (e) {
      if (e?.name === 'AbortError') {
        if (isCurrentGeneration()) setIsFetching(false);
        return;
      }
      if (!isCurrentFetch()) return;
      // エラー種別を分類: type が付いていればそれを使い、TypeError（fetch のネットワークエラー）は NETWORK、それ以外は UNKNOWN
      const errorType = e?.type || (e?.name === 'TypeError' ? 'NETWORK' : 'UNKNOWN');
      setError({ type: errorType, message: e?.message || String(e) });
      // 強制リフレッシュが失敗した場合は古いデータを画面に残さない（ユーザー混乱回避）
      if (forceRefresh) {
        setRawData([]);
        setSourceCache({});
        setDashboardDataCache(prev => {
          const next = { ...prev };
          delete next[boardId];
          return next;
        });
        setSourceCacheByDashboard(prev => {
          const next = { ...prev };
          delete next[boardId];
          return next;
        });
      }
      setIsLoading(false);
      setIsBackgroundRefreshing(false);
      setIsFetching(false);
      setGlobalLoadingMessage('');
      // エラー時は進捗バーもリセット（Fatal後の次回オーバーレイで残留バー防止）
      setLoadingProgress({ current: 0, total: 0, currentSource: '' });
      return;
    } finally {
      if (abortControllerRef.current === fetchController) {
        abortControllerRef.current = null;
      }
    }
  }, [store, safeConfig, setIsLoading, setGlobalLoadingMessage, invalidateFetch]);

  // === マイグレーション useEffect は useColumnReconcile に分離済み ===
  // === IndexedDBキャッシュ初期化 useEffect は useCacheManager に分離済み ===

  // === デフォルト除外フィルター反映 useEffect ===
  const prevExcludeFiltersRef = useRef(null);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (safeConfig) {
        prevExcludeFiltersRef.current = safeConfig.defaultFilters?.excludeFilters || {};
      }
      return;
    }

    if (!safeConfig) return;

    const defaultExcludeFilters = safeConfig.defaultFilters?.excludeFilters || {};
    const newExcludeStr = JSON.stringify(defaultExcludeFilters);
    const prevExcludeStr = JSON.stringify(prevExcludeFiltersRef.current);

    if (newExcludeStr === prevExcludeStr) return;

    prevExcludeFiltersRef.current = defaultExcludeFilters;
    setActiveFilters(prev => ({
      ...prev,
      _exclude: defaultExcludeFilters
    }));
  }, [safeConfig?.defaultFilters?.excludeFilters, setActiveFilters]);

  const triggerCacheRebuild = useCallback((sourceId) => {
    forceFullRefreshSourceRef.current = sourceId;
  }, []);

  return {
    // State
    rawData,
    sourceCache,
    dashboardDataCache,
    sourceCacheByDashboard,
    calculatedDataCache,
    setCalculatedDataCache,
    isBackgroundRefreshing,
    setIsBackgroundRefreshing,
    cacheStatus,
    serverCacheInfo,
    subTab,
    setSubTab,
    isConnected,
    error,
    setError,
    lastUpdated,
    loadingProgress,
    combineMetrics,
    draggedDashboardId: dashboardCRUD.draggedDashboardId,
    dragOverDashboardId: dashboardCRUD.dragOverDashboardId,
    isViewTransitioning,
    isFetching,
    safeConfig,
    columnWarnings,

    // Functions
    handleTabChange,
    handleAbortFetch,
    cancelFetch,
    fetchData,
    handleFetchHeaders,
    switchDashboard: dashboardCRUD.switchDashboard,
    createDashboard: dashboardCRUD.createDashboard,
    duplicateDashboard: dashboardCRUD.duplicateDashboard,
    deleteDashboard: dashboardCRUD.deleteDashboard,
    saveDashboardConfig: async (...args) => {
      const result = await configUpdates.saveDashboardConfig(...args);
      if (result) setColumnWarnings([]);
      return result;
    },
    updateConfig: configUpdates.updateConfig,
    updateSectionFields: configUpdates.updateSectionFields,
    updateTableFieldsOrder: configUpdates.updateTableFieldsOrder,
    updateDataTableColumnColors: configUpdates.updateDataTableColumnColors,
    updateDataTableColumnAliases: configUpdates.updateDataTableColumnAliases,
    updateDataTableVisibleEmployeeIds: configUpdates.updateDataTableVisibleEmployeeIds,
    updateDataTableStickyColumns: configUpdates.updateDataTableStickyColumns,
    updateDataTableMaxHeight: configUpdates.updateDataTableMaxHeight,
    updateDataTableFontSize: configUpdates.updateDataTableFontSize,
    updateDataTableHeaderFontSize: configUpdates.updateDataTableHeaderFontSize,
    updateDataTableSummaryFontSize: configUpdates.updateDataTableSummaryFontSize,
    updateDataTableDataFontSize: configUpdates.updateDataTableDataFontSize,
    updateDataTableDataRowHeight: configUpdates.updateDataTableDataRowHeight,
    updateDataTableHeaderRowHeight: configUpdates.updateDataTableHeaderRowHeight,
    updateDataTableSummaryRowHeight: configUpdates.updateDataTableSummaryRowHeight,
    updateDataTableColumnWidths: configUpdates.updateDataTableColumnWidths,
    updateVendorPivotTableMetricColors: configUpdates.updateVendorPivotTableMetricColors,
    updateVendorPivotTableFilterValues: configUpdates.updateVendorPivotTableFilterValues,
    updateComparisonTableConfig: configUpdates.updateComparisonTableConfig,
    updateCalculations: configUpdates.updateCalculations,
    updateDataTableSettings: configUpdates.updateDataTableSettings,
    addDataTable: configUpdates.addDataTable,
    deleteDataTable: configUpdates.deleteDataTable,
    updateDashboardOrder: dashboardCRUD.updateDashboardOrder,
    handleDashboardDragStart: dashboardCRUD.handleDashboardDragStart,
    handleDashboardDragOver: dashboardCRUD.handleDashboardDragOver,
    handleDashboardDragEnd: dashboardCRUD.handleDashboardDragEnd,
    getOrderedDashboards: dashboardCRUD.getOrderedDashboards,
    getVisibleDashboards: dashboardCRUD.getVisibleDashboards,
    triggerCacheRebuild,
  };
};

export default useAnalyticsStore;
