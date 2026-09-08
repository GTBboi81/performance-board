// src/apps/performance-board/utils/boardDataLoader.js
// 非アクティブボードのデータを読み込みユーティリティ
// キャッシュ済みデータ + processDataTablePure で処理

import { processDataTablePure } from './processDataTablePure';

/**
 * 指定ボードのDataTableデータを取得・処理する
 * @param {object} params
 * @param {object} params.boardConfig - allDashboards[boardId]
 * @param {string} params.tableId - DataTable ID
 * @param {string} params.aggConfigId - 集計設定ID
 * @param {object} params.calculatedDataCache - store内のキャッシュ
 * @param {object} params.sourceCacheByDashboard - store内のキャッシュ
 * @param {string} params.boardId
 * @returns {{ error: string|null, data: array|null, tableConfig: object|null, aggConfig: object|null, cacheHash: string|null }}
 */
export function loadBoardTableData({
  boardConfig,
  tableId,
  aggConfigId,
  calculatedDataCache,
  sourceCacheByDashboard,
  boardId,
}) {
  if (!boardConfig) {
    return { error: 'ボード設定が見つかりません', data: null, tableConfig: null, aggConfig: null, cacheHash: null };
  }

  const cacheEntry = calculatedDataCache?.[boardId];
  const calculatedRows = cacheEntry?.data;
  if (!calculatedRows) {
    return { error: 'データ未読み込み（先にボードを表示してデータを更新してください）', data: null, tableConfig: null, aggConfig: null, cacheHash: null };
  }

  const dataTables = boardConfig.dataTables || [];
  const tableConfig = dataTables.find(t => t.id === tableId);
  if (!tableConfig) {
    return { error: 'テーブル設定が見つかりません', data: null, tableConfig: null, aggConfig: null, cacheHash: null };
  }

  const aggConfig = resolveAggConfig(boardConfig, aggConfigId, tableConfig);

  // ソース展開モードは非アクティブボードでは未対応（expandedRowsの計算にReactフックが必要）
  const sourceExpand = aggConfig?.sourceExpand;
  if (sourceExpand?.enabled && sourceExpand?.sourceId) {
    return { error: 'ソース展開モードの集計設定は一括インポートでは未対応です。別の集計設定を選択してください', data: null, tableConfig: null, aggConfig: null, cacheHash: null };
  }

  const groupByFields = aggConfig?.groupByField
    ? (Array.isArray(aggConfig.groupByField) ? aggConfig.groupByField : [aggConfig.groupByField])
    : [];

  const { processedData } = processDataTablePure({
    allRows: calculatedRows,
    systemFields: boardConfig.systemFields || [],
    calculations: boardConfig.calculations || [],
    currentAggConfig: aggConfig,
    groupByFields,
    dateTransforms: aggConfig?.dateTransforms || {},
    sourceCache: sourceCacheByDashboard?.[boardId] || {},
    dataSources: boardConfig.dataSources || [],
    activeFilters: {},
    mapping: boardConfig.mapping || {},
  });

  return { error: null, data: processedData, tableConfig, aggConfig, cacheHash: cacheEntry?.hash || null };
}

/**
 * 集計設定を解決する
 */
export function resolveAggConfig(boardConfig, aggConfigId, tableConfig) {
  const aggregationConfigs = boardConfig.aggregationConfigs || [];

  if (aggConfigId) {
    const found = aggregationConfigs.find(c => c.id === aggConfigId);
    if (found) return found;
  }

  // tableConfig.defaultGroupByに基づくデフォルト（useAggregationConfigと同じ挙動）
  if (tableConfig?.defaultGroupBy) {
    const defaultByTable = aggregationConfigs.find(c => c.id === tableConfig.defaultGroupBy);
    if (defaultByTable) return defaultByTable;
  }

  // フォールバック: isDefault → 先頭
  const tableAggs = aggregationConfigs.filter(c => c.tableId === tableConfig?.id);
  if (tableAggs.length > 0) {
    const defaultAgg = tableAggs.find(c => c.isDefault) || tableAggs[0];
    return defaultAgg;
  }

  return null;
}

/**
 * ボードで利用可能なDataTableの一覧を取得
 */
export function getBoardTables(boardConfig) {
  return (boardConfig?.dataTables || []).map(t => ({
    id: t.id,
    name: t.name || t.id,
  }));
}

/**
 * ボードで利用可能な集計設定の一覧を取得
 */
export function getBoardAggConfigs(boardConfig, tableId) {
  return (boardConfig?.aggregationConfigs || [])
    .filter(c => c.tableId === tableId)
    .map(c => ({
      id: c.id,
      name: c.name || c.id,
      isDefault: c.isDefault || false,
    }));
}

/**
 * DataTable処理後のカラム情報を取得
 */
export function getTableColumns(boardConfig, tableConfig, aggConfig) {
  const systemFields = boardConfig?.systemFields || [];
  const calculations = boardConfig?.calculations || [];
  const addedIds = new Set();

  const headers = [];

  const addHeader = (id, name, type) => {
    if (addedIds.has(id)) return;
    addedIds.add(id);
    headers.push({ id, name, type });
  };

  // groupByフィールド（集計結果に含まれる）
  const groupByFields = aggConfig?.groupByField
    ? (Array.isArray(aggConfig.groupByField) ? aggConfig.groupByField : [aggConfig.groupByField])
    : [];
  groupByFields.forEach(fieldId => {
    const field = systemFields.find(f => f.id === fieldId);
    if (field) addHeader(field.id, field.name || field.id, field.type);
  });

  // システムフィールド
  const tableFields = tableConfig?.fields || [];
  tableFields.forEach(fieldId => {
    const field = systemFields.find(f => f.id === fieldId);
    if (field) addHeader(field.id, field.name || field.id, field.type);
  });

  // 計算フィールド
  const tableCalcIds = tableConfig?.calculations || [];
  tableCalcIds.forEach(calcId => {
    const calc = calculations.find(c => c.id === calcId);
    if (calc) addHeader(calc.id, calc.name || calc.id, calc.type === 'arithmetic' ? 'calculation' : calc.type);
  });

  // _count（集計モードでgroupByがある場合に自動生成される）
  if (groupByFields.length > 0) {
    addHeader('_count', '件数', 'number');
  }

  return headers;
}
