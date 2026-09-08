// src/apps/performance-board/components/settings/SfCredentialPanel.jsx
// テナント別SF認証情報管理パネル

import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Plus,
  Trash2,
  Save,
  Loader2,
  Check,
  X,
  Shield,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  ChevronDown
} from 'lucide-react';
import salesforceApi from '../../services/salesforceApi';

const SfCredentialPanel = ({
  glassClass,
  inputClass,
  textClass,
  labelClass,
  labelSmClass,
  labelXsClass,
  cardClass,
  borderClass,
  optionClass,
  onTenantChange,
  currentTenantId,
}) => {
  const [tenants, setTenants] = useState({});
  const [selectedTenantId, setSelectedTenantId] = useState(currentTenantId || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // 新規テナント用フォーム
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [formData, setFormData] = useState({
    tenantId: '',
    tenantName: '',
    username: '',
    password: '',
    securityToken: '',
    consumerKey: '',
    consumerSecret: '',
    loginUrl: 'https://login.salesforce.com',
    apiVersion: 'v57.0',
  });

  // テナント一覧を読み込み
  const loadTenants = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await salesforceApi.loadCredentials();
      setTenants(data || {});
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  // テナント選択変更
  const handleTenantSelect = (tenantId) => {
    setSelectedTenantId(tenantId);
    setTestResult(null);
    setError('');

    if (tenantId && tenantId !== 'default' && tenants[tenantId]) {
      setFormData({ tenantId, ...tenants[tenantId] });
      setIsAddingNew(false);
    } else if (tenantId === 'default' || tenantId === '') {
      setFormData({
        tenantId: '',
        tenantName: '',
        username: '',
        password: '',
        securityToken: '',
        consumerKey: '',
        consumerSecret: '',
        loginUrl: 'https://login.salesforce.com',
        apiVersion: 'v57.0',
      });
      setIsAddingNew(false);
    }

    // 親に通知
    if (onTenantChange) {
      onTenantChange(tenantId === 'default' ? '' : tenantId);
    }
  };

  // 新規テナント追加モード
  const handleAddNew = () => {
    setIsAddingNew(true);
    setSelectedTenantId('__new__');
    setFormData({
      tenantId: '',
      tenantName: '',
      username: '',
      password: '',
      securityToken: '',
      consumerKey: '',
      consumerSecret: '',
      loginUrl: 'https://login.salesforce.com',
      apiVersion: 'v57.0',
    });
    setTestResult(null);
    setError('');
  };

  // フォーム入力
  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // 接続テスト
  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    setError('');
    try {
      const result = await salesforceApi.testCredentials(
        isAddingNew ? '' : selectedTenantId,
        formData
      );
      setTestResult({ success: true, instance: result.instance });
    } catch (e) {
      setTestResult({ success: false, message: e.message });
    } finally {
      setIsTesting(false);
    }
  };

  // 保存
  const handleSave = async () => {
    const tid = isAddingNew ? formData.tenantId : selectedTenantId;
    if (!tid) {
      setError('テナントIDを入力してください');
      return;
    }
    if (!formData.tenantName || !formData.username || !formData.password) {
      setError('テナント名、ユーザー名、パスワードは必須です');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      const { tenantId: _unused, ...loginInfo } = formData;
      await salesforceApi.saveCredentials(tid, loginInfo);
      await loadTenants();
      setSelectedTenantId(tid);
      setIsAddingNew(false);

      if (onTenantChange) {
        onTenantChange(tid);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 削除
  const handleDelete = async () => {
    if (!selectedTenantId || selectedTenantId === 'default') return;
    if (!window.confirm(`テナント「${tenants[selectedTenantId]?.tenantName || selectedTenantId}」の認証情報を削除しますか？`)) return;

    setIsLoading(true);
    setError('');
    try {
      await salesforceApi.deleteCredentials(selectedTenantId);
      await loadTenants();
      setSelectedTenantId('');
      handleTenantSelect('default');
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const tenantList = Object.entries(tenants);
  const showForm = selectedTenantId && selectedTenantId !== 'default' || isAddingNew;

  return (
    <div className={`rounded-2xl p-6 ${glassClass}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full text-left text-lg font-semibold flex items-center gap-2 ${textClass}`}
      >
        <Shield size={20} className="text-amber-400" />
        SF接続設定（テナント管理）
        <ChevronDown
          size={16}
          className={`ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          <p className={`text-xs ${labelXsClass}`}>
            テナントごとにSalesforce認証情報を管理できます。「デフォルト」はサーバー設定（sf_config.php）を使用します。
          </p>

          {/* テナント選択 + 新規追加 */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className={`text-sm ${labelClass} block mb-1`}>接続先テナント</label>
              <select
                value={isAddingNew ? '__new__' : (selectedTenantId || 'default')}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    handleAddNew();
                  } else {
                    handleTenantSelect(e.target.value);
                  }
                }}
                className={`w-full ${inputClass} rounded-lg px-4 py-2 text-sm focus:border-sky-500 outline-none transition-all`}
              >
                <option value="default" className={optionClass}>デフォルト（サーバー設定）</option>
                {tenantList.map(([id, cred]) => (
                  <option key={id} value={id} className={optionClass}>
                    {cred.tenantName || id}
                  </option>
                ))}
                <option value="__new__" className={optionClass}>+ 新規テナントを追加...</option>
              </select>
            </div>
          </div>

          {/* エラー表示 */}
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <X size={16} /> {error}
            </div>
          )}

          {/* テナント設定フォーム */}
          {showForm && (
            <div className={`rounded-xl p-5 border ${cardClass} space-y-4`}>
              {/* テナントID（新規時のみ編集可） */}
              {isAddingNew && (
                <div>
                  <label className={`text-sm ${labelSmClass} block mb-1`}>テナントID（英数字・ハイフン・アンダースコア）</label>
                  <input
                    type="text"
                    value={formData.tenantId}
                    onChange={(e) => updateField('tenantId', e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                    className={`w-full ${inputClass} rounded-lg px-4 py-2 text-sm focus:border-sky-500 outline-none`}
                    placeholder="company-a"
                  />
                </div>
              )}

              {/* テナント名 */}
              <div>
                <label className={`text-sm ${labelSmClass} block mb-1`}>テナント名</label>
                <input
                  type="text"
                  value={formData.tenantName || ''}
                  onChange={(e) => updateField('tenantName', e.target.value)}
                  className={`w-full ${inputClass} rounded-lg px-4 py-2 text-sm focus:border-sky-500 outline-none`}
                  placeholder="A社"
                />
              </div>

              {/* SF認証情報 */}
              <div className={`pt-4 border-t ${borderClass}`}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className={`text-sm font-semibold ${textClass}`}>Salesforce認証情報</h4>
                  <button
                    onClick={() => setShowPasswords(!showPasswords)}
                    className={`text-xs ${labelSmClass} flex items-center gap-1 hover:text-sky-400 transition-colors`}
                  >
                    {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
                    {showPasswords ? '非表示' : '表示'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={`text-xs ${labelXsClass} block mb-1`}>ユーザー名</label>
                    <input
                      type="text"
                      value={formData.username || ''}
                      onChange={(e) => updateField('username', e.target.value)}
                      className={`w-full ${inputClass} rounded-lg px-3 py-2 text-sm focus:border-sky-500 outline-none`}
                      placeholder="admin@company.com"
                    />
                  </div>
                  <div>
                    <label className={`text-xs ${labelXsClass} block mb-1`}>パスワード</label>
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      value={formData.password || ''}
                      onChange={(e) => updateField('password', e.target.value)}
                      className={`w-full ${inputClass} rounded-lg px-3 py-2 text-sm focus:border-sky-500 outline-none`}
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className={`text-xs ${labelXsClass} block mb-1`}>セキュリティトークン</label>
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      value={formData.securityToken || ''}
                      onChange={(e) => updateField('securityToken', e.target.value)}
                      className={`w-full ${inputClass} rounded-lg px-3 py-2 text-sm focus:border-sky-500 outline-none`}
                      placeholder="セキュリティトークン"
                    />
                  </div>
                  <div>
                    <label className={`text-xs ${labelXsClass} block mb-1`}>ログインURL</label>
                    <select
                      value={formData.loginUrl || 'https://login.salesforce.com'}
                      onChange={(e) => updateField('loginUrl', e.target.value)}
                      className={`w-full ${inputClass} rounded-lg px-3 py-2 text-sm focus:border-sky-500 outline-none`}
                    >
                      <option value="https://login.salesforce.com" className={optionClass}>本番 (login.salesforce.com)</option>
                      <option value="https://test.salesforce.com" className={optionClass}>Sandbox (test.salesforce.com)</option>
                    </select>
                  </div>
                  <div>
                    <label className={`text-xs ${labelXsClass} block mb-1`}>Consumer Key（任意）</label>
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      value={formData.consumerKey || ''}
                      onChange={(e) => updateField('consumerKey', e.target.value)}
                      className={`w-full ${inputClass} rounded-lg px-3 py-2 text-sm focus:border-sky-500 outline-none`}
                      placeholder="Connected App Consumer Key"
                    />
                  </div>
                  <div>
                    <label className={`text-xs ${labelXsClass} block mb-1`}>Consumer Secret（任意）</label>
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      value={formData.consumerSecret || ''}
                      onChange={(e) => updateField('consumerSecret', e.target.value)}
                      className={`w-full ${inputClass} rounded-lg px-3 py-2 text-sm focus:border-sky-500 outline-none`}
                      placeholder="Connected App Consumer Secret"
                    />
                  </div>
                  <div>
                    <label className={`text-xs ${labelXsClass} block mb-1`}>APIバージョン</label>
                    <input
                      type="text"
                      value={formData.apiVersion || 'v57.0'}
                      onChange={(e) => updateField('apiVersion', e.target.value)}
                      className={`w-full ${inputClass} rounded-lg px-3 py-2 text-sm focus:border-sky-500 outline-none`}
                      placeholder="v57.0"
                    />
                  </div>
                </div>
              </div>

              {/* 接続テスト結果 */}
              {testResult && (
                <div className={`flex items-center gap-2 text-sm rounded-lg p-3 ${
                  testResult.success
                    ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
                    : 'text-red-400 bg-red-500/10 border border-red-500/30'
                }`}>
                  {testResult.success ? (
                    <>
                      <Wifi size={16} />
                      接続成功 ({testResult.instance})
                    </>
                  ) : (
                    <>
                      <WifiOff size={16} />
                      接続失敗: {testResult.message}
                    </>
                  )}
                </div>
              )}

              {/* アクションボタン */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleTest}
                  disabled={isTesting || !formData.username || !formData.password}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-colors"
                >
                  {isTesting ? <Loader2 className="animate-spin" size={16} /> : <Wifi size={16} />}
                  接続テスト
                </button>

                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-colors"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  保存
                </button>

                {!isAddingNew && selectedTenantId && selectedTenantId !== 'default' && (
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ml-auto"
                  >
                    <Trash2 size={16} />
                    削除
                  </button>
                )}

                {isAddingNew && (
                  <button
                    onClick={() => {
                      setIsAddingNew(false);
                      handleTenantSelect('default');
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${labelSmClass} hover:text-sky-400 transition-colors`}
                  >
                    <X size={16} />
                    キャンセル
                  </button>
                )}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="animate-spin text-sky-400" size={24} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SfCredentialPanel;
