// src/apps/performance-board/components/SalesforceSync.jsx
// SF連携ページ - オブジェクト管理・プリセットインポート・エクスポート・稼働実績一括

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Cloud, ChevronDown, RefreshCw, Check, Search, Upload, Table2,
  Link2, Settings2, Eye, AlertTriangle, Loader2, CheckCircle, X,
  Download, ArrowUpRight, ArrowDownLeft, Layers, Plus, Trash2,
  Save, Clock, Edit3, Play, Database, Package, Calendar, History,
} from 'lucide-react';
import { useAggregationConfig } from '../hooks/useAggregationConfig';
import { useDataTableProcessing } from '../hooks/useDataTableProcessing';
import salesforceApi, { SALESFORCE_DEMO_MESSAGE } from '../services/salesforceApi';
import SalesforceExportModal from './SalesforceExportModal';
import SalesforceUnifiedImport from './SalesforceUnifiedImport';
import MultiSelectDropdown from './MultiSelectDropdown';
import { formatDateForInput } from '../utils';
import { isDateInRange } from '../utils/dateFilters';
import { List } from 'react-window';

// === SF項目 検索付きセレクト ===
const SfFieldSearchSelect = React.memo(({ value, options, onChange, theme, selectClass }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  useEffect(() => { if (isOpen && inputRef.current) inputRef.current.focus(); }, [isOpen]);

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter(f => f.label.toLowerCase().includes(q) || f.name.toLowerCase().includes(q));
  }, [options, search]);

  const selectedLabel = useMemo(() => {
    if (!value) return '-- 未設定 --';
    const f = options.find(o => o.name === value);
    return f ? `${f.label} (${f.name})` : value;
  }, [value, options]);

  const dark = theme === 'dark';

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => { setIsOpen(!isOpen); setSearch(''); }}
        className={`${selectClass} w-full text-xs text-left truncate`}
      >
        {selectedLabel}
      </button>
      {isOpen && (
        <div className={`absolute z-50 mt-1 w-full rounded-lg border shadow-lg ${dark ? 'bg-gray-800 border-white/20' : 'bg-white border-gray-200'}`}>
          <div className="p-1.5">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="検索..."
              className={`w-full text-xs px-2 py-1.5 rounded border ${dark ? 'bg-gray-700 border-white/10 text-white placeholder-white/40' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            <div
              className={`px-3 py-1.5 text-xs cursor-pointer ${dark ? 'hover:bg-white/10 text-white/50' : 'hover:bg-gray-100 text-gray-400'} ${!value ? 'font-semibold' : ''}`}
              onClick={() => { onChange('', ''); setIsOpen(false); }}
            >-- 未設定 --</div>
            {filtered.map(f => (
              <div
                key={f.name}
                className={`px-3 py-1.5 text-xs cursor-pointer truncate ${dark ? 'hover:bg-white/10 text-white/80' : 'hover:bg-gray-100 text-gray-700'} ${f.name === value ? (dark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-50 text-indigo-700') : ''}`}
                onClick={() => { onChange(f.name, f.label); setIsOpen(false); }}
              >{f.label} ({f.name}){f._readOnly ? ' 🔒' : ''}</div>
            ))}
            {filtered.length === 0 && (
              <div className={`px-3 py-2 text-xs ${dark ? 'text-white/30' : 'text-gray-400'}`}>該当なし</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

// === 相対日付プリセット定義 ===
const DATE_PRESETS = [
  { key: 'today', label: '今日' },
  { key: 'yesterday', label: '昨日' },
  { key: 'yesterdayToToday', label: '昨日〜今日' },
  { key: 'thisMonth', label: '今月' },
  { key: 'thisMonth1stToYesterday', label: '今月1日〜昨日' },
  { key: 'thisMonth1stToToday', label: '今月1日〜今日' },
  { key: 'lastMonth', label: '先月' },
];

function resolveDatePreset(presetKey) {
  const now = new Date();
  const today = formatDateForInput(now);
  const yesterday = formatDateForInput(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const thisMonth1st = formatDateForInput(new Date(now.getFullYear(), now.getMonth(), 1));
  const thisMonthEnd = formatDateForInput(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const lastMonth1st = formatDateForInput(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const lastMonthEnd = formatDateForInput(new Date(now.getFullYear(), now.getMonth(), 0));
  const map = {
    today: { start: today, end: today },
    yesterday: { start: yesterday, end: yesterday },
    yesterdayToToday: { start: yesterday, end: today },
    thisMonth: { start: thisMonth1st, end: thisMonthEnd },
    thisMonth1stToYesterday: now.getDate() === 1
      ? { start: lastMonth1st, end: lastMonthEnd }
      : { start: thisMonth1st, end: yesterday },
    thisMonth1stToToday: { start: thisMonth1st, end: today },
    lastMonth: { start: lastMonth1st, end: lastMonthEnd },
  };
  return map[presetKey] || { start: '', end: '' };
}

const SalesforceSync = ({
  theme = 'dark',
  glassClass = '',
  config,
  allRows = [],
  sourceCache = {},
  activeFilters = {},
  allDashboards = [],
  switchDashboard,
  updateConfig,
  isLoading,
  onRefresh,
  sourceCacheByDashboard = {},
  calculatedDataCache = {},
  globalApiKey = '',
}) => {
  // === 設定読み込み ===
  const dataTables = config?.dataTables || [];
  const systemFields = config?.systemFields || [];
  const calculations = config?.calculations || [];
  const aggregationConfigs = config?.aggregationConfigs || [];

  // === 登録済みオブジェクト ===
  const registeredObjects = useMemo(() => config?.sfRegisteredObjects || [], [config?.sfRegisteredObjects]);

  // === インポートプリセット ===
  const presets = useMemo(() => config?.sfImportPresets || [], [config?.sfImportPresets]);

  // === タブ制御 ===
  const [activeTab, setActiveTab] = useState('import'); // 'objects' | 'import' | 'export' | 'unified'

  // ============================================================
  // === オブジェクト管理 State ===
  // ============================================================
  const [newObjApiName, setNewObjApiName] = useState('');
  const [newObjLabel, setNewObjLabel] = useState('');
  const [isRegisteringObj, setIsRegisteringObj] = useState(false);
  const [objStatusMessage, setObjStatusMessage] = useState('');
  const [editingObjId, setEditingObjId] = useState(null);
  const [editObjLabel, setEditObjLabel] = useState('');

  // ============================================================
  // === インポートプリセット State ===
  // ============================================================
  const [activePresetId, setActivePresetId] = useState(null);
  const [presetName, setPresetName] = useState('');
  const [presetObjectApiName, setPresetObjectApiName] = useState('');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [selectedAggConfigId, setSelectedAggConfigId] = useState('');
  const [keyMapping, setKeyMapping] = useState({ dataTableColumnId: '', sfFieldApiName: '' });
  const [fieldMappings, setFieldMappings] = useState([]);
  const [schedule, setSchedule] = useState({ enabled: false, frequency: 'daily', time: '09:00', dayOfWeek: 1, startTime: '09:00', endTime: '18:00', intervalHours: 1 });
  const [presetSfFields, setPresetSfFields] = useState([]);
  const [presetStatusMessage, setPresetStatusMessage] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [historyDetail, setHistoryDetail] = useState(null);
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false);

  // === SOQL Lookup モード State ===
  const [matchMode, setMatchMode] = useState('externalId'); // 'externalId' | 'soqlLookup'
  const [lookupRefField, setLookupRefField] = useState(''); // 参照関係フィールド e.g. 'Field128__c'
  const [lookupTargetField, setLookupTargetField] = useState(''); // 参照先フィールド e.g. 'Field11__c'
  const [lookupConditionField, setLookupConditionField] = useState(''); // 条件日付 e.g. 'Field163__c'
  const [targetMonth, setTargetMonth] = useState(''); // 'YYYY-MM' format
  const [idMap, setIdMap] = useState({}); // { dtKeyValue: sfRecordId }
  const [isResolving, setIsResolving] = useState(false);
  const resolveRequestIdRef = useRef(0);
  const importFileRef = useRef(null);
  const [matchResult, setMatchResult] = useState(null); // { matched, unmatched, total }
  const [resolveStatus, setResolveStatus] = useState({ message: '', kind: '' }); // kind: 'error' | 'success' | ''
  const [refObjectFields, setRefObjectFields] = useState([]); // 参照先オブジェクトのフィールド一覧
  const [isLoadingRefFields, setIsLoadingRefFields] = useState(false);
  const [recordMetadata, setRecordMetadata] = useState({}); // プレビュー用メタデータ { [sfRecordId]: { fieldPath: value } }

  // === 接続テスト State ===
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [connectionMessage, setConnectionMessage] = useState('');

  // === SF連携ローカルフィルター State ===
  const [sfLocalFilters, setSfLocalFilters] = useState({});

  // ============================================================
  // === エクスポート State (既存) ===
  // ============================================================
  const [exportObjectApiName, setExportObjectApiName] = useState('');
  const [exportSfFields, setExportSfFields] = useState([]);
  const [exportSfObjectLabel, setExportSfObjectLabel] = useState('');
  const [exportSelectedFields, setExportSelectedFields] = useState([]);
  const [exportWhereClause, setExportWhereClause] = useState('');
  const [exportOrderBy, setExportOrderBy] = useState('');
  const [exportLimitCount, setExportLimitCount] = useState(2000);
  const [exportIsDescribing, setExportIsDescribing] = useState(false);
  const [exportIsQuerying, setExportIsQuerying] = useState(false);
  const [exportQueryResult, setExportQueryResult] = useState(null);
  const [exportStatusMessage, setExportStatusMessage] = useState('');
  const [exportFieldSearch, setExportFieldSearch] = useState('');

  // ============================================================
  // === データ処理（インポート用） ===
  // ============================================================
  const selectedTableConfig = useMemo(
    () => dataTables.find(t => t.id === selectedTableId) || dataTables[0] || null,
    [dataTables, selectedTableId]
  );

  const {
    safeAggregationConfigs,
    currentAggConfig,
    dateTransforms,
    sourceExpand,
    isSourceExpandMode,
  } = useAggregationConfig({
    tableConfig: selectedTableConfig || { fields: [] },
    aggregationConfigs,
  });

  useEffect(() => {
    if (safeAggregationConfigs.length > 0 && !selectedAggConfigId) {
      const defaultId = selectedTableConfig?.defaultGroupBy || safeAggregationConfigs[0]?.id || '';
      setSelectedAggConfigId(defaultId);
    }
  }, [safeAggregationConfigs, selectedTableConfig, selectedAggConfigId]);

  const resolvedAggConfig = useMemo(() => {
    if (!selectedAggConfigId) return safeAggregationConfigs[0] || { groupByField: '', displayFields: [] };
    return safeAggregationConfigs.find(c => c.id === selectedAggConfigId) || safeAggregationConfigs[0] || { groupByField: '', displayFields: [] };
  }, [selectedAggConfigId, safeAggregationConfigs]);

  const groupByFields = useMemo(() => {
    if (!resolvedAggConfig.groupByField) return [];
    return [resolvedAggConfig.groupByField];
  }, [resolvedAggConfig]);

  // === ローカルフィルター解決（相対日付→絶対日付） ===
  const resolvedFilters = useMemo(() => {
    const resolved = { ...sfLocalFilters };
    if (resolved.date?.preset) {
      resolved.date = resolveDatePreset(resolved.date.preset);
    }
    return resolved;
  }, [sfLocalFilters]);

  // === フィルター選択肢生成（allRows = calculatedData から） ===
  const getFilterOptions = useCallback((targetField) => {
    const baseData = allRows || [];
    const uniqueValues = [...new Set(baseData.map(row => {
      const val = row[targetField];
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
  }, [allRows]);

  // === ローカルフィルター適用（行レベルフィルタリング） ===
  const localFilteredRows = useMemo(() => {
    if (!allRows || allRows.length === 0) return [];
    const filters = resolvedFilters;
    if (!filters || Object.keys(filters).length === 0) return allRows;

    const rawExcludeFilters = filters._exclude || {};
    // 先月モード用フィールドオーバーライド
    const quickDateMode = filters._quickDateMode;
    const fieldOverrides = {};
    if (quickDateMode === 'lastMonth') {
      (config?.filters || []).forEach(f => {
        if (f.lastMonthField) fieldOverrides[f.field] = f.lastMonthField;
      });
    }
    const getFieldValue = (row, originalKey) => {
      const overrideKey = fieldOverrides[originalKey];
      if (!overrideKey) return row[originalKey];
      const val = row[overrideKey];
      if (val === undefined || val === null || val === '') return row[originalKey];
      return val;
    };
    // 有効なフィルター定義に存在するフィールドのみ適用（孤立キー防止）
    const validFilterFields = new Set((config?.filters || []).map(f => f.field));
    const excludeFilters = {};
    for (const [key, val] of Object.entries(rawExcludeFilters)) {
      if (validFilterFields.has(key)) {
        excludeFilters[key] = val;
      }
    }
    const mappedFields = new Set();
    (calculations || []).forEach(calc => {
      if ((calc.type === 'relation' || calc.type === 'conditionalCount') && calc.filterMappings) {
        Object.keys(calc.filterMappings).forEach(field => mappedFields.add(field));
      }
    });

    return allRows.filter(row => {
      const passesNormal = Object.entries(filters).every(([key, val]) => {
        if (!val) return true;
        if (key === '_exclude' || key === '_quickDateMode') return true;
        if (mappedFields.has(key) && allRows.length > 0 && !(key in allRows[0])) return true;
        if (key === 'date' && typeof val === 'object') {
          if (!val.start && !val.end) return true;
          if (val.start && val.end) return isDateInRange(getFieldValue(row, key), val.start, val.end);
          return true;
        }
        if (Array.isArray(val)) {
          if (val.length === 0) return true;
          const rowValue = getFieldValue(row, key);
          if (val.includes('(空白)') && (rowValue === undefined || rowValue === null || rowValue === '')) return true;
          return val.includes(String(rowValue));
        }
        const rowValue = getFieldValue(row, key);
        if (val === '(空白)' && (rowValue === undefined || rowValue === null || rowValue === '')) return true;
        return String(rowValue) === String(val);
      });
      if (!passesNormal) return false;

      return Object.entries(excludeFilters).every(([fieldId, filterConfig]) => {
        const values = Array.isArray(filterConfig) ? filterConfig : (filterConfig?.values || []);
        const mode = Array.isArray(filterConfig) ? 'exclude' : (filterConfig?.mode || 'exclude');
        if (!values || values.length === 0) return true;
        const raw = getFieldValue(row, fieldId);
        const rowValue = (raw === undefined || raw === null || raw === '') ? '(空白)' : String(raw);
        return mode === 'include' ? values.includes(rowValue) : !values.includes(rowValue);
      });
    });
  }, [allRows, resolvedFilters, calculations, config?.filters]);

  const {
    processedData,
    numericFields,
    stringFields,
    arithmeticCalcs,
  } = useDataTableProcessing({
    allRows: localFilteredRows,
    tableConfig: selectedTableConfig || { fields: [] },
    systemFields,
    calculations,
    currentAggConfig: resolvedAggConfig,
    groupByFields,
    dateTransforms,
    isSourceExpandMode,
    sourceExpand,
    sourceCache,
    dataSources: config?.dataSources || [],
    activeFilters: resolvedFilters,
    mapping: config?.mapping || {},
  });

  // === 全フィールド一覧（DataTable表示列だけでなく全systemFields + calculations） ===
  const allAvailableFields = useMemo(() => {
    const fields = [];
    systemFields.forEach(f => {
      fields.push({ id: f.id, label: f.label, type: f.type || 'string' });
    });
    calculations.forEach(c => {
      fields.push({ id: c.id, label: c.label, type: c.type || 'calculation' });
    });
    // 指標グループの合計も候補に追加
    (config?.indicatorGroups || []).forEach(g => {
      if (!fields.find(f => f.id === g.id)) {
        fields.push({ id: g.id, label: g.label + '（グループ合計）', type: 'number' });
      }
    });
    if (processedData.length > 0 && processedData[0]._count !== undefined) {
      if (!fields.find(f => f.id === '_count')) {
        fields.push({ id: '_count', label: '件数', type: 'number' });
      }
    }
    return fields;
  }, [systemFields, calculations, processedData, config?.indicatorGroups]);

  // === 計算式テキスト生成（マッピングUI用） ===
  const getCalcFormulaText = useCallback((fieldId) => {
    const calc = calculations.find(c => c.id === fieldId);
    if (!calc) return null;
    const labelOf = (id) => {
      const sf = systemFields.find(f => f.id === id);
      if (sf) return sf.label;
      const c2 = calculations.find(c2 => c2.id === id);
      if (c2) return c2.label;
      return id;
    };
    switch (calc.type) {
      case 'arithmetic':
        if (calc.terms?.length > 0) {
          return calc.terms.map((t, i) =>
            i === 0 ? labelOf(t.field) : `${t.operator} ${labelOf(t.field)}`
          ).join(' ');
        }
        if (calc.fieldA && calc.fieldB) {
          return `${labelOf(calc.fieldA)} ${calc.operator} ${labelOf(calc.fieldB)}`;
        }
        return null;
      case 'relation':
        return `${calc.aggType === 'sum' ? 'SUM' : 'COUNT'}（リレーション）`;
      case 'conditionalCount':
        return '条件カウント';
      case 'constant':
        return `固定値: ${calc.constantValue}`;
      default:
        return null;
    }
  }, [calculations, systemFields]);

  // === DataTable表示ヘッダー（プレビュー用） ===
  const tableHeaders = useMemo(() => {
    if (!selectedTableConfig) return [];
    const headers = [];
    const addedIds = new Set();
    const addHeader = (id, label, type) => {
      if (addedIds.has(id)) return;
      addedIds.add(id);
      headers.push({ id, label, type });
    };
    // グループByフィールドを先頭に
    if (resolvedAggConfig.groupByField) {
      const gf = systemFields.find(f => f.id === resolvedAggConfig.groupByField);
      if (gf) addHeader(gf.id, gf.label, gf.type);
    }
    // 全指標を表示（systemFields + calculations）
    allAvailableFields.forEach(f => addHeader(f.id, f.label, f.type));
    return headers;
  }, [selectedTableConfig, resolvedAggConfig, systemFields, allAvailableFields]);

  // === プリセットのSFフィールドオプション（全フィールド表示、書込不可は末尾にマーク） ===
  const sfFieldOptions = useMemo(() => presetSfFields.map(f => ({
    ...f,
    _readOnly: !f.updateable && !f.createable,
  })), [presetSfFields]);
  const sfKeyFieldOptions = useMemo(() => presetSfFields, [presetSfFields]);
  // カスタム参照関係フィールドのみ（__c末尾）。標準参照(AccountId等)は__r変換できないため除外
  const sfRefFieldOptions = useMemo(() => presetSfFields.filter(f => f.type === 'reference' && f.name.endsWith('__c')), [presetSfFields]);

  // === 全プリセットのインポート履歴を集約（履歴タブ用） ===
  const allHistory = useMemo(() => {
    const entries = [];
    presets.forEach(p => {
      (p.importHistory || []).forEach(h => {
        entries.push({ ...h, presetName: p.name, presetId: p.id });
      });
    });
    return entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [presets]);

  // === SOQL Lookup: リレーションパス自動組立 ===
  // relationshipNameがあれば使用、なければ__c→__rフォールバック
  const lookupRelField = useMemo(() => {
    if (!lookupRefField || !lookupTargetField) return '';
    const refMeta = presetSfFields.find(f => f.name === lookupRefField);
    const relName = refMeta?.relationshipName || lookupRefField.replace(/__c$/, '__r');
    return relName + '.' + lookupTargetField;
  }, [lookupRefField, lookupTargetField, presetSfFields]);

  // === 対象月デフォルト（日付フィルターから自動推定） ===
  const defaultTargetMonth = useMemo(() => {
    const endDate = activeFilters?.date?.end;
    if (endDate) {
      const d = new Date(endDate.replace(/\//g, '-'));
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, [activeFilters?.date?.end]);

  // === 参照先オブジェクト情報（選択中の参照フィールドから自動取得） ===
  const selectedRefFieldMeta = useMemo(() => {
    if (!lookupRefField) return null;
    return sfRefFieldOptions.find(f => f.name === lookupRefField) || null;
  }, [lookupRefField, sfRefFieldOptions]);

  const refObjectName = useMemo(() => {
    if (!selectedRefFieldMeta?.referenceTo?.length) return '';
    return selectedRefFieldMeta.referenceTo[0];
  }, [selectedRefFieldMeta]);

  // 参照フィールド変更時に参照先オブジェクトのフィールドを自動ロード
  useEffect(() => {
    if (!refObjectName) {
      setRefObjectFields([]);
      return;
    }
    // 登録済みオブジェクトのキャッシュを優先
    const regObj = registeredObjects.find(o => o.apiName === refObjectName);
    if (regObj?.fieldsCache?.length) {
      setRefObjectFields(regObj.fieldsCache);
      return;
    }
    // キャッシュがなければAPIからdescribe
    let cancelled = false;
    setIsLoadingRefFields(true);
    salesforceApi.describeObject(refObjectName)
      .then(result => {
        if (cancelled) return;
        const fields = (result.fields || []).map(f => ({
          name: f.name, label: f.label, type: f.type,
          updateable: f.updateable, createable: f.createable,
          referenceTo: f.referenceTo || [], relationshipName: f.relationshipName || null,
        }));
        setRefObjectFields(fields);
      })
      .catch(() => {
        if (!cancelled) setRefObjectFields([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRefFields(false);
      });
    return () => { cancelled = true; };
  }, [refObjectName, registeredObjects]);

  // ============================================================
  // === オブジェクト管理アクション ===
  // ============================================================
  const handleRegisterObject = useCallback(async () => {
    const apiName = newObjApiName.trim();
    if (!apiName) return;
    if (registeredObjects.find(o => o.apiName === apiName)) {
      setObjStatusMessage('このオブジェクトは既に登録されています');
      return;
    }
    setIsRegisteringObj(true);
    setObjStatusMessage('');
    try {
      const result = await salesforceApi.describeObject(apiName);
      const fields = (result.fields || []).map(f => ({
        name: f.name, label: f.label, type: f.type,
        updateable: f.updateable, createable: f.createable,
        referenceTo: f.referenceTo || [], relationshipName: f.relationshipName || null,
      }));
      const newObj = {
        id: `sfobj_${Date.now()}`,
        apiName,
        label: newObjLabel.trim() || result.objectLabel || apiName,
        fieldsCache: fields,
        registeredAt: new Date().toISOString(),
      };
      const newList = [...registeredObjects, newObj];
      updateConfig('sfRegisteredObjects', newList);
      setNewObjApiName('');
      setNewObjLabel('');
      setObjStatusMessage(`${newObj.label} (${apiName}) を登録しました`);
    } catch (e) {
      setObjStatusMessage(`エラー: ${e.message}`);
    } finally {
      setIsRegisteringObj(false);
    }
  }, [newObjApiName, newObjLabel, registeredObjects, updateConfig]);

  const handleDeleteObject = useCallback((objId) => {
    const newList = registeredObjects.filter(o => o.id !== objId);
    updateConfig('sfRegisteredObjects', newList);
  }, [registeredObjects, updateConfig]);

  const handleRefreshObjectFields = useCallback(async (objId) => {
    const obj = registeredObjects.find(o => o.id === objId);
    if (!obj) return;
    try {
      const result = await salesforceApi.describeObject(obj.apiName);
      const fields = (result.fields || []).map(f => ({
        name: f.name, label: f.label, type: f.type,
        updateable: f.updateable, createable: f.createable,
        referenceTo: f.referenceTo || [], relationshipName: f.relationshipName || null,
      }));
      const newList = registeredObjects.map(o =>
        o.id === objId ? { ...o, fieldsCache: fields, registeredAt: new Date().toISOString() } : o
      );
      updateConfig('sfRegisteredObjects', newList);
      setObjStatusMessage(`${obj.label} のフィールド情報を更新しました`);
    } catch (e) {
      setObjStatusMessage(`エラー: ${e.message}`);
    }
  }, [registeredObjects, updateConfig]);

  const handleSaveObjLabel = useCallback((objId) => {
    const newList = registeredObjects.map(o =>
      o.id === objId ? { ...o, label: editObjLabel.trim() || o.label } : o
    );
    updateConfig('sfRegisteredObjects', newList);
    setEditingObjId(null);
    setEditObjLabel('');
  }, [registeredObjects, editObjLabel, updateConfig]);

  // presetSfFields更新時、fieldMappingsのsfFieldLabelを最新に同期
  useEffect(() => {
    if (presetSfFields.length === 0 || fieldMappings.length === 0) return;
    let changed = false;
    const updated = fieldMappings.map(m => {
      if (!m.sfFieldApiName) return m;
      const fresh = presetSfFields.find(f => f.name === m.sfFieldApiName);
      if (fresh && fresh.label !== m.sfFieldLabel) {
        changed = true;
        return { ...m, sfFieldLabel: fresh.label };
      }
      return m;
    });
    if (changed) setFieldMappings(updated);
  }, [presetSfFields]);

  // allAvailableFields変更時、fieldMappingsを同期（不足追加 + 存在しないフィールド除去）
  useEffect(() => {
    if (allAvailableFields.length === 0) return;
    const availableIds = new Set(allAvailableFields.map(f => f.id));

    // 存在しないフィールドを除去
    const cleaned = fieldMappings.filter(m => availableIds.has(m.dataTableColumnId));
    const removedCount = fieldMappings.length - cleaned.length;

    // 不足しているフィールドを追加
    const existingIds = new Set(cleaned.map(m => m.dataTableColumnId));
    const newFields = allAvailableFields.filter(f => !existingIds.has(f.id));
    const newMappings = newFields.map(f => ({
      id: `sfm_${Date.now()}_${f.id}`,
      dataTableColumnId: f.id,
      dataTableColumnLabel: f.label,
      sfFieldApiName: '',
      sfFieldLabel: '',
      enabled: false,
    }));

    if (removedCount > 0 || newMappings.length > 0) {
      setFieldMappings([...cleaned, ...newMappings]);
    }
  }, [allAvailableFields]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================
  // === インポートプリセットアクション ===
  // ============================================================
  const handleSelectPreset = useCallback((presetId) => {
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;
    setActivePresetId(presetId);
    setPresetName(preset.name || '');
    setPresetObjectApiName(preset.sfObjectApiName || '');
    setSelectedTableId(preset.tableId || dataTables[0]?.id || '');
    setSelectedAggConfigId(preset.aggConfigId || '');
    setKeyMapping(preset.keyMapping || { dataTableColumnId: '', sfFieldApiName: '' });
    setFieldMappings(preset.fieldMappings || []);
    setSchedule(preset.schedule || { enabled: false, frequency: 'daily', time: '09:00', dayOfWeek: 1, startTime: '09:00', endTime: '18:00', intervalHours: 1 });
    // SOQL Lookup設定を復元（lookupRefField/lookupTargetField直接保存を優先、なければlookupRelFieldから互換復元）
    setMatchMode(preset.matchMode || 'externalId');
    if (preset.lookupRefField) {
      setLookupRefField(preset.lookupRefField);
      setLookupTargetField(preset.lookupTargetField || '');
    } else {
      const relField = preset.lookupRelField || '';
      if (relField && relField.includes('.')) {
        const parts = relField.split('.');
        setLookupRefField(parts[0].replace(/__r$/, '__c'));
        setLookupTargetField(parts.slice(1).join('.'));
      } else {
        setLookupRefField('');
        setLookupTargetField('');
      }
    }
    setLookupConditionField(preset.lookupConditionField || '');
    setSfLocalFilters(preset.filterValues || {});
    setTargetMonth(defaultTargetMonth);
    setIdMap({});
    setMatchResult(null);
    setResolveStatus({ message: '', kind: '' });
    resolveRequestIdRef.current++;
    setIsResolving(false);
    // SFフィールドを登録済みオブジェクトのキャッシュから復元
    const regObj = registeredObjects.find(o => o.apiName === preset.sfObjectApiName);
    setPresetSfFields(regObj?.fieldsCache || []);
    setPresetStatusMessage('');
  }, [presets, dataTables, registeredObjects, defaultTargetMonth]);

  const handleNewPreset = useCallback(() => {
    const newId = `preset_${Date.now()}`;
    setActivePresetId(newId);
    setPresetName('新しいプリセット');
    setPresetObjectApiName('');
    setSelectedTableId(dataTables[0]?.id || '');
    setSelectedAggConfigId('');
    setKeyMapping({ dataTableColumnId: '', sfFieldApiName: '' });
    setFieldMappings([]);
    setSchedule({ enabled: false, frequency: 'daily', time: '09:00', dayOfWeek: 1, startTime: '09:00', endTime: '18:00', intervalHours: 1 });
    setMatchMode('externalId');
    setLookupRefField('');
    setLookupTargetField('');
    setLookupConditionField('');
    setSfLocalFilters({});
    setTargetMonth(defaultTargetMonth);
    setIdMap({});
    setMatchResult(null);
    setResolveStatus({ message: '', kind: '' });
    resolveRequestIdRef.current++;
    setIsResolving(false);
    setPresetSfFields([]);
    setPresetStatusMessage('');
  }, [dataTables, defaultTargetMonth]);

  const handleSavePreset = useCallback(() => {
    if (!activePresetId || !presetName.trim()) return;
    const presetData = {
      id: activePresetId,
      name: presetName.trim(),
      sfObjectApiName: presetObjectApiName,
      sfObjectLabel: registeredObjects.find(o => o.apiName === presetObjectApiName)?.label || presetObjectApiName,
      tableId: selectedTableId,
      aggConfigId: selectedAggConfigId,
      keyMapping,
      fieldMappings,
      schedule,
      matchMode,
      lookupRefField,
      lookupTargetField,
      lookupRelField: lookupRelField || '',
      lookupConditionField,
      filterValues: sfLocalFilters,
      lastRunAt: presets.find(p => p.id === activePresetId)?.lastRunAt || null,
      importHistory: presets.find(p => p.id === activePresetId)?.importHistory || [],
      createdAt: presets.find(p => p.id === activePresetId)?.createdAt || new Date().toISOString(),
    };
    const existing = presets.find(p => p.id === activePresetId);
    const newPresets = existing
      ? presets.map(p => p.id === activePresetId ? presetData : p)
      : [...presets, presetData];
    updateConfig('sfImportPresets', newPresets);
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 2000);
    setPresetStatusMessage('プリセットを保存しました');
    setTimeout(() => setPresetStatusMessage(''), 3000);
  }, [activePresetId, presetName, presetObjectApiName, selectedTableId, selectedAggConfigId, keyMapping, fieldMappings, schedule, matchMode, lookupRefField, lookupTargetField, lookupRelField, lookupConditionField, sfLocalFilters, presets, registeredObjects, updateConfig]);

  const handleDeletePreset = useCallback((presetId) => {
    const newPresets = presets.filter(p => p.id !== presetId);
    updateConfig('sfImportPresets', newPresets);
    if (activePresetId === presetId) {
      setActivePresetId(null);
      setPresetName('');
      setPresetObjectApiName('');
      setFieldMappings([]);
    }
  }, [presets, activePresetId, updateConfig]);

  // === プリセットJSONエクスポート/インポート ===
  const handleExportPresets = useCallback(() => {
    const data = JSON.stringify(presets, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sf-import-presets_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [presets]);

  const handleImportPresetsFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (!Array.isArray(imported)) throw new Error('配列ではありません');
        const merged = [...presets];
        imported.forEach(p => {
          if (!p.name) return;
          const exists = merged.find(m => m.id === p.id);
          if (exists) {
            p = { ...p, id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` };
          }
          merged.push(p);
        });
        updateConfig('sfImportPresets', merged);
      } catch (err) {
        alert('JSONの読み込みに失敗しました: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [presets, updateConfig]);

  // === インポート完了時の履歴保存 ===
  const handleImportComplete = useCallback((resultData, records) => {
    if (!activePresetId) return;
    const entry = {
      id: `hist_${Date.now()}`,
      timestamp: new Date().toISOString(),
      source: 'manual',
      ...resultData,
      filterValues: sfLocalFilters,
    };
    const updated = presets.map(p => {
      if (p.id !== activePresetId) return p;
      const history = [entry, ...(p.importHistory || [])].slice(0, 100);
      return { ...p, importHistory: history, lastRunAt: entry.timestamp };
    });
    updateConfig('sfImportPresets', updated);

    // 詳細データを別ファイルに保存（非同期・エラーは無視）
    if (records && records.length > 0) {
      const columns = Object.keys(records[0]);
      const columnLabels = {};
      presetSfFields.forEach(f => { columnLabels[f.name] = f.label; });
      // SF Record ID → 元データ名のマッピング構築
      const nameMapObj = {};
      if (matchMode === 'soqlLookup' && idMap) {
        // idMap: { originalName: sfRecordId } → 反転
        Object.entries(idMap).forEach(([name, sfId]) => { nameMapObj[sfId] = name; });
      }
      const keyColName = keyMapping.dataTableColumnId || '';
      setPresetStatusMessage(SALESFORCE_DEMO_MESSAGE);
    }
  }, [activePresetId, presets, sfLocalFilters, updateConfig, presetSfFields, matchMode, idMap, keyMapping]);

  // === 履歴詳細データの取得 ===
  const handleHistoryClick = useCallback(async (histId) => {
    if (selectedHistoryId === histId) {
      setSelectedHistoryId(null);
      setHistoryDetail(null);
      return;
    }
    setSelectedHistoryId(histId);
    setHistoryDetail(null);
    setHistoryDetail({ message: SALESFORCE_DEMO_MESSAGE });
    setHistoryDetailLoading(false);
  }, [selectedHistoryId]);

  // オブジェクト選択時にSFフィールドをキャッシュから読み込み
  const handlePresetObjectChange = useCallback((apiName) => {
    setPresetObjectApiName(apiName);
    // SOQL Lookup関連のステートをクリア（オブジェクト変更時に前のIDマップが残らないように）
    // 進行中の突合リクエストを無効化（完了しても古い結果が反映されないように）
    resolveRequestIdRef.current++;
    setIdMap({});
    setMatchResult(null);
    setResolveStatus({ message: '', kind: '' });
    setIsResolving(false);
    setRecordMetadata({});
    const regObj = registeredObjects.find(o => o.apiName === apiName);
    if (regObj?.fieldsCache) {
      setPresetSfFields(regObj.fieldsCache);
      // マッピングが空なら全フィールドで初期生成
      if (fieldMappings.length === 0 && allAvailableFields.length > 0) {
        const newMappings = allAvailableFields.map(f => ({
          id: `sfm_${Date.now()}_${f.id}`,
          dataTableColumnId: f.id,
          dataTableColumnLabel: f.label,
          sfFieldApiName: '',
          sfFieldLabel: '',
          enabled: false,
        }));
        setFieldMappings(newMappings);
      }
    } else {
      setPresetSfFields([]);
    }
  }, [registeredObjects, fieldMappings.length, allAvailableFields]);

  // マッピング候補を全フィールドで再生成
  const handleResetMappings = useCallback(() => {
    const newMappings = allAvailableFields.map(f => {
      const existing = fieldMappings.find(m => m.dataTableColumnId === f.id);
      return existing || {
        id: `sfm_${Date.now()}_${f.id}`,
        dataTableColumnId: f.id,
        dataTableColumnLabel: f.label,
        sfFieldApiName: '',
        sfFieldLabel: '',
        enabled: false,
      };
    });
    setFieldMappings(newMappings);
  }, [allAvailableFields, fieldMappings]);

  // SFフィールド情報を最新に更新（インポート先の項目が増えた時用）
  const [isRefreshingSfFields, setIsRefreshingSfFields] = useState(false);
  const [mappingSearch, setMappingSearch] = useState('');
  const [mappingSort, setMappingSort] = useState('default');

  // マッピング検索・ソート
  const sortedFilteredMappings = useMemo(() => {
    let items = fieldMappings.map((mapping, idx) => ({ mapping, originalIdx: idx }));

    // 検索フィルター
    if (mappingSearch) {
      const q = mappingSearch.toLowerCase();
      items = items.filter(({ mapping }) => {
        const fieldInfo = allAvailableFields.find(f => f.id === mapping.dataTableColumnId);
        const label = (fieldInfo?.label || mapping.dataTableColumnLabel || '').toLowerCase();
        const id = (mapping.dataTableColumnId || '').toLowerCase();
        const sfName = (mapping.sfFieldApiName || '').toLowerCase();
        const sfLabel = (mapping.sfFieldLabel || '').toLowerCase();
        return label.includes(q) || id.includes(q) || sfName.includes(q) || sfLabel.includes(q);
      });
    }

    // ソート
    if (mappingSort === 'name-asc') {
      items.sort((a, b) => {
        const la = (allAvailableFields.find(f => f.id === a.mapping.dataTableColumnId)?.label || a.mapping.dataTableColumnId).toLowerCase();
        const lb = (allAvailableFields.find(f => f.id === b.mapping.dataTableColumnId)?.label || b.mapping.dataTableColumnId).toLowerCase();
        return la.localeCompare(lb, 'ja');
      });
    } else if (mappingSort === 'name-desc') {
      items.sort((a, b) => {
        const la = (allAvailableFields.find(f => f.id === a.mapping.dataTableColumnId)?.label || a.mapping.dataTableColumnId).toLowerCase();
        const lb = (allAvailableFields.find(f => f.id === b.mapping.dataTableColumnId)?.label || b.mapping.dataTableColumnId).toLowerCase();
        return lb.localeCompare(la, 'ja');
      });
    } else if (mappingSort === 'enabled') {
      items.sort((a, b) => (b.mapping.enabled ? 1 : 0) - (a.mapping.enabled ? 1 : 0));
    }

    return items;
  }, [fieldMappings, mappingSearch, mappingSort, allAvailableFields]);
  const handleRefreshPresetSfFields = useCallback(async () => {
    if (!presetObjectApiName) return;
    setIsRefreshingSfFields(true);
    try {
      const result = await salesforceApi.describeObject(presetObjectApiName);
      const fields = (result.fields || []).map(f => ({
        name: f.name, label: f.label, type: f.type,
        updateable: f.updateable, createable: f.createable,
        referenceTo: f.referenceTo || [], relationshipName: f.relationshipName || null,
      }));
      setPresetSfFields(fields);
      // 登録済みオブジェクトのキャッシュも更新
      const regObj = registeredObjects.find(o => o.apiName === presetObjectApiName);
      if (regObj) {
        const newList = registeredObjects.map(o =>
          o.apiName === presetObjectApiName ? { ...o, fieldsCache: fields, registeredAt: new Date().toISOString() } : o
        );
        updateConfig('sfRegisteredObjects', newList);
      }
      setPresetStatusMessage('SF項目を最新に更新しました');
    } catch (e) {
      setPresetStatusMessage(`SF項目更新エラー: ${e.message}`);
    } finally {
      setIsRefreshingSfFields(false);
    }
  }, [presetObjectApiName, registeredObjects, updateConfig]);

  // === SOQL Lookup: 突合検索 ===
  const handleResolveIds = useCallback(async () => {
    if (matchMode !== 'soqlLookup') return;
    if (!presetObjectApiName) {
      setMatchResult(null);
      setResolveStatus({ message: 'SFオブジェクトを選択してください', kind: 'error' });
      return;
    }
    if (!presetObjectApiName.endsWith('__c')) {
      setMatchResult(null);
      setResolveStatus({ message: 'SOQL Lookupモードはカスタムオブジェクト（__c）のみ対応しています', kind: 'error' });
      return;
    }
    if (!keyMapping.dataTableColumnId) {
      setMatchResult(null);
      setResolveStatus({ message: 'Step 1: DataTable側の照合キー列を選択してください', kind: 'error' });
      return;
    }
    if (!lookupRefField) {
      setMatchResult(null);
      setResolveStatus({ message: 'Step 2: 参照フィールドを選択してください', kind: 'error' });
      return;
    }
    if (!lookupTargetField) {
      setMatchResult(null);
      setResolveStatus({ message: 'Step 2: 照合に使うフィールドを選択してください', kind: 'error' });
      return;
    }
    if (!lookupRelField) {
      setMatchResult(null);
      setResolveStatus({ message: 'Step 2: 照合パスが正しく構成できません', kind: 'error' });
      return;
    }
    if (!lookupConditionField) {
      setMatchResult(null);
      setResolveStatus({ message: 'Step 3: 月絞り込み用の日付フィールドを選択してください', kind: 'error' });
      return;
    }
    if (!targetMonth) {
      setMatchResult(null);
      setResolveStatus({ message: '対象年月を選択してください', kind: 'error' });
      return;
    }
    if (!processedData || processedData.length === 0) {
      setMatchResult(null);
      setResolveStatus({ message: 'データがありません。上部の「データを更新」ボタンでデータを取得してから実行してください', kind: 'error' });
      return;
    }

    const lookupValues = processedData.map(row => row[keyMapping.dataTableColumnId]).filter(v => v != null && v !== '');
    if (lookupValues.length === 0) {
      setMatchResult(null);
      setResolveStatus({ message: '突合キー列にデータが含まれていません（すべて空値です）', kind: 'error' });
      return;
    }

    // 月範囲条件: field >= YYYY-MM-01 AND field < YYYY-{MM+1}-01
    const [year, month] = targetMonth.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
    const additionalWhere = `${lookupConditionField} >= ${startDate} AND ${lookupConditionField} < ${endDate}`;

    // プレビュー用メタデータフィールド（獲得者名・日付）
    const extraFields = [];
    if (lookupConditionField) {
      extraFields.push(lookupConditionField);
    }
    if (selectedRefFieldMeta) {
      const hasNameField = refObjectFields.some(f => f.name === 'Name');
      if (hasNameField) {
        const relName = selectedRefFieldMeta.relationshipName || lookupRefField.replace(/__c$/, '__r');
        extraFields.push(relName + '.Name');
      }
    }

    const currentRequestId = ++resolveRequestIdRef.current;
    setIsResolving(true);
    setIdMap({});
    setMatchResult(null);
    setRecordMetadata({});
    setResolveStatus({ message: '', kind: '' });
    try {
      let resolveResult;
      try {
        resolveResult = await salesforceApi.resolveRecordIds(presetObjectApiName, lookupRelField, lookupValues, additionalWhere, extraFields);
      } catch (extraFieldsErr) {
        // extraFields付きクエリが失敗した場合（FLS権限不足等）、extraFieldsなしでリトライ
        if (extraFields.length > 0) {
          resolveResult = await salesforceApi.resolveRecordIds(presetObjectApiName, lookupRelField, lookupValues, additionalWhere, []);
          resolveResult.metadata = Object.create(null); // メタデータは空にする
        } else {
          throw extraFieldsErr;
        }
      }
      const { idMap: map, duplicates, metadata } = resolveResult;
      // 非同期競合防止: 最新リクエストでなければ結果を破棄
      if (currentRequestId !== resolveRequestIdRef.current) return;
      setIdMap(map);
      setRecordMetadata(metadata || {});
      const uniqueValues = [...new Set(lookupValues.map(v => String(v).toLowerCase()))];
      const matched = uniqueValues.filter(v => map[v]).length;
      const duplicateCount = Object.keys(duplicates).length;
      setMatchResult({ matched, unmatched: uniqueValues.length - matched - duplicateCount, total: uniqueValues.length, duplicates: duplicateCount });
      let msg = `突合完了: ${matched}件マッチ / ${uniqueValues.length - matched - duplicateCount}件未マッチ`;
      if (duplicateCount > 0) {
        msg += ` / ${duplicateCount}件重複（スキップ）`;
      }
      const hasWarning = (uniqueValues.length - matched - duplicateCount) > 0 || duplicateCount > 0;
      setResolveStatus({ message: msg, kind: hasWarning ? 'warning' : 'success' });
    } catch (err) {
      if (currentRequestId !== resolveRequestIdRef.current) return;
      setMatchResult(null);
      setIdMap({});
      setRecordMetadata({});
      setResolveStatus({ message: `突合エラー: ${err.message}`, kind: 'error' });
    } finally {
      if (currentRequestId === resolveRequestIdRef.current) {
        setIsResolving(false);
      }
    }
  }, [matchMode, targetMonth, lookupRefField, lookupTargetField, lookupRelField, lookupConditionField, presetObjectApiName, processedData, keyMapping.dataTableColumnId, selectedRefFieldMeta, refObjectFields]);

  // 対象月変更時に自動突合
  useEffect(() => {
    if (matchMode === 'soqlLookup' && targetMonth && lookupRelField && lookupConditionField && presetObjectApiName && processedData?.length > 0 && keyMapping.dataTableColumnId) {
      handleResolveIds();
    }
  }, [targetMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  // processedData変更時にidMap/突合結果をクリア（stale防止）
  useEffect(() => {
    if (matchMode === 'soqlLookup') {
      const hadResults = Object.keys(idMap).length > 0 || matchResult;
      setIdMap({});
      setMatchResult(null);
      resolveRequestIdRef.current++;
      setIsResolving(false);
      if (hadResults) {
        setResolveStatus({ message: 'データが更新されました。再度「突合検索」を実行してください', kind: 'error' });
      }
    }
  }, [processedData]); // eslint-disable-line react-hooks/exhaustive-deps

  // === インポート用レコード生成 ===
  const importRecords = useMemo(() => {
    if (!processedData || processedData.length === 0) return [];
    if (!keyMapping.dataTableColumnId) return [];
    const enabledMappings = fieldMappings.filter(m => m.enabled && m.sfFieldApiName);
    if (enabledMappings.length === 0) return [];

    if (matchMode === 'soqlLookup') {
      // SOQL Lookup: idMapからSF Record IDを注入、マッチ済みのみ
      if (Object.keys(idMap).length === 0) return [];
      return processedData
        .filter(row => {
          const raw = row[keyMapping.dataTableColumnId];
          const dtKey = raw == null ? '' : String(raw).toLowerCase();
          return !!idMap[dtKey];
        })
        .map(row => {
          const record = {};
          const raw = row[keyMapping.dataTableColumnId];
          const dtKey = raw == null ? '' : String(raw).toLowerCase();
          record['Id'] = idMap[dtKey];
          enabledMappings.forEach(m => {
            const val = row[m.dataTableColumnId];
            record[m.sfFieldApiName] = val !== undefined && val !== null ? val : null;
          });
          return record;
        });
    }

    // External ID モード（既存）
    if (!keyMapping.sfFieldApiName) return [];
    return processedData.map(row => {
      const record = {};
      record[keyMapping.sfFieldApiName] = row[keyMapping.dataTableColumnId];
      enabledMappings.forEach(m => {
        const val = row[m.dataTableColumnId];
        record[m.sfFieldApiName] = val !== undefined && val !== null ? val : null;
      });
      return record;
    });
  }, [processedData, keyMapping, fieldMappings, matchMode, idMap]);

  // === 未マッチ行データ（SOQL Lookupモード用） ===
  const unmatchedRows = useMemo(() => {
    if (matchMode !== 'soqlLookup' || !processedData?.length || !keyMapping.dataTableColumnId) return [];
    if (Object.keys(idMap).length === 0) return [];
    const enabledMappings = fieldMappings.filter(m => m.enabled && m.sfFieldApiName);
    return processedData
      .filter(row => {
        const raw = row[keyMapping.dataTableColumnId];
        const dtKey = raw == null ? '' : String(raw).toLowerCase();
        return !idMap[dtKey];
      })
      .map(row => {
        const record = { Id: null };
        enabledMappings.forEach(m => {
          record[m.sfFieldApiName] = row[m.dataTableColumnId] ?? null;
        });
        return record;
      });
  }, [matchMode, processedData, keyMapping, fieldMappings, idMap]);

  // === プレビュー用メタデータ列定義 ===
  // recordMetadataが空の場合は列を表示しない（取得データと列定義の同期保証）
  const metadataColumns = useMemo(() => {
    if (matchMode !== 'soqlLookup') return [];
    if (Object.keys(recordMetadata).length === 0) return [];
    const cols = [];
    if (selectedRefFieldMeta) {
      const hasNameField = refObjectFields.some(f => f.name === 'Name');
      if (hasNameField) {
        const relName = selectedRefFieldMeta.relationshipName || lookupRefField.replace(/__c$/, '__r');
        cols.push({ fieldPath: relName + '.Name', label: selectedRefFieldMeta.label || '参照先' });
      }
    }
    if (lookupConditionField) {
      const meta = presetSfFields.find(f => f.name === lookupConditionField);
      cols.push({ fieldPath: lookupConditionField, label: meta?.label || lookupConditionField });
    }
    return cols;
  }, [matchMode, selectedRefFieldMeta, lookupRefField, lookupConditionField, presetSfFields, refObjectFields, recordMetadata]);

  const canImport = (() => {
    if (isResolving) return false;
    if (!presetObjectApiName || !keyMapping.dataTableColumnId) return false;
    if (!fieldMappings.some(m => m.enabled && m.sfFieldApiName)) return false;
    if (matchMode === 'soqlLookup') {
      if (!presetObjectApiName.endsWith('__c')) return false;
      return Object.keys(idMap).length > 0 && importRecords.length > 0;
    }
    return keyMapping.sfFieldApiName && importRecords.length > 0;
  })();

  // === 接続テスト ===
  const handleTestConnection = async () => {
    setIsTesting(true);
    setConnectionStatus(null);
    try {
      await salesforceApi.testConnection();
      setConnectionStatus('success');
      setConnectionMessage('接続成功');
    } catch (e) {
      setConnectionStatus('error');
      setConnectionMessage(e.message);
    } finally {
      setIsTesting(false);
    }
  };

  // ============================================================
  // === エクスポートアクション (既存ロジックをほぼ維持) ===
  // ============================================================
  const handleExportDescribe = async () => {
    const apiName = exportObjectApiName.trim();
    if (!apiName) return;
    // 登録済みオブジェクトのキャッシュから取得試行
    const regObj = registeredObjects.find(o => o.apiName === apiName);
    if (regObj?.fieldsCache?.length) {
      setExportSfFields(regObj.fieldsCache);
      setExportSfObjectLabel(regObj.label);
      setExportSelectedFields([]);
      setExportStatusMessage(`${regObj.label} (${regObj.fieldsCache.length}項目) をキャッシュから取得しました`);
      return;
    }
    setExportIsDescribing(true);
    setExportStatusMessage('');
    try {
      const result = await salesforceApi.describeObject(apiName);
      setExportSfFields(result.fields);
      setExportSfObjectLabel(result.objectLabel);
      setExportSelectedFields([]);
      setExportStatusMessage(`${result.objectLabel} (${result.fields.length}項目) を取得しました`);
    } catch (e) {
      setExportStatusMessage(e.message);
    } finally {
      setExportIsDescribing(false);
    }
  };

  // エクスポート: オブジェクト選択時にフィールドを自動ロード
  const handleExportObjectChange = useCallback((apiName) => {
    setExportObjectApiName(apiName);
    setExportSfFields([]);
    setExportSfObjectLabel('');
    setExportSelectedFields([]);
    setExportQueryResult(null);
    const regObj = registeredObjects.find(o => o.apiName === apiName);
    if (regObj?.fieldsCache?.length) {
      setExportSfFields(regObj.fieldsCache);
      setExportSfObjectLabel(regObj.label);
    }
  }, [registeredObjects]);

  const handleExportQuery = async () => {
    if (exportSelectedFields.length === 0) return;
    setExportIsQuerying(true);
    setExportStatusMessage('');
    setExportQueryResult(null);
    try {
      const result = await salesforceApi.queryRecords(
        exportObjectApiName.trim(),
        exportSelectedFields,
        { whereClause: exportWhereClause.trim(), orderBy: exportOrderBy.trim(), limitCount: exportLimitCount }
      );
      setExportQueryResult(result);
      setExportStatusMessage(`${result.totalSize} 件のレコードを取得しました`);
    } catch (e) {
      setExportStatusMessage(e.message);
    } finally {
      setExportIsQuerying(false);
    }
  };

  const handleExportCsv = useCallback(() => {
    if (!exportQueryResult?.records?.length) return;
    const records = exportQueryResult.records;
    const fields = exportSelectedFields;
    const escapeCell = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };
    const headerRow = fields.map(f => escapeCell(f)).join(',');
    const dataRows = records.map(row => fields.map(f => escapeCell(row[f])).join(','));
    const bom = '\uFEFF';
    const csvContent = bom + headerRow + '\n' + dataRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportObjectApiName}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [exportQueryResult, exportSelectedFields, exportObjectApiName]);

  const filteredExportFields = useMemo(() => {
    if (!exportFieldSearch.trim()) return exportSfFields;
    const q = exportFieldSearch.toLowerCase();
    return exportSfFields.filter(f => f.name.toLowerCase().includes(q) || f.label.toLowerCase().includes(q));
  }, [exportSfFields, exportFieldSearch]);

  // ============================================================
  // === スタイル定数 ===
  // ============================================================
  const cardClass = theme === 'dark'
    ? 'bg-white/5 border border-white/10 rounded-xl'
    : 'bg-white border border-gray-200 rounded-xl shadow-sm';
  const textClass = theme === 'dark' ? 'text-white' : 'text-gray-800';
  const mutedClass = theme === 'dark' ? 'text-white/60' : 'text-gray-500';
  const inputClass = theme === 'dark'
    ? 'bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors'
    : 'bg-white border border-gray-300 text-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors';
  const selectClass = theme === 'dark'
    ? 'bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 cursor-pointer'
    : 'bg-white border border-gray-300 text-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 cursor-pointer';
  const optionClass = theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-white text-gray-800';
  const btnPrimaryClass = 'bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const btnSecondaryClass = theme === 'dark'
    ? 'bg-white/10 hover:bg-white/20 text-white/80 px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2'
    : 'bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2';
  const btnDangerClass = 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1';
  const labelClass = `text-xs font-medium mb-1 block ${mutedClass}`;

  // ============================================================
  // === レンダリング ===
  // ============================================================
  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${theme === 'dark' ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}>
              <Cloud size={24} className="text-indigo-400" />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${textClass}`}>SF連携</h2>
              <p className={`text-xs ${mutedClass}`}>Salesforceとのデータ連携</p>
            </div>
          </div>
        </div>

        {/* タブバー（4タブ） */}
        <div className={`flex rounded-xl overflow-hidden ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gray-100 border border-gray-200'}`}>
          {[
            { key: 'objects', icon: Database, label: 'オブジェクト管理' },
            { key: 'import', icon: ArrowUpRight, label: 'インポート' },
            { key: 'export', icon: ArrowDownLeft, label: 'エクスポート' },
            { key: 'history', icon: History, label: 'インポート履歴' },
            { key: 'unified', icon: Layers, label: '稼働実績一括' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? theme === 'dark'
                    ? 'bg-indigo-500/20 text-indigo-300 border-b-2 border-indigo-400'
                    : 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500'
                  : theme === 'dark'
                    ? 'text-white/50 hover:text-white/80 hover:bg-white/5'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ============================== */}
        {/* === オブジェクト管理タブ === */}
        {/* ============================== */}
        {activeTab === 'objects' && (<>
          <div className={cardClass}>
            <div className={`p-4 border-b flex items-center gap-2 ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
              <Database size={16} className="text-indigo-400" />
              <span className={`text-sm font-semibold ${textClass}`}>SFオブジェクト登録</span>
            </div>
            <div className="p-4 space-y-4">
              <p className={`text-xs ${mutedClass}`}>
                インポート・エクスポートで使用するSFオブジェクトを事前に登録してください。登録時にフィールド情報が自動取得されます。
              </p>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
                <div>
                  <label className={labelClass}>API名</label>
                  <input
                    type="text"
                    value={newObjApiName}
                    onChange={(e) => setNewObjApiName(e.target.value)}
                    placeholder="例: CustomObject11__c"
                    className={`${inputClass} w-full`}
                  />
                </div>
                <div>
                  <label className={labelClass}>表示ラベル（任意）</label>
                  <input
                    type="text"
                    value={newObjLabel}
                    onChange={(e) => setNewObjLabel(e.target.value)}
                    placeholder="例: 稼働実績"
                    className={`${inputClass} w-full`}
                  />
                </div>
                <button
                  onClick={handleRegisterObject}
                  disabled={isRegisteringObj || !newObjApiName.trim()}
                  className={btnPrimaryClass}
                >
                  {isRegisteringObj ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  登録
                </button>
              </div>
              {objStatusMessage && (
                <div className={`text-xs flex items-center gap-1 ${
                  objStatusMessage.includes('エラー') ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  {objStatusMessage.includes('エラー') ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
                  {objStatusMessage}
                </div>
              )}
            </div>
          </div>

          {/* 登録済みオブジェクト一覧 */}
          <div className={cardClass}>
            <div className={`p-4 border-b flex items-center gap-2 ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
              <Package size={16} className="text-indigo-400" />
              <span className={`text-sm font-semibold ${textClass}`}>登録済みオブジェクト ({registeredObjects.length})</span>
            </div>
            <div className="divide-y divide-white/5">
              {registeredObjects.length === 0 && (
                <div className={`p-8 text-center text-sm ${mutedClass}`}>
                  まだオブジェクトが登録されていません
                </div>
              )}
              {registeredObjects.map(obj => (
                <div key={obj.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {editingObjId === obj.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editObjLabel}
                          onChange={(e) => setEditObjLabel(e.target.value)}
                          className={`${inputClass} flex-1`}
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveObjLabel(obj.id)}
                        />
                        <button onClick={() => handleSaveObjLabel(obj.id)} className={btnPrimaryClass + ' !px-3 !py-1.5'}>
                          <Check size={12} />
                        </button>
                        <button onClick={() => setEditingObjId(null)} className={btnSecondaryClass + ' !px-3 !py-1.5'}>
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className={`text-sm font-medium ${textClass}`}>{obj.label}</div>
                        <div className={`text-xs ${mutedClass}`}>
                          {obj.apiName} - {obj.fieldsCache?.length || 0}フィールド
                          {obj.registeredAt && ` - 最終取得: ${new Date(obj.registeredAt).toLocaleDateString('ja-JP')}`}
                        </div>
                      </div>
                    )}
                  </div>
                  {editingObjId !== obj.id && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setEditingObjId(obj.id); setEditObjLabel(obj.label); }}
                        className={`p-1.5 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-white/40 hover:text-white/80' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'}`}
                        title="ラベル編集"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleRefreshObjectFields(obj.id)}
                        className={`p-1.5 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-white/40 hover:text-white/80' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'}`}
                        title="フィールド情報を更新"
                      >
                        <RefreshCw size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteObject(obj.id)}
                        className={`p-1.5 rounded-lg transition-colors hover:bg-rose-500/20 text-rose-400/60 hover:text-rose-400`}
                        title="削除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>)}

        {/* ============================== */}
        {/* === インポートタブ === */}
        {/* ============================== */}
        {activeTab === 'import' && (<>

          {/* 接続テスト */}
          <div className="flex items-center gap-3">
            <button onClick={handleTestConnection} disabled={isTesting} className={btnSecondaryClass}>
              {isTesting ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
              接続テスト
            </button>
            {connectionStatus && (
              <span className={`text-xs flex items-center gap-1 ${connectionStatus === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {connectionStatus === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                {connectionMessage}
              </span>
            )}
          </div>

          {/* プリセット一覧 */}
          <div className={cardClass}>
            <div className={`p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
              <div className="flex items-center gap-2">
                <Package size={16} className="text-indigo-400" />
                <span className={`text-sm font-semibold ${textClass}`}>インポートプリセット</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="file" accept=".json" ref={importFileRef} className="hidden" onChange={handleImportPresetsFile} />
                <button onClick={handleExportPresets} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-white/50 hover:text-white/80' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'}`} title="JSONエクスポート">
                  <Download size={14} />
                </button>
                <button onClick={() => importFileRef.current?.click()} className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-white/50 hover:text-white/80' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'}`} title="JSONインポート">
                  <Upload size={14} />
                </button>
                <button onClick={handleNewPreset} className={btnPrimaryClass}>
                  <Plus size={14} />
                  新規プリセット
                </button>
              </div>
            </div>

            {presets.length === 0 && !activePresetId && (
              <div className={`p-8 text-center text-sm ${mutedClass}`}>
                「新規プリセット」をクリックしてインポート設定を作成してください
              </div>
            )}

            {presets.length > 0 && (
              <div className="divide-y divide-white/5">
                {presets.map(preset => (
                  <div
                    key={preset.id}
                    className={`p-4 flex items-center gap-4 cursor-pointer transition-colors ${
                      activePresetId === preset.id
                        ? theme === 'dark' ? 'bg-indigo-500/10' : 'bg-indigo-50'
                        : theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => handleSelectPreset(preset.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${textClass}`}>{preset.name}</div>
                      <div className={`text-xs ${mutedClass} flex items-center gap-3 mt-1`}>
                        <span>{preset.sfObjectLabel || preset.sfObjectApiName || '未設定'}</span>
                        <span>{preset.fieldMappings?.filter(m => m.enabled).length || 0}項目</span>
                        {preset.schedule?.enabled && (
                          <span className="flex items-center gap-1 text-indigo-400">
                            <Clock size={10} />
                            {preset.schedule.frequency === 'daily' && `毎日 ${preset.schedule.time}`}
                            {preset.schedule.frequency === 'weekly' && `毎週 ${preset.schedule.time}`}
                            {preset.schedule.frequency === 'interval' && `毎日 ${preset.schedule.startTime || '09:00'}〜${preset.schedule.endTime || '18:00'} / ${preset.schedule.intervalHours || 1}h`}
                            {preset.schedule.frequency === 'intervalWeekly' && `毎週 ${preset.schedule.startTime || '09:00'}〜${preset.schedule.endTime || '18:00'} / ${preset.schedule.intervalHours || 1}h`}
                          </span>
                        )}
                        {preset.lastRunAt && (
                          <span>最終実行: {new Date(preset.lastRunAt).toLocaleString('ja-JP')}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleDeletePreset(preset.id)}
                        className={`p-1.5 rounded-lg transition-colors hover:bg-rose-500/20 text-rose-400/60 hover:text-rose-400`}
                        title="削除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* === プリセット編集エリア === */}
          {activePresetId && (<>

            {/* プリセット名 + オブジェクト選択 */}
            <div className={cardClass}>
              <div className={`p-4 border-b flex items-center gap-2 ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                <Settings2 size={16} className="text-indigo-400" />
                <span className={`text-sm font-semibold ${textClass}`}>プリセット設定</span>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>プリセット名</label>
                    <input
                      type="text"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder="例: 日次稼働実績インポート"
                      className={`${inputClass} w-full`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>SFオブジェクト</label>
                    {registeredObjects.length > 0 ? (
                      <select
                        value={presetObjectApiName}
                        onChange={(e) => handlePresetObjectChange(e.target.value)}
                        className={`${selectClass} w-full`}
                      >
                        <option value="" className={optionClass}>-- 選択 --</option>
                        {registeredObjects.map(obj => (
                          <option key={obj.id} value={obj.apiName} className={optionClass}>
                            {obj.label} ({obj.apiName})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className={`text-xs ${mutedClass} py-2`}>
                        先に「オブジェクト管理」タブでオブジェクトを登録してください
                      </div>
                    )}
                  </div>
                </div>

                {/* データソース選択 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>データテーブル</label>
                    <select
                      value={selectedTableId}
                      onChange={(e) => { setSelectedTableId(e.target.value); setSelectedAggConfigId(''); }}
                      className={`${selectClass} w-full`}
                    >
                      {dataTables.map(t => (
                        <option key={t.id} value={t.id} className={optionClass}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>集計条件</label>
                    <select
                      value={selectedAggConfigId}
                      onChange={(e) => setSelectedAggConfigId(e.target.value)}
                      className={`${selectClass} w-full`}
                    >
                      {safeAggregationConfigs.map(c => (
                        <option key={c.id} value={c.id} className={optionClass}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* フィルター */}
            {selectedTableConfig && (config?.filters || []).length > 0 && (
              <div className={cardClass}>
                <div className={`p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-amber-400" />
                    <span className={`text-sm font-semibold ${textClass}`}>フィルター</span>
                    {sfLocalFilters.date?.preset && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${theme === 'dark' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-amber-100 text-amber-700 border border-amber-300'}`}>
                        {DATE_PRESETS.find(p => p.key === sfLocalFilters.date.preset)?.label || sfLocalFilters.date.preset}
                      </span>
                    )}
                    {resolvedFilters.date?.start && (
                      <span className={`text-xs ${mutedClass}`}>
                        {resolvedFilters.date.start.replace(/-/g, '/')} ~ {resolvedFilters.date.end.replace(/-/g, '/')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSfLocalFilters({ ...activeFilters })}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200'}`}
                      title="ダッシュボードのフィルターを反映"
                    >
                      <ArrowDownLeft size={10} /> DB反映
                    </button>
                    <button
                      onClick={() => setSfLocalFilters({})}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${theme === 'dark' ? 'bg-white/10 text-white/60 hover:bg-white/20' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      title="フィルターをリセット"
                    >
                      <X size={10} /> リセット
                    </button>
                  </div>
                </div>
                <div className="p-4 flex flex-wrap gap-3 items-start">
                  {/* 日付フィルター: 相対日付プリセット */}
                  {(config.filters || []).some(f => f.field === 'date') && (
                    <div className={`flex flex-col gap-2 p-3 rounded-lg ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                      <label className={`text-xs font-medium ${mutedClass}`}>期間</label>
                      <div className="flex flex-wrap gap-1.5">
                        {DATE_PRESETS.map(p => (
                          <button
                            key={p.key}
                            onClick={() => setSfLocalFilters(prev => ({ ...prev, date: { preset: p.key } }))}
                            className={`px-2 py-1 rounded text-xs transition-all ${
                              sfLocalFilters.date?.preset === p.key
                                ? theme === 'dark' ? 'bg-amber-500/30 text-amber-200 border border-amber-500/50' : 'bg-amber-200 text-amber-800 border border-amber-400'
                                : theme === 'dark' ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="date"
                          value={(!sfLocalFilters.date?.preset && sfLocalFilters.date?.start) || ''}
                          onChange={(e) => setSfLocalFilters(prev => ({ ...prev, date: { start: e.target.value, end: prev.date?.end || '' } }))}
                          className={`rounded px-2 py-1 text-xs w-32 outline-none ${theme === 'dark' ? 'bg-slate-800 border border-white/10 text-white' : 'bg-white border border-gray-300 text-gray-800'}`}
                          placeholder="開始日"
                        />
                        <span className={`text-xs ${mutedClass}`}>〜</span>
                        <input
                          type="date"
                          value={(!sfLocalFilters.date?.preset && sfLocalFilters.date?.end) || ''}
                          onChange={(e) => setSfLocalFilters(prev => ({ ...prev, date: { start: prev.date?.start || '', end: e.target.value } }))}
                          className={`rounded px-2 py-1 text-xs w-32 outline-none ${theme === 'dark' ? 'bg-slate-800 border border-white/10 text-white' : 'bg-white border border-gray-300 text-gray-800'}`}
                          placeholder="終了日"
                        />
                      </div>
                    </div>
                  )}
                  {/* その他フィルター: MultiSelect */}
                  {(config.filters || []).filter(f => f.field !== 'date').map(filter => (
                    <div key={filter.id} className={`flex items-center rounded-lg p-1 ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gray-100 border border-gray-300'}`}>
                      <MultiSelectDropdown
                        label={filter.label}
                        options={getFilterOptions(filter.field)}
                        value={sfLocalFilters[filter.field] || []}
                        onChange={(val) => setSfLocalFilters(prev => ({ ...prev, [filter.field]: val }))}
                        glassClass={glassClass}
                        theme={theme}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* データプレビュー */}
            {selectedTableConfig && (
              <div className={cardClass}>
                <div className={`p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                  <div className="flex items-center gap-2">
                    <Eye size={16} className="text-indigo-400" />
                    <span className={`text-sm font-semibold ${textClass}`}>データプレビュー</span>
                    <span className={`text-xs ${mutedClass}`}>({processedData.length} 件)</span>
                  </div>
                  {onRefresh && (
                    <button
                      onClick={onRefresh}
                      disabled={isLoading}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isLoading
                          ? theme === 'dark' ? 'bg-white/5 text-white/30 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                      }`}
                    >
                      <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                      {isLoading ? '更新中...' : 'データを更新'}
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto max-h-64">
                  {processedData.length > 0 ? (
                    <table className="w-full text-xs">
                      <thead className={`sticky top-0 ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-100'}`}>
                        <tr>
                          {tableHeaders.map(h => (
                            <th key={h.id} className={`px-3 py-2 text-left font-medium whitespace-nowrap ${mutedClass}`}>{h.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {processedData.slice(0, 20).map((row, i) => (
                          <tr key={i} className={theme === 'dark' ? 'border-t border-white/5' : 'border-t border-gray-100'}>
                            {tableHeaders.map(h => (
                              <td key={h.id} className={`px-3 py-1.5 whitespace-nowrap ${textClass}`}>
                                {row[h.id] !== undefined && row[h.id] !== null
                                  ? (typeof row[h.id] === 'number' ? row[h.id].toLocaleString() : String(row[h.id]))
                                  : '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className={`p-8 text-center text-sm ${mutedClass}`}>
                      {isLoading ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 size={16} className="animate-spin" />
                          データを読み込み中...
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p>データがありません。</p>
                          {onRefresh && (
                            <button
                              onClick={onRefresh}
                              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                                theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                              }`}
                            >
                              <RefreshCw size={14} />
                              データを取得する
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* キーマッピング + フィールドマッピング */}
            {presetSfFields.length > 0 && (
              <div className={cardClass}>
                <div className={`p-4 border-b flex items-center gap-2 ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                  <Link2 size={16} className="text-indigo-400" />
                  <span className={`text-sm font-semibold ${textClass}`}>フィールドマッピング</span>
                  <span className={`text-xs ${mutedClass}`}>（全{allAvailableFields.length}フィールド対象）</span>
                </div>
                <div className="p-4 space-y-5">
                  {/* 突合モード選択 */}
                  <div>
                    <div className={`text-xs font-semibold mb-2 ${textClass}`}>突合モード</div>
                    <div className="flex gap-2">
                      {[
                        { key: 'externalId', label: 'External ID', desc: 'External IDフィールドでupsert' },
                        { key: 'soqlLookup', label: 'SOQL Lookup', desc: 'SOQL検索でID取得→PATCH更新' },
                      ].map(mode => (
                        <button
                          key={mode.key}
                          onClick={() => {
                            setMatchMode(mode.key);
                            setIdMap({});
                            setMatchResult(null);
                            setResolveStatus({ message: '', kind: '' });
                            resolveRequestIdRef.current++;
                            setIsResolving(false);
                            if (mode.key === 'soqlLookup' && !targetMonth) setTargetMonth(defaultTargetMonth);
                          }}
                          className={`flex-1 p-3 rounded-lg text-left text-xs border transition-colors ${
                            matchMode === mode.key
                              ? theme === 'dark' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-indigo-50 border-indigo-300 text-indigo-700'
                              : theme === 'dark' ? 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          <div className="font-semibold">{mode.label}</div>
                          <div className="mt-0.5 opacity-70">{mode.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {matchMode === 'externalId' ? (
                    /* External ID モード: 既存の突合キー設定 */
                    <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                      <div className={`text-xs font-semibold mb-3 ${textClass}`}>突合キー設定</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>DataTable側キー列</label>
                          <select
                            value={keyMapping.dataTableColumnId}
                            onChange={(e) => setKeyMapping({ ...keyMapping, dataTableColumnId: e.target.value })}
                            className={`${selectClass} w-full`}
                          >
                            <option value="" className={optionClass}>-- 選択 --</option>
                            {allAvailableFields.map(f => (
                              <option key={f.id} value={f.id} className={optionClass}>{f.label} ({f.id})</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>SF側突合フィールド</label>
                          <select
                            value={keyMapping.sfFieldApiName}
                            onChange={(e) => setKeyMapping({ ...keyMapping, sfFieldApiName: e.target.value })}
                            className={`${selectClass} w-full`}
                          >
                            <option value="" className={optionClass}>-- 選択 --</option>
                            {sfKeyFieldOptions.map(f => (
                              <option key={f.name} value={f.name} className={optionClass}>{f.label} ({f.name})</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* SOQL Lookup モード */
                    <div className={`p-4 rounded-lg space-y-4 ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                      <div className={`text-xs font-semibold ${textClass}`}>SOQL Lookup 突合設定</div>
                      <div className={`text-xs ${mutedClass} -mt-2`}>
                        DataTableのID値を使って、SFの参照関係を辿り対象レコードを特定します
                      </div>

                      {/* Step 1: DataTable側キー列 */}
                      <div>
                        <label className={labelClass}>
                          <span className={`inline-block w-5 h-5 rounded-full text-center leading-5 text-xs font-bold mr-1.5 ${theme === 'dark' ? 'bg-indigo-500/30 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}>1</span>
                          DataTable側の照合キー列
                        </label>
                        <div className={`text-xs mb-1 ${mutedClass}`}>DataTable内で、SF側レコードと照合するID値が入っている列</div>
                        <select
                          value={keyMapping.dataTableColumnId}
                          onChange={(e) => { setKeyMapping({ ...keyMapping, dataTableColumnId: e.target.value }); setIdMap({}); setMatchResult(null); setResolveStatus({ message: '', kind: '' }); resolveRequestIdRef.current++; setIsResolving(false); }}
                          className={`${selectClass} w-full`}
                        >
                          <option value="" className={optionClass}>-- 選択 --</option>
                          {allAvailableFields.map(f => (
                            <option key={f.id} value={f.id} className={optionClass}>{f.label} ({f.id})</option>
                          ))}
                        </select>
                      </div>

                      {/* Step 2: 参照関係を辿ってレコードを特定 */}
                      <div>
                        <label className={labelClass}>
                          <span className={`inline-block w-5 h-5 rounded-full text-center leading-5 text-xs font-bold mr-1.5 ${theme === 'dark' ? 'bg-indigo-500/30 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}>2</span>
                          参照関係を辿ってレコードを特定
                        </label>
                        <div className={`text-xs mb-2 ${mutedClass}`}>
                          更新先オブジェクトのどの参照フィールドを辿って、照合に使うフィールドを探しますか？
                        </div>
                        <div className="space-y-3">
                          {/* 参照フィールド選択（参照先オブジェクト名を表示） */}
                          <div>
                            <label className={`${labelClass} !text-[10px]`}>辿る参照関係</label>
                            <select
                              value={lookupRefField}
                              onChange={(e) => { setLookupRefField(e.target.value); setLookupTargetField(''); setIdMap({}); setMatchResult(null); setResolveStatus({ message: '', kind: '' }); resolveRequestIdRef.current++; setIsResolving(false); }}
                              className={`${selectClass} w-full`}
                            >
                              <option value="" className={optionClass}>-- 参照フィールドを選択 --</option>
                              {sfRefFieldOptions.map(f => {
                                const refTo = f.referenceTo?.length ? f.referenceTo[0] : '';
                                const refLabel = refTo ? ` → ${refTo}` : '';
                                return (
                                  <option key={f.name} value={f.name} className={optionClass}>
                                    {f.label} ({f.name}){refLabel}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                          {/* 参照先フィールド選択（ドロップダウン） */}
                          {lookupRefField && (
                            <div>
                              <label className={`${labelClass} !text-[10px]`}>
                                照合に使うフィールド
                                {refObjectName && <span className={mutedClass}>（{refObjectName} のフィールド）</span>}
                              </label>
                              {isLoadingRefFields ? (
                                <div className={`flex items-center gap-2 text-xs py-2 ${mutedClass}`}>
                                  <Loader2 size={12} className="animate-spin" />
                                  参照先オブジェクトのフィールドを取得中...
                                </div>
                              ) : refObjectFields.length > 0 ? (
                                <select
                                  value={lookupTargetField}
                                  onChange={(e) => { setLookupTargetField(e.target.value); setIdMap({}); setMatchResult(null); setResolveStatus({ message: '', kind: '' }); resolveRequestIdRef.current++; setIsResolving(false); }}
                                  className={`${selectClass} w-full`}
                                >
                                  <option value="" className={optionClass}>-- 照合フィールドを選択 --</option>
                                  {refObjectFields
                                    .filter(f => ['string', 'id', 'email', 'url', 'phone', 'textarea'].includes(f.type))
                                    .map(f => (
                                    <option key={f.name} value={f.name} className={optionClass}>
                                      {f.label} ({f.name}) [{f.type}]
                                    </option>
                                  ))}
                                </select>
                              ) : !refObjectName ? (
                                <div className={`text-xs py-2 ${mutedClass}`}>
                                  参照先オブジェクト情報がありません。オブジェクト管理タブでフィールド情報を更新してください。
                                </div>
                              ) : (
                                <div className={`text-xs py-2 ${mutedClass}`}>
                                  {refObjectName} のフィールド情報を取得できませんでした。
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* 照合パスの視覚的表示 */}
                      {lookupRefField && lookupTargetField && (
                        <div className={`text-xs px-3 py-2 rounded space-y-1.5 ${theme === 'dark' ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20' : 'bg-indigo-50 text-indigo-600 border border-indigo-200'}`}>
                          {/* 日本語フロー表示 */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold">{registeredObjects.find(o => o.apiName === presetObjectApiName)?.label || presetObjectApiName}</span>
                            <span>.</span>
                            <span className="font-semibold">{selectedRefFieldMeta?.label || lookupRefField}</span>
                            <span>→</span>
                            <span className="font-semibold">{refObjectFields.find(f => f.name === lookupTargetField)?.label || lookupTargetField}</span>
                          </div>
                          {/* API名パス */}
                          <div className={`font-mono ${mutedClass}`}>{lookupRelField}</div>
                          {/* SOQLプレビュー */}
                          <div className={`font-mono pt-1 border-t ${theme === 'dark' ? 'border-indigo-500/20' : 'border-indigo-200'}`}>
                            <div>SELECT Id, {lookupRelField} FROM {presetObjectApiName || '...'}</div>
                            <div className={mutedClass}>
                              WHERE {lookupRelField} IN (...)
                              {lookupConditionField && targetMonth && (() => {
                                const [y, m] = targetMonth.split('-').map(Number);
                                const nm = m === 12 ? 1 : m + 1;
                                const ny = m === 12 ? y + 1 : y;
                                return ` AND ${lookupConditionField} >= ${y}-${String(m).padStart(2, '0')}-01 AND ${lookupConditionField} < ${ny}-${String(nm).padStart(2, '0')}-01`;
                              })()}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Step 3: 条件日付フィールド */}
                      <div>
                        <label className={labelClass}>
                          <span className={`inline-block w-5 h-5 rounded-full text-center leading-5 text-xs font-bold mr-1.5 ${theme === 'dark' ? 'bg-indigo-500/30 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}>3</span>
                          月絞り込み用の日付フィールド
                        </label>
                        <div className={`text-xs mb-1 ${mutedClass}`}>対象月でレコードを絞り込むための日付フィールド（date型のみ）</div>
                        <select
                          value={lookupConditionField}
                          onChange={(e) => { setLookupConditionField(e.target.value); setIdMap({}); setMatchResult(null); setResolveStatus({ message: '', kind: '' }); resolveRequestIdRef.current++; setIsResolving(false); }}
                          className={`${selectClass} w-full`}
                        >
                          <option value="" className={optionClass}>-- 選択 --</option>
                          {presetSfFields.filter(f => f.type === 'date').map(f => (
                            <option key={f.name} value={f.name} className={optionClass}>{f.label} ({f.name})</option>
                          ))}
                        </select>
                      </div>

                      {/* 対象月 + 突合検索 */}
                      <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
                        <div>
                          <label className={labelClass}>対象年</label>
                          <select
                            value={targetMonth.split('-')[0] || ''}
                            onChange={(e) => setTargetMonth(`${e.target.value}-${targetMonth.split('-')[1] || '01'}`)}
                            className={`${selectClass} w-full`}
                          >
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                              <option key={y} value={y} className={optionClass}>{y}年</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>対象月</label>
                          <select
                            value={targetMonth.split('-')[1] || ''}
                            onChange={(e) => setTargetMonth(`${targetMonth.split('-')[0] || new Date().getFullYear()}-${e.target.value}`)}
                            className={`${selectClass} w-full`}
                          >
                            {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                              <option key={m} value={m} className={optionClass}>{parseInt(m)}月</option>
                            ))}
                          </select>
                        </div>
                        <button onClick={handleResolveIds} disabled={isResolving} className={btnPrimaryClass}>
                          {isResolving ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                          突合検索
                        </button>
                      </div>

                      {/* 突合ステータス */}
                      {!isResolving && resolveStatus.message && (
                        <div className={`flex items-center gap-2 text-xs p-2 rounded-lg ${
                          resolveStatus.kind === 'error'
                            ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                            : resolveStatus.kind === 'warning'
                              ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                              : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                        }`}>
                          {resolveStatus.kind === 'error' ? <AlertTriangle size={14} /> : resolveStatus.kind === 'warning' ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
                          {resolveStatus.message}
                        </div>
                      )}
                      {isResolving && (
                        <div className={`flex items-center gap-2 text-xs ${mutedClass}`}>
                          <Loader2 size={14} className="animate-spin text-indigo-400" />
                          突合検索中...
                        </div>
                      )}
                      {matchResult && !isResolving && (
                        <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                          <div className={`text-xs font-semibold mb-2 ${textClass}`}>突合結果</div>
                          <div className="flex gap-4 text-xs flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle size={14} className="text-emerald-400" />
                              <span className={textClass}>マッチ: <span className="font-semibold text-emerald-400">{matchResult.matched}件</span></span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <AlertTriangle size={14} className="text-amber-400" />
                              <span className={textClass}>未マッチ: <span className="font-semibold text-amber-400">{matchResult.unmatched}件</span></span>
                            </div>
                            {matchResult.duplicates > 0 && (
                              <div className="flex items-center gap-1.5">
                                <X size={14} className="text-rose-400" />
                                <span className={textClass}>重複: <span className="font-semibold text-rose-400">{matchResult.duplicates}件</span></span>
                              </div>
                            )}
                            <div className={`${mutedClass}`}>
                              / 全{matchResult.total}件
                            </div>
                          </div>
                          {(matchResult.unmatched > 0 || matchResult.duplicates > 0) && (
                            <div className={`text-xs mt-1 ${mutedClass}`}>
                              {matchResult.unmatched > 0 && '未マッチ'}
                              {matchResult.unmatched > 0 && matchResult.duplicates > 0 && '・'}
                              {matchResult.duplicates > 0 && '重複'}
                              のレコードはインポート時にスキップされます
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* フィールドマッピング */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className={`text-xs font-semibold ${textClass}`}>インポート指標マッピング</div>
                      <div className="flex items-center gap-3">
                        <button onClick={handleRefreshPresetSfFields} disabled={isRefreshingSfFields} className={`text-xs flex items-center gap-1 ${theme === 'dark' ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'} ${isRefreshingSfFields ? 'opacity-50' : ''}`}>
                          <RefreshCw size={12} className={isRefreshingSfFields ? 'animate-spin' : ''} />
                          SF項目を更新
                        </button>
                        <button onClick={handleResetMappings} className={`text-xs ${theme === 'dark' ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`}>
                          マッピングをリセット
                        </button>
                      </div>
                    </div>
                    {/* 検索・ソート */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="relative flex-1">
                        <Search size={12} className={`absolute left-2 top-1/2 -translate-y-1/2 ${mutedClass}`} />
                        <input
                          type="text"
                          value={mappingSearch}
                          onChange={(e) => setMappingSearch(e.target.value)}
                          placeholder="指標を検索..."
                          className={`w-full text-xs pl-7 pr-2 py-1.5 rounded-lg border ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white placeholder-white/30' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
                        />
                      </div>
                      <select
                        value={mappingSort}
                        onChange={(e) => setMappingSort(e.target.value)}
                        className={`${selectClass} text-xs py-1.5`}
                      >
                        <option value="default">並び順: デフォルト</option>
                        <option value="name-asc">名前 A→Z</option>
                        <option value="name-desc">名前 Z→A</option>
                        <option value="enabled">有効のみ先頭</option>
                      </select>
                    </div>
                    <div className={`rounded-lg border overflow-hidden ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                      <div className={`grid grid-cols-[40px_1fr_20px_1fr] gap-2 px-3 py-2 text-xs font-medium ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'} ${mutedClass}`}>
                        <div></div>
                        <div>作成済み指標</div>
                        <div></div>
                        <div>SF項目</div>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {sortedFilteredMappings.map(({ mapping, originalIdx }) => {
                          const fieldInfo = allAvailableFields.find(f => f.id === mapping.dataTableColumnId);
                          const idx = originalIdx;
                          return (
                            <div
                              key={mapping.id}
                              className={`grid grid-cols-[40px_1fr_20px_1fr] gap-2 px-3 py-2 items-center ${
                                theme === 'dark' ? 'border-t border-white/5' : 'border-t border-gray-100'
                              } ${mapping.enabled ? '' : 'opacity-50'}`}
                            >
                              <div className="flex justify-center">
                                <input
                                  type="checkbox"
                                  checked={mapping.enabled}
                                  onChange={(e) => {
                                    const updated = [...fieldMappings];
                                    updated[idx] = { ...mapping, enabled: e.target.checked };
                                    setFieldMappings(updated);
                                  }}
                                  className="rounded"
                                />
                              </div>
                              <div className="text-xs">
                                <div className={`truncate ${textClass}`}>
                                  {fieldInfo?.label || mapping.dataTableColumnLabel || mapping.dataTableColumnId}
                                  <span className={`ml-1 ${mutedClass}`}>({mapping.dataTableColumnId})</span>
                                </div>
                                {getCalcFormulaText(mapping.dataTableColumnId) && (
                                  <div className={`text-[10px] truncate mt-0.5 ${mutedClass}`}>
                                    = {getCalcFormulaText(mapping.dataTableColumnId)}
                                  </div>
                                )}
                              </div>
                              <div className={`text-center ${mutedClass}`}>&rarr;</div>
                              <SfFieldSearchSelect
                                value={mapping.sfFieldApiName}
                                options={sfFieldOptions}
                                onChange={(val, label) => {
                                  const updated = [...fieldMappings];
                                  updated[idx] = { ...mapping, sfFieldApiName: val, sfFieldLabel: label };
                                  setFieldMappings(updated);
                                }}
                                theme={theme}
                                selectClass={selectClass}
                                optionClass={optionClass}
                              />
                            </div>
                          );
                        })}
                        {fieldMappings.length === 0 && (
                          <div className={`p-4 text-center text-xs ${mutedClass}`}>
                            SFオブジェクトを選択するとマッピング候補が表示されます
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* スケジュール設定 */}
            <div className={cardClass}>
              <div className={`p-4 border-b flex items-center gap-2 ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                <Calendar size={16} className="text-indigo-400" />
                <span className={`text-sm font-semibold ${textClass}`}>スケジュール設定</span>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={schedule.enabled}
                      onChange={(e) => setSchedule({ ...schedule, enabled: e.target.checked })}
                      className="rounded"
                    />
                    <span className={`text-sm ${textClass}`}>スケジュール実行を有効にする</span>
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!config?._useNewCombine}
                      onChange={(e) => updateConfig('_useNewCombine', e.target.checked)}
                      className="rounded"
                    />
                    <span className={`text-sm ${textClass}`}>新版データ結合を使用</span>
                    <span className={`text-xs ${mutedClass}`}>（手動インポートと件数を一致させる）</span>
                  </label>
                </div>
                {schedule.enabled && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className={labelClass}>頻度</label>
                        <select
                          value={schedule.frequency}
                          onChange={(e) => setSchedule({ ...schedule, frequency: e.target.value })}
                          className={`${selectClass} w-full`}
                        >
                          <option value="daily" className={optionClass}>毎日（1回）</option>
                          <option value="weekly" className={optionClass}>毎週（1回）</option>
                          <option value="interval" className={optionClass}>間隔実行（毎日）</option>
                          <option value="intervalWeekly" className={optionClass}>間隔実行（毎週）</option>
                        </select>
                      </div>
                      {(schedule.frequency === 'weekly' || schedule.frequency === 'intervalWeekly') && (
                        <div>
                          <label className={labelClass}>曜日</label>
                          <select
                            value={schedule.dayOfWeek}
                            onChange={(e) => setSchedule({ ...schedule, dayOfWeek: parseInt(e.target.value) })}
                            className={`${selectClass} w-full`}
                          >
                            {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                              <option key={i} value={i} className={optionClass}>{d}曜日</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {(schedule.frequency === 'daily' || schedule.frequency === 'weekly') && (
                        <div>
                          <label className={labelClass}>実行時刻</label>
                          <input
                            type="time"
                            value={schedule.time}
                            onChange={(e) => setSchedule({ ...schedule, time: e.target.value })}
                            className={`${inputClass} w-full`}
                          />
                        </div>
                      )}
                    </div>
                    {(schedule.frequency === 'interval' || schedule.frequency === 'intervalWeekly') && (
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className={labelClass}>開始時刻</label>
                          <input
                            type="time"
                            value={schedule.startTime || '09:00'}
                            onChange={(e) => setSchedule({ ...schedule, startTime: e.target.value })}
                            className={`${inputClass} w-full`}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>終了時刻</label>
                          <input
                            type="time"
                            value={schedule.endTime || '18:00'}
                            onChange={(e) => setSchedule({ ...schedule, endTime: e.target.value })}
                            className={`${inputClass} w-full`}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>間隔（時間）</label>
                          <select
                            value={schedule.intervalHours || 1}
                            onChange={(e) => setSchedule({ ...schedule, intervalHours: parseInt(e.target.value) })}
                            className={`${selectClass} w-full`}
                          >
                            {[1, 2, 3, 4, 6, 8, 12].map(h => (
                              <option key={h} value={h} className={optionClass}>{h}時間</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {schedule.enabled && (
                  <div className={`text-xs p-3 rounded-lg ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'} ${mutedClass}`}>
                    <div className="font-medium mb-1">サーバーcron設定（1行だけ。全プリセット自動実行）:</div>
                    <pre className={`text-xs whitespace-pre-wrap break-all ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-600'}`}>
                      {'0 * * * * php /path/to/sf_schedule_runner.php >> /var/log/sf_schedule.log 2>&1'}
                    </pre>
                    <div className={`mt-1 text-xs ${mutedClass}`}>
                      ※ 上記を1度だけサーバーのcronに登録すれば、スケジュール有効な全プリセットが設定時刻に自動実行されます。
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 実行ボタンエリア */}
            <div className={cardClass}>
              <div className="p-4 flex items-center justify-between">
                <div className={`text-sm ${mutedClass}`}>
                  {canImport
                    ? matchMode === 'soqlLookup'
                      ? `${importRecords.length} 件のマッチ済みレコードを ${presetObjectApiName} にPATCH更新します`
                      : `${importRecords.length} 件のレコードを ${presetObjectApiName} にインポートします`
                    : matchMode === 'soqlLookup'
                      ? '突合設定を完了し、突合検索を実行してからプレビューを確認してください'
                      : 'すべての設定を完了してからプレビューを確認してください'}
                </div>
                <div className="flex items-center gap-3">
                  {saveFlash && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1 animate-pulse">
                      <CheckCircle size={14} />
                      保存しました
                    </span>
                  )}
                  {presetStatusMessage && !saveFlash && (
                    <span className={`text-xs ${mutedClass}`}>{presetStatusMessage}</span>
                  )}
                  <button onClick={handleSavePreset} disabled={!presetName.trim()} className={btnSecondaryClass}>
                    <Save size={14} />
                    プリセット保存
                  </button>
                  <button
                    onClick={() => setShowModal(true)}
                    disabled={!canImport}
                    className={btnPrimaryClass}
                  >
                    <Eye size={14} />
                    プレビュー確認
                  </button>
                </div>
              </div>
            </div>

          </>)}

        </>)}

        {/* ============================== */}
        {/* === エクスポートタブ === */}
        {/* ============================== */}
        {activeTab === 'export' && (<>
          <div className={cardClass}>
            <div className={`p-4 border-b flex items-center gap-2 ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
              <Search size={16} className="text-indigo-400" />
              <span className={`text-sm font-semibold ${textClass}`}>SFオブジェクト・フィールド選択</span>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className={labelClass}>SFオブジェクト</label>
                <div className="flex gap-2">
                  {registeredObjects.length > 0 ? (
                    <select
                      value={exportObjectApiName}
                      onChange={(e) => handleExportObjectChange(e.target.value)}
                      className={`${selectClass} flex-1`}
                    >
                      <option value="" className={optionClass}>-- 選択 --</option>
                      {registeredObjects.map(obj => (
                        <option key={obj.id} value={obj.apiName} className={optionClass}>
                          {obj.label} ({obj.apiName})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={exportObjectApiName}
                      onChange={(e) => setExportObjectApiName(e.target.value)}
                      placeholder="例: CustomObject10__c"
                      className={`${inputClass} flex-1`}
                    />
                  )}
                  <button
                    onClick={handleExportDescribe}
                    disabled={exportIsDescribing || !exportObjectApiName.trim()}
                    className={btnPrimaryClass}
                  >
                    {exportIsDescribing ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    フィールド取得
                  </button>
                </div>
                {exportSfObjectLabel && (
                  <div className={`text-xs mt-1 ${mutedClass}`}>
                    {exportSfObjectLabel} ({exportSfFields.length}項目)
                  </div>
                )}
              </div>

              {/* フィールド選択 */}
              {exportSfFields.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={`text-xs font-medium ${mutedClass}`}>
                      取得フィールド ({exportSelectedFields.length}/{exportSfFields.length} 選択)
                    </label>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setExportSelectedFields(exportSfFields.map(f => f.name))} className={`text-xs ${theme === 'dark' ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`}>全選択</button>
                      <span className={`text-xs ${mutedClass}`}>|</span>
                      <button onClick={() => setExportSelectedFields([])} className={`text-xs ${theme === 'dark' ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`}>全解除</button>
                    </div>
                  </div>
                  <div className="relative mb-2">
                    <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${mutedClass}`} />
                    <input
                      type="text"
                      value={exportFieldSearch}
                      onChange={(e) => setExportFieldSearch(e.target.value)}
                      placeholder="フィールド名で検索..."
                      className={`${inputClass} w-full pl-9`}
                    />
                    {exportFieldSearch && (
                      <button onClick={() => setExportFieldSearch('')} className={`absolute right-3 top-1/2 -translate-y-1/2 ${mutedClass} hover:opacity-80`}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div className={`rounded-lg border max-h-52 overflow-y-auto ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                    {filteredExportFields.map(f => (
                      <label
                        key={f.name}
                        className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer ${
                          theme === 'dark' ? 'hover:bg-white/5 border-b border-white/5' : 'hover:bg-gray-50 border-b border-gray-100'
                        } last:border-b-0`}
                      >
                        <input
                          type="checkbox"
                          checked={exportSelectedFields.includes(f.name)}
                          onChange={(e) => {
                            if (e.target.checked) setExportSelectedFields(prev => [...prev, f.name]);
                            else setExportSelectedFields(prev => prev.filter(n => n !== f.name));
                          }}
                          className="rounded"
                        />
                        <span className={textClass}>{f.label}</span>
                        <span className={mutedClass}>({f.name})</span>
                        <span className={`ml-auto ${mutedClass}`}>{f.type}</span>
                      </label>
                    ))}
                    {filteredExportFields.length === 0 && (
                      <div className={`p-4 text-center text-xs ${mutedClass}`}>該当するフィールドがありません</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* クエリ条件 */}
          {exportSfFields.length > 0 && exportSelectedFields.length > 0 && (
            <div className={cardClass}>
              <div className={`p-4 border-b flex items-center gap-2 ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                <Settings2 size={16} className="text-indigo-400" />
                <span className={`text-sm font-semibold ${textClass}`}>クエリ条件</span>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className={labelClass}>WHERE句（オプション）</label>
                  <input type="text" value={exportWhereClause} onChange={(e) => setExportWhereClause(e.target.value)}
                    placeholder="例: Field17__c = '東京' AND CreatedDate >= 2024-01-01T00:00:00Z"
                    className={`${inputClass} w-full`} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>ORDER BY（オプション）</label>
                    <input type="text" value={exportOrderBy} onChange={(e) => setExportOrderBy(e.target.value)}
                      placeholder="例: Name ASC" className={`${inputClass} w-full`} />
                  </div>
                  <div>
                    <label className={labelClass}>取得件数上限</label>
                    <input type="number" value={exportLimitCount}
                      onChange={(e) => setExportLimitCount(Math.min(2000, Math.max(1, parseInt(e.target.value) || 1)))}
                      min={1} max={2000} className={`${inputClass} w-full`} />
                  </div>
                </div>
                <div className="flex items-center justify-end">
                  <button onClick={handleExportQuery} disabled={exportIsQuerying || exportSelectedFields.length === 0} className={btnPrimaryClass}>
                    {exportIsQuerying ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    クエリ実行
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* クエリ結果 */}
          {exportQueryResult && (
            <div className={cardClass}>
              <div className={`p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <Eye size={16} className="text-indigo-400" />
                  <span className={`text-sm font-semibold ${textClass}`}>クエリ結果</span>
                  <span className={`text-xs ${mutedClass}`}>({exportQueryResult.totalSize} 件)</span>
                </div>
                <button onClick={handleExportCsv} disabled={!exportQueryResult.records?.length} className={btnPrimaryClass}>
                  <Download size={14} />
                  CSVダウンロード
                </button>
              </div>
              {exportQueryResult.soql && (
                <div className={`px-4 py-2 text-xs font-mono ${theme === 'dark' ? 'bg-white/5 text-white/60' : 'bg-gray-50 text-gray-500'}`}>
                  {exportQueryResult.soql}
                </div>
              )}
              <div className="overflow-x-auto max-h-80">
                {exportQueryResult.records?.length > 0 ? (
                  <table className="w-full text-xs">
                    <thead className={`sticky top-0 ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-100'}`}>
                      <tr>
                        <th className={`px-3 py-2 text-left font-medium whitespace-nowrap ${mutedClass}`}>#</th>
                        {exportSelectedFields.map(f => (
                          <th key={f} className={`px-3 py-2 text-left font-medium whitespace-nowrap ${mutedClass}`}>{f}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {exportQueryResult.records.slice(0, 50).map((row, i) => (
                        <tr key={i} className={theme === 'dark' ? 'border-t border-white/5' : 'border-t border-gray-100'}>
                          <td className={`px-3 py-1.5 whitespace-nowrap ${mutedClass}`}>{i + 1}</td>
                          {exportSelectedFields.map(f => (
                            <td key={f} className={`px-3 py-1.5 whitespace-nowrap ${textClass}`}>
                              {row[f] !== undefined && row[f] !== null ? String(row[f]) : '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className={`p-8 text-center text-sm ${mutedClass}`}>該当するレコードがありません</div>
                )}
              </div>
              {exportQueryResult.records?.length > 50 && (
                <div className={`px-4 py-2 text-xs text-center ${mutedClass} ${theme === 'dark' ? 'border-t border-white/10' : 'border-t border-gray-200'}`}>
                  プレビューは先頭50件のみ表示しています。CSVダウンロードで全件取得できます。
                </div>
              )}
            </div>
          )}
          {exportStatusMessage && (
            <div className={`text-xs ${mutedClass}`}>{exportStatusMessage}</div>
          )}
        </>)}

        {/* ============================== */}
        {/* === インポート履歴タブ === */}
        {/* ============================== */}
        {activeTab === 'history' && (
          <div className={cardClass}>
            <div className={`p-4 border-b flex items-center gap-2 ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
              <History size={16} className="text-indigo-400" />
              <span className={`text-sm font-semibold ${textClass}`}>インポート履歴</span>
              <span className={`text-xs ${mutedClass}`}>（{allHistory.length}件）</span>
              <button onClick={onRefresh} className={`ml-auto p-1.5 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-white/50 hover:text-white/80' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'}`} title="履歴を更新">
                <RefreshCw size={14} />
              </button>
              {selectedHistoryId && (
                <button onClick={() => { setSelectedHistoryId(null); setHistoryDetail(null); }} className={`text-xs px-2 py-0.5 rounded ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white/70' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>
                  一覧に戻る
                </button>
              )}
            </div>
            <div className="p-4">
              {allHistory.length === 0 ? (
                <div className={`text-sm text-center py-8 ${mutedClass}`}>インポート履歴はまだありません</div>
              ) : (
                <>
                  <div className={`rounded-lg border overflow-x-auto ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                    <table className="w-full text-xs">
                      <thead className={theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}>
                        <tr>
                          <th className={`px-3 py-2 text-left font-medium ${mutedClass}`}>プリセット</th>
                          <th className={`px-3 py-2 text-left font-medium ${mutedClass}`}>日時</th>
                          <th className={`px-3 py-2 text-left font-medium ${mutedClass}`}>種別</th>
                          <th className={`px-3 py-2 text-right font-medium ${mutedClass}`}>処理</th>
                          <th className={`px-3 py-2 text-right font-medium ${mutedClass}`}>作成</th>
                          <th className={`px-3 py-2 text-right font-medium ${mutedClass}`}>更新</th>
                          <th className={`px-3 py-2 text-right font-medium ${mutedClass}`}>エラー</th>
                          <th className={`px-3 py-2 text-left font-medium ${mutedClass}`}>フィルター</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(historyExpanded ? allHistory : allHistory.slice(0, 20)).map((h, idx) => {
                          const datePresetLabel = h.filterValues?.date?.preset
                            ? (DATE_PRESETS.find(dp => dp.key === h.filterValues.date.preset)?.label || h.filterValues.date.preset)
                            : null;
                          const isSelected = selectedHistoryId === h.id;
                          return (
                            <tr
                              key={`${h.presetId}-${h.id || idx}`}
                              onClick={() => h.id && handleHistoryClick(h.id)}
                              className={`cursor-pointer transition-colors ${theme === 'dark' ? 'border-t border-white/5 hover:bg-white/5' : 'border-t border-gray-100 hover:bg-gray-50'} ${isSelected ? (theme === 'dark' ? 'bg-indigo-500/10' : 'bg-indigo-50') : ''} ${h.errors > 0 ? (theme === 'dark' ? 'bg-rose-500/5' : 'bg-rose-50') : ''}`}
                            >
                              <td className={`px-3 py-1.5 whitespace-nowrap font-medium ${textClass}`}>
                                {isSelected && <Eye size={10} className="inline mr-1 text-indigo-400" />}
                                {h.presetName || '不明'}
                                {h.totalRecords === 0 && h.errors > 0 && h.errorSummary && (
                                  <div className={`text-[10px] mt-0.5 font-normal ${theme === 'dark' ? 'text-rose-400' : 'text-rose-600'}`} title={h.errorSummary}>
                                    <AlertTriangle size={10} className="inline mr-0.5" />
                                    {h.errorSummary.length > 80 ? h.errorSummary.slice(0, 80) + '...' : h.errorSummary}
                                  </div>
                                )}
                              </td>
                              <td className={`px-3 py-1.5 whitespace-nowrap ${textClass}`}>
                                {new Date(h.timestamp).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="px-3 py-1.5 whitespace-nowrap">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${h.source === 'scheduled'
                                  ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700')
                                  : (theme === 'dark' ? 'bg-white/10 text-white/70' : 'bg-gray-100 text-gray-600')
                                }`}>
                                  {h.source === 'scheduled' ? 'スケジュール' : '手動'}
                                </span>
                              </td>
                              <td className={`px-3 py-1.5 text-right ${textClass}`}>{h.totalRecords}</td>
                              <td className="px-3 py-1.5 text-right text-emerald-400">{h.created}</td>
                              <td className="px-3 py-1.5 text-right text-blue-400">{h.updated}</td>
                              <td className={`px-3 py-1.5 text-right ${h.errors > 0 ? 'text-rose-400' : mutedClass}`}>{h.errors}</td>
                              <td className={`px-3 py-1.5 ${mutedClass}`}>
                                {datePresetLabel || '-'}
                                {h.errorSummary && (
                                  <div className={`text-[10px] mt-0.5 truncate max-w-[200px] ${theme === 'dark' ? 'text-rose-300/70' : 'text-rose-500'}`} title={h.errorSummary}>
                                    {h.errorSummary}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {allHistory.length > 20 && !selectedHistoryId && (
                    <button
                      onClick={() => setHistoryExpanded(!historyExpanded)}
                      className={`mt-2 text-xs ${theme === 'dark' ? 'text-indigo-300 hover:text-indigo-200' : 'text-indigo-600 hover:text-indigo-700'}`}
                    >
                      {historyExpanded ? '折りたたむ' : `すべて表示（${allHistory.length}件）`}
                    </button>
                  )}

                  {/* === 詳細データ表示エリア === */}
                  {selectedHistoryId && (
                    <div className={`mt-4 rounded-lg border ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                      {historyDetailLoading ? (
                        <div className={`p-8 text-center text-sm ${mutedClass}`}>
                          <Loader2 size={16} className="inline animate-spin mr-2" />読み込み中...
                        </div>
                      ) : !historyDetail ? (
                        <div className={`p-8 text-center text-sm ${mutedClass}`}>
                          この履歴の詳細データはありません（この機能追加前のインポート）
                        </div>
                      ) : (
                        <>
                          <div className={`px-4 py-2 flex items-center justify-between text-xs ${theme === 'dark' ? 'bg-white/5 border-b border-white/10' : 'bg-gray-50 border-b border-gray-200'}`}>
                            <div className="flex items-center gap-3">
                              <Database size={14} className="text-indigo-400" />
                              <span className={textClass}>
                                インポートデータ: <strong>{historyDetail.records?.length || 0}</strong> 件
                                × <strong>{historyDetail.columns?.length || 0}</strong> フィールド
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                const cols = historyDetail.columns || [];
                                const labels = historyDetail.columnLabels || {};
                                const records = historyDetail.records || [];
                                const nameMap = historyDetail.nameMap || {};
                                const hasNameMap = Object.keys(nameMap).length > 0;
                                const displayCols = hasNameMap ? [cols[0], '__name__', ...cols.slice(1)] : cols;
                                const headerRow = displayCols.map(c => c === '__name__' ? '担当者名' : (labels[c] || c));
                                const csvRows = records.map(r => displayCols.map(c => {
                                  if (c === '__name__') return nameMap[r[cols[0]]] || '';
                                  const v = r[c] ?? '';
                                  return String(v).includes(',') ? `"${v}"` : v;
                                }));
                                const bom = '\uFEFF';
                                const csv = bom + [headerRow.join(','), ...csvRows.map(r => r.join(','))].join('\n');
                                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `import-history_${new Date().toISOString().slice(0, 10)}.csv`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                              }}
                              className={`flex items-center gap-1 px-2 py-1 rounded ${theme === 'dark' ? 'hover:bg-white/10 text-white/60 hover:text-white/90' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`}
                            >
                              <Download size={12} />
                              CSV
                            </button>
                          </div>
                          {historyDetail.records?.length > 0 && historyDetail.columns?.length > 0 && (() => {
                            const cols = historyDetail.columns;
                            const labels = historyDetail.columnLabels || {};
                            const records = historyDetail.records;
                            const nameMap = historyDetail.nameMap || {};
                            const keyColName = historyDetail.keyColName || '';
                            const hasNameMap = Object.keys(nameMap).length > 0;
                            // nameMap がある場合、キー列（最初の列）の値から名前を引ける
                            const keyCol = cols[0] || '';
                            // 表示列: nameMapがあれば最初の列の後ろに名前列を挿入
                            const displayCols = hasNameMap ? [cols[0], '__name__', ...cols.slice(1)] : cols;
                            const ROW_HEIGHT = 32;
                            const listHeight = Math.min(400, records.length * ROW_HEIGHT);
                            const colWidth = Math.max(140, Math.floor(800 / displayCols.length));

                            const DetailRow = ({ index, style, data }) => {
                              const r = data.records[index];
                              return (
                                <div style={style} className={`flex items-center text-[11px] ${data.theme === 'dark' ? (index % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]') : (index % 2 === 0 ? 'bg-transparent' : 'bg-gray-50/50')}`}>
                                  <div className={`shrink-0 w-10 px-2 text-right ${data.mutedClass}`}>{index + 1}</div>
                                  {data.displayCols.map(col => {
                                    if (col === '__name__') {
                                      const name = data.nameMap[r[data.keyCol]] || '';
                                      return (
                                        <div key="__name__" className={`shrink-0 px-2 truncate font-medium ${data.textClass}`} style={{ width: data.colWidth }} title={name}>
                                          {name}
                                        </div>
                                      );
                                    }
                                    return (
                                      <div key={col} className={`shrink-0 px-2 truncate ${data.textClass}`} style={{ width: data.colWidth }} title={r[col] != null ? String(r[col]) : ''}>
                                        {r[col] != null ? String(r[col]) : ''}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            };

                            return (
                              <div className="overflow-x-auto">
                                {/* ヘッダー行 */}
                                <div className={`flex text-[11px] font-medium sticky top-0 ${theme === 'dark' ? 'bg-slate-800 border-b border-white/10' : 'bg-gray-100 border-b border-gray-200'}`} style={{ minWidth: 40 + displayCols.length * colWidth }}>
                                  <div className={`shrink-0 w-10 px-2 py-1.5 text-right ${mutedClass}`}>#</div>
                                  {displayCols.map(col => {
                                    if (col === '__name__') {
                                      return (
                                        <div key="__name__" className="shrink-0 px-2 py-1 truncate" style={{ width: colWidth }}>
                                          <div className="text-amber-500">{keyColName || '名前'}</div>
                                        </div>
                                      );
                                    }
                                    return (
                                      <div key={col} className="shrink-0 px-2 py-1 truncate" style={{ width: colWidth }} title={`${labels[col] || ''} (${col})`}>
                                        {labels[col] ? (
                                          <>
                                            <div className={textClass}>{labels[col]}</div>
                                            <div className={`text-[9px] ${mutedClass}`}>{col}</div>
                                          </>
                                        ) : (
                                          <div className={mutedClass}>{col}</div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                                {/* 仮想スクロールリスト */}
                                <div style={{ minWidth: 40 + displayCols.length * colWidth }}>
                                  <List
                                    rowCount={records.length}
                                    rowHeight={ROW_HEIGHT}
                                    rowComponent={DetailRow}
                                    rowProps={{ data: { records, displayCols, colWidth, theme, mutedClass, textClass, nameMap, keyCol } }}
                                    overscanCount={10}
                                    style={{ height: listHeight, width: '100%' }}
                                  />
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ============================== */}
        {/* === 稼働実績一括タブ === */}
        {/* ============================== */}
        {activeTab === 'unified' && (
          <SalesforceUnifiedImport
            key={config?.name || 'default'}
            theme={theme}
            config={config}
            allDashboards={allDashboards}
            sourceCacheByDashboard={sourceCacheByDashboard}
            calculatedDataCache={calculatedDataCache}
            updateConfig={updateConfig}
            globalApiKey={globalApiKey}
            registeredObjects={registeredObjects}
          />
        )}


      </div>

      {/* インポートプレビュー＆実行モーダル */}
      <SalesforceExportModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        theme={theme}
        objectName={presetObjectApiName}
        externalIdField={matchMode === 'soqlLookup' ? 'Id' : keyMapping.sfFieldApiName}
        records={importRecords}
        fieldMappings={fieldMappings.filter(m => m.enabled && m.sfFieldApiName)}
        keyMapping={keyMapping}
        allAvailableFields={allAvailableFields}
        presetSfFields={presetSfFields}
        matchMode={matchMode}
        matchResult={matchResult}
        recordMetadata={recordMetadata}
        metadataColumns={metadataColumns}
        unmatchedRows={unmatchedRows}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
};

export default SalesforceSync;
