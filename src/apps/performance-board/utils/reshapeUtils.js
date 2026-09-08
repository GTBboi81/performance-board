// src/apps/performance-board/utils/reshapeUtils.js
// 稼働実績用変換ユーティリティ（ワイド→ロング形式）

/**
 * 日付カラム値から年と月をパース
 * 対応形式:
 *   "2026/02/01", "2026-02-01", "2026-02-01T00:00:00.000Z"
 *   "2026年3月", "2026年" (yearのみ), "3月" (monthのみ)
 * @returns {{ year: number|null, month: number|null } | null}
 */
export function parseDateColumnValue(val) {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s) return null;
  // Standard: 2026/03/01, 2026-03-01
  const m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (m) {
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    if (year > 0 && month >= 1 && month <= 12) return { year, month };
  }
  // Japanese: "2026年3月" or "2026年"
  const mj = s.match(/(\d{4})年(?:(\d{1,2})月)?/);
  if (mj) {
    const year = parseInt(mj[1], 10);
    const month = mj[2] ? parseInt(mj[2], 10) : null;
    if (year > 0) return { year, month: (month && month >= 1 && month <= 12) ? month : null };
  }
  // Month only: "3月"
  const mm = s.match(/^(\d{1,2})月$/);
  if (mm) {
    const month = parseInt(mm[1], 10);
    if (month >= 1 && month <= 12) return { year: null, month };
  }
  return null;
}

/**
 * 年・月・日インデックスから日付文字列を生成
 * @returns {string|null} "YYYY/MM/DD" or null
 */
export function buildDateFromYearMonthDay(year, month, dayIndex) {
  if (year == null || month == null || dayIndex < 1 || dayIndex > 31) return null;

  // 無効な日付をチェック（2月30日等）
  const date = new Date(year, month - 1, dayIndex);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== dayIndex) {
    return null;
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(dayIndex).padStart(2, '0');
  return `${year}/${mm}/${dd}`;
}

/**
 * グループ行の全値が空かどうかチェック
 */
export function isGroupRowEmpty(values) {
  return values.every(v => v === null || v === undefined || v === '');
}

/**
 * 稼働実績用変換のメイン関数（ワイド→ロング）
 *
 * @param {Array<Array>} rows - 生データ行（2次元配列）
 * @param {Array<string>} headers - ソースのヘッダー配列
 * @param {object} settings - reshapeSettings設定オブジェクト
 * @returns {{ rows: Array<Array>, headers: Array<string> }}
 */
export function reshapeWideToLong(rows, headers, settings) {
  if (!settings?.enabled) return { rows, headers };

  const {
    dateColumnName,
    monthColumnName,
    fixedColumnNames = [],
    groups = [],
    generatedDateColumnName = '稼働日',
    skipEmptyDays = true,
    _patternLabelsVisible,
  } = settings;

  if (groups.length === 0) return { rows, headers };

  // ヘッダー名 → インデックスの逆引きマップ（prototype pollution防止）
  const headerIndex = Object.create(null);
  headers.forEach((h, i) => { headerIndex[h] = i; });

  const dateColIdx = dateColumnName ? headerIndex[dateColumnName] : undefined;
  const monthColIdx = monthColumnName ? headerIndex[monthColumnName] : undefined;
  // 存在するカラムのみフィルタ（欠損カラムによる値ズレ防止）
  const validFixedColumns = fixedColumnNames.filter(name => headerIndex[name] !== undefined);
  const fixedIndices = validFixedColumns.map(name => headerIndex[name]);

  // グループ列の可視性フィルタ
  const allGroupColNames = groups[0]?.columns?.map(c => c.outputName) || [];
  const visibilityMask = _patternLabelsVisible || allGroupColNames.map(() => true);
  const visibleIndices = visibilityMask
    .map((v, i) => v !== false ? i : -1)
    .filter(i => i !== -1 && i < allGroupColNames.length);
  const groupColNames = visibleIndices.map(i => allGroupColNames[i]);

  // 出力ヘッダー: [日付, 固定列..., 可視グループ列ラベル...]
  const outputHeaders = [
    generatedDateColumnName,
    ...validFixedColumns,
    ...groupColNames,
  ];

  // ヘッダーのみ必要な場合（rows空）
  if (!rows || rows.length === 0) {
    return { rows: [], headers: outputHeaders };
  }

  const outputRows = [];

  for (const row of rows) {
    // 日付カラムから年月を取得
    let yearVal = null, monthVal = null;
    if (dateColIdx !== undefined) {
      const parsed = parseDateColumnValue(row[dateColIdx]);
      if (parsed) {
        yearVal = parsed.year;
        monthVal = parsed.month;
      }
    }
    // 月カラムが別途指定されている場合、そこから月を補完
    if (monthVal == null && monthColIdx !== undefined) {
      const parsed = parseDateColumnValue(row[monthColIdx]);
      if (parsed?.month != null) monthVal = parsed.month;
    }
    const fixedValues = fixedIndices.map(i => row[i] ?? '');

    let emitted = false;
    for (const group of groups) {
      const allGroupValues = group.columns.map(c => {
        const idx = headerIndex[c.sourceName];
        return idx !== undefined ? (row[idx] ?? '') : '';
      });

      if (skipEmptyDays && isGroupRowEmpty(allGroupValues)) continue;

      const dateStr = buildDateFromYearMonthDay(yearVal, monthVal, group.dayIndex);
      if (dateStr == null && skipEmptyDays) continue;

      // 可視列のみ抽出
      let groupValues = visibleIndices.map(i => allGroupValues[i]);

      if (settings.convertTimeToHours) {
        groupValues = groupValues.map((v, i) => {
          const colName = groupColNames[i] || '';
          return colName.includes('時間') ? convertTimeToDecimalHours(v) : v;
        });
      }

      outputRows.push([dateStr || '', ...fixedValues, ...groupValues]);
      emitted = true;
    }

    // 全日スキップでも固定カラムに値があれば1行出力（IDを保持）
    if (!emitted && skipEmptyDays && fixedValues.some(v => v !== null && v !== undefined && v !== '')) {
      outputRows.push(['', ...fixedValues, ...visibleIndices.map(() => '')]);
    }
  }

  return { rows: outputRows, headers: outputHeaders };
}

