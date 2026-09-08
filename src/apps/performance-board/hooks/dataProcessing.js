// src/apps/performance-board/hooks/dataProcessing.js
// fetchData内のデータ結合・集約ロジック（純粋関数モジュール）

import { normalizeDate } from '../../../utils/dateUtils';
import { formatDate, getDefaultDateFilter } from '../utils/dateFilters';

/**
 * vlookupカラムの値をnewRowに直接注入する
 * @param {Object} newRow - 構築中の行オブジェクト
 * @param {Array} srcRow - ソース行（配列）
 * @param {Object} sourceConfig - ソース設定（vlookups, headers を含む）
 */
function injectVlookupValues(newRow, srcRow, sourceConfig, safeConfig) {
  if (!sourceConfig?.vlookups?.length || !srcRow) return;
  const headers = sourceConfig.headers || [];
  for (const vl of sourceConfig.vlookups) {
    const label = vl.outputLabel || `${vl.targetObjectLabel || vl.targetObject}.${vl.targetValueField}`;
    const ci = headers.indexOf(label);
    if (ci < 0) continue;
    const val = srcRow[ci] ?? '';
    newRow[`vlookup_${vl.id}`] = val;
    if (safeConfig?.systemFields) {
      for (const f of safeConfig.systemFields) {
        if (f.label === label) { newRow[f.id] = val; continue; }
        const m = safeConfig.mapping?.[f.id];
        if (m && m.sourceId === sourceConfig.id && (m.columnName === label || headers[m.columnIndex] === label)) newRow[f.id] = val;
      }
    }
  }
}

/**
 * mapping.columnIndexが不正(-1/null)の場合、columnNameからheadersを検索して解決する
 */
function resolveColIdx(mapping, safeConfig) {
  const colIdx = mapping.columnIndex;
  if (colIdx != null && colIdx >= 0) return colIdx;
  if (!mapping.columnName) return colIdx;
  const src = (safeConfig.dataSources || []).find(s => s.id === mapping.sourceId);
  return src?.headers ? src.headers.indexOf(mapping.columnName) : colIdx;
}

/**
 * 開始日〜終了日の全カレンダー日付を生成（YYYY/MM/DD形式）
 */
