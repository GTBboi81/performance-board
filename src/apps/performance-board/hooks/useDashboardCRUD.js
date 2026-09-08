// src/apps/performance-board/hooks/useDashboardCRUD.js
// ダッシュボードCRUD・切替・並び替え・ドラッグ&ドロップ操作

import { useState, useCallback } from 'react';
import { DEFAULT_DASHBOARD_CONFIG } from '../../../constants';
import { getDefaultFilters } from '../utils';

/**
 * ダッシュボードCRUD操作フック
 */
export function useDashboardCRUD({
  store,
  setStore,
  saveStoreToServer,
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
}) {
  // ドラッグ&ドロップ State
  const [draggedDashboardId, setDraggedDashboardId] = useState(null);
  const [dragOverDashboardId, setDragOverDashboardId] = useState(null);

  // === ダッシュボード並び替え ===
  const updateDashboardOrder = useCallback((newOrder) => {
    const newStore = { ...store, dashboardOrder: newOrder };
    setStore(newStore);
    saveStoreToServer(newStore);
  }, [store, setStore, saveStoreToServer]);

  // === ドラッグ&ドロップ ===
  const handleDashboardDragStart = useCallback((e, id) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedDashboardId(id);
    setDragOverDashboardId(null);
  }, []);

  const handleDashboardDragOver = useCallback((e, id) => {
    e.preventDefault();
    if (id !== draggedDashboardId) {
      setDragOverDashboardId(id);
    }
  }, [draggedDashboardId]);

  const handleDashboardDragEnd = useCallback(() => {
    if (!store?.dashboards) {
      setDraggedDashboardId(null);
      setDragOverDashboardId(null);
      return;
    }
    if (draggedDashboardId && dragOverDashboardId && draggedDashboardId !== dragOverDashboardId) {
      // getOrderedDashboardsと同じロジックで全ダッシュボードIDを取得
      const savedOrder = store.dashboardOrder || [];
      const allIds = Object.keys(store.dashboards);
      const missingIds = allIds.filter(id => !savedOrder.includes(id));
      const dashboardIds = [...savedOrder.filter(id => store.dashboards[id]), ...missingIds];

      const fromIndex = dashboardIds.indexOf(draggedDashboardId);
      const toIndex = dashboardIds.indexOf(dragOverDashboardId);
      if (fromIndex !== -1 && toIndex !== -1) {
        const newOrder = [...dashboardIds];
        newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, draggedDashboardId);
        updateDashboardOrder(newOrder);
      }
    }
    setDraggedDashboardId(null);
    setDragOverDashboardId(null);
  }, [draggedDashboardId, dragOverDashboardId, store, updateDashboardOrder]);

  // === 順序付きダッシュボード一覧 ===
  const getOrderedDashboards = useCallback(() => {
    if (!store?.dashboards) return [];
    const dashboardIds = store.dashboardOrder || Object.keys(store.dashboards);
    const allIds = Object.keys(store.dashboards);
    const missingIds = allIds.filter(id => !dashboardIds.includes(id));
    const orderedIds = [...dashboardIds.filter(id => store.dashboards[id]), ...missingIds];
    return orderedIds.map(id => store.dashboards[id]).filter(Boolean);
  }, [store]);

  // === ロールフィルタリング済みダッシュボード一覧 ===
  const getVisibleDashboards = useCallback((user, roles) => {
    const ordered = getOrderedDashboards();
    return ordered.filter(dashboard => {
      // 1. adminロール（ワイルドカード権限）は常に全表示
      const roleId = user?.roleId || user?.role;
      const userRole = roles?.[roleId];
      if (userRole?.permissions?.['*'] === true) return true;

      // 2. アカウント単位のdashboardAccessチェック（既存ロジック）
      const access = user?.dashboardAccess || [];
      if (access.length > 0 && !access.includes(dashboard.id)) return false;

      // 3. ダッシュボード単位のallowedRolesチェック（新規）
      const allowedRoles = dashboard.allowedRoles || [];
      if (allowedRoles.length === 0) return true; // 空配列 = 全ロールに表示
      return allowedRoles.includes(roleId);
    });
  }, [getOrderedDashboards]);

  // === ダッシュボード切り替え ===
  const switchDashboard = useCallback((id) => {
    if (!store || store.activeId === id) return;

    invalidateFetch();
    setIsViewTransitioning(true);
    setGlobalLoadingMessage('ダッシュボードを切り替え中...');
    window.scrollTo({ top: 0, behavior: 'instant' });

    const targetConfig = store.dashboards[id] || {};
    const defaultExcludeFilters = targetConfig.defaultFilters?.excludeFilters || {};
    const savedFilters = filterStorage.loadSavedFilters(id);
    const hasSaved = filterStorage.checkSavedFilters(id);

    const hasDashboardCache = dashboardDataCache[id];
    const cachedSourceData = sourceCacheByDashboard[id] || {};

    requestAnimationFrame(() => {
      filterStorage.setFilterSaved(hasSaved);
      if (savedFilters) {
        setActiveFilters({
          ...savedFilters,
          _exclude: defaultExcludeFilters
        });
      } else {
        setActiveFilters(getDefaultFilters(targetConfig.defaultFilters || {}));
      }

      if (hasDashboardCache) {
        setRawData(dashboardDataCache[id]);
        setSourceCache(cachedSourceData);
        // 切替先ボードの isConnected を更新（activeId 変更前に切替先 id で直接更新）
        setIsConnectedByDashboard?.(prev => ({ ...prev, [id]: true }));
      } else {
        setRawData([]);
        setSourceCache({});
        setIsConnectedByDashboard?.(prev => ({ ...prev, [id]: false }));
      }

      setStore(prev => ({ ...prev, activeId: id }));
      setSubTab('View');
      setIsLoading(false);

      setTimeout(() => {
        setIsViewTransitioning(false);
        setGlobalLoadingMessage('');
      }, 150);
    });
  }, [store, setStore, setActiveFilters, setIsLoading, setGlobalLoadingMessage, filterStorage, dashboardDataCache, sourceCacheByDashboard, setRawData, setSourceCache, setIsConnected, setIsConnectedByDashboard, setSubTab, setIsViewTransitioning, invalidateFetch]);

  // === ダッシュボード作成 ===
  const createDashboard = useCallback(() => {
    if (!store?.dashboards) return;
    setGlobalLoadingMessage('ダッシュボードを作成中...');
    const newId = `dash_${Date.now()}`;
    const newDashboard = { ...DEFAULT_DASHBOARD_CONFIG, id: newId, name: '新規ダッシュボード', savedFilters: {} };
    const currentOrder = store.dashboardOrder || Object.keys(store.dashboards);
    const newStore = {
      ...store,
      activeId: newId,
      dashboards: { ...store.dashboards, [newId]: newDashboard },
      dashboardOrder: [...currentOrder, newId]
    };
    setStore(newStore);
    setRawData([]);
    setSourceCache({});
    setDashboardDataCache({});
    setCalculatedDataCache({});
    setActiveFilters(getDefaultFilters(newDashboard.defaultFilters || {}));
    filterStorage.setFilterSaved(false);
    setSubTab('Settings');
    saveStoreToServer(newStore);
    setTimeout(() => setGlobalLoadingMessage(''), 200);
  }, [store, setStore, setActiveFilters, setGlobalLoadingMessage, filterStorage, saveStoreToServer, setRawData, setSourceCache, setDashboardDataCache, setCalculatedDataCache, setSubTab]);

  // === ダッシュボード複製 ===
  const duplicateDashboard = useCallback((id, e) => {
    e.stopPropagation();
    if (!store?.dashboards) return;
    const sourceDashboard = store.dashboards[id];
    if (!sourceDashboard) return;

    setGlobalLoadingMessage('ダッシュボードを複製中...');
    const newId = `dash_${Date.now()}`;
    const duplicatedDashboard = JSON.parse(JSON.stringify(sourceDashboard));
    duplicatedDashboard.id = newId;
    duplicatedDashboard.name = `${sourceDashboard.name} (コピー)`;
    duplicatedDashboard.savedFilters = {};

    const currentOrder = store.dashboardOrder || Object.keys(store.dashboards);
    const newStore = {
      ...store,
      activeId: newId,
      dashboards: { ...store.dashboards, [newId]: duplicatedDashboard },
      dashboardOrder: [...currentOrder, newId]
    };
    setStore(newStore);
    setRawData([]);
    setSourceCache({});
    setDashboardDataCache({});
    setCalculatedDataCache({});
    setActiveFilters(getDefaultFilters(duplicatedDashboard.defaultFilters || {}));
    filterStorage.setFilterSaved(false);
    setSubTab('View');
    saveStoreToServer(newStore);
    setTimeout(() => setGlobalLoadingMessage(''), 200);
  }, [store, setStore, setActiveFilters, setGlobalLoadingMessage, filterStorage, saveStoreToServer, setRawData, setSourceCache, setDashboardDataCache, setCalculatedDataCache, setSubTab]);

  // === ダッシュボード削除 ===
  const deleteDashboard = useCallback(async (id, e) => {
    e.stopPropagation();
    if (!store?.dashboards) return;
    if (Object.keys(store.dashboards).length <= 1) {
      alert("最後のダッシュボードは削除できません");
      return;
    }
    if (!confirm("このダッシュボードを削除してもよろしいですか？")) return;

    const prevStore = store; // ロールバック用スナップショット
    setGlobalLoadingMessage('ダッシュボードを削除中...');
    const newDashboards = { ...store.dashboards };
    delete newDashboards[id];
    let newActiveId = store.activeId;
    if (id === store.activeId) {
      newActiveId = Object.keys(newDashboards)[0];
    }
    const newDashboardOrder = (store.dashboardOrder || []).filter(dashboardId => dashboardId !== id);
    const newStore = { ...store, activeId: newActiveId, dashboards: newDashboards, dashboardOrder: newDashboardOrder };
    setStore(newStore);
    setRawData([]);
    setSourceCache({});
    setDashboardDataCache({});
    setCalculatedDataCache(prev => {
      const newCache = { ...prev };
      delete newCache[id];
      return newCache;
    });
    const targetConfig = newDashboards[newActiveId] || {};
    setActiveFilters(getDefaultFilters(targetConfig.defaultFilters || {}));
    filterStorage.setFilterSaved(filterStorage.checkSavedFilters(newActiveId));
    try {
      const success = await saveStoreToServer(newStore);
      if (!success) {
        setStore(prevStore);
        alert('ダッシュボードの削除に失敗しました。権限またはサーバー接続を確認してください。');
      }
    } catch {
      setStore(prevStore);
      alert('ダッシュボードの削除に失敗しました。');
    } finally {
      setGlobalLoadingMessage('');
    }
  }, [store, setStore, setActiveFilters, setGlobalLoadingMessage, filterStorage, saveStoreToServer, setRawData, setSourceCache, setDashboardDataCache, setCalculatedDataCache]);

  return {
    // D&D State
    draggedDashboardId,
    dragOverDashboardId,
    // Functions
    updateDashboardOrder,
    handleDashboardDragStart,
    handleDashboardDragOver,
    handleDashboardDragEnd,
    getOrderedDashboards,
    getVisibleDashboards,
    switchDashboard,
    createDashboard,
    duplicateDashboard,
    deleteDashboard,
  };
}
