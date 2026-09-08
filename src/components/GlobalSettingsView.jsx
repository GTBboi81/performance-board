// src/components/GlobalSettingsView.jsx
import React, { useState, useRef, useEffect } from 'react';
import {
  Settings,
  Image,
  Upload,
  Trash2,
  Users,
  UserPlus,
  Eye,
  EyeOff,
  Plus,
  Check,
  Square,
  Info,
  X,
  AlertCircle,
  Save,
  CheckCircle,
  LayoutGrid,
  Type,
  Shield,
  Cloud,
  Download,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Filter
} from 'lucide-react';
import { APP_REGISTRY } from '../apps';
import RoleManagementSection, { getRoleIconComponent } from './roles/RoleManagementSection';
import salesforceApi from '../apps/performance-board/services/salesforceApi';

const GlobalSettingsView = ({
  glassClass,
  theme = 'dark',
  globalSettings = {},
  updateGlobalSettings,
  accounts = {},
  updateAccounts,
  roles = {},
  updateRoles,
  allDashboards = {},
  updateDashboards
}) => {
  // アカウント管理用のstate
  const [newAccountId, setNewAccountId] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountPassword, setNewAccountPassword] = useState('');
  const [newAccountRole, setNewAccountRole] = useState('viewer');
  const [editingAccount, setEditingAccount] = useState(null);
  const [showPassword, setShowPassword] = useState({});

  // タブ管理
  const [activeTab, setActiveTab] = useState('app');

  // SF同期用state
  const [sfSyncStep, setSfSyncStep] = useState('idle'); // idle|loading|preview|executing|done|error
  const [sfSyncPreview, setSfSyncPreview] = useState(null);
  const [sfSyncError, setSfSyncError] = useState('');
  const [sfSyncResult, setSfSyncResult] = useState(null);
  const [sfPreviewExpanded, setSfPreviewExpanded] = useState({ create: true, delete: true, skip: false });

  // 会社名フィルター
  const [sfCompanyFilter, setSfCompanyFilter] = useState([]); // 除外する会社名の配列
  const [sfCompanies, setSfCompanies] = useState([]);          // SF取得結果から抽出した全会社名一覧

  // チェックボックス選択（新規作成対象のみ）
  const [sfSelectedIds, setSfSelectedIds] = useState(new Set());

  // 保存状態
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saved'

  // ロゴアップロード用のref
  const logoLightInputRef = useRef(null);
  const logoDarkInputRef = useRef(null);

  // 保存完了表示をリセット
  useEffect(() => {
    if (saveStatus === 'saved') {
      const timer = setTimeout(() => setSaveStatus('idle'), 2000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  // テーマ別スタイル
  const textClass = theme === 'dark' ? 'text-white' : 'text-gray-800';
  const textMutedClass = theme === 'dark' ? 'text-white/60' : 'text-gray-500';
  const inputClass = theme === 'dark'
    ? 'bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-sky-500/50'
    : 'bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 focus:border-sky-500';
  const cardClass = theme === 'dark'
    ? 'bg-white/5 border-white/10'
    : 'bg-gray-50 border-gray-200';
  const optionClass = theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-white text-gray-800';

  const dashboardList = Object.values(allDashboards || {});

  // ロゴ画像をBase64に変換
  const handleLogoUpload = (type, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // ファイルサイズチェック（200KB）
    if (file.size > 200 * 1024) {
      alert('ファイルサイズは200KB以下にしてください');
      return;
    }

    // 画像タイプチェック
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      updateGlobalSettings({
        ...globalSettings,
        [type]: base64
      });
    };
    reader.readAsDataURL(file);
  };

  // ロゴを削除
  const handleLogoRemove = (type) => {
    updateGlobalSettings({
      ...globalSettings,
      [type]: null
    });
  };

  // アプリ名を更新
  const handleAppNameChange = (value) => {
    updateGlobalSettings({
      ...globalSettings,
      appName: value
    });
  };

  // アカウントを追加
  const addAccount = () => {
    if (!newAccountId.trim() || !newAccountName.trim() || !newAccountPassword.trim()) {
      alert('ユーザーID、表示名、パスワードは必須です');
      return;
    }
    if (accounts[newAccountId]) {
      alert('このユーザーIDは既に使用されています');
      return;
    }
    const newAccounts = {
      ...accounts,
      [newAccountId]: {
        password: newAccountPassword,
        name: newAccountName,
        roleId: newAccountRole,  // role → roleId
        dashboardAccess: []
      }
    };
    updateAccounts(newAccounts);
    setNewAccountId('');
    setNewAccountName('');
    setNewAccountPassword('');
    setNewAccountRole('viewer');
  };

  // アカウントを削除
  const deleteAccount = (accountId) => {
    if (accountId === 'admin') {
      alert('adminアカウントは削除できません');
      return;
    }
    if (!confirm(`アカウント "${accountId}" を削除しますか？`)) return;
    const newAccounts = { ...accounts };
    delete newAccounts[accountId];
    updateAccounts(newAccounts);
  };

  // アカウント情報を更新
  const updateAccount = (accountId, field, value) => {
    const newAccounts = {
      ...accounts,
      [accountId]: {
        ...accounts[accountId],
        [field]: value
      }
    };
    updateAccounts(newAccounts);
  };

  // ダッシュボードアクセス権を切り替え
  const toggleDashboardAccess = (accountId, dashboardId) => {
    const currentAccess = accounts[accountId]?.dashboardAccess || [];
    let newAccess;
    if (currentAccess.includes(dashboardId)) {
      newAccess = currentAccess.filter(id => id !== dashboardId);
    } else {
      newAccess = [...currentAccess, dashboardId];
    }
    updateAccount(accountId, 'dashboardAccess', newAccess);
  };

  // 全ダッシュボードへのアクセス権を設定
  const setAllDashboardAccess = (accountId, grantAll) => {
    if (grantAll) {
      updateAccount(accountId, 'dashboardAccess', []);
    } else {
      updateAccount(accountId, 'dashboardAccess', dashboardList.map(d => d.id));
    }
  };

  // ボード非表示を切り替え
  const toggleBoardVisibility = (boardId) => {
    const currentHidden = globalSettings.hiddenBoards || [];
    let newHidden;
    if (currentHidden.includes(boardId)) {
      newHidden = currentHidden.filter(id => id !== boardId);
    } else {
      newHidden = [...currentHidden, boardId];
    }
    updateGlobalSettings({
      ...globalSettings,
      hiddenBoards: newHidden
    });
  };

  // 手動保存ボタン（実際には自動保存されているが、視覚的なフィードバック用）
  const handleManualSave = () => {
    // updateGlobalSettingsとupdateAccountsは既に自動保存されているため、
    // ここでは保存完了表示のみ
    setSaveStatus('saved');
  };

  // SF獲得者取り込み: プレビュー生成
  const handleSfSync = async () => {
    setSfSyncStep('loading');
    setSfSyncError('');
    setSfSyncPreview(null);
    setSfSyncResult(null);

    try {
      const result = await salesforceApi.queryRecords(
        'CustomObject10__c',
        ['Id', 'Field11__c', 'Field3__c', 'Field4__c', 'Field18__c', 'Field20__c', 'Field23__c', 'Field16__c', 'Field10__c'],
        { limitCount: 2000 }
      );

      if (result.status !== 'success') {
        throw new Error('Salesforceからのデータ取得に失敗しました');
      }

      const records = result.records || [];

      // 会社名一覧を抽出
      const companySet = new Set();
      for (const rec of records) {
        if (rec.Field10__c) companySet.add(rec.Field10__c);
      }
      setSfCompanies([...companySet].sort());

      const toCreate = [];
      const toDelete = [];
      const unchanged = [];
      const skipped = [];

      const existingSfIds = new Set(
        Object.entries(accounts).filter(([, acc]) => acc.sfSync).map(([id]) => id)
      );
      const processedIds = new Set();

      for (const rec of records) {
        const objId = rec.Field11__c;
        if (!objId || objId.trim() === '') {
          skipped.push({ name: rec.Field20__c || rec.Name || '(不明)', reason: 'OBJIDが空です' });
          continue;
        }

        // 会社名フィルター: 除外対象の会社名ならスキップ
        if (sfCompanyFilter.length > 0 && rec.Field10__c && sfCompanyFilter.includes(rec.Field10__c)) {
          skipped.push({ name: `${rec.Field3__c || ''} ${rec.Field4__c || ''}`.trim() || rec.Field20__c || objId, reason: `会社「${rec.Field10__c}」は対象外` });
          continue;
        }

        const id = objId.trim();
        processedIds.add(id);
        const hasRetirement = rec.Field23__c != null && rec.Field23__c !== '';
        const existing = accounts[id];

        if (existing) {
          if (existing.sfSync) {
            if (hasRetirement) {
              toDelete.push({ accountId: id, name: existing.name, retirementDate: rec.Field23__c, position: rec.Field18__c || '' });
            } else {
              unchanged.push({ accountId: id, name: existing.name, position: rec.Field18__c || '' });
            }
          } else {
            if (!hasRetirement) {
              skipped.push({ name: `${rec.Field3__c || ''} ${rec.Field4__c || ''}`.trim(), reason: `手動アカウント「${id}」と重複` });
            }
          }
        } else {
          if (!hasRetirement) {
            toCreate.push({
              accountId: id,
              name: `${rec.Field3__c || ''} ${rec.Field4__c || ''}`.trim() || rec.Field20__c || id,
              position: rec.Field18__c || '',
              status: rec.Field16__c || '',
              company: rec.Field10__c || ''
            });
          }
        }
      }

      // SF上から消えたレコードの既存SF連携アカウントも削除対象
      // ただしtotalSize>=2000の場合は取得漏れの可能性があるため、未検出削除をスキップ
      const isComplete = (result.totalSize || 0) < 2000;
      if (isComplete) {
        for (const sfId of existingSfIds) {
          if (!processedIds.has(sfId)) {
            toDelete.push({ accountId: sfId, name: accounts[sfId].name, retirementDate: null, position: '', reason: 'SFレコード未検出' });
          }
        }
      }

      if (!isComplete) {
        setSfSyncError('獲得者レコードが2000件を超えています。一部取得できていない可能性があるため、SF未検出による削除はスキップされます。');
      }

      setSfSyncPreview({ toCreate, toDelete, unchanged, skipped });
      setSfPreviewExpanded({ create: toCreate.length > 0, delete: toDelete.length > 0, skip: false });
      // デフォルト全選択
      setSfSelectedIds(new Set(toCreate.map(item => item.accountId)));
      setSfSyncStep('preview');
    } catch (err) {
      setSfSyncError(err.message || 'SF取り込みに失敗しました');
      setSfSyncStep('error');
    }
  };

  // SF獲得者取り込み: 実行
  const executeSfSync = () => {
    if (!sfSyncPreview) return;
    setSfSyncStep('executing');
    try {
      const newAccounts = { ...accounts };
      const now = new Date().toISOString();

      const selectedToCreate = sfSyncPreview.toCreate.filter(i => sfSelectedIds.has(i.accountId));
      for (const item of selectedToCreate) {
        newAccounts[item.accountId] = {
          password: '',
          name: item.name,
          roleId: '',
          dashboardAccess: [],
          sfSync: true,
          sfPosition: item.position,
          sfLastSync: now
        };
      }

      for (const item of sfSyncPreview.toDelete) {
        delete newAccounts[item.accountId];
      }

      for (const item of sfSyncPreview.unchanged) {
        if (newAccounts[item.accountId]) {
          newAccounts[item.accountId].sfLastSync = now;
          newAccounts[item.accountId].sfPosition = item.position;
        }
      }

      updateAccounts(newAccounts);
      setSfSyncResult({ created: selectedToCreate.length, deleted: sfSyncPreview.toDelete.length });
      setSfSyncStep('done');
    } catch (err) {
      setSfSyncError(err.message || '同期の実行に失敗しました');
      setSfSyncStep('error');
    }
  };

  const tabs = [
    { id: 'app', label: 'アプリ設定', icon: Image },
    { id: 'board', label: 'ボード設定', icon: LayoutGrid },
    { id: 'role', label: 'ロール管理', icon: Shield },
    { id: 'account', label: 'アカウント管理', icon: Users },
  ];

  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-xl ${theme === 'dark' ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}>
          <Settings size={20} className={theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'} />
        </div>
        <div>
          <h2 className={`text-xl font-bold ${textClass}`}>共通設定</h2>
          <p className={`text-xs ${textMutedClass}`}>全ダッシュボードで共通の設定を管理します</p>
        </div>
      </div>

      {/* タブバー */}
      <div className={`flex gap-1 p-1 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
        {tabs.map(tab => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? theme === 'dark'
                    ? 'bg-indigo-500/30 text-indigo-300 shadow-sm'
                    : 'bg-white text-indigo-600 shadow-sm'
                  : theme === 'dark'
                    ? 'text-white/50 hover:text-white/70 hover:bg-white/5'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <TabIcon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* アプリケーション設定セクション */}
      {activeTab === 'app' && (
      <div className={`rounded-xl p-4 ${glassClass}`}>
        <h3 className={`text-base font-bold mb-3 flex items-center gap-2 ${textClass}`}>
          <Image size={16} className="text-sky-400" /> アプリケーション設定
        </h3>

        {/* アプリ名 */}
        <div className="mb-4">
          <label className={`block text-xs font-medium mb-1.5 ${textMutedClass}`}>
            アプリケーション名
          </label>
          <input
            type="text"
            value={globalSettings.appName || ''}
            onChange={(e) => handleAppNameChange(e.target.value)}
            placeholder="CallData Analysis"
            className={`w-full max-w-md px-3 py-2 rounded-lg text-sm ${inputClass}`}
          />
          <p className={`text-xs mt-1 ${textMutedClass}`}>
            ブラウザタブ、サイドバー、ログイン画面に表示されます
          </p>
        </div>

        {/* ロゴ画像 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ライトモード用ロゴ */}
          <div className={`rounded-lg border p-3 ${cardClass}`}>
            <label className={`block text-xs font-medium mb-2 ${textMutedClass}`}>
              ロゴ画像（ライトモード用）
            </label>
            <div className="flex items-center gap-3">
              <div className={`w-16 h-16 rounded-lg flex items-center justify-center border-2 border-dashed ${
                theme === 'dark' ? 'border-white/20 bg-white/5' : 'border-gray-300 bg-gray-100'
              }`}>
                {globalSettings.logoLight ? (
                  <img
                    src={globalSettings.logoLight}
                    alt="ライトモードロゴ"
                    className="max-w-full max-h-full object-contain rounded"
                  />
                ) : (
                  <Image size={24} className={textMutedClass} />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <input
                  type="file"
                  ref={logoLightInputRef}
                  onChange={(e) => handleLogoUpload('logoLight', e)}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => logoLightInputRef.current?.click()}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                    theme === 'dark'
                      ? 'bg-sky-500/20 text-sky-400 hover:bg-sky-500/30'
                      : 'bg-sky-100 text-sky-600 hover:bg-sky-200'
                  }`}
                >
                  <Upload size={12} /> アップロード
                </button>
                {globalSettings.logoLight && (
                  <button
                    onClick={() => handleLogoRemove('logoLight')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                      theme === 'dark'
                        ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                        : 'bg-rose-100 text-rose-600 hover:bg-rose-200'
                    }`}
                  >
                    <Trash2 size={12} /> 削除
                  </button>
                )}
              </div>
            </div>
            <p className={`text-xs mt-2 ${textMutedClass}`}>
              推奨: 200KB以下、PNG/SVG形式
            </p>
          </div>

          {/* ダークモード用ロゴ */}
          <div className={`rounded-lg border p-3 ${cardClass}`}>
            <label className={`block text-xs font-medium mb-2 ${textMutedClass}`}>
              ロゴ画像（ダークモード用）
            </label>
            <div className="flex items-center gap-3">
              <div className={`w-16 h-16 rounded-lg flex items-center justify-center border-2 border-dashed ${
                theme === 'dark' ? 'border-white/20 bg-slate-800' : 'border-gray-600 bg-gray-800'
              }`}>
                {globalSettings.logoDark ? (
                  <img
                    src={globalSettings.logoDark}
                    alt="ダークモードロゴ"
                    className="max-w-full max-h-full object-contain rounded"
                  />
                ) : (
                  <Image size={24} className="text-white/40" />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <input
                  type="file"
                  ref={logoDarkInputRef}
                  onChange={(e) => handleLogoUpload('logoDark', e)}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => logoDarkInputRef.current?.click()}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                    theme === 'dark'
                      ? 'bg-sky-500/20 text-sky-400 hover:bg-sky-500/30'
                      : 'bg-sky-100 text-sky-600 hover:bg-sky-200'
                  }`}
                >
                  <Upload size={12} /> アップロード
                </button>
                {globalSettings.logoDark && (
                  <button
                    onClick={() => handleLogoRemove('logoDark')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                      theme === 'dark'
                        ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                        : 'bg-rose-100 text-rose-600 hover:bg-rose-200'
                    }`}
                  >
                    <Trash2 size={12} /> 削除
                  </button>
                )}
              </div>
            </div>
            <p className={`text-xs mt-2 ${textMutedClass}`}>
              推奨: 200KB以下、PNG/SVG形式（白抜きロゴ推奨）
            </p>
          </div>
        </div>

        {/* 注意書き */}
        <div className={`mt-3 p-2.5 rounded-lg flex items-start gap-2 ${
          theme === 'dark' ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'
        }`}>
          <AlertCircle size={14} className={theme === 'dark' ? 'text-amber-400 mt-0.5' : 'text-amber-600 mt-0.5'} />
          <p className={`text-xs ${theme === 'dark' ? 'text-amber-200' : 'text-amber-700'}`}>
            ロゴ画像が未設定の場合、アプリケーション名のテキストが表示されます。
            ダークモード用が未設定の場合はライトモード用が使用されます。
          </p>
        </div>
      </div>
      )}

      {/* ボード設定タブ */}
      {activeTab === 'board' && (<>
      {/* ボード表示設定セクション */}
      <div className={`rounded-xl p-4 ${glassClass}`}>
        <h3 className={`text-base font-bold mb-3 flex items-center gap-2 ${textClass}`}>
          <LayoutGrid size={16} className="text-purple-400" /> ボード表示設定
        </h3>
        <p className={`text-xs mb-3 ${textMutedClass}`}>
          非表示に設定したボードは、閲覧権限のユーザーには表示されません。管理者は常に全てのボードにアクセスできます。
        </p>
        <div className={`rounded-lg border p-3 ${cardClass}`}>
          <div className="space-y-2">
            {APP_REGISTRY.map(board => {
              const isHidden = (globalSettings.hiddenBoards || []).includes(board.id);
              const IconComponent = board.icon;
              return (
                <div
                  key={board.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                    isHidden
                      ? theme === 'dark' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-rose-50 border-rose-200'
                      : theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isHidden
                        ? 'bg-rose-500/20 text-rose-400'
                        : theme === 'dark' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600'
                    }`}>
                      <IconComponent size={16} />
                    </div>
                    <div>
                      <div className={`text-sm font-medium ${textClass}`}>{board.name}</div>
                      <div className={`text-xs ${textMutedClass}`}>{board.description}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleBoardVisibility(board.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      isHidden
                        ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                        : theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                    }`}
                  >
                    {isHidden ? (
                      <>
                        <EyeOff size={12} />
                        非表示
                      </>
                    ) : (
                      <>
                        <Eye size={12} />
                        表示
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ボード名変更セクション */}
      <div className={`rounded-xl p-4 ${glassClass}`}>
        <h3 className={`text-base font-bold mb-3 flex items-center gap-2 ${textClass}`}>
          <Type size={16} className="text-emerald-400" /> ボード名変更
        </h3>
        <p className={`text-xs mb-3 ${textMutedClass}`}>
          各ボードの表示名をカスタマイズできます。空にするとデフォルト名に戻ります。
        </p>
        <div className={`rounded-lg border p-3 ${cardClass}`}>
          <div className="space-y-2">
            {APP_REGISTRY.map(board => {
              const IconComponent = board.icon;
              const customName = globalSettings.boardNames?.[board.id] || '';
              return (
                <div
                  key={board.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                    theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    theme === 'dark' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600'
                  }`}>
                    <IconComponent size={16} />
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={customName}
                      placeholder={board.name}
                      onChange={(e) => {
                        const newBoardNames = {
                          ...(globalSettings.boardNames || {}),
                          [board.id]: e.target.value
                        };
                        updateGlobalSettings({
                          ...globalSettings,
                          boardNames: newBoardNames
                        });
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-lg text-sm outline-none transition-colors ${
                        theme === 'dark'
                          ? 'bg-slate-800 border border-white/10 text-white placeholder-white/40 focus:border-emerald-500/50'
                          : 'bg-white border border-gray-300 text-gray-800 placeholder-gray-400 focus:border-emerald-500'
                      }`}
                    />
                    <div className={`text-xs mt-0.5 ${textMutedClass}`}>
                      デフォルト: {board.name}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </>)}

      {/* ロール管理タブ */}
      {activeTab === 'role' && (
      <RoleManagementSection
        theme={theme}
        glassClass={glassClass}
        roles={roles}
        updateRoles={updateRoles}
        dashboards={allDashboards}
        updateDashboards={updateDashboards}
      />
      )}

      {/* アカウント管理タブ */}
      {activeTab === 'account' && (<>
      <div className={`rounded-xl p-4 ${glassClass}`}>
        <h3 className={`text-base font-bold mb-3 flex items-center gap-2 ${textClass}`}>
          <Users size={16} className="text-emerald-400" /> アカウント管理
        </h3>

        {/* SF獲得者取り込み */}
        <div className={`rounded-lg border p-3 mb-4 ${cardClass}`}>
          <div className="flex items-center justify-between mb-2">
            <h4 className={`text-xs font-medium flex items-center gap-2 ${textClass}`}>
              <Cloud size={14} className="text-blue-400" /> Salesforce 獲得者取り込み
            </h4>
            {(sfSyncStep === 'idle' || sfSyncStep === 'done' || sfSyncStep === 'error') && (
              <button
                onClick={handleSfSync}
                className="px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                <Download size={14} /> SFから取り込み
              </button>
            )}
          </div>

          {/* Loading */}
          {sfSyncStep === 'loading' && (
            <div className="flex items-center gap-2 py-4 justify-center">
              <Loader2 size={16} className="animate-spin text-blue-400" />
              <span className={`text-sm ${textMutedClass}`}>Salesforceからデータを取得中...</span>
            </div>
          )}

          {/* Error */}
          {sfSyncStep === 'error' && sfSyncError && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${theme === 'dark' ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-rose-50 border border-rose-200'}`}>
              <AlertTriangle size={14} className="text-rose-400 shrink-0" />
              <span className={`text-sm ${theme === 'dark' ? 'text-rose-300' : 'text-rose-600'}`}>{sfSyncError}</span>
            </div>
          )}

          {/* Preview */}
          {sfSyncStep === 'preview' && sfSyncPreview && (
            <div className="space-y-3">
              {/* 会社名フィルター */}
              {sfCompanies.length > 1 && (
                <div className={`rounded-lg border p-2.5 ${theme === 'dark' ? 'border-indigo-500/20 bg-indigo-500/5' : 'border-indigo-200 bg-indigo-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Filter size={14} className={theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'} />
                    <span className={`text-xs font-medium ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-700'}`}>会社名フィルター</span>
                    <span className={`text-xs ${textMutedClass}`}>（チェックを外すと除外）</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {sfCompanies.map(company => {
                      const isExcluded = sfCompanyFilter.includes(company);
                      return (
                        <label key={company} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs cursor-pointer transition-colors ${
                          isExcluded
                            ? theme === 'dark' ? 'bg-white/5 text-white/30 line-through' : 'bg-gray-100 text-gray-400 line-through'
                            : theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700'
                        }`}>
                          <input
                            type="checkbox"
                            checked={!isExcluded}
                            onChange={() => {
                              if (isExcluded) {
                                setSfCompanyFilter(prev => prev.filter(c => c !== company));
                              } else {
                                setSfCompanyFilter(prev => [...prev, company]);
                              }
                            }}
                            className="w-3 h-3 rounded"
                          />
                          {company}
                        </label>
                      );
                    })}
                  </div>
                  <button
                    onClick={handleSfSync}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30' : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                    }`}
                  >
                    フィルター適用
                  </button>
                </div>
              )}

              {/* サマリー */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className={`p-2 rounded-lg text-center ${theme === 'dark' ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                  <div className={`text-lg font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>{sfSelectedIds.size}<span className="text-xs font-normal">/{sfSyncPreview.toCreate.length}</span></div>
                  <div className={`text-xs ${textMutedClass}`}>新規作成</div>
                </div>
                <div className={`p-2 rounded-lg text-center ${theme === 'dark' ? 'bg-rose-500/10' : 'bg-rose-50'}`}>
                  <div className={`text-lg font-bold ${theme === 'dark' ? 'text-rose-400' : 'text-rose-600'}`}>{sfSyncPreview.toDelete.length}</div>
                  <div className={`text-xs ${textMutedClass}`}>削除（退職）</div>
                </div>
                <div className={`p-2 rounded-lg text-center ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                  <div className={`text-lg font-bold ${textClass}`}>{sfSyncPreview.unchanged.length}</div>
                  <div className={`text-xs ${textMutedClass}`}>変更なし</div>
                </div>
                <div className={`p-2 rounded-lg text-center ${theme === 'dark' ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                  <div className={`text-lg font-bold ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`}>{sfSyncPreview.skipped.length}</div>
                  <div className={`text-xs ${textMutedClass}`}>スキップ</div>
                </div>
              </div>

              {/* 新規作成リスト */}
              {sfSyncPreview.toCreate.length > 0 && (
                <div className={`rounded-lg border ${theme === 'dark' ? 'border-emerald-500/20' : 'border-emerald-200'}`}>
                  <div className="flex items-center justify-between p-2.5">
                    <button
                      onClick={() => setSfPreviewExpanded(p => ({ ...p, create: !p.create }))}
                      className={`flex items-center gap-2 text-xs font-medium ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}
                    >
                      {sfPreviewExpanded.create ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      新規アカウント ({sfSelectedIds.size}/{sfSyncPreview.toCreate.length}件選択)
                    </button>
                    {sfPreviewExpanded.create && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSfSelectedIds(new Set(sfSyncPreview.toCreate.map(i => i.accountId)))}
                          className={`px-2 py-0.5 rounded text-xs transition-colors ${
                            theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                          }`}
                        >
                          全選択
                        </button>
                        <button
                          onClick={() => setSfSelectedIds(new Set())}
                          className={`px-2 py-0.5 rounded text-xs transition-colors ${
                            theme === 'dark' ? 'bg-white/10 text-white/50 hover:bg-white/20' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                          }`}
                        >
                          全解除
                        </button>
                      </div>
                    )}
                  </div>
                  {sfPreviewExpanded.create && (
                    <div className={`px-3 pb-2.5 space-y-1 max-h-48 overflow-y-auto`}>
                      {sfSyncPreview.toCreate.map(item => {
                        const isChecked = sfSelectedIds.has(item.accountId);
                        return (
                          <label key={item.accountId} className={`flex items-center gap-2 text-xs p-1.5 rounded cursor-pointer transition-colors ${
                            isChecked
                              ? theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'
                              : theme === 'dark' ? 'bg-white/[0.02] opacity-50' : 'bg-gray-50/50 opacity-50'
                          }`}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSfSelectedIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(item.accountId)) {
                                    next.delete(item.accountId);
                                  } else {
                                    next.add(item.accountId);
                                  }
                                  return next;
                                });
                              }}
                              className="w-3 h-3 rounded"
                            />
                            <span className={`font-mono ${textMutedClass}`}>{item.accountId}</span>
                            <span className={textClass}>{item.name}</span>
                            {item.position && <span className={`px-1.5 py-0.5 rounded-full ${theme === 'dark' ? 'bg-white/10 text-white/50' : 'bg-gray-200 text-gray-500'}`}>{item.position}</span>}
                            {item.company && <span className={`ml-auto px-1.5 py-0.5 rounded-full text-xs ${theme === 'dark' ? 'bg-indigo-500/15 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>{item.company}</span>}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 削除リスト */}
              {sfSyncPreview.toDelete.length > 0 && (
                <div className={`rounded-lg border ${theme === 'dark' ? 'border-rose-500/20' : 'border-rose-200'}`}>
                  <button
                    onClick={() => setSfPreviewExpanded(p => ({ ...p, delete: !p.delete }))}
                    className={`w-full flex items-center gap-2 p-2.5 text-xs font-medium ${theme === 'dark' ? 'text-rose-400' : 'text-rose-600'}`}
                  >
                    {sfPreviewExpanded.delete ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    削除対象 ({sfSyncPreview.toDelete.length}件) - 退職日が設定されています
                  </button>
                  {sfPreviewExpanded.delete && (
                    <div className={`px-3 pb-2.5 space-y-1 max-h-48 overflow-y-auto`}>
                      {sfSyncPreview.toDelete.map(item => (
                        <div key={item.accountId} className={`flex items-center gap-2 text-xs p-1.5 rounded ${theme === 'dark' ? 'bg-rose-500/5' : 'bg-rose-50'}`}>
                          <span className={`font-mono ${textMutedClass}`}>{item.accountId}</span>
                          <span className={textClass}>{item.name}</span>
                          <span className={`ml-auto text-xs ${theme === 'dark' ? 'text-rose-400' : 'text-rose-500'}`}>
                            {item.retirementDate ? `退職日: ${item.retirementDate}` : item.reason || 'SF未検出'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* スキップリスト */}
              {sfSyncPreview.skipped.length > 0 && (
                <div className={`rounded-lg border ${theme === 'dark' ? 'border-amber-500/20' : 'border-amber-200'}`}>
                  <button
                    onClick={() => setSfPreviewExpanded(p => ({ ...p, skip: !p.skip }))}
                    className={`w-full flex items-center gap-2 p-2.5 text-xs font-medium ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`}
                  >
                    {sfPreviewExpanded.skip ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    スキップ ({sfSyncPreview.skipped.length}件)
                  </button>
                  {sfPreviewExpanded.skip && (
                    <div className={`px-3 pb-2.5 space-y-1 max-h-48 overflow-y-auto`}>
                      {sfSyncPreview.skipped.map((item, i) => (
                        <div key={i} className={`flex items-center gap-2 text-xs p-1.5 rounded ${theme === 'dark' ? 'bg-amber-500/5' : 'bg-amber-50'}`}>
                          <span className={textClass}>{item.name}</span>
                          <span className={`ml-auto ${textMutedClass}`}>{item.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 実行・キャンセルボタン */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={executeSfSync}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle2 size={14} /> 確認して実行
                </button>
                <button
                  onClick={() => { setSfSyncStep('idle'); setSfSyncPreview(null); setSfSyncError(''); }}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                    theme === 'dark' ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}

          {/* Executing */}
          {sfSyncStep === 'executing' && (
            <div className="flex items-center gap-2 py-4 justify-center">
              <Loader2 size={16} className="animate-spin text-emerald-400" />
              <span className={`text-sm ${textMutedClass}`}>同期を実行中...</span>
            </div>
          )}

          {/* Done */}
          {sfSyncStep === 'done' && sfSyncResult && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${theme === 'dark' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
              <CheckCircle2 size={14} className={theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'} />
              <span className={`text-sm ${theme === 'dark' ? 'text-emerald-300' : 'text-emerald-700'}`}>
                同期完了: {sfSyncResult.created}件作成, {sfSyncResult.deleted}件削除
              </span>
            </div>
          )}
        </div>

        {/* 新規アカウント追加 */}
        <div className={`rounded-lg border p-3 mb-4 ${cardClass}`}>
          <h4 className={`text-xs font-medium mb-3 flex items-center gap-2 ${textClass}`}>
            <UserPlus size={14} className="text-emerald-400" /> 新規アカウント追加
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <div>
              <label className={`block text-xs font-medium mb-1 ${textMutedClass}`}>ユーザーID</label>
              <input
                type="text"
                value={newAccountId}
                onChange={(e) => setNewAccountId(e.target.value)}
                placeholder="user01"
                className={`w-full px-2.5 py-1.5 rounded-lg text-sm ${inputClass}`}
              />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${textMutedClass}`}>表示名</label>
              <input
                type="text"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="サンプル担当者"
                className={`w-full px-2.5 py-1.5 rounded-lg text-sm ${inputClass}`}
              />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${textMutedClass}`}>パスワード</label>
              <input
                type="text"
                value={newAccountPassword}
                onChange={(e) => setNewAccountPassword(e.target.value)}
                placeholder="password123"
                className={`w-full px-2.5 py-1.5 rounded-lg text-sm ${inputClass}`}
              />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${textMutedClass}`}>ロール</label>
              <select
                value={newAccountRole}
                onChange={(e) => setNewAccountRole(e.target.value)}
                className={`w-full px-2.5 py-1.5 rounded-lg text-sm ${inputClass}`}
              >
                {Object.entries(roles).map(([roleId, role]) => (
                  <option key={roleId} value={roleId} className={optionClass}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={addAccount}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <Plus size={14} /> アカウントを追加
          </button>
        </div>

        {/* 既存アカウント一覧 */}
        <div className="space-y-3">
          {Object.entries(accounts).map(([accountId, account]) => {
            const isEditing = editingAccount === accountId;
            const accessList = account.dashboardAccess || [];
            const hasAllAccess = accessList.length === 0;
            const roleId = account.roleId || account.role;
            const role = roles[roleId];
            const RoleIcon = getRoleIconComponent(roleId, role);

            return (
              <div key={accountId} className={`rounded-lg border p-3 ${cardClass}`}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      roleId === 'admin'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      <RoleIcon size={16} />
                    </div>
                    <div>
                      <div className={`text-sm font-medium ${textClass}`}>{account.name}</div>
                      <div className={`text-xs ${textMutedClass}`}>@{accountId}</div>
                    </div>
                    {account.sfSync && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                      }`}>
                        SF
                      </span>
                    )}
                    {roleId ? (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        roleId === 'admin'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {role?.name || roleId}
                      </span>
                    ) : (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        theme === 'dark' ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600'
                      }`}>
                        ロール未設定
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setEditingAccount(isEditing ? null : accountId)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        isEditing
                          ? 'bg-indigo-500 text-white'
                          : theme === 'dark' ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      {isEditing ? '閉じる' : '編集'}
                    </button>
                    {accountId !== 'admin' && (
                      <button
                        onClick={() => deleteAccount(accountId)}
                        className={`p-1 rounded-lg transition-colors ${
                          theme === 'dark' ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30' : 'bg-rose-100 text-rose-500 hover:bg-rose-200'
                        }`}
                        title="削除"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* 編集パネル */}
                {isEditing && (
                  <div className={`mt-3 pt-3 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${textMutedClass}`}>表示名</label>
                        <input
                          type="text"
                          value={account.name}
                          onChange={(e) => updateAccount(accountId, 'name', e.target.value)}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-sm ${inputClass}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${textMutedClass}`}>パスワード</label>
                        {account.sfSync ? (
                          <div className={`px-2.5 py-1.5 rounded-lg text-xs ${theme === 'dark' ? 'bg-white/5 text-white/40' : 'bg-gray-100 text-gray-400'}`}>
                            ロールのパスワードを使用
                            {roleId && roles[roleId]?.hasPassword ? (
                              <span className="text-emerald-400 ml-1">(設定済み)</span>
                            ) : (
                              <span className={`ml-1 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-500'}`}>(未設定 - ログイン不可)</span>
                            )}
                          </div>
                        ) : (
                          <div className="relative">
                            <input
                              type={showPassword[accountId] ? 'text' : 'password'}
                              value={account.password || ''}
                              onChange={(e) => updateAccount(accountId, 'password', e.target.value)}
                              placeholder="変更する場合のみ入力"
                              className={`w-full px-2.5 py-1.5 pr-8 rounded-lg text-sm ${inputClass}`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(prev => ({ ...prev, [accountId]: !prev[accountId] }))}
                              className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded ${textMutedClass} hover:opacity-70`}
                            >
                              {showPassword[accountId] ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${textMutedClass}`}>ロール</label>
                        <select
                          value={account.roleId || account.role || ''}
                          onChange={(e) => updateAccount(accountId, 'roleId', e.target.value)}
                          disabled={accountId === 'admin'}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-sm ${inputClass} ${accountId === 'admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {!(account.roleId || account.role) && (
                            <option value="" className={optionClass}>-- 未設定 --</option>
                          )}
                          {Object.entries(roles).map(([rid, r]) => (
                            <option key={rid} value={rid} className={optionClass}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* ダッシュボードアクセス権限 */}
                    {roleId !== 'admin' && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className={`text-xs font-medium ${textMutedClass}`}>ダッシュボード閲覧権限</label>
                          <button
                            onClick={() => setAllDashboardAccess(accountId, !hasAllAccess)}
                            className={`text-xs px-2 py-0.5 rounded transition-colors ${
                              hasAllAccess
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : theme === 'dark' ? 'bg-white/10 text-white/50 hover:bg-white/20' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                            }`}
                          >
                            {hasAllAccess ? '✓ 全て許可中' : '全て許可'}
                          </button>
                        </div>
                        {!hasAllAccess && (
                          <div className="flex flex-wrap gap-1.5">
                            {dashboardList.map(dashboard => {
                              const hasAccess = accessList.includes(dashboard.id);
                              return (
                                <button
                                  key={dashboard.id}
                                  onClick={() => toggleDashboardAccess(accountId, dashboard.id)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                                    hasAccess
                                      ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                      : theme === 'dark' ? 'bg-white/5 text-white/40 hover:bg-white/10' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                  }`}
                                >
                                  {hasAccess ? <Check size={10} /> : <Square size={10} />}
                                  {dashboard.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {hasAllAccess && (
                          <p className={`text-xs ${textMutedClass}`}>
                            このアカウントは全てのダッシュボードにアクセスできます。個別に設定する場合は「全て許可」を解除してください。
                          </p>
                        )}
                      </div>
                    )}
                    {roleId === 'admin' && (
                      <p className={`text-xs ${textMutedClass}`}>
                        管理者アカウントは全てのダッシュボードにアクセスできます。
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 説明 */}
      <div className={`rounded-xl p-4 ${glassClass}`}>
        <h4 className={`text-xs font-bold mb-2 flex items-center gap-2 ${textClass}`}>
          <Info size={14} className="text-sky-400" /> 設定について
        </h4>
        <div className={`text-xs space-y-1.5 ${textMutedClass}`}>
          <p className="mt-2"><strong>アカウント管理:</strong></p>
          <p className="pl-3">• <strong>管理者</strong>: 全てのダッシュボードへのアクセス、設定変更、アカウント管理が可能</p>
          <p className="pl-3">• <strong>閲覧者</strong>: 許可されたダッシュボードの閲覧のみ可能</p>
          <p className="pl-3">• 「全て許可」が有効な場合、新規ダッシュボードにも自動的にアクセス可能</p>
          <p className="pl-3">• adminアカウントは削除できません</p>
        </div>
      </div>
      </>)}

      {/* 固定保存ボタン */}
      <div className={`fixed bottom-0 left-0 md:left-64 right-0 p-3 z-30 border-t ${
        theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-gray-200'
      }`}>
        <div className="max-w-6xl mx-auto flex gap-3">
          <button
            onClick={handleManualSave}
            className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm font-bold shadow-lg transition-all ${
              saveStatus === 'saved'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-none'
                : 'bg-emerald-500 hover:bg-emerald-400 text-white'
            }`}
          >
            {saveStatus === 'saved' ? (
              <>
                <CheckCircle size={16} />
                保存済み
              </>
            ) : (
              <>
                <Save size={16} />
                設定を保存
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalSettingsView;