function generateDateRange(startStr, endStr) {
  const dates = [];
  const [sy, sm, sd] = startStr.split('/').map(Number);
  const [ey, em, ed] = endStr.split('/').map(Number);
  const current = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  while (current <= end) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    dates.push(`${y}/${m}/${d}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * ソースIDの解決（空データフォールバック付き）
 */
function resolveSourceId(sourceId, finalDataMap, dataSources) {
  let effectiveId = sourceId;

  // 設定済みの内部IDを解決
  if (!finalDataMap[effectiveId]) {
    const match = dataSources.find(s => s.id === effectiveId);
    if (match) effectiveId = match.id;
  }

  // 空配列の場合もフォールバック
  if (!finalDataMap[effectiveId] || finalDataMap[effectiveId].length === 0) {
    const available = Object.keys(finalDataMap).find(k => finalDataMap[k]?.length > 0);
    if (available) effectiveId = available;
  }

  return effectiveId;
}

/**
 * ソース設定を取得（フォールバック付き）
 */
function getSourceConfig(sourceId, dataSources) {
  return dataSources.find(s => s.id === sourceId) || dataSources[0] || null;
}

/**
 * 他ソースのキーマップを構築
 */
function buildOtherSourceMaps(dataSources, excludeSourceId, finalDataMap) {
  const otherSources = dataSources.filter(s => s.id !== excludeSourceId);
  return otherSources.map(src => {
    const map = new Map();
    const srcKeyIdx = src.keyColumnIndex;
    if (srcKeyIdx !== null && srcKeyIdx !== undefined) {
      (finalDataMap[src.id] || []).forEach(row => {
        const key = row[srcKeyIdx];
        if (key) map.set(key, row);
      });
    }
    return { id: src.id, map };
  });
}

/**
 * SOURCEモード: 集約あり（日付×ID）
 */
function processSourceModeAggregated(sourceRows, effectiveSourceId, safeConfig, finalDataMap) {
  const todayStr = formatDate(new Date());
  const sourceConfig = getSourceConfig(effectiveSourceId, safeConfig.dataSources);
  const keyIdx = sourceConfig?.keyColumnIndex;
  const dateIdx = sourceConfig?.dateColumnIndex;

  const dateIdPairs = new Map();
  sourceRows.forEach(row => {
    const dateVal = normalizeDate(row[dateIdx]);
    const keyVal = row[keyIdx];
    if (!dateVal || !keyVal || dateVal > todayStr) return;

    const pairKey = `${dateVal}|${keyVal}`;
    if (!dateIdPairs.has(pairKey)) {
      dateIdPairs.set(pairKey, { date: dateVal, id: keyVal, rows: [] });
    }
    dateIdPairs.get(pairKey).rows.push(row);
  });

  const otherSources = safeConfig.dataSources.filter(s => s.id !== effectiveSourceId);
  const otherSourceMaps = {};
  otherSources.forEach(src => {
    const srcKeyIdx = src.keyColumnIndex;
    const rows = finalDataMap[src.id] || [];
    if (srcKeyIdx !== null && srcKeyIdx !== undefined && rows.length > 0) {
      const map = new Map();
      rows.forEach(r => {
        const key = r[srcKeyIdx];
        if (key && !map.has(key)) map.set(key, r);
      });
      otherSourceMaps[src.id] = map;
    }
  });

  return Array.from(dateIdPairs.values()).map((pair, rowIndex) => {
    const newRow = { _rowIndex: rowIndex, date: pair.date, id: pair.id };

    safeConfig.systemFields.forEach(field => {
      if (field.id === 'date') { newRow.date = pair.date; return; }
      if (field.id === 'id') { newRow.id = pair.id; return; }

      const mapping = safeConfig.mapping[field.id];
      if (!mapping) return;

      const mappingSourceId = mapping.sourceId;
      const colIdx = resolveColIdx(mapping, safeConfig);

      if (mappingSourceId === effectiveSourceId || !mappingSourceId) {
        if (field.type === 'number') {
          newRow[field.id] = pair.rows.reduce((sum, r) => {
            const v = parseFloat(String(r[colIdx]).replace(/,/g, ''));
            return sum + (isNaN(v) ? 0 : v);
          }, 0);
        } else {
          newRow[field.id] = pair.rows[0]?.[colIdx] || '';
        }
        return;
      }

      if (otherSourceMaps[mappingSourceId] && otherSourceMaps[mappingSourceId].has(pair.id)) {
        const otherRow = otherSourceMaps[mappingSourceId].get(pair.id);
        let val = otherRow[colIdx];
        if (field.type === 'number') val = parseFloat(String(val).replace(/,/g, '')) || 0;
        newRow[field.id] = val;
        return;
      }

      newRow[field.id] = field.type === 'number' ? 0 : '';
    });

    injectVlookupValues(newRow, pair.rows[0], sourceConfig, safeConfig);

    return newRow;
  });
}

/**
 * SOURCEモード: 集約なし
 */
function processSourceModeNoAggregation(sourceRows, effectiveSourceId, safeConfig, finalDataMap) {
  const sourceConfig = getSourceConfig(effectiveSourceId, safeConfig.dataSources);
  const keyIdx = sourceConfig?.keyColumnIndex;
  const otherSourceMaps = buildOtherSourceMaps(safeConfig.dataSources, effectiveSourceId, finalDataMap);

  return sourceRows.map((row, rowIndex) => {
    const newRow = { _rowIndex: rowIndex };
    if (keyIdx !== null && keyIdx !== undefined) {
      newRow.id = row[keyIdx];
    }

    safeConfig.systemFields.forEach(field => {
      const mapping = safeConfig.mapping[field.id];
      if (mapping) {
        const ci = resolveColIdx(mapping, safeConfig);
        if (ci != null && ci >= 0) {
          let val = row[ci];
          if (field.id === 'date') val = normalizeDate(val);
          if (field.type === 'number') val = parseFloat(String(val).replace(/,/g, '')) || 0;
          newRow[field.id] = val;
        }
      }
    });

    const joinKey = (keyIdx !== null && keyIdx !== undefined) ? row[keyIdx] : null;
    if (joinKey) {
      otherSourceMaps.forEach(sourceMap => {
        const otherRow = sourceMap.map.get(joinKey);
        if (otherRow) {
          safeConfig.systemFields.forEach(field => {
            const mapping = safeConfig.mapping[field.id];
            if (mapping && mapping.sourceId === sourceMap.id) {
              const ci = resolveColIdx(mapping, safeConfig);
              let val = otherRow[ci];
              if (field.type === 'number') val = parseFloat(String(val).replace(/,/g, '')) || 0;
              newRow[field.id] = val;
            }
          });
        }
      });
    }

    injectVlookupValues(newRow, row, sourceConfig, safeConfig);

    return newRow;
  });
}

/**
 * SOURCEモード処理
 */
function processSourceMode(finalDataMap, safeConfig) {
  const dateSettings = safeConfig.dateSettings || {};
  const effectiveSourceId = resolveSourceId(dateSettings.sourceId, finalDataMap, safeConfig.dataSources);

  const sourceRows = finalDataMap[effectiveSourceId] || [];
  const sourceConfig = getSourceConfig(effectiveSourceId, safeConfig.dataSources);
  const keyIdx = sourceConfig?.keyColumnIndex;
  const dateIdx = sourceConfig?.dateColumnIndex;

  const shouldAggregate = keyIdx !== null && keyIdx !== undefined &&
                          dateIdx !== null && dateIdx !== undefined;

  if (shouldAggregate) {
    return processSourceModeAggregated(sourceRows, effectiveSourceId, safeConfig, finalDataMap);
  } else {
    return processSourceModeNoAggregation(sourceRows, effectiveSourceId, safeConfig, finalDataMap);
  }
}

/**
 * SIMPLEモード: 単純行マッピング
 */
function processSimpleMode(finalDataMap, safeConfig) {
  const dateSettings = safeConfig.dateSettings || {};
  let simpleSourceId = dateSettings.simpleConfig?.sourceId ||
                       safeConfig.dataSources[0]?.id;
  simpleSourceId = resolveSourceId(simpleSourceId, finalDataMap, safeConfig.dataSources);

  const sourceRows = finalDataMap[simpleSourceId] || [];
  const sourceConfig = getSourceConfig(simpleSourceId, safeConfig.dataSources);

  if (!sourceRows.length) return [];

  const keyIdx = sourceConfig?.keyColumnIndex;

  return sourceRows.map((row, rowIndex) => {
    const newRow = { _rowIndex: rowIndex };

    if (keyIdx !== null && keyIdx !== undefined) {
      newRow.id = row[keyIdx];
    }

    safeConfig.systemFields.forEach(field => {
      const mapping = safeConfig.mapping[field.id];
      if (mapping) {
        const ci = resolveColIdx(mapping, safeConfig);
        if (ci != null && ci >= 0) {
          let val = row[ci];
          if (field.id === 'date' || field.type === 'date') {
            val = normalizeDate(val);
          }
          if (field.type === 'number') {
            val = parseFloat(String(val).replace(/,/g, '')) || 0;
          }
          newRow[field.id] = val;
        }
      }
    });

    injectVlookupValues(newRow, row, sourceConfig, safeConfig);

    return newRow;
  });
}

/**
 * AUTOモード: フォールバック処理（日付・キー設定がないソース）
 */
function processAutoModeFallback(finalDataMap, safeConfig) {
  let fallbackSourceId = safeConfig.dataSources[0]?.id;
  fallbackSourceId = resolveSourceId(fallbackSourceId, finalDataMap, safeConfig.dataSources);

  const sourceRows = finalDataMap[fallbackSourceId] || [];
  const sourceConfig = getSourceConfig(fallbackSourceId, safeConfig.dataSources);

  if (!sourceRows.length) return [];

  const keyIdx = sourceConfig?.keyColumnIndex;

  return sourceRows.map((row, rowIndex) => {
    const newRow = { _rowIndex: rowIndex };

    if (keyIdx !== null && keyIdx !== undefined) {
      newRow.id = row[keyIdx];
    }

    safeConfig.systemFields.forEach(field => {
      const mapping = safeConfig.mapping[field.id];
      if (mapping) {
        const ci = resolveColIdx(mapping, safeConfig);
        if (ci != null && ci >= 0) {
          let val = row[ci];
          if (field.id === 'date' || field.type === 'date') {
            val = normalizeDate(val);
          }
          if (field.type === 'number') {
            val = parseFloat(String(val).replace(/,/g, '')) || 0;
          }
          newRow[field.id] = val;
        }
      }
    });

    injectVlookupValues(newRow, row, sourceConfig, safeConfig);

    return newRow;
  });
}

/**
 * AUTOモード: 日付×ID統合処理
 */
function processAutoModeIntegration(finalDataMap, safeConfig, sourcesWithDateAndKey) {
  const todayStr = formatDate(new Date());
  const mainKeyConfig = safeConfig.mainKey;
  const mainKeySourceId = mainKeyConfig.sourceId;
  const mainKeySource = safeConfig.dataSources.find(s => s.id === mainKeySourceId);
  const mainKeyIdx = mainKeySource?.keyColumnIndex;

  const dateIdPairs = new Map();
  sourcesWithDateAndKey.forEach(sc => {
    const rows = finalDataMap[sc.id] || [];
    const dateIdx = sc.dateColumnIndex;
    const keyIdx = sc.keyColumnIndex;

    rows.forEach(row => {
      const dateVal = normalizeDate(row[dateIdx]);
      const keyVal = row[keyIdx];
      if (!dateVal || !keyVal) return;

      const pairKey = `${dateVal}|${keyVal}`;
      if (!dateIdPairs.has(pairKey)) {
        dateIdPairs.set(pairKey, { date: dateVal, id: String(keyVal), sources: {} });
      }
      const pair = dateIdPairs.get(pairKey);
      if (!pair.sources[sc.id]) pair.sources[sc.id] = [];
      pair.sources[sc.id].push(row);
    });
  });

  // === 全日付 × 全IDのペアを自動生成 ===
  // 全ソースの日付範囲からカレンダー日付を生成し、全IDとペアを作成
  let minDate = null;
  let maxDate = null;
  const allIds = new Set();

  // メインキーソースに存在するIDセットを構築（不要IDの除外用）
  const mainKeyIds = new Set();
  if (mainKeySourceId && mainKeyIdx !== undefined) {
    (finalDataMap[mainKeySourceId] || []).forEach(row => {
      const keyVal = row[mainKeyIdx];
      if (keyVal) mainKeyIds.add(String(keyVal));
    });
  }

  // 既存dateIdPairsから日付範囲・ID収集（メインキーに存在するIDのみ）
  for (const pair of dateIdPairs.values()) {
    if (mainKeyIds.size > 0 && !mainKeyIds.has(String(pair.id))) continue;
    if (!minDate || pair.date < minDate) minDate = pair.date;
    if (!maxDate || pair.date > maxDate) maxDate = pair.date;
    allIds.add(String(pair.id));
  }

  // sourcesWithDateAndKeyから日付なし行のIDも収集（reshape空日スキップで日付が空の従業員を拾う）
  // メインキーソースに存在するIDのみ追加
  sourcesWithDateAndKey.forEach(sc => {
    (finalDataMap[sc.id] || []).forEach(row => {
      const keyVal = row[sc.keyColumnIndex];
      if (keyVal && (mainKeyIds.size === 0 || mainKeyIds.has(String(keyVal)))) {
        allIds.add(String(keyVal));
      }
    });
  });

  // リレーション/条件カウント対象ソースからも日付範囲・IDを拡張
  const calcsWithDateCol = (safeConfig.calculations || []).filter(
    c => (c.type === 'relation' || c.type === 'conditionalCount') &&
         c.dateColumnIndex !== '' && c.dateColumnIndex !== undefined &&
         c.targetSourceId
  );

  // リレーション/条件カウント対象ソースからIDのみ収集（メインキーに存在するIDだけ）
  calcsWithDateCol.forEach(calc => {
    const targetRows = finalDataMap[calc.targetSourceId] || [];
    const fkIdx = (calc.foreignKeyIndex !== '' && calc.foreignKeyIndex !== undefined)
      ? parseInt(calc.foreignKeyIndex) : 0;

    targetRows.forEach(row => {
      const keyVal = row[fkIdx];
      if (keyVal && (mainKeyIds.size === 0 || mainKeyIds.has(String(keyVal)))) {
        allIds.add(String(keyVal));
      }
    });
  });

  // maxDateをtodayStrでキャップ（メインソースの日付範囲に限定）
  if (maxDate && maxDate > todayStr) maxDate = todayStr;

  // デフォルト日付フィルターでカーテシアン積の日付範囲を制限
  const defaultDateRange = safeConfig.defaultFilters?.dateRange;
  if (defaultDateRange && defaultDateRange !== 'all') {
    const dateFilter = getDefaultDateFilter(defaultDateRange);
    if (dateFilter.date) {
      const filterStart = dateFilter.date.start;
      const filterEnd = dateFilter.date.end;
      if (filterStart && minDate && filterStart > minDate) minDate = filterStart;
      if (filterEnd && maxDate && filterEnd < maxDate) maxDate = filterEnd;
    }
  }

  // 期間内の全日付を生成して全IDとペアを作成
  // 安全上限: 日数×ID数が500,000を超える場合はスキップ（メモリ保護）
  const MAX_PAIRS = 500000;
  if (minDate && maxDate && allIds.size > 0) {
    const allDates = generateDateRange(minDate, maxDate);
    if (allDates.length * allIds.size <= MAX_PAIRS) {
      for (const date of allDates) {
        for (const id of allIds) {
          const pairKey = `${date}|${id}`;
          if (!dateIdPairs.has(pairKey)) {
            dateIdPairs.set(pairKey, { date, id, sources: {} });
          }
        }
      }
    } else {
      console.warn(`[AUTO] 日付×ID生成をスキップ: ${allDates.length}日 × ${allIds.size}ID = ${allDates.length * allIds.size} > ${MAX_PAIRS}`);
    }
  }

  // リレーション指標の日付カラムから不足ペアをピンポイント追加（カーテシアン積とは別に）
  const monthEnd = formatDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));
  calcsWithDateCol.forEach(calc => {
    const targetRows = finalDataMap[calc.targetSourceId] || [];
    const dateColIdx = parseInt(calc.dateColumnIndex);
    const fkIdx = (calc.foreignKeyIndex !== '' && calc.foreignKeyIndex !== undefined)
      ? parseInt(calc.foreignKeyIndex) : 0;
    if (isNaN(dateColIdx)) return;

    // プライマリ + 追加日付カラムの全インデックスを収集
    const allDateColIndices = [dateColIdx];
    if (calc.extraDateColumnIndices?.length > 0) {
      calc.extraDateColumnIndices.forEach(s => {
        const idx = parseInt(s);
        if (!isNaN(idx)) allDateColIndices.push(idx);
      });
    }

    targetRows.forEach(row => {
      const keyVal = row[fkIdx];
      if (!keyVal) return;
      const idStr = String(keyVal);
      if (!allIds.has(idStr)) return; // カーテシアン積対象のIDのみ

      for (const colIdx of allDateColIndices) {
        const dateVal = normalizeDate(row[colIdx]);
        if (!dateVal || dateVal > monthEnd) continue;
        const pairKey = `${dateVal}|${idStr}`;
        if (!dateIdPairs.has(pairKey)) {
          dateIdPairs.set(pairKey, { date: dateVal, id: idStr, sources: {} });
        }
      }
    });
  });

  const mainKeyMap = new Map();
  if (mainKeySourceId && mainKeyIdx !== null && mainKeyIdx !== undefined) {
    const mainKeyRows = finalDataMap[mainKeySourceId] || [];
    mainKeyRows.forEach(row => {
      const key = row[mainKeyIdx] != null ? String(row[mainKeyIdx]) : null;
      if (key && !mainKeyMap.has(key)) mainKeyMap.set(key, row);
    });
  }

  const otherSourceMaps = {};
  safeConfig.dataSources.forEach(sc => {
    if (sourcesWithDateAndKey.some(s => s.id === sc.id)) return;
    if (sc.id === mainKeySourceId) return;
    const scKeyIdx = sc.keyColumnIndex;
    if (scKeyIdx === null || scKeyIdx === undefined) return;
    const map = new Map();
    (finalDataMap[sc.id] || []).forEach(r => {
      const key = r[scKeyIdx] != null ? String(r[scKeyIdx]) : null;
      if (key && !map.has(key)) map.set(key, r);
    });
    otherSourceMaps[sc.id] = map;
  });

  // VLOOKUPソースのキー → 行データ マップ（pair.sourcesにデータがないペア用）
  const vlookupKeyMaps = {};
  safeConfig.dataSources.forEach(src => {
    if (!src.vlookups?.length) return;
    const rows = finalDataMap[src.id] || [];
    const keyIdx = src.keyColumnIndex;
    if (keyIdx == null || !rows.length) return;
    const map = new Map();
    rows.forEach(r => {
      const key = r[keyIdx] != null ? String(r[keyIdx]) : null;
      if (key && !map.has(key)) map.set(key, r);
    });
    vlookupKeyMaps[src.id] = map;
  });

  // mainKeyソースが日付+キーソースに含まれるか判定
  // 含まれる場合、mainKeyMapの行は特定日付のデータなので
  // 数値フィールドのフォールバックに使うと別日付の値がコピーされてしまう
  const mainKeyIsDateKeySource = sourcesWithDateAndKey.some(s => s.id === mainKeySourceId);

  return Array.from(dateIdPairs.values()).map((pair, rowIndex) => {
    const newRow = { _rowIndex: rowIndex, date: pair.date, id: pair.id };

    safeConfig.systemFields.forEach(field => {
      if (field.id === 'date') { newRow.date = pair.date; return; }
      if (field.id === 'id') { newRow.id = pair.id; return; }

      const mapping = safeConfig.mapping[field.id];
      if (!mapping) return;

      const sourceId = mapping.sourceId;
      const colIdx = resolveColIdx(mapping, safeConfig);

      if (pair.sources[sourceId] && pair.sources[sourceId].length > 0) {
        const sourceRows = pair.sources[sourceId];
        if (field.type === 'number') {
          newRow[field.id] = sourceRows.reduce((sum, r) => {
            const v = parseFloat(String(r[colIdx]).replace(/,/g, ''));
            return sum + (isNaN(v) ? 0 : v);
          }, 0);
        } else {
          newRow[field.id] = sourceRows[0][colIdx] || '';
        }
        return;
      }

      if (sourceId === mainKeySourceId && mainKeyMap.has(pair.id)) {
        const mainRow = mainKeyMap.get(pair.id);
        // mainKeyソースが日付+キーソースの場合、数値フィールドはフォールバックしない
        // （別日付の値がコピーされるのを防止。名前・部署等の文字列フィールドのみ許可）
        if (mainKeyIsDateKeySource && field.type === 'number') {
          newRow[field.id] = 0;
          return;
        }
        let val = mainRow[colIdx];
        if (field.type === 'number') val = parseFloat(String(val).replace(/,/g, '')) || 0;
        newRow[field.id] = val;
        return;
      }

      if (otherSourceMaps[sourceId] && otherSourceMaps[sourceId].has(pair.id)) {
        const otherRow = otherSourceMaps[sourceId].get(pair.id);
        let val = otherRow[colIdx];
        if (field.type === 'number') val = parseFloat(String(val).replace(/,/g, '')) || 0;
        newRow[field.id] = val;
        return;
      }

      newRow[field.id] = field.type === 'number' ? 0 : '';
    });

    // vlookupカラム注入
    for (const src of safeConfig.dataSources) {
      if (!src.vlookups?.length) continue;
      const srcRows = pair.sources[src.id];
      if (srcRows?.length > 0) {
        injectVlookupValues(newRow, srcRows[0], src, safeConfig);
      } else if (vlookupKeyMaps[src.id]) {
        // pair にデータがない → キーマップから逆引き注入
        const keyRow = vlookupKeyMaps[src.id].get(pair.id);
        if (keyRow) {
          injectVlookupValues(newRow, keyRow, src, safeConfig);
        }
      }
    }

    return newRow;
  });
}

/**
 * AUTOモード処理
 */
function processAutoMode(finalDataMap, safeConfig) {
  const sourcesWithDateAndKey = safeConfig.dataSources.filter(sc =>
    sc.dateColumnIndex !== null && sc.dateColumnIndex !== undefined &&
    sc.keyColumnIndex !== null && sc.keyColumnIndex !== undefined
  );

  if (sourcesWithDateAndKey.length === 0 && safeConfig.dataSources.length > 0) {
    return processAutoModeFallback(finalDataMap, safeConfig);
  }

  return processAutoModeIntegration(finalDataMap, safeConfig, sourcesWithDateAndKey);
}

/**
 * 結合結果が空の場合に、先頭のデータソースから行を組み立てる。
 */
function buildRowsFromFirstSource(finalDataMap, safeConfig) {
  const firstSourceId = Object.keys(finalDataMap).find(k => finalDataMap[k]?.length > 0);
  if (!firstSourceId) return [];

  const sourceData = finalDataMap[firstSourceId];
  const sourceConfig = safeConfig.dataSources.find(s => s.id === firstSourceId);
  const dateIdx = sourceConfig?.dateColumnIndex;
  const keyIdx = sourceConfig?.keyColumnIndex;
  const headers = sourceConfig?.headers || [];

  return sourceData.map((row, rowIndex) => {
    const newRow = { _rowIndex: rowIndex };

    if (dateIdx !== null && dateIdx !== undefined && row[dateIdx]) {
      newRow.date = normalizeDate(row[dateIdx]);
    }

    if (keyIdx !== null && keyIdx !== undefined && row[keyIdx]) {
      newRow.id = row[keyIdx];
    }

    if (Array.isArray(row)) {
      row.forEach((cellValue, colIndex) => {
        const fieldId = headers[colIndex] ? `col_${colIndex}_${headers[colIndex]}` : `col_${colIndex}`;
        newRow[fieldId] = cellValue;
        if (typeof cellValue === 'string' && /^[\d,.-]+$/.test(cellValue.replace(/,/g, ''))) {
          const num = parseFloat(cellValue.replace(/,/g, ''));
          if (!isNaN(num)) {
            newRow[`${fieldId}_num`] = num;
          }
        }
      });
    }

    return newRow;
  });
}

/**
 * メインエントリーポイント: データソースを結合して行データを生成
 * @param {Object} finalDataMap - ソースID → 行データ配列
 * @param {Object} safeConfig - ダッシュボード設定
 * @returns {Array} combinedRows
 */
export function combineSourceData(finalDataMap, safeConfig) {
  const dateSettings = safeConfig.dateSettings || { type: 'auto' };
  let combinedRows = [];

  if (dateSettings.type === 'source' && dateSettings.sourceId) {
    combinedRows = processSourceMode(finalDataMap, safeConfig);
  } else if (dateSettings.type === 'simple') {
    combinedRows = processSimpleMode(finalDataMap, safeConfig);
  } else {
    combinedRows = processAutoMode(finalDataMap, safeConfig);
  }

  // 結合結果が空なら、先頭ソースの行をそのまま利用する
  if (combinedRows.length === 0 && Object.keys(finalDataMap).length > 0) {
    combinedRows = buildRowsFromFirstSource(finalDataMap, safeConfig);
  }

  return combinedRows;
}
