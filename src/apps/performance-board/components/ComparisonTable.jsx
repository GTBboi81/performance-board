// src/apps/performance-board/components/ComparisonTable.jsx
// 比較テーブルコンポーネント（独立版）

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Plus, Edit2, ArrowUpRight, ArrowDownRight, Minus, ToggleLeft, ToggleRight, RotateCcw, GitCompare, Filter, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { HEIGHT_UNITS } from '../../../constants';

// セグメント用カラーパレット
const SEGMENT_COLORS = [
  { id: 'red', label: '赤', hex: '#ef4444', bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  { id: 'blue', label: '青', hex: '#3b82f6', bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  { id: 'green', label: '緑', hex: '#22c55e', bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  { id: 'yellow', label: '黄', hex: '#eab308', bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  { id: 'purple', label: '紫', hex: '#a855f7', bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  { id: 'orange', label: '橙', hex: '#f97316', bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  { id: 'cyan', label: '水色', hex: '#06b6d4', bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  { id: 'pink', label: 'ピンク', hex: '#ec4899', bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30' },
];

// 粒度オプション
const GRANULARITY_OPTIONS = [
  { id: 'day', label: '日別' },
  { id: 'week', label: '週別' },
  { id: 'month', label: '月別' },
  { id: 'year', label: '年別' },
];

// 日付正規化関数
const normalizeDate = (val) => {
  if (!val) return "";
  let str = String(val).trim();
  if (str.includes('T')) {
    str = str.split('T')[0];
  }
  str = str.replace(/[\.\-]/g, '/');
  const parts = str.split('/');
  if (parts.length === 3) {
    const y = parts[0];
    const m = parts[1].padStart(2, '0');
    const d = parts[2].padStart(2, '0');
    return `${y}/${m}/${d}`;
  }
  return str;
};

// 日付を粒度に変換
const transformDateToSegment = (dateValue, granularity) => {
  if (!dateValue) return null;

  const normalized = normalizeDate(dateValue);
  const parts = normalized.split('/');
  if (parts.length !== 3) return null;

  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const day = parseInt(parts[2]);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  const date = new Date(year, month - 1, day);

  switch (granularity) {
    case 'year':
      return `${year}年`;
    case 'month':
      return `${year}/${String(month).padStart(2, '0')}`;
    case 'week': {
      const startOfYear = new Date(year, 0, 1);
      const weekNumber = Math.ceil(((date - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
      return `${year}年W${String(weekNumber).padStart(2, '0')}`;
    }
    case 'day':
    default:
      return normalized;
  }
};

// セグメント編集モーダル
const SegmentEditModal = ({
  isOpen,
  onClose,
  segment,
  onSave,
  systemFields,
  theme = 'dark',
}) => {
  const [name, setName] = useState(segment?.name || '');
  const [colorId, setColorId] = useState(segment?.colorId || SEGMENT_COLORS[0].id);
  const [filterType, setFilterType] = useState(segment?.filterType || 'dateRange');
  const [dateRange, setDateRange] = useState(segment?.dateRange || { start: '', end: '' });
  const [columnFilter, setColumnFilter] = useState(segment?.columnFilter || { column: '', operator: '=', value: '' });

  useEffect(() => {
    if (segment) {
      setName(segment.name || '');
      setColorId(segment.colorId || SEGMENT_COLORS[0].id);
      setFilterType(segment.filterType || 'dateRange');
      setDateRange(segment.dateRange || { start: '', end: '' });
      setColumnFilter(segment.columnFilter || { column: '', operator: '=', value: '' });
    }
  }, [segment]);

  if (!isOpen) return null;

  const stringFields = systemFields.filter(f => f.type === 'string');

  const handleSave = () => {
    onSave({
      id: segment?.id || `seg-${Date.now()}`,
      name: name || `セグメント${segment?.id ? '' : ' (新規)'}`,
      colorId,
      filterType,
      dateRange: filterType === 'dateRange' ? dateRange : null,
      columnFilter: filterType === 'column' ? columnFilter : null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative z-50 w-full max-w-md rounded-xl shadow-2xl ${theme === 'dark' ? 'bg-slate-800 border border-white/10' : 'bg-white border border-gray-300'}`}>
        <div className={`flex items-center justify-between p-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
          <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
            {segment?.id ? 'セグメント編集' : 'セグメント追加'}
          </h3>
          <button onClick={onClose} className={`p-1 rounded hover:bg-white/10 ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* セグメント名 */}
          <div>
            <label className={`block text-sm mb-1 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>セグメント名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 10月データ"
              className={`w-full px-3 py-2 rounded-lg text-sm ${theme === 'dark' ? 'bg-slate-700 border border-white/10 text-white placeholder:text-white/30' : 'bg-gray-50 border border-gray-300 text-gray-800 placeholder:text-gray-400'}`}
            />
          </div>

          {/* カラー選択 */}
          <div>
            <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>カラー</label>
            <div className="flex gap-2 flex-wrap">
              {SEGMENT_COLORS.map(color => (
                <button
                  key={color.id}
                  onClick={() => setColorId(color.id)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${colorId === color.id ? 'border-white ring-2 ring-white/50' : 'border-transparent'
                    }`}
                  style={{ backgroundColor: color.hex }}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          {/* フィルタータイプ選択 */}
          <div>
            <label className={`block text-sm mb-2 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>フィルター条件</label>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterType('dateRange')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${filterType === 'dateRange'
                    ? 'bg-indigo-500 text-white'
                    : theme === 'dark' ? 'bg-slate-700 text-white/60 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                期間指定
              </button>
              <button
                onClick={() => setFilterType('column')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${filterType === 'column'
                    ? 'bg-indigo-500 text-white'
                    : theme === 'dark' ? 'bg-slate-700 text-white/60 hover:bg-slate-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                カラム値
              </button>
            </div>
          </div>

          {/* 期間指定 */}
          {filterType === 'dateRange' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>開始日</label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    className={`w-full px-3 py-2 rounded-lg text-sm ${theme === 'dark' ? 'bg-slate-700 border border-white/10 text-white' : 'bg-gray-50 border border-gray-300 text-gray-800'}`}
                  />
                </div>
                <div className="flex-1">
                  <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>終了日</label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    className={`w-full px-3 py-2 rounded-lg text-sm ${theme === 'dark' ? 'bg-slate-700 border border-white/10 text-white' : 'bg-gray-50 border border-gray-300 text-gray-800'}`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* カラム値指定 */}
          {filterType === 'column' && (
            <div className="space-y-2">
              <div>
                <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>カラム</label>
                <select
                  value={columnFilter.column}
                  onChange={(e) => setColumnFilter({ ...columnFilter, column: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg text-sm ${theme === 'dark' ? 'bg-slate-700 border border-white/10 text-white' : 'bg-gray-50 border border-gray-300 text-gray-800'}`}
                >
                  <option value="">選択してください</option>
                  {stringFields.map(f => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <div className="w-24">
                  <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>条件</label>
                  <select
                    value={columnFilter.operator}
                    onChange={(e) => setColumnFilter({ ...columnFilter, operator: e.target.value })}
                    className={`w-full px-3 py-2 rounded-lg text-sm ${theme === 'dark' ? 'bg-slate-700 border border-white/10 text-white' : 'bg-gray-50 border border-gray-300 text-gray-800'}`}
                  >
                    <option value="=">=</option>
                    <option value="!=">!=</option>
                    <option value="contains">含む</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>値</label>
                  <input
                    type="text"
                    value={columnFilter.value}
                    onChange={(e) => setColumnFilter({ ...columnFilter, value: e.target.value })}
                    placeholder="値を入力"
                    className={`w-full px-3 py-2 rounded-lg text-sm ${theme === 'dark' ? 'bg-slate-700 border border-white/10 text-white placeholder:text-white/30' : 'bg-gray-50 border border-gray-300 text-gray-800 placeholder:text-gray-400'}`}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={`flex justify-end gap-2 p-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg text-sm ${theme === 'dark' ? 'text-white/60 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm bg-indigo-500 text-white hover:bg-indigo-600"
          >
            {segment?.id ? '更新' : '追加'}
          </button>
        </div>
      </div>
    </div>
  );
};

// メイン比較テーブルコンポーネント
const ComparisonTable = ({
  // 設定系
  tableConfig,
  // データ系
  filteredData = [],
  systemFields = [],
  calculations = [],
  // スタイル系
  theme = 'dark',
  glassClass = '',
  // コールバック
  onConfigChange,
}) => {
  // tableConfigから設定を読み込み
  const {
    label = '比較テーブル',
    width = 'full',
    height = '1',
    segments: initialSegments = [],
    layout: initialLayout = 'horizontal',
    showDiff: initialShowDiff = true,
    baseSegmentId: initialBaseSegmentId = null,
    // 自動セグメント設定
    segmentMode: initialSegmentMode = 'manual',
    autoSegmentField: initialAutoSegmentField = '',
    autoSegmentGranularity: initialAutoSegmentGranularity = 'month',
    // 階層セグメント（サブセグメント）
    secondarySegmentField: initialSecondarySegmentField = '',
    // 軸入れ替え
    axisSwapped: initialAxisSwapped = false,
    // 表示指標（設定画面で選択）
    displayFieldIds: configDisplayFieldIds = [],
    // ローカルフィルター（保存される）
    localFilters: initialLocalFilters = {},
  } = tableConfig || {};

  // 手動セグメント
  const [segments, setSegments] = useState(initialSegments);
  const [editingSegment, setEditingSegment] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // セグメントモード（manual / auto）
  const [segmentMode, setSegmentMode] = useState(initialSegmentMode);

  // 自動セグメント設定
  const [autoSegmentField, setAutoSegmentField] = useState(initialAutoSegmentField);
  const [autoSegmentGranularity, setAutoSegmentGranularity] = useState(initialAutoSegmentGranularity);

  // 階層セグメント（サブセグメント）
  const [secondarySegmentField, setSecondarySegmentField] = useState(initialSecondarySegmentField);

  // 表示レイアウト
  const [layout, setLayout] = useState(initialLayout);

  // 差分表示
  const [showDiff, setShowDiff] = useState(initialShowDiff);
  const [baseSegmentId, setBaseSegmentId] = useState(initialBaseSegmentId);

  // 軸入れ替え
  const [axisSwapped, setAxisSwapped] = useState(initialAxisSwapped);

  // ローカルフィルター
  const [localFilters, setLocalFilters] = useState(initialLocalFilters);
  const [showFilters, setShowFilters] = useState(false);

  // 固定カラム数（ローカル状態）
  const [stickyColumns, setStickyColumns] = useState(tableConfig?.stickyColumns || 0);
  const [stickyDropdownOpen, setStickyDropdownOpen] = useState(false);

  // テーブルのスクロール同期用ref
  const headerRef = useRef(null);
  const bodyRef = useRef(null);

  // 設定変更時にコールバックを呼び出すヘルパー関数
  const updateConfig = (changes) => {
    if (onConfigChange) {
      onConfigChange(changes);
    }
  };

  // ローカルフィルターを適用したデータ
  const localFilteredData = useMemo(() => {
    let data = filteredData;

    Object.entries(localFilters).forEach(([fieldId, values]) => {
      if (values && Array.isArray(values) && values.length > 0) {
        data = data.filter(row => values.includes(String(row[fieldId] ?? '')));
      }
    });

    return data;
  }, [filteredData, localFilters]);

  // データソース（ローカルフィルター適用後）
  const dataSource = localFilteredData;

  // 幅クラス
  const widthClass = {
    full: 'w-full',
    twoThird: 'w-full lg:w-[calc(66.666%-5.33px)]',
    half: 'w-full lg:w-[calc(50%-8px)]',
    oneThird: 'w-full lg:w-[calc(33.333%-10.66px)]',
  }[width] || 'w-full';

  // 高さスタイル
  const heightStyle = height && HEIGHT_UNITS[height]
    ? { height: `${HEIGHT_UNITS[height]}px` }
    : {};

  // 日付フィールドを検出
  const dateField = useMemo(() => {
    return systemFields.find(f =>
      f.id.toLowerCase().includes('date') ||
      f.label.includes('日付')
    );
  }, [systemFields]);

  // 自動セグメント用のフィールド候補
  const segmentableFields = useMemo(() => {
    const fields = [];
    // 日付フィールド
    if (dateField) {
      fields.push({ ...dateField, isDate: true });
    }
    // 文字列フィールド
    systemFields.filter(f => f.type === 'string').forEach(f => {
      if (f.id !== dateField?.id) {
        fields.push({ ...f, isDate: false });
      }
    });
    return fields;
  }, [systemFields, dateField]);

  // 選択されたフィールドが日付型かどうか
  const selectedFieldIsDate = useMemo(() => {
    const field = segmentableFields.find(f => f.id === autoSegmentField);
    return field?.isDate || false;
  }, [segmentableFields, autoSegmentField]);

  // 自動セグメントを生成（階層セグメント対応）
  const autoSegments = useMemo(() => {
    if (segmentMode !== 'auto' || !autoSegmentField || dataSource.length === 0) {
      return [];
    }

    const segmentMap = new Map();
    const hasSecondary = !!secondarySegmentField;

    dataSource.forEach(row => {
      let primaryKey;
      const primaryValue = row[autoSegmentField];

      if (selectedFieldIsDate) {
        // 日付フィールドの場合は粒度に応じて変換
        primaryKey = transformDateToSegment(primaryValue, autoSegmentGranularity);
      } else {
        // その他のフィールドはそのまま値を使用
        primaryKey = primaryValue ? String(primaryValue) : '(空白)';
      }

      if (!primaryKey) return;

      // 階層セグメントの場合
      if (hasSecondary) {
        const secondaryValue = row[secondarySegmentField];
        const secondaryKey = secondaryValue ? String(secondaryValue) : '(空白)';
        const hierarchyKey = `${primaryKey} > ${secondaryKey}`;

        if (!segmentMap.has(hierarchyKey)) {
          segmentMap.set(hierarchyKey, { rows: [], primaryKey, secondaryKey });
        }
        segmentMap.get(hierarchyKey).rows.push(row);
      } else {
        // 単一セグメントの場合
        if (!segmentMap.has(primaryKey)) {
          segmentMap.set(primaryKey, { rows: [], primaryKey, secondaryKey: null });
        }
        segmentMap.get(primaryKey).rows.push(row);
      }
    });

    // セグメントをソート
    const sortedKeys = Array.from(segmentMap.keys()).sort((a, b) => {
      const dataA = segmentMap.get(a);
      const dataB = segmentMap.get(b);

      // プライマリキーでソート（日付の場合は降順）
      const primaryCompare = selectedFieldIsDate
        ? dataB.primaryKey.localeCompare(dataA.primaryKey)
        : dataA.primaryKey.localeCompare(dataB.primaryKey);

      if (primaryCompare !== 0) return primaryCompare;

      // セカンダリキーでソート（昇順）
      if (dataA.secondaryKey && dataB.secondaryKey) {
        return dataA.secondaryKey.localeCompare(dataB.secondaryKey);
      }
      return 0;
    });

    // セグメントオブジェクトを生成（最大30件に制限）
    return sortedKeys.slice(0, 30).map((key, index) => ({
      id: `auto-${index}`,
      name: key,
      colorId: SEGMENT_COLORS[index % SEGMENT_COLORS.length].id,
      rows: segmentMap.get(key).rows,
      isAuto: true,
      primaryKey: segmentMap.get(key).primaryKey,
      secondaryKey: segmentMap.get(key).secondaryKey,
    }));
  }, [segmentMode, autoSegmentField, autoSegmentGranularity, selectedFieldIsDate, secondarySegmentField, dataSource]);

  // 実際に使用するセグメント
  const activeSegments = segmentMode === 'auto' ? autoSegments : segments;

  // 全ての利用可能なフィールド（数値フィールドと計算フィールド）
  const allDisplayFields = useMemo(() => {
    const numericFields = systemFields.filter(f => f.type === 'number').map(f => ({
      id: f.id,
      label: f.label,
      type: 'field'
    }));
    const calcFields = calculations.map(c => ({
      id: c.id,
      label: c.label,
      type: 'calc',
      format: c.format,
      calcType: c.type
    }));
    return [...numericFields, ...calcFields];
  }, [systemFields, calculations]);

  // 表示するフィールド（設定で選択されている場合はそれを優先）
  const displayFields = useMemo(() => {
    if (configDisplayFieldIds && configDisplayFieldIds.length > 0) {
      // 設定で指定されたフィールドのみを順番通りに返す
      return configDisplayFieldIds
        .map(id => allDisplayFields.find(f => f.id === id))
        .filter(Boolean);
    }
    // 設定がない場合は全フィールドを表示
    return allDisplayFields;
  }, [allDisplayFields, configDisplayFieldIds]);

  // セグメントごとのデータを計算
  const segmentData = useMemo(() => {
    if (activeSegments.length === 0) return {};

    const data = {};
    activeSegments.forEach(segment => {
      // フィルターを適用
      let filteredRows;

      if (segment.isAuto) {
        // 自動セグメントの場合は既にフィルター済み
        filteredRows = segment.rows;
      } else {
        // 手動セグメントの場合はフィルターを適用
        filteredRows = [...dataSource];

        if (segment.filterType === 'dateRange' && segment.dateRange) {
          const { start, end } = segment.dateRange;
          if (start || end) {
            if (dateField) {
              filteredRows = filteredRows.filter(row => {
                const rowDate = normalizeDate(row[dateField.id] || row.date);
                const normalizedStart = start ? normalizeDate(start) : '';
                const normalizedEnd = end ? normalizeDate(end) : '';
                if (normalizedStart && rowDate < normalizedStart) return false;
                if (normalizedEnd && rowDate > normalizedEnd) return false;
                return true;
              });
            }
          }
        } else if (segment.filterType === 'column' && segment.columnFilter) {
          const { column, operator, value } = segment.columnFilter;
          if (column && value) {
            filteredRows = filteredRows.filter(row => {
              const rowValue = String(row[column] || '');
              if (operator === '=') return rowValue === value;
              if (operator === '!=') return rowValue !== value;
              if (operator === 'contains') return rowValue.includes(value);
              return true;
            });
          }
        }
      }

      // 集計
      const summary = {};

      // 数値フィールドと計算フィールドを集計
      displayFields.forEach(field => {
        if (field.type === 'field') {
          // 数値フィールドはSUM
          summary[field.id] = filteredRows.reduce((sum, row) => {
            const val = parseFloat(String(row[field.id] || '').replace(/,/g, ''));
            return sum + (isNaN(val) ? 0 : val);
          }, 0);
        } else if (field.type === 'calc') {
          const calc = calculations.find(c => c.id === field.id);
          if (calc && calc.type !== 'arithmetic') {
            // リレーション計算など（非四則演算）: 各行に計算済みの値があるので単純合計
            summary[field.id] = filteredRows.reduce((sum, row) => {
              const val = parseFloat(String(row[field.id] || '').replace(/,/g, ''));
              return sum + (isNaN(val) ? 0 : val);
            }, 0);
          } else if (calc && calc.type === 'arithmetic') {
            // 四則演算: 元の項目の合計値を使って再計算
            const termSums = {};
            if (calc.terms && calc.terms.length > 0) {
              calc.terms.forEach(term => {
                if (term.field && termSums[term.field] === undefined) {
                  termSums[term.field] = filteredRows.reduce((sum, row) => {
                    const val = parseFloat(String(row[term.field] || '').replace(/,/g, ''));
                    return sum + (isNaN(val) ? 0 : val);
                  }, 0);
                }
              });
              // 計算実行
              let res = termSums[calc.terms[0].field] || 0;
              for (let i = 1; i < calc.terms.length; i++) {
                const term = calc.terms[i];
                const val = termSums[term.field] || 0;
                if (term.operator === '+') res += val;
                else if (term.operator === '-') res -= val;
                else if (term.operator === '*') res *= val;
                else if (term.operator === '/') res = val !== 0 ? res / val : 0;
              }
              summary[field.id] = calc.format === 'percent' ? res * 100 : res;
            } else if (calc.fieldA && calc.fieldB) {
              termSums[calc.fieldA] = filteredRows.reduce((sum, row) => {
                const val = parseFloat(String(row[calc.fieldA] || '').replace(/,/g, ''));
                return sum + (isNaN(val) ? 0 : val);
              }, 0);
              termSums[calc.fieldB] = filteredRows.reduce((sum, row) => {
                const val = parseFloat(String(row[calc.fieldB] || '').replace(/,/g, ''));
                return sum + (isNaN(val) ? 0 : val);
              }, 0);
              const a = termSums[calc.fieldA] || 0;
              const b = termSums[calc.fieldB] || 0;
              let res = 0;
              if (calc.operator === '+') res = a + b;
              else if (calc.operator === '-') res = a - b;
              else if (calc.operator === '*') res = a * b;
              else if (calc.operator === '/') res = b !== 0 ? a / b : 0;
              summary[field.id] = calc.format === 'percent' ? res * 100 : res;
            }
          }
        }
      });

      data[segment.id] = {
        rowCount: filteredRows.length,
        summary
      };
    });

    return data;
  }, [activeSegments, dataSource, calculations, displayFields, dateField]);

  // 差分計算
  const calculateDiff = (currentValue, baseValue) => {
    if (baseValue === 0) return { value: 0, percent: 0 };
    const diff = currentValue - baseValue;
    const percent = (diff / baseValue) * 100;
    return { value: diff, percent };
  };

  // セグメント追加
  const handleAddSegment = () => {
    const usedColors = segments.map(s => s.colorId);
    const availableColor = SEGMENT_COLORS.find(c => !usedColors.includes(c.id)) || SEGMENT_COLORS[0];
    setEditingSegment({
      name: '',
      colorId: availableColor.id,
      filterType: 'dateRange',
      dateRange: { start: '', end: '' },
      columnFilter: { column: '', operator: '=', value: '' }
    });
    setIsModalOpen(true);
  };

  // セグメント保存
  const handleSaveSegment = (segment) => {
    const existing = segments.find(s => s.id === segment.id);
    let newSegments;
    let newBaseSegmentId = baseSegmentId;

    if (existing) {
      newSegments = segments.map(s => s.id === segment.id ? segment : s);
    } else {
      newSegments = [...segments, segment];
      if (newSegments.length === 1) {
        newBaseSegmentId = segment.id;
      }
    }

    setSegments(newSegments);
    setBaseSegmentId(newBaseSegmentId);
    updateConfig({ segments: newSegments, baseSegmentId: newBaseSegmentId });
  };

  // セグメント削除
  const handleDeleteSegment = (segmentId) => {
    const newSegments = segments.filter(s => s.id !== segmentId);
    const newBaseSegmentId = baseSegmentId === segmentId ? (newSegments[0]?.id || null) : baseSegmentId;

    setSegments(newSegments);
    setBaseSegmentId(newBaseSegmentId);
    updateConfig({ segments: newSegments, baseSegmentId: newBaseSegmentId });
  };

  // 数値フォーマット
  const formatNumber = (value, format) => {
    if (value === null || value === undefined || isNaN(value)) return '-';
    if (format === 'percent') {
      return `${value.toFixed(2)}%`;
    }
    return value.toLocaleString('ja-JP', { maximumFractionDigits: 2 });
  };

  const getSegmentColor = (colorId) => {
    return SEGMENT_COLORS.find(c => c.id === colorId) || SEGMENT_COLORS[0];
  };

  const textClass = theme === 'dark' ? 'text-white' : 'text-gray-800';
  const borderClass = theme === 'dark' ? 'border-white/10' : 'border-gray-200';

  // 基準セグメントIDの設定（自動セグメントの場合）
  useEffect(() => {
    if (segmentMode === 'auto' && autoSegments.length > 0 && !baseSegmentId) {
      setBaseSegmentId(autoSegments[0].id);
    }
  }, [segmentMode, autoSegments, baseSegmentId]);

  return (
    <div className={`${glassClass} rounded-2xl overflow-hidden ${widthClass} flex flex-col`} style={heightStyle}>
      {/* ヘッダー（DataTableと同じスタイル） */}
      <div className={`p-4 border-b flex flex-wrap justify-between items-center gap-2 ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-gray-300 bg-gray-50'}`}>
        <div className="flex items-center gap-4 flex-wrap">
          <h3 className={`text-sm font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
            <GitCompare size={16} className="text-cyan-400" /> {label}
          </h3>

          {/* セグメントモード切替 */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setSegmentMode('manual'); updateConfig({ segmentMode: 'manual' }); }}
              className={`px-2 py-1 rounded text-xs ${segmentMode === 'manual'
                  ? 'bg-indigo-500 text-white'
                  : theme === 'dark' ? 'bg-white/10 text-white/60' : 'bg-gray-100 text-gray-600'
                }`}
            >
              手動
            </button>
            <button
              onClick={() => { setSegmentMode('auto'); updateConfig({ segmentMode: 'auto' }); }}
              className={`px-2 py-1 rounded text-xs ${segmentMode === 'auto'
                  ? 'bg-indigo-500 text-white'
                  : theme === 'dark' ? 'bg-white/10 text-white/60' : 'bg-gray-100 text-gray-600'
                }`}
            >
              自動
            </button>
          </div>

          {/* 自動セグメント設定 */}
          {segmentMode === 'auto' && (
            <div className="flex items-center gap-2">
              <select
                value={autoSegmentField}
                onChange={(e) => { setAutoSegmentField(e.target.value); updateConfig({ autoSegmentField: e.target.value }); }}
                className={`px-2 py-1 rounded text-xs ${theme === 'dark' ? 'bg-slate-700 border border-white/10 text-white' : 'bg-gray-50 border border-gray-300 text-gray-800'}`}
              >
                <option value="">カラム選択</option>
                {segmentableFields.map(f => (
                  <option key={f.id} value={f.id}>{f.label}{f.isDate ? ' (日付)' : ''}</option>
                ))}
              </select>
              {selectedFieldIsDate && (
                <select
                  value={autoSegmentGranularity}
                  onChange={(e) => { setAutoSegmentGranularity(e.target.value); updateConfig({ autoSegmentGranularity: e.target.value }); }}
                  className={`px-2 py-1 rounded text-xs ${theme === 'dark' ? 'bg-slate-700 border border-white/10 text-white' : 'bg-gray-50 border border-gray-300 text-gray-800'}`}
                >
                  {GRANULARITY_OPTIONS.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              )}
              {/* 階層セグメント（サブセグメント）選択 */}
              {autoSegmentField && (
                <>
                  <span className={`text-xs ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>&gt;</span>
                  <select
                    value={secondarySegmentField}
                    onChange={(e) => { setSecondarySegmentField(e.target.value); updateConfig({ secondarySegmentField: e.target.value }); }}
                    className={`px-2 py-1 rounded text-xs ${secondarySegmentField
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : theme === 'dark' ? 'bg-slate-700 border border-white/10 text-white' : 'bg-gray-50 border border-gray-300 text-gray-800'
                      }`}
                  >
                    <option value="">サブセグメント (任意)</option>
                    {segmentableFields
                      .filter(f => f.id !== autoSegmentField && !f.isDate)
                      .map(f => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                  </select>
                </>
              )}
            </div>
          )}

          {/* レイアウト切り替え */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setLayout('horizontal'); updateConfig({ layout: 'horizontal' }); }}
              className={`px-2 py-1 rounded text-xs ${layout === 'horizontal'
                  ? 'bg-indigo-500 text-white'
                  : theme === 'dark' ? 'bg-white/10 text-white/60' : 'bg-gray-100 text-gray-600'
                }`}
            >
              横並び
            </button>
            <button
              onClick={() => { setLayout('vertical'); updateConfig({ layout: 'vertical' }); }}
              className={`px-2 py-1 rounded text-xs ${layout === 'vertical'
                  ? 'bg-indigo-500 text-white'
                  : theme === 'dark' ? 'bg-white/10 text-white/60' : 'bg-gray-100 text-gray-600'
                }`}
            >
              縦並び
            </button>
          </div>

          {/* 軸入れ替えボタン */}
          {layout === 'horizontal' && (
            <button
              onClick={() => { const newVal = !axisSwapped; setAxisSwapped(newVal); updateConfig({ axisSwapped: newVal }); }}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${axisSwapped
                  ? 'bg-amber-500/20 text-amber-400'
                  : theme === 'dark' ? 'bg-white/10 text-white/60' : 'bg-gray-100 text-gray-600'
                }`}
              title="指標とセグメントの軸を入れ替え"
            >
              <RotateCcw size={12} />
              軸入替
            </button>
          )}

          {/* 差分表示トグル */}
          <button
            onClick={() => { const newVal = !showDiff; setShowDiff(newVal); updateConfig({ showDiff: newVal }); }}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${showDiff
                ? 'bg-emerald-500/20 text-emerald-400'
                : theme === 'dark' ? 'bg-white/10 text-white/60' : 'bg-gray-100 text-gray-600'
              }`}
          >
            {showDiff ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
            差分
          </button>

          {/* フィルターボタン */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${Object.keys(localFilters).some(k => localFilters[k]?.length > 0)
                ? 'bg-blue-500/20 text-blue-400'
                : theme === 'dark' ? 'bg-white/10 text-white/60' : 'bg-gray-100 text-gray-600'
              }`}
          >
            <Filter size={12} />
            フィルター
            {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {/* 列固定ドロップダウン */}
          {layout === 'horizontal' && displayFields.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setStickyDropdownOpen(!stickyDropdownOpen)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${stickyColumns > 0
                    ? 'bg-amber-500/20 text-amber-400'
                    : theme === 'dark' ? 'bg-white/10 text-white/60 hover:text-white' : 'bg-gray-100 text-gray-600 hover:text-gray-800'
                  }`}
              >
                <Lock size={12} />
                <span>固定列: {stickyColumns}</span>
              </button>
              {stickyDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setStickyDropdownOpen(false)} />
                  <div className={`absolute top-full left-0 mt-1 z-50 rounded-lg shadow-lg min-w-[120px] py-1 ${theme === 'dark' ? 'bg-slate-800 border border-white/10' : 'bg-white border border-gray-300'}`}>
                    {[0, 1, 2, 3].map(num => (
                      <button
                        key={num}
                        onClick={() => {
                          setStickyColumns(num);
                          setStickyDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${stickyColumns === num
                            ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700')
                            : (theme === 'dark' ? 'text-white/80 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100')
                          }`}
                      >
                        {num === 0 ? '固定なし' : `${num}列固定`}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* 右側: データ件数と追加ボタン */}
        <div className="flex items-center gap-3">
          <span className={`text-xs ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>
            {dataSource.length.toLocaleString()} 件
          </span>
          {segmentMode === 'manual' && (
            <button
              onClick={handleAddSegment}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${theme === 'dark'
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
            >
              <Plus size={14} />
              追加
            </button>
          )}
        </div>
      </div>

      {/* フィルターパネル */}
      {showFilters && (
        <div className={`p-3 border-b ${borderClass} ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-50'}`}>
          <div className="flex flex-wrap gap-2 items-center">
            <span className={`text-xs ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>絞り込み:</span>
            {systemFields.filter(f => f.type === 'string').slice(0, 5).map(field => {
              const uniqueValues = [...new Set(filteredData.map(row => {
                const val = row[field.id];
                return val === undefined || val === null || val === '' ? '(空白)' : String(val);
              }))].sort();

              const selectedValues = localFilters[field.id] || [];
              const hasFilter = selectedValues.length > 0;

              return (
                <div key={field.id} className="relative">
                  <select
                    value=""
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      const current = localFilters[field.id] || [];
                      const newValues = current.includes(val)
                        ? current.filter(v => v !== val)
                        : [...current, val];
                      const newFilters = { ...localFilters, [field.id]: newValues };
                      setLocalFilters(newFilters);
                      updateConfig({ localFilters: newFilters });
                    }}
                    className={`px-2 py-1 pr-6 rounded text-xs appearance-none cursor-pointer ${hasFilter
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : theme === 'dark' ? 'bg-slate-700 border border-white/10 text-white' : 'bg-white border border-gray-300 text-gray-800'
                      }`}
                  >
                    <option value="">{field.label}{hasFilter ? ` (${selectedValues.length})` : ''}</option>
                    {uniqueValues.map(val => (
                      <option key={val} value={val}>
                        {selectedValues.includes(val) ? '✓ ' : ''}{val}
                      </option>
                    ))}
                  </select>
                  {hasFilter && (
                    <button
                      onClick={() => {
                        const newFilters = { ...localFilters, [field.id]: [] };
                        setLocalFilters(newFilters);
                        updateConfig({ localFilters: newFilters });
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-300"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              );
            })}
            {Object.keys(localFilters).some(k => localFilters[k]?.length > 0) && (
              <button
                onClick={() => {
                  setLocalFilters({});
                  updateConfig({ localFilters: {} });
                }}
                className={`px-2 py-1 rounded text-xs ${theme === 'dark' ? 'text-red-400 hover:bg-red-500/20' : 'text-red-600 hover:bg-red-50'}`}
              >
                全解除
              </button>
            )}
          </div>
          {/* 適用中フィルター表示 */}
          {Object.keys(localFilters).some(k => localFilters[k]?.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(localFilters).map(([fieldId, values]) => {
                if (!values || values.length === 0) return null;
                const field = systemFields.find(f => f.id === fieldId);
                return values.map(val => (
                  <span
                    key={`${fieldId}-${val}`}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${theme === 'dark' ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}
                  >
                    {field?.label}: {val}
                    <button
                      onClick={() => {
                        const newValues = values.filter(v => v !== val);
                        const newFilters = { ...localFilters, [fieldId]: newValues };
                        setLocalFilters(newFilters);
                        updateConfig({ localFilters: newFilters });
                      }}
                      className="hover:text-red-400"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ));
              })}
            </div>
          )}
        </div>
      )}

      {/* セグメント一覧（手動モードのみ表示） */}
      {segmentMode === 'manual' && (
        <div className={`min-h-[48px] flex items-center gap-2 p-3 border-b overflow-x-auto ${borderClass}`}>
          {segments.length === 0 ? (
            <span className={`text-xs ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>
              「追加」ボタンからセグメントを追加してください
            </span>
          ) : segments.map(segment => {
            const color = getSegmentColor(segment.colorId);
            const isBase = baseSegmentId === segment.id;
            return (
              <div
                key={segment.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${theme === 'dark' ? 'bg-slate-700/50 border-white/10' : 'bg-gray-100 border-gray-200'} border ${isBase ? 'ring-2 ring-indigo-500/50' : ''}`}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color.hex }} />
                <span className={textClass}>{segment.name}</span>
                {isBase && <span className={`text-xs ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>(基準)</span>}
                <button
                  onClick={() => {
                    setEditingSegment(segment);
                    setIsModalOpen(true);
                  }}
                  className={`hover:opacity-80 ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}
                >
                  <Edit2 size={12} />
                </button>
                <button
                  onClick={() => handleDeleteSegment(segment.id)}
                  className={`hover:text-red-400 ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}
                >
                  <X size={12} />
                </button>
                {!isBase && showDiff && (
                  <button
                    onClick={() => setBaseSegmentId(segment.id)}
                    className={`text-xs hover:text-indigo-400 ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}
                    title="基準に設定"
                  >
                    基準
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 比較テーブル */}
      <div className="flex-1 overflow-auto" ref={bodyRef}>
        {activeSegments.length === 0 ? (
          <div className={`text-center py-8 ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>
            {segmentMode === 'auto' ? 'カラムを選択してください' : 'セグメントを追加してください'}
          </div>
        ) : layout === 'horizontal' ? (
          axisSwapped ? (
            // 軸入れ替え後: 横軸が指標、縦軸がセグメント
            <table className="w-full">
              <thead className={`sticky top-0 z-10 ${theme === 'dark' ? 'bg-[#0f172a]' : 'bg-gray-100'}`}>
                <tr className={`border-b ${borderClass}`}>
                  <th className={`text-left py-3 px-4 text-xs font-medium whitespace-nowrap border-r ${theme === 'dark' ? 'text-white/60 border-white/10' : 'text-gray-600 border-gray-200'} ${stickyColumns >= 1 ? `sticky left-0 z-20 ${theme === 'dark' ? 'bg-[#0f172a]' : 'bg-gray-100'}` : ''}`}>
                    セグメント
                  </th>
                  {displayFields.slice(0, 10).map(field => (
                    <th key={field.id} className={`text-right py-3 px-4 text-xs font-medium whitespace-nowrap border-r ${theme === 'dark' ? 'text-white/60 border-white/10' : 'text-gray-600 border-gray-200'}`}>
                      {field.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeSegments.map((segment, segmentIndex) => {
                  const color = getSegmentColor(segment.colorId);
                  const data = segmentData[segment.id] || { rowCount: 0, summary: {} };

                  // 日付自動セグメントの場合は直前期間（1つ後ろ＝古い方）と比較、手動の場合は基準セグメントと比較
                  // ※日付セグメントは降順ソート（最新が上）なので、index+1が直前期間
                  const usePreviousPeriod = segmentMode === 'auto' && selectedFieldIsDate;
                  const olderSegment = segmentIndex < activeSegments.length - 1 ? activeSegments[segmentIndex + 1] : null;
                  const baseData = usePreviousPeriod && olderSegment
                    ? segmentData[olderSegment.id]?.summary || {}
                    : segmentData[baseSegmentId]?.summary || {};
                  // 最古のセグメント（最後のindex）は比較対象なし
                  const isOldest = usePreviousPeriod && segmentIndex === activeSegments.length - 1;
                  const isBase = usePreviousPeriod ? isOldest : baseSegmentId === segment.id;

                  // 縞々背景と hover効果
                  const rowBgClass = segmentIndex % 2 === 0 ? '' : (theme === 'dark' ? 'bg-white/[0.02]' : 'bg-gray-50/50');
                  const hoverClass = theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50';

                  return (
                    <tr key={segment.id} className={`border-b ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'} ${rowBgClass} ${hoverClass}`}>
                      <td className={`py-2 px-4 text-sm border-r ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'} ${textClass} ${stickyColumns >= 1 ? `sticky left-0 ${theme === 'dark' ? 'bg-[#0f172a]' : 'bg-white'}` : ''}`}>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color.hex }} />
                          <span className="whitespace-nowrap">{segment.name}</span>
                          {usePreviousPeriod && segmentIndex === 0 && <span className={`text-xs whitespace-nowrap ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>(最新)</span>}
                          {isBase && showDiff && <span className={`text-xs whitespace-nowrap ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>{usePreviousPeriod ? '(最古)' : '(基準)'}</span>}
                        </div>
                      </td>
                      {displayFields.slice(0, 10).map(field => {
                        const value = data.summary[field.id] || 0;
                        const diff = !isBase && showDiff ? calculateDiff(value, baseData[field.id] || 0) : null;

                        return (
                          <td key={field.id} className={`text-right py-2 px-4 text-sm font-medium border-r ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'} ${textClass}`}>
                            <div>{formatNumber(value, field.format)}</div>
                            {diff && (
                              <div className={`text-xs flex items-center justify-end gap-0.5 ${diff.percent > 0 ? 'text-emerald-400' :
                                  diff.percent < 0 ? 'text-red-400' :
                                    'text-gray-400'
                                }`}>
                                {diff.percent > 0 ? <ArrowUpRight size={10} /> :
                                  diff.percent < 0 ? <ArrowDownRight size={10} /> :
                                    <Minus size={10} />}
                                {diff.percent !== 0 ? `${diff.percent > 0 ? '+' : ''}${diff.percent.toFixed(1)}%` : '-'}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            // 通常: 横軸がセグメント、縦軸が指標
            <table className="w-full">
              <thead className={`sticky top-0 z-10 ${theme === 'dark' ? 'bg-[#0f172a]' : 'bg-gray-100'}`}>
                <tr className={`border-b ${borderClass}`}>
                  <th className={`text-left py-3 px-4 text-xs font-medium whitespace-nowrap border-r ${theme === 'dark' ? 'text-white/60 border-white/10' : 'text-gray-600 border-gray-200'} ${stickyColumns >= 1 ? `sticky left-0 z-20 ${theme === 'dark' ? 'bg-[#0f172a]' : 'bg-gray-100'}` : ''}`}>
                    指標
                  </th>
                  {activeSegments.map(segment => {
                    const color = getSegmentColor(segment.colorId);
                    return (
                      <th key={segment.id} className={`text-right py-3 px-4 text-xs font-medium whitespace-nowrap border-r ${theme === 'dark' ? 'text-white/60 border-white/10' : 'text-gray-600 border-gray-200'}`}>
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color.hex }} />
                          <span className={textClass}>{segment.name}</span>
                        </div>
                        <div className={`text-xs font-normal ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>
                          ({segmentData[segment.id]?.rowCount || 0}件)
                        </div>
                      </th>
                    );
                  })}
                  {showDiff && activeSegments.length > 1 && (
                    <th className={`text-right py-3 px-4 text-xs font-medium whitespace-nowrap border-r ${theme === 'dark' ? 'text-white/60 border-white/10' : 'text-gray-600 border-gray-200'}`}>
                      差分
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {displayFields.slice(0, 10).map((field, fieldIndex) => {
                  // 日付自動セグメントの場合は最新（index 0）と直前期間（index 1）を比較
                  // ※日付セグメントは降順ソート（最新が上）
                  const usePreviousPeriod = segmentMode === 'auto' && selectedFieldIsDate;
                  const newestSegment = activeSegments[0];  // 最新
                  const olderSegment = activeSegments.length > 1 ? activeSegments[1] : null;  // 直前期間
                  const compareSegment = usePreviousPeriod && olderSegment
                    ? olderSegment
                    : activeSegments.find(s => s.id === baseSegmentId) || activeSegments[0];
                  const newestValue = segmentData[newestSegment?.id]?.summary?.[field.id] || 0;
                  const compareValue = segmentData[compareSegment?.id]?.summary?.[field.id] || 0;
                  const diff = calculateDiff(newestValue, compareValue);

                  // 縞々背景と hover効果
                  const rowBgClass = fieldIndex % 2 === 0 ? '' : (theme === 'dark' ? 'bg-white/[0.02]' : 'bg-gray-50/50');
                  const hoverClass = theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50';

                  return (
                    <tr key={field.id} className={`border-b ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'} ${rowBgClass} ${hoverClass}`}>
                      <td className={`py-2 px-4 text-sm whitespace-nowrap border-r ${theme === 'dark' ? 'text-white/80 border-white/5' : 'text-gray-700 border-gray-100'} ${stickyColumns >= 1 ? `sticky left-0 ${theme === 'dark' ? 'bg-[#0f172a]' : 'bg-white'}` : ''}`}>
                        {field.label}
                      </td>
                      {activeSegments.map(segment => {
                        const value = segmentData[segment.id]?.summary?.[field.id] || 0;
                        return (
                          <td key={segment.id} className={`text-right py-2 px-4 text-sm font-medium whitespace-nowrap border-r ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'} ${textClass}`}>
                            {formatNumber(value, field.format)}
                          </td>
                        );
                      })}
                      {showDiff && activeSegments.length > 1 && (
                        <td className={`text-right py-2 px-4 text-sm font-medium border-r ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                          <div className={`flex items-center justify-end gap-1 ${diff.percent > 0 ? 'text-emerald-400' :
                              diff.percent < 0 ? 'text-red-400' :
                                theme === 'dark' ? 'text-white/40' : 'text-gray-400'
                            }`}>
                            {diff.percent > 0 ? <ArrowUpRight size={14} /> :
                              diff.percent < 0 ? <ArrowDownRight size={14} /> :
                                <Minus size={14} />}
                            {diff.percent !== 0 ? `${diff.percent > 0 ? '+' : ''}${diff.percent.toFixed(1)}%` : '-'}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : (
          // 縦並びレイアウト
          <div className="space-y-4">
            {activeSegments.map((segment, segmentIndex) => {
              const color = getSegmentColor(segment.colorId);
              const data = segmentData[segment.id] || { rowCount: 0, summary: {} };

              // 日付自動セグメントの場合は直前期間（1つ後ろ＝古い方）と比較
              // ※日付セグメントは降順ソート（最新が上）
              const usePreviousPeriod = segmentMode === 'auto' && selectedFieldIsDate;
              const olderSegment = segmentIndex < activeSegments.length - 1 ? activeSegments[segmentIndex + 1] : null;
              const baseData = usePreviousPeriod && olderSegment
                ? segmentData[olderSegment.id]?.summary || {}
                : segmentData[baseSegmentId]?.summary || {};
              const isOldest = usePreviousPeriod && segmentIndex === activeSegments.length - 1;
              const isBase = usePreviousPeriod ? isOldest : baseSegmentId === segment.id;

              return (
                <div key={segment.id} className={`rounded-lg p-4 ${theme === 'dark' ? 'bg-slate-800/50 border-white/10' : 'bg-gray-50 border-gray-200'} border`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color.hex }} />
                      <span className={`font-medium ${textClass}`}>{segment.name}</span>
                      {usePreviousPeriod && segmentIndex === 0 && <span className={`text-xs ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>(最新)</span>}
                      {isBase && showDiff && <span className={`text-xs ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>{usePreviousPeriod ? '(最古)' : '(基準)'}</span>}
                    </div>
                    <span className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>{data.rowCount}件</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {displayFields.slice(0, 8).map(field => {
                      const value = data.summary[field.id] || 0;
                      const diff = !isBase && showDiff ? calculateDiff(value, baseData[field.id] || 0) : null;

                      return (
                        <div key={field.id} className={`${theme === 'dark' ? 'bg-black/20' : 'bg-white'} rounded p-2`}>
                          <div className={`text-xs ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
                            {field.label}
                          </div>
                          <div className={`text-lg font-bold ${textClass}`}>
                            {formatNumber(value, field.format)}
                          </div>
                          {diff && (
                            <div className={`text-xs flex items-center gap-0.5 ${diff.percent > 0 ? 'text-emerald-400' :
                                diff.percent < 0 ? 'text-red-400' :
                                  'text-gray-400'
                              }`}>
                              {diff.percent > 0 ? <ArrowUpRight size={10} /> :
                                diff.percent < 0 ? <ArrowDownRight size={10} /> :
                                  <Minus size={10} />}
                              {diff.percent !== 0 ? `${diff.percent > 0 ? '+' : ''}${diff.percent.toFixed(1)}%` : '-'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SegmentEditModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        segment={editingSegment}
        onSave={handleSaveSegment}
        systemFields={systemFields}
        theme={theme}
      />
    </div>
  );
};

export default ComparisonTable;
