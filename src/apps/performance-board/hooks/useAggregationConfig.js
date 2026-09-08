// src/apps/performance-board/hooks/useAggregationConfig.js
// 集計設定管理フック

import { useState, useEffect, useMemo } from 'react';

/**
 * 集計設定管理フック
 * @param {object} options
 * @param {object} options.tableConfig - テーブル設定
 * @param {array} options.aggregationConfigs - 集計設定配列
 * @returns {object} 集計設定関連の状態と関数
 */
export const useAggregationConfig = ({
  tableConfig,
  aggregationConfigs = [],
}) => {
  // 「集計条件なし」用の特別な設定（テーブルのfieldsを使用）
  const noAggregationConfig = useMemo(() => ({
    id: '__no_aggregation__',
    label: '集計なし（表示項目を使用）',
    groupByField: '',
    displayFields: tableConfig.fields || []
  }), [tableConfig.fields]);

  // 集計条件リスト（「集計条件なし」を先頭に追加）
  const safeAggregationConfigs = useMemo(() => {
    const configs = aggregationConfigs || [];
    return [noAggregationConfig, ...configs];
  }, [aggregationConfigs, noAggregationConfig]);

  // テーブルのデフォルト集計条件IDから初期値を決定
  const defaultAggConfigId = useMemo(() => {
    if (!tableConfig.defaultGroupBy) {
      // デフォルト集計条件が未設定の場合は「集計条件なし」
      return '__no_aggregation__';
    }
    // 指定された集計条件IDが存在するか確認
    const matchingConfig = safeAggregationConfigs.find(
      config => config.id === tableConfig.defaultGroupBy
    );
    return matchingConfig?.id || '__no_aggregation__';
  }, [tableConfig.defaultGroupBy, safeAggregationConfigs]);

  // 選択中の集計条件ID（初期値はデフォルト集計フィールドに基づく）
  const [selectedAggConfigId, setSelectedAggConfigId] = useState(defaultAggConfigId);

  // デフォルト集計フィールドが変更された場合に選択を更新
  useEffect(() => {
    setSelectedAggConfigId(defaultAggConfigId);
  }, [defaultAggConfigId]);

  // 現在選択中の集計条件を取得
  const currentAggConfig = useMemo(() => {
    if (!selectedAggConfigId) {
      // デフォルトは最初の集計条件
      return safeAggregationConfigs[0] || { groupByField: '', displayFields: [] };
    }
    return safeAggregationConfigs.find(c => c.id === selectedAggConfigId) || { groupByField: '', displayFields: [] };
  }, [selectedAggConfigId, safeAggregationConfigs]);

  // 日付変換設定を取得
  const dateTransforms = useMemo(() => {
    return currentAggConfig.dateTransforms || {};
  }, [currentAggConfig.dateTransforms]);

  // ソース参照展開設定
  const sourceExpand = currentAggConfig.sourceExpand;
  const isSourceExpandMode = sourceExpand?.enabled && sourceExpand?.sourceId;

  return {
    // State
    selectedAggConfigId,
    setSelectedAggConfigId,

    // Computed values
    noAggregationConfig,
    safeAggregationConfigs,
    defaultAggConfigId,
    currentAggConfig,
    dateTransforms,
    sourceExpand,
    isSourceExpandMode,
  };
};

export default useAggregationConfig;
