// src/apps/performance-board/utils/analyticsCache.js
// キャッシュ用ハッシュ生成ユーティリティ

/**
 * sourceIndices用のキャッシュハッシュを生成
 * @param {string} dashboardId - ダッシュボードID
 * @param {object} sourceCache - ソースデータキャッシュ
 * @param {array} calculations - 計算設定配列
 * @returns {string|null} ハッシュ文字列
 */
export const generateSourceIndicesHash = (dashboardId, sourceCache, calculations) => {
  if (!dashboardId) return null;
  const sourceIds = Object.keys(sourceCache || {}).sort().join(',');
  const calcIds = (calculations || [])
    .filter(c => c.type === 'relation')
    .map(c => c.id)
    .join(',');
  const totalRows = Object.values(sourceCache || {})
    .reduce((sum, rows) => sum + (rows?.length || 0), 0);
  return `${dashboardId}_${sourceIds}_${calcIds}_${totalRows}`;
};

/**
 * calculatedData用のキャッシュハッシュを生成
 * @param {string} dashboardId - ダッシュボードID
 * @param {array} rawData - 生データ配列
 * @param {array} calculations - 計算設定配列
 * @param {object} activeFilters - アクティブフィルター
 * @returns {string|null} ハッシュ文字列
 */
export const generateCalcCacheHash = (dashboardId, rawData, calculations, activeFilters) => {
  if (!dashboardId || !rawData?.length) return null;

  // rawDataの長さ、最初と最後の行のid、calculationsの長さで簡易ハッシュ
  const firstId = rawData[0]?.id || '';
  const lastId = rawData[rawData.length - 1]?.id || '';
  const calcIds = (calculations || []).map(c => c.id).join(',');

  // ★ 先頭行の数値フィールド値サンプル（同一ID・異なる値のキャッシュ不整合を防止）
  const firstRow = rawData[0] || {};
  const sampleValues = Object.entries(firstRow)
    .filter(([, v]) => typeof v === 'number')
    .slice(0, 5)
    .map(([k, v]) => `${k}=${v}`)
    .join(',');

  // フィルターのキーと値も含める（フィルター変更時にキャッシュを無効化）
  const filterHash = Object.entries(activeFilters || {})
    .filter(([k, v]) => k !== '_exclude' && v != null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => { try { return `${k}:${JSON.stringify(v)}`; } catch { return `${k}:[unstringifiable]`; } })
    .join('|');

  return `${dashboardId}_${rawData.length}_${firstId}_${lastId}_${calcIds}_${sampleValues}_${filterHash}`;
};
