// src/hooks/usePermission.js
import { useCallback, useMemo } from 'react';

/**
 * 権限チェック用カスタムフック
 * 各アプリ担当者がこのフックを使って権限チェックを実装
 *
 * @param {Object} user - ログインユーザー情報（App.jsxから渡される）
 * @param {Object} roles - ロール定義オブジェクト（App.jsxから渡される）
 * @returns {Object} { hasPermission, hasAnyPermission, hasAllPermissions, isAdmin, userRole }
 */
export const usePermission = (user, roles = {}) => {
  // ユーザーのロールIDを取得（roleId優先、後方互換のためroleも確認）
  const roleId = user?.roleId || user?.role;

  // ユーザーのロール情報を取得
  // rolesオブジェクトの内容変更を検出するため、JSON.stringifyで比較
  const rolesJson = JSON.stringify(roles);
  const userRole = useMemo(() => {
    if (!roleId) return null;
    return roles[roleId] || null;
  }, [roleId, rolesJson]);

  /**
   * 特定の権限を持っているかチェック
   * @param {string} permissionId - 権限ID（例: 'performance-board.settings'）
   * @returns {boolean}
   */
  const hasPermission = useCallback((permissionId) => {
    // 未ログイン
    if (!user || !userRole) return false;

    // adminロール（全権限）
    if (userRole.permissions?.['*'] === true) return true;

    // 個別権限チェック
    return userRole.permissions?.[permissionId] === true;
  }, [user, userRole]);

  /**
   * 複数の権限のうちいずれかを持っているかチェック
   * @param {string[]} permissionIds - 権限IDの配列
   * @returns {boolean}
   */
  const hasAnyPermission = useCallback((permissionIds) => {
    return permissionIds.some(id => hasPermission(id));
  }, [hasPermission]);

  /**
   * 複数の権限を全て持っているかチェック
   * @param {string[]} permissionIds - 権限IDの配列
   * @returns {boolean}
   */
  const hasAllPermissions = useCallback((permissionIds) => {
    return permissionIds.every(id => hasPermission(id));
  }, [hasPermission]);

  /**
   * 管理者かどうか
   */
  const isAdmin = useMemo(() => {
    return userRole?.permissions?.['*'] === true;
  }, [userRole]);

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAdmin,
    userRole,
  };
};

/**
 * 権限チェックのヘルパー関数（フック外で使用する場合）
 * @param {Object} user - ユーザー情報
 * @param {Object} roles - ロール定義
 * @param {string} permissionId - 権限ID
 * @returns {boolean}
 */
export const checkPermission = (user, roles, permissionId) => {
  // roleId優先、後方互換のためroleも確認
  const roleId = user?.roleId || user?.role;
  if (!roleId || !roles) return false;

  const userRole = roles[roleId];
  if (!userRole) return false;

  // adminロール（全権限）
  if (userRole.permissions?.['*'] === true) return true;

  // 個別権限チェック
  return userRole.permissions?.[permissionId] === true;
};

export default usePermission;