/**
 * 時間文字列を10進数の時間に変換
 * 対応形式:
 *   "8:00", "160:00" (H:MM, HHH:MM)
 *   "05:00:00.000Z", "08:30:00.000Z" (Salesforce Time形式)
 * @param {*} value - セルの値
 * @returns {number|*} 変換できれば数値、できなければ元の値
 */
export function convertTimeToDecimalHours(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'number') return value;
  const s = String(value).trim();
  if (!s) return '';
  // SF Time形式: "05:00:00.000Z", "08:30:00.000Z"
  const sfm = s.match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?Z?$/);
  if (sfm) {
    const mins = parseInt(sfm[2], 10);
    if (mins > 59) return value;
    return parseInt(sfm[1], 10) + mins / 60;
  }
  // 通常形式: "8:00", "160:00"
  const m = s.match(/^(\d{1,3}):(\d{2})$/);
  if (m) {
    const mins = parseInt(m[2], 10);
    if (mins > 59) return value;
    return parseInt(m[1], 10) + mins / 60;
  }
  return value;
}

/**
 * fieldMetadataのラベルから「N日XXX」の繰り返しパターンを自動検出
 * @param {string[]} rawHeaders - ソースのヘッダー配列
 * @param {object} fieldMetadata - { fieldName: label } のマッピング
 * @returns {{ success: boolean, startColIndex?: number, columnsPerDay?: number, numDays?: number, labels?: string[], dateColumnCandidate?: string, fixedColumnCandidates?: string[], message: string }}
 */
