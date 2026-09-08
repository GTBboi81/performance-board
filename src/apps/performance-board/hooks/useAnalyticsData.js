// src/apps/performance-board/hooks/useAnalyticsData.js
// Analytics計算ロジックのカスタムフック

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { isDateInRange } from '../utils/dateFilters';
import { generateSourceIndicesHash, generateCalcCacheHash } from '../utils/analyticsCache';
import { getCalculationWarnings } from '../utils/calculationWarnings';

// デフォルト設定
const DEFAULT_CONFIG = {
  systemFields: [],
  calculations: [],
  dateSettings: { type: 'auto' }
};

/**
 * Analytics用の計算ロジックを提供するカスタムフック
 * @param {object} options - フックのオプション
 * @param {array} options.rawData - 生データ配列
 * @param {object} options.sourceCache - ソースデータキャッシュ
 * @param {object} options.config - ダッシュボード設定
 * @param {object} options.activeFilters - アクティブフィルター
 * @param {string} options.dashboardId - ダッシュボードID
 * @param {object} options.calculatedDataCache - 計算済みデータキャッシュ
 * @param {function} options.setCalculatedDataCache - キャッシュ更新関数
 * @param {function} options.setIsLoading - ローディング状態更新（オプション）
 * @param {function} options.setIsBackgroundRefreshing - バックグラウンド更新状態（オプション）
 * @param {function} options.setGlobalLoadingMessage - ローディングメッセージ更新（オプション）
 * @returns {object} 計算結果と状態
 */
