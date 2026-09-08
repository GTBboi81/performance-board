// src/indexedDBCache.js
// IndexedDB によるデータキャッシュユーティリティ

const DB_NAME = 'glass_dashboard_cache';
const DB_VERSION = 1;
const STORE_NAME = 'sourceData';

// DB接続
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
  });
};

// キャッシュキー生成（ダッシュボードID + ソースID）
const getCacheKey = (dashboardId, sourceId) => `${dashboardId}_${sourceId}`;

// キャッシュ保存
export const saveToCache = async (dashboardId, sourceId, data) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    store.put({
      key: getCacheKey(dashboardId, sourceId),
      data,
      timestamp: Date.now()
    });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB saveToCache failed:', err);
    // エラー時は何もしない（フォールバック）
  }
};

// キャッシュ読み込み
export const loadFromCache = async (dashboardId, sourceId) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(getCacheKey(dashboardId, sourceId));

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('IndexedDB loadFromCache failed:', err);
    return null; // エラー時はキャッシュなしとして扱う
  }
};

// 全キャッシュ読み込み（ダッシュボード単位）
export const loadAllFromCache = async (dashboardId, sourceIds) => {
  const results = {};
  try {
    for (const sourceId of sourceIds) {
      const cached = await loadFromCache(dashboardId, sourceId);
      if (cached) {
        results[sourceId] = cached.data;
      }
    }
  } catch (err) {
    console.warn('IndexedDB loadAllFromCache failed:', err);
  }
  return results;
};

// キャッシュ削除
export const clearCache = async (dashboardId = null) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    if (dashboardId) {
      // 特定ダッシュボードのみ削除
      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (cursor.key.startsWith(dashboardId + '_')) {
            cursor.delete();
          }
          cursor.continue();
        }
      };
    } else {
      // 全削除
      store.clear();
    }

    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
    });
  } catch (err) {
    console.warn('IndexedDB clearCache failed:', err);
  }
};

// キャッシュのタイムスタンプを取得
export const getCacheTimestamp = async (dashboardId, sourceId) => {
  try {
    const cached = await loadFromCache(dashboardId, sourceId);
    return cached?.timestamp || null;
  } catch (err) {
    return null;
  }
};