export function detectWidePattern(rawHeaders, fieldMetadata) {
  if (!fieldMetadata || Object.keys(fieldMetadata).length === 0) {
    return { success: false, message: 'フィールドメタデータがありません。「全フィールド取得」を実行してください。' };
  }

  // ラベルから「N日XXX」パターンをスキャン
  const dayPattern = /^(\d{1,2})日(.+)/;
  const dayMap = new Map(); // dayNumber → [{ suffix, headerName }]
  const patternFieldSet = new Set();

  for (const [fieldName, label] of Object.entries(fieldMetadata)) {
    if (!rawHeaders.includes(fieldName)) continue;
    if (typeof label !== 'string') continue;
    const m = label.match(dayPattern);
    if (m) {
      const dayNum = parseInt(m[1], 10);
      const suffix = m[2].trim();
      if (!dayMap.has(dayNum)) dayMap.set(dayNum, []);
      dayMap.get(dayNum).push({ suffix, headerName: fieldName });
      patternFieldSet.add(fieldName);
    }
  }

  if (dayMap.size === 0) {
    return { success: false, message: '「N日○○」パターンのフィールドが見つかりませんでした。' };
  }

  // 1日目のグループから列構造を決定（rawHeaders順でソート）
  const day1 = dayMap.get(1);
  if (!day1) {
    return { success: false, message: '1日目のフィールドが見つかりませんでした。' };
  }
  day1.sort((a, b) => rawHeaders.indexOf(a.headerName) - rawHeaders.indexOf(b.headerName));
  const columnsPerDay = day1.length;
  const labels = day1.map(item => item.suffix);
  const startColIndex = rawHeaders.indexOf(day1[0].headerName);

  // 最大日数（連続性と列数一致の検証）
  const sortedDays = [...dayMap.keys()].sort((a, b) => a - b);
  const numDays = sortedDays[sortedDays.length - 1];
  const inconsistentDays = sortedDays.filter(d => (dayMap.get(d) || []).length !== columnsPerDay);
  if (inconsistentDays.length > 0) {
    return { success: false, message: `列数が一致しない日があります（${inconsistentDays.join(',')}日目）。手動で設定してください。` };
  }

  // 日付カラム候補: ラベルに「日付」を含むフィールド
  let dateColumnCandidate = null;
  for (const [fieldName, label] of Object.entries(fieldMetadata)) {
    if (!rawHeaders.includes(fieldName)) continue;
    if (typeof label === 'string' && label.includes('日付') && !patternFieldSet.has(fieldName)) {
      dateColumnCandidate = fieldName;
      break;
    }
  }

  // 固定カラム候補: 繰返しパターンに含まれず、日付候補でもないフィールド
  const fixedColumnCandidates = rawHeaders.filter(h =>
    !patternFieldSet.has(h) && h !== dateColumnCandidate
  );

  return {
    success: true,
    startColIndex,
    columnsPerDay,
    numDays,
    labels,
    dateColumnCandidate,
    fixedColumnCandidates,
    message: `${columnsPerDay}列×${numDays}日のパターンを検出しました`,
  };
}

/**
 * fieldMetadataのラベルから「N日XXX」の繰り返しパターンを複数検出
 * suffix（例: 稼働時間, 調整時間）ごとにパターンを分離する
 * @param {string[]} rawHeaders
 * @param {object} fieldMetadata - { fieldName: label }
 * @returns {{ success: boolean, patterns?: Array<{startIdx: number, colsPerDay: number, numDays: number, labels: string[]}>, dateColumnCandidate?: string, fixedColumnCandidates?: string[], message: string }}
 */
export function detectWidePatterns(rawHeaders, fieldMetadata) {
  if (!fieldMetadata || Object.keys(fieldMetadata).length === 0) {
    return { success: false, message: 'フィールドメタデータがありません。「全フィールド取得」を実行してください。' };
  }

  const dayPattern = /^(\d{1,2})日(.+)/;
  // suffix → Map<dayNum, fieldName>
  const suffixMap = new Map();
  const patternFieldSet = new Set();

  // プレフィックス（「○○:」形式）を除去するヘルパー
  const stripPrefix = (s) => { const i = s.indexOf(':'); return i >= 0 ? s.slice(i + 1) : s; };

  for (const [fieldName, label] of Object.entries(fieldMetadata)) {
    if (!rawHeaders.includes(fieldName)) continue;
    if (typeof label !== 'string') continue;
    const cleanLabel = stripPrefix(label);
    const m = cleanLabel.match(dayPattern);
    if (m) {
      const dayNum = parseInt(m[1], 10);
      const suffix = m[2].trim();
      if (!suffixMap.has(suffix)) suffixMap.set(suffix, new Map());
      suffixMap.get(suffix).set(dayNum, fieldName);
      patternFieldSet.add(fieldName);
    }
  }

  if (suffixMap.size === 0) {
    return { success: false, message: '「N日○○」パターンのフィールドが見つかりませんでした。' };
  }

  const patterns = [];
  for (const [suffix, dayFields] of suffixMap) {
    const day1Field = dayFields.get(1);
    if (!day1Field) continue;
    const startIdx = rawHeaders.indexOf(day1Field);
    if (startIdx < 0) continue;
    const sortedDays = [...dayFields.keys()].sort((a, b) => a - b);
    const numDays = sortedDays[sortedDays.length - 1];
    // 各日の実際のフィールド名を保存（rawHeaders上で非連続でも正しく解決）
    const sourceFields = [];
    for (let d = 1; d <= numDays; d++) {
      sourceFields.push(dayFields.get(d) || null);
    }
    patterns.push({
      id: `p${Date.now()}_${patterns.length}`,
      startIdx,
      colsPerDay: 1,
      numDays,
      labels: [suffix],
      labelsVisible: [true],
      sourceFields,
    });
  }

  if (patterns.length === 0) {
    return { success: false, message: '1日目のフィールドが見つかりませんでした。' };
  }

  // rawHeaders の順序でパターンをソート
  patterns.sort((a, b) => a.startIdx - b.startIdx);

  // 日付カラム候補
  let dateColumnCandidate = null;
  for (const [fieldName, label] of Object.entries(fieldMetadata)) {
    if (!rawHeaders.includes(fieldName)) continue;
    if (typeof label === 'string' && label.includes('日付') && !patternFieldSet.has(fieldName)) {
      dateColumnCandidate = fieldName;
      break;
    }
  }

  // 固定カラム候補
  const fixedColumnCandidates = rawHeaders.filter(h =>
    !patternFieldSet.has(h) && h !== dateColumnCandidate
  );

  const patternDesc = patterns.map(p => p.labels[0]).join('・');
  return {
    success: true,
    patterns,
    dateColumnCandidate,
    fixedColumnCandidates,
    message: `${patterns.length}パターン検出: ${patternDesc}`,
  };
}

