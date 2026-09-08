import { useState, useMemo } from 'react';
import { RotateCcw, Bookmark, BookmarkCheck, Filter, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import MultiSelectDropdown from './MultiSelectDropdown';
import DateRangeDropdown from './DateRangeDropdown';

const FilterCard = ({
  filters,
  draftFilters,
  setDraftFilters,
  getFilterOptions,
  glassClass,
  theme,
  // 適用済みフィルター（チップ表示用。draft=未適用の選択中値とは別物）
  activeFilters = {},
  // --- Phase 10 追加 props ---
  onQuickDate,
  isLastMonth,
  isThisMonth,
  resetFilters,
  saveFilters,
  clearSavedFilters,
  applyFilters,
  isApplyingLocal,
  isLoading,
  hasSavedFilters,
  filtersApplied,
}) => {
  const [filtersOpen, setFiltersOpen] = useState(true);

  // 「すべて」以外が適用されているフィルターだけを抽出（折りたたみ時のチップ表示用）。
  // 判定は実処理（useAnalyticsData.js の filteredData）と完全に一致させる:
  // date は start/end 両方あるときだけフィルタ、配列は空=フィルタなし・String比較の集合判定。
  const activeFilterSummary = useMemo(() => {
    if (!filters) return [];
    const summary = [];
    filters.forEach(filter => {
      const val = activeFilters[filter.field];
      if (filter.field === 'date') {
        // 実処理は start && end が両方あるときだけ範囲フィルタ（片側だけならフィルタなし）
        if (val && typeof val === 'object' && val.start && val.end) {
          summary.push({
            key: filter.id,
            label: filter.label,
            value: `${val.start.replace(/-/g, '/')} ~ ${val.end.replace(/-/g, '/')}`,
          });
        }
        return;
      }
      if (!Array.isArray(val) || val.length === 0) return; // 未設定・空配列 = フィルタなし（実処理は全件表示）
      const options = getFilterOptions(filter.field) || [];
      const valSet = new Set(val.map(String));
      // 全選択肢が適用値に含まれる = どの行も除外されない = 絞り込みなし。
      // 実処理が val.includes(String(rowValue)) の String 比較のため、両側を String 正規化して判定する。
      if (options.length > 0 && options.every(o => valSet.has(String(o)))) return;
      const value = val.length <= 2 ? val.join('・') : `${val.slice(0, 2).join('・')} 他${val.length - 2}件`;
      summary.push({ key: filter.id, label: filter.label, value });
    });
    return summary;
  }, [filters, activeFilters, getFilterOptions]);

  if (!filters || filters.length === 0) return null;

  const labelClass = `text-xs font-medium mb-1.5 ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`;
  const cellClass = `rounded-lg ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-300'}`;
  const segContainerClass = `inline-flex items-center gap-1 p-1 rounded-full ${
    theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gray-100 border border-gray-200'
  }`;
  const segBtnClass = (active) => `px-4 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
    active
      ? (theme === 'dark' ? 'bg-white/20 text-white shadow' : 'bg-white text-gray-900 shadow-sm')
      : (theme === 'dark' ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-gray-900')
  }`;

  return (
    <div className={`rounded-2xl p-3 ${glassClass}`}>
      {/* ヘッダー: タイトル + 折りたたみトグル。閉じているときは適用中の条件をチップで表示 */}
      <div className="flex items-start gap-2">
        <button
          onClick={() => setFiltersOpen(v => !v)}
          className={`flex items-center gap-1.5 text-xs font-semibold px-1.5 py-1 rounded transition-colors flex-shrink-0 ${
            theme === 'dark' ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
          title={filtersOpen ? 'フィルターを折りたたむ' : 'フィルターを展開する'}
        >
          <Filter size={13} className="text-indigo-400" />
          フィルター
          {filtersOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {!filtersOpen && (
          <div className="flex flex-wrap gap-1.5 items-center flex-1 min-w-0 py-0.5">
            {activeFilterSummary.length === 0 ? (
              <span className={`text-[11px] ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>絞り込みなし</span>
            ) : activeFilterSummary.map(s => (
              <span key={s.key} className={`px-2 py-0.5 rounded-full text-[10px] ${theme === 'dark' ? 'bg-white/10 text-white/70' : 'bg-gray-200 text-gray-700'}`}>
                {s.label}: {s.value}
              </span>
            ))}
          </div>
        )}
      </div>

      {filtersOpen && (
      <>
      {/* フィルターグリッド */}
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
        {filters.map(filter => {
          const isDateFilter = filter.field === 'date';
          return (
            <div key={filter.id} className={`flex flex-col ${isDateFilter ? 'col-span-2' : ''}`}>
              <span className={labelClass}>{filter.label}</span>
              <div className={cellClass}>
                {isDateFilter ? (
                  <DateRangeDropdown
                    label={filter.label}
                    value={draftFilters[filter.field]}
                    onChange={(range) => setDraftFilters(prev => ({ ...prev, [filter.field]: range }))}
                    glassClass={glassClass}
                    theme={theme}
                  />
                ) : (
                  <MultiSelectDropdown
                    label={filter.label}
                    options={getFilterOptions(filter.field)}
                    value={draftFilters[filter.field]}
                    onChange={(val) => setDraftFilters(prev => ({ ...prev, [filter.field]: val }))}
                    glassClass={glassClass}
                    theme={theme}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* フッター: 左=先月/今月 / 右=リセット/フィルター保存/適用 */}
      <div className={`mt-2 pt-2 border-t flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
        <div className="flex items-center gap-2">
          {onQuickDate && (
            <div className={segContainerClass}>
              <button onClick={() => onQuickDate(-1)} className={segBtnClass(isLastMonth)}>先月</button>
              <button onClick={() => onQuickDate(0)} className={segBtnClass(isThisMonth)}>今月</button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={resetFilters}
            disabled={isApplyingLocal || isLoading}
            className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-500 border border-rose-500/30 text-xs flex items-center gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="すべてのフィルターを解除"
          >
            <RotateCcw size={12} /> リセット
          </button>
          {hasSavedFilters ? (
            <button
              onClick={clearSavedFilters}
              disabled={isApplyingLocal || isLoading}
              className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'dark' ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30' : 'bg-amber-100 hover:bg-amber-200 text-amber-600 border border-amber-300'}`}
              title="保存したフィルターをクリア"
            >
              <BookmarkCheck size={12} /> 保存済み
            </button>
          ) : (
            <button
              onClick={() => saveFilters()}
              disabled={isApplyingLocal || isLoading || !filtersApplied}
              className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white/70 border border-white/20' : 'bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300'}`}
              title={!filtersApplied ? "先にフィルターを適用してください" : "現在のフィルターを保存"}
            >
              <Bookmark size={12} /> フィルター保存
            </button>
          )}
          <button
            onClick={applyFilters}
            disabled={isApplyingLocal || isLoading}
            className="px-6 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs shadow-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed min-w-[100px]"
          >
            {isApplyingLocal ? (
              <>
                <Loader2 size={12} className="animate-spin" /> 適用中...
              </>
            ) : (
              <>
                <Filter size={12} /> 適用
              </>
            )}
          </button>
        </div>
      </div>
      </>
      )}
    </div>
  );
};

export default FilterCard;
