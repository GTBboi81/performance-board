// src/apps/performance-board/hooks/useColumnReconcile.js
// カラムインデックス自動復旧 + 既存設定のマイグレーション（カラム名補完）

import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * カラム参照（columnIndex）の自動復旧を担当するフック
 *
 * 責務:
 *   1. reconcileColumnIndices: ヘッダー名から columnIndex を再解決（削除/リネーム検出つき）
 *   2. columnWarnings: 壊れたカラム参照の警告リストを保持
 *   3. マイグレーション useEffect: 既存設定に columnName が欠けている場合、ヘッダーから補完
 *
 * @param {object} params
 * @param {object} params.store - グローバルstore（activeId の変化を監視）
 * @param {object} params.safeConfig - 現在のダッシュボード設定
 * @param {object} params.configUpdates - useConfigUpdates の戻り値（updateConfigBatch を呼ぶ）
 * @returns {{ reconcileColumnIndices: Function, columnWarnings: Array, setColumnWarnings: Function }}
 */
export const useColumnReconcile = ({ store, safeConfig, configUpdates }) => {
  const [columnWarnings, setColumnWarnings] = useState([]);

  // マイグレーション useEffect 用の ref（stale closure 防止）
  const safeConfigRef = useRef(safeConfig);
  const configUpdatesRef = useRef(null);
  safeConfigRef.current = safeConfig;
  configUpdatesRef.current = configUpdates;

  // === カラムインデックス自動復旧（ヘッダー名でインデックスを再解決） ===
  const reconcileColumnIndices = useCallback((updatedSources) => {
    const brokenRefs = [];

    // ヘルパー: カラム名からインデックスを再解決（削除検出つき）
    const resolveIdx = (headers, colName, currentIdx, context) => {
      if (!colName) return { idx: currentIdx, changed: false };
      const newIdx = headers.indexOf(colName);
      if (newIdx >= 0) {
        if (newIdx !== currentIdx) return { idx: newIdx, changed: true };
        return { idx: currentIdx, changed: false };
      }
      // カラムが見つからない → 削除/リネームされた
      brokenRefs.push(context);
      return { idx: null, changed: currentIdx !== null };
    };

    // --- 1. マッピングのcolumnIndexを再解決 ---
    const newMapping = { ...safeConfig.mapping };
    let mappingChanged = false;
    Object.keys(newMapping).forEach(fieldId => {
      const mapping = newMapping[fieldId];
      if (mapping.columnName) {
        const source = updatedSources.find(s => s.id === mapping.sourceId);
        if (source) {
          const { idx, changed } = resolveIdx(source.headers, mapping.columnName, mapping.columnIndex,
            { type: 'mapping', fieldId, columnName: mapping.columnName, sourceName: source.name });
          if (changed) {
            newMapping[fieldId] = { ...mapping, columnIndex: idx };
            mappingChanged = true;
          }
        }
      }
    });

    // --- 2. リレーション/条件カウント計算のcolumnIndexを再解決 ---
    const newCalculations = safeConfig.calculations.map(calc => {
      if (calc.type !== 'relation' && calc.type !== 'conditionalCount') return calc;
      const targetSource = updatedSources.find(s => s.id === calc.targetSourceId);
      if (!targetSource) return calc;
      const targetHeaders = targetSource.headers || [];
      const updatedCalc = { ...calc };
      let changed = false;

      // foreignKeyIndex
      if (calc.foreignKeyColumnName) {
        const r = resolveIdx(targetHeaders, calc.foreignKeyColumnName, parseInt(calc.foreignKeyIndex),
          { type: 'calculation', label: calc.label, field: 'foreignKey', columnName: calc.foreignKeyColumnName, sourceName: targetSource.name });
        if (r.changed) { updatedCalc.foreignKeyIndex = r.idx !== null ? String(r.idx) : ''; changed = true; }
      }
      // aggTargetIndex
      if (calc.aggTargetColumnName) {
        const r = resolveIdx(targetHeaders, calc.aggTargetColumnName, parseInt(calc.aggTargetIndex),
          { type: 'calculation', label: calc.label, field: 'aggTarget', columnName: calc.aggTargetColumnName, sourceName: targetSource.name });
        if (r.changed) { updatedCalc.aggTargetIndex = r.idx !== null ? String(r.idx) : ''; changed = true; }
      }
      // dateColumnIndex
      if (calc.dateColumnName) {
        const r = resolveIdx(targetHeaders, calc.dateColumnName, parseInt(calc.dateColumnIndex),
          { type: 'calculation', label: calc.label, field: 'dateColumn', columnName: calc.dateColumnName, sourceName: targetSource.name });
        if (r.changed) { updatedCalc.dateColumnIndex = r.idx !== null ? String(r.idx) : ''; changed = true; }
      }
      // extraDateColumnIndices
      if (calc.extraDateColumnNames?.length > 0) {
        const newIndices = [];
        calc.extraDateColumnNames.forEach(name => {
          const r = resolveIdx(targetHeaders, name, null,
            { type: 'calculation', label: calc.label, field: 'extraDateColumn', columnName: name, sourceName: targetSource.name });
          if (r.idx !== null) newIndices.push(String(r.idx));
        });
        const oldIndices = calc.extraDateColumnIndices || [];
        if (newIndices.length !== oldIndices.length || newIndices.some((v, i) => v !== oldIndices[i])) {
          updatedCalc.extraDateColumnIndices = newIndices;
          changed = true;
        }
      }
      // filterMappings
      if (calc.filterMappingNames && Object.keys(calc.filterMappingNames).length > 0) {
        const existingMappings = calc.filterMappings || {};
        const newMappings = { ...existingMappings };
        let fmChanged = false;
        Object.keys(calc.filterMappingNames).forEach(key => {
          const colName = calc.filterMappingNames[key];
          const r = resolveIdx(targetHeaders, colName, parseInt(existingMappings[key]),
            { type: 'calculation', label: calc.label, field: `filterMapping(${key})`, columnName: colName, sourceName: targetSource.name });
          if (r.changed) { newMappings[key] = r.idx !== null ? String(r.idx) : ''; fmChanged = true; }
        });
        if (fmChanged) { updatedCalc.filterMappings = newMappings; changed = true; }
      }
      // filters
      if (calc.filters && calc.filters.length > 0) {
        const newFilters = calc.filters.map(f => {
          if (f.columnName) {
            const r = resolveIdx(targetHeaders, f.columnName, parseInt(f.colIndex),
              { type: 'calculation', label: calc.label, field: 'filter', columnName: f.columnName, sourceName: targetSource.name });
            if (r.changed) return { ...f, colIndex: r.idx !== null ? String(r.idx) : '' };
          }
          return f;
        });
        if (newFilters.some((f, i) => f !== calc.filters[i])) { updatedCalc.filters = newFilters; changed = true; }
      }
      // conditions
      if (calc.conditions && calc.conditions.length > 0) {
        const newConditions = calc.conditions.map(c => {
          if (c.columnName) {
            const r = resolveIdx(targetHeaders, c.columnName, parseInt(c.columnIndex),
              { type: 'calculation', label: calc.label, field: 'condition', columnName: c.columnName, sourceName: targetSource.name });
            if (r.changed) return { ...c, columnIndex: r.idx !== null ? String(r.idx) : '' };
          }
          return c;
        });
        if (newConditions.some((c, i) => c !== calc.conditions[i])) { updatedCalc.conditions = newConditions; changed = true; }
      }
      // countUnitRules
      if (calc.countUnitRules && calc.countUnitRules.length > 0) {
        const newRules = calc.countUnitRules.map(rule => {
          if (rule.columnName) {
            const r = resolveIdx(targetHeaders, rule.columnName, parseInt(rule.colIndex),
              { type: 'calculation', label: calc.label, field: 'countUnitRule', columnName: rule.columnName, sourceName: targetSource.name });
            if (r.changed) return { ...rule, colIndex: r.idx !== null ? String(r.idx) : '' };
          }
          return rule;
        });
        if (newRules.some((r, i) => r !== calc.countUnitRules[i])) { updatedCalc.countUnitRules = newRules; changed = true; }
      }
      // dateDiffFilter
      if (calc.dateDiffFilter?.enabled) {
        const dd = { ...calc.dateDiffFilter };
        let ddChanged = false;
        if (dd.dateColumnAName) {
          const r = resolveIdx(targetHeaders, dd.dateColumnAName, parseInt(dd.dateColumnA),
            { type: 'calculation', label: calc.label, field: 'dateDiffA', columnName: dd.dateColumnAName, sourceName: targetSource.name });
          if (r.changed) { dd.dateColumnA = r.idx !== null ? String(r.idx) : ''; ddChanged = true; }
        }
        if (!dd.useToday && dd.dateColumnBName) {
          const r = resolveIdx(targetHeaders, dd.dateColumnBName, parseInt(dd.dateColumnB),
            { type: 'calculation', label: calc.label, field: 'dateDiffB', columnName: dd.dateColumnBName, sourceName: targetSource.name });
          if (r.changed) { dd.dateColumnB = r.idx !== null ? String(r.idx) : ''; ddChanged = true; }
        }
        if (ddChanged) { updatedCalc.dateDiffFilter = dd; changed = true; }
      }
      return changed ? updatedCalc : calc;
    });
    const calculationsChanged = newCalculations.some((c, i) => c !== safeConfig.calculations[i]);

    // --- 3. ソースレベル参照（keyColumn, dateColumn, pivotSettings）を再解決 ---
    let sourcesChanged = false;
    const reconciledSources = updatedSources.map(src => {
      const updated = { ...src };
      let changed = false;
      if (src.keyColumnName && src.headers.length > 0) {
        const r = resolveIdx(src.headers, src.keyColumnName, src.keyColumnIndex,
          { type: 'sourceKey', sourceName: src.name, columnName: src.keyColumnName });
        if (r.changed) { updated.keyColumnIndex = r.idx; changed = true; }
      }
      if (src.dateColumnName && src.headers.length > 0) {
        const r = resolveIdx(src.headers, src.dateColumnName, src.dateColumnIndex,
          { type: 'sourceDate', sourceName: src.name, columnName: src.dateColumnName });
        if (r.changed) { updated.dateColumnIndex = r.idx; changed = true; }
      }
      if (src.pivotSettings) {
        const ps = { ...src.pivotSettings };
        let psChanged = false;
        if (ps.labelColumnName && src.headers.length > 0) {
          const r = resolveIdx(src.headers, ps.labelColumnName, ps.labelColumnIndex,
            { type: 'pivotLabel', sourceName: src.name, columnName: ps.labelColumnName });
          if (r.changed) { ps.labelColumnIndex = r.idx; psChanged = true; }
        }
        if (ps.valueColumnName && src.headers.length > 0) {
          const r = resolveIdx(src.headers, ps.valueColumnName, ps.valueColumnIndex,
            { type: 'pivotValue', sourceName: src.name, columnName: ps.valueColumnName });
          if (r.changed) { ps.valueColumnIndex = r.idx; psChanged = true; }
        }
        if (psChanged) { updated.pivotSettings = ps; changed = true; }
      }
      if (changed) sourcesChanged = true;
      return changed ? updated : src;
    });

    // --- 4. mainKey を再解決 ---
    let mainKeyChanged = false;
    let newMainKey = safeConfig.mainKey;
    if (safeConfig.mainKey?.columnName) {
      const mkSource = updatedSources.find(s => s.id === safeConfig.mainKey.sourceId);
      if (mkSource) {
        const r = resolveIdx(mkSource.headers, safeConfig.mainKey.columnName, parseInt(safeConfig.mainKey.columnIndex),
          { type: 'mainKey', columnName: safeConfig.mainKey.columnName, sourceName: mkSource.name });
        if (r.changed) {
          newMainKey = { ...safeConfig.mainKey, columnIndex: r.idx !== null ? String(r.idx) : '' };
          mainKeyChanged = true;
        }
      }
    }

    // --- 5. aggregationConfigs の pivotDateColumnIndex / pivotCountColumns を再解決 ---
    let aggChanged = false;
    const newAggConfigs = (safeConfig.aggregationConfigs || []).map(agg => {
      if (!agg.pivotSourceId) return agg;
      const aggSource = updatedSources.find(s => s.id === agg.pivotSourceId);
      if (!aggSource) return agg;
      const aggHeaders = aggSource.headers || [];
      const updatedAgg = { ...agg };
      let changed = false;

      // pivotDateColumnIndex
      if (agg.pivotDateColumnName) {
        const r = resolveIdx(aggHeaders, agg.pivotDateColumnName, parseInt(agg.pivotDateColumnIndex),
          { type: 'aggregation', label: agg.label || agg.id, field: 'pivotDateColumn', columnName: agg.pivotDateColumnName, sourceName: aggSource.name });
        if (r.changed) { updatedAgg.pivotDateColumnIndex = r.idx !== null ? String(r.idx) : ''; changed = true; }
      }

      // pivotCountColumns
      if (agg.pivotCountColumns?.length > 0) {
        const newCols = agg.pivotCountColumns.map(col => {
          if (!col.columnName) return col;
          const r = resolveIdx(aggHeaders, col.columnName, col.columnIndex,
            { type: 'aggregation', label: agg.label || agg.id, field: 'pivotCountColumn', columnName: col.columnName, sourceName: aggSource.name });
          if (r.changed) return { ...col, columnIndex: r.idx };
          return col;
        });
        if (newCols.some((c, i) => c !== agg.pivotCountColumns[i])) {
          updatedAgg.pivotCountColumns = newCols;
          changed = true;
        }
      }

      if (changed) aggChanged = true;
      return changed ? updatedAgg : agg;
    });

    // --- 一括保存（ヘッダー更新+インデックス復旧をアトミックに保存） ---
    const updates = {};
    // dataSources は常に含める（ヘッダー変更 + ソースレベル復旧を一括保存）
    updates.dataSources = sourcesChanged ? reconciledSources : updatedSources;
    if (mappingChanged) updates.mapping = newMapping;
    if (calculationsChanged) updates.calculations = newCalculations;
    if (mainKeyChanged) updates.mainKey = newMainKey;
    if (aggChanged) updates.aggregationConfigs = newAggConfigs;
    configUpdates.updateConfigBatch(updates);

    // 警告を設定
    setColumnWarnings(brokenRefs);
    // 更新済みconfigを返す（fetchData内で同期的にcombineSourceDataに渡すため）
    return {
      brokenRefs,
      reconciledConfig: {
        dataSources: sourcesChanged ? reconciledSources : updatedSources,
        ...(mappingChanged ? { mapping: newMapping } : {}),
        ...(calculationsChanged ? { calculations: newCalculations } : {}),
        ...(mainKeyChanged ? { mainKey: newMainKey } : {}),
        ...(aggChanged ? { aggregationConfigs: newAggConfigs } : {}),
      },
    };
  }, [safeConfig.mapping, safeConfig.calculations, safeConfig.mainKey, safeConfig.aggregationConfigs, configUpdates]);

  // === マイグレーション: 既存設定にカラム名がない場合、ヘッダーから補完 ===
  useEffect(() => {
    if (!store || !store.activeId) return;
    // ref経由で最新のconfig/configUpdatesを読む（stale closure防止）
    const cfg = safeConfigRef.current;
    const cfgUpdates = configUpdatesRef.current;
    if (!cfg?.dataSources || !cfgUpdates) return;

    const updates = {};
    let changed = false;

    // ソースレベルのカラム名補完
    const migratedSources = cfg.dataSources.map(src => {
      const updated = { ...src };
      let srcChanged = false;
      if (src.keyColumnIndex != null && !src.keyColumnName && src.headers?.[src.keyColumnIndex]) {
        updated.keyColumnName = src.headers[src.keyColumnIndex];
        srcChanged = true;
      }
      if (src.dateColumnIndex != null && !src.dateColumnName && src.headers?.[src.dateColumnIndex]) {
        updated.dateColumnName = src.headers[src.dateColumnIndex];
        srcChanged = true;
      }
      if (src.pivotSettings) {
        const ps = { ...src.pivotSettings };
        let psChanged = false;
        if (ps.labelColumnIndex != null && !ps.labelColumnName && src.headers?.[ps.labelColumnIndex]) {
          ps.labelColumnName = src.headers[ps.labelColumnIndex];
          psChanged = true;
        }
        if (ps.valueColumnIndex != null && !ps.valueColumnName && src.headers?.[ps.valueColumnIndex]) {
          ps.valueColumnName = src.headers[ps.valueColumnIndex];
          psChanged = true;
        }
        if (psChanged) { updated.pivotSettings = ps; srcChanged = true; }
      }
      if (srcChanged) changed = true;
      return srcChanged ? updated : src;
    });
    if (changed) updates.dataSources = migratedSources;

    // mapping のカラム名補完
    if (cfg.mapping) {
      const newMapping = { ...cfg.mapping };
      let mappingChanged = false;
      Object.keys(newMapping).forEach(fieldId => {
        const m = newMapping[fieldId];
        if (m.columnIndex != null && !m.columnName) {
          const src = (changed ? migratedSources : cfg.dataSources).find(s => s.id === m.sourceId);
          if (src?.headers?.[m.columnIndex]) {
            newMapping[fieldId] = { ...m, columnName: src.headers[m.columnIndex] };
            mappingChanged = true;
          }
        }
      });
      if (mappingChanged) { updates.mapping = newMapping; changed = true; }
    }

    // mainKey のカラム名補完
    if (cfg.mainKey?.columnIndex != null && cfg.mainKey.columnIndex !== '' && !cfg.mainKey.columnName) {
      const src = (updates.dataSources || cfg.dataSources).find(s => s.id === cfg.mainKey.sourceId);
      if (src?.headers?.[parseInt(cfg.mainKey.columnIndex)]) {
        updates.mainKey = { ...cfg.mainKey, columnName: src.headers[parseInt(cfg.mainKey.columnIndex)] };
        changed = true;
      }
    }

    // calculations のカラム名補完（columnName が空のフィールドにヘッダーから補完）
    if (cfg.calculations?.length > 0) {
      const sources = updates.dataSources || cfg.dataSources;
      const newCalcs = cfg.calculations.map(calc => {
        if (calc.type !== 'relation' && calc.type !== 'conditionalCount') return calc;
        const src = sources.find(s => s.id === calc.targetSourceId);
        if (!src?.headers) return calc;
        const h = src.headers;
        const u = { ...calc };
        let c = false;
        // foreignKeyIndex
        if (!u.foreignKeyColumnName && u.foreignKeyIndex !== '' && u.foreignKeyIndex != null) {
          const name = h[parseInt(u.foreignKeyIndex)];
          if (name) { u.foreignKeyColumnName = name; c = true; }
        }
        // aggTargetIndex
        if (!u.aggTargetColumnName && u.aggTargetIndex !== '' && u.aggTargetIndex != null) {
          const name = h[parseInt(u.aggTargetIndex)];
          if (name) { u.aggTargetColumnName = name; c = true; }
        }
        // dateColumnIndex
        if (!u.dateColumnName && u.dateColumnIndex !== '' && u.dateColumnIndex != null) {
          const name = h[parseInt(u.dateColumnIndex)];
          if (name) { u.dateColumnName = name; c = true; }
        }
        // extraDateColumnIndices
        if (u.extraDateColumnIndices?.length > 0 && (!u.extraDateColumnNames || u.extraDateColumnNames.length === 0)) {
          u.extraDateColumnNames = u.extraDateColumnIndices.map(idx => h[parseInt(idx)] || '');
          c = true;
        }
        // filterMappings
        if (u.filterMappings && Object.keys(u.filterMappings).length > 0 && (!u.filterMappingNames || Object.keys(u.filterMappingNames).length === 0)) {
          u.filterMappingNames = {};
          Object.keys(u.filterMappings).forEach(key => {
            const idx = u.filterMappings[key];
            if (idx !== '' && idx != null) u.filterMappingNames[key] = h[parseInt(idx)] || '';
          });
          c = true;
        }
        // filters
        if (u.filters?.length > 0) {
          const newFilters = u.filters.map(f => {
            if (!f.columnName && f.colIndex !== '' && f.colIndex != null) {
              const name = h[parseInt(f.colIndex)];
              if (name) return { ...f, columnName: name };
            }
            return f;
          });
          if (newFilters.some((f, i) => f !== u.filters[i])) { u.filters = newFilters; c = true; }
        }
        // conditions
        if (u.conditions?.length > 0) {
          const newConds = u.conditions.map(cond => {
            if (!cond.columnName && cond.columnIndex !== '' && cond.columnIndex != null) {
              const name = h[parseInt(cond.columnIndex)];
              if (name) return { ...cond, columnName: name };
            }
            return cond;
          });
          if (newConds.some((co, i) => co !== u.conditions[i])) { u.conditions = newConds; c = true; }
        }
        // countUnitRules
        if (u.countUnitRules?.length > 0) {
          const newRules = u.countUnitRules.map(rule => {
            if (!rule.columnName && rule.colIndex !== '' && rule.colIndex != null) {
              const name = h[parseInt(rule.colIndex)];
              if (name) return { ...rule, columnName: name };
            }
            return rule;
          });
          if (newRules.some((r, i) => r !== u.countUnitRules[i])) { u.countUnitRules = newRules; c = true; }
        }
        // dateDiffFilter
        if (u.dateDiffFilter?.enabled) {
          const dd = { ...u.dateDiffFilter };
          let ddc = false;
          if (!dd.dateColumnAName && dd.dateColumnA !== '' && dd.dateColumnA != null) {
            const name = h[parseInt(dd.dateColumnA)];
            if (name) { dd.dateColumnAName = name; ddc = true; }
          }
          if (!dd.useToday && !dd.dateColumnBName && dd.dateColumnB !== '' && dd.dateColumnB != null) {
            const name = h[parseInt(dd.dateColumnB)];
            if (name) { dd.dateColumnBName = name; ddc = true; }
          }
          if (ddc) { u.dateDiffFilter = dd; c = true; }
        }
        return c ? u : calc;
      });
      if (newCalcs.some((c, i) => c !== cfg.calculations[i])) {
        updates.calculations = newCalcs;
        changed = true;
      }
    }

    if (changed) {
      cfgUpdates.updateConfigBatch(updates);
    }
  }, [store?.activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    reconcileColumnIndices,
    columnWarnings,
    setColumnWarnings,
  };
};
