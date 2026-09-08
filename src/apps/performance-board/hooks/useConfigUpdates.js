// src/apps/performance-board/hooks/useConfigUpdates.js
// ダッシュボード設定の更新・保存関数群

import { useCallback } from 'react';
import { clearCache } from '../../../indexedDBCache';

// pb_config.json専用の保存関数
export const savePbConfigMerged = async (mergeFn) => {
  try {
    const res = await fetch(`./performance_board/save_pb_config.php?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch');
    const latest = await res.json();
    const merged = mergeFn(latest);
    const saveRes = await fetch('./performance_board/save_pb_config.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
    });
    if (!saveRes.ok) throw new Error(`Server returned ${saveRes.status}`);
    return true;
  } catch (e) {
    console.error('Failed to save pb_config:', e);
    alert('実績ボードの設定保存に失敗しました。');
    return false;
  }
};

/**
 * sfImportPresets の importHistory をサーバー側とマージする
 * cronが追加した履歴エントリをフロントエンド保存時に失わないようにする
 */
function mergePresetsHistory(clientPresets, serverPresets) {
  if (!serverPresets || !clientPresets) return clientPresets || serverPresets || [];
  return clientPresets.map(cp => {
    const sp = serverPresets.find(s => s.id === cp.id);
    if (!sp) return cp;
    // importHistory を結合（id で重複排除、新しい順、最大20件）
    const historyMap = new Map();
    for (const h of [...(sp.importHistory || []), ...(cp.importHistory || [])]) {
      historyMap.set(h.id, h);
    }
    const mergedHistory = [...historyMap.values()]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 100);
    // lastRunAt は新しい方を採用
    const cpTime = cp.lastRunAt ? new Date(cp.lastRunAt).getTime() : 0;
    const spTime = sp.lastRunAt ? new Date(sp.lastRunAt).getTime() : 0;
    return {
      ...cp,
      importHistory: mergedHistory,
      lastRunAt: cpTime >= spTime ? cp.lastRunAt : sp.lastRunAt,
    };
  });
}

/**
 * ダッシュボードを deep merge する（サーバー側のcron変更を保持）
 */
function deepMergeDashboards(latestDashboards, newDashboards) {
  if (!newDashboards) return { ...(latestDashboards || {}) };
  // クライアント側のダッシュボードIDをベースにマージ（クライアントで削除されたものは除外）
  const merged = {};
  for (const [id, clientDash] of Object.entries(newDashboards)) {
    const serverDash = (latestDashboards || {})[id] || {};
    merged[id] = { ...serverDash, ...clientDash };
    // sfImportPresets の履歴をマージ
    if (clientDash.sfImportPresets && serverDash.sfImportPresets) {
      merged[id].sfImportPresets = mergePresetsHistory(clientDash.sfImportPresets, serverDash.sfImportPresets);
    }
  }
  return merged;
}

/**
 * 設定更新・保存フック
 */
export function useConfigUpdates({
  store,
  setStore,
  safeConfig,
  setGlobalLoadingMessage,
  setCalculatedDataCache,
  setSourceCacheByDashboard,
  setDashboardDataCache,
  user,
  roles,
}) {
  // === サーバー保存（マージ保存: 最新configに変更部分だけマージ） ===
  const saveStoreToServer = useCallback(async (newStore) => {
    if (user?.isGuest) {
      alert('デモ環境では変更を保存できません');
      return false;
    }
    const isAdmin = user?.roleId === 'admin' || user?.role === 'admin';
    const roleId = user?.roleId || user?.role;
    const userRole = roles?.[roleId];
    const canSave = isAdmin
      || userRole?.permissions?.['performance-board.dashboard.create']
      || userRole?.permissions?.['performance-board.dashboard.delete']
      || userRole?.permissions?.['performance-board.settings']
      || userRole?.permissions?.['analytics.dashboard.create']
      || userRole?.permissions?.['analytics.dashboard.delete'];
    if (!canSave) {
      console.warn('saveStoreToServer: 権限不足のため保存をスキップしました');
      return false;
    }
    return await savePbConfigMerged(latest => ({
      ...latest,
      ...newStore,
      dashboards: deepMergeDashboards(latest.dashboards, newStore.dashboards),
    }));
  }, [user?.roleId, user?.role, roles]);

  // === 汎用設定更新 ===
  const updateConfig = useCallback((key, value) => {
    if (!store || !store.activeId) return;
    const newStore = {
      ...store,
      dashboards: {
        ...store.dashboards,
        [store.activeId]: {
          ...store.dashboards[store.activeId],
          [key]: value
        }
      }
    };
    setStore(newStore);
    saveStoreToServer(newStore);
  }, [store, setStore, saveStoreToServer]);

  // === 複数キーを一括更新（reconcileColumnIndices用） ===
  const updateConfigBatch = useCallback((updates) => {
    if (!store || !store.activeId) return;
    const activeId = store.activeId;
    // 関数型setStoreで最新stateに対してマージ（並行呼び出し時の競合防止）
    setStore(prev => {
      const dashboard = { ...prev.dashboards[activeId], ...updates };
      const newStore = { ...prev, dashboards: { ...prev.dashboards, [activeId]: dashboard } };
      saveStoreToServer(newStore);
      return newStore;
    });
  }, [store?.activeId, setStore, saveStoreToServer]);

  // === ダッシュボード設定保存（マージ保存 + キャッシュ全クリア付き） ===
  const saveDashboardConfig = useCallback(async (newDashboardConfig, newApiKey = null) => {
    if (!store || !store.activeId) return false;
    setGlobalLoadingMessage('設定を保存中...');

    const activeId = store.activeId;

    // excludeFilters の孤立キーをクリーンアップ（削除済みフィルターのゴミ防止）
    let configToSave = newDashboardConfig;
    if (configToSave.defaultFilters?.excludeFilters && configToSave.filters) {
      const validFields = new Set(configToSave.filters.map(f => f.field));
      const cleaned = {};
      for (const [key, val] of Object.entries(configToSave.defaultFilters.excludeFilters)) {
        if (validFields.has(key)) {
          cleaned[key] = val;
        }
      }
      configToSave = { ...configToSave, defaultFilters: { ...configToSave.defaultFilters, excludeFilters: cleaned } };
    }

    const success = await savePbConfigMerged(latest => {
      const serverDash = latest.dashboards?.[activeId] || {};
      // sfImportPresets の履歴はサーバー側とマージして保持
      const mergedDashConfig = { ...serverDash, ...configToSave };
      if (configToSave.sfImportPresets && serverDash.sfImportPresets) {
        mergedDashConfig.sfImportPresets = mergePresetsHistory(configToSave.sfImportPresets, serverDash.sfImportPresets);
      }
      const merged = {
        ...latest,
        dashboards: { ...latest.dashboards, [activeId]: mergedDashConfig }
      };
      if (newApiKey !== null) merged.apiKey = newApiKey;
      return merged;
    });

    if (success) {
      const newStore = {
        ...store,
        dashboards: { ...store.dashboards, [activeId]: configToSave }
      };
      if (newApiKey !== null) newStore.apiKey = newApiKey;
      setStore(newStore);
      // ★ 全キャッシュクリア（マッピング変更時にデータ不整合を防止）
      setCalculatedDataCache(prev => {
        const c = { ...prev };
        delete c[activeId];
        return c;
      });
      setSourceCacheByDashboard(prev => {
        const c = { ...prev };
        delete c[activeId];
        return c;
      });
      setDashboardDataCache(prev => {
        const c = { ...prev };
        delete c[activeId];
        return c;
      });
      // IndexedDBキャッシュもクリア
      clearCache(activeId).catch(() => {});
    }
    setGlobalLoadingMessage('');
    return success;
  }, [store, setStore, setGlobalLoadingMessage, setCalculatedDataCache, setSourceCacheByDashboard, setDashboardDataCache]);

  // === セクションフィールド更新 ===
  const updateSectionFields = useCallback((sectionId, newFields) => {
    const newSections = safeConfig.sections.map(s =>
      s.id === sectionId ? { ...s, fields: newFields } : s
    );
    updateConfig('sections', newSections);
  }, [safeConfig?.sections, updateConfig]);

  // === テーブルフィールド順序更新 ===
  const updateTableFieldsOrder = useCallback((newFields) => {
    updateConfig('tableFields', newFields);
  }, [updateConfig]);

  // === データテーブル列カラー更新 ===
  const updateDataTableColumnColors = useCallback((tableId, columnColors) => {
    const dataTables = safeConfig.dataTables || [];
    const newDataTables = dataTables.map(table =>
      table.id === tableId ? { ...table, columnColors } : table
    );
    updateConfig('dataTables', newDataTables);
  }, [safeConfig?.dataTables, updateConfig]);

  // === データテーブル列エイリアス更新 ===
  const updateDataTableColumnAliases = useCallback((tableId, columnAliases) => {
    const dataTables = safeConfig.dataTables || [];
    const newDataTables = dataTables.map(table =>
      table.id === tableId ? { ...table, columnAliases } : table
    );
    updateConfig('dataTables', newDataTables);
  }, [safeConfig?.dataTables, updateConfig]);

  // === データテーブル 担当者ホワイトリスト更新 ===
  const updateDataTableVisibleEmployeeIds = useCallback((tableId, visibleEmployeeIds) => {
    const dataTables = safeConfig.dataTables || [];
    const newDataTables = dataTables.map(table =>
      table.id === tableId ? { ...table, visibleEmployeeIds } : table
    );
    updateConfig('dataTables', newDataTables);
  }, [safeConfig?.dataTables, updateConfig]);

  // === データテーブル固定列数更新（ツールバーと設定画面の競合解消） ===
  const updateDataTableStickyColumns = useCallback((tableId, stickyColumns) => {
    const dataTables = safeConfig.dataTables || [];
    const newDataTables = dataTables.map(table =>
      table.id === tableId ? { ...table, stickyColumns } : table
    );
    updateConfig('dataTables', newDataTables);
  }, [safeConfig?.dataTables, updateConfig]);

  // === データテーブル 最大高さ更新 ===
  const updateDataTableMaxHeight = useCallback((tableId, maxHeight) => {
    const dataTables = safeConfig.dataTables || [];
    const newDataTables = dataTables.map(table =>
      table.id === tableId ? { ...table, maxHeight } : table
    );
    updateConfig('dataTables', newDataTables);
  }, [safeConfig?.dataTables, updateConfig]);

  // === データテーブル フォントサイズ更新 ===
  const updateDataTableFontSize = useCallback((tableId, fontSize) => {
    const dataTables = safeConfig.dataTables || [];
    const newDataTables = dataTables.map(table =>
      table.id === tableId ? { ...table, fontSize } : table
    );
    updateConfig('dataTables', newDataTables);
  }, [safeConfig?.dataTables, updateConfig]);

  // === データテーブル ヘッダーフォントサイズ更新 ===
  const updateDataTableHeaderFontSize = useCallback((tableId, headerFontSize) => {
    const dataTables = safeConfig.dataTables || [];
    const newDataTables = dataTables.map(table =>
      table.id === tableId ? { ...table, headerFontSize } : table
    );
    updateConfig('dataTables', newDataTables);
  }, [safeConfig?.dataTables, updateConfig]);

  // === データテーブル 合計値フォントサイズ更新 ===
  const updateDataTableSummaryFontSize = useCallback((tableId, summaryFontSize) => {
    const dataTables = safeConfig.dataTables || [];
    const newDataTables = dataTables.map(table =>
      table.id === tableId ? { ...table, summaryFontSize } : table
    );
    updateConfig('dataTables', newDataTables);
  }, [safeConfig?.dataTables, updateConfig]);

  // === データテーブル データ行フォントサイズ更新 ===
  const updateDataTableDataFontSize = useCallback((tableId, dataFontSize) => {
    const dataTables = safeConfig.dataTables || [];
    const newDataTables = dataTables.map(table =>
      table.id === tableId ? { ...table, dataFontSize } : table
    );
    updateConfig('dataTables', newDataTables);
  }, [safeConfig?.dataTables, updateConfig]);

  // === データテーブル データ行の高さ更新 ===
  const updateDataTableDataRowHeight = useCallback((tableId, dataRowHeight) => {
    const dataTables = safeConfig.dataTables || [];
    const newDataTables = dataTables.map(table =>
      table.id === tableId ? { ...table, dataRowHeight } : table
    );
    updateConfig('dataTables', newDataTables);
  }, [safeConfig?.dataTables, updateConfig]);

  // === データテーブル ヘッダー行の高さ更新 ===
  const updateDataTableHeaderRowHeight = useCallback((tableId, headerRowHeight) => {
    const dataTables = safeConfig.dataTables || [];
    const newDataTables = dataTables.map(table =>
      table.id === tableId ? { ...table, headerRowHeight } : table
    );
    updateConfig('dataTables', newDataTables);
  }, [safeConfig?.dataTables, updateConfig]);

  // === データテーブル 合計値行の高さ更新 ===
  const updateDataTableSummaryRowHeight = useCallback((tableId, summaryRowHeight) => {
    const dataTables = safeConfig.dataTables || [];
    const newDataTables = dataTables.map(table =>
      table.id === tableId ? { ...table, summaryRowHeight } : table
    );
    updateConfig('dataTables', newDataTables);
  }, [safeConfig?.dataTables, updateConfig]);

  // === データテーブル カラム幅更新 ===
  const updateDataTableColumnWidths = useCallback((tableId, columnWidths) => {
    const dataTables = safeConfig.dataTables || [];
    const newDataTables = dataTables.map(table =>
      table.id === tableId ? { ...table, columnWidths } : table
    );
    updateConfig('dataTables', newDataTables);
  }, [safeConfig?.dataTables, updateConfig]);

  // === ベンダーピボットテーブル メトリクスカラー更新 ===
  const updateVendorPivotTableMetricColors = useCallback((tableId, metricColors) => {
    const vendorPivotTables = safeConfig.vendorPivotTables || [];
    const newTables = vendorPivotTables.map(table =>
      table.id === tableId ? { ...table, metricColors } : table
    );
    updateConfig('vendorPivotTables', newTables);
  }, [safeConfig?.vendorPivotTables, updateConfig]);

  // === ベンダーピボットテーブル フィルター値更新 ===
  const updateVendorPivotTableFilterValues = useCallback((tableId, filterId, values) => {
    const vendorPivotTables = safeConfig.vendorPivotTables || [];
    const newTables = vendorPivotTables.map(table => {
      if (table.id !== tableId) return table;
      const currentFilterValues = table.tableFilterValues || {};
      const newFilterValues = { ...currentFilterValues };
      if (!values || values.length === 0) {
        delete newFilterValues[filterId];
      } else {
        newFilterValues[filterId] = values;
      }
      return { ...table, tableFilterValues: newFilterValues };
    });
    updateConfig('vendorPivotTables', newTables);
  }, [safeConfig?.vendorPivotTables, updateConfig]);

  // === 比較テーブル設定更新 ===
  const updateComparisonTableConfig = useCallback((tableId, changes) => {
    const comparisonTables = safeConfig.comparisonTables || [];
    const newTables = comparisonTables.map(table =>
      table.id === tableId ? { ...table, ...changes } : table
    );
    updateConfig('comparisonTables', newTables);
  }, [safeConfig?.comparisonTables, updateConfig]);

  // === 計算式配列を関数で更新 ===
  const updateCalculations = useCallback((calcsFn) => {
    const newCalcs = calcsFn(safeConfig?.calculations || []);
    updateConfig('calculations', newCalcs);
  }, [safeConfig?.calculations, updateConfig]);

  // === データテーブル全体設定を更新 ===
  const updateDataTableSettings = useCallback((tableId, updates) => {
    const dataTables = safeConfig?.dataTables || [];
    const newDataTables = dataTables.map(t =>
      t.id === tableId ? { ...t, ...updates } : t
    );
    updateConfig('dataTables', newDataTables);
  }, [safeConfig?.dataTables, updateConfig]);

  // === 新しいデータテーブルを追加 ===
  const addDataTable = useCallback((newTable) => {
    const dataTables = safeConfig?.dataTables || [];
    updateConfig('dataTables', [...dataTables, newTable]);
  }, [safeConfig?.dataTables, updateConfig]);

  // === データテーブルを削除 ===
  const deleteDataTable = useCallback((tableId) => {
    const dataTables = safeConfig?.dataTables || [];
    updateConfig('dataTables', dataTables.filter(t => t.id !== tableId));
  }, [safeConfig?.dataTables, updateConfig]);

  return {
    saveStoreToServer,
    updateConfig,
    updateConfigBatch,
    saveDashboardConfig,
    updateSectionFields,
    updateTableFieldsOrder,
    updateDataTableColumnColors,
    updateDataTableColumnAliases,
    updateDataTableVisibleEmployeeIds,
    updateDataTableStickyColumns,
    updateDataTableMaxHeight,
    updateDataTableFontSize,
    updateDataTableHeaderFontSize,
    updateDataTableSummaryFontSize,
    updateDataTableDataFontSize,
    updateDataTableDataRowHeight,
    updateDataTableHeaderRowHeight,
    updateDataTableSummaryRowHeight,
    updateDataTableColumnWidths,
    updateVendorPivotTableMetricColors,
    updateVendorPivotTableFilterValues,
    updateComparisonTableConfig,
    updateCalculations,
    updateDataTableSettings,
    addDataTable,
    deleteDataTable,
  };
}
