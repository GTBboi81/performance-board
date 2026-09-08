// src/apps/performance-board/components/settings/IndicatorTab.jsx
// 指標設定タブ（基本指標マッピング + 計算指標）

import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Table,
  Calculator,
  Edit3,
  Calendar,
  X,
  Link2,
  Star,
  Save,
  Copy,
  Layers,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Folder,
  Search,
  ArrowUp,
  ArrowDown,
  AlertTriangle
} from 'lucide-react';
import { CONDITIONAL_OPERATORS, CONDITIONAL_FORMAT_OPERATORS, CONDITIONAL_FORMAT_COLORS, CONDITIONAL_FORMAT_WEIGHTS } from '../../../../constants';

const IndicatorTab = ({
  localConfig,
  updateLocalConfig,
  theme,
  glassClass,
  inputClass,
  textClass,
  textMutedClass,
  labelClass,
  labelSmClass,
  labelXsClass,
  cardClass,
  borderClass,
  optionClass,
  sourceCache
}) => {
  // サブタブ状態
  const [indicatorSubTab, setIndicatorSubTab] = useState('mapping');
  const [calcType, setCalcType] = useState('arithmetic');

  // フィールド追加用
  const [newField, setNewField] = useState({ label: '', type: 'number' });
  // フィールド名編集用
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [editingFieldLabel, setEditingFieldLabel] = useState('');

  // 計算ロジック用
  const [newCalc, setNewCalc] = useState({
    id: null, label: '', type: 'arithmetic', format: 'percent',
    terms: [{ field: '' }],
    targetSourceId: '', foreignKeyIndex: '', localKeyId: 'id', aggType: 'count', aggTargetIndex: '', countUnit: '', countUnitRules: [], countUnitDefault: 1, filters: [], dateColumnIndex: '', extraDateColumnIndices: [], excludeDaysOfMonth: [], filterMappings: {},
    dateDiffFilter: { enabled: false, dateColumnA: '', dateColumnB: '', useToday: false, maxDays: 7, direction: 'within' },
    constantValue: '', constantType: 'decimal'
  });
  const [isEditingCalc, setIsEditingCalc] = useState(false);
  const [calcFormError, setCalcFormError] = useState('');
  // 指標グループの折りたたみ状態
  const [collapsedGroupIds, setCollapsedGroupIds] = useState(new Set());
  const [calcDragState, setCalcDragState] = useState({ dragging: null, hoverIdx: null });
  const [expandedCalcIds, setExpandedCalcIds] = useState(new Set());

  // フォルダ管理
  const [collapsedFolderIds, setCollapsedFolderIds] = useState(new Set());
  // 一括作成モーダル
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkConfig, setBulkConfig] = useState({ filterIndex: 0, baseName: '', separator: '_', selectedValues: [], createFolder: false, folderName: '' });
  const [bulkCreateError, setBulkCreateError] = useState('');
  // フォルダ移動ポップアップ
  const [folderMoveCalcId, setFolderMoveCalcId] = useState(null);
  // フォルダ検索
  const [calcSearchText, setCalcSearchText] = useState('');

  // ヘッダー名にfieldMetadataのラベルを付与（API名→ラベル）
  const displayHeader = (header, source) => {
    const meta = source?.fieldMetadata;
    if (meta?.[header] && meta[header] !== header) return `${meta[header]}`;
    return header;
  };

  // 派生データ
  const numericFields = [
    ...localConfig.systemFields.filter(f => f.type === 'number'),
    ...localConfig.calculations,
    ...(localConfig.indicatorGroups || []).filter(g => g.memberCalcIds?.length > 0).map(g => ({ id: g.id, label: `[G] ${g.label}`, type: 'number' })),
  ];
  const targetSource = localConfig.dataSources.find(s => s.id === newCalc.targetSourceId);
  const targetHeaders = targetSource && Array.isArray(targetSource.headers) ? targetSource.headers : [];
  const mainKeySettings = localConfig.mainKey || { sourceId: '', columnIndex: '' };
  const dateSettings = localConfig.dateSettings || { type: 'auto' };

  // フィールド操作
  const handleAddField = () => {
    if (!newField.label) return;
    const id = `${newField.label.replace(/\s+/g, '_')}_${Date.now()}`;
    const newSystemFields = [...localConfig.systemFields, { id, label: newField.label, type: newField.type }];
    updateLocalConfig('systemFields', newSystemFields);
    setNewField({ label: '', type: 'number' });
  };

  const handleDeleteField = (id) => {
    if (window.confirm('この項目を削除しますか？')) {
      updateLocalConfig('systemFields', localConfig.systemFields.filter(f => f.id !== id));
      const newMapping = { ...localConfig.mapping };
      delete newMapping[id];
      updateLocalConfig('mapping', newMapping);
    }
  };

  const updateSystemField = (fieldId, key, value) => {
    updateLocalConfig('systemFields', localConfig.systemFields.map(f =>
      f.id === fieldId ? { ...f, [key]: value } : f
    ));
  };

  const updateMapping = (fieldId, sourceId, columnIndex) => {
    const source = localConfig.dataSources.find(s => s.id === sourceId);
    const columnName = source?.headers?.[parseInt(columnIndex)] || '';
    updateLocalConfig('mapping', {
      ...localConfig.mapping,
      [fieldId]: { sourceId, columnIndex: parseInt(columnIndex), columnName }
    });
  };

  const updateMainKey = (key, value) => {
    const currentSettings = localConfig.mainKey || { sourceId: '', columnIndex: '' };
    updateLocalConfig('mainKey', { ...currentSettings, [key]: value });
  };

  const updateDateSettings = (key, value) => {
    const currentSettings = localConfig.dateSettings || { type: 'auto', sourceId: '', columnIndex: '' };
    updateLocalConfig('dateSettings', { ...currentSettings, [key]: value });
  };

  // calcData 組み立て共通ロジック
  const buildCalcData = (calcForm, type, headers, src) => {
    const calcData = { ...calcForm, type };
    if (type === 'constant') {
      if (calcForm.constantValue === '' || calcForm.constantValue === undefined || isNaN(calcForm.constantValue)) return null;
      calcData.format = 'number';
      calcData.constantValue = calcForm.constantType === 'integer' ? Math.floor(calcForm.constantValue) : calcForm.constantValue;
      calcData.constantType = calcForm.constantType || 'decimal';
    }
    if (type === 'relation' || type === 'conditionalCount') {
      calcData.format = 'number';
      if (calcForm.foreignKeyIndex !== '' && calcForm.foreignKeyIndex !== null) calcData.foreignKeyColumnName = headers[parseInt(calcForm.foreignKeyIndex)] || '';
      if (calcForm.aggTargetIndex !== '' && calcForm.aggTargetIndex !== null) calcData.aggTargetColumnName = headers[parseInt(calcForm.aggTargetIndex)] || '';
      if (calcForm.dateColumnIndex !== '' && calcForm.dateColumnIndex !== null) calcData.dateColumnName = headers[parseInt(calcForm.dateColumnIndex)] || '';
      if (calcForm.extraDateColumnIndices?.length > 0) {
        calcData.extraDateColumnIndices = calcForm.extraDateColumnIndices.filter(idx => idx !== '');
        calcData.extraDateColumnNames = calcData.extraDateColumnIndices.map(idx => headers[parseInt(idx)] || '');
      } else { calcData.extraDateColumnIndices = []; calcData.extraDateColumnNames = []; }
      if (calcForm.excludeDaysOfMonth?.length > 0) { calcData.excludeDaysOfMonth = calcForm.excludeDaysOfMonth; } else { calcData.excludeDaysOfMonth = []; }
      if (calcForm.filterMappings && Object.keys(calcForm.filterMappings).length > 0) {
        calcData.filterMappingNames = {};
        Object.keys(calcForm.filterMappings).forEach(key => { const idx = calcForm.filterMappings[key]; if (idx !== '' && idx !== null) calcData.filterMappingNames[key] = headers[parseInt(idx)] || ''; });
      }
      if (calcForm.filters?.length > 0) { calcData.filters = calcForm.filters.map(f => ({ ...f, columnName: f.colIndex !== '' && f.colIndex !== null ? (headers[parseInt(f.colIndex)] || '') : '' })); }
      if (calcForm.conditions?.length > 0) { calcData.conditions = calcForm.conditions.map(c => ({ ...c, columnName: c.columnIndex !== '' && c.columnIndex !== null ? (headers[parseInt(c.columnIndex)] || '') : '' })); }
      if (calcForm.countUnitRules?.length > 0) {
        calcData.countUnitRules = calcForm.countUnitRules.map(rule => ({ ...rule, columnName: rule.colIndex !== '' && rule.colIndex !== null ? (headers[parseInt(rule.colIndex)] || '') : '' }));
        calcData.countUnitDefault = calcForm.countUnitDefault ?? 1;
      } else { calcData.countUnitRules = []; calcData.countUnitDefault = 1; }
      if (calcForm.dateDiffFilter?.enabled) {
        calcData.dateDiffFilter = { ...calcForm.dateDiffFilter };
        if (calcData.dateDiffFilter.dateColumnA !== '' && calcData.dateDiffFilter.dateColumnA !== null) calcData.dateDiffFilter.dateColumnAName = headers[parseInt(calcData.dateDiffFilter.dateColumnA)] || '';
        if (!calcData.dateDiffFilter.useToday && calcData.dateDiffFilter.dateColumnB !== '' && calcData.dateDiffFilter.dateColumnB !== null) calcData.dateDiffFilter.dateColumnBName = headers[parseInt(calcData.dateDiffFilter.dateColumnB)] || '';
      } else { calcData.dateDiffFilter = { enabled: false, dateColumnA: '', dateColumnB: '', useToday: false, maxDays: 7, direction: 'within' }; }
    }
    return calcData;
  };

  // 計算ロジック操作
  const handleSaveCalculation = () => {
    if (!newCalc.label?.trim()) {
      setCalcFormError('指標名を入力してください。');
      return;
    }
    const calcData = buildCalcData(newCalc, calcType, targetHeaders, targetSource);
    if (!calcData) {
      setCalcFormError('固定値に有効な数値を入力してください。');
      return;
    }

    setCalcFormError('');
    let newCalculations;
    if (isEditingCalc) {
      newCalculations = localConfig.calculations.map(c => c.id === newCalc.id ? calcData : c);
      setIsEditingCalc(false);
    } else {
      const id = `calc_${Date.now()}`;
      const newEntry = { ...calcData, id };
      if (pendingFolderId) newEntry.folderId = pendingFolderId;
      newCalculations = [...localConfig.calculations, newEntry];
    }
    updateLocalConfig('calculations', newCalculations);
    setPendingFolderId(null);
    resetCalcForm();
  };

  const resetCalcForm = () => {
    setNewCalc({ id: null, label: '', type: 'arithmetic', format: 'percent', terms: [{ field: '' }], targetSourceId: '', foreignKeyIndex: '', localKeyId: 'id', aggType: 'count', aggTargetIndex: '', filters: [], dateColumnIndex: '', extraDateColumnIndices: [], excludeDaysOfMonth: [], filterMappings: {}, constantValue: '', constantType: 'decimal' });
    setCalcType('arithmetic');
    setCalcFormError('');
  };

  const handleEditCalculation = (calc) => {
    setCalcType(calc.type || 'arithmetic');
    let editData = { ...calc };
    if (calc.type === 'arithmetic' && !calc.terms && calc.fieldA) {
      editData.terms = [{ field: calc.fieldA }, { operator: calc.operator, field: calc.fieldB }];
    }
    if (!editData.filterMappings) editData.filterMappings = {};
    if (!editData.extraDateColumnIndices) editData.extraDateColumnIndices = [];
    setNewCalc(editData);
    setIsEditingCalc(true);
    setCalcFormError('');
  };

  const handleCancelEdit = () => {
    resetCalcForm();
    setIsEditingCalc(false);
  };

  const handleDeleteCalculation = (id) => {
    updateLocalConfig('calculations', localConfig.calculations.filter(c => c.id !== id));
    if (isEditingCalc && newCalc.id === id) handleCancelEdit();
  };

  const handleCopyCalculation = (calc) => {
    const newId = `calc_${Date.now()}`;
    const copiedCalc = { ...calc, id: newId, label: `${calc.label} (コピー)` };
    const calcs = [...localConfig.calculations];
    const sourceIdx = calcs.findIndex(c => c.id === calc.id);
    calcs.splice(sourceIdx + 1, 0, copiedCalc);
    updateLocalConfig('calculations', calcs);
  };

  // 四則演算用
  const addArithmeticTerm = () => { setNewCalc({ ...newCalc, terms: [...(newCalc.terms || [{ field: '' }]), { operator: '+', field: '' }] }); };
  const updateArithmeticTerm = (index, key, value) => { const updated = [...(newCalc.terms || [{ field: '' }])]; updated[index] = { ...updated[index], [key]: value }; setNewCalc({ ...newCalc, terms: updated }); };
  const removeArithmeticTerm = (index) => { if (index === 0) return; const updated = (newCalc.terms || [{ field: '' }]).filter((_, i) => i !== index); setNewCalc({ ...newCalc, terms: updated }); };

  // リレーション用
  const addRelationFilter = () => { setNewCalc({ ...newCalc, filters: [...(newCalc.filters || []), { colIndex: '', conditionType: 'equals', value: '' }] }); };
  const updateRelationFilter = (idx, field, val) => { const updated = [...(newCalc.filters || [])]; updated[idx] = { ...updated[idx], [field]: val }; setNewCalc({ ...newCalc, filters: updated }); };
  const removeRelationFilter = (idx) => { setNewCalc({ ...newCalc, filters: (newCalc.filters || []).filter((_, i) => i !== idx) }); };
  const updateFilterMapping = (filterId, colIndex) => { setNewCalc({ ...newCalc, filterMappings: { ...(newCalc.filterMappings || {}), [filterId]: colIndex } }); };

  // ユニーク値取得（sourceCache から）
  const getUniqueValues = (sourceId, colIndex) => {
    const rows = (sourceCache || {})[sourceId] || [];
    const values = new Set();
    rows.forEach(row => {
      const val = row[parseInt(colIndex)];
      if (val !== undefined && val !== null && val !== '') values.add(String(val));
    });
    return [...values].sort((a, b) => String(a).localeCompare(String(b), 'ja'));
  };

  // 一括作成
  const handleBulkCreate = () => {
    const { baseName, separator, selectedValues, filterIndex, createFolder, folderName } = bulkConfig;
    if (!baseName?.trim()) {
      setBulkCreateError('ベース名を入力してください。');
      return;
    }
    if (selectedValues.length === 0) {
      setBulkCreateError('一括作成する値を1件以上選択してください。');
      return;
    }
    const existingLabels = new Set(localConfig.calculations.map(c => c.label));
    const calcData = buildCalcData(newCalc, calcType, targetHeaders, targetSource);
    if (!calcData) {
      setBulkCreateError('固定値に有効な数値を入力してください。');
      return;
    }

    setBulkCreateError('');
    let folderId = null;
    let newFolders = [...(localConfig.indicatorFolders || [])];
    if (createFolder && folderName) {
      folderId = `folder_${Date.now()}`;
      newFolders.push({ id: folderId, label: folderName, order: newFolders.length });
      updateLocalConfig('indicatorFolders', newFolders);
    }

    const newCalcs = [];
    selectedValues.forEach((value, i) => {
      let label = `${baseName}${separator}${value}`;
      if (existingLabels.has(label)) {
        let suffix = 2;
        while (existingLabels.has(`${label}(${suffix})`)) suffix++;
        label = `${label}(${suffix})`;
      }
      existingLabels.add(label);
      const bulkCalc = {
        ...calcData,
        id: `calc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}_${i}`,
        label,
        folderId,
        filters: (calcData.filters || []).map((f, idx) =>
          idx === filterIndex ? { ...f, value } : f
        ),
      };
      newCalcs.push(bulkCalc);
    });

    updateLocalConfig('calculations', [...localConfig.calculations, ...newCalcs]);
    setShowBulkModal(false);
    resetCalcForm();
  };

  // 一括作成モーダルを開く
  const openBulkModal = (filterIdx) => {
    const filter = (newCalc.filters || [])[filterIdx];
    if (!filter || !newCalc.targetSourceId) return;
    const uniqueVals = getUniqueValues(newCalc.targetSourceId, filter.colIndex);
    setBulkConfig({
      filterIndex: filterIdx,
      baseName: newCalc.label || '',
      separator: '_',
      selectedValues: [...uniqueVals],
      createFolder: false,
      folderName: newCalc.label ? `${newCalc.label}系` : '',
      uniqueValues: uniqueVals
    });
    setBulkCreateError('');
    setShowBulkModal(true);
  };

  // フォルダ CRUD
  const addFolder = () => {
    const folders = [...(localConfig.indicatorFolders || [])];
    folders.push({ id: `folder_${Date.now()}`, label: `フォルダ${folders.length + 1}`, order: folders.length });
    updateLocalConfig('indicatorFolders', folders);
  };

  const updateFolder = (folderId, key, value) => {
    const folders = (localConfig.indicatorFolders || []).map(f => f.id === folderId ? { ...f, [key]: value } : f);
    updateLocalConfig('indicatorFolders', folders);
  };

  const deleteFolder = (folderId) => {
    updateLocalConfig('indicatorFolders', (localConfig.indicatorFolders || []).filter(f => f.id !== folderId));
    // フォルダ内の指標は未分類に戻す
    updateLocalConfig('calculations', localConfig.calculations.map(c => c.folderId === folderId ? { ...c, folderId: null } : c));
  };

  const moveCalcToFolder = (calcId, folderId) => {
    updateLocalConfig('calculations', localConfig.calculations.map(c => c.id === calcId ? { ...c, folderId: folderId || null } : c));
    setFolderMoveCalcId(null);
  };

  const moveFolderOrder = (folderId, direction) => {
    const folders = [...(localConfig.indicatorFolders || [])];
    const idx = folders.findIndex(f => f.id === folderId);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= folders.length) return;
    [folders[idx], folders[targetIdx]] = [folders[targetIdx], folders[idx]];
    updateLocalConfig('indicatorFolders', folders);
  };

  // フォルダ内で新規指標作成（左パネルをリセットしてfolderIdを設定）
  const [pendingFolderId, setPendingFolderId] = useState(null);
  const createCalcInFolder = (folderId) => {
    resetCalcForm();
    setIsEditingCalc(false);
    setPendingFolderId(folderId);
  };

  // カラーパレット
  const colorPalette = [
    { value: 'from-slate-400 to-slate-500', bg: 'bg-slate-500' },
    { value: 'from-gray-500 to-gray-600', bg: 'bg-gray-500' },
    { value: 'from-zinc-400 to-zinc-500', bg: 'bg-zinc-500' },
    { value: 'from-emerald-400 to-teal-500', bg: 'bg-emerald-500' },
    { value: 'from-green-400 to-green-500', bg: 'bg-green-500' },
    { value: 'from-lime-400 to-lime-500', bg: 'bg-lime-500' },
    { value: 'from-blue-400 to-indigo-500', bg: 'bg-blue-500' },
    { value: 'from-sky-400 to-sky-500', bg: 'bg-sky-500' },
    { value: 'from-indigo-400 to-indigo-500', bg: 'bg-indigo-500' },
    { value: 'from-purple-400 to-violet-500', bg: 'bg-purple-500' },
    { value: 'from-violet-400 to-violet-500', bg: 'bg-violet-500' },
    { value: 'from-fuchsia-400 to-fuchsia-500', bg: 'bg-fuchsia-500' },
    { value: 'from-pink-400 to-rose-500', bg: 'bg-pink-500' },
    { value: 'from-rose-400 to-rose-500', bg: 'bg-rose-500' },
    { value: 'from-red-400 to-red-500', bg: 'bg-red-500' },
    { value: 'from-amber-400 to-orange-500', bg: 'bg-amber-500' },
    { value: 'from-orange-400 to-orange-500', bg: 'bg-orange-500' },
    { value: 'from-yellow-400 to-yellow-500', bg: 'bg-yellow-500' },
    { value: 'from-cyan-400 to-sky-500', bg: 'bg-cyan-500' },
    { value: 'from-teal-400 to-teal-500', bg: 'bg-teal-500' },
  ];

  return (
    <div className="space-y-6">
      {/* サブタブ */}
      <div className={`flex rounded-lg p-1 shadow-xs ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
        <button
          onClick={() => setIndicatorSubTab('mapping')}
          className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
            indicatorSubTab === 'mapping'
              ? theme === 'dark' ? 'bg-white/20 text-white shadow-xs' : 'bg-white text-gray-800 shadow-xs'
              : theme === 'dark' ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Table size={16} /> 基本指標（マッピング）
        </button>
        <button
          onClick={() => setIndicatorSubTab('calculation')}
          className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
            indicatorSubTab === 'calculation'
              ? theme === 'dark' ? 'bg-white/20 text-white shadow-xs' : 'bg-white text-gray-800 shadow-xs'
              : theme === 'dark' ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Calculator size={16} /> 計算指標
        </button>
        <button
          onClick={() => setIndicatorSubTab('groups')}
          className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
            indicatorSubTab === 'groups'
              ? theme === 'dark' ? 'bg-white/20 text-white shadow-xs' : 'bg-white text-gray-800 shadow-xs'
              : theme === 'dark' ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Layers size={16} /> 指標グループ
        </button>
      </div>

      {/* 基本指標（マッピング）サブタブ */}
      {indicatorSubTab === 'mapping' && (
        <div className="space-y-6">
          {/* 項目追加 */}
          <div className={`rounded-2xl p-6 ${glassClass}`}>
            <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${textClass}`}>
              <Plus size={20} className="text-indigo-400" /> 項目の追加
            </h3>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className={`text-xs ${labelSmClass} block mb-1`}>項目名 (ピボットする項目はここで追加)</label>
                <input
                  type="text"
                  value={newField.label}
                  onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                  className={`w-full ${inputClass} rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500`}
                />
              </div>
              <div className="w-40">
                <label className={`text-xs ${labelSmClass} block mb-1`}>データ型</label>
                <select
                  value={newField.type}
                  onChange={(e) => setNewField({ ...newField, type: e.target.value })}
                  className={`w-full ${inputClass} rounded-lg px-3 py-2 text-sm outline-none`}
                >
                  <option value="number" className={optionClass}>数値</option>
                  <option value="string" className={optionClass}>文字列</option>
                  <option value="date" className={optionClass}>日付</option>
                </select>
              </div>
              <button
                onClick={handleAddField}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium shadow-lg whitespace-nowrap"
              >
                追加
              </button>
            </div>
          </div>

          {/* マルチソースマッピング */}
          <div className={`rounded-2xl p-6 ${glassClass}`}>
            <h3 className={`text-lg font-semibold mb-6 flex items-center gap-2 ${textClass}`}>
              <Table size={20} className="text-blue-400" /> マルチソースマッピング
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {localConfig.systemFields.map((field) => {
                const currentMap = localConfig.mapping[field.id] || {};
                const currentSourceId = currentMap.sourceId || '';
                return (
                  <div key={field.id} className={`p-4 rounded-xl border ${cardClass} group ${theme === 'dark' ? 'hover:border-white/20' : 'hover:border-gray-300'} transition-colors`}>
                    <div className="flex justify-between items-center mb-2">
                      <label className={`text-sm font-medium ${textClass} flex items-center gap-2`}>
                        {field.id === 'id' && <span className="bg-pink-500 text-white text-xs px-1.5 rounded">ID (KEY)</span>}
                        {field.id === 'date' && <span className="bg-sky-500 text-white text-xs px-1.5 rounded">DATE</span>}
                        {editingFieldId === field.id ? (
                          <input
                            autoFocus
                            value={editingFieldLabel}
                            onChange={(e) => setEditingFieldLabel(e.target.value)}
                            onBlur={() => {
                              if (editingFieldLabel.trim()) updateSystemField(field.id, 'label', editingFieldLabel.trim());
                              setEditingFieldId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.target.blur(); }
                              if (e.key === 'Escape') { setEditingFieldId(null); }
                            }}
                            className={`${inputClass} rounded px-2 py-0.5 text-sm outline-none focus:border-blue-500 w-32`}
                          />
                        ) : (
                          <span
                            className="cursor-pointer hover:underline"
                            onClick={() => { setEditingFieldId(field.id); setEditingFieldLabel(field.label); }}
                            title="クリックで名前を編集"
                          >
                            {field.label}
                          </span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${field.type === 'number' ? (theme === 'dark' ? 'bg-emerald-500/30 text-emerald-300' : 'bg-emerald-100 text-emerald-700') : (theme === 'dark' ? 'bg-blue-500/30 text-blue-300' : 'bg-blue-100 text-blue-700')}`}>
                          {field.type === 'number' ? '数値' : '文字列'}
                        </span>
                      </label>
                      <div className="flex items-center gap-1">
                        {field.id !== 'id' && field.id !== 'date' && editingFieldId !== field.id && (
                          <button
                            onClick={() => { setEditingFieldId(field.id); setEditingFieldLabel(field.label); }}
                            className={`${textMutedClass} hover:text-blue-400`}
                            title="名前を編集"
                          >
                            <Edit3 size={13} />
                          </button>
                        )}
                        {field.id !== 'id' && field.id !== 'date' && (
                          <button onClick={() => handleDeleteField(field.id)} className={`${textMutedClass} hover:text-rose-400`}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={currentSourceId}
                        onChange={(e) => updateMapping(field.id, e.target.value, '')}
                        className={`w-1/3 ${inputClass} rounded px-2 py-1.5 text-xs outline-none focus:border-blue-500`}
                      >
                        <option value="" className={optionClass}>ソース...</option>
                        {localConfig.dataSources.map(src => (
                          <option key={src.id} value={src.id} className={optionClass}>{src.name}</option>
                        ))}
                      </select>
                      <select
                        value={currentMap.columnIndex ?? ''}
                        onChange={(e) => updateMapping(field.id, currentSourceId, e.target.value)}
                        disabled={!currentSourceId}
                        className={`flex-1 ${inputClass} rounded px-2 py-1.5 text-xs outline-none focus:border-blue-500 disabled:opacity-30`}
                      >
                        <option value="" className={optionClass}>カラム...</option>
                        {(() => {
                          const src = localConfig.dataSources.find(s => s.id === currentSourceId);
                          return src?.headers.map((header, idx) => (
                            <option key={idx} value={idx} className={optionClass}>{displayHeader(header, src)}</option>
                          ));
                        })()}
                      </select>
                    </div>
                    {/* マッピングプレビュー */}
                    {currentSourceId && currentMap.columnIndex != null && currentMap.columnIndex !== '' && sourceCache?.[currentSourceId] && (
                      <div className={`text-[9px] ${textMutedClass} mt-1 truncate`}>
                        値: {(() => {
                          const rows = sourceCache[currentSourceId] || [];
                          const ci = parseInt(currentMap.columnIndex);
                          const samples = [];
                          const seen = new Set();
                          for (let i = 0; i < rows.length && samples.length < 3; i++) {
                            const v = String(rows[i]?.[ci] ?? '');
                            if (v && !seen.has(v)) { seen.add(v); samples.push(v); }
                          }
                          return samples.length > 0 ? samples.join(', ') : '(データなし)';
                        })()}
                      </div>
                    )}

                    {/* 数値フィールドの小数点・色設定 */}
                    {field.type === 'number' && field.id !== 'id' && (
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <label className={`text-[10px] ${textMutedClass}`}>小数点:</label>
                          <select
                            value={field.decimals ?? 0}
                            onChange={(e) => updateSystemField(field.id, 'decimals', parseInt(e.target.value))}
                            className={`${inputClass} rounded px-2 py-1 text-xs outline-none focus:border-blue-500`}
                          >
                            <option value={0} className={optionClass}>整数</option>
                            <option value={1} className={optionClass}>小数点第1位</option>
                            <option value={2} className={optionClass}>小数点第2位</option>
                            <option value={3} className={optionClass}>小数点第3位</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className={`text-[10px] ${textMutedClass}`}>集計:</label>
                          <select
                            value={field.aggregationMethod || 'sum'}
                            onChange={(e) => updateSystemField(field.id, 'aggregationMethod', e.target.value)}
                            className={`${inputClass} rounded px-2 py-1 text-xs outline-none focus:border-blue-500`}
                          >
                            <option value="sum" className={optionClass}>合計</option>
                            <option value="first" className={optionClass}>先頭値</option>
                            <option value="avg" className={optionClass}>平均</option>
                            <option value="max" className={optionClass}>最大値</option>
                          </select>
                        </div>
                        <div className="mt-2 min-w-0" data-testid="system-field-color-picker">
                          <label className={`block whitespace-nowrap text-[10px] ${textMutedClass}`}>カード色:</label>
                          <div className="mt-1 flex max-w-full flex-wrap gap-1">
                            {colorPalette.map(c => (
                              <button
                                key={c.value}
                                onClick={() => updateSystemField(field.id, 'color', c.value)}
                                className={`w-5 h-5 rounded ${c.bg} ${field.color === c.value ? `ring-2 ring-offset-1 ${theme === 'dark' ? 'ring-white ring-offset-slate-900' : 'ring-gray-600 ring-offset-white'}` : 'opacity-60 hover:opacity-100'} transition-all`}
                                title={c.value}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 条件付き書式 */}
                    {field.type === 'number' && field.id !== 'id' && (
                      <div className={`mt-2 pt-2 border-t ${borderClass}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className={`text-[10px] font-medium ${textMutedClass}`}>条件付き書式</label>
                          <button
                            onClick={() => {
                              const rules = [...(field.conditionalRules || [])];
                              rules.push({ id: `rule_${Date.now()}`, operator: 'gte', value: 0, fontWeight: 'bold', color: 'emerald' });
                              updateSystemField(field.id, 'conditionalRules', rules);
                            }}
                            className={`text-[10px] px-1.5 py-0.5 rounded ${theme === 'dark' ? 'bg-white/10 text-white/60 hover:bg-white/20' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                          >
                            + ルール追加
                          </button>
                        </div>
                        {(field.conditionalRules || []).map((rule, ruleIdx) => (
                          <div key={rule.id} className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <select
                              value={rule.operator}
                              onChange={(e) => {
                                const rules = [...field.conditionalRules];
                                rules[ruleIdx] = { ...rules[ruleIdx], operator: e.target.value };
                                updateSystemField(field.id, 'conditionalRules', rules);
                              }}
                              className={`${inputClass} rounded px-1.5 py-0.5 text-[10px] w-14`}
                            >
                              {CONDITIONAL_FORMAT_OPERATORS.map(op => (
                                <option key={op.id} value={op.id} className={optionClass}>{op.label}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={rule.value}
                              onChange={(e) => {
                                const rules = [...field.conditionalRules];
                                rules[ruleIdx] = { ...rules[ruleIdx], value: parseFloat(e.target.value) || 0 };
                                updateSystemField(field.id, 'conditionalRules', rules);
                              }}
                              className={`${inputClass} rounded px-1.5 py-0.5 text-[10px] w-16`}
                            />
                            <select
                              value={rule.fontWeight}
                              onChange={(e) => {
                                const rules = [...field.conditionalRules];
                                rules[ruleIdx] = { ...rules[ruleIdx], fontWeight: e.target.value };
                                updateSystemField(field.id, 'conditionalRules', rules);
                              }}
                              className={`${inputClass} rounded px-1.5 py-0.5 text-[10px] w-20`}
                            >
                              {CONDITIONAL_FORMAT_WEIGHTS.map(w => (
                                <option key={w.id} value={w.id} className={optionClass}>{w.label}</option>
                              ))}
                            </select>
                            <div className="flex gap-0.5">
                              {CONDITIONAL_FORMAT_COLORS.map(c => (
                                <button
                                  key={c.id}
                                  onClick={() => {
                                    const rules = [...field.conditionalRules];
                                    rules[ruleIdx] = { ...rules[ruleIdx], color: c.id };
                                    updateSystemField(field.id, 'conditionalRules', rules);
                                  }}
                                  className={`w-3.5 h-3.5 rounded-full ${rule.color === c.id ? `ring-1 ring-offset-1 ${theme === 'dark' ? 'ring-indigo-400 ring-offset-slate-900' : 'ring-indigo-400 ring-offset-white'}` : 'opacity-50 hover:opacity-100'} transition-all`}
                                  style={{ backgroundColor: c.hex }}
                                  title={c.label}
                                />
                              ))}
                            </div>
                            <button
                              onClick={() => {
                                const rules = field.conditionalRules.filter((_, i) => i !== ruleIdx);
                                updateSystemField(field.id, 'conditionalRules', rules);
                              }}
                              className={`${textMutedClass} hover:text-rose-400`}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ID設定（メインキー） */}
                    {field.id === 'id' && (
                      <div className={`mt-4 pt-4 border-t ${borderClass}`}>
                        <h4 className={`text-xs font-bold ${labelSmClass} mb-2 flex items-center gap-1`}>
                          <Star size={12} className="text-yellow-400" /> メインキー設定
                        </h4>
                        <p className={`text-[10px] ${labelXsClass} mb-2`}>ダッシュボードの主軸となるID（例: 従業員マスタ）を指定してください。</p>
                        <div className={`flex gap-2 items-end p-2 rounded-lg border ${theme === 'dark' ? 'bg-black/20 border-white/10' : 'bg-gray-100 border-gray-200'}`}>
                          <div className="flex-1">
                            <label className={`text-[10px] ${labelSmClass} block mb-1`}>ソース</label>
                            <select
                              value={mainKeySettings.sourceId}
                              onChange={(e) => updateMainKey('sourceId', e.target.value)}
                              className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs`}
                            >
                              <option value="" className={optionClass}>ソース選択...</option>
                              {localConfig.dataSources.map(src => (
                                <option key={src.id} value={src.id} className={optionClass}>{src.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex-1">
                            <label className={`text-[10px] ${labelSmClass} block mb-1`}>キーカラム</label>
                            <select
                              value={mainKeySettings.columnIndex}
                              onChange={(e) => {
                                const idx = e.target.value;
                                const src = localConfig.dataSources.find(s => s.id === mainKeySettings.sourceId);
                                const name = idx !== '' ? (src?.headers?.[parseInt(idx)] || '') : '';
                                updateLocalConfig('mainKey', { ...mainKeySettings, columnIndex: idx, columnName: name });
                              }}
                              className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs`}
                              disabled={!mainKeySettings.sourceId}
                            >
                              <option value="" className={optionClass}>カラム...</option>
                              {(() => {
                                const src = localConfig.dataSources.find(s => s.id === mainKeySettings.sourceId);
                                return src?.headers.map((h, i) => (
                                  <option key={i} value={i} className={optionClass}>{displayHeader(h, src)}</option>
                                ));
                              })()}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* DATE設定（メイン日付） */}
                    {field.id === 'date' && (
                      <div className={`mt-4 pt-4 border-t ${borderClass}`}>
                        <h4 className={`text-xs font-bold ${labelSmClass} mb-2 flex items-center gap-1`}>
                          <Calendar size={12} /> メイン日付設定
                        </h4>
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-wrap gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" name="dateMode" value="auto" checked={dateSettings.type === 'auto'} onChange={() => updateDateSettings('type', 'auto')} className="text-indigo-500" />
                              <span className={`text-xs ${textClass}`}>自動生成 (日付×ID統合)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" name="dateMode" value="source" checked={dateSettings.type === 'source'} onChange={() => updateDateSettings('type', 'source')} className="text-indigo-500" />
                              <span className={`text-xs ${textClass}`}>ソース基準 (行をそのまま表示)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" name="dateMode" value="simple" checked={dateSettings.type === 'simple'} onChange={() => {
                                updateLocalConfig('dateSettings', {
                                  ...localConfig.dateSettings,
                                  type: 'simple',
                                  simpleConfig: { sourceId: localConfig.dataSources[0]?.id || '' }
                                });
                              }} className="text-teal-500" />
                              <span className={`text-xs ${theme === 'dark' ? 'text-teal-300' : 'text-teal-700'}`}>シンプルモード</span>
                            </label>
                          </div>
                          {dateSettings.type === 'source' && (
                            <div className={`flex gap-2 items-end p-2 rounded-lg border ${theme === 'dark' ? 'bg-black/20 border-white/10' : 'bg-gray-100 border-gray-200'}`}>
                              <div className="flex-1">
                                <label className={`text-[10px] ${labelSmClass} block mb-1`}>参照ソース</label>
                                <select
                                  value={dateSettings.sourceId}
                                  onChange={(e) => updateDateSettings('sourceId', e.target.value)}
                                  className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs`}
                                >
                                  <option value="" className={optionClass}>ソース選択...</option>
                                  {localConfig.dataSources.map(src => (
                                    <option key={src.id} value={src.id} className={optionClass}>{src.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}
                          {dateSettings.type === 'simple' && (
                            <div className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-teal-500/10 border-teal-500/30' : 'bg-teal-50 border-teal-200'}`}>
                              <p className={`text-[10px] mb-2 ${theme === 'dark' ? 'text-teal-300/70' : 'text-teal-600'}`}>
                                単一ソースからスプレッドシート感覚で集計します。日付×ID統合は行われません。
                              </p>
                              <div>
                                <label className={`text-[10px] block mb-1 ${theme === 'dark' ? 'text-teal-300' : 'text-teal-700'}`}>データソース</label>
                                <select
                                  value={dateSettings.simpleConfig?.sourceId || ''}
                                  onChange={(e) => {
                                    updateLocalConfig('dateSettings', {
                                      ...localConfig.dateSettings,
                                      simpleConfig: { ...localConfig.dateSettings.simpleConfig, sourceId: e.target.value }
                                    });
                                  }}
                                  className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs`}
                                >
                                  <option value="" className={optionClass}>ソース選択...</option>
                                  {localConfig.dataSources.map(src => (
                                    <option key={src.id} value={src.id} className={optionClass}>{src.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 計算指標サブタブ */}
      {indicatorSubTab === 'calculation' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左: 新規作成/編集フォーム */}
          <div className={`lg:col-span-1 rounded-2xl p-6 ${glassClass} border ${borderClass} lg:sticky lg:top-6 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto overflow-x-hidden`}>
            <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${textClass}`}>
              {isEditingCalc ? <Edit3 size={20} className="text-amber-400" /> : <Plus size={20} className="text-pink-400" />}
              {isEditingCalc ? 'ロジック編集' : '新規指標作成'}
            </h3>

            {/* 計算タイプ選択 */}
            <div className={`mb-4 flex rounded-lg p-1 ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
              {['arithmetic', 'relation', 'conditionalCount', 'constant'].map(type => (
                <button
                  key={type}
                  onClick={() => setCalcType(type)}
                  className={`flex-1 py-1.5 text-xs rounded font-medium transition-colors ${calcType === type ? (theme === 'dark' ? 'bg-white/20 text-white' : 'bg-white text-gray-800 shadow') : (theme === 'dark' ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-700')}`}
                >
                  {type === 'arithmetic' && '四則演算'}
                  {type === 'relation' && 'リレーション'}
                  {type === 'conditionalCount' && '条件カウント'}
                  {type === 'constant' && '固定値'}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {/* 指標名 */}
              <div>
                <label className={`text-xs ${labelSmClass} block mb-1`}>指標名</label>
                <input
                  type="text"
                  value={newCalc.label}
                  onChange={(e) => {
                    setNewCalc({ ...newCalc, label: e.target.value });
                    setCalcFormError('');
                  }}
                  className={`w-full ${inputClass} rounded-lg px-3 py-2 text-sm outline-none focus:border-opacity-50 transition-colors`}
                  placeholder="例: 受注件数"
                />
              </div>

              {/* 計算式設定 */}
              <div className={`p-3 rounded-xl border space-y-3 ${cardClass}`}>
                {/* 四則演算 */}
                {calcType === 'arithmetic' && (
                  <>
                    <div className="flex items-center justify-between">
                      <label className={`text-xs ${labelSmClass}`}>計算式</label>
                      <button onClick={addArithmeticTerm} className="text-[10px] text-sky-300 hover:text-sky-200 flex items-center gap-1">
                        <Plus size={10} /> 項目追加
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(newCalc.terms || [{ field: '' }]).map((term, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          {idx > 0 && (
                            <select value={term.operator} onChange={(e) => updateArithmeticTerm(idx, 'operator', e.target.value)} className={`w-14 ${inputClass} rounded px-1 py-1.5 text-sm`}>
                              {['+', '-', '*', '/'].map(op => <option key={op} value={op} className={optionClass}>{op}</option>)}
                            </select>
                          )}
                          <select value={term.field} onChange={(e) => updateArithmeticTerm(idx, 'field', e.target.value)} className={`flex-1 min-w-0 ${inputClass} rounded px-2 py-1.5 text-sm`}>
                            <option value="" className={optionClass}>項目選択...</option>
                            {numericFields.map(f => <option key={f.id} value={f.id} className={optionClass}>{f.label}</option>)}
                          </select>
                          {idx > 0 && <button onClick={() => removeArithmeticTerm(idx)} className="text-rose-400"><X size={14} /></button>}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* リレーション */}
                {calcType === 'relation' && (
                  <>
                    <div className={`border-b pb-3 mb-3 ${borderClass}`}>
                      <div className="mb-2">
                        <label className={`text-xs block mb-1 ${theme === 'dark' ? 'text-amber-300' : 'text-amber-600'}`}>1. 検索先のソース</label>
                        <select
                          value={newCalc.targetSourceId}
                          onChange={(e) => setNewCalc({ ...newCalc, targetSourceId: e.target.value, foreignKeyIndex: '', aggTargetIndex: '', dateColumnIndex: '', extraDateColumnIndices: [], excludeDaysOfMonth: [], filters: [], filterMappings: {}, dateDiffFilter: { enabled: false, dateColumnA: '', dateColumnB: '', useToday: false, maxDays: 7, direction: 'within' } })}
                          className={`w-full ${inputClass} rounded px-2 py-1.5 text-sm`}
                        >
                          <option value="" className={optionClass}>ソース選択...</option>
                          {localConfig.dataSources.map(src => <option key={src.id} value={src.id} className={optionClass}>{src.name}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-2 mb-2">
                        <div className="flex-1">
                          <label className={`text-[10px] block mb-1 ${labelXsClass}`}>自キー (Main ID)</label>
                          <select value={newCalc.localKeyId} onChange={(e) => setNewCalc({ ...newCalc, localKeyId: e.target.value })} className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs`}>
                            {localConfig.systemFields.map(f => <option key={f.id} value={f.id} className={optionClass}>{f.label}</option>)}
                            {(localConfig.calculations || []).filter(c => c.type === 'relation' && c.aggType === 'lookup').map(c => (
                              <option key={c.id} value={c.id} className={optionClass}>{c.label} (LOOKUP)</option>
                            ))}
                          </select>
                        </div>
                        <div className={`flex items-center pt-5 ${textMutedClass}`}>=</div>
                        <div className="flex-1">
                          <label className={`text-[10px] block mb-1 ${labelXsClass}`}>相手キー (Join Col)</label>
                          <select value={newCalc.foreignKeyIndex} onChange={(e) => setNewCalc({ ...newCalc, foreignKeyIndex: e.target.value })} className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs`} disabled={!targetSource}>
                            <option value="" className={optionClass}>列選択...</option>
                            {targetHeaders.map((h, i) => <option key={i} value={i} className={optionClass}>{displayHeader(h, targetSource)}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className={`text-[10px] block mb-1 flex items-center gap-1 ${theme === 'dark' ? 'text-sky-300' : 'text-sky-600'}`}>
                          <Calendar size={10} /> 日付判定カラム
                        </label>
                        <select value={newCalc.dateColumnIndex ?? ''} onChange={(e) => setNewCalc({ ...newCalc, dateColumnIndex: e.target.value, extraDateColumnIndices: [] })} className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs`} disabled={!targetSource}>
                          <option value="" className={optionClass}>設定なし (常に全件)</option>
                          {targetHeaders.map((h, i) => <option key={i} value={i} className={optionClass}>{displayHeader(h, targetSource)}</option>)}
                        </select>
                        {newCalc.dateColumnIndex !== '' && (
                          <div className="mt-2">
                            <label className={`text-[10px] block mb-1 flex items-center gap-1 ${theme === 'dark' ? 'text-sky-300/70' : 'text-sky-500'}`}>
                              <Plus size={10} /> 追加日付判定 (AND)
                            </label>
                            <div className="space-y-1">
                              {(newCalc.extraDateColumnIndices || []).map((extraIdx, i) => (
                                <div key={i} className="flex items-center gap-1">
                                  <select
                                    value={extraIdx}
                                    onChange={(e) => {
                                      const updated = [...(newCalc.extraDateColumnIndices || [])];
                                      updated[i] = e.target.value;
                                      setNewCalc({ ...newCalc, extraDateColumnIndices: updated });
                                    }}
                                    className={`flex-1 ${inputClass} rounded px-2 py-1 text-xs`}
                                    disabled={!targetSource}
                                  >
                                    <option value="" className={optionClass}>列選択...</option>
                                    {targetHeaders.map((h, idx) => (
                                      <option key={idx} value={idx} className={optionClass}>{displayHeader(h, targetSource)}</option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => {
                                      const updated = (newCalc.extraDateColumnIndices || []).filter((_, j) => j !== i);
                                      setNewCalc({ ...newCalc, extraDateColumnIndices: updated });
                                    }}
                                    className="text-rose-400 hover:text-rose-300"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => setNewCalc({
                                  ...newCalc,
                                  extraDateColumnIndices: [...(newCalc.extraDateColumnIndices || []), '']
                                })}
                                className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1 ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                                disabled={!targetSource}
                              >
                                <Plus size={10} /> 日付列追加
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      {newCalc.dateColumnIndex !== '' && (
                        <div className="mt-2">
                          <label className={`text-[10px] block mb-1 flex items-center gap-1 ${theme === 'dark' ? 'text-sky-300/70' : 'text-sky-500'}`}>
                            <X size={10} /> 除外する日にち (毎月)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={(newCalc.excludeDaysOfMonth || []).join(', ')}
                              onChange={(e) => {
                                const days = e.target.value.split(/[,、\s]+/).map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n >= 1 && n <= 31);
                                setNewCalc({ ...newCalc, excludeDaysOfMonth: days });
                              }}
                              className={`flex-1 ${inputClass} rounded px-2 py-1 text-xs`}
                              placeholder="例: 1  （カンマ区切りで複数可）"
                            />
                          </div>
                          <p className={`text-[9px] mt-0.5 ${textMutedClass}`}>指定した日にちのデータは集計から除外されます</p>
                        </div>
                      )}
                    </div>
                    <div className={`border-b pb-3 mb-3 ${borderClass}`}>
                      <label className={`text-xs block mb-1 ${theme === 'dark' ? 'text-amber-300' : 'text-amber-600'}`}>2. フィルター連動設定</label>
                      <div className="space-y-2">
                        {localConfig.filters.filter(f => f.field !== 'date').map(f => (
                          <div key={f.id} className="flex items-center gap-2">
                            <span className={`text-xs w-24 truncate ${textClass}`}>{f.label}:</span>
                            <Link2 size={12} className={textMutedClass} />
                            <select value={newCalc.filterMappings?.[f.field] ?? ''} onChange={(e) => updateFilterMapping(f.field, e.target.value)} className={`flex-1 ${inputClass} rounded px-2 py-1 text-xs`} disabled={!targetSource}>
                              <option value="" className={optionClass}>連動なし</option>
                              {targetHeaders.map((h, i) => <option key={i} value={i} className={optionClass}>{displayHeader(h, targetSource)}</option>)}
                            </select>
                          </div>
                        ))}
                        {localConfig.filters.filter(f => f.field !== 'date').length === 0 && <span className={`text-[10px] ${labelXsClass}`}>有効なフィルターがありません</span>}
                      </div>
                      {/* 一括適用ボタン */}
                      {newCalc.targetSourceId && Object.values(newCalc.filterMappings || {}).some(v => v !== '') && (
                        <button
                          onClick={() => {
                            const sameSourceCalcs = localConfig.calculations.filter(c =>
                              (c.type === 'relation' || c.type === 'conditionalCount') &&
                              c.targetSourceId === newCalc.targetSourceId &&
                              c.id !== newCalc.id
                            );
                            if (sameSourceCalcs.length === 0) { alert('同じソースの他の指標がありません'); return; }
                            if (!window.confirm(`同じソース「${targetSource?.name || newCalc.targetSourceId}」の他 ${sameSourceCalcs.length} 件の指標にフィルター連動設定を一括適用しますか？`)) return;
                            const currentMappings = newCalc.filterMappings || {};
                            const currentMappingNames = {};
                            Object.keys(currentMappings).forEach(key => {
                              const idx = currentMappings[key];
                              if (idx !== '' && idx != null) currentMappingNames[key] = targetHeaders[parseInt(idx)] || '';
                            });
                            const updated = localConfig.calculations.map(c => {
                              if (!sameSourceCalcs.some(sc => sc.id === c.id)) return c;
                              return { ...c, filterMappings: { ...currentMappings }, filterMappingNames: { ...currentMappingNames } };
                            });
                            updateLocalConfig('calculations', updated);
                          }}
                          className={`mt-2 w-full text-[10px] py-1.5 rounded-lg flex items-center justify-center gap-1 ${theme === 'dark' ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20' : 'bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200'}`}
                        >
                          <Copy size={10} /> 同じソースの他の指標に一括適用（{localConfig.calculations.filter(c => (c.type === 'relation' || c.type === 'conditionalCount') && c.targetSourceId === newCalc.targetSourceId && c.id !== newCalc.id).length}件）
                        </button>
                      )}
                    </div>
                    <div className={`border-b pb-3 mb-3 ${borderClass}`}>
                      <div className="flex gap-2 mb-2">
                        <div className="w-1/3">
                          <label className={`text-xs block mb-1 ${theme === 'dark' ? 'text-amber-300' : 'text-amber-600'}`}>3. 方法</label>
                          <select value={newCalc.aggType} onChange={(e) => setNewCalc({ ...newCalc, aggType: e.target.value })} className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs`}>
                            <option value="count" className={optionClass}>件数 (COUNT)</option>
                            <option value="sum" className={optionClass}>合計 (SUM)</option>
                            <option value="lookup" className={optionClass}>値取得 (LOOKUP)</option>
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className={`text-xs block mb-1 ${theme === 'dark' ? 'text-amber-300' : 'text-amber-600'}`}>対象列</label>
                          <select value={newCalc.aggTargetIndex} onChange={(e) => setNewCalc({ ...newCalc, aggTargetIndex: e.target.value })} className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs`} disabled={!targetSource}>
                            <option value="" className={optionClass}>列選択...</option>
                            {targetHeaders.map((h, i) => <option key={i} value={i} className={optionClass}>{displayHeader(h, targetSource)}</option>)}
                          </select>
                        </div>
                      </div>
                      {/* 単位ルール */}
                      <div className="mt-2">
                        <div className="flex justify-between items-center mb-1">
                          <label className={`text-[10px] flex items-center gap-1 ${theme === 'dark' ? 'text-sky-300' : 'text-sky-600'}`}>
                            カウント単位
                          </label>
                          <button
                            onClick={() => setNewCalc({ ...newCalc, countUnitRules: [...(newCalc.countUnitRules || []), { colIndex: '', conditionType: 'equals', value: '', unit: 1 }] })}
                            className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1 ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                            disabled={!targetSource}
                          >
                            <Plus size={10} /> ルール追加
                          </button>
                        </div>
                        {(newCalc.countUnitRules || []).length === 0 ? (
                          <p className={`text-[9px] ${textMutedClass}`}>ルールなし: 1件 = 1 でカウント</p>
                        ) : (
                          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                            {(newCalc.countUnitRules || []).map((rule, idx) => {
                              const updateRule = (key, val) => {
                                const updated = [...newCalc.countUnitRules];
                                updated[idx] = { ...rule, [key]: val };
                                setNewCalc({ ...newCalc, countUnitRules: updated });
                              };
                              const ct = rule.conditionType || 'equals';
                              const noValueNeeded = ['isEmpty', 'isNotEmpty'].includes(ct);
                              return (
                                <div key={idx} className={`p-1.5 rounded border flex items-center gap-1 flex-wrap ${theme === 'dark' ? 'bg-slate-900/50 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
                                  <select value={rule.colIndex} onChange={(e) => updateRule('colIndex', e.target.value)} className={`w-20 bg-transparent text-[10px] border-b outline-none ${theme === 'dark' ? 'border-white/20 text-white' : 'border-gray-300 text-gray-800'}`}>
                                    <option value="" className={optionClass}>列...</option>
                                    {targetHeaders.map((h, i) => <option key={i} value={i} className={optionClass}>{displayHeader(h, targetSource)}</option>)}
                                  </select>
                                  <select value={ct} onChange={(e) => updateRule('conditionType', e.target.value)} className={`w-20 bg-transparent text-[10px] border-b outline-none ${theme === 'dark' ? 'border-white/20 text-white' : 'border-gray-300 text-gray-800'}`}>
                                    <option value="equals" className={optionClass}>=</option>
                                    <option value="notEquals" className={optionClass}>≠</option>
                                    <option value="contains" className={optionClass}>含む</option>
                                    <option value="notContains" className={optionClass}>含まない</option>
                                    <option value="isNotEmpty" className={optionClass}>空白以外</option>
                                    <option value="isEmpty" className={optionClass}>空白</option>
                                    <option value="greaterThan" className={optionClass}>&gt;</option>
                                    <option value="lessThan" className={optionClass}>&lt;</option>
                                    <option value="greaterOrEqual" className={optionClass}>&gt;=</option>
                                    <option value="lessOrEqual" className={optionClass}>&lt;=</option>
                                  </select>
                                  {!noValueNeeded && (
                                    <input type="text" value={rule.value} onChange={(e) => updateRule('value', e.target.value)} className={`w-16 bg-transparent text-[10px] border-b outline-none ${theme === 'dark' ? 'border-white/20 text-white' : 'border-gray-300 text-gray-800'}`} placeholder="値" />
                                  )}
                                  <span className={`text-[10px] ${textMutedClass}`}>→</span>
                                  <input type="number" step="any" value={rule.unit} onChange={(e) => updateRule('unit', parseFloat(e.target.value) || 0)} className={`w-14 bg-transparent text-[10px] border-b outline-none text-right ${theme === 'dark' ? 'border-white/20 text-white' : 'border-gray-300 text-gray-800'}`} />
                                  <button onClick={() => setNewCalc({ ...newCalc, countUnitRules: newCalc.countUnitRules.filter((_, i) => i !== idx) })} className="text-rose-400 hover:text-rose-300"><X size={12} /></button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {(newCalc.countUnitRules || []).length > 0 && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[9px] ${textMutedClass}`}>それ以外:</span>
                            <input
                              type="number"
                              step="any"
                              value={newCalc.countUnitDefault ?? 1}
                              onChange={(e) => setNewCalc({ ...newCalc, countUnitDefault: parseFloat(e.target.value) || 0 })}
                              className={`w-14 ${inputClass} rounded px-1 py-0.5 text-[10px]`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className={`text-xs block ${theme === 'dark' ? 'text-amber-300' : 'text-amber-600'}`}>4. 固定絞り込み条件 (AND)</label>
                        <button onClick={addRelationFilter} className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1 ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}>
                          <Plus size={10} /> 追加
                        </button>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {(newCalc.filters || []).map((filter, idx) => {
                          const noVal = ['isEmpty', 'isNotEmpty', 'thisMonth2ndToEnd', 'thisMonth2ndToToday', 'thisMonth2ndToYesterday', 'thisMonth', 'thisMonth1stToYesterday', 'dateFilterRange', 'dateFilterStart', 'dateFilterEnd'].includes(filter.conditionType);
                          return (
                            <div key={idx} className={`p-2.5 rounded-lg border space-y-1.5 ${theme === 'dark' ? 'bg-slate-900/50 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
                              {/* 1行目: カラム + 条件 + 削除 */}
                              <div className="flex items-center gap-1.5">
                                <select value={filter.colIndex} onChange={(e) => updateRelationFilter(idx, 'colIndex', e.target.value)} className={`flex-1 min-w-0 ${inputClass} rounded px-2 py-1 text-[11px]`}>
                                  <option value="" className={optionClass}>列を選択...</option>
                                  {targetHeaders.map((h, i) => <option key={i} value={i} className={optionClass}>{displayHeader(h, targetSource)}</option>)}
                                </select>
                                <select value={filter.conditionType} onChange={(e) => updateRelationFilter(idx, 'conditionType', e.target.value)} className={`w-[130px] flex-shrink-0 ${inputClass} rounded px-2 py-1 text-[11px]`}>
                                  <option value="equals" className={optionClass}>=（一致）</option>
                                  <option value="notEquals" className={optionClass}>≠（不一致）</option>
                                  <option value="contains" className={optionClass}>含む</option>
                                  <option value="notContains" className={optionClass}>含まない</option>
                                  <option value="isNotEmpty" className={optionClass}>空白以外</option>
                                  <option value="isEmpty" className={optionClass}>空白</option>
                                  <option value="greaterThan" className={optionClass}>&gt;（より大きい）</option>
                                  <option value="lessThan" className={optionClass}>&lt;（より小さい）</option>
                                  <option value="greaterOrEqual" className={optionClass}>&gt;=（以上）</option>
                                  <option value="lessOrEqual" className={optionClass}>&lt;=（以下）</option>
                                  <option value="between" className={optionClass}>範囲内</option>
                                  <option value="thisMonth2ndToEnd" className={optionClass}>当月2日〜月末</option>
                                  <option value="thisMonth2ndToToday" className={optionClass}>当月2日〜今日</option>
                                  <option value="thisMonth2ndToYesterday" className={optionClass}>当月2日〜昨日</option>
                                  <option value="thisMonth" className={optionClass}>当月</option>
                                  <option value="thisMonth1stToYesterday" className={optionClass}>当月1日〜昨日</option>
                                  <option value="dateFilterRange" className={optionClass}>日付フィルター範囲内</option>
                                  <option value="dateFilterStart" className={optionClass}>日付フィルター開始以降</option>
                                  <option value="dateFilterEnd" className={optionClass}>日付フィルター終了以前</option>
                                </select>
                                <button onClick={() => removeRelationFilter(idx)} className="text-rose-400 hover:text-rose-300 flex-shrink-0"><X size={14} /></button>
                              </div>
                              {/* 2行目: 値入力 + アクション */}
                              {!noVal && (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={filter.value}
                                    onChange={(e) => updateRelationFilter(idx, 'value', e.target.value)}
                                    className={`flex-1 min-w-0 ${inputClass} rounded px-2 py-1 text-[11px]`}
                                    placeholder={filter.conditionType === 'between' ? '下限' : (filter.conditionType === 'equals' ? '値（カンマ区切りで複数可）' : '値')}
                                  />
                                  {filter.conditionType === 'between' && (
                                    <>
                                      <span className={`text-[10px] ${textMutedClass}`}>〜</span>
                                      <input type="text" value={filter.value2 || ''} onChange={(e) => updateRelationFilter(idx, 'value2', e.target.value)} className={`flex-1 min-w-0 ${inputClass} rounded px-2 py-1 text-[11px]`} placeholder="上限" />
                                    </>
                                  )}
                                  {filter.conditionType === 'equals' && filter.colIndex !== '' && newCalc.targetSourceId && sourceCache && (
                                    <button onClick={() => openBulkModal(idx)} className={`text-[10px] px-2 py-1 rounded flex items-center gap-0.5 flex-shrink-0 ${theme === 'dark' ? 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30' : 'bg-sky-100 text-sky-600 hover:bg-sky-200'}`} title="この条件のユニーク値で一括作成">
                                      <Layers size={10} /> 一括
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* 5. 日付差フィルター */}
                    <div className={`border-t pt-3 mt-3 ${borderClass}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <label className={`text-xs ${theme === 'dark' ? 'text-amber-300' : 'text-amber-600'}`}>5. 日付差フィルター</label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newCalc.dateDiffFilter?.enabled || false}
                            onChange={(e) => setNewCalc({ ...newCalc, dateDiffFilter: { ...(newCalc.dateDiffFilter || {}), enabled: e.target.checked } })}
                            className="rounded"
                          />
                          <span className={`text-[10px] ${textMutedClass}`}>有効</span>
                        </label>
                      </div>
                      {newCalc.dateDiffFilter?.enabled && (
                        <div className="space-y-2">
                          <div>
                            <label className={`text-[10px] block mb-1 ${labelXsClass}`}>日付A</label>
                            <select
                              value={newCalc.dateDiffFilter?.dateColumnA ?? ''}
                              onChange={(e) => setNewCalc({ ...newCalc, dateDiffFilter: { ...newCalc.dateDiffFilter, dateColumnA: e.target.value } })}
                              className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs`}
                              disabled={!targetSource}
                            >
                              <option value="" className={optionClass}>列選択...</option>
                              {targetHeaders.map((h, i) => <option key={i} value={i} className={optionClass}>{displayHeader(h, targetSource)}</option>)}
                            </select>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <label className={`text-[10px] ${labelXsClass}`}>日付B</label>
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={newCalc.dateDiffFilter?.useToday || false}
                                  onChange={(e) => setNewCalc({ ...newCalc, dateDiffFilter: { ...newCalc.dateDiffFilter, useToday: e.target.checked, dateColumnB: '' } })}
                                  className="rounded"
                                />
                                <span className={`text-[10px] ${textMutedClass}`}>「今日」を使う</span>
                              </label>
                            </div>
                            {!newCalc.dateDiffFilter?.useToday ? (
                              <select
                                value={newCalc.dateDiffFilter?.dateColumnB ?? ''}
                                onChange={(e) => setNewCalc({ ...newCalc, dateDiffFilter: { ...newCalc.dateDiffFilter, dateColumnB: e.target.value } })}
                                className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs`}
                                disabled={!targetSource}
                              >
                                <option value="" className={optionClass}>列選択...</option>
                                {targetHeaders.map((h, i) => <option key={i} value={i} className={optionClass}>{displayHeader(h, targetSource)}</option>)}
                              </select>
                            ) : (
                              <div className={`px-2 py-1.5 rounded text-xs ${theme === 'dark' ? 'bg-sky-900/30 text-sky-300' : 'bg-sky-50 text-sky-600'}`}>
                                今日の日付を使用
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 items-center">
                            <input
                              type="number"
                              min="0"
                              value={newCalc.dateDiffFilter?.maxDays ?? 7}
                              onChange={(e) => setNewCalc({ ...newCalc, dateDiffFilter: { ...newCalc.dateDiffFilter, maxDays: parseInt(e.target.value) || 0 } })}
                              className={`w-20 ${inputClass} rounded px-2 py-1.5 text-xs`}
                            />
                            <span className={`text-xs ${textClass}`}>日</span>
                            <select
                              value={newCalc.dateDiffFilter?.direction ?? 'within'}
                              onChange={(e) => setNewCalc({ ...newCalc, dateDiffFilter: { ...newCalc.dateDiffFilter, direction: e.target.value } })}
                              className={`${inputClass} rounded px-2 py-1.5 text-xs`}
                            >
                              <option value="within" className={optionClass}>以内</option>
                              <option value="after" className={optionClass}>以降</option>
                            </select>
                          </div>
                          {newCalc.dateDiffFilter?.dateColumnA !== '' && (newCalc.dateDiffFilter?.dateColumnB !== '' || newCalc.dateDiffFilter?.useToday) && (
                            <p className={`text-[9px] mt-1 px-2 py-1 rounded ${theme === 'dark' ? 'bg-white/5 text-white/60' : 'bg-gray-100 text-gray-500'}`}>
                              プレビュー: 「{displayHeader(targetHeaders[parseInt(newCalc.dateDiffFilter.dateColumnA)], targetSource)} → {newCalc.dateDiffFilter.useToday ? '今日' : displayHeader(targetHeaders[parseInt(newCalc.dateDiffFilter.dateColumnB)], targetSource)} が {newCalc.dateDiffFilter.maxDays}日{newCalc.dateDiffFilter.direction === 'within' ? '以内' : '以降'}」
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* 条件カウント */}
                {calcType === 'conditionalCount' && (
                  <>
                    <div className={`border-b pb-3 mb-3 ${borderClass}`}>
                      <div className="mb-2">
                        <label className={`text-xs block mb-1 ${theme === 'dark' ? 'text-green-300' : 'text-green-600'}`}>1. 検索先のソース</label>
                        <select
                          value={newCalc.targetSourceId}
                          onChange={(e) => setNewCalc({ ...newCalc, targetSourceId: e.target.value, foreignKeyIndex: '', dateColumnIndex: '', extraDateColumnIndices: [], conditions: [], filterMappings: {} })}
                          className={`w-full ${inputClass} rounded px-2 py-1.5 text-sm`}
                        >
                          <option value="" className={optionClass}>ソース選択...</option>
                          {localConfig.dataSources.map(src => <option key={src.id} value={src.id} className={optionClass}>{src.name}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-2 mb-2">
                        <div className="flex-1">
                          <label className={`text-[10px] block mb-1 ${labelXsClass}`}>自キー (Main ID)</label>
                          <select value={newCalc.localKeyId} onChange={(e) => setNewCalc({ ...newCalc, localKeyId: e.target.value })} className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs`}>
                            {localConfig.systemFields.map(f => <option key={f.id} value={f.id} className={optionClass}>{f.label}</option>)}
                            {(localConfig.calculations || []).filter(c => c.type === 'relation' && c.aggType === 'lookup').map(c => (
                              <option key={c.id} value={c.id} className={optionClass}>{c.label} (LOOKUP)</option>
                            ))}
                          </select>
                        </div>
                        <div className={`flex items-center pt-5 ${textMutedClass}`}>=</div>
                        <div className="flex-1">
                          <label className={`text-[10px] block mb-1 ${labelXsClass}`}>相手キー (Join Col)</label>
                          <select value={newCalc.foreignKeyIndex} onChange={(e) => setNewCalc({ ...newCalc, foreignKeyIndex: e.target.value })} className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs`} disabled={!targetSource}>
                            <option value="" className={optionClass}>列選択...</option>
                            {targetHeaders.map((h, i) => <option key={i} value={i} className={optionClass}>{displayHeader(h, targetSource)}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className={`text-[10px] block mb-1 flex items-center gap-1 ${theme === 'dark' ? 'text-sky-300' : 'text-sky-600'}`}>
                          <Calendar size={10} /> 日付判定カラム
                        </label>
                        <select value={newCalc.dateColumnIndex ?? ''} onChange={(e) => setNewCalc({ ...newCalc, dateColumnIndex: e.target.value, extraDateColumnIndices: [] })} className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs`} disabled={!targetSource}>
                          <option value="" className={optionClass}>設定なし (常に全件)</option>
                          {targetHeaders.map((h, i) => <option key={i} value={i} className={optionClass}>{displayHeader(h, targetSource)}</option>)}
                        </select>
                        {newCalc.dateColumnIndex !== '' && (
                          <div className="mt-2">
                            <label className={`text-[10px] block mb-1 flex items-center gap-1 ${theme === 'dark' ? 'text-sky-300/70' : 'text-sky-500'}`}>
                              <Plus size={10} /> 追加日付判定 (AND)
                            </label>
                            <div className="space-y-1">
                              {(newCalc.extraDateColumnIndices || []).map((extraIdx, i) => (
                                <div key={i} className="flex items-center gap-1">
                                  <select
                                    value={extraIdx}
                                    onChange={(e) => {
                                      const updated = [...(newCalc.extraDateColumnIndices || [])];
                                      updated[i] = e.target.value;
                                      setNewCalc({ ...newCalc, extraDateColumnIndices: updated });
                                    }}
                                    className={`flex-1 ${inputClass} rounded px-2 py-1 text-xs`}
                                    disabled={!targetSource}
                                  >
                                    <option value="" className={optionClass}>列選択...</option>
                                    {targetHeaders.map((h, idx) => (
                                      <option key={idx} value={idx} className={optionClass}>{displayHeader(h, targetSource)}</option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => {
                                      const updated = (newCalc.extraDateColumnIndices || []).filter((_, j) => j !== i);
                                      setNewCalc({ ...newCalc, extraDateColumnIndices: updated });
                                    }}
                                    className="text-rose-400 hover:text-rose-300"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => setNewCalc({
                                  ...newCalc,
                                  extraDateColumnIndices: [...(newCalc.extraDateColumnIndices || []), '']
                                })}
                                className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1 ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                                disabled={!targetSource}
                              >
                                <Plus size={10} /> 日付列追加
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={`border-b pb-3 mb-3 ${borderClass}`}>
                      <label className={`text-xs block mb-1 ${theme === 'dark' ? 'text-green-300' : 'text-green-600'}`}>2. フィルター連動設定</label>
                      <div className="space-y-2">
                        {localConfig.filters.filter(f => f.field !== 'date').map(f => (
                          <div key={f.id} className="flex items-center gap-2">
                            <span className={`text-xs w-24 truncate ${textClass}`}>{f.label}:</span>
                            <Link2 size={12} className={textMutedClass} />
                            <select value={newCalc.filterMappings?.[f.field] ?? ''} onChange={(e) => updateFilterMapping(f.field, e.target.value)} className={`flex-1 ${inputClass} rounded px-2 py-1 text-xs`} disabled={!targetSource}>
                              <option value="" className={optionClass}>連動なし</option>
                              {targetHeaders.map((h, i) => <option key={i} value={i} className={optionClass}>{displayHeader(h, targetSource)}</option>)}
                            </select>
                          </div>
                        ))}
                        {localConfig.filters.filter(f => f.field !== 'date').length === 0 && <span className={`text-[10px] ${labelXsClass}`}>有効なフィルターがありません</span>}
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className={`text-xs block ${theme === 'dark' ? 'text-green-300' : 'text-green-600'}`}>3. カウント条件 (COUNTIF)</label>
                        <button onClick={() => setNewCalc({ ...newCalc, conditions: [...(newCalc.conditions || []), { columnIndex: '', operator: 'notEmpty', value: '' }] })} className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1 ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}>
                          <Plus size={10} /> 追加
                        </button>
                      </div>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {(newCalc.conditions || []).map((cond, idx) => (
                          <div key={idx} className={`p-2 rounded border flex flex-wrap gap-1 items-center ${theme === 'dark' ? 'bg-slate-900/50 border-white/5' : 'bg-gray-100 border-gray-200'}`}>
                            <select value={cond.columnIndex} onChange={(e) => { const conditions = [...newCalc.conditions]; conditions[idx] = { ...conditions[idx], columnIndex: e.target.value }; setNewCalc({ ...newCalc, conditions }); }} className={`w-20 bg-transparent text-[10px] border-b outline-none ${theme === 'dark' ? 'border-white/20 text-white' : 'border-gray-300 text-gray-800'}`}>
                              <option value="" className={optionClass}>列...</option>
                              {targetHeaders.map((h, i) => <option key={i} value={i} className={optionClass}>{displayHeader(h, targetSource)}</option>)}
                            </select>
                            <select value={cond.operator} onChange={(e) => { const conditions = [...newCalc.conditions]; conditions[idx] = { ...conditions[idx], operator: e.target.value }; setNewCalc({ ...newCalc, conditions }); }} className={`w-24 bg-transparent text-[10px] border-b outline-none ${theme === 'dark' ? 'border-white/20 text-white' : 'border-gray-300 text-gray-800'}`}>
                              {CONDITIONAL_OPERATORS.map(op => <option key={op.id} value={op.id} className={optionClass}>{op.label}</option>)}
                            </select>
                            {CONDITIONAL_OPERATORS.find(op => op.id === cond.operator)?.needsValue && (
                              <input type="text" value={cond.value || ''} onChange={(e) => { const conditions = [...newCalc.conditions]; conditions[idx] = { ...conditions[idx], value: e.target.value }; setNewCalc({ ...newCalc, conditions }); }} className={`flex-1 min-w-0 bg-transparent text-[10px] border-b outline-none ${theme === 'dark' ? 'border-white/20 text-white' : 'border-gray-300 text-gray-800'}`} placeholder={cond.operator === 'between' ? '下限' : '値'} />
                            )}
                            {cond.operator === 'between' && (
                              <>
                                <span className={`text-[10px] ${textMutedClass}`}>〜</span>
                                <input type="text" value={cond.value2 || ''} onChange={(e) => { const conditions = [...newCalc.conditions]; conditions[idx] = { ...conditions[idx], value2: e.target.value }; setNewCalc({ ...newCalc, conditions }); }} className={`w-16 bg-transparent text-[10px] border-b outline-none ${theme === 'dark' ? 'border-white/20 text-white' : 'border-gray-300 text-gray-800'}`} placeholder="上限" />
                              </>
                            )}
                            <button onClick={() => { const conditions = newCalc.conditions.filter((_, i) => i !== idx); setNewCalc({ ...newCalc, conditions }); }} className="text-rose-400 hover:text-rose-300"><X size={12} /></button>
                          </div>
                        ))}
                        {(newCalc.conditions || []).length === 0 && <p className={`text-[10px] ${textMutedClass}`}>条件を追加してください</p>}
                      </div>
                    </div>
                  </>
                )}

                {/* 固定値 */}
                {calcType === 'constant' && (
                  <div className="space-y-3">
                    <div>
                      <label className={`text-xs block mb-1 ${theme === 'dark' ? 'text-cyan-300' : 'text-cyan-600'}`}>固定値</label>
                      <input
                        type="number"
                        step="any"
                        value={newCalc.constantValue ?? ''}
                        onChange={(e) => {
                          setNewCalc({ ...newCalc, constantValue: e.target.value === '' ? '' : parseFloat(e.target.value) });
                          setCalcFormError('');
                        }}
                        className={`w-full ${inputClass} rounded px-3 py-2 text-sm`}
                        placeholder="例: 1.5 または 100"
                      />
                    </div>
                    <div>
                      <label className={`text-xs block mb-1 ${theme === 'dark' ? 'text-cyan-300' : 'text-cyan-600'}`}>数値タイプ</label>
                      <div className={`flex rounded-lg p-1 ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
                        <button type="button" onClick={() => setNewCalc({ ...newCalc, constantType: 'integer' })} className={`flex-1 py-1.5 text-xs rounded font-medium transition-colors ${(newCalc.constantType || 'decimal') === 'integer' ? (theme === 'dark' ? 'bg-white/20 text-white' : 'bg-white text-gray-800 shadow') : (theme === 'dark' ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-700')}`}>整数</button>
                        <button type="button" onClick={() => setNewCalc({ ...newCalc, constantType: 'decimal' })} className={`flex-1 py-1.5 text-xs rounded font-medium transition-colors ${(newCalc.constantType || 'decimal') === 'decimal' ? (theme === 'dark' ? 'bg-white/20 text-white' : 'bg-white text-gray-800 shadow') : (theme === 'dark' ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-700')}`}>小数</button>
                      </div>
                    </div>
                    <p className={`text-[10px] ${textMutedClass}`}>固定値は四則演算の項目として使用できます。</p>
                  </div>
                )}
              </div>

              {/* フォーマット・小数桁 */}
              <div className="flex gap-2 pt-2">
                <select value={newCalc.format} onChange={(e) => setNewCalc({ ...newCalc, format: e.target.value })} className={`flex-1 min-w-0 ${inputClass} rounded-lg px-3 py-2 text-sm`}>
                  <option value="number" className={optionClass}>数値</option>
                  <option value="percent" className={optionClass}>パーセント (%)</option>
                </select>
                <input type="number" value={newCalc.decimals ?? ''} onChange={(e) => setNewCalc({ ...newCalc, decimals: e.target.value === '' ? undefined : parseInt(e.target.value) })} placeholder="小数桁" className={`w-20 ${inputClass} rounded-lg px-3 py-2 text-sm`} min={0} max={10} />
              </div>

              {calcFormError && (
                <div role="alert" className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${theme === 'dark' ? 'border-rose-500/40 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>{calcFormError}</span>
                </div>
              )}

              {/* 保存ボタン */}
              <button onClick={handleSaveCalculation} className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-xl font-medium shadow-lg shadow-pink-500/20 text-sm flex items-center justify-center gap-2">
                {isEditingCalc ? <><Save size={14} /> 更新</> : <><Plus size={14} /> 追加</>}
              </button>
              {isEditingCalc && (
                <button onClick={handleCancelEdit} className="w-full py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-xl text-sm">キャンセル</button>
              )}
            </div>
          </div>

          {/* 右: 登録済み計算ロジック一覧 */}
          <div className={`lg:col-span-2 rounded-2xl p-6 ${glassClass} h-full`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-lg font-semibold ${textClass}`}>登録済み計算ロジック ({localConfig.calculations.length})</h3>
              <div className="flex gap-1">
                {[
                  { label: '名前順', sort: (a, b) => a.label.localeCompare(b.label, 'ja') },
                  { label: 'タイプ別', sort: (a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label, 'ja') },
                  { label: 'ソース別', sort: (a, b) => (a.targetSourceId || '').localeCompare(b.targetSourceId || '') || a.label.localeCompare(b.label, 'ja') },
                ].map(s => (
                  <button
                    key={s.label}
                    onClick={() => {
                      const sorted = [...localConfig.calculations].sort(s.sort);
                      updateLocalConfig('calculations', sorted);
                    }}
                    className={`text-[10px] px-2 py-1 rounded ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white/70' : 'bg-gray-200 hover:bg-gray-300 text-gray-600'}`}
                  >
                    {s.label}
                  </button>
                ))}
                <button onClick={addFolder} className={`text-[10px] px-2 py-1 rounded flex items-center gap-1 ${theme === 'dark' ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300' : 'bg-purple-100 hover:bg-purple-200 text-purple-600'}`}>
                  <FolderPlus size={10} /> フォルダ追加
                </button>
              </div>
            </div>

            {/* 検索 */}
            <div className="relative mb-3">
              <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${textMutedClass}`} />
              <input
                type="text"
                value={calcSearchText}
                onChange={(e) => setCalcSearchText(e.target.value)}
                placeholder="指標を検索..."
                className={`w-full pl-9 pr-3 py-1.5 rounded-lg text-xs ${inputClass}`}
              />
            </div>

            {/* フォルダ表示 */}
            <div className="space-y-3">
              {(() => {
                const folders = localConfig.indicatorFolders || [];
                const allCalcs = localConfig.calculations.filter(c =>
                  !calcSearchText || c.label.toLowerCase().includes(calcSearchText.toLowerCase())
                );
                const folderSections = [
                  ...folders.map(folder => ({
                    id: folder.id,
                    label: folder.label,
                    calcs: allCalcs.filter(c => c.folderId === folder.id),
                    isFolder: true
                  })),
                  {
                    id: '__uncategorized__',
                    label: '未分類',
                    calcs: allCalcs.filter(c => !c.folderId || !folders.some(f => f.id === c.folderId)),
                    isFolder: false
                  }
                ];

                return folderSections.map(section => {
                  if (section.calcs.length === 0 && !section.isFolder) return null;
                  const isCollapsed = collapsedFolderIds.has(section.id);
                  return (
                    <div key={section.id} className={`rounded-xl border ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                      {/* フォルダヘッダー */}
                      <div
                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer select-none ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50'} rounded-t-xl`}
                        onClick={() => setCollapsedFolderIds(prev => {
                          const next = new Set(prev);
                          next.has(section.id) ? next.delete(section.id) : next.add(section.id);
                          return next;
                        })}
                      >
                        {isCollapsed ? <ChevronRight size={14} className={textMutedClass} /> : <ChevronDown size={14} className={textMutedClass} />}
                        {section.isFolder ? <Folder size={14} className="text-purple-400" /> : <Layers size={14} className={textMutedClass} />}
                        {section.isFolder ? (
                          <input
                            type="text"
                            value={section.label}
                            onChange={(e) => updateFolder(section.id, 'label', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className={`bg-transparent text-sm font-medium outline-none flex-1 min-w-0 ${textClass}`}
                          />
                        ) : (
                          <span className={`text-sm font-medium ${textMutedClass}`}>{section.label}</span>
                        )}
                        <span className={`text-[10px] ${textMutedClass}`}>{section.calcs.length}件</span>
                        {section.isFolder && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); createCalcInFolder(section.id); }} className={`p-1 ${theme === 'dark' ? 'text-white/20 hover:text-emerald-400' : 'text-gray-300 hover:text-emerald-500'}`} title="このフォルダに指標を作成"><Plus size={12} /></button>
                            <button onClick={(e) => { e.stopPropagation(); moveFolderOrder(section.id, 'up'); }} className={`p-1 ${theme === 'dark' ? 'text-white/20 hover:text-white/60' : 'text-gray-300 hover:text-gray-500'}`} title="上へ"><ArrowUp size={12} /></button>
                            <button onClick={(e) => { e.stopPropagation(); moveFolderOrder(section.id, 'down'); }} className={`p-1 ${theme === 'dark' ? 'text-white/20 hover:text-white/60' : 'text-gray-300 hover:text-gray-500'}`} title="下へ"><ArrowDown size={12} /></button>
                            <button
                              onClick={(e) => { e.stopPropagation(); if (window.confirm(`フォルダ「${section.label}」を削除しますか？\n（中の指標は未分類に移動します）`)) deleteFolder(section.id); }}
                              className={`p-1 hover:text-rose-400 ${theme === 'dark' ? 'text-white/20' : 'text-gray-300'}`}
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                      {/* フォルダ内容 */}
                      {!isCollapsed && (
                        <div className="grid grid-cols-2 gap-1.5 px-3 pb-3">
                          {section.calcs.map((calc) => {
                            const isExpanded = expandedCalcIds.has(calc.id);
                            return (
                              <div key={calc.id} className="flex items-stretch">
                                <div
                                  className={`flex-1 p-2 rounded-xl border group transition-all ${isEditingCalc && newCalc.id === calc.id ? 'border-amber-500/50 bg-amber-500/10' : (theme === 'dark' ? 'bg-white/5 border-white/5 hover:border-white/20' : 'bg-gray-50 border-gray-200 hover:border-gray-300')}`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                      <button
                                        onClick={() => setExpandedCalcIds(prev => {
                                          const next = new Set(prev);
                                          next.has(calc.id) ? next.delete(calc.id) : next.add(calc.id);
                                          return next;
                                        })}
                                        className={textMutedClass}
                                      >
                                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                      </button>
                                      <div className="flex-1 min-w-0">
                                        <div className={`font-medium text-xs flex items-center gap-1.5 ${textClass}`}>
                                          <span className="truncate">{calc.label}</span>
                                          {calc.type === 'relation' && <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1 py-0.5 rounded flex-shrink-0">リレ</span>}
                                          {calc.type === 'conditionalCount' && <span className="text-[9px] bg-green-500/20 text-green-300 px-1 py-0.5 rounded flex-shrink-0">条件</span>}
                                          {calc.type === 'constant' && <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1 py-0.5 rounded flex-shrink-0">固定</span>}
                                          {calc.type === 'arithmetic' && <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.5 rounded flex-shrink-0">計算</span>}
                                        </div>
                                        {calc.targetSourceId && (
                                          <div className={`text-[9px] truncate ${textMutedClass}`}>{localConfig.dataSources.find(s => s.id === calc.targetSourceId)?.name || ''}</div>
                                        )}
                                        {calc.type === 'arithmetic' && (
                                          <div className={`text-[9px] truncate ${textMutedClass}`}>
                                            {calc.terms ? calc.terms.map((t, i) => (i > 0 ? ` ${t.operator} ` : '') + (localConfig.systemFields.find(f => f.id === t.field)?.label || localConfig.calculations.find(c => c.id === t.field)?.label || t.field)).join('') : `${calc.fieldA} ${calc.operator} ${calc.fieldB}`}
                                          </div>
                                        )}
                                        {calc.type === 'constant' && (
                                          <div className={`text-[9px] truncate ${textMutedClass}`}>値: {calc.constantValue}</div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex gap-0.5 flex-shrink-0">
                                      {/* フォルダ移動 */}
                                      <div className="relative">
                                        <button
                                          onClick={() => setFolderMoveCalcId(folderMoveCalcId === calc.id ? null : calc.id)}
                                          className={`p-1 hover:text-purple-400 ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}
                                          title="フォルダ移動"
                                        >
                                          <Folder size={14} />
                                        </button>
                                        {folderMoveCalcId === calc.id && (
                                          <div className={`absolute right-0 bottom-full z-20 mb-1 w-40 max-h-48 overflow-y-auto rounded-lg shadow-xl border p-1 ${theme === 'dark' ? 'bg-slate-800 border-white/10' : 'bg-white border-gray-200'}`}>
                                            <button
                                              onClick={() => moveCalcToFolder(calc.id, null)}
                                              className={`w-full text-left px-2 py-1 rounded text-[10px] ${!calc.folderId ? 'font-bold' : ''} ${theme === 'dark' ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-600'}`}
                                            >
                                              未分類
                                            </button>
                                            {(localConfig.indicatorFolders || []).map(f => (
                                              <button
                                                key={f.id}
                                                onClick={() => moveCalcToFolder(calc.id, f.id)}
                                                className={`w-full text-left px-2 py-1 rounded text-[10px] flex items-center gap-1 ${calc.folderId === f.id ? 'font-bold' : ''} ${theme === 'dark' ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-600'}`}
                                              >
                                                <Folder size={10} className="text-purple-400" /> {f.label}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                      <button onClick={() => handleEditCalculation(calc)} className={`p-1 hover:text-amber-400 ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`} title="編集"><Edit3 size={14} /></button>
                                      <button onClick={() => handleCopyCalculation(calc)} className={`p-1 hover:text-sky-400 ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`} title="コピー"><Copy size={14} /></button>
                                      <button onClick={() => handleDeleteCalculation(calc.id)} className={`p-1 hover:text-rose-400 ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`} title="削除"><Trash2 size={14} /></button>
                                    </div>
                                  </div>
                                  {/* 展開時: 詳細 + カード色 + 条件付き書式 */}
                                  {isExpanded && (
                                    <>
                                      <div className={`text-[10px] mt-1 ${textMutedClass}`}>
                            {calc.type === 'arithmetic' && (calc.terms ? (
                              <span>{calc.terms.map((t, i) => (i > 0 ? ` ${t.operator} ` : '') + (localConfig.systemFields.find(f => f.id === t.field)?.label || localConfig.calculations.find(c => c.id === t.field)?.label || t.field)).join('')} ({calc.format})</span>
                            ) : (
                              <span>{calc.fieldA} {calc.operator} {calc.fieldB} ({calc.format})</span>
                            ))}
                            {calc.type === 'relation' && (
                              <div className="flex flex-col">
                                <span>Target: {localConfig.dataSources.find(s => s.id === calc.targetSourceId)?.name || 'Unknown'}</span>
                                {calc.dateColumnIndex && <span className={theme === 'dark' ? 'text-sky-300' : 'text-sky-600'}>Date: Col {calc.dateColumnIndex}</span>}
                                {Object.keys(calc.filterMappings || {}).length > 0 && <span className={theme === 'dark' ? 'text-amber-300' : 'text-amber-600'}>Linked: {Object.keys(calc.filterMappings).join(', ')}</span>}
                              </div>
                            )}
                            {calc.type === 'constant' && (<span>値: {calc.constantValue} ({calc.constantType === 'integer' ? '整数' : '小数'})</span>)}
                          </div>
                          <div className={`mt-1.5 min-w-0 border-t pt-1.5 ${borderClass}`} data-testid="calculation-color-picker">
                            <label className={`mb-1 block whitespace-nowrap text-[10px] ${textMutedClass}`}>色:</label>
                            <div className="flex max-w-full flex-wrap gap-1">
                              {colorPalette.map(c => (
                                <button
                                  key={c.value}
                                  onClick={() => updateLocalConfig('calculations', localConfig.calculations.map(cl => cl.id === calc.id ? { ...cl, color: c.value } : cl))}
                                  className={`w-3.5 h-3.5 rounded ${c.bg} ${calc.color === c.value ? (theme === 'dark' ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900' : 'ring-2 ring-gray-600 ring-offset-1 ring-offset-white') : 'opacity-60 hover:opacity-100'} transition-all`}
                                />
                              ))}
                            </div>
                          </div>
                          {/* 条件付き書式 */}
                          <div className={`mt-1.5 pt-1.5 border-t ${borderClass}`}>
                            <div className="flex items-center justify-between mb-1">
                              <label className={`text-[10px] font-medium ${textMutedClass}`}>条件付き書式</label>
                              <button
                                onClick={() => {
                                  const rules = [...(calc.conditionalRules || [])];
                                  rules.push({ id: `rule_${Date.now()}`, operator: 'gte', value: 0, fontWeight: 'bold', color: 'emerald' });
                                  updateLocalConfig('calculations', localConfig.calculations.map(cl => cl.id === calc.id ? { ...cl, conditionalRules: rules } : cl));
                                }}
                                className={`text-[10px] px-1.5 py-0.5 rounded ${theme === 'dark' ? 'bg-white/10 text-white/60 hover:bg-white/20' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                              >
                                + ルール追加
                              </button>
                            </div>
                            {(calc.conditionalRules || []).map((rule, ruleIdx) => (
                              <div key={rule.id} className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                <select
                                  value={rule.operator}
                                  onChange={(e) => {
                                    const rules = [...calc.conditionalRules];
                                    rules[ruleIdx] = { ...rules[ruleIdx], operator: e.target.value };
                                    updateLocalConfig('calculations', localConfig.calculations.map(cl => cl.id === calc.id ? { ...cl, conditionalRules: rules } : cl));
                                  }}
                                  className={`${inputClass} rounded px-1.5 py-0.5 text-[10px] w-14`}
                                >
                                  {CONDITIONAL_FORMAT_OPERATORS.map(op => (
                                    <option key={op.id} value={op.id} className={optionClass}>{op.label}</option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  value={rule.value}
                                  onChange={(e) => {
                                    const rules = [...calc.conditionalRules];
                                    rules[ruleIdx] = { ...rules[ruleIdx], value: parseFloat(e.target.value) || 0 };
                                    updateLocalConfig('calculations', localConfig.calculations.map(cl => cl.id === calc.id ? { ...cl, conditionalRules: rules } : cl));
                                  }}
                                  className={`${inputClass} rounded px-1.5 py-0.5 text-[10px] w-16`}
                                />
                                <select
                                  value={rule.fontWeight}
                                  onChange={(e) => {
                                    const rules = [...calc.conditionalRules];
                                    rules[ruleIdx] = { ...rules[ruleIdx], fontWeight: e.target.value };
                                    updateLocalConfig('calculations', localConfig.calculations.map(cl => cl.id === calc.id ? { ...cl, conditionalRules: rules } : cl));
                                  }}
                                  className={`${inputClass} rounded px-1.5 py-0.5 text-[10px] w-20`}
                                >
                                  {CONDITIONAL_FORMAT_WEIGHTS.map(w => (
                                    <option key={w.id} value={w.id} className={optionClass}>{w.label}</option>
                                  ))}
                                </select>
                                <div className="flex gap-0.5">
                                  {CONDITIONAL_FORMAT_COLORS.map(c => (
                                    <button
                                      key={c.id}
                                      onClick={() => {
                                        const rules = [...calc.conditionalRules];
                                        rules[ruleIdx] = { ...rules[ruleIdx], color: c.id };
                                        updateLocalConfig('calculations', localConfig.calculations.map(cl => cl.id === calc.id ? { ...cl, conditionalRules: rules } : cl));
                                      }}
                                      className={`w-3.5 h-3.5 rounded-full ${rule.color === c.id ? `ring-1 ring-offset-1 ${theme === 'dark' ? 'ring-indigo-400 ring-offset-slate-900' : 'ring-indigo-400 ring-offset-white'}` : 'opacity-50 hover:opacity-100'} transition-all`}
                                      style={{ backgroundColor: c.hex }}
                                      title={c.label}
                                    />
                                  ))}
                                </div>
                                <button
                                  onClick={() => {
                                    const rules = calc.conditionalRules.filter((_, i) => i !== ruleIdx);
                                    updateLocalConfig('calculations', localConfig.calculations.map(cl => cl.id === calc.id ? { ...cl, conditionalRules: rules } : cl));
                                  }}
                                  className={`${textMutedClass} hover:text-rose-400`}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                                </div>
                              </div>
                            );
                          })}
                          {section.calcs.length === 0 && (
                            <p className={`text-xs col-span-2 text-center py-4 ${textMutedClass}`}>
                              {section.isFolder ? 'このフォルダに指標がありません' : '指標がありません'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
              {/* 下部フォルダ追加ボタン */}
              <button onClick={addFolder} className={`w-full py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-dashed ${theme === 'dark' ? 'border-white/10 text-white/40 hover:border-purple-500/30 hover:text-purple-300 hover:bg-purple-500/5' : 'border-gray-300 text-gray-400 hover:border-purple-300 hover:text-purple-500 hover:bg-purple-50'}`}>
                <FolderPlus size={12} /> フォルダ追加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 指標グループ サブタブ */}
      {indicatorSubTab === 'groups' && (
        <div className="space-y-6">
          <div className={`rounded-2xl p-6 ${glassClass} border ${borderClass}`}>
            <h3 className={`text-lg font-semibold mb-2 flex items-center gap-2 ${textClass}`}>
              <Layers size={20} className="text-purple-400" /> 指標グループ
            </h3>
            <p className={`text-xs mb-4 ${textMutedClass}`}>
              複数のリレーション指標を1つのグループにまとめ、合算値カラムとして表示します。クリックで展開して個別指標を確認できます。
            </p>

            {/* グループ一覧 */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {(localConfig.indicatorGroups || []).map((group, groupIdx) => {
                const relationCalcs = (localConfig.calculations || []);
                const memberCalcs = group.memberCalcIds
                  .map(id => (localConfig.calculations || []).find(c => c.id === id))
                  .filter(Boolean);

                return (
                  <div key={group.id} className={`rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                    {/* グループヘッダー */}
                    <div className={`flex items-center gap-2 p-3 ${!collapsedGroupIds.has(group.id) ? `border-b ${borderClass}` : ''}`}>
                      <button
                        onClick={() => {
                          setCollapsedGroupIds(prev => {
                            const next = new Set(prev);
                            if (next.has(group.id)) next.delete(group.id);
                            else next.add(group.id);
                            return next;
                          });
                        }}
                        className={`p-0.5 rounded flex-shrink-0 ${theme === 'dark' ? 'text-white/40 hover:text-white/70' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        {collapsedGroupIds.has(group.id) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <input
                        type="text"
                        value={group.label}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const groups = [...(localConfig.indicatorGroups || [])];
                          groups[groupIdx] = { ...groups[groupIdx], label: e.target.value };
                          updateLocalConfig('indicatorGroups', groups);
                        }}
                        className={`flex-1 ${inputClass} rounded-lg px-3 py-1.5 text-sm font-medium`}
                        placeholder="グループ名"
                      />
                      <span className={`text-[10px] flex-shrink-0 ${textMutedClass}`}>
                        {memberCalcs.length}件
                      </span>
                      <button
                        onClick={() => {
                          if (!window.confirm('このグループを削除しますか？')) return;
                          const groups = (localConfig.indicatorGroups || []).filter((_, i) => i !== groupIdx);
                          updateLocalConfig('indicatorGroups', groups);
                        }}
                        className={`p-1.5 rounded hover:text-rose-400 flex-shrink-0 ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}
                        title="削除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* メンバー指標の選択（折りたたみ可能） */}
                    {!collapsedGroupIds.has(group.id) && (
                      <div className="p-4 pt-3">
                        {/* グループ設定 */}
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                          {/* 集計方法 */}
                          <div className="flex items-center gap-1.5">
                            <label className={`text-[10px] ${textMutedClass}`}>集計:</label>
                            <select
                              value={group.aggregation || 'sum'}
                              onChange={(e) => {
                                const groups = [...(localConfig.indicatorGroups || [])];
                                groups[groupIdx] = { ...groups[groupIdx], aggregation: e.target.value };
                                updateLocalConfig('indicatorGroups', groups);
                              }}
                              className={`${inputClass} rounded px-1.5 py-0.5 text-[10px] w-24`}
                            >
                              <option value="sum" className={optionClass}>合計</option>
                              <option value="average" className={optionClass}>平均</option>
                              <option value="calc" className={optionClass}>指標参照</option>
                              <option value="formula" className={optionClass}>四則演算</option>
                            </select>
                          </div>
                          {/* 指標参照: 既存の計算指標を選択 */}
                          {(group.aggregation === 'calc') && (
                            <div className="flex items-center gap-1.5">
                              <label className={`text-[10px] ${textMutedClass}`}>参照:</label>
                              <select
                                value={group.totalCalcId || ''}
                                onChange={(e) => {
                                  const groups = [...(localConfig.indicatorGroups || [])];
                                  groups[groupIdx] = { ...groups[groupIdx], totalCalcId: e.target.value };
                                  updateLocalConfig('indicatorGroups', groups);
                                }}
                                className={`${inputClass} rounded px-1.5 py-0.5 text-[10px] w-40`}
                              >
                                <option value="" className={optionClass}>選択...</option>
                                {(localConfig.calculations || []).map(c => (
                                  <option key={c.id} value={c.id} className={optionClass}>{c.label}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          {/* 四則演算: グループ合計値同士の計算式 */}
                          {(group.aggregation === 'formula') && (
                            <div className="flex items-center gap-1.5">
                              <select
                                value={group.formula?.fieldA || ''}
                                onChange={(e) => {
                                  const groups = [...(localConfig.indicatorGroups || [])];
                                  groups[groupIdx] = { ...groups[groupIdx], formula: { ...(groups[groupIdx].formula || {}), fieldA: e.target.value } };
                                  updateLocalConfig('indicatorGroups', groups);
                                }}
                                className={`${inputClass} rounded px-1.5 py-0.5 text-[10px] w-32`}
                              >
                                <option value="" className={optionClass}>グループ選択...</option>
                                {(localConfig.indicatorGroups || []).filter(g => g.id !== group.id).map(g => (
                                  <option key={g.id} value={g.id} className={optionClass}>{g.label}</option>
                                ))}
                              </select>
                              <select
                                value={group.formula?.operator || '/'}
                                onChange={(e) => {
                                  const groups = [...(localConfig.indicatorGroups || [])];
                                  groups[groupIdx] = { ...groups[groupIdx], formula: { ...(groups[groupIdx].formula || {}), operator: e.target.value } };
                                  updateLocalConfig('indicatorGroups', groups);
                                }}
                                className={`${inputClass} rounded px-1.5 py-0.5 text-[10px] w-12 text-center`}
                              >
                                <option value="+" className={optionClass}>+</option>
                                <option value="-" className={optionClass}>-</option>
                                <option value="*" className={optionClass}>×</option>
                                <option value="/" className={optionClass}>÷</option>
                              </select>
                              <select
                                value={group.formula?.fieldB || ''}
                                onChange={(e) => {
                                  const groups = [...(localConfig.indicatorGroups || [])];
                                  groups[groupIdx] = { ...groups[groupIdx], formula: { ...(groups[groupIdx].formula || {}), fieldB: e.target.value } };
                                  updateLocalConfig('indicatorGroups', groups);
                                }}
                                className={`${inputClass} rounded px-1.5 py-0.5 text-[10px] w-32`}
                              >
                                <option value="" className={optionClass}>グループ選択...</option>
                                {(localConfig.indicatorGroups || []).filter(g => g.id !== group.id).map(g => (
                                  <option key={g.id} value={g.id} className={optionClass}>{g.label}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          {/* 単位 */}
                          <div className="flex items-center gap-1.5">
                            <label className={`text-[10px] ${textMutedClass}`}>単位:</label>
                            <input
                              type="text"
                              value={group.unit || ''}
                              onChange={(e) => {
                                const groups = [...(localConfig.indicatorGroups || [])];
                                groups[groupIdx] = { ...groups[groupIdx], unit: e.target.value };
                                updateLocalConfig('indicatorGroups', groups);
                              }}
                              className={`${inputClass} rounded px-1.5 py-0.5 text-[10px] w-16`}
                              placeholder="%, 件..."
                            />
                          </div>
                          {/* 割合表示トグル */}
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={group.showPercent || false}
                              onChange={(e) => {
                                const groups = [...(localConfig.indicatorGroups || [])];
                                groups[groupIdx] = { ...groups[groupIdx], showPercent: e.target.checked };
                                updateLocalConfig('indicatorGroups', groups);
                              }}
                              className="rounded"
                            />
                            <span className={`text-[10px] ${textClass}`}>割合表示</span>
                          </label>
                        </div>

                        <label className={`text-[10px] font-medium block mb-1.5 ${textMutedClass}`}>
                          メンバー指標
                        </label>
                        <div className="space-y-1.5 max-h-64 overflow-y-auto">
                          {relationCalcs.map(calc => {
                            const isMember = group.memberCalcIds.includes(calc.id);
                            const inOtherGroup = (localConfig.indicatorGroups || []).some(
                              (g, i) => i !== groupIdx && g.memberCalcIds.includes(calc.id)
                            );
                            return (
                              <label
                                key={calc.id}
                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                                  inOtherGroup
                                    ? (theme === 'dark' ? 'opacity-30 cursor-not-allowed' : 'opacity-40 cursor-not-allowed')
                                    : isMember
                                      ? (theme === 'dark' ? 'bg-purple-500/20 border border-purple-500/30' : 'bg-purple-50 border border-purple-200')
                                      : (theme === 'dark' ? 'hover:bg-white/5 border border-transparent' : 'hover:bg-gray-100 border border-transparent')
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isMember}
                                  disabled={inOtherGroup}
                                  onChange={(e) => {
                                    const groups = [...(localConfig.indicatorGroups || [])];
                                    const current = groups[groupIdx];
                                    if (e.target.checked) {
                                      groups[groupIdx] = { ...current, memberCalcIds: [...current.memberCalcIds, calc.id] };
                                    } else {
                                      groups[groupIdx] = { ...current, memberCalcIds: current.memberCalcIds.filter(id => id !== calc.id) };
                                    }
                                    updateLocalConfig('indicatorGroups', groups);
                                  }}
                                  className="rounded"
                                />
                                <span className={`text-xs ${textClass}`}>{calc.label}</span>
                                <span className={`text-[10px] px-1 py-0.5 rounded ${
                                  calc.type === 'relation' ? 'bg-purple-500/20 text-purple-300'
                                    : calc.type === 'arithmetic' ? 'bg-blue-500/20 text-blue-300'
                                    : calc.type === 'constant' ? 'bg-cyan-500/20 text-cyan-300'
                                    : 'bg-amber-500/20 text-amber-300'
                                }`}>
                                  {calc.type === 'relation' ? 'リレーション' : calc.type === 'arithmetic' ? '四則演算' : calc.type === 'constant' ? '固定値' : '条件カウント'}
                                </span>
                                {inOtherGroup && (
                                  <span className={`text-[10px] ${textMutedClass}`}>(他グループに所属)</span>
                                )}
                              </label>
                            );
                          })}
                          {relationCalcs.length === 0 && (
                            <p className={`text-xs py-2 ${textMutedClass}`}>
                              リレーション / 条件カウント指標がありません。「計算指標」タブで作成してください。
                            </p>
                          )}
                        </div>
                        {memberCalcs.length > 0 && (
                          <div className={`mt-2 pt-2 border-t ${borderClass}`}>
                            <div className={`text-[10px] ${textMutedClass}`}>
                              合算対象: {memberCalcs.map(c => c.label).join(' + ')}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {(localConfig.indicatorGroups || []).length === 0 && (
                <div className={`text-center py-8 ${textMutedClass}`}>
                  <Layers size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">グループがありません</p>
                  <p className="text-xs mt-1">下のボタンからグループを追加してください</p>
                </div>
              )}
            </div>

            {/* グループ追加ボタン */}
            <button
              onClick={() => {
                const groups = [...(localConfig.indicatorGroups || [])];
                groups.push({
                  id: `grp_${Date.now()}`,
                  label: `グループ${groups.length + 1}`,
                  memberCalcIds: [],
                  aggregation: 'sum',
                });
                updateLocalConfig('indicatorGroups', groups);
              }}
              className={`w-full mt-4 py-2.5 rounded-xl text-sm font-medium transition-all ${theme === 'dark' ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30' : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'}`}
            >
              <Plus size={16} className="inline mr-1" /> グループを追加
            </button>
          </div>
        </div>
      )}

      {/* 一括作成モーダル */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowBulkModal(false)}>
          <div className={`w-[480px] max-h-[80vh] rounded-2xl p-6 ${theme === 'dark' ? 'bg-slate-900 border border-white/10' : 'bg-white border border-gray-200'} shadow-2xl overflow-y-auto`} onClick={e => e.stopPropagation()}>
            <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${textClass}`}>
              <Layers size={20} className="text-sky-400" /> 一括作成
            </h3>

            <div className="space-y-4">
              {/* ベース名 */}
              <div>
                <label className={`text-xs block mb-1 ${labelSmClass}`}>ベース名</label>
                <input
                  type="text"
                  value={bulkConfig.baseName}
                  onChange={(e) => {
                    setBulkConfig(prev => ({ ...prev, baseName: e.target.value }));
                    setBulkCreateError('');
                  }}
                  className={`w-full ${inputClass} rounded-lg px-3 py-2 text-sm`}
                  placeholder="例: 前確"
                />
              </div>

              {/* 区切り */}
              <div>
                <label className={`text-xs block mb-1 ${labelSmClass}`}>区切り文字</label>
                <div className="flex gap-2">
                  {['_', '/', '・', ' '].map(sep => (
                    <button
                      key={sep}
                      onClick={() => setBulkConfig(prev => ({ ...prev, separator: sep }))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-mono ${bulkConfig.separator === sep ? (theme === 'dark' ? 'bg-sky-500/30 text-sky-300 border border-sky-500/50' : 'bg-sky-100 text-sky-700 border border-sky-300') : (theme === 'dark' ? 'bg-white/5 text-white/50 border border-white/10' : 'bg-gray-100 text-gray-500 border border-gray-200')}`}
                    >
                      {sep === ' ' ? '空白' : sep}
                    </button>
                  ))}
                </div>
              </div>

              {/* フォルダ連携 */}
              <div className={`p-3 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkConfig.createFolder}
                    onChange={(e) => setBulkConfig(prev => ({ ...prev, createFolder: e.target.checked }))}
                    className="rounded"
                  />
                  <span className={`text-xs ${textClass}`}>フォルダにまとめる</span>
                </label>
                {bulkConfig.createFolder && (
                  <input
                    type="text"
                    value={bulkConfig.folderName}
                    onChange={(e) => setBulkConfig(prev => ({ ...prev, folderName: e.target.value }))}
                    className={`w-full mt-2 ${inputClass} rounded-lg px-3 py-1.5 text-sm`}
                    placeholder="フォルダ名"
                  />
                )}
              </div>

              {/* 値リスト */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={`text-xs ${labelSmClass}`}>対象の値（{bulkConfig.selectedValues.length}/{(bulkConfig.uniqueValues || []).length}件選択）</label>
                  <div className="flex gap-2">
                    <button onClick={() => { setBulkConfig(prev => ({ ...prev, selectedValues: [...(prev.uniqueValues || [])] })); setBulkCreateError(''); }} className={`text-[10px] px-2 py-0.5 rounded ${theme === 'dark' ? 'bg-white/10 text-white/60 hover:bg-white/20' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>全選択</button>
                    <button onClick={() => { setBulkConfig(prev => ({ ...prev, selectedValues: [] })); setBulkCreateError(''); }} className={`text-[10px] px-2 py-0.5 rounded ${theme === 'dark' ? 'bg-white/10 text-white/60 hover:bg-white/20' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>全解除</button>
                  </div>
                </div>
                <div className={`max-h-48 overflow-y-auto rounded-xl border p-2 space-y-1 ${theme === 'dark' ? 'border-white/10 bg-black/20' : 'border-gray-200 bg-gray-50'}`}>
                  {(bulkConfig.uniqueValues || []).map(val => {
                    const isSelected = bulkConfig.selectedValues.includes(val);
                    const previewLabel = `${bulkConfig.baseName}${bulkConfig.separator}${val}`;
                    const isDuplicate = localConfig.calculations.some(c => c.label === previewLabel);
                    return (
                      <label key={val} className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs ${isSelected ? (theme === 'dark' ? 'bg-sky-500/10' : 'bg-sky-50') : ''}`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setBulkConfig(prev => ({
                              ...prev,
                              selectedValues: isSelected ? prev.selectedValues.filter(v => v !== val) : [...prev.selectedValues, val]
                            }));
                            setBulkCreateError('');
                          }}
                          className="rounded"
                        />
                        <span className={textClass}>{val}</span>
                        <span className={`text-[10px] ${textMutedClass}`}>→ {previewLabel}</span>
                        {isDuplicate && <AlertTriangle size={12} className="text-amber-400 flex-shrink-0" title="同名の指標が存在します" />}
                      </label>
                    );
                  })}
                  {(bulkConfig.uniqueValues || []).length === 0 && (
                    <p className={`text-xs text-center py-4 ${textMutedClass}`}>データがありません（ソースデータを読み込んでください）</p>
                  )}
                </div>
              </div>
            </div>

            {bulkCreateError && (
              <div role="alert" className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${theme === 'dark' ? 'border-rose-500/40 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>{bulkCreateError}</span>
              </div>
            )}

            {/* アクション */}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowBulkModal(false)} className={`flex-1 py-2.5 rounded-xl text-sm ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white/70' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>
                キャンセル
              </button>
              <button
                onClick={handleBulkCreate}
                className="flex-1 py-2.5 bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 disabled:opacity-30 text-white rounded-xl font-medium shadow-lg text-sm"
              >
                {bulkConfig.selectedValues.length}件 一括作成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IndicatorTab;
