// src/apps/performance-board/hooks/useCacheManager.js
// IndexedDB キャッシュ初期化 + cacheStatus state 管理

import { useState, useEffect } from 'react';
import { loadAllFromCache } from '../../../indexedDBCache';

/**
 * IndexedDB キャッシュ初期化を担当するフック
 *
 * 責務:
 *   1. cacheStatus state 管理（'none' / 'loaded' / 'fresh'）
 *   2. activeId 変化時のキャッシュ復元
 *      - メモリキャッシュ（sourceCacheByDashboard）→ IndexedDB の順にチェック
 *      - キャッシュヒット時は setSourceCache + setIsConnected(true)
 *
 * 注意: setCacheStatus は fetchData からも呼ばれる（'fresh' セット）ため外部に公開する
 *
 * @returns {{ cacheStatus: string, setCacheStatus: Function }}
 */
export const useCacheManager = ({
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
}) => {
  const [cacheStatus, setCacheStatus] = useState('none');

  // === IndexedDBキャッシュ初期化 useEffect ===
  useEffect(() => {
    if (!store || !user) return;

    // ボード切替時に古い非同期処理が新しいボードの state を汚染しないよう cancel フラグで保護
    let cancelled = false;

    const initializeWithCache = async () => {
      const sourceIds = safeConfig.dataSources.map(s => s.id);

      // switchDashboardで既にsourceCacheがセットされている場合はスキップ
      if (Object.keys(sourceCache).length > 0 && sourceIds.every(id => sourceCache[id])) {
        if (cancelled) return;
        setCacheStatus('loaded');
        return;
      }

      // メモリキャッシュを先にチェック
      const memoryCache = sourceCacheByDashboard[store.activeId];
      if (memoryCache && Object.keys(memoryCache).length > 0 && sourceIds.every(id => memoryCache[id])) {
        if (cancelled) return;
        setSourceCache(memoryCache);
        if (!abortControllerRef.current) {
          setIsLoading(false);
          setGlobalLoadingMessage('');
        }
        setCacheStatus('loaded');
        return;
      }

      // IndexedDBからキャッシュを読み込み（非同期）
      try {
        const cachedData = await loadAllFromCache(store.activeId, sourceIds);
        if (cancelled) return;

        if (Object.keys(cachedData).length > 0 && sourceIds.every(id => cachedData[id])) {
          setSourceCache(cachedData);
          setSourceCacheByDashboard(prev => ({
            ...prev,
            [store.activeId]: cachedData
          }));
          setCacheStatus('loaded');
          if (!abortControllerRef.current) {
            setIsLoading(false);
            setGlobalLoadingMessage('');
          }
          setIsConnected(true);
          return;
        }
      } catch (err) {
        // キャッシュ読み込み失敗時は何もしない
      }

      if (cancelled) return;
      setCacheStatus('none');
      if (!abortControllerRef.current) {
        setIsLoading(false);
        setGlobalLoadingMessage('');
      }
      setIsConnected(false);
    };

    initializeWithCache();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.activeId, user]);

  return {
    cacheStatus,
    setCacheStatus,
  };
};
