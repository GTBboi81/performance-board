// src/apps/performance-board/components/VendorPivotTable.jsx
// クロス集計テーブルコンポーネント（動的幅計算）

import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Grid3X3, ChevronDown, X } from 'lucide-react';
import { useVendorPivotData } from '../hooks/useVendorPivotData';
import { formatMetricValue, transformDateByGranularity, getMonthSortKey } from '../utils/vendorPivotUtils';
import { PRESET_COLORS, HEIGHT_UNITS } from '../../../constants';

const VendorPivotTable = React.memo(({
  tableConfig,
  sourceCache = {},
  dataSources = [],
  theme = 'dark',
  glassClass = '',
  activeFilters = {},
  onMetricColorsChange,
  onTableFilterChange,
  isViewer = false,
}) => {
  // Refs
  const containerRef = useRef(null);
  const headerRef = useRef(null);
  const bodyRef = useRef(null);

  // State
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const [metricColors, setMetricColors] = useState(tableConfig.metricColors || {});
  const [colorPickerOpen, setColorPickerOpen] = useState(null); // metricId or null
  const [colorPickerPosition, setColorPickerPosition] = useState({ top: 0, left: 0 });

  // metricColorsをtableConfigから同期
  useEffect(() => {
    setMetricColors(tableConfig.metricColors || {});
  }, [tableConfig.metricColors]);

  // テーマ別スタイル
  const textClass = theme === 'dark' ? 'text-white' : 'text-gray-800';
  const subTextClass = theme === 'dark' ? 'text-white/60' : 'text-gray-600';
  const borderClass = theme === 'dark' ? 'border-white/5' : 'border-gray-100';
  const headerBorderClass = theme === 'dark' ? 'border-white/10' : 'border-gray-200';
  const headerBg = theme === 'dark' ? 'bg-[#0f172a]' : 'bg-gray-100';
  const summaryBg = theme === 'dark' ? 'bg-gray-700' : 'bg-[#eeeeee]';
  const summaryBorder = theme === 'dark' ? 'border-gray-600' : 'border-gray-300';
  const rowHoverBg = theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50';

  // ソースデータを取得
  const sourceId = tableConfig.sourceId;
  const sourceRows = sourceCache[sourceId] || [];
  const sourceConfig = dataSources.find(s => s.id === sourceId);
  const headers = sourceConfig?.headers || [];

  // テーブル専用フィルター
  const tableFilters = tableConfig.tableFilters || [];
  const tableFilterValues = tableConfig.tableFilterValues || {};
  const [openFilterId, setOpenFilterId] = useState(null);

  // フィルターのユニーク値を取得
  const getFilterOptions = useCallback((fieldName, filterType) => {
    if (!sourceRows.length || !fieldName) return [];
    const fieldIndex = headers.indexOf(fieldName);
    if (fieldIndex === -1) return [];

    // 月別フィルターの場合
    if (filterType === 'dateMonth') {
      const monthSet = new Set();
      sourceRows.forEach(row => {
        const value = row[fieldIndex];
        if (value === null || value === undefined || value === '') return;

        // 日付を月形式に変換
        const monthStr = transformDateByGranularity(value, 'month');
        if (monthStr) {
          monthSet.add(monthStr);
        }
      });

      // 月でソート（古い順）
      return Array.from(monthSet).sort((a, b) => {
        const keyA = getMonthSortKey(a);
        const keyB = getMonthSortKey(b);
        return keyA - keyB;
      });
    }

    // 通常フィルター（既存ロジック）
    const uniqueValues = new Set();
    sourceRows.forEach(row => {
      const value = row[fieldIndex];
      if (value !== null && value !== undefined && value !== '') {
        uniqueValues.add(String(value));
      }
    });
    return Array.from(uniqueValues).sort((a, b) => String(a).localeCompare(String(b), 'ja'));
  }, [sourceRows, headers]);

  // フィルター値の変更ハンドラ
  const handleFilterChange = useCallback((filterId, values) => {
    if (onTableFilterChange) {
      onTableFilterChange(tableConfig.id, filterId, values);
    }
  }, [tableConfig.id, onTableFilterChange]);

  // 設定値
  const showMetricHeader = tableConfig.showMetricHeader !== false;
  const rowGranularity = tableConfig.rowGranularity || 'month';

  // 条件グループを取得（デフォルト: 単一グループ）
  const conditionGroups = useMemo(() => {
    if (tableConfig.conditionGroups && tableConfig.conditionGroups.length > 0) {
      return tableConfig.conditionGroups;
    }
    // デフォルトグループ（フィルターなし）
    return [{ id: '_default', label: '', conditions: [] }];
  }, [tableConfig.conditionGroups]);

  const hasConditionGroups = conditionGroups.length > 1 || conditionGroups[0].id !== '_default';

  // データ集計フックを使用
  const { pivotData, vendors, totalRow } = useVendorPivotData({
    sourceData: sourceRows,
    headers,
    rowField: tableConfig.rowField,
    columnField: tableConfig.columnField,
    metrics: tableConfig.metrics || [],
    sortOrder: tableConfig.sortOrder || 'desc',
    showTotalRow: tableConfig.showTotalRow !== false,
    activeFilters,
    filterMappings: tableConfig.filterMappings || {},
    rowGranularity,
    conditionGroups,
    tableFilters,
    tableFilterValues,
    conditionLogic: tableConfig.conditionLogic || 'AND',
  });

  // 幅クラス
  const widthClass = {
    'full': 'w-full',
    'twoThird': 'w-full lg:w-[calc(66.666%-0.5rem)]',
    'half': 'w-full lg:w-[calc(50%-0.5rem)]',
    'third': 'w-full lg:w-[calc(33.333%-0.5rem)]',
  }[tableConfig.width] || 'w-full';

  // 高さ計算
  const heightValue = HEIGHT_UNITS[tableConfig.height] || HEIGHT_UNITS['1.5'];

  // 指標リスト
  const metrics = tableConfig.metrics || [];

  // 行高さ
  const ROW_HEIGHT = 40;

  // 文字幅を概算で計算（全角=2, 半角=1として、1文字約8px）
  const estimateTextWidth = useCallback((text) => {
    if (!text) return 0;
    const str = String(text);
    let width = 0;
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i);
      // 全角文字（CJK, ひらがな, カタカナなど）
      if (charCode > 0x7F) {
        width += 14; // 全角は14px
      } else {
        width += 8; // 半角は8px
      }
    }
    return width + 24; // パディング分を追加
  }, []);

  // 動的列幅の計算（3階層対応: vendor → group → metric）
  const columnWidths = useMemo(() => {
    const BASE_COL_WIDTH = 100; // ベース幅: 1指標あたり100px
    const MIN_COL_WIDTH = 80;
    const MAX_FIRST_COL_WIDTH = 200;

    // 1列目（行ラベル）の幅を計算
    let firstColWidth = estimateTextWidth(tableConfig.rowField || '期間');
    pivotData.forEach(row => {
      const w = estimateTextWidth(row.month);
      if (w > firstColWidth) firstColWidth = w;
    });
    firstColWidth = Math.max(MIN_COL_WIDTH, Math.min(MAX_FIRST_COL_WIDTH, firstColWidth));

    // 各データ列の幅を計算（vendor + group + metric の組み合わせごと）
    const dataColWidths = {};
    vendors.forEach(vendor => {
      conditionGroups.forEach(group => {
        metrics.forEach(metric => {
          const key = `${vendor}-${group.id}-${metric.id}`;

          // ベース幅から開始
          let requiredWidth = BASE_COL_WIDTH;

          // 指標名の幅をチェック（showMetricHeader時）
          if (showMetricHeader) {
            const metricWidth = estimateTextWidth(metric.label);
            if (metricWidth > requiredWidth) requiredWidth = metricWidth;
          }

          // データ値の幅をチェック
          pivotData.forEach(row => {
            const value = hasConditionGroups
              ? row.vendors[vendor]?.[group.id]?.[metric.id]
              : row.vendors[vendor]?.[metric.id];
            const formatted = formatMetricValue(value, metric.format);
            const w = estimateTextWidth(formatted);
            if (w > requiredWidth) requiredWidth = w;
          });

          // 合計行の幅をチェック
          if (totalRow) {
            const value = hasConditionGroups
              ? totalRow.vendors[vendor]?.[group.id]?.[metric.id]
              : totalRow.vendors[vendor]?.[metric.id];
            const formatted = formatMetricValue(value, metric.format);
            const w = estimateTextWidth(formatted);
            if (w > requiredWidth) requiredWidth = w;
          }

          // ベース幅以上なら拡張、それ以外はベース幅
          dataColWidths[key] = Math.max(BASE_COL_WIDTH, requiredWidth);
        });
      });
    });

    // グループヘッダー幅を計算（各グループ内の全指標幅の合計）
    const groupHeaderWidths = {};
    vendors.forEach(vendor => {
      conditionGroups.forEach(group => {
        const groupKey = `${vendor}-${group.id}`;
        const metricsWidthSum = metrics.reduce((sum, metric) => sum + dataColWidths[`${vendor}-${group.id}-${metric.id}`], 0);
        const groupNameWidth = estimateTextWidth(group.label || 'ALL');

        // グループ名が指標幅合計を超える場合、各指標列を均等に拡張
        if (groupNameWidth > metricsWidthSum && metrics.length > 0) {
          const extraPerMetric = Math.ceil((groupNameWidth - metricsWidthSum) / metrics.length);
          metrics.forEach(metric => {
            dataColWidths[`${vendor}-${group.id}-${metric.id}`] += extraPerMetric;
          });
        }

        groupHeaderWidths[groupKey] = metrics.reduce((sum, metric) => sum + dataColWidths[`${vendor}-${group.id}-${metric.id}`], 0);
      });
    });

    // ベンダーヘッダー幅を計算（全グループ分の合計）
    const vendorHeaderWidths = {};
    vendors.forEach(vendor => {
      const groupsWidthSum = conditionGroups.reduce((sum, group) => sum + groupHeaderWidths[`${vendor}-${group.id}`], 0);
      const vendorNameWidth = estimateTextWidth(vendor);

      // ベンダー名がグループ幅合計を超える場合、各グループの各指標列を均等に拡張
      if (vendorNameWidth > groupsWidthSum && conditionGroups.length > 0 && metrics.length > 0) {
        const totalMetricCols = conditionGroups.length * metrics.length;
        const extraPerMetric = Math.ceil((vendorNameWidth - groupsWidthSum) / totalMetricCols);
        conditionGroups.forEach(group => {
          metrics.forEach(metric => {
            dataColWidths[`${vendor}-${group.id}-${metric.id}`] += extraPerMetric;
          });
          // グループ幅を再計算
          groupHeaderWidths[`${vendor}-${group.id}`] = metrics.reduce((sum, metric) => sum + dataColWidths[`${vendor}-${group.id}-${metric.id}`], 0);
        });
      }

      vendorHeaderWidths[vendor] = conditionGroups.reduce((sum, group) => sum + groupHeaderWidths[`${vendor}-${group.id}`], 0);
    });

    return { firstColWidth, dataColWidths, vendorHeaderWidths, groupHeaderWidths };
  }, [vendors, metrics, pivotData, totalRow, estimateTextWidth, tableConfig.rowField, showMetricHeader, conditionGroups, hasConditionGroups]);

  // 列幅取得関数（3階層対応）
  const getColWidth = useCallback((vendor, groupId, metricId) => {
    return columnWidths.dataColWidths[`${vendor}-${groupId}-${metricId}`] || 100;
  }, [columnWidths]);

  // グループヘッダー幅取得関数
  const getGroupHeaderWidth = useCallback((vendor, groupId) => {
    return columnWidths.groupHeaderWidths?.[`${vendor}-${groupId}`] || (metrics.length * 100);
  }, [columnWidths, metrics.length]);

  // ベンダーヘッダー幅取得関数
  const getVendorHeaderWidth = useCallback((vendor) => {
    return columnWidths.vendorHeaderWidths?.[vendor] || (conditionGroups.length * metrics.length * 100);
  }, [columnWidths, conditionGroups.length, metrics.length]);

  // テーブル総幅を計算（3階層対応）
  const totalWidth = useMemo(() => {
    let width = columnWidths.firstColWidth;
    vendors.forEach(vendor => {
      conditionGroups.forEach(group => {
        metrics.forEach(metric => {
          width += getColWidth(vendor, group.id, metric.id);
        });
      });
    });
    return width;
  }, [columnWidths, vendors, conditionGroups, metrics, getColWidth]);

  // スクロール同期
  const handleBodyScroll = useCallback((e) => {
    if (headerRef.current) {
      headerRef.current.scrollLeft = e.target.scrollLeft;
    }
  }, []);

  // スクロールバー幅の計算
  useEffect(() => {
    const bodyContainer = bodyRef.current;
    if (!bodyContainer) return;

    const checkScrollbarWidth = () => {
      const width = bodyContainer.offsetWidth - bodyContainer.clientWidth;
      setScrollbarWidth(width);
    };

    const timer = setTimeout(checkScrollbarWidth, 100);
    const resizeObserver = new ResizeObserver(checkScrollbarWidth);
    resizeObserver.observe(bodyContainer);

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [pivotData.length]);

  // スクロールイベントリスナー
  useEffect(() => {
    const bodyContainer = bodyRef.current;
    if (!bodyContainer) return;

    bodyContainer.addEventListener('scroll', handleBodyScroll);
    return () => bodyContainer.removeEventListener('scroll', handleBodyScroll);
  }, [handleBodyScroll]);

  // 販社カラーを取得
  const getVendorColor = (vendor) => {
    const colorId = tableConfig.vendorColors?.[vendor];
    return colorId ? PRESET_COLORS.find(c => c.id === colorId) : null;
  };

  // ヘッダー背景色を取得
  const getHeaderBgClass = (vendor, level) => {
    const color = getVendorColor(vendor);
    if (color && color.bg) {
      if (level === 1) {
        return theme === 'dark' ? color.bg.dark?.header : color.bg.light?.header;
      }
      return theme === 'dark' ? color.bg.dark?.summary : color.bg.light?.summary;
    }
    return level === 1
      ? (theme === 'dark' ? 'bg-white/10' : 'bg-gray-200')
      : (theme === 'dark' ? 'bg-white/5' : 'bg-gray-100');
  };

  // データセル背景色を取得（指標カラー優先）
  const getCellBgClass = (vendor, metricId) => {
    // 指標カラーを優先
    const metricColorId = metricColors[metricId];
    if (metricColorId) {
      const metricColor = PRESET_COLORS.find(c => c.id === metricColorId);
      if (metricColor?.bg) {
        return theme === 'dark' ? metricColor.bg.dark?.data : metricColor.bg.light?.data;
      }
    }
    // フォールバック: ベンダーカラー
    const color = getVendorColor(vendor);
    if (color && color.bg) {
      return theme === 'dark' ? color.bg.dark?.data : color.bg.light?.data;
    }
    return '';
  };

  // 縦線のスタイルを取得（position: absoluteで上に重ねる）
  const getVerticalBorderStyle = (metricIndex, type = 'data') => {
    const isLastMetric = metricIndex === metrics.length - 1;
    let width, color;

    if (type === 'header') {
      if (isLastMetric) {
        width = '3px';
        color = theme === 'dark' ? 'rgba(255,255,255,0.3)' : '#6b7280'; // gray-500
      } else {
        width = '1px';
        color = theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#d1d5db'; // gray-300
      }
    } else if (type === 'summary') {
      if (isLastMetric) {
        width = '3px';
        color = theme === 'dark' ? '#6b7280' : '#6b7280'; // gray-500
      } else {
        width = '1px';
        color = theme === 'dark' ? '#4b5563' : '#9ca3af'; // gray-600 / gray-400
      }
    } else {
      // data
      if (isLastMetric) {
        width = '3px';
        color = theme === 'dark' ? 'rgba(255,255,255,0.2)' : '#9ca3af'; // gray-400
      } else {
        width = '1px';
        color = theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#d1d5db'; // gray-300
      }
    }

    return { width, color };
  };

  // 指標カラーを取得
  const getMetricColor = (metricId) => {
    const colorId = metricColors[metricId];
    return colorId ? PRESET_COLORS.find(c => c.id === colorId) : null;
  };

  // カラーピッカーのハンドラ
  const handleColorButtonClick = (e, metricId) => {
    e.stopPropagation();
    if (colorPickerOpen === metricId) {
      setColorPickerOpen(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setColorPickerPosition({ top: rect.bottom + 4, left: rect.left });
      setColorPickerOpen(metricId);
    }
  };

  const handleColorSelect = (metricId, colorId) => {
    const newColors = { ...metricColors };
    if (colorId === 'default' || !colorId) {
      delete newColors[metricId];
    } else {
      newColors[metricId] = colorId;
    }
    setMetricColors(newColors);
    setColorPickerOpen(null);
    if (onMetricColorsChange) {
      onMetricColorsChange(tableConfig.id, newColors);
    }
  };

  if (!sourceId || !sourceConfig) {
    return (
      <div className={`${widthClass} ${glassClass} rounded-2xl p-4`}>
        <p className={`text-sm ${subTextClass}`}>
          ソースが設定されていません
        </p>
      </div>
    );
  }

  if (!tableConfig.rowField) {
    return (
      <div className={`${widthClass} ${glassClass} rounded-2xl p-4`}>
        <p className={`text-sm ${subTextClass}`}>
          行軸フィールドが設定されていません
        </p>
      </div>
    );
  }

  // 列軸の有無を判定
  const hasColumnField = !!tableConfig.columnField;

  return (
    <div
      ref={containerRef}
      className={`${widthClass} ${glassClass} rounded-2xl overflow-hidden flex flex-col`}
      style={{ height: heightValue, maxWidth: '100%' }}
    >
      {/* ツールバー */}
      <div className={`p-4 border-b flex flex-wrap justify-between items-center gap-2 ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-gray-300 bg-gray-50'}`}>
        <h3 className={`text-sm font-semibold flex items-center gap-2 ${textClass}`}>
          <Grid3X3 size={16} className="text-indigo-400" />
          {tableConfig.name || 'クロス集計テーブル'}
        </h3>
        <span className={`text-xs ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>
          {pivotData.length} 行
        </span>
      </div>

      {/* テーブル専用フィルター */}
      {tableFilters.length > 0 && (
        <div className={`px-4 py-2 border-b flex flex-wrap items-center gap-3 ${theme === 'dark' ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 bg-gray-50/50'}`}>
          {tableFilters.map(filter => {
            const options = getFilterOptions(filter.field, filter.type);
            const selectedValues = tableFilterValues[filter.id] || [];
            const isOpen = openFilterId === filter.id;
            const isMultiSelect = filter.type === 'multiSelect' || filter.type === 'dateMonth';

            return (
              <div key={filter.id} className="relative">
                <button
                  onClick={() => setOpenFilterId(isOpen ? null : filter.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                    selectedValues.length > 0
                      ? (theme === 'dark' ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-200' : 'border-cyan-400 bg-cyan-50 text-cyan-700')
                      : (theme === 'dark' ? 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50')
                  }`}
                >
                  <span>{filter.label || filter.field}</span>
                  {selectedValues.length > 0 && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${theme === 'dark' ? 'bg-cyan-500/30' : 'bg-cyan-200'}`}>
                      {selectedValues.length}
                    </span>
                  )}
                  <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpenFilterId(null)} />
                    <div className={`absolute top-full left-0 mt-1 min-w-[180px] max-h-64 overflow-auto rounded-lg border shadow-xl z-50 ${theme === 'dark' ? 'border-white/20 bg-slate-800' : 'border-gray-200 bg-white'}`}>
                      {/* クリアボタン */}
                      {selectedValues.length > 0 && (
                        <button
                          onClick={() => {
                            handleFilterChange(filter.id, []);
                            setOpenFilterId(null);
                          }}
                          className={`w-full px-3 py-2 text-xs text-left flex items-center gap-1 border-b ${theme === 'dark' ? 'border-white/10 text-rose-300 hover:bg-rose-500/10' : 'border-gray-100 text-rose-500 hover:bg-rose-50'}`}
                        >
                          <X size={12} /> クリア
                        </button>
                      )}
                      {/* オプション */}
                      {options.map(option => {
                        const isSelected = selectedValues.includes(option);
                        return (
                          <button
                            key={option}
                            onClick={() => {
                              let newValues;
                              if (isMultiSelect) {
                                newValues = isSelected
                                  ? selectedValues.filter(v => v !== option)
                                  : [...selectedValues, option];
                              } else {
                                newValues = isSelected ? [] : [option];
                                setOpenFilterId(null);
                              }
                              handleFilterChange(filter.id, newValues);
                            }}
                            className={`w-full px-3 py-2 text-xs text-left flex items-center gap-2 ${
                              isSelected
                                ? (theme === 'dark' ? 'bg-cyan-500/20 text-cyan-200' : 'bg-cyan-50 text-cyan-700')
                                : (theme === 'dark' ? 'text-white/80 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50')
                            }`}
                          >
                            {isMultiSelect && (
                              <span className={`w-3 h-3 rounded border flex items-center justify-center ${
                                isSelected
                                  ? (theme === 'dark' ? 'border-cyan-400 bg-cyan-500' : 'border-cyan-500 bg-cyan-500')
                                  : (theme === 'dark' ? 'border-white/30' : 'border-gray-300')
                              }`}>
                                {isSelected && <span className="text-white text-[8px]">✓</span>}
                              </span>
                            )}
                            <span className="truncate">{option}</span>
                          </button>
                        );
                      })}
                      {options.length === 0 && (
                        <div className={`px-3 py-2 text-xs ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>
                          選択肢がありません
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ヘッダー（固定） */}
      <div
        ref={headerRef}
        className={`overflow-x-hidden shrink-0 ${headerBg}`}
        style={{ paddingRight: scrollbarWidth }}
      >
        {/* ベンダー名ヘッダー行（列軸ありの場合のみ表示） */}
        {hasColumnField && (
          <div className="flex" style={{ width: totalWidth }}>
            {/* 1列目（空） */}
            <div
              style={{ width: columnWidths.firstColWidth, minWidth: columnWidths.firstColWidth, height: ROW_HEIGHT, position: 'sticky', left: 0, zIndex: 10 }}
              className={`px-3 flex items-center text-xs font-medium whitespace-nowrap border-b border-r ${headerBorderClass} ${textClass} ${headerBg}`}
            >
              {/* 空 */}
            </div>
            {/* 各ベンダー（colspanで全グループ・指標をまとめる） */}
            {vendors.map((vendor) => (
              <div
                key={`vendor-${vendor}`}
                style={{ width: getVendorHeaderWidth(vendor), height: ROW_HEIGHT }}
                className={`px-3 flex items-center justify-center text-sm font-medium whitespace-nowrap overflow-hidden border-b border-r ${headerBorderClass} ${textClass} ${getHeaderBgClass(vendor, 1)}`}
              >
                <span className="truncate">{vendor}</span>
              </div>
            ))}
          </div>
        )}

        {/* 条件グループヘッダー行（hasConditionGroupsの場合のみ表示） */}
        {hasConditionGroups && (
          <div className="flex" style={{ width: totalWidth }}>
            <div
              style={{ width: columnWidths.firstColWidth, minWidth: columnWidths.firstColWidth, height: ROW_HEIGHT, position: 'sticky', left: 0, zIndex: 10 }}
              className={`px-3 flex items-center text-xs whitespace-nowrap border-b border-r ${headerBorderClass} ${subTextClass} ${headerBg}`}
            >
              {/* 空 */}
            </div>
            {vendors.map((vendor) => (
              conditionGroups.map((group) => (
                <div
                  key={`group-${vendor}-${group.id}`}
                  style={{ width: getGroupHeaderWidth(vendor, group.id), height: ROW_HEIGHT }}
                  className={`px-3 flex items-center justify-center text-xs font-medium whitespace-nowrap overflow-hidden border-b border-r ${headerBorderClass} ${textClass} ${getHeaderBgClass(vendor, 2)}`}
                >
                  <span className="truncate">{group.label || 'ALL'}</span>
                </div>
              ))
            ))}
          </div>
        )}

        {/* 指標名ヘッダー行（オプション） */}
        {showMetricHeader && metrics.length > 0 && (
          <div className="flex" style={{ width: totalWidth }}>
            <div
              style={{ width: columnWidths.firstColWidth, minWidth: columnWidths.firstColWidth, height: ROW_HEIGHT, position: 'sticky', left: 0, zIndex: 10 }}
              className={`px-3 flex items-center text-xs whitespace-nowrap border-b border-r ${headerBorderClass} ${subTextClass} ${headerBg}`}
            >
              {/* 空 */}
            </div>
            {vendors.map((vendor) => (
              conditionGroups.map((group, groupIndex) => (
                metrics.map((metric, metricIndex) => {
                  const currentColorId = metricColors[metric.id] || 'default';
                  const currentColor = PRESET_COLORS.find(c => c.id === currentColorId) || PRESET_COLORS[0];
                  const metricBgClass = currentColor?.bg
                    ? (theme === 'dark' ? currentColor.bg.dark?.summary : currentColor.bg.light?.summary)
                    : getHeaderBgClass(vendor, hasConditionGroups ? 3 : 2);
                  const isLastMetricInGroup = metricIndex === metrics.length - 1;
                  const isLastGroup = groupIndex === conditionGroups.length - 1;
                  // グループの最後の指標かつ最後のグループなら太線、それ以外は通常線
                  const vBorder = getVerticalBorderStyle(isLastMetricInGroup && isLastGroup ? metrics.length - 1 : (isLastMetricInGroup ? -2 : metricIndex), 'header');
                  // 横線の色と太さ
                  const hBorderColor = currentColor.hex || (theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e5e7eb');
                  const hBorderWidth = currentColor.hex ? '3px' : '1px';

                  return (
                    <div
                      key={`metric-${vendor}-${group.id}-${metric.id}`}
                      style={{ width: getColWidth(vendor, group.id, metric.id), height: ROW_HEIGHT, position: 'relative' }}
                      className={`px-3 flex items-center justify-center text-xs whitespace-nowrap overflow-hidden ${subTextClass} ${metricBgClass || getHeaderBgClass(vendor, hasConditionGroups ? 3 : 2)}`}
                    >
                      <div className="flex items-center gap-1">
                        {/* カラーピッカードット（閲覧者は非表示、最初のグループのみ表示） */}
                        {!isViewer && groupIndex === 0 && (
                          <button
                            onClick={(e) => handleColorButtonClick(e, metric.id)}
                            className={`w-3 h-3 rounded-full border flex-shrink-0 transition-transform hover:scale-125 ${theme === 'dark' ? 'border-white/30' : 'border-gray-400'}`}
                            style={{ backgroundColor: currentColor.hex || (theme === 'dark' ? '#64748b' : '#94a3b8') }}
                            title="指標の色を変更"
                          />
                        )}
                        <span className="truncate font-bold">{metric.label}</span>
                      </div>
                      {/* 横線（z-index: 1） */}
                      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: hBorderWidth, backgroundColor: hBorderColor, zIndex: 1 }} />
                      {/* 縦線（z-index: 2で横線より上）- グループ境界で太線 */}
                      <div style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: isLastMetricInGroup ? (isLastGroup ? '3px' : '2px') : '1px',
                        backgroundColor: isLastMetricInGroup
                          ? (theme === 'dark' ? 'rgba(255,255,255,0.3)' : '#6b7280')
                          : (theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#d1d5db'),
                        zIndex: 2
                      }} />
                    </div>
                  );
                })
              ))
            ))}
          </div>
        )}

        {/* 合計行 */}
        {totalRow && (
          <div className="flex" style={{ width: totalWidth }}>
            <div
              style={{ width: columnWidths.firstColWidth, minWidth: columnWidths.firstColWidth, height: ROW_HEIGHT, position: 'sticky', left: 0, zIndex: 10 }}
              className={`px-3 flex items-center text-sm font-bold whitespace-nowrap border-b border-r ${summaryBorder} ${textClass} ${summaryBg}`}
            >
              合計
            </div>
            {vendors.map((vendor) => (
              conditionGroups.map((group, groupIndex) => (
                metrics.map((metric, metricIndex) => {
                  const value = hasConditionGroups
                    ? totalRow.vendors[vendor]?.[group.id]?.[metric.id]
                    : totalRow.vendors[vendor]?.[metric.id];
                  const metricColor = getMetricColor(metric.id);
                  const summaryBgClass = metricColor?.bg
                    ? (theme === 'dark' ? metricColor.bg.dark?.summary : metricColor.bg.light?.summary)
                    : summaryBg;
                  const isLastMetricInGroup = metricIndex === metrics.length - 1;
                  const isLastGroup = groupIndex === conditionGroups.length - 1;
                  const hBorderColor = theme === 'dark' ? '#4b5563' : '#d1d5db'; // gray-600 / gray-300
                  return (
                    <div
                      key={`total-${vendor}-${group.id}-${metric.id}`}
                      style={{ width: getColWidth(vendor, group.id, metric.id), height: ROW_HEIGHT, position: 'relative' }}
                      className={`px-3 flex items-center justify-end text-sm font-bold whitespace-nowrap overflow-hidden ${textClass} ${summaryBgClass}`}
                    >
                      <span className="truncate">{formatMetricValue(value, metric.format)}</span>
                      {/* 横線（z-index: 1） */}
                      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '1px', backgroundColor: hBorderColor, zIndex: 1 }} />
                      {/* 縦線（z-index: 2で横線より上）- グループ境界で太線 */}
                      <div style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: isLastMetricInGroup ? (isLastGroup ? '3px' : '2px') : '1px',
                        backgroundColor: isLastMetricInGroup
                          ? (theme === 'dark' ? '#6b7280' : '#6b7280')
                          : (theme === 'dark' ? '#4b5563' : '#9ca3af'),
                        zIndex: 2
                      }} />
                    </div>
                  );
                })
              ))
            ))}
          </div>
        )}
      </div>

      {/* ボディ（スクロール） */}
      <div
        ref={bodyRef}
        className="flex-1 overflow-auto"
      >
        {pivotData.map((row, rowIndex) => {
          const hBorderColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#e5e7eb'; // border-white/5 / gray-200
          return (
            <div
              key={row.month}
              className={`flex ${rowHoverBg} ${rowIndex % 2 === 0 ? '' : (theme === 'dark' ? 'bg-white/[0.02]' : 'bg-gray-50/50')}`}
              style={{ width: totalWidth }}
            >
              {/* 1列目（行ラベル） */}
              <div
                style={{ width: columnWidths.firstColWidth, minWidth: columnWidths.firstColWidth, height: ROW_HEIGHT, position: 'sticky', left: 0, zIndex: 5 }}
                className={`px-3 flex items-center text-sm font-medium whitespace-nowrap overflow-hidden border-r border-b ${borderClass} ${textClass} ${theme === 'dark' ? 'bg-[#0f172a]' : 'bg-gray-100'}`}
              >
                <span className="truncate">{row.month}</span>
              </div>
              {/* データセル */}
              {vendors.map((vendor) => (
                conditionGroups.map((group, groupIndex) => (
                  metrics.map((metric, metricIndex) => {
                    const value = hasConditionGroups
                      ? row.vendors[vendor]?.[group.id]?.[metric.id]
                      : row.vendors[vendor]?.[metric.id];
                    const isLastMetricInGroup = metricIndex === metrics.length - 1;
                    const isLastGroup = groupIndex === conditionGroups.length - 1;
                    return (
                      <div
                        key={`${row.month}-${vendor}-${group.id}-${metric.id}`}
                        style={{ width: getColWidth(vendor, group.id, metric.id), height: ROW_HEIGHT, position: 'relative' }}
                        className={`px-3 flex items-center justify-end text-sm whitespace-nowrap overflow-hidden ${textClass} ${getCellBgClass(vendor, metric.id)}`}
                      >
                        <span className="truncate">{formatMetricValue(value, metric.format)}</span>
                        {/* 横線（z-index: 1） */}
                        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '1px', backgroundColor: hBorderColor, zIndex: 1 }} />
                        {/* 縦線（z-index: 2で横線より上）- グループ境界で太線 */}
                        <div style={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: isLastMetricInGroup ? (isLastGroup ? '3px' : '2px') : '1px',
                          backgroundColor: isLastMetricInGroup
                            ? (theme === 'dark' ? 'rgba(255,255,255,0.2)' : '#9ca3af')
                            : (theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#d1d5db'),
                          zIndex: 2
                        }} />
                      </div>
                    );
                  })
                ))
              ))}
            </div>
          );
        })}

        {/* データなしメッセージ */}
        {pivotData.length === 0 && (
          <div className={`px-4 py-8 text-center ${subTextClass}`}>
            データがありません
          </div>
        )}
      </div>

      {/* カラーピッカーポップアップ */}
      {!isViewer && colorPickerOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setColorPickerOpen(null)} />
          <div
            className={`fixed z-[9999] p-2 rounded-lg shadow-xl ${theme === 'dark' ? 'bg-slate-800 border border-white/20' : 'bg-white border border-gray-300'}`}
            style={{ top: colorPickerPosition.top, left: colorPickerPosition.left }}
          >
            <div className="grid grid-cols-4 gap-1.5" style={{ width: '130px' }}>
              {PRESET_COLORS.map(color => {
                const currentColorId = metricColors[colorPickerOpen] || 'default';
                return (
                  <button
                    key={color.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleColorSelect(colorPickerOpen, color.id);
                    }}
                    className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${currentColorId === color.id
                      ? 'border-indigo-500 ring-2 ring-indigo-500/50'
                      : (theme === 'dark' ? 'border-white/20' : 'border-gray-300')
                      }`}
                    style={{ backgroundColor: color.hex || (theme === 'dark' ? '#64748b' : '#94a3b8') }}
                    title={color.label}
                  />
                );
              })}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
});

VendorPivotTable.displayName = 'VendorPivotTable';

export default VendorPivotTable;
