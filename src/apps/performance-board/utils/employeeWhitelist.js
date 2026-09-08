// 担当者ホワイトリスト: フィルタ + ゼロ行補完

/**
 * allRows から担当者一覧を抽出して [{id, name}] で返す
 */
export function extractUniqueEmployees(allRows, mainKeyFieldId, nameFieldId) {
  if (!mainKeyFieldId || !Array.isArray(allRows)) return [];
  const map = new Map();
  for (const row of allRows) {
    const id = String(row[mainKeyFieldId] ?? '');
    if (!id) continue;
    if (!map.has(id)) {
      const name = nameFieldId ? String(row[nameFieldId] ?? id) : id;
      map.set(id, name);
    }
  }
  return [...map.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'ja'))
    .map(([id, name]) => ({ id, name }));
}

/**
 * visibleIds に従って rows をフィルタし、データなし担当者には 0 埋め行を挿入する
 * @param {Array} rows - enrichedData（処理済みデータ行）
 * @param {string[]|null|undefined} visibleIds - 表示対象ID。null/undefined なら全表示
 * @param {string} mainKeyFieldId - 担当者IDの列ID
 * @param {string[]} numericFieldIds - 数値列IDリスト（0埋め対象）
 * @param {Array} systemFields - systemFields 配列（フィールド型判定用）
 * @param {Object} opts
 *   opts.skip {boolean} - true なら何もせず rows を返す（階層モード用）
 *   opts.nameFieldId {string} - 0埋め行の名前列に使うフィールドID
 */
export function applyEmployeeWhitelist(rows, visibleIds, mainKeyFieldId, numericFieldIds, systemFields, opts = {}) {
  if (opts.skip) return rows;
  if (!Array.isArray(visibleIds)) return rows;  // null/undefined → 全表示（後方互換）
  if (!mainKeyFieldId) return rows;

  const keep = new Set(visibleIds.map(String));

  // フィルタ
  const filtered = rows.filter(r => keep.has(String(r[mainKeyFieldId] ?? '')));

  // 既存行から nameMap を構築（uniqueEmployees に依存しない）
  const nameMap = new Map();
  for (const r of filtered) {
    const id = String(r[mainKeyFieldId] ?? '');
    if (id && opts.nameFieldId && !nameMap.has(id)) {
      nameMap.set(id, r[opts.nameFieldId] ?? id);
    }
  }

  // visibleIds の順でゼロ行を補完
  const seen = new Set(filtered.map(r => String(r[mainKeyFieldId] ?? '')));
  const result = [...filtered];
  for (const rawId of visibleIds) {
    const id = String(rawId);
    if (seen.has(id)) continue;
    const zeroRow = { [mainKeyFieldId]: rawId };
    if (opts.nameFieldId) zeroRow[opts.nameFieldId] = nameMap.get(id) ?? id;
    for (const fid of numericFieldIds) zeroRow[fid] = 0;
    result.push(zeroRow);
  }

  return result;
}