/**
 * 固定カラム用のプレースホルダー値を推測
 */
function guessPlaceholder(col, fieldMetadata) {
  const lower = (fieldMetadata[col] || col).toLowerCase();
  if (/^id$/i.test(col) || lower.includes('objid') || lower.includes('object id')) return '00xABC...';
  if (/name/i.test(col) || lower.includes('名')) return 'サンプル担当者';
  if (lower.includes('エリア') || lower.includes('area')) return 'エリア①';
  if (lower.includes('部署') || lower.includes('department')) return '部署①';
  if (lower.includes('時間') || lower.includes('time')) return '160:00';
  // リレーションフィールドの汎用プレースホルダー
  if (col.includes('.')) return '(参照値)';
  return '(値)';
}

/**
 * グループ列用のプレースホルダー値を推測
 */
function guessGroupPlaceholder(col) {
  const lower = col.toLowerCase();
  if (lower.includes('開始') || lower.includes('start')) return '09:00';
  if (lower.includes('終了') || lower.includes('end')) return '18:00';
  if (lower.includes('休憩') || lower.includes('break')) return '有';
  if (lower.includes('時間') || lower.includes('time') || lower.includes('hour')) return '8:00';
  return '--';
}

/**
 * 整形後プレビューデータの生成（ネットワーク通信不要）
 * @param {Array<string>} rawHeaders - 元ヘッダー配列
 * @param {object} settings - reshapeSettings
 * @param {object} fieldMetadata - API名→ラベルのマッピング
 * @returns {{ outputHeaders: string[], displayHeaders: string[], sampleRows: string[][] } | null}
 */
export function generateReshapePreview(rawHeaders, settings, fieldMetadata = {}, soqlFields = '') {
  if (!settings?.enabled || !settings.groups?.length) return null;

  // rawHeadersとsoqlFieldsをマージ（リレーションフィールドをプレビューに含める）
  const allHeaders = [...rawHeaders];
  if (soqlFields) {
    soqlFields.split(',').map(f => f.trim()).filter(Boolean).forEach(f => {
      if (!allHeaders.includes(f)) allHeaders.push(f);
    });
  }
  const { headers: outputHeaders } = reshapeWideToLong([], allHeaders, settings);
  if (outputHeaders.length === 0) return null;

  const displayHeaders = outputHeaders.map(h => fieldMetadata[h] || h);

  const dateColName = settings.generatedDateColumnName || '稼働日';
  const fixedCols = settings.fixedColumnNames || [];

  const sampleRows = [1, 2, 3].map(day => {
    return outputHeaders.map(col => {
      if (col === dateColName) return `2026/03/${String(day).padStart(2, '0')}`;
      if (fixedCols.includes(col)) return guessPlaceholder(col, fieldMetadata);
      const placeholder = guessGroupPlaceholder(col);
      if (settings.convertTimeToHours && col.includes('時間')) {
        const converted = convertTimeToDecimalHours(placeholder);
        return typeof converted === 'number' ? String(converted) : placeholder;
      }
      return placeholder;
    });
  });

  return { outputHeaders, displayHeaders, sampleRows };
}

