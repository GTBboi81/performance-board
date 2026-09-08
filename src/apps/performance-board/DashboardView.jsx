// src/apps/performance-board/DashboardView.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import ComparisonTable from './components/ComparisonTable';
import PivotTable from './components/PivotTable';
import VendorPivotTable from './components/VendorPivotTable';
import DataTable from './components/DataTable';
import DashboardHeader from './components/DashboardHeader';
import FilterCard from './components/FilterCard';
import KpiSection from './components/KpiSection';
import RankingCard from './components/RankingCard';
import HeadingCard from './components/HeadingCard';
import { DEFAULT_DATA_TABLES, DEFAULT_PIVOT_TABLES, DEFAULT_COMPARISON_TABLES, DEFAULT_VENDOR_PIVOT_TABLES } from '../../constants';
import { getStoragePrefix } from '../../utils';
import { createFormulaHelpers } from './utils';
import { getDefaultFilters } from './utils/dateFilters';
import { formatDateForInput } from './utils';

const ChartSection = React.lazy(() => import('./components/ChartSection'));

const DashboardView = ({
  glassClass,
  allRows,
  filteredRows,
  config,
  filters,
  activeFilters,
  setActiveFilters,
  systemFields,
  calculations,
  isLoading,
  isConnected,
  error,
  onRefresh,
  onCancelFetch,
  lastUpdated,
  theme = 'dark',
  sourceCache = {},
  saveFilters,
  clearSavedFilters,
  hasSavedFilters = false,
  setIsFilterApplying,
  cacheStatus = 'none',
  serverCacheInfo = {},
  onCacheRebuild,
  onColumnColorsChange,
  onColumnAliasChange,
  onVisibleEmployeeIdsChange,
  onStickyColumnsChange,
  onMaxHeightChange,
  onFontSizeChange,
  onHeaderFontSizeChange,
  onSummaryFontSizeChange,
  onDataFontSizeChange,
  onDataRowHeightChange,
  onHeaderRowHeightChange,
  onSummaryRowHeightChange,
  onColumnWidthsChange,
  onComparisonTableConfigChange,
  onVendorPivotMetricColorsChange,
  onVendorPivotTableFilterChange,
  onCalculationsChange,
  onDataTableSettingsChange,
  onAddDataTable,
  onDeleteDataTable,
  onRecalculate,
  user,
  columnWarnings = [],
  onToggleMobileSubSidebar,
  mobileSubSidebarOpen = false,
  summaryData = {},
}) => {
  const isViewer = user?.role === 'viewer';
  const [draftFilters, setDraftFilters] = useState(activeFilters);
  const [isApplyingLocal, setIsApplyingLocal] = useState(false);
  const dataTables = config.dataTables || DEFAULT_DATA_TABLES;
  const pivotTables = config.pivotTables || DEFAULT_PIVOT_TABLES;
  const comparisonTables = config.comparisonTables || DEFAULT_COMPARISON_TABLES;
  const vendorPivotTables = config.vendorPivotTables || DEFAULT_VENDOR_PIVOT_TABLES;
  const chartConfigs = config.chartConfigs || [];
  const rankingCards = config.rankingCards || [];
  const headingCards = config.headingCards || [];
  const compositeCards = config.compositeCards || [];

  const dashboardId = config.id || 'default';

  useEffect(() => {
    setDraftFilters(activeFilters);
    setIsApplyingLocal(false);
    // フィルター適用完了後にローディングを解除
    if (setIsFilterApplying) {
      setIsFilterApplying(false);
    }
  }, [activeFilters, setIsFilterApplying]);

  // draftFiltersと保存済みフィルターを比較して保存済み表示を制御
  // hasSavedFilters（親からのfilterSaved）を依存に含め、保存/クリア操作後に再評価する
  const computedHasSavedFilters = useMemo(() => {
    try {
      const key = `${getStoragePrefix()}filters_${dashboardId}`;
      const savedJson = localStorage.getItem(key);
      if (!savedJson) return false;
      const saved = JSON.parse(savedJson);
      // 内部キー（_exclude等）を除外して比較
      const getUserValues = (filters) => {
        if (!filters) return {};
        const result = {};
        for (const k of Object.keys(filters)) {
          if (!k.startsWith('_')) result[k] = filters[k];
        }
        return result;
      };
      return JSON.stringify(getUserValues(draftFilters)) === JSON.stringify(getUserValues(saved));
    } catch {
      return false;
    }
  }, [draftFilters, dashboardId, hasSavedFilters]);

  const applyFilters = (overrideFilters) => {
    // onClick から呼ばれた場合、overrideFilters に MouseEvent が入るのを防ぐ
    const filtersToApply = (overrideFilters && !(overrideFilters instanceof Event) && typeof overrideFilters === 'object' && !overrideFilters.nativeEvent) ? overrideFilters : draftFilters;
    setIsApplyingLocal(true);
    // 親コンポーネントのローディング状態も更新
    if (setIsFilterApplying) {
      setIsFilterApplying(true);
    }
    // 次のフレームでフィルターを適用（UIの更新を先に行うため）
    setTimeout(() => {
      setActiveFilters(filtersToApply);
      // フィルターが変わらなかった場合でもローディングを解除するためのフォールバック
      setTimeout(() => {
        setIsApplyingLocal(false);
        if (setIsFilterApplying) {
          setIsFilterApplying(false);
        }
      }, 100);
    }, 50);
  };
  // フィルターリセット（デフォルトの日付範囲と除外フィルターは維持）→ 自動適用
  const resetFilters = () => {
    const newFilters = getDefaultFilters(config.defaultFilters || {});
    setDraftFilters(newFilters);
    // リセット後に自動適用
    setIsApplyingLocal(true);
    if (setIsFilterApplying) {
      setIsFilterApplying(true);
    }
    setTimeout(() => {
      setActiveFilters(newFilters);
      setTimeout(() => {
        setIsApplyingLocal(false);
        if (setIsFilterApplying) {
          setIsFilterApplying(false);
        }
      }, 100);
    }, 50);
  };

  const getFilterOptions = (targetField) => {
    // ★ allRows（フィルター適用前）から選択肢を生成し、フィルター適用中でも全選択肢を表示
    const quickDateMode = draftFilters._quickDateMode;
    const filterDef = filters.find(f => f.field === targetField);
    const overrideField = (quickDateMode === 'lastMonth' && filterDef?.lastMonthField)
      ? filterDef.lastMonthField : null;
    const baseData = allRows || [];

    const uniqueValues = [...new Set(baseData.map(row => {
      let val;
      if (overrideField) {
        val = row[overrideField];
        if (val === undefined || val === null || val === '') val = row[targetField];
      } else {
        val = row[targetField];
      }
      if (val === undefined || val === null || val === '') return '(空白)';
      return val;
    }))]
      .filter(val => val !== undefined)
      .sort((a, b) => {
        if (a === '(空白)') return 1;
        if (b === '(空白)') return -1;
        return String(a).localeCompare(String(b), 'ja');
      });

    return uniqueValues;
  };

  // 月範囲ヘルパー（-1=先月, 0=今月）
  const getMonthRange = (offset) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
    return { start: formatDateForInput(start), end: formatDateForInput(end) };
  };
  const currentDateRange = (typeof draftFilters.date === 'object' && draftFilters.date) || {};
  const lastMonthRange = getMonthRange(-1);
  const thisMonthRange = getMonthRange(0);
  const isLastMonth = currentDateRange.start === lastMonthRange.start && currentDateRange.end === lastMonthRange.end;
  const isThisMonth = currentDateRange.start === thisMonthRange.start && currentDateRange.end === thisMonthRange.end;

  const handleQuickDate = (offset) => {
    const isActive = offset === -1 ? isLastMonth : isThisMonth;
    if (isActive) {
      resetFilters();
      return;
    }
    const range = getMonthRange(offset);
    const newFilters = { ...draftFilters, date: range, _quickDateMode: offset === -1 ? 'lastMonth' : null };
    setDraftFilters(newFilters);
    applyFilters(newFilters);
  };

  // 計算式ヘルパー関数を生成
  const { getFormulaInfo } = createFormulaHelpers({ systemFields, calculations, config });
  const hasCalculationWarnings = columnWarnings.some(w => w.type?.startsWith('calculation-'));

  return (
    <div className="space-y-4">
      <DashboardHeader
        theme={theme}
        isConnected={isConnected}
        allRows={allRows}
        error={error}
        lastUpdated={lastUpdated}
        isLoading={isLoading}
        onCancelFetch={onCancelFetch}
        onRefresh={user?.isGuest ? undefined : onRefresh}
        glassClass={glassClass}
        onRecalculate={onRecalculate}
        serverCacheInfo={serverCacheInfo}
        onCacheRebuild={user?.isGuest ? undefined : onCacheRebuild}
        hasServerCache={config?.dataSources?.some(s => s.serverCacheEnabled)}
        onToggleMobileSubSidebar={onToggleMobileSubSidebar}
        mobileSubSidebarOpen={mobileSubSidebarOpen}
      />

      <FilterCard
        filters={filters}
        draftFilters={draftFilters}
        setDraftFilters={setDraftFilters}
        activeFilters={activeFilters}
        getFilterOptions={getFilterOptions}
        glassClass={glassClass}
        theme={theme}
        onQuickDate={handleQuickDate}
        isLastMonth={isLastMonth}
        isThisMonth={isThisMonth}
        resetFilters={resetFilters}
        saveFilters={saveFilters}
        clearSavedFilters={clearSavedFilters}
        applyFilters={() => applyFilters(draftFilters)}
        isApplyingLocal={isApplyingLocal}
        isLoading={isLoading}
        hasSavedFilters={computedHasSavedFilters}
        filtersApplied={(() => { try { return JSON.stringify(draftFilters) === JSON.stringify(activeFilters); } catch { return false; } })()}
      />

      {error && <div className="p-4 bg-rose-500/20 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-500"><AlertCircle className="shrink-0" size={20} /><div><span className="font-bold">エラー: </span><span className="opacity-90">{typeof error === 'object' ? error.message || JSON.stringify(error) : error}</span></div></div>}

      {columnWarnings.length > 0 && (
        <div className="p-4 bg-amber-500/20 border border-amber-500/30 rounded-xl flex items-start gap-3 text-amber-400">
          <AlertTriangle className="shrink-0 mt-0.5" size={20} />
          <div>
            <span className="font-bold">{hasCalculationWarnings ? '設定・計算の警告: ' : 'カラム参照の不整合: '}</span>
            <span className="opacity-90">
              {hasCalculationWarnings
                ? '以下の設定を確認してください。'
                : '以下のカラムがデータソースに見つかりません。設定画面で再マッピングしてください。'}
            </span>
            <ul className="mt-2 text-xs space-y-1 opacity-80">
              {columnWarnings.map((w, i) => (
                <li key={i}>
                  ・{w.message || `[${w.sourceName}] 「${w.columnName}」 (${w.type === 'mapping' ? `フィールド: ${w.fieldId}` : w.type === 'calculation' ? `計算: ${w.label}` : w.type})`}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* レイアウト順序に従ったセクション表示 */}
      {(() => {
        const layoutOrder = config.layoutOrder || [];

        // 横並びグループをレンダリング
        const renderRow = (items) => {
          if (!items || items.length === 0) return null;

          // 旧形式（chartIdの配列）は chart 削除により非対応
          const getRowItemWidthClass = (item) => {
            const { type: itemType, refId } = item;
            let width = item.width || 'third';
            if (itemType === 'dataTable') width = dataTables.find(t => t.id === refId)?.width || 'full';
            else if (itemType === 'comparisonTable') width = comparisonTables.find(t => t.id === refId)?.width || 'full';
            else if (itemType === 'vendorPivotTable') width = vendorPivotTables.find(t => t.id === refId)?.width || 'full';
            else if (itemType === 'pivotTable') width = pivotTables.find(t => t.id === refId)?.width || width;
            else if (itemType === 'chart') width = chartConfigs.find(t => t.id === refId)?.width || width;
            else if (itemType === 'kpiSection') width = config.sections?.find(t => t.id === refId)?.width || width;
            else if (itemType === 'ranking') width = rankingCards.find(t => t.id === refId)?.width || width;
            else if (itemType === 'heading') width = headingCards.find(t => t.id === refId)?.width || width;
            const widthClasses = {
              full: 'w-full',
              twoThird: 'w-full lg:w-[calc(66.666%-5.33px)]',
              half: 'w-full md:w-[calc(50%-8px)]',
              third: 'w-full md:w-[calc(50%-8px)] lg:w-[calc(33.333%-10.67px)]',
              quarter: 'w-full sm:w-[calc(50%-8px)] lg:w-[calc(25%-12px)]',
            };
            return widthClasses[width] || widthClasses.third;
          };

          const renderedItems = items.map((item, idx) => {
            const rowItem = typeof item === 'string' ? { type: 'chart', refId: item } : item;
            const widthClass = getRowItemWidthClass(rowItem);
            if (rowItem.type === 'dataTable') {
              const tableConfig = dataTables.find(t => t.id === rowItem.refId);
              if (!tableConfig) return null;
              return <div key={`row_dt_${rowItem.refId}_${idx}`} className={widthClass}>{renderDataTable({ ...tableConfig, width: 'full' })}</div>;
            }
            if (rowItem.type === 'comparisonTable') {
              const tableConfig = comparisonTables.find(t => t.id === rowItem.refId);
              if (!tableConfig || !tableConfig.enabled) return null;
              return <div key={`row_ct_${rowItem.refId}_${idx}`} className={widthClass}>{renderComparisonTable({ ...tableConfig, width: 'full' })}</div>;
            }
            if (rowItem.type === 'vendorPivotTable') {
              const cfg = vendorPivotTables.find(t => t.id === rowItem.refId);
              if (!cfg || !cfg.enabled) return null;
              return <div key={`row_vp_${rowItem.refId}_${idx}`} className={widthClass}><VendorPivotTable tableConfig={{ ...cfg, width: 'full' }} sourceCache={sourceCache} dataSources={config.dataSources || []} glassClass={glassClass} theme={theme} activeFilters={activeFilters} onMetricColorsChange={onVendorPivotMetricColorsChange} onTableFilterChange={onVendorPivotTableFilterChange} isViewer={isViewer} /></div>;
            }
            if (rowItem.type === 'pivotTable') {
              const cfg = pivotTables.find(t => t.id === rowItem.refId);
              if (!cfg) return null;
              return <div key={`row_pt_${rowItem.refId}_${idx}`} className={widthClass}><PivotTable pivotConfig={{ ...cfg, width: 'full' }} sourceCache={sourceCache} dataSources={config.dataSources || []} glassClass={glassClass} theme={theme} /></div>;
            }
            if (rowItem.type === 'kpiSection') {
              return <div key={`row_kpi_${rowItem.refId}_${idx}`} className={widthClass}>{renderKpiSection(config.sections?.find(t => t.id === rowItem.refId), 'full')}</div>;
            }
            if (rowItem.type === 'chart') {
              return <div key={`row_chart_${rowItem.refId}_${idx}`} className={widthClass}>{renderChart(chartConfigs.find(t => t.id === rowItem.refId), 'full')}</div>;
            }
            if (rowItem.type === 'ranking') {
              return <div key={`row_ranking_${rowItem.refId}_${idx}`} className={widthClass}>{renderRanking(rankingCards.find(t => t.id === rowItem.refId), 'full')}</div>;
            }
            if (rowItem.type === 'heading') {
              return <div key={`row_heading_${rowItem.refId}_${idx}`} className={widthClass}>{renderHeading(headingCards.find(t => t.id === rowItem.refId), 'full')}</div>;
            }
            return null;
          }).filter(Boolean);

          if (renderedItems.length === 0) return null;
          return <>{renderedItems}</>;
        };

        // データテーブルをレンダリング
        const renderDataTable = (tableConfig) => {
          if (!tableConfig) return null;
          return (
            <DataTable tableConfig={tableConfig} allRows={filteredRows} systemFields={systemFields} calculations={calculations} glassClass={glassClass} aggregationConfigs={config.aggregationConfigs || []} theme={theme} sourceCache={sourceCache} dataSources={config.dataSources || []} activeFilters={activeFilters} mapping={config.mapping || {}} setIsFilterApplying={setIsFilterApplying} onColumnColorsChange={onColumnColorsChange} onColumnAliasChange={onColumnAliasChange} onVisibleEmployeeIdsChange={onVisibleEmployeeIdsChange} onStickyColumnsChange={onStickyColumnsChange} onMaxHeightChange={onMaxHeightChange} onFontSizeChange={onFontSizeChange} onHeaderFontSizeChange={onHeaderFontSizeChange} onSummaryFontSizeChange={onSummaryFontSizeChange} onDataFontSizeChange={onDataFontSizeChange} onDataRowHeightChange={onDataRowHeightChange} onHeaderRowHeightChange={onHeaderRowHeightChange} onSummaryRowHeightChange={onSummaryRowHeightChange} onColumnWidthsChange={onColumnWidthsChange} indicatorGroups={config.indicatorGroups || []} user={user} filters={filters} getFormulaInfo={getFormulaInfo} onCalculationsChange={onCalculationsChange} onDataTableSettingsChange={(updates) => onDataTableSettingsChange?.(tableConfig.id, updates)} onDeleteDataTable={() => onDeleteDataTable?.(tableConfig.id)} />
          );
        };

        // 比較テーブルをレンダリング
        const renderComparisonTable = (tableConfig) => {
          if (!tableConfig || !tableConfig.enabled) return null;

          const handleComparisonConfigChange = (changes) => {
            if (onComparisonTableConfigChange) {
              onComparisonTableConfigChange(tableConfig.id, changes);
            }
          };

          return (
            <ComparisonTable
              key={tableConfig.id}
              tableConfig={tableConfig}
              filteredData={filteredRows}
              systemFields={systemFields}
              calculations={calculations}
              theme={theme}
              glassClass={glassClass}
              onConfigChange={handleComparisonConfigChange}
            />
          );
        };

        const renderKpiSection = (section, width) => {
          if (!section) return null;
          return <KpiSection section={{ ...section, width: width || section.width }} allCards={[...(systemFields || []), ...(calculations || []), ...compositeCards]} systemFields={systemFields || []} calculations={calculations || []} kpiValues={summaryData} glassClass={glassClass} theme={theme} />;
        };

        const renderChart = (chartConfig, width) => {
          if (!chartConfig) return null;
          return <React.Suspense fallback={<div className={`w-full rounded-2xl p-4 ${glassClass}`}>グラフを読み込み中...</div>}><ChartSection chartConfig={{ ...chartConfig, width: width || chartConfig.width }} data={filteredRows} systemFields={systemFields || []} calculations={calculations || []} sourceCache={sourceCache} dataSources={config.dataSources || []} glassClass={glassClass} theme={theme} /></React.Suspense>;
        };

        const renderRanking = (rankingConfig, width) => {
          if (!rankingConfig) return null;
          return <RankingCard {...rankingConfig} width={width || rankingConfig.width} data={filteredRows} calculations={config.calculations || []} systemFields={systemFields || []} glassClass={glassClass} theme={theme} />;
        };

        const renderHeading = (headingConfig, width) => {
          if (!headingConfig) return null;
          return <HeadingCard {...headingConfig} width={width || headingConfig.width} theme={theme} />;
        };

        // layoutOrderが空の場合、デフォルト表示
        if (layoutOrder.length === 0) {
          return (
            <>
              {/* 全データテーブル */}
              <div className="flex flex-wrap gap-3">
                {dataTables.map((tableConfig) => (
                  <DataTable key={tableConfig.id} tableConfig={tableConfig} allRows={filteredRows} systemFields={systemFields} calculations={calculations} glassClass={glassClass} aggregationConfigs={config.aggregationConfigs || []} theme={theme} sourceCache={sourceCache} dataSources={config.dataSources || []} activeFilters={activeFilters} mapping={config.mapping || {}} setIsFilterApplying={setIsFilterApplying} onColumnColorsChange={onColumnColorsChange} onColumnAliasChange={onColumnAliasChange} onVisibleEmployeeIdsChange={onVisibleEmployeeIdsChange} onStickyColumnsChange={onStickyColumnsChange} onMaxHeightChange={onMaxHeightChange} onFontSizeChange={onFontSizeChange} onHeaderFontSizeChange={onHeaderFontSizeChange} onSummaryFontSizeChange={onSummaryFontSizeChange} onDataFontSizeChange={onDataFontSizeChange} onDataRowHeightChange={onDataRowHeightChange} onHeaderRowHeightChange={onHeaderRowHeightChange} onSummaryRowHeightChange={onSummaryRowHeightChange} onColumnWidthsChange={onColumnWidthsChange} indicatorGroups={config.indicatorGroups || []} getFormulaInfo={getFormulaInfo} user={user} onCalculationsChange={onCalculationsChange} onDataTableSettingsChange={(updates) => onDataTableSettingsChange?.(tableConfig.id, updates)} onDeleteDataTable={() => onDeleteDataTable?.(tableConfig.id)} />
                ))}
              </div>
              {/* + テーブルを追加ボタン */}
              {!isViewer && (
                <div className="flex justify-center py-4">
                  <button
                    onClick={() => {
                      const newId = `table_${(typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
                      const newTable = {
                        id: newId,
                        name: '新しいテーブル',
                        fields: [],
                        aggregationConfigId: config.aggregationConfigs?.[0]?.id || '',
                        width: 'full',
                        maxHeight: 600,
                      };
                      onAddDataTable?.(newTable);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg border transition-colors
                      ${theme === 'dark'
                        ? 'border-white/20 text-white/50 hover:border-indigo-400 hover:text-indigo-400 hover:bg-indigo-400/5'
                        : 'border-gray-300 text-gray-500 hover:border-indigo-500 hover:text-indigo-500 hover:bg-indigo-50'
                      }`}
                  >
                    + テーブルを追加
                  </button>
                </div>
              )}
              {/* ピボット集計テーブル */}
              {pivotTables.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {pivotTables.map((pivotConfig) => (
                    <PivotTable key={pivotConfig.id} pivotConfig={pivotConfig} sourceCache={sourceCache} dataSources={config.dataSources || []} glassClass={glassClass} theme={theme} />
                  ))}
                </div>
              )}
              {/* 比較テーブル */}
              {comparisonTables.filter(t => t.enabled).length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {comparisonTables.map((tableConfig) => renderComparisonTable(tableConfig))}
                </div>
              )}
              {/* クロス集計テーブル */}
              {vendorPivotTables.filter(t => t.enabled).length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {vendorPivotTables.filter(t => t.enabled).map((cfg) => (
                    <VendorPivotTable key={cfg.id} tableConfig={cfg} sourceCache={sourceCache} dataSources={config.dataSources || []} glassClass={glassClass} theme={theme} activeFilters={activeFilters} onMetricColorsChange={onVendorPivotMetricColorsChange} onTableFilterChange={onVendorPivotTableFilterChange} isViewer={isViewer} />
                  ))}
                </div>
              )}
            </>
          );
        }

        // layoutOrderに従って表示（flex-wrapでサイズ設定を反映）
        return (
          <div className="flex flex-wrap gap-3">
            {layoutOrder
              .filter(item => item.visible !== false)
              .map(item => {
                switch (item.type) {
                  case 'row': {
                    return <div key={item.id} className="w-full flex flex-wrap gap-3">{renderRow(item.items || [])}</div>;
                  }
                  case 'dataTable': {
                    const tableConfig = dataTables.find(t => t.id === item.refId);
                    return <React.Fragment key={item.id}>{renderDataTable(tableConfig && { ...tableConfig, width: item.width || tableConfig.width })}</React.Fragment>;
                  }
                  case 'comparisonTable': {
                    const tableConfig = comparisonTables.find(t => t.id === item.refId);
                    return <React.Fragment key={item.id}>{renderComparisonTable(tableConfig && { ...tableConfig, width: item.width || tableConfig.width })}</React.Fragment>;
                  }
                  case 'kpiSection': {
                    const section = config.sections?.find(s => s.id === item.refId);
                    return <React.Fragment key={item.id}>{renderKpiSection(section, item.width)}</React.Fragment>;
                  }
                  case 'chart': {
                    const chartConfig = chartConfigs.find(chart => chart.id === item.refId);
                    return <React.Fragment key={item.id}>{renderChart(chartConfig, item.width)}</React.Fragment>;
                  }
                  case 'ranking': {
                    const rankingConfig = rankingCards.find(card => card.id === item.refId);
                    return <React.Fragment key={item.id}>{renderRanking(rankingConfig, item.width)}</React.Fragment>;
                  }
                  case 'heading': {
                    const headingConfig = headingCards.find(card => card.id === item.refId);
                    return <React.Fragment key={item.id}>{renderHeading(headingConfig, item.width)}</React.Fragment>;
                  }
                  case 'pivotTable': {
                    const pivotConfig = pivotTables.find(p => p.id === item.refId);
                    if (!pivotConfig) return null;
                    return <PivotTable key={item.id} pivotConfig={{ ...pivotConfig, width: item.width || pivotConfig.width }} sourceCache={sourceCache} dataSources={config.dataSources || []} glassClass={glassClass} theme={theme} />;
                  }
                  case 'vendorPivotTable': {
                    const vendorPivotConfig = vendorPivotTables.find(p => p.id === item.refId);
                    if (!vendorPivotConfig || !vendorPivotConfig.enabled) return null;
                    return <VendorPivotTable key={item.id} tableConfig={{ ...vendorPivotConfig, width: item.width || vendorPivotConfig.width }} sourceCache={sourceCache} dataSources={config.dataSources || []} glassClass={glassClass} theme={theme} activeFilters={activeFilters} onMetricColorsChange={onVendorPivotMetricColorsChange} onTableFilterChange={onVendorPivotTableFilterChange} isViewer={isViewer} />;
                  }
                  default:
                    return null;
                }
              })}
          </div>
        );
      })()}
    </div>
  );
};

export default DashboardView;
