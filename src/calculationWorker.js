// =========================================
// 計算処理用 Web Worker
// メインスレッドをブロックせずに大量データを処理
// =========================================

// normalizeDate結果をキャッシュ
const normalizeDateCache = new Map();
const normalizeDate = (val) => {
  if (!val) return "";

  const cached = normalizeDateCache.get(val);
  if (cached !== undefined) return cached;

  let str = String(val).trim();

  // タイムスタンプ部分を除去（ISO形式対応）
  if (str.includes('T')) {
    str = str.split('T')[0];
  }

  str = str.replace(/[\.\-]/g, '/');
  const parts = str.split('/');
  let result;
  if (parts.length === 3) {
    const y = parts[0];
    const m = parts[1].padStart(2, '0');
    const d = parts[2].padStart(2, '0');
    result = `${y}/${m}/${d}`;
  } else {
    result = str;
  }

  if (normalizeDateCache.size < 10000) {
    normalizeDateCache.set(val, result);
  }

  return result;
};

// 算術計算を適用する関数
const applyArithmetic = (row, calc) => {
  let res = 0;
  if (calc.terms && calc.terms.length > 0) {
    res = row[calc.terms[0].field] || 0;
    for (let i = 1; i < calc.terms.length; i++) {
      const term = calc.terms[i];
      const val = row[term.field] || 0;
      if (term.operator === '+') res += val;
      else if (term.operator === '-') res -= val;
      else if (term.operator === '*') res *= val;
      else if (term.operator === '/') res = val !== 0 ? res / val : 0;
    }
  } else {
    const a = row[calc.fieldA] || 0;
    const b = row[calc.fieldB] || 0;
    if (calc.operator === '+') res = a + b;
    else if (calc.operator === '-') res = a - b;
    else if (calc.operator === '*') res = a * b;
    else if (calc.operator === '/') res = b !== 0 ? a / b : 0;
  }

  const decimals = calc.decimals ?? (calc.format === 'percent' ? 2 : 2);
  if (calc.format === 'percent') return parseFloat((res * 100).toFixed(decimals));
  else if (calc.format === 'integer') return Math.round(res);
  else return parseFloat(res.toFixed(decimals));
};

// 月の2日と末日を算出するヘルパー
const getMonthBounds = (year, month) => {
  const y = year;
  const m = String(month).padStart(2, '0');
  const lastDay = new Date(y, month, 0).getDate();
  return {
    first: `${y}/${m}/01`,
    second: `${y}/${m}/02`,
    last: `${y}/${m}/${String(lastDay).padStart(2, '0')}`
  };
};

// 日付レンジ算出ヘルパー（dateFilter の月に連動）
const getDateRanges = (activeFilters) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yd = `${yesterday.getFullYear()}/${String(yesterday.getMonth() + 1).padStart(2, '0')}/${String(yesterday.getDate()).padStart(2, '0')}`;
  const today = `${y}/${m}/${d}`;

  // dateFilter の範囲から対象月を算出（跨ぎ対応）
  const dateFilter = activeFilters?.date;
  const filterStart = dateFilter?.start ? normalizeDate(dateFilter.start) : null;
  const filterEnd = dateFilter?.end ? normalizeDate(dateFilter.end) : null;

  let monthStart, monthEnd;
  if (filterStart && filterEnd) {
    // フィルター開始月の1日 〜 フィルター終了月の末日
    const sp = filterStart.split('/');
    const ep = filterEnd.split('/');
    const startBounds = getMonthBounds(parseInt(sp[0]), parseInt(sp[1]));
    const endBounds = getMonthBounds(parseInt(ep[0]), parseInt(ep[1]));
    monthStart = startBounds;
    monthEnd = endBounds;
  } else {
    // フィルターなし → 全通過（null で条件無効化）
    return {
      thisMonth2ndToEnd: null,
      thisMonth2ndToToday: null,
      thisMonth2ndToYesterday: null,
      thisMonth: null,
      thisMonth1stToYesterday: null,
    };
  }

  return {
    thisMonth2ndToEnd: { start: monthStart.second, end: monthEnd.last },
    thisMonth2ndToToday: { start: monthStart.second, end: today },
    thisMonth2ndToYesterday: { start: monthStart.second, end: yd },
    thisMonth: { start: monthStart.first, end: monthEnd.last },
    thisMonth1stToYesterday: { start: monthStart.first, end: yd },
  };
};
// 後方互換
const getThisMonth2ndToEndRange = () => getDateRanges(null).thisMonth2ndToEnd;