/**
 * 稼働実績用変換に必要なフィールドだけを抽出
 * 全451フィールドではなく、実際に使うフィールドのみSOQL SELECTする
 * @param {object} reshapeSettings - 整形設定
 * @param {string[]} allFields - 全soqlFieldsの配列
 * @returns {string[]} 必要なフィールドのみの配列
 */
export function getRequiredFieldsForReshape(reshapeSettings, allFields) {
  if (!reshapeSettings?.enabled || !reshapeSettings.groups?.length) return allFields;

  const needed = new Set();

  // 日付カラム
  if (reshapeSettings.dateColumnName) needed.add(reshapeSettings.dateColumnName);
  if (reshapeSettings.monthColumnName) needed.add(reshapeSettings.monthColumnName);

  // 固定カラム（出力カラム）
  (reshapeSettings.fixedColumnNames || []).forEach(f => needed.add(f));

  // パターン列（全グループのソース列）
  (reshapeSettings.groups || []).forEach(g => {
    (g.columns || []).forEach(c => needed.add(c.sourceName));
  });

  // allFieldsの順序を維持してフィルタ
  const result = allFields.filter(f => needed.has(f));
  // neededにあるがallFieldsにないフィールド（リレーション等）も追加
  needed.forEach(f => { if (!result.includes(f)) result.push(f); });

  return result;
}

/**
 * ダッシュボード設定から実際に使用されているフィールドを抽出
 * @param {object} config - ダッシュボード設定（mapping, calculations, filters, dataTables, mainKey等）
 * @param {string} sourceId - 対象ソースID
 * @param {string[]} allFields - ソースの全フィールド
 * @returns {string[]} 使用中フィールドのリスト（allFieldsの順序を維持）
 */
export function getUsedFields(config, sourceId, allFields) {
  if (!config || !allFields || allFields.length === 0) return allFields;

  const used = new Set();

  // マッピング
  if (config.mapping) {
    Object.values(config.mapping).forEach(m => {
      if (m.sourceId === sourceId && m.columnName) used.add(m.columnName);
    });
  }

  // 計算式（リレーション計算のターゲットソース・ルックアップカラム等）
  if (config.calculations) {
    config.calculations.forEach(calc => {
      if (calc.targetSourceId === sourceId) {
        if (calc.columnName) used.add(calc.columnName);
        if (calc.lookupColumnName) used.add(calc.lookupColumnName);
        // 固定フィルタのカラム
        (calc.fixedFilters || []).forEach(ff => { if (ff.columnName) used.add(ff.columnName); });
        // 日付差フィルタ
        if (calc.dateDiffFilter?.dateColumnAName) used.add(calc.dateDiffFilter.dateColumnAName);
        if (calc.dateDiffFilter?.dateColumnBName) used.add(calc.dateDiffFilter.dateColumnBName);
      }
    });
  }

  // フィルタ
  if (config.filters) {
    config.filters.forEach(f => {
      if (f.sourceId === sourceId && f.field) used.add(f.field);
    });
  }

  // データテーブル列
  if (config.dataTables) {
    config.dataTables.forEach(dt => {
      (dt.columns || []).forEach(col => {
        if (col.sourceId === sourceId && col.field) used.add(col.field);
      });
    });
  }

  // メインキー
  if (config.mainKey?.sourceId === sourceId && config.mainKey.columnName) {
    used.add(config.mainKey.columnName);
  }

  // ソースのキー列・日付列
  // （source自体の情報はここでは取れないので呼び出し元で追加）

  // 使用フィールドが0件（設定未完了等）の場合はフォールバックで全件返す
  if (used.size === 0) return allFields;

  // allFieldsの順序を維持してフィルタ（allFieldsに含まれるAPI名のみ）
  const allFieldSet = new Set(allFields);
  const result = allFields.filter(f => used.has(f));
  // usedにあるがallFieldsにないフィールドは「API名の可能性がある場合のみ」追加
  // ラベル名（日本語等）が混入するのを防止
  used.forEach(f => {
    if (!result.includes(f) && allFieldSet.has(f)) result.push(f);
  });

  return result;
}

/**
 * グループ定義の自動生成
 * ヘッダー配列の指定位置からcolumnsPerGroupずつ取って、numDays分のGroupDefinitionを作る
 */
