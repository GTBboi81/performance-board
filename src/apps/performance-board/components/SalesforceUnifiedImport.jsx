// src/apps/performance-board/components/SalesforceUnifiedImport.jsx
// 稼働実績一括インポート - 複数ボードのDataTableデータをSFオブジェクトに一括インポート

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Cloud, Search, Upload, Table2, Plus, Trash2, Eye,
  AlertTriangle, Loader2, CheckCircle, X, ChevronDown, Save,
  Database, Users, ArrowRight, RefreshCw,
} from 'lucide-react';
import salesforceApi from '../services/salesforceApi';
import { loadBoardTableData, getBoardTables, getBoardAggConfigs, getTableColumns, resolveAggConfig as resolveAggConfigForColumns } from '../utils/boardDataLoader';
import { fetchBoardData } from '../utils/fetchBoardData';
import { processDataTablePure } from '../utils/processDataTablePure';

const SalesforceUnifiedImport = ({
  theme = 'dark',
  config,
  allDashboards = {},
  sourceCacheByDashboard = {},
  calculatedDataCache = {},
  updateConfig,
  globalApiKey = '',
  registeredObjects = [],
}) => {
  // === スタイル定数 ===
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
  const labelClass = `text-xs font-medium mb-1 block ${mutedClass}`;

  // === 保存済み設定の読み込み ===
  const savedConfig = config?.salesforceUnifiedSync || {};

  // === SF対象レコード設定 ===
  const [sfObjectName, setSfObjectName] = useState(savedConfig.sfObjectApiName || 'CustomObject11__c');
  const [sfDateField, setSfDateField] = useState(savedConfig.sfDateField || '');
  const [sfDateValue, setSfDateValue] = useState(savedConfig.sfDateValue || '');
  const [sfEmployeeField] = useState(savedConfig.sfEmployeeField || 'Field128__c');
  const [sfRecords, setSfRecords] = useState([]);
  const [sfFields, setSfFields] = useState([]);
  const [sfIsDescribing, setSfIsDescribing] = useState(false);
  const [sfIsQuerying, setSfIsQuerying] = useState(false);
  const [sfStatusMessage, setSfStatusMessage] = useState('');

  // === データソース設定 ===
  const [sources, setSources] = useState(() => {
    return (savedConfig.sources || []).map((s, i) => ({
      ...s,
      id: s.id || `src_${i}`,
      columnMappings: s.columnMappings || [],
      processedData: null,
      isLoading: false,
      loadProgress: null,
      combineMetrics: null,
      error: null,
    }));
  });
  const loadControllersRef = useRef(new Map());

  useEffect(() => () => {
    loadControllersRef.current.forEach(controller => controller.abort());
    loadControllersRef.current.clear();
  }, []);

  // === インポート実行 ===
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [importResult, setImportResult] = useState(null);

  // === ボード一覧（IDとname） ===
  const boardOptions = useMemo(() => {
    return Object.entries(allDashboards).map(([id, cfg]) => ({
      id,
      name: cfg.name || id,
    }));
  }, [allDashboards]);

  // === SFオブジェクトdescribe ===
  const handleDescribeSfObject = useCallback(async () => {
    if (!sfObjectName.trim()) return;
    setSfIsDescribing(true);
    setSfStatusMessage('');
    try {
      const result = await salesforceApi.describeObject(sfObjectName.trim());
      const fields = (result.fields || []).map(f => ({
        name: f.name,
        label: f.label,
        type: f.type,
        updateable: f.updateable,
      }));
      setSfFields(fields);

      // 日付フィールド候補を自動検出
      if (!sfDateField) {
        const dateField = fields.find(f =>
          f.name.toLowerCase().includes('date') || f.label.includes('日付')
        );
        if (dateField) setSfDateField(dateField.name);
      }

      setSfStatusMessage(`${fields.length}件のフィールドを取得しました`);
    } catch (err) {
      setSfStatusMessage(`エラー: ${err.message}`);
    } finally {
      setSfIsDescribing(false);
    }
  }, [sfObjectName, sfDateField]);

  // === SFクエリ実行 ===
  const handleQuerySfRecords = useCallback(async () => {
    if (!sfObjectName.trim()) return;
    setSfIsQuerying(true);
    setSfStatusMessage('');
    try {
      // 取得フィールド: Id, 従業員参照, 日付フィールド
      const queryFields = ['Id', sfEmployeeField];
      if (sfDateField && !queryFields.includes(sfDateField)) {
        queryFields.push(sfDateField);
      }
      // 更新対象のフィールドも取得して現在値確認
      const mappedSfFields = new Set();
      sources.forEach(src => {
        (src.columnMappings || []).forEach(m => {
          if (m.enabled && m.sfFieldApiName) mappedSfFields.add(m.sfFieldApiName);
        });
      });
      mappedSfFields.forEach(f => {
        if (!queryFields.includes(f)) queryFields.push(f);
      });

      // 日付フィールドの型判定とWHERE句構築
      const dateFieldInfo = sfFields.find(f => f.name === sfDateField);
      const isDateField = dateFieldInfo?.type === 'date';
      const isDateTimeField = dateFieldInfo?.type === 'datetime';
      let whereClause = '';
      if (sfDateField && sfDateValue) {
        if (isDateField || isDateTimeField) {
          // date/datetime型: クォートなし、厳格なフォーマット検証
          const normalized = sfDateValue.replace(/\//g, '-');
          const datePattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z?)?$/;
          if (!datePattern.test(normalized)) {
            throw new Error('日付の形式が不正です。YYYY-MM-DD または YYYY/MM/DD 形式で入力してください');
          }
          if (isDateTimeField && !normalized.includes('T')) {
            // datetime型で日付のみ入力 → その日の全レコードを範囲検索
            const [y, mo, d] = normalized.split('-').map(Number);
            const nextDay = new Date(Date.UTC(y, mo - 1, d + 1));
            const nextDayStr = nextDay.toISOString().slice(0, 10);
            whereClause = `${sfDateField} >= ${normalized}T00:00:00Z AND ${sfDateField} < ${nextDayStr}T00:00:00Z`;
          } else {
            whereClause = `${sfDateField} = ${normalized}`;
          }
        } else {
          // 文字列型: シングルクォート付き（SOQL注入防止）
          const safeDateValue = sfDateValue.replace(/'/g, "\\'");
          whereClause = `${sfDateField} = '${safeDateValue}'`;
        }
      }

      const result = await salesforceApi.queryRecords(sfObjectName.trim(), queryFields, {
        whereClause,
        limitCount: 5000,
      });

      setSfRecords(result.records || []);
      setSfStatusMessage(`${(result.records || []).length}件のレコードを取得しました`);
    } catch (err) {
      setSfStatusMessage(`クエリエラー: ${err.message}`);
      setSfRecords([]);
    } finally {
      setSfIsQuerying(false);
    }
  }, [sfObjectName, sfEmployeeField, sfDateField, sfDateValue, sfFields, sources]);

  // === ソース追加 ===
  const handleAddSource = useCallback(() => {
    setSources(prev => [...prev, {
      id: `src_${Date.now()}`,
      boardId: '',
      tableId: '',
      aggConfigId: '',
      employeeIdColumnId: '',
      columnMappings: [],
      processedData: null,
      isLoading: false,
      loadProgress: null,
      combineMetrics: null,
      error: null,
    }]);
  }, []);

  // === ソース削除 ===
  const handleRemoveSource = useCallback((sourceId) => {
    loadControllersRef.current.get(sourceId)?.abort();
    loadControllersRef.current.delete(sourceId);
    setSources(prev => prev.filter(s => s.id !== sourceId));
  }, []);

  // === ソース設定更新 ===
  const updateSource = useCallback((sourceId, updates) => {
    setSources(prev => prev.map(s => s.id === sourceId ? { ...s, ...updates } : s));
  }, []);

  // === ソースのデータ読込 ===
  const handleLoadSourceData = useCallback(async (sourceId) => {
    const src = sources.find(s => s.id === sourceId);
    if (!src) return;

    const boardConfig = allDashboards[src.boardId];
    if (!boardConfig) {
      updateSource(sourceId, { error: 'ボードが見つかりません', processedData: null, isLoading: false });
      return;
    }

    // 1. キャッシュから試行（即座に結果が得られる）
    const cacheResult = loadBoardTableData({
      boardConfig,
      tableId: src.tableId,
      aggConfigId: src.aggConfigId,
      calculatedDataCache,
      sourceCacheByDashboard,
      boardId: src.boardId,
    });

    if (!cacheResult.error) {
      // キャッシュヒット - 即座に反映
      const columns = getTableColumns(boardConfig, cacheResult.tableConfig, cacheResult.aggConfig);
      const newMappings = src.columnMappings.length > 0 ? src.columnMappings : columns.map(col => ({
        columnId: col.id,
        columnName: col.name,
        columnType: col.type,
        sfFieldApiName: '',
        enabled: false,
      }));

      updateSource(sourceId, {
        processedData: cacheResult.data,
        error: null,
        isLoading: false,
        loadProgress: null,
        columnMappings: newMappings,
        cacheHash: cacheResult.cacheHash,
        loadedAt: new Date().toLocaleTimeString(),
      });
      return;
    }

    // 2. キャッシュミス（データ未読み込み）→ 自動フェッチ
    if (cacheResult.error.includes('データ未読み込み')) {
      loadControllersRef.current.get(sourceId)?.abort();
      const loadController = new AbortController();
      loadControllersRef.current.set(sourceId, loadController);
      const isCurrentLoad = () => loadControllersRef.current.get(sourceId) === loadController;

      updateSource(sourceId, {
        isLoading: true,
        error: null,
        processedData: null,
        loadProgress: null,
        combineMetrics: null,
      });

      try {
        const { calculatedData, sourceCache, error } = await fetchBoardData({
          boardId: src.boardId,
          boardConfig,
          globalApiKey,
          signal: loadController.signal,
          onProgress: progress => {
            if (isCurrentLoad()) updateSource(sourceId, { loadProgress: progress });
          },
          onMetrics: metrics => {
            if (isCurrentLoad()) updateSource(sourceId, { combineMetrics: metrics });
          },
        });

        if (!isCurrentLoad()) return;
        if (error) {
          updateSource(sourceId, { error, isLoading: false, loadProgress: null });
          return;
        }

        // 取得したデータでprocessDataTablePureを実行
        const dataTables = boardConfig.dataTables || [];
        const tableConfig = dataTables.find(t => t.id === src.tableId);
        if (!tableConfig) {
          updateSource(sourceId, { error: 'テーブル設定が見つかりません', isLoading: false, loadProgress: null });
          return;
        }

        const aggConfig = resolveAggConfigForColumns(boardConfig, src.aggConfigId, tableConfig);

        // sourceExpand有効な集計設定はfetchBoardData経路では非対応
        const sourceExpand = aggConfig?.sourceExpand;
        if (sourceExpand?.enabled && sourceExpand?.sourceId) {
          updateSource(sourceId, {
            error: 'ソース展開モードの集計設定は一括インポートでは未対応です。別の集計設定を選択してください',
            isLoading: false,
            loadProgress: null,
          });
          return;
        }

        const groupByFields = aggConfig?.groupByField
          ? (Array.isArray(aggConfig.groupByField) ? aggConfig.groupByField : [aggConfig.groupByField])
          : [];

        const { processedData } = processDataTablePure({
          allRows: calculatedData,
          systemFields: boardConfig.systemFields || [],
          calculations: boardConfig.calculations || [],
          currentAggConfig: aggConfig,
          groupByFields,
          dateTransforms: aggConfig?.dateTransforms || {},
          sourceCache: sourceCache || {},
          dataSources: boardConfig.dataSources || [],
          activeFilters: {},
          mapping: boardConfig.mapping || {},
        });

        const columns = getTableColumns(boardConfig, tableConfig, aggConfig);
        const newMappings = src.columnMappings.length > 0 ? src.columnMappings : columns.map(col => ({
          columnId: col.id,
          columnName: col.name,
          columnType: col.type,
          sfFieldApiName: '',
          enabled: false,
        }));

        updateSource(sourceId, {
          processedData,
          error: null,
          isLoading: false,
          loadProgress: null,
          columnMappings: newMappings,
          cacheHash: null,
          loadedAt: new Date().toLocaleTimeString(),
        });
      } catch (err) {
        if (!isCurrentLoad()) return;
        if (err?.name === 'AbortError') {
          updateSource(sourceId, { isLoading: false, loadProgress: null, error: null });
        } else {
          updateSource(sourceId, {
            error: `データ取得エラー: ${err.message}`,
            isLoading: false,
            loadProgress: null,
          });
        }
      } finally {
        if (isCurrentLoad()) loadControllersRef.current.delete(sourceId);
      }
      return;
    }

    // 3. その他のエラー（テーブル設定なし等）
    updateSource(sourceId, { error: cacheResult.error, processedData: null, isLoading: false });
  }, [sources, allDashboards, calculatedDataCache, sourceCacheByDashboard, globalApiKey, updateSource]);

  const handleCancelSourceLoad = useCallback((sourceId) => {
    const controller = loadControllersRef.current.get(sourceId);
    if (!controller) return;
    loadControllersRef.current.delete(sourceId);
    controller.abort();
    updateSource(sourceId, { isLoading: false, loadProgress: null, error: null });
  }, [updateSource]);

  // === マージデータのプレビュー ===
  const mergedPreview = useMemo(() => {
    if (!sfRecords.length) return { records: [], unmatchedSf: 0, unmatchedDt: 0, duplicateWarnings: [] };

    // sfMapから空キーを除外
    const sfMap = new Map();
    sfRecords.forEach(r => {
      const key = String(r[sfEmployeeField] || '').trim();
      if (key) sfMap.set(key, r);
    });
    const mergedRecords = [];
    const duplicateWarnings = [];

    // 各ソースのデータをMap化（O(1)ルックアップ用）、空キー除外・重複検出
    const sourceIndexes = sources.map(src => {
      if (!src.processedData || !src.employeeIdColumnId) return null;
      const index = new Map();
      const duplicates = new Set();
      src.processedData.forEach(row => {
        const key = String(row[src.employeeIdColumnId] || '').trim();
        if (!key) return; // 空キーは除外
        if (index.has(key)) {
          duplicates.add(key);
        } else {
          index.set(key, row);
        }
      });
      if (duplicates.size > 0) {
        const boardName = allDashboards[src.boardId]?.name || src.boardId;
        duplicateWarnings.push(`${boardName}: 重複ID ${duplicates.size}件（先頭行を使用）`);
      }
      return { index, src };
    }).filter(Boolean);

    // SFレコードごとにマッチ（空キーのSFレコードはスキップ）
    sfRecords.forEach(sfRec => {
      const sfKey = String(sfRec[sfEmployeeField] || '').trim();
      if (!sfKey) return; // 空の従業員参照はスキップ
      const record = { _sfId: sfRec.Id, _employeeRef: sfKey };
      let matched = false;

      sourceIndexes.forEach(({ index, src }) => {
        const matchRow = index.get(sfKey);
        if (matchRow) {
          matched = true;
          (src.columnMappings || []).filter(m => m.enabled && m.sfFieldApiName).forEach(m => {
            record[m.sfFieldApiName] = matchRow[m.columnId];
          });
        }
      });

      if (matched) {
        mergedRecords.push(record);
      }
    });

    // 未マッチ統計（マッチしたレコード数ベースで計算）
    const sfWithKey = sfRecords.filter(r => String(r[sfEmployeeField] || '').trim()).length;
    const unmatchedSf = sfWithKey - mergedRecords.length;
    let dtKeySet = new Set();
    sources.forEach(src => {
      if (!src.processedData || !src.employeeIdColumnId) return;
      src.processedData.forEach(row => {
        const key = String(row[src.employeeIdColumnId] || '').trim();
        if (key) dtKeySet.add(key);
      });
    });
    const unmatchedDt = Array.from(dtKeySet).filter(k => !sfMap.has(k)).length;

    return { records: mergedRecords, unmatchedSf, unmatchedDt, duplicateWarnings };
  }, [sfRecords, sfEmployeeField, sources, allDashboards]);

  // === マッピング済みSFフィールド一覧（プレビュー用） ===
  const mappedFieldNames = useMemo(() => {
    const names = new Set();
    sources.forEach(src => {
      (src.columnMappings || []).filter(m => m.enabled && m.sfFieldApiName).forEach(m => {
        names.add(m.sfFieldApiName);
      });
    });
    return Array.from(names);
  }, [sources]);

  // === 設定保存 ===
  const handleSaveConfig = useCallback(() => {
    const configToSave = {
      sfObjectApiName: sfObjectName,
      sfDateField,
      sfDateValue,
      sfEmployeeField,
      sources: sources.map(s => ({
        id: s.id,
        boardId: s.boardId,
        tableId: s.tableId,
        aggConfigId: s.aggConfigId,
        employeeIdColumnId: s.employeeIdColumnId,
        columnMappings: s.columnMappings,
      })),
      lastImportAt: savedConfig.lastImportAt,
    };
    updateConfig('salesforceUnifiedSync', configToSave);
    setSfStatusMessage('設定を保存しました');
    setTimeout(() => setSfStatusMessage(''), 3000);
  }, [sfObjectName, sfDateField, sfDateValue, sfEmployeeField, sources, updateConfig, savedConfig.lastImportAt]);

  // === インポート実行 ===
  const handleImport = useCallback(async () => {
    if (!mergedPreview.records.length) return;

    setIsImporting(true);
    setImportResult(null);
    setImportProgress({ current: 0, total: mergedPreview.records.length });

    try {
      // Id をボディに含めつつ externalIdField='Id' で送信
      // PHP側が $record['Id'] からURLを生成し、そのままボディとして送信する
      // SF REST APIは Id を読み取り専用フィールドとして無視する
      const records = mergedPreview.records.map(r => {
        const rec = { Id: r._sfId };
        mappedFieldNames.forEach(f => {
          if (r[f] !== undefined) {
            rec[f] = r[f];
          }
        });
        return rec;
      });

      const result = await salesforceApi.upsertRecords(
        sfObjectName,
        'Id',
        records,
        (progress) => setImportProgress(progress)
      );

      const res = result.result || result;
      setImportResult({
        success: true,
        created: res.created || 0,
        updated: res.updated || 0,
        errors: res.errors || 0,
        errorDetails: res.errorDetails || [],
      });

      // 最終インポート日時を保存
      updateConfig('salesforceUnifiedSync', {
        ...savedConfig,
        sfObjectApiName: sfObjectName,
        sfDateField,
        sfDateValue,
        sfEmployeeField,
        sources: sources.map(s => ({
          id: s.id,
          boardId: s.boardId,
          tableId: s.tableId,
          aggConfigId: s.aggConfigId,
          employeeIdColumnId: s.employeeIdColumnId,
          columnMappings: s.columnMappings,
        })),
        lastImportAt: new Date().toISOString(),
      });
    } catch (err) {
      setImportResult({ success: false, message: err.message });
    } finally {
      setIsImporting(false);
    }
  }, [mergedPreview.records, mappedFieldNames, sfObjectName, updateConfig, savedConfig, sfDateField, sfDateValue, sfEmployeeField, sources]);

  // === 更新可能なSFフィールド（マッピング選択用） ===
  const updateableSfFields = useMemo(() => {
    return sfFields.filter(f => f.updateable && f.name !== 'Id');
  }, [sfFields]);

  return (
    <div className="space-y-6">
      {/* セクション1: SF対象レコード取得 */}
      <div className={cardClass}>
        <div className={`p-4 border-b flex items-center gap-2 ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
          <Database size={16} className="text-indigo-400" />
          <span className={`text-sm font-semibold ${textClass}`}>SF対象レコード取得</span>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>SFオブジェクト</label>
              <div className="flex gap-2">
                {registeredObjects.length > 0 ? (
                  <select
                    value={sfObjectName}
                    onChange={(e) => {
                      const apiName = e.target.value;
                      setSfObjectName(apiName);
                      // 登録済みオブジェクトのキャッシュからフィールドを自動ロード
                      const regObj = registeredObjects.find(o => o.apiName === apiName);
                      if (regObj?.fieldsCache?.length) {
                        const fields = regObj.fieldsCache.map(f => ({
                          name: f.name, label: f.label, type: f.type, updateable: f.updateable,
                        }));
                        setSfFields(fields);
                        if (!sfDateField) {
                          const dateField = fields.find(f =>
                            f.name.toLowerCase().includes('date') || f.label.includes('日付')
                          );
                          if (dateField) setSfDateField(dateField.name);
                        }
                        setSfStatusMessage(`${fields.length}件のフィールドをキャッシュから取得しました`);
                      }
                    }}
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
                    value={sfObjectName}
                    onChange={(e) => setSfObjectName(e.target.value)}
                    placeholder="例: CustomObject11__c"
                    className={`${inputClass} flex-1`}
                  />
                )}
                <button
                  onClick={handleDescribeSfObject}
                  disabled={sfIsDescribing || !sfObjectName.trim()}
                  className={btnPrimaryClass}
                >
                  {sfIsDescribing ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  取得
                </button>
              </div>
            </div>
            <div>
              <label className={labelClass}>従業員参照フィールド</label>
              <input
                type="text"
                value={sfEmployeeField}
                disabled
                className={`${inputClass} w-full opacity-60`}
              />
            </div>
          </div>

          {sfFields.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>条件用日付フィールド</label>
                <select
                  value={sfDateField}
                  onChange={(e) => setSfDateField(e.target.value)}
                  className={`${selectClass} w-full`}
                >
                  <option value="" className={optionClass}>-- 選択 --</option>
                  {sfFields.filter(f => f.type === 'date' || f.type === 'datetime' || f.name.toLowerCase().includes('date') || f.label.includes('日付')).map(f => (
                    <option key={f.name} value={f.name} className={optionClass}>
                      {f.label} ({f.name})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>条件用日付の値</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sfDateValue}
                    onChange={(e) => setSfDateValue(e.target.value)}
                    placeholder="例: 2026/02/01"
                    className={`${inputClass} flex-1`}
                  />
                  <button
                    onClick={handleQuerySfRecords}
                    disabled={sfIsQuerying}
                    className={btnPrimaryClass}
                  >
                    {sfIsQuerying ? <Loader2 size={14} className="animate-spin" /> : <Cloud size={14} />}
                    クエリ実行
                  </button>
                </div>
              </div>
            </div>
          )}

          {sfStatusMessage && (
            <div className={`text-xs flex items-center gap-1 ${
              sfStatusMessage.includes('エラー') ? 'text-rose-400' : theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
            }`}>
              {sfStatusMessage.includes('エラー') ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
              {sfStatusMessage}
            </div>
          )}

          {sfRecords.length > 0 && (
            <div className={`text-xs px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              <Users size={12} className="inline mr-1" />
              {sfRecords.length}件のレコードを取得済み
            </div>
          )}
        </div>
      </div>

      {/* セクション2: データソース設定 */}
      <div className={cardClass}>
        <div className={`p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2">
            <Table2 size={16} className="text-indigo-400" />
            <span className={`text-sm font-semibold ${textClass}`}>データソース設定</span>
          </div>
          <button onClick={handleAddSource} className={btnSecondaryClass}>
            <Plus size={14} />
            ソース追加
          </button>
        </div>
        <div className="p-4 space-y-4">
          {sources.length === 0 && (
            <div className={`text-center py-8 ${mutedClass} text-sm`}>
              「ソース追加」をクリックしてデータソースを設定してください
            </div>
          )}

          {sources.map((source, idx) => (
            <SourceConfigCard
              key={source.id}
              source={source}
              index={idx}
              theme={theme}
              boardOptions={boardOptions}
              allDashboards={allDashboards}
              updateableSfFields={updateableSfFields}
              cardClass={cardClass}
              textClass={textClass}
              mutedClass={mutedClass}
              selectClass={selectClass}
              optionClass={optionClass}
              btnPrimaryClass={btnPrimaryClass}
              labelClass={labelClass}
              onUpdate={updateSource}
              onRemove={handleRemoveSource}
              onLoadData={handleLoadSourceData}
              onCancelLoad={handleCancelSourceLoad}
            />
          ))}
        </div>
      </div>

      {/* セクション3: プレビュー */}
      {mergedPreview.records.length > 0 && (
        <div className={cardClass}>
          <div className={`p-4 border-b flex items-center gap-2 ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
            <Eye size={16} className="text-indigo-400" />
            <span className={`text-sm font-semibold ${textClass}`}>
              プレビュー（{mergedPreview.records.length}件）
            </span>
          </div>
          <div className="p-4">
            {mergedPreview.duplicateWarnings?.length > 0 && (
              <div className={`text-xs mb-3 px-3 py-2 rounded-lg flex items-center gap-2 ${theme === 'dark' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>
                <AlertTriangle size={12} />
                <span>重複キー検出: {mergedPreview.duplicateWarnings.join(' / ')}</span>
              </div>
            )}
            {(mergedPreview.unmatchedSf > 0 || mergedPreview.unmatchedDt > 0) && (
              <div className={`text-xs mb-3 px-3 py-2 rounded-lg flex items-center gap-2 ${theme === 'dark' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                <AlertTriangle size={12} />
                {mergedPreview.unmatchedSf > 0 && `SF未マッチ: ${mergedPreview.unmatchedSf}件`}
                {mergedPreview.unmatchedSf > 0 && mergedPreview.unmatchedDt > 0 && ' / '}
                {mergedPreview.unmatchedDt > 0 && `DataTable未マッチ: ${mergedPreview.unmatchedDt}件`}
              </div>
            )}

            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className={theme === 'dark' ? 'border-b border-white/10' : 'border-b border-gray-200'}>
                    <th className={`text-left px-2 py-1.5 ${mutedClass}`}>従業員Ref</th>
                    {mappedFieldNames.map(f => (
                      <th key={f} className={`text-right px-2 py-1.5 ${mutedClass}`}>
                        {sfFields.find(sf => sf.name === f)?.label || f}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mergedPreview.records.slice(0, 50).map((rec, i) => (
                    <tr key={i} className={theme === 'dark' ? 'border-b border-white/5' : 'border-b border-gray-100'}>
                      <td className={`px-2 py-1.5 ${textClass}`}>{rec._employeeRef}</td>
                      {mappedFieldNames.map(f => (
                        <td key={f} className={`text-right px-2 py-1.5 ${textClass}`}>
                          {rec[f] !== undefined ? (typeof rec[f] === 'number' ? rec[f].toLocaleString() : String(rec[f])) : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {mergedPreview.records.length > 50 && (
              <div className={`text-xs mt-2 ${mutedClass}`}>
                ...他 {mergedPreview.records.length - 50}件
              </div>
            )}
          </div>
        </div>
      )}

      {/* セクション4: 実行 */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSaveConfig}
          className={btnSecondaryClass}
        >
          <Save size={14} />
          設定を保存
        </button>
        <button
          onClick={handleImport}
          disabled={isImporting || !mergedPreview.records.length || !mappedFieldNames.length}
          className={btnPrimaryClass}
        >
          {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          インポート実行（{mergedPreview.records.length}件）
        </button>
      </div>

      {/* インポート進捗 */}
      {importProgress && isImporting && (
        <div className={`text-xs ${mutedClass}`}>
          <div className="flex items-center gap-2">
            <Loader2 size={12} className="animate-spin" />
            {importProgress.current} / {importProgress.total} 処理中...
          </div>
          <div className={`mt-1 h-1.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}>
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* インポート結果 */}
      {importResult && (
        <div className={`p-4 rounded-xl text-sm ${
          importResult.success
            ? theme === 'dark' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            : theme === 'dark' ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' : 'bg-rose-50 border border-rose-200 text-rose-700'
        }`}>
          {importResult.success ? (
            <div className="flex items-center gap-2">
              <CheckCircle size={16} />
              <span>インポート完了 - 作成: {importResult.created}件, 更新: {importResult.updated}件</span>
              {importResult.errors > 0 && <span className="text-rose-400 ml-2">エラー: {importResult.errors}件</span>}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>インポート失敗: {importResult.message}</span>
            </div>
          )}
          {importResult.errorDetails && importResult.errorDetails.length > 0 && (
            <div className="mt-2 text-xs space-y-1">
              {importResult.errorDetails.slice(0, 5).map((e, i) => (
                <div key={i}>{e.message || JSON.stringify(e)}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// === ソース設定カード（子コンポーネント） ===
const SourceConfigCard = ({
  source,
  index,
  theme,
  boardOptions,
  allDashboards,
  updateableSfFields,
  cardClass,
  textClass,
  mutedClass,
  selectClass,
  optionClass,
  btnPrimaryClass,
  labelClass,
  onUpdate,
  onRemove,
  onLoadData,
  onCancelLoad,
}) => {
  const boardConfig = allDashboards[source.boardId];
  const tables = source.boardId ? getBoardTables(boardConfig) : [];
  const aggConfigs = source.boardId && source.tableId
    ? getBoardAggConfigs(boardConfig, source.tableId)
    : [];

  // テーブル変更時に集計設定をリセット
  const handleBoardChange = (boardId) => {
    onUpdate(source.id, {
      boardId,
      tableId: '',
      aggConfigId: '',
      employeeIdColumnId: '',
      columnMappings: [],
      processedData: null,
      error: null,
    });
  };

  const handleTableChange = (tableId) => {
    onUpdate(source.id, {
      tableId,
      aggConfigId: '',
      employeeIdColumnId: '',
      columnMappings: [],
      processedData: null,
      error: null,
    });
  };

  const handleToggleMapping = (columnId, enabled) => {
    const newMappings = source.columnMappings.map(m =>
      m.columnId === columnId ? { ...m, enabled } : m
    );
    onUpdate(source.id, { columnMappings: newMappings });
  };

  const handleSfFieldChange = (columnId, sfFieldApiName) => {
    const newMappings = source.columnMappings.map(m =>
      m.columnId === columnId ? { ...m, sfFieldApiName } : m
    );
    onUpdate(source.id, { columnMappings: newMappings });
  };

  return (
    <div className={`${theme === 'dark' ? 'bg-white/3 border border-white/5' : 'bg-gray-50 border border-gray-100'} rounded-lg p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${textClass}`}>ソース {index + 1}</span>
        <button
          onClick={() => onRemove(source.id)}
          className={`p-1 rounded hover:bg-rose-500/20 text-rose-400 transition-colors`}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>ボード</label>
          <select
            value={source.boardId}
            onChange={(e) => handleBoardChange(e.target.value)}
            className={`${selectClass} w-full`}
            disabled={source.isLoading}
          >
            <option value="" className={optionClass}>-- 選択 --</option>
            {boardOptions.map(b => (
              <option key={b.id} value={b.id} className={optionClass}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>テーブル</label>
          <select
            value={source.tableId}
            onChange={(e) => handleTableChange(e.target.value)}
            className={`${selectClass} w-full`}
            disabled={!source.boardId || source.isLoading}
          >
            <option value="" className={optionClass}>-- 選択 --</option>
            {tables.map(t => (
              <option key={t.id} value={t.id} className={optionClass}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>集計設定</label>
          <select
            value={source.aggConfigId}
            onChange={(e) => onUpdate(source.id, { aggConfigId: e.target.value })}
            className={`${selectClass} w-full`}
            disabled={!source.tableId || source.isLoading}
          >
            <option value="" className={optionClass}>-- デフォルト --</option>
            {aggConfigs.map(a => (
              <option key={a.id} value={a.id} className={optionClass}>
                {a.name}{a.isDefault ? ' (デフォルト)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {source.boardId && source.tableId && (
        <div className="flex items-center gap-3">
          {/* 従業員ID列 */}
          <div className="flex-1">
            <label className={labelClass}>従業員ID列（OBJID列）</label>
            <select
              value={source.employeeIdColumnId}
              onChange={(e) => onUpdate(source.id, { employeeIdColumnId: e.target.value })}
              className={`${selectClass} w-full`}
              disabled={source.isLoading}
            >
              <option value="" className={optionClass}>-- 選択 --</option>
              {source.columnMappings.map(m => (
                <option key={m.columnId} value={m.columnId} className={optionClass}>
                  {m.columnName}
                </option>
              ))}
              {/* processedDataがない場合、テーブル設定から読む */}
              {source.columnMappings.length === 0 && boardConfig && (() => {
                const tc = (boardConfig.dataTables || []).find(t => t.id === source.tableId);
                const ac = resolveAggConfigForColumns(boardConfig, source.aggConfigId, tc);
                const cols = getTableColumns(boardConfig, tc, ac);
                return cols.map(c => (
                  <option key={c.id} value={c.id} className={optionClass}>{c.name}</option>
                ));
              })()}
            </select>
          </div>
          <div className="pt-4">
            {source.isLoading ? (
              <button
                type="button"
                onClick={() => onCancelLoad(source.id)}
                className="flex items-center gap-2 rounded-lg border border-rose-400/40 px-4 py-2 text-sm text-rose-400 transition-colors hover:bg-rose-500/10"
              >
                <X size={14} />
                キャンセル
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onLoadData(source.id)}
                className={btnPrimaryClass}
              >
                <RefreshCw size={14} />
                データ読込
              </button>
            )}
          </div>
        </div>
      )}

      {source.isLoading && source.loadProgress && (
        <div className="space-y-1">
          <div className={`flex items-center justify-between text-xs ${mutedClass}`}>
            <span>{source.loadProgress.stage || 'データ結合中...'}</span>
            <span>{source.loadProgress.percentage || 0}%</span>
          </div>
          <div className={`h-1.5 overflow-hidden rounded-full ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}>
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${source.loadProgress.percentage || 0}%` }}
            />
          </div>
        </div>
      )}

      {source.error && (
        <div className={`text-xs px-3 py-2 rounded-lg flex items-center gap-1 ${theme === 'dark' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
          <AlertTriangle size={12} />
          {source.error}
        </div>
      )}

      {source.processedData && (
        <div className={`text-xs px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          <CheckCircle size={12} className="inline mr-1" />
          {source.processedData.length}行読込済
          {source.loadedAt && <span className={mutedClass}> (読込: {source.loadedAt})</span>}
        </div>
      )}

      {/* マッピング設定 */}
      {source.processedData && updateableSfFields.length > 0 && (
        <div className="space-y-1.5">
          <span className={`text-xs font-medium ${mutedClass}`}>カラムマッピング</span>
          {source.columnMappings.map(mapping => (
            <div key={mapping.columnId} className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer min-w-0 flex-1">
                <input
                  type="checkbox"
                  checked={mapping.enabled}
                  onChange={(e) => handleToggleMapping(mapping.columnId, e.target.checked)}
                  className="rounded border-white/20"
                />
                <span className={`text-xs truncate ${mapping.enabled ? textClass : mutedClass}`}>
                  {mapping.columnName}
                </span>
              </label>
              <ArrowRight size={12} className={mutedClass} />
              <select
                value={mapping.sfFieldApiName}
                onChange={(e) => handleSfFieldChange(mapping.columnId, e.target.value)}
                className={`${selectClass} text-xs flex-1`}
                disabled={!mapping.enabled}
              >
                <option value="" className={optionClass}>-- 未設定 --</option>
                {updateableSfFields.map(f => (
                  <option key={f.name} value={f.name} className={optionClass}>
                    {f.label} ({f.name})
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SalesforceUnifiedImport;
