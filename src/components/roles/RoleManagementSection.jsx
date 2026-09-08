// src/components/roles/RoleManagementSection.jsx
import React, { useState, useMemo } from 'react';
import {
  Shield,
  ShieldCheck,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Check,
  Square,
  Lock,
  Edit2,
  Save,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  UserCheck,
  Users,
  Briefcase,
  Star,
  Crown,
  Zap,
  Heart,
  Award,
  Target,
  Bookmark,
  Flag,
  Coffee,
  Headphones
} from 'lucide-react';
import { getAppPermissions } from '../../apps';

// ロール用アイコン一覧（エクスポート）
export const ROLE_ICONS = [
  { id: 'shield', icon: Shield, label: 'シールド' },
  { id: 'shieldCheck', icon: ShieldCheck, label: 'シールド（チェック）' },
  { id: 'eye', icon: Eye, label: '閲覧' },
  { id: 'userCheck', icon: UserCheck, label: 'ユーザー（チェック）' },
  { id: 'users', icon: Users, label: 'ユーザーグループ' },
  { id: 'briefcase', icon: Briefcase, label: 'ブリーフケース' },
  { id: 'star', icon: Star, label: 'スター' },
  { id: 'crown', icon: Crown, label: '王冠' },
  { id: 'zap', icon: Zap, label: '稲妻' },
  { id: 'heart', icon: Heart, label: 'ハート' },
  { id: 'award', icon: Award, label: '賞' },
  { id: 'target', icon: Target, label: 'ターゲット' },
  { id: 'bookmark', icon: Bookmark, label: 'ブックマーク' },
  { id: 'flag', icon: Flag, label: 'フラグ' },
  { id: 'coffee', icon: Coffee, label: 'コーヒー' },
  { id: 'headphones', icon: Headphones, label: 'ヘッドフォン' },
];

// ロールのアイコンを取得するヘルパー関数（エクスポート）
export const getRoleIconComponent = (roleId, role) => {
  // adminは固定でShieldCheck
  if (roleId === 'admin') return ShieldCheck;
  // アイコンが設定されている場合はそれを使用
  if (role?.icon) {
    const found = ROLE_ICONS.find(i => i.id === role.icon);
    if (found) return found.icon;
  }
  // デフォルトはShield
  return Shield;
};

