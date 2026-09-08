// src/apps/performance-board/components/CalcEditForm.jsx
// 計算式編集フォーム（完全制御コンポーネント: 内部 state なし）
// arithmetic / relation / conditionalCount / constant の4タイプに対応

import React, { useEffect } from 'react';
import { Plus, X, Calendar, Link2 } from 'lucide-react';

const CALC_TYPES = [
  { id: 'arithmetic', label: '四則演算' },
  { id: 'relation', label: 'リレーション' },
  { id: 'conditionalCount', label: '条件カウント' },
  { id: 'constant', label: '固定値' },
];

const FORMAT_OPTIONS = [
  { id: 'number', label: '整数' },
  { id: 'decimal', label: '小数' },
  { id: 'percent', label: 'パーセント' },
];

const DECIMAL_OPTIONS = [
  { id: 0, label: '0' },
  { id: 1, label: '1' },
  { id: 2, label: '2' },
  { id: 3, label: '3' },
];

const CONDITION_OPERATORS = [
  { id: 'equals', label: '=' },
  { id: 'notEquals', label: '≠' },
  { id: 'contains', label: '含む' },
  { id: 'notContains', label: '含まない' },
  { id: 'isNotEmpty', label: '空白以外' },
  { id: 'isEmpty', label: '空白' },
  { id: 'greaterThan', label: '>' },
  { id: 'lessThan', label: '<' },
  { id: 'greaterOrEqual', label: '>=' },
  { id: 'lessOrEqual', label: '<=' },
];