export function generateGroups(startColIndex, columnsPerGroup, numDays, colLabels, headers) {
  const groups = [];
  for (let day = 0; day < numDays; day++) {
    const columns = [];
    for (let col = 0; col < columnsPerGroup; col++) {
      const sourceIdx = startColIndex + day * columnsPerGroup + col;
      if (sourceIdx >= headers.length) break;
      columns.push({
        sourceName: headers[sourceIdx],
        outputName: colLabels[col] || `列${col + 1}`,
      });
    }
    if (columns.length === columnsPerGroup) {
      groups.push({ dayIndex: day + 1, columns });
    }
  }
  return groups;
}

/**
 * 開始フィールドのラベルからsourceFieldsを自動解決
 * 例: Field401__c のラベルが「1日調整時間」→ 全「N日調整時間」フィールドを検索して日順配列を返す
 * @param {object} pattern - パターン定義
 * @param {string[]} headers - rawHeaders配列
 * @param {object} fieldMetadata - { fieldName: label }
 * @returns {string[]|null} 日順のフィールド名配列、解決できなければnull
 */
function resolveSourceFieldsFromMetadata(pattern, headers, fieldMetadata) {
  const startField = headers[pattern.startIdx];
  if (!startField || !fieldMetadata) return null;
  const rawStartLabel = fieldMetadata[startField];
  if (typeof rawStartLabel !== 'string') return null;

  // プレフィックス（「○○:」形式）を除去してからマッチング
  const stripPrefix = (label) => {
    const colonIdx = label.indexOf(':');
    return colonIdx >= 0 ? label.slice(colonIdx + 1) : label;
  };

  const startLabel = stripPrefix(rawStartLabel);
  const m = startLabel.match(/^(\d{1,2})日(.+)/);
  if (!m) return null;

  const suffix = m[2].trim();
  const dayFields = new Map();
  for (const [fieldName, label] of Object.entries(fieldMetadata)) {
    if (typeof label !== 'string') continue;
    const cleanLabel = stripPrefix(label);
    const dm = cleanLabel.match(/^(\d{1,2})日(.+)/);
    if (dm && dm[2].trim() === suffix) {
      dayFields.set(parseInt(dm[1], 10), fieldName);
    }
  }

  const numDays = pattern.numDays || 31;
  const sourceFields = [];
  for (let d = 1; d <= numDays; d++) {
    sourceFields.push(dayFields.get(d) || null);
  }
  return sourceFields;
}

/**
 * 複数パターンからグループ定義を生成（マージ版）
 * 各日のcolumnsに全パターンの列を結合する
 * @param {Array<{startIdx: number, colsPerDay: number, numDays: number, labels: string[], sourceFields?: string[]}>} patterns
 * @param {string[]} headers - rawHeaders配列
 * @param {object} [fieldMetadata] - sourceFields未設定時にラベルから自動解決するためのメタデータ
 * @returns {Array<{dayIndex: number, columns: Array<{sourceName: string, outputName: string}>}>}
 */
export function generateGroupsFromPatterns(patterns, headers, fieldMetadata) {
  if (!patterns || patterns.length === 0) return [];
  const maxDays = Math.max(...patterns.map(p => p.numDays || 0));
  const groups = [];
  for (let day = 0; day < maxDays; day++) {
    const columns = [];
    for (const pattern of patterns) {
      if (day >= (pattern.numDays || 0)) continue;
      const colsPerDay = pattern.colsPerDay || 1;

      // sourceFields を決定: 既存 → メタデータから解決 → オフセット計算
      const sf = pattern.sourceFields
        || (fieldMetadata ? resolveSourceFieldsFromMetadata(pattern, headers, fieldMetadata) : null);

      if (sf) {
        for (let col = 0; col < colsPerDay; col++) {
          const fieldIdx = day * colsPerDay + col;
          const fieldName = sf[fieldIdx];
          if (fieldName) {
            columns.push({
              sourceName: fieldName,
              outputName: (pattern.labels || [])[col] || `列${col + 1}`,
            });
          }
        }
      } else {
        // 最終フォールバック: rawHeaders上の位置ベースオフセット計算（連続フィールド用）
        for (let col = 0; col < colsPerDay; col++) {
          const sourceIdx = (pattern.startIdx || 0) + day * colsPerDay + col;
          if (sourceIdx >= headers.length) break;
          columns.push({
            sourceName: headers[sourceIdx],
            outputName: (pattern.labels || [])[col] || `列${col + 1}`,
          });
        }
      }
    }
    if (columns.length > 0) {
      groups.push({ dayIndex: day + 1, columns });
    }
  }
  return groups;
}