const RoleManagementSection = ({
  theme = 'dark',
  glassClass,
  roles = {},
  updateRoles,
  dashboards,
  updateDashboards
}) => {
  // 新規ロール追加用のstate
  const [newRoleId, setNewRoleId] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');

  // 展開されているロールID
  const [expandedRoles, setExpandedRoles] = useState({});

  // 編集中のロールID
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [editingRoleName, setEditingRoleName] = useState('');
  const [editingRoleDescription, setEditingRoleDescription] = useState('');
  const [editingRoleIcon, setEditingRoleIcon] = useState('shield');

  // アイコンピッカー表示状態
  const [iconPickerOpen, setIconPickerOpen] = useState(null);

  // ロールパスワード表示状態
  const [showRolePassword, setShowRolePassword] = useState({});

  // モジュール展開状態（key: `${roleId}_${appId}_${moduleId}`）
  const [expandedModules, setExpandedModules] = useState({});

  // 各アプリから動的に登録された権限定義を取得
  const appPermissions = useMemo(() => getAppPermissions(), []);

  // テーマ別スタイル
  const textClass = theme === 'dark' ? 'text-white' : 'text-gray-800';
  const textMutedClass = theme === 'dark' ? 'text-white/60' : 'text-gray-500';
  const inputClass = theme === 'dark'
    ? 'bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-sky-500/50'
    : 'bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 focus:border-sky-500';
  const cardClass = theme === 'dark'
    ? 'bg-white/5 border-white/10'
    : 'bg-gray-50 border-gray-200';

  // ダッシュボードのロール表示権限をトグル
  const toggleDashboardRole = (dashboardId, roleId) => {
    if (!dashboards || !updateDashboards) return;
    const dashboard = dashboards[dashboardId];
    if (!dashboard) return;
    const current = dashboard.allowedRoles || [];
    let newRoles;
    if (current.length === 0) {
      // 全許可→この1ロールだけ除外: 他の非adminロール全部をallowedRolesに入れる
      const allNonAdminRoleIds = Object.entries(roles)
        .filter(([, r]) => r.permissions?.['*'] !== true)
        .map(([id]) => id);
      newRoles = allNonAdminRoleIds.filter(r => r !== roleId);
    } else if (current.includes(roleId)) {
      newRoles = current.filter(r => r !== roleId);
    } else {
      newRoles = [...current, roleId];
    }
    // 全非adminロールが含まれていたら空配列（全許可）にリセット
    const allNonAdminRoleIds = Object.entries(roles)
      .filter(([, r]) => r.permissions?.['*'] !== true)
      .map(([id]) => id);
    if (allNonAdminRoleIds.length > 0 && allNonAdminRoleIds.every(id => newRoles.includes(id))) {
      newRoles = [];
    }
    const updatedDashboards = {
      ...dashboards,
      [dashboardId]: { ...dashboard, allowedRoles: newRoles }
    };
    updateDashboards(updatedDashboards);
  };

  // ダッシュボードがロールに表示されるかチェック
  const isDashboardVisibleToRole = (dashboardId, roleId) => {
    if (!dashboards) return true;
    const dashboard = dashboards[dashboardId];
    if (!dashboard) return true;
    const allowedRoles = dashboard.allowedRoles || [];
    if (allowedRoles.length === 0) return true;
    return allowedRoles.includes(roleId);
  };

  // ロールを追加
  const addRole = () => {
    if (!newRoleId.trim() || !newRoleName.trim()) {
      alert('ロールIDとロール名は必須です');
      return;
    }
    // 英数字とハイフン、アンダースコアのみ許可
    if (!/^[a-zA-Z0-9_-]+$/.test(newRoleId)) {
      alert('ロールIDは英数字、ハイフン、アンダースコアのみ使用できます');
      return;
    }
    if (roles[newRoleId]) {
      alert('このロールIDは既に使用されています');
      return;
    }

    const newRoles = {
      ...roles,
      [newRoleId]: {
        id: newRoleId,
        name: newRoleName,
        description: newRoleDescription,
        isSystem: false,
        permissions: {}
      }
    };
    updateRoles(newRoles);
    setNewRoleId('');
    setNewRoleName('');
    setNewRoleDescription('');
  };

  // ロールを削除
  const deleteRole = (roleId) => {
    if (roles[roleId]?.isSystem) {
      alert('システムロールは削除できません');
      return;
    }
    if (!confirm(`ロール "${roles[roleId]?.name}" を削除しますか？`)) return;

    const newRoles = { ...roles };
    delete newRoles[roleId];
    updateRoles(newRoles);
  };

  // ロールの展開/折りたたみを切り替え
  const toggleRoleExpand = (roleId) => {
    setExpandedRoles(prev => ({
      ...prev,
      [roleId]: !prev[roleId]
    }));
  };

  // adminロールかどうかをチェック（adminのみ権限編集不可）
  const isAdminRole = (roleId) => roleId === 'admin';

  // 権限を切り替え（admin以外は編集可能）
  const togglePermission = (roleId, permissionId) => {
    if (isAdminRole(roleId)) return;

    const currentPermissions = roles[roleId]?.permissions || {};
    const newPermissions = {
      ...currentPermissions,
      [permissionId]: !currentPermissions[permissionId]
    };

    // falseの場合は削除してオブジェクトをクリーンに保つ
    if (!newPermissions[permissionId]) {
      delete newPermissions[permissionId];
    }

    const newRoles = {
      ...roles,
      [roleId]: {
        ...roles[roleId],
        permissions: newPermissions
      }
    };
    updateRoles(newRoles);
  };

  // アプリ全体の権限を一括切り替え（admin以外は編集可能）
  const toggleAppPermissions = (roleId, appId, enable) => {
    if (isAdminRole(roleId)) return;

    const appConfig = appPermissions[appId];
    if (!appConfig) return;

    const currentPermissions = { ...roles[roleId]?.permissions } || {};

    appConfig.features.forEach(feature => {
      if (enable) {
        currentPermissions[feature.id] = true;
      } else {
        delete currentPermissions[feature.id];
      }
    });

    const newRoles = {
      ...roles,
      [roleId]: {
        ...roles[roleId],
        permissions: currentPermissions
      }
    };
    updateRoles(newRoles);
  };

  // ロール名・説明・アイコンの編集を開始
  const startEditRole = (roleId) => {
    setEditingRoleId(roleId);
    setEditingRoleName(roles[roleId]?.name || '');
    setEditingRoleDescription(roles[roleId]?.description || '');
    setEditingRoleIcon(roles[roleId]?.icon || 'shield');
  };

  // ロール名・説明・アイコンの編集を保存
  const saveEditRole = () => {
    if (!editingRoleName.trim()) {
      alert('ロール名は必須です');
      return;
    }

    const newRoles = {
      ...roles,
      [editingRoleId]: {
        ...roles[editingRoleId],
        name: editingRoleName,
        description: editingRoleDescription,
        icon: editingRoleIcon
      }
    };
    updateRoles(newRoles);
    setEditingRoleId(null);
    setIconPickerOpen(null);
  };

  // ロール名・説明の編集をキャンセル
  const cancelEditRole = () => {
    setEditingRoleId(null);
    setIconPickerOpen(null);
  };

  // ロールのアイコンを更新（展開パネル内から直接）
  const updateRoleIcon = (roleId, iconId) => {
    const newRoles = {
      ...roles,
      [roleId]: {
        ...roles[roleId],
        icon: iconId
      }
    };
    updateRoles(newRoles);
    setIconPickerOpen(null);
  };

  // アイコンを取得するヘルパー関数
  const getRoleIcon = (roleId, role) => {
    // adminは固定でShieldCheck
    if (roleId === 'admin') return ShieldCheck;
    // アイコンが設定されている場合はそれを使用
    if (role.icon) {
      const found = ROLE_ICONS.find(i => i.id === role.icon);
      if (found) return found.icon;
    }
    // デフォルトはShield
    return Shield;
  };

  // モジュールの展開/折りたたみを切り替え
  const toggleModuleExpand = (roleId, appId, moduleId) => {
    const key = `${roleId}_${appId}_${moduleId}`;
    setExpandedModules(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // モジュール内の全権限を一括切り替え
  const toggleModulePermissions = (roleId, appId, moduleId, enable) => {
    if (isAdminRole(roleId)) return;

    const appConfig = appPermissions[appId];
    if (!appConfig) return;

    const moduleFeatures = appConfig.features.filter(f => f.module === moduleId);
    const currentPermissions = { ...roles[roleId]?.permissions } || {};

    moduleFeatures.forEach(feature => {
      if (enable) {
        currentPermissions[feature.id] = true;
      } else {
        delete currentPermissions[feature.id];
      }
    });

    const newRoles = {
      ...roles,
      [roleId]: { ...roles[roleId], permissions: currentPermissions }
    };
    updateRoles(newRoles);
  };

  // モジュール内のいずれかの権限がONかチェック
  const hasAnyModulePermission = (roleId, appId, moduleId) => {
    const appConfig = appPermissions[appId];
    if (!appConfig) return false;
    const permissions = roles[roleId]?.permissions || {};
    return appConfig.features
      .filter(f => f.module === moduleId)
      .some(f => permissions[f.id] === true);
  };

  // モジュール内の全権限がONかチェック
  const hasAllModulePermissions = (roleId, appId, moduleId) => {
    const appConfig = appPermissions[appId];
    if (!appConfig) return false;
    const permissions = roles[roleId]?.permissions || {};
    const moduleFeatures = appConfig.features.filter(f => f.module === moduleId);
    return moduleFeatures.length > 0 && moduleFeatures.every(f => permissions[f.id] === true);
  };

  // ロールがアプリの全権限を持っているかチェック
  const hasAllAppPermissions = (roleId, appId) => {
    const appConfig = appPermissions[appId];
    if (!appConfig) return false;

    const permissions = roles[roleId]?.permissions || {};
    return appConfig.features.every(feature => permissions[feature.id]);
  };

  // --- ボードビュー権限UI描画ヘルパー ---
  const renderDashboardPermissions = (roleId) => {
    if (!dashboards || Object.keys(dashboards).length === 0) return null;
    const isAdmin = isAdminRole(roleId);
    const dashboardList = Object.values(dashboards);
    return (
      <div className={`mt-2 ml-6 pl-3 border-l-2 ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
        <div className={`text-[10px] mb-1.5 ${textMutedClass}`}>ボードビュー表示権限</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
          {dashboardList.map(dashboard => {
            const isVisible = isAdmin || isDashboardVisibleToRole(dashboard.id, roleId);
            return (
              <button
                key={dashboard.id}
                onClick={() => !isAdmin && toggleDashboardRole(dashboard.id, roleId)}
                disabled={isAdmin}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
                  isAdmin
                    ? (theme === 'dark' ? 'bg-sky-500/10 text-sky-300/60 cursor-default' : 'bg-sky-50 text-sky-600/60 cursor-default')
                    : isVisible
                      ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                      : theme === 'dark' ? 'bg-white/5 text-white/40 hover:bg-white/10' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}
                title={dashboard.name}
              >
                {isVisible ? <Check size={10} /> : <Square size={10} />}
                <span className="truncate">{dashboard.name || dashboard.id}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // --- モジュールツリーUI描画ヘルパー ---
  const renderModuleTree = (roleId, appId, appConfig) => {
    const permissions = roles[roleId]?.permissions || {};
    const isAdmin = isAdminRole(roleId);

    return (
      <div className="space-y-1.5">
        {appConfig.modules.map(mod => {
          const key = `${roleId}_${appId}_${mod.id}`;
          const isModuleExpanded = expandedModules[key];
          const moduleOn = hasAnyModulePermission(roleId, appId, mod.id);
          const moduleAllOn = hasAllModulePermissions(roleId, appId, mod.id);
          const moduleFeatures = appConfig.features.filter(f => f.module === mod.id);

          return (
            <div key={mod.id} className={`rounded-lg border overflow-hidden ${
              theme === 'dark'
                ? moduleOn ? 'border-white/15 bg-white/[0.03]' : 'border-white/5 bg-white/[0.01]'
                : moduleOn ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50/50'
            }`}>
              {/* モジュールヘッダー */}
              <div
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                  theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                }`}
                onClick={() => toggleModuleExpand(roleId, appId, mod.id)}
              >
                {/* 展開アイコン */}
                {isModuleExpanded
                  ? <ChevronDown size={14} className={textMutedClass} />
                  : <ChevronRight size={14} className={textMutedClass} />
                }

                {/* モジュール名 */}
                <span className={`text-sm font-medium flex-1 ${
                  moduleOn ? textClass : textMutedClass
                }`}>
                  {mod.name}
                </span>

                {/* ON数 / 全数 */}
                <span className={`text-xs ${textMutedClass}`}>
                  {moduleFeatures.filter(f => permissions[f.id]).length}/{moduleFeatures.length}
                </span>

                {/* モジュールON/OFFトグル */}
                {!isAdmin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleModulePermissions(roleId, appId, mod.id, !moduleOn);
                    }}
                    className={`w-8 h-4.5 rounded-full relative transition-colors flex-shrink-0 ${
                      moduleOn
                        ? 'bg-emerald-500'
                        : theme === 'dark' ? 'bg-white/20' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                      moduleOn ? 'translate-x-4' : 'translate-x-0.5'
                    }`} />
                  </button>
                )}
                {isAdmin && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">全権限</span>
                )}
              </div>

              {/* 展開時: 個別権限チェックボックス */}
              {isModuleExpanded && !isAdmin && (
                <div className={`px-3 pb-2.5 pt-1 border-t ${
                  theme === 'dark' ? 'border-white/5' : 'border-gray-100'
                }`}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {moduleFeatures.map(feature => {
                      const isEnabled = permissions[feature.id] === true;
                      return (
                        <button
                          key={feature.id}
                          onClick={() => togglePermission(roleId, feature.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
                            isEnabled
                              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                              : theme === 'dark' ? 'bg-white/5 text-white/40 hover:bg-white/10' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                          title={feature.description}
                        >
                          {isEnabled ? <Check size={12} /> : <Square size={12} />}
                          <span>{feature.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // 登録されたアプリがあるかチェック
  const hasRegisteredApps = Object.keys(appPermissions).length > 0;

  // システムロールとカスタムロールを分離
  const systemRoles = Object.entries(roles).filter(([_, role]) => role.isSystem);
  const customRoles = Object.entries(roles).filter(([_, role]) => !role.isSystem);

  return (
    <div className={`rounded-2xl p-6 ${glassClass}`}>
      <h3 className={`text-lg font-bold mb-6 flex items-center gap-2 ${textClass}`}>
        <Shield size={20} className="text-purple-400" /> ロール管理
      </h3>
      <p className={`text-sm mb-6 ${textMutedClass}`}>
        ロールを作成し、各アプリの機能へのアクセス権限を設定できます。
      </p>

      {/* 新規ロール追加 */}
      <div className={`rounded-xl border p-4 mb-6 ${cardClass}`}>
        <h4 className={`text-sm font-medium mb-4 flex items-center gap-2 ${textClass}`}>
          <Plus size={16} className="text-purple-400" /> 新規ロール追加
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className={`block text-xs font-medium mb-1 ${textMutedClass}`}>
              ロールID（英数字）
            </label>
            <input
              type="text"
              value={newRoleId}
              onChange={(e) => setNewRoleId(e.target.value)}
              placeholder="manager"
              className={`w-full px-3 py-2 rounded-lg text-sm ${inputClass}`}
            />
          </div>
          <div>
            <label className={`block text-xs font-medium mb-1 ${textMutedClass}`}>ロール名</label>
            <input
              type="text"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="マネージャー"
              className={`w-full px-3 py-2 rounded-lg text-sm ${inputClass}`}
            />
          </div>
          <div>
            <label className={`block text-xs font-medium mb-1 ${textMutedClass}`}>説明（任意）</label>
            <input
              type="text"
              value={newRoleDescription}
              onChange={(e) => setNewRoleDescription(e.target.value)}
              placeholder="設定変更可能な権限"
              className={`w-full px-3 py-2 rounded-lg text-sm ${inputClass}`}
            />
          </div>
        </div>
        <button
          onClick={addRole}
          className="px-4 py-2 bg-purple-500 hover:bg-purple-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Plus size={16} /> ロールを追加
        </button>
      </div>

      {/* システムロール */}
      <div className="mb-6">
        <h4 className={`text-sm font-medium mb-3 flex items-center gap-2 ${textMutedClass}`}>
          <Lock size={14} /> システムロール
        </h4>
        <div className="space-y-3">
          {systemRoles.map(([roleId, role]) => {
            const isExpanded = expandedRoles[roleId];
            const isEditing = editingRoleId === roleId;
            const isAdmin = roleId === 'admin';
            const RoleIcon = getRoleIcon(roleId, role);

            return (
              <div
                key={roleId}
                className={`rounded-xl border ${cardClass} overflow-hidden`}
              >
                {/* ロールヘッダー */}
                <div
                  className={`p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors`}
                  onClick={() => toggleRoleExpand(roleId)}
                >
                  <div className="flex items-center gap-3 flex-1">
                    {/* アイコン（admin以外は変更可能） */}
                    <div className="relative">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isAdmin
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-sky-500/20 text-sky-400'
                        } ${!isAdmin ? 'cursor-pointer hover:ring-2 hover:ring-sky-400/50' : ''}`}
                        onClick={(e) => {
                          if (!isAdmin) {
                            e.stopPropagation();
                            setIconPickerOpen(iconPickerOpen === roleId ? null : roleId);
                          }
                        }}
                        title={!isAdmin ? 'アイコンを変更' : ''}
                      >
                        <RoleIcon size={20} />
                      </div>
                      {/* アイコンピッカー */}
                      {!isAdmin && iconPickerOpen === roleId && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setIconPickerOpen(null); }} />
                          <div
                            className={`absolute top-12 left-0 z-50 p-2 rounded-lg shadow-xl ${
                              theme === 'dark' ? 'bg-slate-800 border border-white/20' : 'bg-white border border-gray-300'
                            }`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="grid grid-cols-4 gap-1" style={{ width: '160px' }}>
                              {ROLE_ICONS.map(iconDef => {
                                const IconComp = iconDef.icon;
                                const isSelected = role.icon === iconDef.id || (!role.icon && iconDef.id === 'shield');
                                return (
                                  <button
                                    key={iconDef.id}
                                    onClick={() => updateRoleIcon(roleId, iconDef.id)}
                                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                                      isSelected
                                        ? 'bg-sky-500/30 text-sky-400 ring-2 ring-sky-500/50'
                                        : theme === 'dark' ? 'hover:bg-white/10 text-white/60' : 'hover:bg-gray-100 text-gray-600'
                                    }`}
                                    title={iconDef.label}
                                  >
                                    <IconComp size={18} />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className={`font-medium ${textClass}`}>{role.name}</div>
                      <div className={`text-xs ${textMutedClass}`}>{role.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      isAdmin
                        ? 'bg-amber-500/20 text-amber-400'
                        : theme === 'dark' ? 'bg-white/10 text-white/50' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {isAdmin ? '管理者' : 'システム'}
                    </span>
                    {isExpanded ? (
                      <ChevronDown size={20} className={textMutedClass} />
                    ) : (
                      <ChevronRight size={20} className={textMutedClass} />
                    )}
                  </div>
                </div>

                {/* 権限設定パネル（システムロール） */}
                {isExpanded && (
                  <div className={`p-4 border-t ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                    {/* ロールパスワード */}
                    <div className="mb-4">
                      <label className={`block text-xs font-medium mb-1 ${textMutedClass}`}>
                        ロールパスワード（SF連携アカウント用）
                      </label>
                      <div className="relative max-w-xs">
                        <input
                          type={showRolePassword[roleId] ? 'text' : 'password'}
                          value={role.password || ''}
                          onChange={(e) => {
                            const newRoles = { ...roles, [roleId]: { ...roles[roleId], password: e.target.value } };
                            updateRoles(newRoles);
                          }}
                          placeholder="変更する場合のみ入力"
                          className={`w-full px-2.5 py-1.5 pr-8 rounded-lg text-sm ${inputClass}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowRolePassword(prev => ({ ...prev, [roleId]: !prev[roleId] }))}
                          className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded ${textMutedClass} hover:opacity-70`}
                        >
                          {showRolePassword[roleId] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      <p className={`text-xs mt-1 ${textMutedClass}`}>
                        このロールに紐づくSF連携アカウントのログインパスワードとして使用されます
                      </p>
                    </div>

                    {!isAdmin && (<>
                    <h5 className={`text-sm font-medium mb-4 ${textClass}`}>機能権限設定</h5>
                    {!hasRegisteredApps ? (
                      <div className={`text-center py-6 rounded-lg border ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                        <AlertCircle size={24} className={`mx-auto mb-2 ${textMutedClass}`} />
                        <p className={`text-sm ${textMutedClass}`}>権限定義が登録されていません</p>
                        <p className={`text-xs ${textMutedClass} mt-1`}>各アプリが起動時に権限を登録します</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(appPermissions).map(([appId, appConfig]) => {
                          const allEnabled = hasAllAppPermissions(roleId, appId);
                          const permissions = role.permissions || {};

                          return (
                            <div key={appId} className={`rounded-lg border p-3 ${
                              theme === 'dark' ? 'border-white/10' : 'border-gray-200'
                            }`}>
                              {/* アプリヘッダー */}
                              <div className="flex items-center justify-between mb-3">
                                <span className={`font-medium text-sm ${textClass}`}>
                                  {appConfig.appName}
                                </span>
                                <button
                                  onClick={() => toggleAppPermissions(roleId, appId, !allEnabled)}
                                  className={`text-xs px-2 py-1 rounded transition-colors ${
                                    allEnabled
                                      ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                      : theme === 'dark' ? 'bg-white/10 text-white/50 hover:bg-white/20' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                                  }`}
                                >
                                  {allEnabled ? '全て解除' : '全て許可'}
                                </button>
                              </div>

                              {/* 権限表示: モジュールツリー / カテゴリ / フラット */}
                              {appConfig.modules && appConfig.modules.length > 0 ? (
                                renderModuleTree(roleId, appId, appConfig)
                              ) : (
                                <div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {appConfig.features.map(feature => {
                                      const isEnabled = permissions[feature.id] === true;
                                      return (
                                        <button
                                          key={feature.id}
                                          onClick={() => togglePermission(roleId, feature.id)}
                                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                                            isEnabled
                                              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                              : theme === 'dark' ? 'bg-white/5 text-white/40 hover:bg-white/10' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                          }`}
                                          title={feature.description}
                                        >
                                          {isEnabled ? <Check size={14} /> : <Square size={14} />}
                                          <span className="truncate">{feature.name}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                  {appId === 'analytics' && renderDashboardPermissions(roleId)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    </>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* カスタムロール */}
      <div>
        <h4 className={`text-sm font-medium mb-3 flex items-center gap-2 ${textMutedClass}`}>
          <Shield size={14} /> カスタムロール
        </h4>
        {customRoles.length === 0 ? (
          <div className={`text-center py-8 rounded-xl border ${cardClass}`}>
            <Shield size={32} className={`mx-auto mb-3 ${textMutedClass}`} />
            <p className={`text-sm ${textMutedClass}`}>カスタムロールがありません</p>
            <p className={`text-xs ${textMutedClass}`}>上のフォームから新規ロールを追加してください</p>
          </div>
        ) : (
          <div className="space-y-3">
            {customRoles.map(([roleId, role]) => {
              const isExpanded = expandedRoles[roleId];
              const isEditing = editingRoleId === roleId;

              return (
                <div
                  key={roleId}
                  className={`rounded-xl border ${cardClass} overflow-hidden`}
                >
                  {/* ロールヘッダー */}
                  <div
                    className={`p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors`}
                    onClick={() => toggleRoleExpand(roleId)}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {/* アイコン（変更可能） */}
                      <div className="relative">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center bg-purple-500/20 text-purple-400 cursor-pointer hover:ring-2 hover:ring-purple-400/50`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setIconPickerOpen(iconPickerOpen === roleId ? null : roleId);
                          }}
                          title="アイコンを変更"
                        >
                          {(() => {
                            const RoleIcon = getRoleIcon(roleId, role);
                            return <RoleIcon size={20} />;
                          })()}
                        </div>
                        {/* アイコンピッカー */}
                        {iconPickerOpen === roleId && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setIconPickerOpen(null); }} />
                            <div
                              className={`absolute top-12 left-0 z-50 p-2 rounded-lg shadow-xl ${
                                theme === 'dark' ? 'bg-slate-800 border border-white/20' : 'bg-white border border-gray-300'
                              }`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="grid grid-cols-4 gap-1" style={{ width: '160px' }}>
                                {ROLE_ICONS.map(iconDef => {
                                  const IconComp = iconDef.icon;
                                  const isSelected = role.icon === iconDef.id || (!role.icon && iconDef.id === 'shield');
                                  return (
                                    <button
                                      key={iconDef.id}
                                      onClick={() => updateRoleIcon(roleId, iconDef.id)}
                                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                                        isSelected
                                          ? 'bg-purple-500/30 text-purple-400 ring-2 ring-purple-500/50'
                                          : theme === 'dark' ? 'hover:bg-white/10 text-white/60' : 'hover:bg-gray-100 text-gray-600'
                                      }`}
                                      title={iconDef.label}
                                    >
                                      <IconComp size={18} />
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="flex-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editingRoleName}
                            onChange={(e) => setEditingRoleName(e.target.value)}
                            className={`px-2 py-1 rounded text-sm ${inputClass}`}
                            placeholder="ロール名"
                          />
                          <input
                            type="text"
                            value={editingRoleDescription}
                            onChange={(e) => setEditingRoleDescription(e.target.value)}
                            className={`px-2 py-1 rounded text-sm flex-1 ${inputClass}`}
                            placeholder="説明"
                          />
                          <button
                            onClick={saveEditRole}
                            className="p-1.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                          >
                            <Save size={14} />
                          </button>
                          <button
                            onClick={cancelEditRole}
                            className="p-1.5 rounded bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex-1">
                          <div className={`font-medium ${textClass}`}>{role.name}</div>
                          <div className={`text-xs ${textMutedClass}`}>
                            {role.description || `ID: ${roleId}`}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!isEditing && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); startEditRole(roleId); }}
                            className={`p-1.5 rounded transition-colors ${
                              theme === 'dark' ? 'bg-white/10 text-white/50 hover:bg-white/20' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                            }`}
                            title="編集"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteRole(roleId); }}
                            className={`p-1.5 rounded transition-colors ${
                              theme === 'dark' ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30' : 'bg-rose-100 text-rose-500 hover:bg-rose-200'
                            }`}
                            title="削除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                      {isExpanded ? (
                        <ChevronDown size={20} className={textMutedClass} />
                      ) : (
                        <ChevronRight size={20} className={textMutedClass} />
                      )}
                    </div>
                  </div>

                  {/* 権限設定パネル */}
                  {isExpanded && (
                    <div className={`p-4 border-t ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                      {/* ロールパスワード */}
                      <div className="mb-4">
                        <label className={`block text-xs font-medium mb-1 ${textMutedClass}`}>
                          ロールパスワード（SF連携アカウント用）
                        </label>
                        <div className="relative max-w-xs">
                          <input
                            type={showRolePassword[roleId] ? 'text' : 'password'}
                            value={role.password || ''}
                            onChange={(e) => {
                              const newRoles = { ...roles, [roleId]: { ...roles[roleId], password: e.target.value } };
                              updateRoles(newRoles);
                            }}
                            placeholder="変更する場合のみ入力"
                            className={`w-full px-2.5 py-1.5 pr-8 rounded-lg text-sm ${inputClass}`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowRolePassword(prev => ({ ...prev, [roleId]: !prev[roleId] }))}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded ${textMutedClass} hover:opacity-70`}
                          >
                            {showRolePassword[roleId] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                        <p className={`text-xs mt-1 ${textMutedClass}`}>
                          このロールに紐づくSF連携アカウントのログインパスワードとして使用されます
                        </p>
                      </div>

                      <h5 className={`text-sm font-medium mb-4 ${textClass}`}>機能権限設定</h5>
                      {!hasRegisteredApps ? (
                        <div className={`text-center py-6 rounded-lg border ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                          <AlertCircle size={24} className={`mx-auto mb-2 ${textMutedClass}`} />
                          <p className={`text-sm ${textMutedClass}`}>権限定義が登録されていません</p>
                          <p className={`text-xs ${textMutedClass} mt-1`}>各アプリが起動時に権限を登録します</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {Object.entries(appPermissions).map(([appId, appConfig]) => {
                            const allEnabled = hasAllAppPermissions(roleId, appId);
                            const permissions = role.permissions || {};

                            return (
                              <div key={appId} className={`rounded-lg border p-3 ${
                                theme === 'dark' ? 'border-white/10' : 'border-gray-200'
                              }`}>
                                {/* アプリヘッダー */}
                                <div className="flex items-center justify-between mb-3">
                                  <span className={`font-medium text-sm ${textClass}`}>
                                    {appConfig.appName}
                                  </span>
                                  <button
                                    onClick={() => toggleAppPermissions(roleId, appId, !allEnabled)}
                                    className={`text-xs px-2 py-1 rounded transition-colors ${
                                      allEnabled
                                        ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                        : theme === 'dark' ? 'bg-white/10 text-white/50 hover:bg-white/20' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                                    }`}
                                  >
                                    {allEnabled ? '全て解除' : '全て許可'}
                                  </button>
                                </div>

                                {/* 権限表示: モジュールツリー / フラット */}
                                {appConfig.modules && appConfig.modules.length > 0 ? (
                                  renderModuleTree(roleId, appId, appConfig)
                                ) : (
                                  <div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                      {appConfig.features.map(feature => {
                                        const isEnabled = permissions[feature.id] === true;
                                        return (
                                          <button
                                            key={feature.id}
                                            onClick={() => togglePermission(roleId, feature.id)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                                              isEnabled
                                                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                                : theme === 'dark' ? 'bg-white/5 text-white/40 hover:bg-white/10' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                            }`}
                                            title={feature.description}
                                          >
                                            {isEnabled ? <Check size={14} /> : <Square size={14} />}
                                            <span className="truncate">{feature.name}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                    {appId === 'analytics' && renderDashboardPermissions(roleId)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleManagementSection;