const CalcEditForm = ({
  calc,
  systemFields = [],
  dataSources = [],
  aggregationConfigs = [],
  allCalcs = [],
  onChange,
  theme = 'dark',
}) => {
  // calc が null の場合はデフォルト値を生成して onChange に渡す
  useEffect(() => {
    if (calc === null) {
      const defaultCalc = {
        id: `calc_${(typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`,
        label: '新しい指標',
        type: 'arithmetic',
        format: 'number',
        decimals: 0,
        terms: [],
      };
      onChange(defaultCalc);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // マウント時のみ

  if (!calc) return null;

  const isDark = theme === 'dark';

  const inputClass = isDark
    ? 'bg-white/10 border border-white/20 text-white placeholder-white/30 focus:border-indigo-400'
    : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-indigo-500';

  const labelClass = isDark ? 'text-white/60' : 'text-gray-500';
  const optionBg = isDark ? 'bg-slate-800' : 'bg-white';

  const update = (key, value) => onChange({ ...calc, [key]: value });

  // 数値フィールド一覧（systemFields + allCalcs から数値型）
  const numericFields = [
    ...systemFields.filter(f => f.type === 'number'),
    ...allCalcs.filter(c => c.id !== calc.id),
  ];

  // リレーション/conditionalCount 用: 対象ソース
  const targetSource = dataSources.find(s => s.id === calc.targetSourceId);
  const targetHeaders = targetSource?.headers || [];

  const displayHeader = (h, src) => {
    const meta = src?.fieldMetadata;
    if (meta?.[h] && meta[h] !== h) return meta[h];
    return h;
  };

  // ========== arithmetic ハンドラ ==========
  const addTerm = () => {
    const terms = [...(calc.terms || [])];
    terms.push({ operator: '+', field: '', coefficient: 1 });
    update('terms', terms);
  };
  const updateTerm = (idx, key, value) => {
    const terms = [...(calc.terms || [])];
    terms[idx] = { ...terms[idx], [key]: value };
    update('terms', terms);
  };
  const removeTerm = (idx) => {
    const terms = (calc.terms || []).filter((_, i) => i !== idx);
    update('terms', terms);
  };

  // ========== relation/conditionalCount フィルタハンドラ ==========
  const addFilter = () => {
    const filters = [...(calc.filters || [])];
    filters.push({ colIndex: '', conditionType: 'equals', value: '' });
    update('filters', filters);
  };
  const updateFilter = (idx, key, val) => {
    const filters = [...(calc.filters || [])];
    filters[idx] = { ...filters[idx], [key]: val };
    update('filters', filters);
  };
  const removeFilter = (idx) => {
    update('filters', (calc.filters || []).filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4 text-sm">
      {/* タイプ選択 */}
      <div>
        <label className={`text-xs block mb-1 ${labelClass}`}>タイプ</label>
        <div className={`flex rounded-lg p-0.5 ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
          {CALC_TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => update('type', t.id)}
              className={`flex-1 py-1 text-[11px] rounded font-medium transition-colors ${
                calc.type === t.id
                  ? isDark ? 'bg-white/20 text-white' : 'bg-white text-gray-800 shadow'
                  : isDark ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 表示名 */}
      <div>
        <label className={`text-xs block mb-1 ${labelClass}`}>表示名</label>
        <input
          type="text"
          value={calc.label || ''}
          onChange={(e) => update('label', e.target.value)}
          className={`w-full ${inputClass} rounded-lg px-3 py-2 text-sm outline-none transition-colors`}
          placeholder="例: 受注件数"
        />
      </div>

      {/* ========== arithmetic ========== */}
      {calc.type === 'arithmetic' && (
        <div className={`p-3 rounded-xl border space-y-3 ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center justify-between">
            <label className={`text-xs ${labelClass}`}>計算式</label>
            <button
              onClick={addTerm}
              className={`text-[10px] flex items-center gap-1 ${isDark ? 'text-sky-300 hover:text-sky-200' : 'text-sky-600 hover:text-sky-700'}`}
            >
              <Plus size={10} /> 項を追加
            </button>
          </div>
          <div className="space-y-2">
            {(calc.terms || []).map((term, idx) => (
              <div key={idx} className="flex gap-1.5 items-center">
                {idx > 0 && (
                  <select
                    value={term.operator || '+'}
                    onChange={(e) => updateTerm(idx, 'operator', e.target.value)}
                    className={`w-12 ${inputClass} rounded px-1 py-1.5 text-xs outline-none ${optionBg}`}
                  >
                    {['+', '-', '*', '/'].map(op => (
                      <option key={op} value={op} className={optionBg}>{op}</option>
                    ))}
                  </select>
                )}
                <select
                  value={term.field || ''}
                  onChange={(e) => updateTerm(idx, 'field', e.target.value)}
                  className={`flex-1 min-w-0 ${inputClass} rounded px-2 py-1.5 text-xs outline-none ${optionBg}`}
                >
                  <option value="" className={optionBg}>項目選択...</option>
                  {numericFields.map(f => (
                    <option key={f.id} value={f.id} className={optionBg}>{f.label}</option>
                  ))}
                </select>
                {idx === 0 && <div className="w-5" />}
                {idx > 0 && (
                  <button onClick={() => removeTerm(idx)} className="text-rose-400 hover:text-rose-300 flex-shrink-0">
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
            {(calc.terms || []).length === 0 && (
              <p className={`text-[11px] ${labelClass}`}>「項を追加」でフィールドを選択してください</p>
            )}
          </div>

          {/* 書式 */}
          <div className="flex gap-2 pt-2">
            <div className="flex-1">
              <label className={`text-[10px] block mb-1 ${labelClass}`}>書式</label>
              <select
                value={calc.format || 'number'}
                onChange={(e) => update('format', e.target.value)}
                className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs outline-none ${optionBg}`}
              >
                {FORMAT_OPTIONS.map(f => (
                  <option key={f.id} value={f.id} className={optionBg}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className="w-20">
              <label className={`text-[10px] block mb-1 ${labelClass}`}>小数点</label>
              <select
                value={calc.decimals ?? 0}
                onChange={(e) => update('decimals', parseInt(e.target.value))}
                className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs outline-none ${optionBg}`}
              >
                {DECIMAL_OPTIONS.map(d => (
                  <option key={d.id} value={d.id} className={optionBg}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ========== relation ========== */}
      {calc.type === 'relation' && (
        <div className={`p-3 rounded-xl border space-y-3 ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
          {/* 1. 検索先ソース */}
          <div>
            <label className={`text-xs block mb-1 ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>1. 検索先のソース</label>
            <select
              value={calc.targetSourceId || ''}
              onChange={(e) => onChange({
                ...calc,
                targetSourceId: e.target.value,
                foreignKeyIndex: '',
                aggTargetIndex: '',
                dateColumnIndex: '',
                filters: [],
                filterMappings: {},
              })}
              className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs outline-none ${optionBg}`}
            >
              <option value="" className={optionBg}>ソース選択...</option>
              {dataSources.map(src => (
                <option key={src.id} value={src.id} className={optionBg}>{src.name}</option>
              ))}
            </select>
          </div>

          {/* キー設定 */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className={`text-[10px] block mb-1 ${labelClass}`}>相手キー (Join Col)</label>
              <select
                value={calc.foreignKeyIndex ?? ''}
                onChange={(e) => update('foreignKeyIndex', e.target.value)}
                disabled={!targetSource}
                className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs outline-none disabled:opacity-40 ${optionBg}`}
              >
                <option value="" className={optionBg}>列選択...</option>
                {targetHeaders.map((h, i) => (
                  <option key={i} value={i} className={optionBg}>{displayHeader(h, targetSource)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 日付判定 */}
          <div>
            <label className={`text-[10px] flex items-center gap-1 mb-1 ${isDark ? 'text-sky-300' : 'text-sky-600'}`}>
              <Calendar size={10} /> 日付判定カラム
            </label>
            <select
              value={calc.dateColumnIndex ?? ''}
              onChange={(e) => update('dateColumnIndex', e.target.value)}
              disabled={!targetSource}
              className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs outline-none disabled:opacity-40 ${optionBg}`}
            >
              <option value="" className={optionBg}>設定なし（常に全件）</option>
              {targetHeaders.map((h, i) => (
                <option key={i} value={i} className={optionBg}>{displayHeader(h, targetSource)}</option>
              ))}
            </select>
          </div>

          {/* 集計方法 */}
          <div className="flex gap-2">
            <div className="w-1/3">
              <label className={`text-xs block mb-1 ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>集計方法</label>
              <select
                value={calc.aggType || 'count'}
                onChange={(e) => update('aggType', e.target.value)}
                className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs outline-none ${optionBg}`}
              >
                <option value="count" className={optionBg}>件数 (COUNT)</option>
                <option value="sum" className={optionBg}>合計 (SUM)</option>
                <option value="lookup" className={optionBg}>値取得 (LOOKUP)</option>
              </select>
            </div>
            <div className="flex-1">
              <label className={`text-xs block mb-1 ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>対象列</label>
              <select
                value={calc.aggTargetIndex ?? ''}
                onChange={(e) => update('aggTargetIndex', e.target.value)}
                disabled={!targetSource}
                className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs outline-none disabled:opacity-40 ${optionBg}`}
              >
                <option value="" className={optionBg}>列選択...</option>
                {targetHeaders.map((h, i) => (
                  <option key={i} value={i} className={optionBg}>{displayHeader(h, targetSource)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 固定絞り込み条件 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={`text-xs ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>固定絞り込み条件</label>
              <button
                onClick={addFilter}
                className={`text-[10px] flex items-center gap-1 ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} px-1.5 py-0.5 rounded`}
                disabled={!targetSource}
              >
                <Plus size={10} /> 追加
              </button>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {(calc.filters || []).map((f, idx) => {
                const noVal = ['isEmpty', 'isNotEmpty'].includes(f.conditionType);
                return (
                  <div key={idx} className={`flex items-center gap-1 flex-wrap p-1.5 rounded border ${isDark ? 'bg-slate-900/50 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
                    <select
                      value={f.colIndex ?? ''}
                      onChange={(e) => updateFilter(idx, 'colIndex', e.target.value)}
                      className={`flex-1 min-w-0 ${inputClass} rounded px-1.5 py-1 text-[11px] outline-none ${optionBg}`}
                    >
                      <option value="" className={optionBg}>列...</option>
                      {targetHeaders.map((h, i) => (
                        <option key={i} value={i} className={optionBg}>{displayHeader(h, targetSource)}</option>
                      ))}
                    </select>
                    <select
                      value={f.conditionType || 'equals'}
                      onChange={(e) => updateFilter(idx, 'conditionType', e.target.value)}
                      className={`w-20 ${inputClass} rounded px-1.5 py-1 text-[11px] outline-none ${optionBg}`}
                    >
                      {CONDITION_OPERATORS.map(op => (
                        <option key={op.id} value={op.id} className={optionBg}>{op.label}</option>
                      ))}
                    </select>
                    {!noVal && (
                      <input
                        type="text"
                        value={f.value || ''}
                        onChange={(e) => updateFilter(idx, 'value', e.target.value)}
                        className={`w-20 ${inputClass} rounded px-1.5 py-1 text-[11px] outline-none`}
                        placeholder="値"
                      />
                    )}
                    <button onClick={() => removeFilter(idx)} className="text-rose-400 hover:text-rose-300">
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========== conditionalCount ========== */}
      {calc.type === 'conditionalCount' && (
        <div className={`p-3 rounded-xl border space-y-3 ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
          {/* 対象ソース */}
          <div>
            <label className={`text-xs block mb-1 ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>対象ソース</label>
            <select
              value={calc.targetSourceId || ''}
              onChange={(e) => onChange({
                ...calc,
                targetSourceId: e.target.value,
                foreignKeyIndex: '',
                dateColumnIndex: '',
                filters: [],
                filterMappings: {},
              })}
              className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs outline-none ${optionBg}`}
            >
              <option value="" className={optionBg}>ソース選択...</option>
              {dataSources.map(src => (
                <option key={src.id} value={src.id} className={optionBg}>{src.name}</option>
              ))}
            </select>
          </div>

          {/* 相手キー */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className={`text-[10px] block mb-1 ${labelClass}`}>結合キー列</label>
              <select
                value={calc.foreignKeyIndex ?? ''}
                onChange={(e) => update('foreignKeyIndex', e.target.value)}
                disabled={!targetSource}
                className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs outline-none disabled:opacity-40 ${optionBg}`}
              >
                <option value="" className={optionBg}>列選択...</option>
                {targetHeaders.map((h, i) => (
                  <option key={i} value={i} className={optionBg}>{displayHeader(h, targetSource)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 日付判定 */}
          <div>
            <label className={`text-[10px] flex items-center gap-1 mb-1 ${isDark ? 'text-sky-300' : 'text-sky-600'}`}>
              <Calendar size={10} /> 日付判定カラム
            </label>
            <select
              value={calc.dateColumnIndex ?? ''}
              onChange={(e) => update('dateColumnIndex', e.target.value)}
              disabled={!targetSource}
              className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs outline-none disabled:opacity-40 ${optionBg}`}
            >
              <option value="" className={optionBg}>設定なし（常に全件）</option>
              {targetHeaders.map((h, i) => (
                <option key={i} value={i} className={optionBg}>{displayHeader(h, targetSource)}</option>
              ))}
            </select>
          </div>

          {/* 条件 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={`text-xs ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>カウント条件 (AND)</label>
              <button
                onClick={addFilter}
                className={`text-[10px] flex items-center gap-1 ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} px-1.5 py-0.5 rounded`}
                disabled={!targetSource}
              >
                <Plus size={10} /> 追加
              </button>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {(calc.filters || []).map((f, idx) => {
                const noVal = ['isEmpty', 'isNotEmpty'].includes(f.conditionType);
                return (
                  <div key={idx} className={`flex items-center gap-1 flex-wrap p-1.5 rounded border ${isDark ? 'bg-slate-900/50 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
                    <select
                      value={f.colIndex ?? ''}
                      onChange={(e) => updateFilter(idx, 'colIndex', e.target.value)}
                      className={`flex-1 min-w-0 ${inputClass} rounded px-1.5 py-1 text-[11px] outline-none ${optionBg}`}
                    >
                      <option value="" className={optionBg}>列...</option>
                      {targetHeaders.map((h, i) => (
                        <option key={i} value={i} className={optionBg}>{displayHeader(h, targetSource)}</option>
                      ))}
                    </select>
                    <select
                      value={f.conditionType || 'equals'}
                      onChange={(e) => updateFilter(idx, 'conditionType', e.target.value)}
                      className={`w-20 ${inputClass} rounded px-1.5 py-1 text-[11px] outline-none ${optionBg}`}
                    >
                      {CONDITION_OPERATORS.map(op => (
                        <option key={op.id} value={op.id} className={optionBg}>{op.label}</option>
                      ))}
                    </select>
                    {!noVal && (
                      <input
                        type="text"
                        value={f.value || ''}
                        onChange={(e) => updateFilter(idx, 'value', e.target.value)}
                        className={`w-20 ${inputClass} rounded px-1.5 py-1 text-[11px] outline-none`}
                        placeholder="値"
                      />
                    )}
                    <button onClick={() => removeFilter(idx)} className="text-rose-400 hover:text-rose-300">
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========== constant ========== */}
      {calc.type === 'constant' && (
        <div className={`p-3 rounded-xl border space-y-3 ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
          <div>
            <label className={`text-xs block mb-1 ${labelClass}`}>値</label>
            <input
              type="number"
              step="any"
              value={calc.constantValue ?? ''}
              onChange={(e) => update('constantValue', e.target.value === '' ? '' : parseFloat(e.target.value))}
              className={`w-full ${inputClass} rounded-lg px-3 py-2 text-sm outline-none transition-colors`}
              placeholder="例: 100"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className={`text-[10px] block mb-1 ${labelClass}`}>書式</label>
              <select
                value={calc.format || 'number'}
                onChange={(e) => update('format', e.target.value)}
                className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs outline-none ${optionBg}`}
              >
                {FORMAT_OPTIONS.map(f => (
                  <option key={f.id} value={f.id} className={optionBg}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalcEditForm;