// シリアライズされたsourceIndicesをMapに再構築
const deserializeSourceIndices = (serialized) => {
  const result = {};
  for (const [sourceId, entries] of Object.entries(serialized)) {
    result[sourceId] = new Map(entries);
  }
  return result;
};

// メインの計算処理
self.onmessage = function(e) {
  const { rawData, serializedSourceIndices, calculations, activeFilters, chunkSize = 1000 } = e.data;

  // sourceIndicesをMapに再構築
  const sourceIndices = deserializeSourceIndices(serializedSourceIndices);

  // 日付レンジを処理開始時に1回だけ算出（dateFilterの月に連動）
  const dateRanges = getDateRanges(activeFilters);
  const thisMonth2ndRange = dateRanges.thisMonth2ndToEnd;

  const startTime = performance.now();
  const totalRows = rawData.length;
  const result = [];

  // 計算がない場合はそのまま返す
  if (!calculations || calculations.length === 0) {
    self.postMessage({ type: 'complete', data: rawData, time: 0 });
    return;
  }

  // 計算順序: 固定値 → リレーション(LOOKUP先行) → 条件カウント → 四則演算
  const constantCalcs = calculations.filter(c => c.type === 'constant');
  const relationCalcs = calculations.filter(c => c.type === 'relation');
  // LOOKUP型を先に実行（後続のrelationでLOOKUP結果をキーとして使えるようにする）
  relationCalcs.sort((a, b) => (a.aggType === 'lookup' ? -1 : 0) - (b.aggType === 'lookup' ? -1 : 0));
  const conditionalCountCalcs = calculations.filter(c => c.type === 'conditionalCount');
  const arithmeticCalcs = calculations.filter(c => c.type === 'arithmetic');
  const orderedCalcs = [...constantCalcs, ...relationCalcs, ...conditionalCountCalcs, ...arithmeticCalcs];

  // 除外日フィルターの前計算（行ループ内での再生成を避ける）
  const excludeDaysCache = new Map();
  for (const calc of orderedCalcs) {
    if (calc.type === 'relation' && calc.excludeDaysOfMonth?.length > 0) {
      const excludeSet = new Set(calc.excludeDaysOfMonth.map(Number));
      const dateColIndices = [];
      if (calc.dateColumnIndex !== '' && calc.dateColumnIndex !== undefined) {
        dateColIndices.push(parseInt(calc.dateColumnIndex));
      }
      if (calc.extraDateColumnIndices?.length > 0) {
        for (const idx of calc.extraDateColumnIndices) {
          const parsed = parseInt(idx);
          if (!isNaN(parsed)) dateColIndices.push(parsed);
        }
      }
      if (dateColIndices.length > 0) {
        excludeDaysCache.set(calc.id, { excludeSet, dateColIndices });
      }
    }
  }

  // チャンクごとに処理
  for (let i = 0; i < totalRows; i += chunkSize) {
    const chunk = rawData.slice(i, i + chunkSize);

    for (const row of chunk) {
      const newRow = { ...row };

      for (const calc of orderedCalcs) {
        if (calc.type === 'constant') {
          // 固定値
          newRow[calc.id] = calc.constantValue;

        } else if (calc.type === 'arithmetic') {
          // 四則演算
          newRow[calc.id] = applyArithmetic(newRow, calc);

        } else if (calc.type === 'relation') {
          // リレーション計算
          const indexKey = `${calc.targetSourceId}:${calc.id}`;
          const indexMap = sourceIndices[indexKey];

          const rawKey = newRow[calc.localKeyId] ?? newRow.id;
          const myKey = (rawKey === undefined || rawKey === null || rawKey === '') ? '(空白)' : String(rawKey);

          // キーでマッチする行を取得
          let matchingRows = indexMap ? (indexMap.get(myKey) || []) : [];

          // === 日付フィルター ===
          if (calc.dateColumnIndex !== '' && calc.dateColumnIndex !== undefined) {
            const dateColIdx = parseInt(calc.dateColumnIndex);
            if (!isNaN(dateColIdx) && newRow.date) {
              const targetDate = normalizeDate(newRow.date);
              matchingRows = matchingRows.filter(r => normalizeDate(r[dateColIdx]) === targetDate);
            }
          }
          // === 追加日付カラム (ボード日付範囲フィルタ) ===
          if (calc.extraDateColumnIndices?.length > 0) {
            const dateRange = activeFilters?.date;
            const rangeStart = dateRange?.start ? normalizeDate(dateRange.start) : null;
            const rangeEnd = dateRange?.end ? normalizeDate(dateRange.end) : null;
            if (rangeStart && rangeEnd) {
              for (const extraIdxStr of calc.extraDateColumnIndices) {
                const extraIdx = parseInt(extraIdxStr);
                if (!isNaN(extraIdx)) {
                  matchingRows = matchingRows.filter(r => {
                    const d = normalizeDate(r[extraIdx]);
                    return d && d >= rangeStart && d <= rangeEnd;
                  });
                }
              }
            }
          }

          // === 除外日フィルター (指定した日にちの集計を除外) ===
          const excludeDaysInfo = excludeDaysCache.get(calc.id);
          if (excludeDaysInfo) {
            matchingRows = matchingRows.filter(r => {
              for (const colIdx of excludeDaysInfo.dateColIndices) {
                const d = normalizeDate(r[colIdx]);
                if (d) {
                  const day = parseInt(d.split('/')[2]);
                  if (excludeDaysInfo.excludeSet.has(day)) return false;
                }
              }
              return true;
            });
          }

          // === filterMappings フィルター ===
          if (calc.filterMappings && Object.keys(calc.filterMappings).length > 0) {
            matchingRows = matchingRows.filter(sourceRow => {
              for (const [filterId, colIdxStr] of Object.entries(calc.filterMappings)) {
                const colIdx = parseInt(colIdxStr);
                if (isNaN(colIdx)) continue;

                const filterValue = activeFilters[filterId];

                // フィルター値がない場合はスキップ
                if (filterValue === undefined || filterValue === null || filterValue === '') continue;

                // オブジェクト型（日付範囲など）はスキップ
                if (typeof filterValue === 'object' && !Array.isArray(filterValue)) continue;

                const cellValue = String(sourceRow[colIdx] ?? '');

                // 配列の場合: いずれかに一致すればOK
                if (Array.isArray(filterValue)) {
                  if (filterValue.length === 0) continue;
                  const matched = filterValue.some(fv => String(fv) === cellValue);
                  if (!matched) return false;
                } else {
                  // 単一値: 完全一致
                  if (cellValue !== String(filterValue)) return false;
                }
              }
              return true;
            });
          }

          // === filterMappings 除外フィルター ===
          if (calc.filterMappings && activeFilters._exclude) {
            matchingRows = matchingRows.filter(sourceRow => {
              for (const [filterId, colIdxStr] of Object.entries(calc.filterMappings)) {
                const colIdx = parseInt(colIdxStr);
                if (isNaN(colIdx)) continue;
                const excludeConfig = activeFilters._exclude[filterId];
                if (!excludeConfig) continue;
                const excludeValues = Array.isArray(excludeConfig) ? excludeConfig : (excludeConfig.values || []);
                if (excludeValues.length === 0) continue;
                const cellValue = String(sourceRow[colIdx] ?? '');
                const mode = Array.isArray(excludeConfig) ? 'exclude' : (excludeConfig.mode || 'exclude');
                if (mode === 'include') {
                  if (!excludeValues.includes(cellValue)) return false;
                } else {
                  if (excludeValues.includes(cellValue)) return false;
                }
              }
              return true;
            });
          }

          // === 静的フィルター ===
          if (calc.filters && calc.filters.length > 0) {
            matchingRows = matchingRows.filter(sourceRow => {
              for (const filter of calc.filters) {
                const colIdx = parseInt(filter.colIndex);
                if (isNaN(colIdx)) continue;

                const val = sourceRow[colIdx];
                const valStr = String(val ?? '');
                const numVal = parseFloat(valStr.replace(/,/g, ''));
                const filterNum = parseFloat(String(filter.value).replace(/,/g, ''));
                const filterNum2 = filter.value2 ? parseFloat(String(filter.value2).replace(/,/g, '')) : NaN;

                let pass = true;
                switch (filter.conditionType) {
                  case 'equals': {
                    const eqVals = String(filter.value || '').split(',').map(v => v.trim()).filter(Boolean);
                    pass = eqVals.length > 0 ? eqVals.some(ev => valStr === ev) : valStr === filter.value;
                    break;
                  }
                  case 'notEquals': {
                    const neVals = String(filter.value || '').split(',').map(v => v.trim()).filter(Boolean);
                    pass = neVals.length > 0 ? neVals.every(nv => valStr !== nv) : valStr !== filter.value;
                    break;
                  }
                  case 'contains': pass = valStr.includes(filter.value || ''); break;
                  case 'notContains': pass = !valStr.includes(filter.value || ''); break;
                  case 'isEmpty': pass = !val || val === ''; break;
                  case 'isNotEmpty': pass = val && val !== ''; break;
                  case 'greaterThan': pass = !isNaN(numVal) && !isNaN(filterNum) && numVal > filterNum; break;
                  case 'lessThan': pass = !isNaN(numVal) && !isNaN(filterNum) && numVal < filterNum; break;
                  case 'greaterOrEqual': pass = !isNaN(numVal) && !isNaN(filterNum) && numVal >= filterNum; break;
                  case 'lessOrEqual': pass = !isNaN(numVal) && !isNaN(filterNum) && numVal <= filterNum; break;
                  case 'between': pass = !isNaN(numVal) && !isNaN(filterNum) && !isNaN(filterNum2) && numVal >= filterNum && numVal <= filterNum2; break;
                  case 'thisMonth2ndToEnd': {
                    if (!dateRanges.thisMonth2ndToEnd) { pass = true; break; }
                    const nv = normalizeDate(valStr);
                    pass = !!nv && nv >= dateRanges.thisMonth2ndToEnd.start && nv <= dateRanges.thisMonth2ndToEnd.end;
                    break;
                  }
                  case 'thisMonth2ndToToday': {
                    if (!dateRanges.thisMonth2ndToToday) { pass = true; break; }
                    const nv2t = normalizeDate(valStr);
                    pass = !!nv2t && nv2t >= dateRanges.thisMonth2ndToToday.start && nv2t <= dateRanges.thisMonth2ndToToday.end;
                    break;
                  }
                  case 'thisMonth2ndToYesterday': {
                    if (!dateRanges.thisMonth2ndToYesterday) { pass = true; break; }
                    const nv2y = normalizeDate(valStr);
                    pass = !!nv2y && nv2y >= dateRanges.thisMonth2ndToYesterday.start && nv2y <= dateRanges.thisMonth2ndToYesterday.end;
                    break;
                  }
                  case 'thisMonth': {
                    if (!dateRanges.thisMonth) { pass = true; break; }
                    const nvm = normalizeDate(valStr);
                    pass = !!nvm && nvm >= dateRanges.thisMonth.start && nvm <= dateRanges.thisMonth.end;
                    break;
                  }
                  case 'thisMonth1stToYesterday': {
                    if (!dateRanges.thisMonth1stToYesterday) { pass = true; break; }
                    const nv1y = normalizeDate(valStr);
                    pass = !!nv1y && nv1y >= dateRanges.thisMonth1stToYesterday.start && nv1y <= dateRanges.thisMonth1stToYesterday.end;
                    break;
                  }
                  case 'dateFilterRange': {
                    const dfr = normalizeDate(valStr);
                    const dfrStart = activeFilters?.date?.start ? normalizeDate(activeFilters.date.start) : null;
                    const dfrEnd = activeFilters?.date?.end ? normalizeDate(activeFilters.date.end) : null;
                    pass = !!dfr && (!dfrStart || dfr >= dfrStart) && (!dfrEnd || dfr <= dfrEnd);
                    break;
                  }
                  case 'dateFilterStart': {
                    const dfs = normalizeDate(valStr);
                    const dfsStart = activeFilters?.date?.start ? normalizeDate(activeFilters.date.start) : null;
                    pass = !!dfs && (!dfsStart || dfs >= dfsStart);
                    break;
                  }
                  case 'dateFilterEnd': {
                    const dfe = normalizeDate(valStr);
                    const dfeEnd = activeFilters?.date?.end ? normalizeDate(activeFilters.date.end) : null;
                    pass = !!dfe && (!dfeEnd || dfe <= dfeEnd);
                    break;
                  }
                }
                if (!pass) return false;
              }
              return true;
            });
          }

          // === 日付差フィルター ===
          if (calc.dateDiffFilter?.enabled) {
            const ddf = calc.dateDiffFilter;
            const colA = parseInt(ddf.dateColumnA);
            if (!isNaN(colA)) {
              const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '/');
              matchingRows = matchingRows.filter(r => {
                const dateAStr = normalizeDate(r[colA]);
                if (!dateAStr) return false;
                let dateBStr;
                if (ddf.useToday) {
                  dateBStr = todayStr;
                } else {
                  const colB = parseInt(ddf.dateColumnB);
                  if (isNaN(colB)) return false;
                  dateBStr = normalizeDate(r[colB]);
                }
                if (!dateBStr) return false;
                const dateA = new Date(dateAStr.replace(/\//g, '-'));
                const dateB = new Date(dateBStr.replace(/\//g, '-'));
                if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return false;
                const diffDays = Math.abs(dateB - dateA) / (1000 * 60 * 60 * 24);
                const maxDays = ddf.maxDays ?? 7;
                return ddf.direction === 'within' ? diffDays <= maxDays : diffDays >= maxDays;
              });
            }
          }

          // === 集計 ===
          const unitRules = calc.countUnitRules?.length > 0 ? calc.countUnitRules : null;
          const unitDefault = calc.countUnitDefault ?? 1;
          // 行ごとの単位を決定する関数
          const getRowUnit = unitRules ? (r) => {
            for (const rule of unitRules) {
              const colIdx = parseInt(rule.colIndex);
              if (isNaN(colIdx)) continue;
              const val = r[colIdx];
              const valStr = String(val ?? '');
              const ct = rule.conditionType || 'equals';
              const numVal = parseFloat(valStr.replace(/,/g, ''));
              const ruleNum = parseFloat(String(rule.value).replace(/,/g, ''));
              let match = false;
              switch (ct) {
                case 'equals': match = valStr === String(rule.value); break;
                case 'notEquals': match = valStr !== String(rule.value); break;
                case 'contains': match = valStr.includes(rule.value || ''); break;
                case 'notContains': match = !valStr.includes(rule.value || ''); break;
                case 'isEmpty': match = !val || val === ''; break;
                case 'isNotEmpty': match = val && val !== ''; break;
                case 'greaterThan': match = !isNaN(numVal) && !isNaN(ruleNum) && numVal > ruleNum; break;
                case 'lessThan': match = !isNaN(numVal) && !isNaN(ruleNum) && numVal < ruleNum; break;
                case 'greaterOrEqual': match = !isNaN(numVal) && !isNaN(ruleNum) && numVal >= ruleNum; break;
                case 'lessOrEqual': match = !isNaN(numVal) && !isNaN(ruleNum) && numVal <= ruleNum; break;
              }
              if (match) return rule.unit;
            }
            return unitDefault;
          } : null;

          if (calc.aggType === 'lookup') {
            // LOOKUP: マッチした最初の行から値をそのまま取得
            const lookupIdx = parseInt(calc.aggTargetIndex);
            if (matchingRows.length > 0 && !isNaN(lookupIdx)) {
              newRow[calc.id] = matchingRows[0][lookupIdx] ?? '';
            } else {
              newRow[calc.id] = '';
            }
          } else if (calc.aggType === 'sum') {
            const sumTargetIdx = parseInt(calc.aggTargetIndex);
            newRow[calc.id] = matchingRows.reduce((sum, r) => {
              const v = parseFloat(String(r[sumTargetIdx]).replace(/,/g, ''));
              const unit = getRowUnit ? getRowUnit(r) : 1;
              return sum + (isNaN(v) ? 0 : v) * unit;
            }, 0);
          } else {
            if (getRowUnit) {
              // 条件付き単位: 行ごとに単位を掛けて合算
              if (calc.aggTargetIndex !== '' && calc.aggTargetIndex !== undefined) {
                const targetIdx = parseInt(calc.aggTargetIndex);
                newRow[calc.id] = matchingRows.reduce((sum, r) => {
                  if (!r[targetIdx] || r[targetIdx] === '') return sum;
                  return sum + getRowUnit(r);
                }, 0);
              } else {
                newRow[calc.id] = matchingRows.reduce((sum, r) => sum + getRowUnit(r), 0);
              }
            } else {
              // ルールなし: 従来通り
              if (calc.aggTargetIndex !== '' && calc.aggTargetIndex !== undefined) {
                const targetIdx = parseInt(calc.aggTargetIndex);
                newRow[calc.id] = matchingRows.filter(r => r[targetIdx] && r[targetIdx] !== '').length;
              } else {
                newRow[calc.id] = matchingRows.length;
              }
            }
          }

        } else if (calc.type === 'conditionalCount') {
          // 条件カウント（リレーションと同様の処理だがconditionsを使用）
          const indexKey = `${calc.targetSourceId}:${calc.id}`;
          const indexMap = sourceIndices[indexKey];

          const rawKey = newRow[calc.localKeyId] ?? newRow.id;
          const myKey = (rawKey === undefined || rawKey === null || rawKey === '') ? '(空白)' : String(rawKey);

          let matchingRows = indexMap ? (indexMap.get(myKey) || []) : [];

          // === 日付フィルター ===
          if (calc.dateColumnIndex !== '' && calc.dateColumnIndex !== undefined) {
            const dateColIdx = parseInt(calc.dateColumnIndex);
            if (!isNaN(dateColIdx) && newRow.date) {
              const targetDate = normalizeDate(newRow.date);
              matchingRows = matchingRows.filter(r => normalizeDate(r[dateColIdx]) === targetDate);
            }
          }
          // === 追加日付カラム (ボード日付範囲フィルタ) ===
          if (calc.extraDateColumnIndices?.length > 0) {
            const dateRange = activeFilters?.date;
            const rangeStart = dateRange?.start ? normalizeDate(dateRange.start) : null;
            const rangeEnd = dateRange?.end ? normalizeDate(dateRange.end) : null;
            if (rangeStart && rangeEnd) {
              for (const extraIdxStr of calc.extraDateColumnIndices) {
                const extraIdx = parseInt(extraIdxStr);
                if (!isNaN(extraIdx)) {
                  matchingRows = matchingRows.filter(r => {
                    const d = normalizeDate(r[extraIdx]);
                    return d && d >= rangeStart && d <= rangeEnd;
                  });
                }
              }
            }
          }

          // === filterMappings フィルター ===
          if (calc.filterMappings && Object.keys(calc.filterMappings).length > 0) {
            matchingRows = matchingRows.filter(sourceRow => {
              for (const [filterId, colIdxStr] of Object.entries(calc.filterMappings)) {
                const colIdx = parseInt(colIdxStr);
                if (isNaN(colIdx)) continue;

                const filterValue = activeFilters[filterId];
                if (filterValue === undefined || filterValue === null || filterValue === '') continue;
                if (typeof filterValue === 'object' && !Array.isArray(filterValue)) continue;

                const cellValue = String(sourceRow[colIdx] ?? '');

                if (Array.isArray(filterValue)) {
                  if (filterValue.length === 0) continue;
                  if (!filterValue.some(fv => String(fv) === cellValue)) return false;
                } else {
                  if (cellValue !== String(filterValue)) return false;
                }
              }
              return true;
            });
          }

          // === filterMappings 除外フィルター（条件カウント） ===
          if (calc.filterMappings && activeFilters._exclude) {
            matchingRows = matchingRows.filter(sourceRow => {
              for (const [filterId, colIdxStr] of Object.entries(calc.filterMappings)) {
                const colIdx = parseInt(colIdxStr);
                if (isNaN(colIdx)) continue;
                const excludeConfig = activeFilters._exclude[filterId];
                if (!excludeConfig) continue;
                const excludeValues = Array.isArray(excludeConfig) ? excludeConfig : (excludeConfig.values || []);
                if (excludeValues.length === 0) continue;
                const cellValue = String(sourceRow[colIdx] ?? '');
                const mode = Array.isArray(excludeConfig) ? 'exclude' : (excludeConfig.mode || 'exclude');
                if (mode === 'include') {
                  if (!excludeValues.includes(cellValue)) return false;
                } else {
                  if (excludeValues.includes(cellValue)) return false;
                }
              }
              return true;
            });
          }

          // === 条件フィルター (conditions) ===
          if (calc.conditions && calc.conditions.length > 0) {
            matchingRows = matchingRows.filter(sourceRow => {
              for (const cond of calc.conditions) {
                const colIdx = parseInt(cond.columnIndex);
                if (isNaN(colIdx)) continue;

                const val = sourceRow[colIdx];
                const valStr = String(val ?? '');
                const numVal = parseFloat(valStr.replace(/,/g, ''));
                const condNum = parseFloat(String(cond.value).replace(/,/g, ''));
                const condNum2 = cond.value2 ? parseFloat(String(cond.value2).replace(/,/g, '')) : NaN;

                let passes = true;
                switch (cond.operator) {
                  case 'notEmpty': passes = val !== undefined && val !== null && val !== ''; break;
                  case 'empty': passes = val === undefined || val === null || val === ''; break;
                  case 'equals': passes = valStr === cond.value; break;
                  case 'notEquals': passes = valStr !== cond.value; break;
                  case 'contains': passes = valStr.includes(cond.value || ''); break;
                  case 'notContains': passes = !valStr.includes(cond.value || ''); break;
                  case 'greaterThan': passes = !isNaN(numVal) && !isNaN(condNum) && numVal > condNum; break;
                  case 'lessThan': passes = !isNaN(numVal) && !isNaN(condNum) && numVal < condNum; break;
                  case 'greaterOrEqual': passes = !isNaN(numVal) && !isNaN(condNum) && numVal >= condNum; break;
                  case 'lessOrEqual': passes = !isNaN(numVal) && !isNaN(condNum) && numVal <= condNum; break;
                  case 'between': passes = !isNaN(numVal) && !isNaN(condNum) && !isNaN(condNum2) && numVal >= condNum && numVal <= condNum2; break;
                  case 'thisMonth2ndToEnd': {
                    if (!thisMonth2ndRange) { passes = true; break; }
                    const nv = normalizeDate(valStr);
                    passes = !!nv && nv >= thisMonth2ndRange.start && nv <= thisMonth2ndRange.end;
                    break;
                  }
                }
                if (!passes) return false;
              }
              return true;
            });
          }

          // 件数をカウント
          newRow[calc.id] = matchingRows.length;
        }
      }
      result.push(newRow);
    }

    // 進捗を報告
    const progress = Math.min(100, Math.round(((i + chunkSize) / totalRows) * 100));
    self.postMessage({ type: 'progress', progress });
  }

  const endTime = performance.now();
  self.postMessage({ type: 'complete', data: result, time: endTime - startTime });
};
