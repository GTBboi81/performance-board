// src/apps/performance-board/components/DataTableToolbar.jsx
// データテーブルのツールバー（タイトル・集計・セグメント・固定列）

import React, { useRef, useState } from 'react';
import { BarChart2, Layers, Plus, X, Download, ChevronsDownUp, ChevronsUpDown, Users } from 'lucide-react';
import EmployeePickerDropdown from './EmployeePickerDropdown';

const DataTableToolbar = ({
  tableConfig,
  theme = 'dark',
  // 集計関連
  safeAggregationConfigs,
  selectedAggConfigId,
  setSelectedAggConfigId,
  // セグメント関連
  additionalSegments,
  systemFields,
  availableSegmentFields,
  onAddSegment,
  onRemoveSegment,
  // データ件数
  dataCount,
  // CSVエクスポート
  onExportCSV,
  // 階層モード一括折りたたみ/展開
  isHierarchyMode,
  allCollapsed,
  onCollapseAll,
  onExpandAll,
  // 担当者ホワイトリスト
  uniqueEmployees,
  visibleEmployeeIds,
  onVisibleEmployeeIdsChange,
  hasMainKey,
  // 編集モード
  isEditMode = false,
  onToggleEditMode,
  onEditSave,
  onEditCancel,
  isDirty = false,
  // テーブル設定ポップアップ
  onTableNameClick,
  // 新規指標追加
  onAddCalc,
}) => {
  const [segmentDropdownOpen, setSegmentDropdownOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const segmentButtonRef = useRef(null);
  const employeeButtonRef = useRef(null);
  const tableNameRef = useRef(null);

  const optionClass = theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-white text-gray-800';

  const handleAddSegment = (fieldId) => {
    onAddSegment(fieldId);
    setSegmentDropdownOpen(false);
  };

  return (
    <div className={`px-2 py-1 border-b flex flex-col md:flex-row md:flex-wrap justify-between items-start md:items-center gap-1.5 min-h-[34px] ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-gray-300 bg-gray-50'}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        {isEditMode ? (
          <button
            ref={tableNameRef}
            onClick={() => onTableNameClick?.(tableNameRef)}
            className={`flex items-center gap-1 text-[11px] font-semibold px-1 py-0.5 rounded transition-colors
              ${theme === 'dark'
                ? 'text-white/80 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/20'
                : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-transparent hover:border-gray-300'
              }`}
            title="テーブル設定を編集"
          >
            <BarChart2 size={11} className="text-indigo-400" />
            {tableConfig.name}
            <span className="text-[9px] opacity-50">▾</span>
          </button>
        ) : (
          <h3 className={`text-[11px] font-semibold flex items-center gap-1.5 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
            <BarChart2 size={11} className="text-indigo-400" /> {tableConfig.name}
          </h3>
        )}

        {/* 集計プルダウン */}
        <div className={`flex items-center gap-2 rounded px-1.5 py-0.5 h-[22px] ${theme === 'dark' ? 'bg-slate-800/50 border border-white/10' : 'bg-white border border-gray-300'}`}>
          <Layers size={12} className={theme === 'dark' ? 'text-white/50' : 'text-gray-400'} />
          <select
            value={selectedAggConfigId || (safeAggregationConfigs[0]?.id || '')}
            onChange={(e) => setSelectedAggConfigId(e.target.value)}
            className={`bg-transparent text-[10px] outline-none cursor-pointer min-w-0 md:min-w-[120px] ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}
          >
            {safeAggregationConfigs.map(config => (
              <option key={config.id} value={config.id} className={optionClass}>
                {config.label}
              </option>
            ))}
          </select>
        </div>

        {/* 追加セグメント表示 */}
        {additionalSegments.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {additionalSegments.map(segId => {
              const field = systemFields.find(f => f.id === segId);
              return (
                <div
                  key={segId}
                  className={`flex items-center gap-1 px-1.5 py-0 rounded text-[10px] h-[20px] leading-none ${theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-indigo-100 text-indigo-700 border border-indigo-300'}`}
                >
                  <span>{field?.label || segId}</span>
                  <button
                    onClick={() => onRemoveSegment(segId)}
                    className={`hover:text-red-400 ${theme === 'dark' ? 'text-indigo-300/60' : 'text-indigo-500'}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* セグメント追加ボタン */}
        {availableSegmentFields.length > 0 && (
          <div className="relative">
            <button
              ref={segmentButtonRef}
              onClick={() => setSegmentDropdownOpen(!segmentDropdownOpen)}
              className={`flex items-center gap-1 px-2 py-0 rounded text-[10px] transition-colors h-[22px] leading-none ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10' : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 border border-gray-300'}`}
            >
              <Plus size={12} />
              <span className="hidden md:inline">セグメント</span>
            </button>
            {segmentDropdownOpen && segmentButtonRef.current && (() => {
              const rect = segmentButtonRef.current.getBoundingClientRect();
              return (
                <>
                  <div
                    className="fixed inset-0"
                    style={{ zIndex: 9998 }}
                    onClick={() => setSegmentDropdownOpen(false)}
                  />
                  <div
                    className={`fixed rounded-lg shadow-lg min-w-[150px] py-1 pointer-events-auto ${theme === 'dark' ? 'bg-slate-800 border border-white/10' : 'bg-white border border-gray-300'}`}
                    style={{
                      top: rect.bottom + 4,
                      left: rect.left,
                      zIndex: 9999
                    }}
                  >
                    {availableSegmentFields.map(field => (
                      <button
                        key={field.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddSegment(field.id);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer pointer-events-auto ${theme === 'dark' ? 'text-white/80 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'}`}
                      >
                        {field.label}
                      </button>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* 担当者ホワイトリストボタン */}
        {hasMainKey && (
          <div className="relative">
            <button
              ref={employeeButtonRef}
              onClick={() => setPickerOpen(!pickerOpen)}
              className={`flex items-center gap-1 px-2 py-0 rounded text-[10px] transition-colors h-[22px] leading-none ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10' : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 border border-gray-300'}`}
            >
              <Users size={12} />
              <span className="hidden md:inline">
                担当者: {Array.isArray(visibleEmployeeIds) ? `${visibleEmployeeIds.length}人` : '全員'}
              </span>
            </button>
            {pickerOpen && employeeButtonRef.current && (
              <EmployeePickerDropdown
                options={uniqueEmployees || []}
                selectedIds={visibleEmployeeIds}
                onSave={(ids) => {
                  onVisibleEmployeeIdsChange?.(ids);
                  setPickerOpen(false);
                }}
                onCancel={() => setPickerOpen(false)}
                anchorRect={employeeButtonRef.current.getBoundingClientRect()}
                theme={theme}
              />
            )}
          </div>
        )}

      </div>
      <div className="flex items-center gap-1.5">
        {isHierarchyMode && onCollapseAll && onExpandAll && (
          <button
            onClick={allCollapsed ? onExpandAll : onCollapseAll}
            className={`flex items-center gap-1 px-2 py-0 rounded text-[10px] transition-colors h-[22px] leading-none ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10' : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 border border-gray-300'}`}
            title={allCollapsed ? '全て展開' : '全て折りたたむ'}
          >
            {allCollapsed
              ? <><ChevronsUpDown size={12} /><span className="hidden md:inline">展開</span></>
              : <><ChevronsDownUp size={12} /><span className="hidden md:inline">折りたたむ</span></>
            }
          </button>
        )}
        {onExportCSV && (
          <button
            onClick={onExportCSV}
            className={`flex items-center gap-1 px-2 py-0 rounded text-[10px] transition-colors h-[22px] leading-none ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10' : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 border border-gray-300'}`}
            title="CSVダウンロード"
          >
            <Download size={12} />
            <span className="hidden md:inline">CSV</span>
          </button>
        )}
        {/* 編集モードトグルボタン */}
        {!isEditMode ? (
          <button
            onClick={onToggleEditMode}
            className={`px-2 py-0 h-[22px] text-[10px] rounded leading-none border transition-colors
              ${theme === 'dark'
                ? 'border-white/20 text-white/50 hover:border-indigo-400 hover:text-indigo-400'
                : 'border-gray-300 text-gray-500 hover:border-indigo-500 hover:text-indigo-500'
              }`}
            title="編集モードに切り替え"
          >
            ✏️ 編集
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <span className={`text-[10px] ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`}>
              編集中{isDirty ? ' *' : ''}
            </span>
            <button
              onClick={onAddCalc}
              className={`px-2 py-0 h-[22px] text-[10px] rounded leading-none border
                ${theme === 'dark'
                  ? 'border-indigo-400/50 text-indigo-400 hover:bg-indigo-400/10'
                  : 'border-indigo-500/50 text-indigo-500 hover:bg-indigo-50'
                }`}
              title="新規指標を追加"
            >
              + 指標
            </button>
            <button
              onClick={onEditSave}
              className={`px-2 py-0 h-[22px] text-[10px] rounded leading-none
                bg-indigo-500 hover:bg-indigo-600 text-white`}
            >
              保存
            </button>
            <button
              onClick={onEditCancel}
              className={`px-2 py-0 h-[22px] text-[10px] rounded leading-none border
                ${theme === 'dark' ? 'border-white/20 text-white/50 hover:border-white/40' : 'border-gray-300 text-gray-500'}`}
            >
              キャンセル
            </button>
          </div>
        )}
        <div className={`text-[10px] font-mono opacity-40 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
          {dataCount} 件
        </div>
      </div>
    </div>
  );
};

export default DataTableToolbar;
