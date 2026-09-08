// src/apps/performance-board/components/settings/SoqlFieldPicker.jsx
// SOQLフィールドピッカー — 複数オブジェクト対応・テーブルプレビュー付き

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Search, Check, ChevronDown, ChevronRight, ChevronUp,
  Download, Loader2, X, Database, Link2, Plus, Table, Filter, Code
} from 'lucide-react';
import { buildSoqlDateFilterClause, buildSoqlDateFiltersClause } from '../../utils/dateFilters';
import { SALESFORCE_DEMO_MESSAGE } from '../../services/salesforceApi';

// ── WHERE句プリセット値 ──
const DATE_PRESETS = [
  { value: 'THIS_MONTH', label: '今月' },
  { value: 'LAST_MONTH', label: '先月' },
  { value: 'NEXT_MONTH', label: '来月' },
  { value: 'THIS_QUARTER', label: '今四半期' },
  { value: 'LAST_QUARTER', label: '前四半期' },
  { value: 'THIS_YEAR', label: '今年' },
  { value: 'LAST_YEAR', label: '去年' },
  { value: 'TODAY', label: '今日' },
  { value: 'YESTERDAY', label: '昨日' },
  { value: 'LAST_N_DAYS:7', label: '過去7日' },
  { value: 'LAST_N_DAYS:30', label: '過去30日' },
  { value: 'LAST_N_DAYS:90', label: '過去90日' },
  { value: 'LAST_N_MONTHS:2', label: '先月～今月' },
];

const OPERATORS = [
  { value: '=', label: '=' },
  { value: '!=', label: '!=' },
  { value: 'IN', label: 'IN（複数値）' },
  { value: 'NOT IN', label: 'NOT IN' },
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: 'LIKE', label: 'LIKE（部分一致）' },
];

const blockSalesforceRequest = async () => {
  alert(SALESFORCE_DEMO_MESSAGE);
  throw new Error(SALESFORCE_DEMO_MESSAGE);
};

// ── WHERE句生成 ──
function buildWhereFromGroups(groups) {
  if (!groups || groups.length === 0) return '';
  const groupClauses = groups.map(group => {
    const conditions = (group.conditions || [])
      .filter(c => c.field && c.value)
      .map(c => {
        const op = c.operator || '=';
        if (op === 'IN' || op === 'NOT IN') {
          const vals = c.value.split(',').map(v => v.trim()).filter(Boolean);
          if (c.valueType === 'preset') {
            return `${c.field} ${op} (${vals.join(', ')})`;
          }
          const quoted = vals.map(v => `'${v.replace(/'/g, "\\'")}'`).join(', ');
          return `${c.field} ${op} (${quoted})`;
        }
        if (op === 'LIKE') {
          return `${c.field} LIKE '%${c.value.replace(/'/g, "\\'")}'%'`;
        }
        // プリセット値はクォートしない
        if (c.valueType === 'preset') {
          return `${c.field} ${op} ${c.value}`;
        }
        // 数値判定
        if (!isNaN(c.value) && c.value.trim() !== '') {
          return `${c.field} ${op} ${c.value}`;
        }
        return `${c.field} ${op} '${c.value.replace(/'/g, "\\'")}'`;
      });
    if (conditions.length === 0) return '';
    if (conditions.length === 1) return conditions[0];
    return `(${conditions.join(' OR ')})`;
  }).filter(Boolean);

  if (groupClauses.length <= 1) return groupClauses[0] || '';
  // 各グループを括弧で保護してAND結合（SOQL AND/OR混在対策）
  const wrapped = groupClauses.map(c => c.includes(' OR ') && !c.startsWith('(') ? `(${c})` : c);
  return wrapped.join(' AND ');
}

// ── プレースホルダー推測 ──
function guessPlaceholder(fieldName, label) {
  const l = (label || fieldName).toLowerCase();
  if (/^id$/i.test(fieldName)) return '00xABC...';
  if (l.includes('名') || /name/i.test(fieldName)) return 'サンプル担当者';
  if (l.includes('日付') || l.includes('date')) return '2026-03-23';
  if (l.includes('時間') || l.includes('time') || l.includes('hour')) return '8.5';
  if (l.includes('金額') || l.includes('amount') || l.includes('price')) return '150,000';
  if (l.includes('数') || l.includes('count') || l.includes('件')) return '42';
  if (l.includes('エリア') || l.includes('area')) return 'エリア①';
  if (l.includes('部署') || l.includes('dept')) return '営業部';
  if (l.includes('メール') || l.includes('email')) return 'a@example.com';
  if (l.includes('電話') || l.includes('phone')) return '03-1234-5678';
  return 'ABC';
}

