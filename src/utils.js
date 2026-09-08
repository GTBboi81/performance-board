// src/utils.js
import { DEFAULT_API_KEY, DEFAULT_DASHBOARD_CONFIG, DEFAULT_ACCOUNTS, DEFAULT_GLOBAL_SETTINGS, DEFAULT_ROLES } from './constants';

// ディレクトリごとに個別のストレージプレフィックスを生成（export）
export const getStoragePrefix = () => {
  const path = window.location.pathname.replace(/\/[^/]*$/, '') || '/';
  return `gd_${path}_`;
};

// ディレクトリごとに個別のストレージキーを生成
const getStorageKey = () => {
  return `${getStoragePrefix()}auth`;
};

// --- 認証情報（ログイン状態）の管理 ---
export const loadAuthData = () => {
  try {
    const stored = localStorage.getItem(getStorageKey());
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load auth', e);
  }
  return null;
};

export const saveAuthData = (user) => {
  try {
    if (user) {
      localStorage.setItem(getStorageKey(), JSON.stringify(user));
    } else {
      localStorage.removeItem(getStorageKey());
    }
  } catch (e) {
    console.warn('Failed to save auth', e);
  }
};

let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };
const handleUnauthorized = (message = 'セッションの有効期限が切れました。再度ログインしてください。') => {
  alert(message);
  if (onUnauthorized) onUnauthorized();
};

// --- ダッシュボード設定の管理 ---

// アカウントデータのマイグレーション（role → roleId）
export const migrateAccountData = (accounts) => {
  if (!accounts) return accounts;
  const migrated = {};
  Object.entries(accounts).forEach(([id, account]) => {
    migrated[id] = {
      ...account,
      roleId: account.roleId || account.role || 'viewer',
    };
    // 旧フィールドを削除
    if (migrated[id].role !== undefined) {
      delete migrated[id].role;
    }
  });
  return migrated;
};

// 初期設定データの構造
const INITIAL_CONFIG = {
  apiKey: DEFAULT_API_KEY,
  activeId: 'default',
  dashboards: {
    'default': DEFAULT_DASHBOARD_CONFIG
  },
  accounts: DEFAULT_ACCOUNTS,
  roles: DEFAULT_ROLES
};

export const fetchServerConfig = async () => {
  try {
    // PHPを経由してconfig.jsonを読み込む（.jsonファイルへの直接アクセスが403になるサーバー対応）
    const response = await fetch(`./save_config.php?t=${Date.now()}`, { cache: "no-store" });
    if (response.status === 401) {
      handleUnauthorized();
      return INITIAL_CONFIG;
    }
    if (response.ok) {
      const data = await response.json();
      if (data?.globalSettings && !data.dashboards) {
        return {
          ...INITIAL_CONFIG,
          globalSettings: { ...DEFAULT_GLOBAL_SETTINGS, ...data.globalSettings },
        };
      }
      if (data && data.dashboards) {
        // アカウントデータのマイグレーション（role → roleId）
        if (data.accounts) {
          data.accounts = migrateAccountData(data.accounts);
        }
        // rolesがない場合はデフォルトを設定
        if (!data.roles) {
          data.roles = DEFAULT_ROLES;
        }
        return { ...INITIAL_CONFIG, ...data };
      }
    }
  } catch (e) {
    // fetch error - use default
  }
  return INITIAL_CONFIG;
};

export const saveServerConfig = async (data) => {
  try {
    const response = await fetch('./save_config.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    return true;
  } catch (e) {
    console.error('Failed to save config to server:', e);
    alert("設定の保存に失敗しました。サーバーの 'config.json' またはフォルダへの書き込み権限を確認してください。");
    return false;
  }
};

// マージ保存: 最新configを取得→mergeFnで変更部分だけマージ→保存
// 複数ユーザー/タブからの同時保存による設定上書きを防止
export const saveConfigMerged = async (mergeFn) => {
  try {
    // GET失敗時は保存を中断（INITIAL_CONFIGで上書きしない）
    const res = await fetch(`./save_config.php?t=${Date.now()}`, { cache: "no-store" });
    if (res.status === 401) {
      handleUnauthorized();
      return false;
    }
    if (!res.ok) throw new Error('Failed to fetch latest config');
    const data = await res.json();
    // config.json 未作成時（{status:'empty'}等）のみ INITIAL_CONFIG をベースに初期生成
    const latest = (data && data.dashboards) ? { ...INITIAL_CONFIG, ...data } : INITIAL_CONFIG;
    const merged = mergeFn(latest);
    const saveRes = await fetch('./save_config.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
    });
    if (saveRes.status === 401) {
      handleUnauthorized();
      return false;
    }
    if (!saveRes.ok) throw new Error(`Server returned ${saveRes.status}`);
    const saveData = await saveRes.json();
    if (saveData?.loggedOut) {
      handleUnauthorized('ログイン中のアカウントが削除されました。ログイン画面に戻ります。');
    }
    return true;
  } catch (e) {
    console.error('Failed to save config:', e);
    alert("設定の保存に失敗しました。サーバーの 'config.json' またはフォルダへの書き込み権限を確認してください。");
    return false;
  }
};
