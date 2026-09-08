// src/apps/index.js
// アプリレジストリ - 新しいアプリを追加する場合はここに登録

import { Table } from 'lucide-react';

// --- 権限定義の動的読み込み用ストレージ ---
// 各アプリが起動時に自分の権限定義を登録する
let _appPermissions = {};

// 権限定義を登録する関数（各アプリのindex.jsxから呼び出される）
export const registerAppPermissions = (appId, permissions) => {
    _appPermissions[appId] = permissions;
};

// 登録された権限定義を取得
export const getAppPermissions = () => _appPermissions;

// 全権限をフラット化して取得するヘルパー
export const getAllPermissions = () => {
    const permissions = [];
    Object.values(_appPermissions).forEach(app => {
        app.features.forEach(feature => {
            permissions.push({
                ...feature,
                appId: app.appId,
                appName: app.appName,
            });
        });
    });
    return permissions;
};

// 単独版のため実績ボードのみ登録。
// 単独版に含まれないアプリは分離元リポジトリ側にある。
export const APP_REGISTRY = [
  {
    id: 'performance-board',
    name: '実績ボード',
    icon: Table,
    component: () => import('./performance-board'),
    description: '実績データ集計テーブル',
    enabled: true,
  },
];

// 有効なアプリのみを取得
export const getEnabledApps = () => APP_REGISTRY.filter(app => app.enabled);

// IDからアプリを取得
export const getAppById = (id) => APP_REGISTRY.find(app => app.id === id);

// ボード表示名を取得（カスタム名 > デフォルト名）
export const getBoardDisplayName = (boardId, globalSettings) => {
    const customName = globalSettings?.boardNames?.[boardId];
    if (customName && customName.trim()) {
        return customName;
    }
    const app = APP_REGISTRY.find(a => a.id === boardId);
    return app?.name || boardId;
};