const SoqlFieldPicker = ({
  source,
  onSourceUpdate,
  localConfig,
  updateLocalConfig,
  sourceCache,
  theme,
  inputClass,
  labelSmClass,
  labelXsClass,
  borderClass,
  textClass,
  textMutedClass,
  optionClass,
}) => {
  // ── State ──
  const [isDescribing, setIsDescribing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRelations, setExpandedRelations] = useState({});
  const [relatedFieldsCache, setRelatedFieldsCache] = useState({});
  const [isFieldsExpanded, setIsFieldsExpanded] = useState(true);
  const [isRelationsExpanded, setIsRelationsExpanded] = useState(false);
  const [mainObjectLabel, setMainObjectLabel] = useState(source._mainObjectLabel || '');

  // 追加オブジェクト（リレーション先から登録）
  const [addedObjects, setAddedObjects] = useState(() => source._addedObjects || []);
  // プレビューデータ（追加読み込み対応）
  const [previewRows, setPreviewRows] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewLimit, setPreviewLimit] = useState(5);

  // VLOOKUP結合（source.vlookupsを単一の真実の源として使用）
  const vlookups = source.vlookups || [];
  const [vlookupExpanded, setVlookupExpanded] = useState(false);
  const [vlookupForm, setVlookupForm] = useState({
    targetObject: '',
    targetObjectLabel: '',
    targetKeyField: '',
    targetKeyFieldLabel: '',
    targetValueField: '',
    targetValueFieldLabel: '',
    localKeyField: '',
    localKeyFieldLabel: '',
    outputLabel: '',
  });
  const [vlookupTargetFields, setVlookupTargetFields] = useState([]);
  const [vlookupDescribing, setVlookupDescribing] = useState(false);
  const [vlookupEditingId, setVlookupEditingId] = useState(null);
  const [vlookupEditFields, setVlookupEditFields] = useState([]);
  const [vlookupObjectList, setVlookupObjectList] = useState([]); // SF全オブジェクト一覧
  const [vlookupObjectLoading, setVlookupObjectLoading] = useState(false);

  // allFields: [{name, label, type, _objectName?, _objectLabel?}]
  const [allFields, setAllFields] = useState(() => {
    if (source.fieldMetadata && Object.keys(source.fieldMetadata).length > 0) {
      return Object.entries(source.fieldMetadata)
        .filter(([name]) => !name.includes('.'))
        .map(([name, label]) => ({ name, label, type: 'unknown', _objectLabel: source._mainObjectLabel || '' }));
    }
    return [];
  });

  // リレーション先から取得したフィールド（オブジェクト別）
  const [relationFields, setRelationFields] = useState(() => {
    // 既存の選択済みリレーションフィールドから復元
    const groups = {};
    if (source.fieldMetadata) {
      Object.entries(source.fieldMetadata).forEach(([name, label]) => {
        if (name.includes('.')) {
          const [rel] = name.split('.');
          if (!groups[rel]) groups[rel] = [];
          groups[rel].push({ name, label, _objectLabel: rel });
        }
      });
    }
    return groups;
  });

  // ── Derived ──
  const selectedFields = useMemo(() => {
    return (source.soqlFields || '').split(',').map(f => f.trim()).filter(Boolean);
  }, [source.soqlFields]);

  const fieldMetadata = source.fieldMetadata || {};
  const relationMeta = source._relationMeta || {};

  // 全フィールド（メイン + 追加オブジェクト）をオブジェクト別にグルーピング
  const groupedFields = useMemo(() => {
    const groups = {};
    const mainLabel = mainObjectLabel || source.soqlObject || 'メイン';

    // メインオブジェクトのフィールド
    if (allFields.length > 0) {
      groups[mainLabel] = { fields: allFields, isMain: true, objectName: source.soqlObject };
    }

    // 追加オブジェクト（リレーション先）のフィールド
    for (const obj of addedObjects) {
      const relName = obj.relationshipName;
      const cache = relatedFieldsCache[relName];
      if (cache?.fields?.length > 0) {
        groups[obj.label] = {
          fields: cache.fields.map(f => ({
            name: `${relName}.${f.name}`,
            label: `${obj.label}:${f.label}`,
            _rawLabel: f.label,
            _objectLabel: obj.label,
            _relName: relName,
          })),
          isMain: false,
          objectName: obj.referenceTo,
          relationshipName: relName,
        };
      }
    }

    return groups;
  }, [allFields, addedObjects, relatedFieldsCache, mainObjectLabel, source.soqlObject]);

  // 検索フィルタ
  const filteredGroupedFields = useMemo(() => {
    if (!searchQuery.trim()) return groupedFields;
    const q = searchQuery.toLowerCase();
    const result = {};
    for (const [groupName, group] of Object.entries(groupedFields)) {
      const filtered = group.fields.filter(f =>
        f.name.toLowerCase().includes(q) || (f.label || '').toLowerCase().includes(q)
      );
      if (filtered.length > 0) {
        result[groupName] = { ...group, fields: filtered };
      }
    }
    return result;
  }, [groupedFields, searchQuery]);

  // ── 再読み込み時: 追加オブジェクト復元 + プレフィックス自動付与 ──
  useEffect(() => {
    const applyPrefixes = (labelMap) => {
      if (!source.fieldMetadata) return;
      const meta = { ...source.fieldMetadata };
      let changed = false;
      for (const [key, val] of Object.entries(meta)) {
        if (!key.includes('.') || typeof val !== 'string') continue;
        if (val.includes(':')) continue; // 既にプレフィックス付き
        const relName = key.split('.')[0];
        const objLabel = labelMap[relName];
        if (objLabel) {
          meta[key] = `${objLabel}:${val}`;
          changed = true;
        }
      }
      if (changed) {
        onSourceUpdate(source.id, { fieldMetadata: meta });
      }
    };

    // _addedObjects + _relationMeta からラベルマップ構築
    const relLabelMap = {};
    const relMeta = source._relationMeta || {};
    for (const [, rm] of Object.entries(relMeta)) {
      relLabelMap[rm.relationshipName] = rm.label;
    }
    for (const obj of addedObjects) {
      if (obj.relationshipName && obj.label) {
        relLabelMap[obj.relationshipName] = obj.label;
      }
    }

    // 追加オブジェクトの復元が不要な場合はプレフィックスだけ適用して終了
    if (addedObjects.length === 0) {
      applyPrefixes(relLabelMap);
      return;
    }

    const missing = addedObjects.filter(o => !relatedFieldsCache[o.relationshipName]?.fields?.length);
    if (missing.length === 0) {
      applyPrefixes(relLabelMap);
      return;
    }

    // 未取得オブジェクトを describe → 完了後にプレフィックス付与
    const loadingUpdate = {};
    missing.forEach(o => { loadingUpdate[o.relationshipName] = { fields: [], loading: true }; });
    setRelatedFieldsCache(prev => ({ ...prev, ...loadingUpdate }));

    Promise.allSettled(missing.map(async (obj) => {
      try {
        const res = await blockSalesforceRequest(`./sf_upsert.php?action=describeObject&object=${encodeURIComponent(obj.name)}`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.status !== 'success' || !json.fields) return;
        const fields = json.fields
          .filter(f => !f.name.endsWith('__s'))
          .map(f => ({ name: f.name, label: f.label }));
        setRelatedFieldsCache(prev => ({
          ...prev,
          [obj.relationshipName]: { fields, loading: false },
        }));
      } catch {
        setRelatedFieldsCache(prev => ({
          ...prev,
          [obj.relationshipName]: { fields: [], loading: false },
        }));
      }
    })).then(() => {
      // 全 describe 完了後にプレフィックス付与
      applyPrefixes(relLabelMap);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // マウント時のみ

  // ── スタイル ──
  const panelBg = theme === 'dark' ? 'bg-white/[0.02]' : 'bg-gray-50/80';
  const hoverBg = theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-100';
  const checkboxActive = 'bg-sky-500 border-sky-500';
  const checkboxInactive = theme === 'dark' ? 'border-white/30' : 'border-gray-300';
  const accentText = theme === 'dark' ? 'text-sky-300' : 'text-sky-600';
  const mutedText = theme === 'dark' ? 'text-white/40' : 'text-gray-400';
  const purpleAccent = theme === 'dark' ? 'text-purple-300' : 'text-purple-600';

  // ── メインオブジェクトの describe ──
  const handleDescribeMain = useCallback(async () => {
    if (!source.soqlObject) return;
    setIsDescribing(true);
    try {
      const res = await blockSalesforceRequest(`./sf_upsert.php?action=describeObject&object=${encodeURIComponent(source.soqlObject)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.status !== 'success' || !json.fields) throw new Error(json.message || 'describe error');

      const objLabel = json.objectLabel || source.soqlObject;
      setMainObjectLabel(objLabel);

      // 全フィールドを表示（ジオロケーション系のサブフィールドのみ除外）
      const relevantFields = json.fields
        .filter(f => !f.name.endsWith('__s'));

      setAllFields(relevantFields.map(f => ({ ...f, _objectLabel: objLabel })));

      // メタデータ構築（候補一覧用 — 選択状態は変更しない）
      const metadata = {};
      relevantFields.forEach(f => { metadata[f.name] = f.label; });

      // リレーション検出
      const newRelationMeta = {};
      json.fields.forEach(f => {
        if (f.referenceTo?.length > 0 && f.relationshipName) {
          const relFieldName = `${f.relationshipName}.Name`;
          metadata[relFieldName] = `${f.label}:Name`;
          newRelationMeta[f.name] = {
            label: f.label,
            relationshipName: f.relationshipName,
            referenceTo: f.referenceTo[0],
          };
        }
      });

      // 既存の選択済みフィールドとメタデータを保持し、新しいメタデータをマージ
      const mergedMeta = { ...(source.fieldMetadata || {}), ...metadata };

      onSourceUpdate(source.id, {
        // soqlFields は変更しない（既存の選択状態を保持）
        fieldMetadata: mergedMeta,
        _relationMeta: newRelationMeta,
        _mainObjectLabel: objLabel,
      });

      // プレビューデータ取得（先頭5件）
      if (selectedFields.length > 0) fetchPreviewData(selectedFields);
    } catch (e) {
      alert(`フィールド取得エラー: ${e.message}`);
    } finally {
      setIsDescribing(false);
    }
  }, [source.soqlObject, source.id, source.fieldMetadata, selectedFields, onSourceUpdate]);

  // ── リレーション先オブジェクトを「追加オブジェクト」として登録 ──
  const addRelationObject = useCallback(async (fieldName) => {
    const meta = relationMeta[fieldName];
    if (!meta) return;
    const { relationshipName, referenceTo, label } = meta;

    // 既に追加済みならスキップ
    if (addedObjects.some(o => o.relationshipName === relationshipName)) return;

    // describe を実行
    setRelatedFieldsCache(prev => ({
      ...prev,
      [relationshipName]: { fields: [], loading: true },
    }));

    try {
      const res = await blockSalesforceRequest(`./sf_upsert.php?action=describeObject&object=${encodeURIComponent(referenceTo)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.status !== 'success' || !json.fields) throw new Error(json.message || 'describe error');

      const objLabel = json.objectLabel || referenceTo;
      // ラベルはフィールドのラベル（例: 「代電者」）を使用。オブジェクトラベル（例: 「獲得者」）ではない
      const displayLabel = label || objLabel;
      const fields = json.fields
        .filter(f => !f.name.endsWith('__s'))
        .map(f => ({ name: f.name, label: f.label }));

      setRelatedFieldsCache(prev => ({
        ...prev,
        [relationshipName]: { fields, loading: false },
      }));

      const newObj = { name: referenceTo, label: displayLabel, objectLabel: objLabel, relationshipName, fieldName };
      const newAddedObjects = [...addedObjects, newObj];
      setAddedObjects(newAddedObjects);
      onSourceUpdate(source.id, { _addedObjects: newAddedObjects });
    } catch (e) {
      alert(`オブジェクト追加エラー: ${e.message}`);
      setRelatedFieldsCache(prev => ({
        ...prev,
        [relationshipName]: { fields: [], loading: false },
      }));
    }
  }, [relationMeta, addedObjects, source.id, onSourceUpdate]);

  // ── 追加オブジェクトの削除 ──
  const removeAddedObject = useCallback((relationshipName) => {
    const newAddedObjects = addedObjects.filter(o => o.relationshipName !== relationshipName);
    setAddedObjects(newAddedObjects);
    onSourceUpdate(source.id, { _addedObjects: newAddedObjects });

    // そのオブジェクトのフィールドを selectedFields から除去
    const prefix = `${relationshipName}.`;
    const current = selectedFields.filter(f => !f.startsWith(prefix));
    const currentMeta = { ...fieldMetadata };
    selectedFields.forEach(f => { if (f.startsWith(prefix)) delete currentMeta[f]; });
    onSourceUpdate(source.id, {
      soqlFields: current.join(', '),
      fieldMetadata: currentMeta,
      _addedObjects: newAddedObjects,
    });
  }, [addedObjects, selectedFields, fieldMetadata, source.id, onSourceUpdate]);

  // ── VLOOKUP結合: プレビュー用にtargetObjectからデータ取得してマッチング ──
  const applyVlookupsToPreview = useCallback(async (rows, columns) => {
    const currentVlookups = source.vlookups || [];
    if (!currentVlookups.length || !rows || !rows.length) return { rows, columns, vlookupColumns: [] };

    // 全VLOOKUPのMapを先に一括構築
    const vlookupMaps = [];
    for (const vl of currentVlookups) {
      const label = vl.outputLabel || `${vl.targetObjectLabel}.${vl.targetValueField}`;
      try {
        const res = await blockSalesforceRequest('./sf_upsert.php?action=queryForAnalytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            objectName: vl.targetObject,
            fields: [vl.targetKeyField, vl.targetValueField],
            whereClause: '',
            orderBy: '',
            limitCount: 0,
          }),
        });
        if (!res.ok) { vlookupMaps.push({ label, lookupMap: null, localKeyIdx: -1 }); continue; }
        const json = await res.json();
        if (json.status !== 'success' || !json.data?.rows) { vlookupMaps.push({ label, lookupMap: null, localKeyIdx: -1 }); continue; }

        const lookupMap = new Map();
        const targetCols = json.data.columns || [vl.targetKeyField, vl.targetValueField];
        const keyIdx = targetCols.indexOf(vl.targetKeyField);
        const valIdx = targetCols.indexOf(vl.targetValueField);
        if (keyIdx >= 0 && valIdx >= 0) {
          for (const row of json.data.rows) {
            const key = String(row[keyIdx] || '');
            if (key) lookupMap.set(key, row[valIdx] ?? '');
          }
        }
        const localKeyIdx = columns.indexOf(vl.localKeyField);
        vlookupMaps.push({ label, lookupMap, localKeyIdx });
      } catch (e) {
        console.warn(`VLOOKUP取得失敗 (${vl.targetObject}):`, e.message);
        vlookupMaps.push({ label, lookupMap: null, localKeyIdx: -1 });
      }
    }

    // 1回のループで全VLOOKUPカラムを追加
    const vlookupColumns = vlookupMaps.map(vm => vm.label);
    const augmentedRows = rows.map(row => {
      const newRow = [...row];
      for (const vm of vlookupMaps) {
        if (!vm.lookupMap || vm.localKeyIdx < 0) { newRow.push(''); continue; }
        const localKey = String(newRow[vm.localKeyIdx] || '');
        newRow.push(vm.lookupMap.get(localKey) ?? '');
      }
      return newRow;
    });

    return { rows: augmentedRows, columns: [...columns, ...vlookupColumns], vlookupColumns };
  }, [source.vlookups]);

  // ── プレビューデータ取得（追加読み込み対応） ──
  const [previewColumns, setPreviewColumns] = useState(null);
  const [previewTotalCount, setPreviewTotalCount] = useState(0);

  const fetchPreviewData = useCallback(async (fields, limit = 5, append = false) => {
    if (!source.soqlObject || !fields || fields.length === 0) return;
    const queryFields = fields.filter(Boolean);
    if (queryFields.length === 0) return;
    setIsPreviewLoading(true);
    try {
      const res = await blockSalesforceRequest('./sf_upsert.php?action=queryForAnalytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectName: source.soqlObject,
          fields: queryFields,
          whereClause: (() => { const w = s => s && s.includes(' OR ') && !s.startsWith('(') ? `(${s})` : s; return [w(source.soqlWhere), w(buildSoqlDateFiltersClause(source.soqlDateFilters || source.soqlDateFilter))].filter(Boolean).join(' AND ') || ''; })(),
          orderBy: source.soqlOrderBy || '',
          limitCount: limit,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.status === 'success' && json.data?.rows) {
        // VLOOKUP結合を適用
        const baseCols = json.data.columns || queryFields;
        const { rows: vlRows, columns: vlCols } = await applyVlookupsToPreview(json.data.rows, baseCols);
        setPreviewRows(vlRows);
        setPreviewColumns(vlCols);
        setPreviewTotalCount(json.data.totalCount || json.data.rows.length);
        setPreviewLimit(limit);
      }
    } catch (e) {
      console.warn('プレビュー取得失敗:', e.message);
    } finally {
      setIsPreviewLoading(false);
    }
  }, [source.soqlObject, source.soqlWhere, source.soqlOrderBy, source.soqlDateFilter, applyVlookupsToPreview]);

  // ── CSVダウンロード ──
  const [isCsvDownloading, setIsCsvDownloading] = useState(false);

  const handleCsvDownload = useCallback(async () => {
    if (!source.soqlObject || selectedFields.length === 0) return;
    setIsCsvDownloading(true);
    try {
      const queryFields = selectedFields.filter(Boolean);
      const res = await blockSalesforceRequest('./sf_upsert.php?action=queryForAnalytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectName: source.soqlObject,
          fields: queryFields,
          whereClause: (() => { const w = s => s && s.includes(' OR ') && !s.startsWith('(') ? `(${s})` : s; return [w(source.soqlWhere), w(buildSoqlDateFiltersClause(source.soqlDateFilters || source.soqlDateFilter))].filter(Boolean).join(' AND ') || ''; })(),
          orderBy: source.soqlOrderBy || '',
          limitCount: 0, // 全件取得
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.status !== 'success' || !json.data?.rows) throw new Error(json.message || 'データ取得失敗');

      const columns = json.data.columns || queryFields;
      let rows = json.data.rows;

      // VLOOKUP結合をCSVにも適用
      const currentVlookups = source.vlookups || [];
      const vlookupLabels = [];
      if (currentVlookups.length > 0 && rows.length > 0) {
        const vlMaps = [];
        for (const vl of currentVlookups) {
          const label = vl.outputLabel || `${vl.targetObjectLabel || vl.targetObject}.${vl.targetValueField}`;
          try {
            const vlRes = await blockSalesforceRequest('./sf_upsert.php?action=queryForAnalytics', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ objectName: vl.targetObject, fields: [vl.targetKeyField, vl.targetValueField], whereClause: '', orderBy: '', limitCount: 0 }),
            });
            if (!vlRes.ok) { vlMaps.push({ label, lookupMap: null, localKeyIdx: -1 }); continue; }
            const vlJson = await vlRes.json();
            if (vlJson.status !== 'success' || !vlJson.data?.rows) { vlMaps.push({ label, lookupMap: null, localKeyIdx: -1 }); continue; }
            const lookupMap = new Map();
            const tCols = vlJson.data.columns || [vl.targetKeyField, vl.targetValueField];
            const kI = tCols.indexOf(vl.targetKeyField), vI = tCols.indexOf(vl.targetValueField);
            if (kI >= 0 && vI >= 0) { for (const r of vlJson.data.rows) { const k = String(r[kI] || ''); if (k) lookupMap.set(k, r[vI] ?? ''); } }
            vlMaps.push({ label, lookupMap, localKeyIdx: columns.indexOf(vl.localKeyField) });
          } catch { vlMaps.push({ label, lookupMap: null, localKeyIdx: -1 }); }
        }
        rows = rows.map(row => {
          const newRow = [...row];
          for (const vm of vlMaps) {
            if (!vm.lookupMap || vm.localKeyIdx < 0) { newRow.push(''); continue; }
            newRow.push(vm.lookupMap.get(String(newRow[vm.localKeyIdx] || '')) ?? '');
          }
          return newRow;
        });
        vlMaps.forEach(vm => vlookupLabels.push(vm.label));
      }

      // ヘッダー: ラベル名（fieldMetadataから取得、なければAPI名）+ VLOOKUPラベル
      const headerLabels = [...selectedFields.map(f => fieldMetadata[f] || f), ...vlookupLabels];

      // 列リマップ（selectedFields順に並べ替え）
      const colIndexMap = {};
      columns.forEach((col, idx) => { colIndexMap[col] = idx; });

      // CSV生成
      const escapeCsv = (val) => {
        const s = String(val ?? '');
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const csvLines = [];
      csvLines.push(headerLabels.map(escapeCsv).join(','));
      const vlBaseIdx = selectedFields.length;
      for (const row of rows) {
        const line = selectedFields.map(f => {
          const idx = colIndexMap[f];
          return escapeCsv(idx !== undefined ? row[idx] : '');
        });
        // VLOOKUPカラムを追加
        for (let vi = 0; vi < vlookupLabels.length; vi++) {
          line.push(escapeCsv(row[columns.length + vi] ?? ''));
        }
        csvLines.push(line.join(','));
      }

      // BOM付きUTF-8でダウンロード
      const bom = '\uFEFF';
      const blob = new Blob([bom + csvLines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${source.name || source.soqlObject}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`CSVダウンロードエラー: ${e.message}`);
    } finally {
      setIsCsvDownloading(false);
    }
  }, [source.soqlObject, source.soqlWhere, source.soqlOrderBy, source.soqlDateFilter, source.name, selectedFields, fieldMetadata]);

  // ── フィールド選択/解除 ──
  const toggleField = useCallback((fieldName, label) => {
    const current = [...selectedFields];
    const currentMeta = { ...fieldMetadata };
    const idx = current.indexOf(fieldName);
    if (idx >= 0) {
      current.splice(idx, 1);
      delete currentMeta[fieldName];
    } else {
      current.push(fieldName);
      if (label) currentMeta[fieldName] = label;
    }
    onSourceUpdate(source.id, {
      soqlFields: current.join(', '),
      fieldMetadata: currentMeta,
    });
  }, [selectedFields, fieldMetadata, source.id, onSourceUpdate]);

  // ── 全選択 / 全解除（表示中のフィールドのみ） ──
  const selectAll = useCallback(() => {
    const current = [...selectedFields];
    const currentMeta = { ...fieldMetadata };
    for (const group of Object.values(groupedFields)) {
      for (const f of group.fields) {
        if (!current.includes(f.name)) {
          current.push(f.name);
          currentMeta[f.name] = f.label;
        }
      }
    }
    onSourceUpdate(source.id, { soqlFields: current.join(', '), fieldMetadata: currentMeta });
  }, [selectedFields, fieldMetadata, groupedFields, source.id, onSourceUpdate]);

  const deselectAll = useCallback(() => {
    onSourceUpdate(source.id, { soqlFields: '', fieldMetadata: {} });
  }, [source.id, onSourceUpdate]);

  // ── 並べ替え ──
  const moveField = useCallback((fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= selectedFields.length) return;
    const arr = [...selectedFields];
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    onSourceUpdate(source.id, { soqlFields: arr.join(', ') });
  }, [selectedFields, source.id, onSourceUpdate]);

  // ── 個別削除 ──
  const removeField = useCallback((fieldName) => {
    const current = selectedFields.filter(f => f !== fieldName);
    const currentMeta = { ...fieldMetadata };
    delete currentMeta[fieldName];
    onSourceUpdate(source.id, { soqlFields: current.join(', '), fieldMetadata: currentMeta });
  }, [selectedFields, fieldMetadata, source.id, onSourceUpdate]);

  // ── VLOOKUP: SFオブジェクト一覧取得 ──
  const fetchVlookupObjectList = useCallback(async () => {
    if (vlookupObjectList.length > 0) return; // キャッシュ済み
    setVlookupObjectLoading(true);
    try {
      const res = await blockSalesforceRequest('./sf_upsert.php?action=describeGlobal');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.status === 'success' && json.objects) {
        setVlookupObjectList(json.objects);
      }
    } catch (e) {
      console.warn('オブジェクト一覧取得エラー:', e.message);
    } finally {
      setVlookupObjectLoading(false);
    }
  }, [vlookupObjectList.length]);

  // ── VLOOKUP: 結合先オブジェクト選択時にフィールド取得 ──
  const handleVlookupObjectSelect = useCallback(async (objectName) => {
    if (!objectName) {
      setVlookupTargetFields([]);
      setVlookupForm(prev => ({ ...prev, targetObject: '', targetObjectLabel: '', targetKeyField: '', targetKeyFieldLabel: '', targetValueField: '', targetValueFieldLabel: '' }));
      return;
    }
    const obj = vlookupObjectList.find(o => o.name === objectName);
    setVlookupForm(prev => ({ ...prev, targetObject: objectName, targetObjectLabel: obj?.label || objectName, targetKeyField: '', targetKeyFieldLabel: '', targetValueField: '', targetValueFieldLabel: '' }));
    setVlookupDescribing(true);
    try {
      const res = await blockSalesforceRequest(`./sf_upsert.php?action=describeObject&object=${encodeURIComponent(objectName)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.status !== 'success' || !json.fields) throw new Error(json.message || 'describe error');
      const fields = json.fields
        .filter(f => !f.name.endsWith('__s'))
        .map(f => ({ name: f.name, label: f.label }));
      setVlookupTargetFields(fields);
      setVlookupForm(prev => ({ ...prev, targetObjectLabel: json.objectLabel || objectName }));
    } catch (e) {
      alert(`フィールド取得エラー: ${e.message}`);
    } finally {
      setVlookupDescribing(false);
    }
  }, [vlookupObjectList]);

  // ── VLOOKUP追加 ──
  const handleAddVlookup = useCallback(() => {
    if (!vlookupForm.targetObject || !vlookupForm.targetKeyField || !vlookupForm.targetValueField || !vlookupForm.localKeyField) {
      alert('すべての項目を入力してください');
      return;
    }
    const outputLabel = vlookupForm.outputLabel || `${vlookupForm.targetObjectLabel}.${vlookupForm.targetValueFieldLabel || vlookupForm.targetValueField}`;
    const newVlookup = {
      id: `vl_${Date.now()}`,
      ...vlookupForm,
      outputLabel,
    };
    const updated = [...vlookups, newVlookup];
    const currentHeaders = source.headers || [];
    const newHeaders = currentHeaders.includes(outputLabel) ? currentHeaders : [...currentHeaders, outputLabel];
    onSourceUpdate(source.id, { vlookups: updated, headers: newHeaders });
    // systemFields + mapping はAnalyticsSettings.jsxのuseEffectで自動同期される
    setVlookupForm({
      targetObject: '', targetObjectLabel: '', targetKeyField: '', targetKeyFieldLabel: '',
      targetValueField: '', targetValueFieldLabel: '', localKeyField: '', localKeyFieldLabel: '',
      outputLabel: '',
    });
    setVlookupTargetFields([]);
  }, [vlookupForm, vlookups, source.id, source.headers, onSourceUpdate]);

  // ── VLOOKUP削除 ──
  const handleRemoveVlookup = useCallback((vlId) => {
    const removedVl = vlookups.find(v => v.id === vlId);
    const updated = vlookups.filter(v => v.id !== vlId);
    const currentHeaders = source.headers || [];
    const newHeaders = removedVl ? currentHeaders.filter(h => h !== removedVl.outputLabel) : currentHeaders;
    onSourceUpdate(source.id, { vlookups: updated, headers: newHeaders });
    // systemFields + mapping はAnalyticsSettings.jsxのuseEffectで自動同期される
    if (vlookupEditingId === vlId) { setVlookupEditingId(null); setVlookupEditFields([]); }
  }, [vlookups, source.id, source.headers, onSourceUpdate, vlookupEditingId]);

  // ── VLOOKUP展開編集: クリックでフィールド読み込み+展開 ──
  const handleToggleVlookupEdit = useCallback(async (vl) => {
    if (vlookupEditingId === vl.id) {
      setVlookupEditingId(null);
      setVlookupEditFields([]);
      return;
    }
    setVlookupEditingId(vl.id);
    setVlookupEditFields([]);
    // describeでフィールド一覧を取得
    try {
      const res = await blockSalesforceRequest(`./sf_upsert.php?action=describeObject&object=${encodeURIComponent(vl.targetObject)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.status === 'success' && json.fields) {
        setVlookupEditFields(json.fields.filter(f => !f.name.endsWith('__s')).map(f => ({ name: f.name, label: f.label })));
      }
    } catch (e) {
      console.warn('VLOOKUP edit describe error:', e.message);
    }
  }, [vlookupEditingId]);

  // ── VLOOKUP更新（個別フィールド変更） ──
  const handleUpdateVlookup = useCallback((vlId, updates) => {
    const oldVl = vlookups.find(v => v.id === vlId);
    const updated = vlookups.map(v => v.id === vlId ? { ...v, ...updates } : v);
    const currentHeaders = source.headers || [];
    let newHeaders = currentHeaders;
    if (updates.outputLabel && oldVl && oldVl.outputLabel !== updates.outputLabel) {
      newHeaders = currentHeaders.map(h => h === oldVl.outputLabel ? updates.outputLabel : h);
    }
    onSourceUpdate(source.id, { vlookups: updated, headers: newHeaders });
    // systemFields + mapping はAnalyticsSettings.jsxのuseEffectで自動同期される
  }, [vlookups, source.id, source.headers, onSourceUpdate]);

  // ── テーブルプレビュー用データ ──
  const previewData = useMemo(() => {
    if (selectedFields.length === 0) return null;
    const baseHeaders = selectedFields.map(f => ({
      name: f,
      label: fieldMetadata[f] || f,
    }));
    // VLOOKUPカラムのヘッダーを追加
    const currentVlookups = source.vlookups || [];
    const vlookupHeaders = currentVlookups.map(vl => ({
      name: `_vlookup_${vl.id}`,
      label: vl.outputLabel || `${vl.targetObjectLabel}.${vl.targetValueField}`,
      isVlookup: true,
    }));
    const headers = [...baseHeaders, ...vlookupHeaders];

    // previewRows がある場合は実データを使用（列順をselectedFieldsに合わせてリマップ）
    if (previewRows && previewRows.length > 0 && previewColumns) {
      const colIndexMap = {};
      previewColumns.forEach((col, idx) => { colIndexMap[col] = idx; });

      // selectedFieldsのカラム数
      const baseFieldCount = selectedFields.length;
      // VLOOKUPカラムはpreviewColumnsの末尾に追加されているため、末尾から取得
      const vlookupStartIdx = previewColumns.length - currentVlookups.length;

      const remappedRows = previewRows.map(row => {
        const baseCells = selectedFields.map(f => {
          const idx = colIndexMap[f];
          if (idx !== undefined && row[idx] !== undefined) return String(row[idx] ?? '');
          return '';
        });
        // VLOOKUPカラムを末尾から追加
        const vlookupCells = currentVlookups.map((_, i) => {
          const idx = vlookupStartIdx + i;
          if (idx >= 0 && idx < row.length && row[idx] !== undefined) return String(row[idx] ?? '');
          return '';
        });
        return [...baseCells, ...vlookupCells];
      });
      return { headers, rows: remappedRows };
    }

    // sourceCache にデータがある場合
    const cachedRows = sourceCache?.[source.id];
    if (cachedRows && cachedRows.length > 0) {
      const sourceHeaders = source.headers || [];
      const rows = cachedRows.slice(0, 5).map(row =>
        selectedFields.map(f => {
          const idx = sourceHeaders.indexOf(fieldMetadata[f] || f);
          if (idx >= 0 && row[idx] !== undefined) return String(row[idx]);
          const idx2 = sourceHeaders.indexOf(f);
          if (idx2 >= 0 && row[idx2] !== undefined) return String(row[idx2]);
          return '';
        })
      );
      return { headers, rows };
    }

    // ダミーデータ
    return { headers, rows: [selectedFields.map(f => guessPlaceholder(f, fieldMetadata[f]))] };
  }, [selectedFields, fieldMetadata, previewRows, previewColumns, sourceCache, source.id, source.headers, source.vlookups]);

  return (
    <div className="space-y-2">

      {/* ══════ セクション1: オブジェクト設定 + フィールド候補（2カラム） ══════ */}
      <div className={`rounded-lg border ${borderClass} ${panelBg} p-3`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          {/* ── 左カラム: オブジェクト設定 + リレーション先 ── */}
          <div className="space-y-3">
            <div className={`text-[11px] font-semibold ${accentText} flex items-center gap-1`}>
              <Database size={12} /> オブジェクト設定
            </div>

            {/* メインオブジェクト */}
            <div>
              <label className={`text-[10px] ${labelSmClass} block mb-1`}>メインオブジェクト</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={source.soqlObject || ''}
                  onChange={(e) => onSourceUpdate(source.id, { soqlObject: e.target.value })}
                  className={`flex-1 ${inputClass} rounded px-2 py-1.5 text-xs font-mono`}
                  placeholder="CustomObject11__c"
                />
                <button
                  onClick={handleDescribeMain}
                  disabled={!source.soqlObject || isDescribing}
                  className={`px-2 py-1.5 rounded text-[10px] flex items-center gap-1 whitespace-nowrap transition-colors ${
                    source.soqlObject && !isDescribing
                      ? (theme === 'dark' ? 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30' : 'bg-sky-50 text-sky-600 hover:bg-sky-100')
                      : (theme === 'dark' ? 'bg-white/5 text-white/30 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed')
                  }`}
                >
                  {isDescribing ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                  取得
                </button>
              </div>
              {mainObjectLabel && (
                <div className={`text-[10px] ${mutedText} mt-0.5`}>{mainObjectLabel}</div>
              )}
            </div>

            {/* 追加オブジェクト一覧 */}
            {addedObjects.length > 0 && (
              <div className="space-y-1">
                <label className={`text-[10px] ${purpleAccent} font-medium`}>追加オブジェクト</label>
                {addedObjects.map(obj => (
                  <div
                    key={obj.relationshipName}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs border ${borderClass} ${panelBg}`}
                  >
                    <Link2 size={10} className={purpleAccent} />
                    <span className={`font-medium ${textClass}`}>{obj.label}</span>
                    <span className={`text-[10px] ${mutedText} font-mono`}>{obj.fieldName}</span>
                    <button
                      onClick={() => removeAddedObject(obj.relationshipName)}
                      className={`ml-auto p-0.5 rounded ${theme === 'dark' ? 'hover:bg-rose-500/20 text-rose-300' : 'hover:bg-rose-100 text-rose-500'}`}
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* リレーション先（折りたたみ） */}
            {Object.keys(relationMeta).length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setIsRelationsExpanded(v => !v)}
                  className={`text-[10px] font-medium ${purpleAccent} flex items-center gap-1`}
                >
                  {isRelationsExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                  <Link2 size={10} />
                  リレーション先 ({Object.keys(relationMeta).length})
                </button>
                {isRelationsExpanded && (
                  <div className={`mt-1 max-h-36 overflow-y-auto rounded border ${borderClass} p-1 space-y-0.5`}>
                    {Object.entries(relationMeta).map(([fieldName, meta]) => {
                      const isAdded = addedObjects.some(o => o.relationshipName === meta.relationshipName);
                      const cache = relatedFieldsCache[meta.relationshipName];
                      return (
                        <div
                          key={fieldName}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${hoverBg} transition-colors`}
                        >
                          <span className={`font-medium ${textClass} flex-1`}>{meta.label}</span>
                          <span className={`text-[10px] ${mutedText} font-mono`}>{fieldName}</span>
                          {isAdded ? (
                            <span className={`text-[9px] px-1 py-0.5 rounded ${theme === 'dark' ? 'bg-green-500/20 text-green-300' : 'bg-green-50 text-green-600'}`}>追加済</span>
                          ) : (
                            <button
                              onClick={() => addRelationObject(fieldName)}
                              disabled={cache?.loading}
                              className={`text-[9px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                                theme === 'dark' ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                              }`}
                            >
                              {cache?.loading ? <Loader2 size={8} className="animate-spin" /> : <Plus size={8} />}
                              追加
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── 右カラム: フィールド候補（オブジェクト別グルーピング） ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsFieldsExpanded(v => !v)}
                className={`text-[11px] font-semibold ${accentText} flex items-center gap-1`}
              >
                {isFieldsExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                フィールド候補
              </button>
              {isFieldsExpanded && Object.keys(groupedFields).length > 0 && (
                <div className="flex gap-1">
                  <button onClick={selectAll} className={`text-[10px] px-2 py-0.5 rounded ${hoverBg} ${accentText} transition-colors`}>全選択</button>
                  <button onClick={deselectAll} className={`text-[10px] px-2 py-0.5 rounded ${hoverBg} ${mutedText} transition-colors`}>全解除</button>
                </div>
              )}
            </div>

            {isFieldsExpanded && (
              <>
                {Object.keys(groupedFields).length > 0 && (
                  <div className="relative">
                    <Search size={12} className={`absolute left-2 top-1/2 -translate-y-1/2 ${mutedText}`} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full ${inputClass} rounded pl-7 pr-2 py-1.5 text-xs`}
                      placeholder="検索..."
                    />
                  </div>
                )}
                <div className={`max-h-48 overflow-y-auto rounded border ${borderClass} p-1`}>
                  {Object.keys(filteredGroupedFields).length > 0 ? (
                    Object.entries(filteredGroupedFields).map(([groupName, group]) => (
                      <div key={groupName}>
                        {/* グループヘッダー */}
                        <div className={`text-[9px] font-bold uppercase px-2 py-1 ${group.isMain ? accentText : purpleAccent} ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'} rounded mt-0.5 first:mt-0`}>
                          {groupName}
                        </div>
                        {/* フィールドリスト */}
                        {group.fields.map(f => {
                          const isSelected = selectedFields.includes(f.name);
                          return (
                            <div
                              key={f.name}
                              onClick={() => toggleField(f.name, f.label)}
                              className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs ${hoverBg} transition-colors`}
                            >
                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? checkboxActive : checkboxInactive}`}>
                                {isSelected && <Check size={9} className="text-white" />}
                              </div>
                              <span className={`font-medium ${textClass}`}>{f.label || f.name}</span>
                              <span className={`text-[10px] ${mutedText} font-mono`}>{f.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  ) : (
                    <div className={`text-center py-4 text-xs ${mutedText}`}>
                      {searchQuery ? '該当なし' : '← オブジェクト名を入力して「取得」'}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ══════ クエリ条件（WHERE GUI + ORDER BY） ══════ */}
      {(() => {
        // WHERE GUI state は source._whereGroups / source._whereMode から復元
        const whereMode = source._whereMode || 'gui';
        const whereGroups = source._whereGroups || [];

        // 全フィールド候補（メイン + リレーション先）をフラットリスト化
        const allFieldOptions = [];
        for (const [groupName, group] of Object.entries(groupedFields)) {
          for (const f of group.fields) {
            allFieldOptions.push({ name: f.name, label: f.label || f.name, group: groupName });
          }
        }
        // selectedFields に含まれるがフィールド候補にないもの（直接入力済み）も追加
        selectedFields.forEach(f => {
          if (!allFieldOptions.some(o => o.name === f)) {
            allFieldOptions.push({ name: f, label: fieldMetadata[f] || f, group: 'その他' });
          }
        });

        const setWhereMode = (mode) => onSourceUpdate(source.id, { _whereMode: mode });
        const setWhereGroups = (groups) => {
          const where = buildWhereFromGroups(groups);
          onSourceUpdate(source.id, { _whereGroups: groups, soqlWhere: where });
        };

        const addGroup = () => {
          setWhereGroups([...whereGroups, { id: `g${Date.now()}`, conditions: [{ id: `c${Date.now()}`, field: '', operator: '=', value: '', valueType: 'text' }] }]);
        };
        const removeGroup = (gId) => {
          setWhereGroups(whereGroups.filter(g => g.id !== gId));
        };
        const addCondition = (gId) => {
          setWhereGroups(whereGroups.map(g =>
            g.id === gId ? { ...g, conditions: [...g.conditions, { id: `c${Date.now()}`, field: '', operator: '=', value: '', valueType: 'text' }] } : g
          ));
        };
        const removeCondition = (gId, cId) => {
          setWhereGroups(whereGroups.map(g =>
            g.id === gId ? { ...g, conditions: g.conditions.filter(c => c.id !== cId) } : g
          ));
        };
        const updateCondition = (gId, cId, updates) => {
          setWhereGroups(whereGroups.map(g =>
            g.id === gId ? { ...g, conditions: g.conditions.map(c => c.id === cId ? { ...c, ...updates } : c) } : g
          ));
        };

        const tabActive = theme === 'dark' ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' : 'bg-sky-50 text-sky-600 border-sky-200';
        const tabInactive = theme === 'dark' ? 'text-white/40 hover:text-white/60' : 'text-gray-400 hover:text-gray-600';

        return (
          <div className={`rounded-lg border ${borderClass} ${panelBg} p-3 space-y-3`}>
            <div className="flex items-center justify-between">
              <div className={`text-[11px] font-semibold ${accentText} flex items-center gap-1`}>
                <Filter size={12} /> クエリ条件
              </div>
              {/* モード切替タブ */}
              <div className="flex gap-1">
                <button
                  onClick={() => setWhereMode('gui')}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${whereMode === 'gui' ? tabActive : tabInactive} ${whereMode === 'gui' ? 'border' : 'border-transparent'}`}
                >
                  GUI
                </button>
                <button
                  onClick={() => setWhereMode('text')}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${whereMode === 'text' ? tabActive : tabInactive} ${whereMode === 'text' ? 'border' : 'border-transparent'}`}
                >
                  <Code size={10} className="inline mr-0.5" />直接編集
                </button>
              </div>
            </div>

            {whereMode === 'text' ? (
              /* ── 直接編集モード ── */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={`text-[10px] ${labelSmClass} block mb-1`}>WHERE 条件</label>
                  <textarea
                    value={source.soqlWhere || ''}
                    onChange={(e) => onSourceUpdate(source.id, { soqlWhere: e.target.value })}
                    className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs font-mono resize-y min-h-[60px]`}
                    placeholder="Field108__c IN ('株式会社サンプル')"
                    rows={3}
                  />
                </div>
                <div>
                  <label className={`text-[10px] ${labelSmClass} block mb-1`}>ORDER BY</label>
                  <input
                    type="text"
                    value={source.soqlOrderBy || ''}
                    onChange={(e) => onSourceUpdate(source.id, { soqlOrderBy: e.target.value })}
                    className={`w-full ${inputClass} rounded px-2 py-1.5 text-xs font-mono`}
                    placeholder="CreatedDate DESC"
                  />
                </div>
              </div>
            ) : (
              /* ── GUIモード ── */
              <div className="space-y-2">
                {/* 条件グループ */}
                {whereGroups.map((group, gIdx) => (
                  <div key={group.id}>
                    {gIdx > 0 && (
                      <div className={`text-center text-[10px] font-bold py-1 ${accentText}`}>── AND ──</div>
                    )}
                    <div className={`rounded border ${borderClass} p-2 space-y-1.5`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-medium ${purpleAccent}`}>
                          条件グループ {gIdx + 1}
                          {group.conditions.length > 1 && <span className={mutedText}> （いずれかに一致: OR）</span>}
                        </span>
                        {whereGroups.length > 1 && (
                          <button onClick={() => removeGroup(group.id)} className={`p-0.5 rounded ${theme === 'dark' ? 'hover:bg-rose-500/20 text-rose-300' : 'hover:bg-rose-100 text-rose-500'}`}>
                            <X size={10} />
                          </button>
                        )}
                      </div>

                      {group.conditions.map((cond) => (
                        <div key={cond.id} className="flex items-center gap-1.5 flex-wrap">
                          {/* フィールド選択 */}
                          <select
                            value={cond.field}
                            onChange={(e) => updateCondition(group.id, cond.id, { field: e.target.value })}
                            className={`${inputClass} ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-gray-800'} rounded px-1.5 py-1 text-[10px] min-w-[140px] max-w-[200px]`}
                          >
                            <option value="">-- フィールド --</option>
                            {(() => {
                              const groups = {};
                              allFieldOptions.forEach(f => {
                                if (!groups[f.group]) groups[f.group] = [];
                                groups[f.group].push(f);
                              });
                              return Object.entries(groups).map(([gName, fields]) => (
                                <optgroup key={gName} label={gName} className={theme === 'dark' ? 'bg-slate-900 text-white' : ''}>
                                  {fields.map(f => (
                                    <option key={f.name} value={f.name} className={theme === 'dark' ? 'bg-slate-900 text-white' : ''}>
                                      {f.label}
                                    </option>
                                  ))}
                                </optgroup>
                              ));
                            })()}
                          </select>

                          {/* 演算子 */}
                          <select
                            value={cond.operator}
                            onChange={(e) => updateCondition(group.id, cond.id, { operator: e.target.value })}
                            className={`${inputClass} ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-gray-800'} rounded px-1.5 py-1 text-[10px] w-[90px]`}
                          >
                            {OPERATORS.map(op => (
                              <option key={op.value} value={op.value} className={theme === 'dark' ? 'bg-slate-900 text-white' : ''}>{op.label}</option>
                            ))}
                          </select>

                          {/* 値入力 */}
                          {(cond.operator === '=' || cond.operator === '!=' || cond.operator === '>' || cond.operator === '<' || cond.operator === '>=' || cond.operator === '<=') ? (
                            <div className="flex items-center gap-1">
                              {cond.valueType === 'preset' ? (
                                <select
                                  value={cond.value}
                                  onChange={(e) => updateCondition(group.id, cond.id, { value: e.target.value })}
                                  className={`${inputClass} ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-gray-800'} rounded px-1.5 py-1 text-[10px] min-w-[100px]`}
                                >
                                  <option value="">-- 選択 --</option>
                                  {DATE_PRESETS.map(p => (
                                    <option key={p.value} value={p.value} className={theme === 'dark' ? 'bg-slate-900 text-white' : ''}>{p.label} ({p.value})</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={cond.value}
                                  onChange={(e) => updateCondition(group.id, cond.id, { value: e.target.value })}
                                  className={`${inputClass} rounded px-1.5 py-1 text-[10px] font-mono min-w-[100px] max-w-[160px]`}
                                  placeholder="値を入力"
                                />
                              )}
                              <button
                                onClick={() => updateCondition(group.id, cond.id, { valueType: cond.valueType === 'preset' ? 'text' : 'preset', value: '' })}
                                className={`text-[9px] px-1 py-0.5 rounded whitespace-nowrap ${
                                  theme === 'dark' ? 'bg-white/10 text-white/50 hover:bg-white/20' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                                title={cond.valueType === 'preset' ? 'テキスト入力に切替' : '日付プリセットに切替'}
                              >
                                {cond.valueType === 'preset' ? 'Aa' : '📅'}
                              </button>
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={cond.value}
                              onChange={(e) => updateCondition(group.id, cond.id, { value: e.target.value })}
                              className={`${inputClass} rounded px-1.5 py-1 text-[10px] font-mono min-w-[140px] flex-1`}
                              placeholder={cond.operator.includes('IN') ? 'カンマ区切り: 値1, 値2' : '値を入力'}
                            />
                          )}

                          {/* 削除ボタン */}
                          {group.conditions.length > 1 && (
                            <button onClick={() => removeCondition(group.id, cond.id)} className={`p-0.5 rounded ${theme === 'dark' ? 'hover:bg-rose-500/20 text-rose-300' : 'hover:bg-rose-100 text-rose-500'}`}>
                              <X size={10} />
                            </button>
                          )}
                        </div>
                      ))}

                      <button
                        onClick={() => addCondition(group.id)}
                        className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-0.5 ${
                          theme === 'dark' ? 'text-sky-400 hover:bg-sky-500/10' : 'text-sky-600 hover:bg-sky-50'
                        }`}
                      >
                        <Plus size={8} /> 条件追加
                      </button>
                    </div>
                  </div>
                ))}

                {/* グループ追加 */}
                <button
                  onClick={addGroup}
                  className={`text-[10px] px-2 py-1 rounded flex items-center gap-1 ${
                    theme === 'dark' ? 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                  }`}
                >
                  <Plus size={10} /> 条件グループ追加
                </button>

                {/* 生成SQL プレビュー */}
                {source.soqlWhere && (
                  <div className={`rounded p-2 text-[10px] font-mono ${theme === 'dark' ? 'bg-black/30 text-emerald-300/80' : 'bg-gray-100 text-gray-600'} overflow-x-auto`}>
                    <span className={mutedText}>WHERE </span>{source.soqlWhere}
                  </div>
                )}

                {/* ORDER BY */}
                <div className="flex items-center gap-2">
                  <label className={`text-[10px] ${labelSmClass} whitespace-nowrap`}>ORDER BY</label>
                  <select
                    value={source.soqlOrderBy?.replace(/ (ASC|DESC)$/i, '') || ''}
                    onChange={(e) => {
                      const dir = source.soqlOrderBy?.match(/ (ASC|DESC)$/i)?.[1] || 'ASC';
                      onSourceUpdate(source.id, { soqlOrderBy: e.target.value ? `${e.target.value} ${dir}` : '' });
                    }}
                    className={`${inputClass} ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-gray-800'} rounded px-1.5 py-1 text-[10px] flex-1`}
                  >
                    <option value="" className={theme === 'dark' ? 'bg-slate-900' : ''}>-- なし --</option>
                    {allFieldOptions.map(f => (
                      <option key={f.name} value={f.name} className={theme === 'dark' ? 'bg-slate-900 text-white' : ''}>{f.label}</option>
                    ))}
                  </select>
                  <select
                    value={source.soqlOrderBy?.match(/ (ASC|DESC)$/i)?.[1] || 'ASC'}
                    onChange={(e) => {
                      const field = source.soqlOrderBy?.replace(/ (ASC|DESC)$/i, '') || '';
                      if (field) onSourceUpdate(source.id, { soqlOrderBy: `${field} ${e.target.value}` });
                    }}
                    className={`${inputClass} ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-gray-800'} rounded px-1.5 py-1 text-[10px] w-[70px]`}
                  >
                    <option value="ASC" className={theme === 'dark' ? 'bg-slate-900' : ''}>昇順</option>
                    <option value="DESC" className={theme === 'dark' ? 'bg-slate-900' : ''}>降順</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ══════ セクション2: 選択済みフィールド テーブルプレビュー ══════ */}
      <div className={`rounded-lg border ${borderClass} ${panelBg}`}>
        <div className={`px-3 py-2 flex items-center gap-2`}>
          <Table size={12} className={accentText} />
          <span className={`text-[11px] font-semibold ${accentText}`}>選択済みフィールド</span>
          <span className={`text-[10px] ${mutedText}`}>({selectedFields.length}件)</span>
          {selectedFields.length > 0 && (
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={() => { setPreviewLimit(5); fetchPreviewData(selectedFields, 5); }}
                disabled={isPreviewLoading || !source.soqlObject}
                className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1 transition-colors ${
                  theme === 'dark' ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                }`}
              >
                {isPreviewLoading ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                プレビュー更新
              </button>
              <button
                onClick={handleCsvDownload}
                disabled={isCsvDownloading || !source.soqlObject}
                className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1 transition-colors ${
                  theme === 'dark' ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                }`}
              >
                {isCsvDownloading ? <><Loader2 size={10} className="animate-spin" /> ダウンロード中...</> : <><Download size={10} /> CSV</>}
              </button>
            </div>
          )}
        </div>
        <div className="px-3 pb-3">
          {selectedFields.length === 0 ? (
            <div className={`text-center py-6 text-xs ${mutedText} border rounded ${borderClass}`}>
              フィールド候補からフィールドを選択してください
            </div>
          ) : previewData && (
            <div className={`overflow-x-auto rounded border ${borderClass}`}>
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    {previewData.headers.map((h, idx) => (
                      <th
                        key={h.name}
                        className={`px-2 py-1.5 text-left font-medium whitespace-nowrap border-b border-r last:border-r-0 ${
                          h.isVlookup
                            ? (theme === 'dark' ? 'border-white/10 bg-amber-500/10 text-amber-300' : 'border-gray-200 bg-amber-50 text-amber-700')
                            : (theme === 'dark' ? 'border-white/10 bg-white/5 text-white/70' : 'border-gray-200 bg-gray-50 text-gray-700')
                        }`}
                      >
                        <div className="flex items-center gap-1 group">
                          <span className="flex-1 truncate max-w-[120px]" title={`${h.label} (${h.name})`}>
                            {h.label}
                          </span>
                          {h.isVlookup ? (
                            <span className={`text-[8px] px-1 py-0.5 rounded flex-shrink-0 ${theme === 'dark' ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>VL</span>
                          ) : (
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {idx > 0 && (
                                <button onClick={() => moveField(idx, idx - 1)} className={`p-0.5 rounded ${hoverBg}`} title="左に移動">
                                  <ChevronUp size={8} className={`${textClass} rotate-[-90deg]`} />
                                </button>
                              )}
                              {idx < selectedFields.length - 1 && (
                                <button onClick={() => moveField(idx, idx + 1)} className={`p-0.5 rounded ${hoverBg}`} title="右に移動">
                                  <ChevronDown size={8} className={`${textClass} rotate-[-90deg]`} />
                                </button>
                              )}
                              <button
                                onClick={() => removeField(h.name)}
                                className={`p-0.5 rounded ${theme === 'dark' ? 'hover:bg-rose-500/20 text-rose-300' : 'hover:bg-rose-100 text-rose-500'}`}
                                title="削除"
                              >
                                <X size={8} />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className={`text-[9px] font-mono font-normal truncate max-w-[120px] ${h.isVlookup ? (theme === 'dark' ? 'text-amber-400/50' : 'text-amber-500/60') : mutedText}`}>{h.isVlookup ? 'VLOOKUP' : h.name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.rows.map((row, rowIdx) => (
                    <tr key={rowIdx} className={`border-b ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'} ${rowIdx % 2 === 1 ? (theme === 'dark' ? 'bg-white/[0.02]' : 'bg-gray-50/50') : ''}`}>
                      {row.map((val, colIdx) => (
                        <td
                          key={colIdx}
                          className={`px-2 py-1.5 whitespace-nowrap border-r last:border-r-0 min-h-[28px] ${
                            theme === 'dark' ? 'border-white/10 text-white/60' : 'border-gray-200 text-gray-500'
                          }`}
                        >
                          {val || <span className={mutedText}>-</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewRows && (
                <div className={`flex items-center justify-between px-2 py-1.5 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                  <span className={`text-[9px] ${mutedText}`}>
                    実データ {previewRows.length}件表示
                  </span>
                  {previewRows.length >= previewLimit && (
                    <button
                      onClick={() => fetchPreviewData(selectedFields, previewLimit + 10)}
                      disabled={isPreviewLoading}
                      className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1 transition-colors ${
                        theme === 'dark' ? 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30' : 'bg-sky-50 text-sky-600 hover:bg-sky-100'
                      }`}
                    >
                      {isPreviewLoading ? <Loader2 size={8} className="animate-spin" /> : <ChevronDown size={8} />}
                      もっと読み込む (+10件)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══════ VLOOKUP結合セクション ══════ */}
      {source.soqlObject && selectedFields.length > 0 && (
        <div className={`rounded-lg border ${borderClass} ${panelBg} p-3`}>
          <button
            onClick={() => setVlookupExpanded(!vlookupExpanded)}
            className={`w-full flex items-center gap-1.5 text-[11px] font-semibold ${theme === 'dark' ? 'text-amber-300' : 'text-amber-600'}`}
          >
            {vlookupExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Link2 size={12} />
            VLOOKUP結合
            {vlookups.length > 0 && (
              <span className={`ml-1 text-[9px] px-1.5 py-0.5 rounded-full ${theme === 'dark' ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
                {vlookups.length}件
              </span>
            )}
          </button>

          {vlookupExpanded && (
            <div className="mt-3 space-y-3">
              {/* 登録済みVLOOKUP一覧（クリックで展開編集） */}
              {vlookups.length > 0 && (
                <div className="space-y-1.5">
                  {vlookups.map(vl => {
                    const isEditing = vlookupEditingId === vl.id;
                    return (
                      <div key={vl.id} className={`rounded border ${borderClass} ${panelBg}`}>
                        {/* ヘッダー行（クリックで展開） */}
                        <div
                          onClick={() => handleToggleVlookupEdit(vl)}
                          className={`flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                        >
                          {isEditing ? <ChevronDown size={10} className={mutedText} /> : <ChevronRight size={10} className={mutedText} />}
                          <div className="flex-1 min-w-0">
                            <span className={`font-medium ${textClass}`}>{vl.outputLabel}</span>
                            <span className={`text-[9px] ${mutedText} ml-1.5`}>
                              {vl.localKeyFieldLabel || vl.localKeyField} → {vl.targetObjectLabel}.{vl.targetKeyFieldLabel || vl.targetKeyField} → {vl.targetValueFieldLabel || vl.targetValueField}
                            </span>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveVlookup(vl.id); }}
                            className={`p-0.5 rounded ${theme === 'dark' ? 'hover:bg-rose-500/20 text-rose-300' : 'hover:bg-rose-100 text-rose-500'}`}
                          >
                            <X size={10} />
                          </button>
                        </div>
                        {/* 展開時の編集フォーム */}
                        {isEditing && (
                          <div className={`px-2 pb-2 space-y-2 border-t ${borderClass}`}>
                            <div className={`text-[9px] ${mutedText} pt-1.5`}>結合先: {vl.targetObjectLabel || vl.targetObject}</div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className={`text-[10px] ${labelXsClass} block mb-0.5`}>結合先キー項目</label>
                                <select
                                  value={vl.targetKeyField}
                                  onChange={(e) => {
                                    const field = vlookupEditFields.find(f => f.name === e.target.value);
                                    handleUpdateVlookup(vl.id, { targetKeyField: e.target.value, targetKeyFieldLabel: field?.label || '' });
                                  }}
                                  className={`w-full ${inputClass} rounded px-2 py-1 text-xs`}
                                >
                                  <option value="" className={optionClass}>選択...</option>
                                  {vlookupEditFields.map(f => (
                                    <option key={f.name} value={f.name} className={optionClass}>{f.label} ({f.name})</option>
                                  ))}
                                  {vlookupEditFields.length === 0 && vl.targetKeyField && (
                                    <option value={vl.targetKeyField} className={optionClass}>{vl.targetKeyFieldLabel || vl.targetKeyField}</option>
                                  )}
                                </select>
                              </div>
                              <div>
                                <label className={`text-[10px] ${labelXsClass} block mb-0.5`}>取得する項目</label>
                                <select
                                  value={vl.targetValueField}
                                  onChange={(e) => {
                                    const field = vlookupEditFields.find(f => f.name === e.target.value);
                                    handleUpdateVlookup(vl.id, { targetValueField: e.target.value, targetValueFieldLabel: field?.label || '' });
                                  }}
                                  className={`w-full ${inputClass} rounded px-2 py-1 text-xs`}
                                >
                                  <option value="" className={optionClass}>選択...</option>
                                  {vlookupEditFields.map(f => (
                                    <option key={f.name} value={f.name} className={optionClass}>{f.label} ({f.name})</option>
                                  ))}
                                  {vlookupEditFields.length === 0 && vl.targetValueField && (
                                    <option value={vl.targetValueField} className={optionClass}>{vl.targetValueFieldLabel || vl.targetValueField}</option>
                                  )}
                                </select>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className={`text-[10px] ${labelXsClass} block mb-0.5`}>ソース側キー項目</label>
                                <select
                                  value={vl.localKeyField}
                                  onChange={(e) => {
                                    const label = fieldMetadata[e.target.value] || e.target.value;
                                    handleUpdateVlookup(vl.id, { localKeyField: e.target.value, localKeyFieldLabel: label });
                                  }}
                                  className={`w-full ${inputClass} rounded px-2 py-1 text-xs`}
                                >
                                  <option value="" className={optionClass}>選択...</option>
                                  {selectedFields.map(f => (
                                    <option key={f} value={f} className={optionClass}>{fieldMetadata[f] || f} ({f})</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className={`text-[10px] ${labelXsClass} block mb-0.5`}>出力ラベル</label>
                                <input
                                  type="text"
                                  value={vl.outputLabel}
                                  onChange={(e) => handleUpdateVlookup(vl.id, { outputLabel: e.target.value })}
                                  className={`w-full ${inputClass} rounded px-2 py-1 text-xs`}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 新規VLOOKUP追加フォーム */}
              <div className={`space-y-2 p-2 rounded border ${borderClass}`}>
                <div className={`text-[10px] font-medium ${theme === 'dark' ? 'text-amber-300/80' : 'text-amber-600'}`}>新しいVLOOKUP追加</div>

                {/* 結合先オブジェクト（プルダウン選択） */}
                <div>
                  <label className={`text-[10px] ${labelXsClass} block mb-0.5`}>結合先オブジェクト</label>
                  <select
                    value={vlookupForm.targetObject}
                    onFocus={fetchVlookupObjectList}
                    onChange={(e) => handleVlookupObjectSelect(e.target.value)}
                    className={`w-full ${inputClass} rounded px-2 py-1 text-xs`}
                  >
                    <option value="" className={optionClass}>
                      {vlookupObjectLoading ? '読み込み中...' : 'オブジェクトを選択...'}
                    </option>
                    {vlookupObjectList.map(obj => (
                      <option key={obj.name} value={obj.name} className={optionClass}>
                        {obj.label} ({obj.name})
                      </option>
                    ))}
                  </select>
                  {vlookupDescribing && (
                    <div className={`text-[9px] ${mutedText} mt-0.5 flex items-center gap-1`}>
                      <Loader2 size={8} className="animate-spin" /> フィールド取得中...
                    </div>
                  )}
                </div>

                {/* 結合先フィールド選択（フィールド取得後のみ表示） */}
                {vlookupTargetFields.length > 0 && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={`text-[10px] ${labelXsClass} block mb-0.5`}>結合先キー項目</label>
                        <select
                          value={vlookupForm.targetKeyField}
                          onChange={(e) => {
                            const field = vlookupTargetFields.find(f => f.name === e.target.value);
                            setVlookupForm(prev => ({ ...prev, targetKeyField: e.target.value, targetKeyFieldLabel: field?.label || '' }));
                          }}
                          className={`w-full ${inputClass} rounded px-2 py-1 text-xs`}
                        >
                          <option value="" className={optionClass}>選択...</option>
                          {vlookupTargetFields.map(f => (
                            <option key={f.name} value={f.name} className={optionClass}>{f.label} ({f.name})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={`text-[10px] ${labelXsClass} block mb-0.5`}>取得する項目</label>
                        <select
                          value={vlookupForm.targetValueField}
                          onChange={(e) => {
                            const field = vlookupTargetFields.find(f => f.name === e.target.value);
                            setVlookupForm(prev => ({ ...prev, targetValueField: e.target.value, targetValueFieldLabel: field?.label || '' }));
                          }}
                          className={`w-full ${inputClass} rounded px-2 py-1 text-xs`}
                        >
                          <option value="" className={optionClass}>選択...</option>
                          {vlookupTargetFields.map(f => (
                            <option key={f.name} value={f.name} className={optionClass}>{f.label} ({f.name})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={`text-[10px] ${labelXsClass} block mb-0.5`}>ソース側キー項目</label>
                        <select
                          value={vlookupForm.localKeyField}
                          onChange={(e) => {
                            const label = fieldMetadata[e.target.value] || e.target.value;
                            setVlookupForm(prev => ({ ...prev, localKeyField: e.target.value, localKeyFieldLabel: label }));
                          }}
                          className={`w-full ${inputClass} rounded px-2 py-1 text-xs`}
                        >
                          <option value="" className={optionClass}>選択...</option>
                          {selectedFields.map(f => (
                            <option key={f} value={f} className={optionClass}>{fieldMetadata[f] || f} ({f})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={`text-[10px] ${labelXsClass} block mb-0.5`}>出力ラベル</label>
                        <input
                          type="text"
                          value={vlookupForm.outputLabel}
                          onChange={(e) => setVlookupForm(prev => ({ ...prev, outputLabel: e.target.value }))}
                          className={`w-full ${inputClass} rounded px-2 py-1 text-xs`}
                          placeholder={vlookupForm.targetValueFieldLabel || '例: 商談担当者ID'}
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleAddVlookup}
                      className={`w-full py-1.5 rounded text-xs font-medium transition-colors ${
                        theme === 'dark' ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      <Plus size={12} className="inline mr-1" />
                      VLOOKUP追加
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default SoqlFieldPicker;
