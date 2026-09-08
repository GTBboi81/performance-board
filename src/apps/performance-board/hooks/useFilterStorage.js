// src/apps/performance-board/hooks/useFilterStorage.js
// フィルター永続化を管理するカスタムフック

import { useState, useCallback, useEffect, useRef } from 'react';
import { getStoragePrefix } from '../../../utils';
import { getDefaultFilters } from '../utils';

// ユーザー操作のフィルター値のみ抽出（内部キーを除外）
const getUserFilterValues = (filters) => {
  if (!filters) return {};
  const result = {};
  for (const key of Object.keys(filters)) {
    if (key.startsWith('_')) continue; // _exclude, _dateRange等の内部キーを除外
    result[key] = filters[key];
  }
  return result;
};

/**
 * フィルター永続化フック
 */
export const useFilterStorage = ({
  dashboardId,
  activeFilters,
  setActiveFilters,
  setGlobalLoadingMessage,
  setIsFilterApplying,
  defaultFilters = {},
}) => {
  // フィルター保存状態
  const [filterSaved, setFilterSaved] = useState(false);

  // 保存直後フラグ（適用ボタンによる再適用で未保存にしない）
  const savedSnapshotRef = useRef(null);

  // フィルター保存用のlocalStorageキー
  const getFilterStorageKey = useCallback((id) => {
    return `${getStoragePrefix()}filters_${id}`;
  }, []);

  // 保存されたフィルターを読み込む
  const loadSavedFilters = useCallback((id) => {
    try {
      const saved = localStorage.getItem(getFilterStorageKey(id));
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      // エラー時は何もしない
    }
    return null;
  }, [getFilterStorageKey]);

  // 保存されたフィルターがあるかチェック
  const checkSavedFilters = useCallback((id) => {
    if (!id) return false;
    return localStorage.getItem(getFilterStorageKey(id)) !== null;
  }, [getFilterStorageKey]);

  // activeFiltersが変わったら保存済みフィルターと比較して保存状態を更新
  useEffect(() => {
    if (!dashboardId || !filterSaved) return;
    const saved = loadSavedFilters(dashboardId);
    if (!saved) {
      setFilterSaved(false);
      return;
    }
    // ユーザー操作値のみで比較（_excludeなど内部キーは無視）
    const currentValues = getUserFilterValues(activeFilters);
    const savedValues = getUserFilterValues(saved);
    if (JSON.stringify(currentValues) !== JSON.stringify(savedValues)) {
      setFilterSaved(false);
      savedSnapshotRef.current = null;
    }
  }, [activeFilters, dashboardId, filterSaved, loadSavedFilters]);

  // フィルターを保存
  const saveFilters = useCallback((filtersToSave) => {
    if (!dashboardId) return;
    const filters = filtersToSave || activeFilters;
    setGlobalLoadingMessage('フィルターを保存中...');
    setIsFilterApplying(true);
    setTimeout(() => {
      try {
        // 内部キーを除外して保存
        const filtersToStore = getUserFilterValues(filters);
        localStorage.setItem(getFilterStorageKey(dashboardId), JSON.stringify(filtersToStore));
        savedSnapshotRef.current = JSON.stringify(filtersToStore);
        setFilterSaved(true);
        if (filtersToSave) {
          setActiveFilters(filtersToSave);
        }
      } catch (e) {
        // エラー時は何もしない
      }
      setGlobalLoadingMessage('');
      setIsFilterApplying(false);
    }, 100);
  }, [dashboardId, activeFilters, setActiveFilters, setGlobalLoadingMessage, setIsFilterApplying, getFilterStorageKey]);

  // 保存したフィルターをクリア
  const clearSavedFilters = useCallback(() => {
    if (!dashboardId) return;
    setGlobalLoadingMessage('フィルターをクリア中...');
    setTimeout(() => {
      try {
        localStorage.removeItem(getFilterStorageKey(dashboardId));
        setFilterSaved(false);
        savedSnapshotRef.current = null;
        setActiveFilters(getDefaultFilters(defaultFilters));
      } catch (e) {
        // エラー時は何もしない
      }
      setGlobalLoadingMessage('');
    }, 100);
  }, [dashboardId, defaultFilters, setActiveFilters, setGlobalLoadingMessage, getFilterStorageKey]);

  return {
    filterSaved,
    setFilterSaved,
    getFilterStorageKey,
    loadSavedFilters,
    saveFilters,
    clearSavedFilters,
    checkSavedFilters,
  };
};

export default useFilterStorage;
