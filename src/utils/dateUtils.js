// 日付関連ユーティリティ
import { parseISO } from 'date-fns';

/**
 * PHPバックエンドからのdatetime文字列をパースする。
 * DB保存形式 "YYYY-MM-DD HH:MM:SS" をISO 8601 "T" 区切りに正規化してからparseISOに渡す。
 * null/undefined/空文字列の場合はInvalid Dateを返す（呼び出し側でisValid()でチェック可能）。
 */
export const parseMeetingDatetime = (str) => {
    if (str == null || str === '') return new Date(NaN);
    const normalised = String(str).trim().replace(' ', 'T');
    if (normalised === 'null' || normalised === 'undefined') return new Date(NaN);
    return parseISO(normalised);
};

// ★ 最適化: normalizeDate結果をキャッシュ
const normalizeDateCache = new Map();
let normalizeDateHits = 0;
let normalizeDateMisses = 0;

/**
 * 日付を正規化する（YYYY/MM/DD形式に統一）
 * @param {*} val - 日付値
 * @returns {string} 正規化された日付文字列
 */
export const normalizeDate = (val) => {
  if (!val) return "";

  // キャッシュをチェック
  const cached = normalizeDateCache.get(val);
  if (cached !== undefined) {
    normalizeDateHits++;
    return cached;
  }
  normalizeDateMisses++;

  let str = String(val).trim();

  // タイムスタンプ部分を除去（ISO形式対応: 2023-06-01T15:00:00.000Z, 2023/06/01T15:00:00/000Z）
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

  // キャッシュに保存（サイズ制限: 10000エントリ）
  if (normalizeDateCache.size < 10000) {
    normalizeDateCache.set(val, result);
  }

  return result;
};

/**
 * キャッシュ統計をリセット＆ログ出力（デバッグ用）
 */
export const logNormalizeDateStats = () => {
  // デバッグ出力を削除
};

/**
 * キャッシュをクリア
 */
export const clearNormalizeDateCache = () => {
  normalizeDateCache.clear();
  normalizeDateHits = 0;
  normalizeDateMisses = 0;
};