export const useAnalyticsData = ({
  rawData = [],
  sourceCache = {},
  config,
  activeFilters = {},
  dashboardId,
  calculatedDataCache = {},
  setCalculatedDataCache = () => {},
  setIsLoading = () => {},
  setIsBackgroundRefreshing = () => {},
  setGlobalLoadingMessage = () => {},
  isFetching = false,
}) => {
  // --- State ---
  const [calculatedData, setCalculatedData] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calcProgress, setCalcProgress] = useState(0);
  const [recalcTrigger, setRecalcTrigger] = useState(0);  // ★ 再計算トリガー

  // --- Refs ---
  const calcAbortRef = useRef(null);
  const workerRef = useRef(null);
  const sourceIndicesCacheRef = useRef({});
  const prevDashboardIdRef = useRef(dashboardId);  // ★ ダッシュボード切り替え検知用
  const completedHashRef = useRef(null);  // ★ 最後に計算完了したハッシュ（Worker再実行防止）
  const prevRawDataRef = useRef(rawData);  // ★ rawData参照変化の検知用（forceRefresh後の再計算保証）
  const calculatedDataCacheRef = useRef(calculatedDataCache);  // ★ キャッシュをrefで参照（依存配列から除外）
  const setCalculatedDataCacheRef = useRef(setCalculatedDataCache);

  // ref を最新値に同期
  calculatedDataCacheRef.current = calculatedDataCache;
  setCalculatedDataCacheRef.current = setCalculatedDataCache;

  // --- Safe Config ---
  const safeConfig = config || DEFAULT_CONFIG;

  // ★ calculations / dateSettingsの参照安定化（中身が同じなら同じ文字列 → useMemoが再実行されない）
  const calculationsKey = useMemo(
    () => {
      try {
        return JSON.stringify(safeConfig.calculations || [], (key, value) => {
          if (value instanceof HTMLElement || value instanceof Event) return undefined;
          return value;
        });
      } catch { return String(Date.now()); }
    },
    [safeConfig.calculations]
  );
  const stableCalculations = useMemo(
    () => safeConfig.calculations || [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [calculationsKey]
  );
  const dateSettingsKey = useMemo(
    () => JSON.stringify(safeConfig.dateSettings || { type: 'auto' }),
    [safeConfig.dateSettings]
  );
  const stableDateSettings = useMemo(
    () => safeConfig.dateSettings || { type: 'auto' },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateSettingsKey]
  );

  const calculationWarnings = useMemo(() => getCalculationWarnings({
    calculations: stableCalculations,
    systemFields: safeConfig.systemFields || [],
    indicatorGroups: safeConfig.indicatorGroups || [],
  }), [stableCalculations, safeConfig.systemFields, safeConfig.indicatorGroups]);

  // --- sourceIndicesHash ---
  const sourceIndicesHash = useMemo(() => {
    return generateSourceIndicesHash(dashboardId, sourceCache, stableCalculations);
  }, [dashboardId, sourceCache, stableCalculations]);

  // --- sourceIndices ---
  const sourceIndices = useMemo(() => {
    const relationCalcs = (stableCalculations || []).filter(c => c.type === 'relation');
    if (relationCalcs.length === 0) {
      return {};
    }

    // キャッシュチェック
    const cache = sourceIndicesCacheRef.current;
    if (sourceIndicesHash && cache[dashboardId]?.hash === sourceIndicesHash) {
      return cache[dashboardId].indices;
    }

    const indices = {};

    // 各リレーション計算に対してインデックスを構築
    relationCalcs.forEach(calc => {
      if (!calc.targetSourceId) return;

      const sourceRows = sourceCache[calc.targetSourceId] || [];
      if (sourceRows.length === 0) return;

      // foreignKeyIndexを取得（指定がなければ0）
      const foreignKeyIdx = calc.foreignKeyIndex !== '' && calc.foreignKeyIndex !== undefined
        ? parseInt(calc.foreignKeyIndex)
        : 0;

      // このcalc専用のインデックスキー
      const indexKey = `${calc.targetSourceId}:${calc.id}`;

      const indexMap = new Map();
      sourceRows.forEach(row => {
        const rawKey = row[foreignKeyIdx];
        const key = (rawKey === undefined || rawKey === null || rawKey === '') ? '(空白)' : String(rawKey);
        if (!indexMap.has(key)) indexMap.set(key, []);
        indexMap.get(key).push(row);
      });
      indices[indexKey] = indexMap;
    });

    // キャッシュに保存
    if (sourceIndicesHash && dashboardId) {
      sourceIndicesCacheRef.current = {
        ...sourceIndicesCacheRef.current,
        [dashboardId]: { indices, hash: sourceIndicesHash }
      };
    }

    return indices;
  }, [sourceCache, stableCalculations, sourceIndicesHash, dashboardId]);

  // --- calcCacheHash ---
  const calcCacheHash = useMemo(() => {
    return generateCalcCacheHash(dashboardId, rawData, stableCalculations, activeFilters);
  }, [dashboardId, rawData, stableCalculations, activeFilters]);

  // --- numericFieldIds ---
  const numericFieldIds = useMemo(
    () => (safeConfig.systemFields || []).filter(f => f.type === 'number').map(f => f.id),
    [safeConfig.systemFields]
  );

  // --- allNumericFieldIds ---
  const allNumericFieldIds = useMemo(() => {
    const systemNumericIds = (safeConfig.systemFields || []).filter(f => f.type === 'number').map(f => f.id);
    const calcIds = (stableCalculations || []).map(c => c.id);
    return [...new Set([...systemNumericIds, ...calcIds])];
  }, [safeConfig.systemFields, stableCalculations]);

  // --- Web Worker計算 (useEffect) ---
  useEffect(() => {
    // ★ rawData参照が変わった場合、完了ハッシュをリセット（forceRefresh後の再計算を保証）
    // ハッシュが同じでもrawDataが新しい配列なら再計算が必要
    if (rawData !== prevRawDataRef.current) {
      prevRawDataRef.current = rawData;
      completedHashRef.current = null;
    }

    // ★★ 早期バイパス: 同じハッシュで既に計算完了済み → 何もしない（setState呼び出しも不要）
    if (calcCacheHash && calcCacheHash === completedHashRef.current && calculatedData.length > 0) {
      return;
    }

    const cache = calculatedDataCacheRef.current;

    // ★ ダッシュボード切り替え検知: IDが変わった場合はキャッシュを優先表示（isFetchingより先に処理）
    const isDashboardSwitch = prevDashboardIdRef.current !== dashboardId;
    if (isDashboardSwitch) {
      prevDashboardIdRef.current = dashboardId;  // 次回比較用に更新
      completedHashRef.current = null;  // ダッシュボード切替時はハッシュリセット
      // ★ ダッシュボード切替時は一律で状態をリセット（キャッシュ有無に関わらず前状態を引き継がない）
      setIsCalculating(false);
      setIsBackgroundRefreshing(false);
      setCalcProgress(0);

      // 計算済みキャッシュがあれば即座に表示
      if (cache[dashboardId]?.data?.length > 0) {
        const cached = cache[dashboardId];
        setCalculatedData(cached.data);

        completedHashRef.current = cached.hash;  // キャッシュのハッシュを記録
        // ★ キャッシュ表示時点でローディングをクリア（ユーザーに即座にデータを見せる）
        setIsLoading(false);
        setGlobalLoadingMessage('');
        setCalcProgress(100);
        // ★ ダッシュボード切り替え時はキャッシュを表示して即座に終了
        // この時点では activeFilters がまだ前のダッシュボードの値の可能性があるため
        // ハッシュ比較せずに return し、フィルター復元後の次のレンダリングサイクルで再評価
        return;
      }
    }

    // ★ フェッチ中は処理をスキップ（fetchDataが完了するまで待つ）
    if (isFetching) {
      return;
    }

    // キャッシュチェック: 同じハッシュのキャッシュがあればスキップ
    if (calcCacheHash && cache[dashboardId]?.hash === calcCacheHash) {
      const cached = cache[dashboardId];
      if (cached.data?.length > 0) {
        setCalculatedData(cached.data);

        completedHashRef.current = calcCacheHash;  // 完了ハッシュを記録
        setIsCalculating(false);
        setIsLoading(false);
        setIsBackgroundRefreshing(false);
        setGlobalLoadingMessage('');
        setCalcProgress(100);
        return;
      }
    }

    // キャンセル用
    if (calcAbortRef.current) {
      calcAbortRef.current.cancelled = true;
    }
    // 既存のWorkerを終了
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    const abortFlag = { cancelled: false };
    calcAbortRef.current = abortFlag;

    // rawDataがない場合
    if (!rawData.length) {
      // ★ フェッチ中のダッシュボード切り替え時のみキャッシュを維持（取得完了後は空データとして確定）
      if (isFetching && isDashboardSwitch && cache[dashboardId]?.data?.length > 0) {
        // キャッシュ表示を維持（rawDataが来るまで待つ）
        return;
      }
      setCalculatedData([]);
      setIsCalculating(false);
      setCalcProgress(0);
      setIsBackgroundRefreshing(false);  // ★ 空データ確定時はバックグラウンド更新状態をクリア
      // fetchData が isLoading/message を引き継ぐ仕様になったので、fetch 完了後に
      // 空データならここでオーバーレイを閉じる（fetch 中なら閉じずに待つ）
      if (!isFetching) {
        setIsLoading(false);
        setGlobalLoadingMessage('');
      }
      return;
    }

    // 計算がない場合はそのまま返す
    if (!stableCalculations || stableCalculations.length === 0) {
      setCalculatedData(rawData);
      setIsCalculating(false);
      setIsLoading(false);
      setIsBackgroundRefreshing(false);
      setGlobalLoadingMessage('');
      setCalcProgress(100);
      return;
    }

    // リレーション計算が必要な場合でも、sourceIndicesが空ならそのまま進行
    // （Workerが空のsourceIndicesを処理し、リレーション計算は0として扱われる）

    // Web Worker非対応環境
    if (typeof Worker === 'undefined') {
      console.error('Web Worker is not supported in this environment');
      setIsCalculating(false);
      setIsLoading(false);
      setIsBackgroundRefreshing(false);
      return;
    }

    setIsCalculating(true);
    // ★ バックグラウンド更新時はローディングメッセージを表示しない（キャッシュが既に表示されている）
    // 現在のダッシュボードにキャッシュが存在しハッシュ不一致の場合 = バックグラウンド更新
    const currentDashboardCache = cache[dashboardId];
    const hasDashboardCache = currentDashboardCache?.data?.length > 0;
    const isBackgroundRefresh = hasDashboardCache && currentDashboardCache.hash !== calcCacheHash;
    if (!isBackgroundRefresh) {
      // fetchData からの引き継ぎで同じ文言を維持（オーバーレイのチラつき回避）
      setGlobalLoadingMessage('データ更新中...');
      setCalcProgress(0);
    }

    // sourceIndicesをシリアライズ可能な形式に変換
    const serializedSourceIndices = {};
    for (const [sourceId, indexMap] of Object.entries(sourceIndices)) {
      serializedSourceIndices[sourceId] = Array.from(indexMap.entries());
    }

    // Web Workerを作成
    const worker = new Worker(
      new URL('../../../calculationWorker.js', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.onmessage = (e) => {
      if (abortFlag.cancelled) {
        worker.terminate();
        return;
      }

      if (e.data.type === 'progress') {
        const progress = e.data.progress;
        setCalcProgress(progress);
      } else if (e.data.type === 'complete') {
        const resultData = e.data.data;
        setCalculatedData(resultData);

        completedHashRef.current = calcCacheHash;  // ★ 完了ハッシュを記録（再実行防止）
        setIsCalculating(false);
        setIsLoading(false);
        setIsBackgroundRefreshing(false);
        setGlobalLoadingMessage('');
        setCalcProgress(100);
        // キャッシュに保存（refで参照）
        if (calcCacheHash && dashboardId) {
          setCalculatedDataCacheRef.current(prev => ({
            ...prev,
            [dashboardId]: { data: resultData, hash: calcCacheHash }
          }));
        }
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.onerror = (err) => {
      console.error('Worker error:', err);
      worker.terminate();
      workerRef.current = null;
      setIsCalculating(false);
      setIsLoading(false);
      setIsBackgroundRefreshing(false);
      setGlobalLoadingMessage('');  // ★ エラー時もメッセージクリア
    };

    // Workerにデータを送信
    worker.postMessage({
      rawData,
      serializedSourceIndices,
      calculations: stableCalculations,
      activeFilters,
      chunkSize: 1000
    });

    return () => {
      abortFlag.cancelled = true;
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawData, sourceIndices, stableCalculations, activeFilters, calcCacheHash, dashboardId, setIsLoading, setIsBackgroundRefreshing, setGlobalLoadingMessage, isFetching, recalcTrigger]);
  // ★ calculatedDataCache/setCalculatedDataCache はrefで参照（依存配列から除外し、キャッシュ更新による不要なWorker再実行を防止）

  // --- filteredData ---
  const filteredData = useMemo(() => {
    if (!calculatedData.length) return [];

    const rawExcludeFilters = activeFilters._exclude || {};

    const quickDateMode = activeFilters._quickDateMode;
    const fieldOverrides = {};
    if (quickDateMode === 'lastMonth') {
      (safeConfig.filters || []).forEach(f => {
        if (f.lastMonthField) fieldOverrides[f.field] = f.lastMonthField;
      });
    }
    // フォールバック付きフィールド値取得（代替カラムが空なら元カラムを使う）
    const getFieldValue = (row, originalKey) => {
      const overrideKey = fieldOverrides[originalKey];
      if (!overrideKey) return row[originalKey];
      const val = row[overrideKey];
      if (val === undefined || val === null || val === '') return row[originalKey];
      return val;
    };

    // 有効なフィルター定義に存在するフィールドのみ適用（孤立キー防止）
    const validFilterFields = new Set((safeConfig.filters || []).map(f => f.field));
    const excludeFilters = {};
    for (const [key, val] of Object.entries(rawExcludeFilters)) {
      if (validFilterFields.has(key)) {
        excludeFilters[key] = val;
      }
    }

    // filterMappingsでマッピングされているフィールドを収集
    const mappedFields = new Set();
    (stableCalculations || []).forEach(calc => {
      if (calc.type === 'relation' && calc.filterMappings) {
        Object.keys(calc.filterMappings).forEach(field => mappedFields.add(field));
      }
      if (calc.type === 'conditionalCount' && calc.filterMappings) {
        Object.keys(calc.filterMappings).forEach(field => mappedFields.add(field));
      }
    });

    let filtered = calculatedData.filter(row => {
      const passesNormalFilters = Object.entries(activeFilters).every(([key, val]) => {
        if (!val) return true;
        if (key === '_exclude' || key === '_quickDateMode') return true;
        if (mappedFields.has(key) && calculatedData.length > 0 && !(key in calculatedData[0])) return true;
        if (key === 'date' && typeof val === 'object') {
          if (!val.start && !val.end) return true;
          if (val.start && val.end) {
            return isDateInRange(getFieldValue(row, key), val.start, val.end);
          }
          return true;
        }
        if (Array.isArray(val)) {
          if (val.length === 0) return true;
          const rowValue = getFieldValue(row, key);
          if (val.includes('(空白)') && (rowValue === undefined || rowValue === null || rowValue === '')) {
            return true;
          }
          return val.includes(String(rowValue));
        }
        const rowValue = getFieldValue(row, key);
        if (val === '(空白)' && (rowValue === undefined || rowValue === null || rowValue === '')) {
          return true;
        }
        return String(rowValue) === String(val);
      });

      if (!passesNormalFilters) return false;

      const passesExcludeFilters = Object.entries(excludeFilters).every(([fieldId, filterConfig]) => {
        const values = Array.isArray(filterConfig) ? filterConfig : (filterConfig?.values || []);
        const mode = Array.isArray(filterConfig) ? 'exclude' : (filterConfig?.mode || 'exclude');

        if (!values || values.length === 0) return true;
        const rawRowValue = getFieldValue(row, fieldId);
        const isBlank = rawRowValue === undefined || rawRowValue === null || rawRowValue === '';
        const rowValue = isBlank ? '(空白)' : String(rawRowValue);

        if (mode === 'include') {
          return values.includes(rowValue);
        } else {
          return !values.includes(rowValue);
        }
      });

      return passesExcludeFilters;
    });

    const dateSettings = stableDateSettings || { type: 'auto' };
    if (dateSettings.type === 'auto') {
      if (allNumericFieldIds.length > 0) {
        filtered = filtered.filter(row => {
          return allNumericFieldIds.some(fieldId => row[fieldId] && row[fieldId] !== 0);
        });
      }
    }

    // filterMappingsでマッピングされたフィルターが有効な場合
    const activeFilterIds = Object.keys(activeFilters).filter(key => {
      if (key === '_exclude' || key === 'date' || key === '_quickDateMode') return false;
      const val = activeFilters[key];
      if (!val) return false;
      if (Array.isArray(val) && val.length === 0) return false;
      if (!mappedFields.has(key)) return false;
      // 行データにフィールドが存在する場合は行レベルで既にフィルタリング済み
      if (calculatedData.length > 0 && (key in calculatedData[0])) return false;
      return true;
    });

    if (activeFilterIds.length > 0) {
      const relatedCalcIds = [];
      (stableCalculations || []).forEach(calc => {
        if ((calc.type === 'relation' || calc.type === 'conditionalCount') && calc.filterMappings) {
          const calcFilterIds = Object.keys(calc.filterMappings);
          if (activeFilterIds.some(filterId => calcFilterIds.includes(filterId))) {
            relatedCalcIds.push(calc.id);
          }
        }
      });

      if (relatedCalcIds.length > 0) {
        filtered = filtered.filter(row => {
          return relatedCalcIds.some(calcId => row[calcId] && row[calcId] > 0);
        });
      }
    }

    return filtered;
  }, [calculatedData, activeFilters, stableDateSettings, allNumericFieldIds, stableCalculations, safeConfig.filters]);

  // --- summaryData ---
  const summaryData = useMemo(() => {
    if (!filteredData.length) return {};

    const summary = {};

    // 重複を除去して合計
    const uniqueNumericFieldIds = [...new Set(numericFieldIds)];

    filteredData.forEach(row => {
      uniqueNumericFieldIds.forEach(fieldId => {
        summary[fieldId] = (summary[fieldId] || 0) + (row[fieldId] || 0);
      });
    });

    // 計算順序を正しく並び替え
    const constantCalcs = (stableCalculations || []).filter(c => c.type === 'constant');
    const relationCalcs = (stableCalculations || []).filter(c => c.type === 'relation');
    const conditionalCountCalcs = (stableCalculations || []).filter(c => c.type === 'conditionalCount');
    const arithmeticCalcs = (stableCalculations || []).filter(c => c.type === 'arithmetic');

    // 四則演算の依存関係をソート
    const sortArithmeticByDep = (calcs) => {
      const allCalcIds = new Set((stableCalculations || []).map(c => c.id));
      const sorted = [];
      const remaining = [...calcs];
      const processed = new Set();
      for (let pass = 0; pass < 10 && remaining.length > 0; pass++) {
        const toRemove = [];
        for (let i = 0; i < remaining.length; i++) {
          const calc = remaining[i];
          const deps = calc.terms
            ? calc.terms.map(t => t.field).filter(f => allCalcIds.has(f))
            : [calc.fieldA, calc.fieldB].filter(f => f && allCalcIds.has(f));
          if (deps.every(dep => processed.has(dep) || !arithmeticCalcs.some(a => a.id === dep))) {
            sorted.push(calc);
            processed.add(calc.id);
            toRemove.push(i);
          }
        }
        for (let i = toRemove.length - 1; i >= 0; i--) remaining.splice(toRemove[i], 1);
      }
      sorted.push(...remaining);
      return sorted;
    };

    const orderedCalcs = [...constantCalcs, ...relationCalcs, ...conditionalCountCalcs, ...sortArithmeticByDep(arithmeticCalcs)];

    orderedCalcs.forEach(calc => {
      if (calc.type === 'constant') {
        summary[calc.id] = calc.constantValue;
      } else if (calc.type === 'arithmetic') {
        let res = 0;
        if (calc.terms && calc.terms.length > 0) {
          res = summary[calc.terms[0].field] || 0;
          for (let i = 1; i < calc.terms.length; i++) {
            const term = calc.terms[i];
            const val = summary[term.field] || 0;
            if (term.operator === '+') res += val;
            else if (term.operator === '-') res -= val;
            else if (term.operator === '*') res *= val;
            else if (term.operator === '/') res = val !== 0 ? res / val : 0;
          }
        } else {
          const a = summary[calc.fieldA] || 0;
          const b = summary[calc.fieldB] || 0;
          if (calc.operator === '+') res = a + b;
          else if (calc.operator === '-') res = a - b;
          else if (calc.operator === '*') res = a * b;
          else if (calc.operator === '/') res = b !== 0 ? a / b : 0;
        }

        const decimals = calc.decimals ?? (calc.format === 'percent' ? 2 : 2);
        if (calc.format === 'percent') summary[calc.id] = parseFloat((res * 100).toFixed(decimals));
        else if (calc.format === 'integer') summary[calc.id] = Math.round(res);
        else summary[calc.id] = parseFloat(res.toFixed(decimals));

      } else if (calc.type === 'relation') {
        summary[calc.id] = filteredData.reduce((sum, row) => sum + (row[calc.id] || 0), 0);

      } else if (calc.type === 'conditionalCount') {
        summary[calc.id] = filteredData.reduce((sum, row) => sum + (row[calc.id] || 0), 0);
      }
    });

    return summary;
  }, [filteredData, numericFieldIds, stableCalculations]);

  // --- 再計算トリガー（データ再取得なし、計算のみ再実行） ---
  const triggerRecalculation = useCallback(() => {
    completedHashRef.current = null;
    // キャッシュ削除（useEffectのキャッシュチェックを通過させる）
    setCalculatedDataCacheRef.current(prev => {
      const c = { ...prev };
      delete c[dashboardId];
      return c;
    });
    setRecalcTrigger(prev => prev + 1);
  }, [dashboardId]);

  // --- 計算中断関数 ---
  const cancelCalculation = () => {
    // Web Workerを終了
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    // キャンセルフラグを設定
    if (calcAbortRef.current) {
      calcAbortRef.current.cancelled = true;
    }
    // 状態をクリア
    setIsCalculating(false);
    setCalcProgress(0);
    setIsLoading(false);
    setIsBackgroundRefreshing(false);
    setGlobalLoadingMessage('');
  };

  // --- 戻り値 ---
  return {
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
  };
};

export default useAnalyticsData;
