// src/apps/performance-board/components/GlobalPicklistManager.jsx
// Salesforce グローバル選択リスト管理コンポーネント

import React, { useState, useCallback } from 'react';
import {
  List, ChevronDown, ChevronRight, RefreshCw, Save, Plus, Trash2,
  Loader2, CheckCircle, AlertTriangle, Eye, EyeOff, Search, X,
  GripVertical, Palette,
} from 'lucide-react';
import salesforceApi from '../services/salesforceApi';

const GlobalPicklistManager = ({ theme = 'dark' }) => {
  // === 状態 ===
  const [valueSets, setValueSets] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listLoaded, setListLoaded] = useState(false);
  const [selectedGvsId, setSelectedGvsId] = useState(null);
  const [gvsDetail, setGvsDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editValues, setEditValues] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success'|'error', text }
  const [searchQuery, setSearchQuery] = useState('');
  const [valueSearch, setValueSearch] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const isDark = theme === 'dark';
  const textClass = isDark ? 'text-white/90' : 'text-gray-800';
  const subTextClass = isDark ? 'text-white/50' : 'text-gray-500';
  const cardClass = isDark
    ? 'bg-white/5 border border-white/10 rounded-xl overflow-hidden'
    : 'bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm';
  const inputClass = isDark
    ? 'bg-white/10 border border-white/20 text-white/90 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400'
    : 'bg-white border border-gray-300 text-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500';

  // === GVS一覧取得 ===
  const handleLoadList = useCallback(async () => {
    setListLoading(true);
    setMessage(null);
    try {
      const result = await salesforceApi.listGlobalValueSets();
      setValueSets(result.data || []);
      setListLoaded(true);
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setListLoading(false);
    }
  }, []);

  // === GVS詳細取得 ===
  const handleSelectGvs = useCallback(async (gvsId) => {
    if (hasChanges && !window.confirm('未保存の変更があります。破棄しますか？')) return;
    setSelectedGvsId(gvsId);
    setDetailLoading(true);
    setMessage(null);
    setHasChanges(false);
    try {
      const result = await salesforceApi.getGlobalValueSet(gvsId);
      setGvsDetail(result.data);
      setEditValues((result.data?.values || []).map((v, i) => ({ ...v, _key: i })));
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
      setGvsDetail(null);
      setEditValues([]);
    } finally {
      setDetailLoading(false);
    }
  }, [hasChanges]);

  // === 値の編集 ===
  const updateValue = useCallback((index, field, val) => {
    setEditValues(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
    setHasChanges(true);
  }, []);

  // === 新しい値の追加 ===
  const handleAddValue = useCallback(() => {
    setEditValues(prev => [
      ...prev,
      {
        _key: Date.now(),
        valueName: '',
        label: '',
        isActive: true,
        default: false,
        color: null,
        description: '',
      },
    ]);
    setHasChanges(true);
  }, []);

  // === 値の削除（既存値は非アクティブ化、新規値は完全削除） ===
  const handleRemoveValue = useCallback((index) => {
    setEditValues(prev => {
      const val = prev[index];
      // 既存の値（valueNameが空でない）→非アクティブ化のみ
      if (val.valueName && gvsDetail?.values?.some(v => v.valueName === val.valueName)) {
        const next = [...prev];
        next[index] = { ...next[index], isActive: false };
        return next;
      }
      // 新しい値→完全削除
      return prev.filter((_, i) => i !== index);
    });
    setHasChanges(true);
  }, [gvsDetail]);

  // === 保存 ===
  const handleSave = useCallback(async () => {
    // バリデーション
    for (let i = 0; i < editValues.length; i++) {
      const v = editValues[i];
      if (!v.valueName || !v.valueName.trim()) {
        setMessage({ type: 'error', text: `行${i + 1}: API名は必須です` });
        return;
      }
      if (!v.label) {
        setMessage({ type: 'error', text: `行${i + 1}: ラベルは必須です` });
        return;
      }
    }

    // 重複チェック
    const names = editValues.map(v => v.valueName);
    const dup = names.find((n, i) => names.indexOf(n) !== i);
    if (dup) {
      setMessage({ type: 'error', text: `API名「${dup}」が重複しています` });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await salesforceApi.updateGlobalValueSet(selectedGvsId, editValues.map(v => ({
        valueName: v.valueName,
        label: v.label,
        isActive: v.isActive,
        default: v.default,
        color: v.color,
        description: v.description,
      })));
      setMessage({ type: 'success', text: 'グローバル選択リストを更新しました' });
      setHasChanges(false);
      // 詳細を再読み込み
      const result = await salesforceApi.getGlobalValueSet(selectedGvsId);
      setGvsDetail(result.data);
      setEditValues((result.data?.values || []).map((v, i) => ({ ...v, _key: i })));
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  }, [editValues, selectedGvsId]);

  // === フィルタリング ===
  const filteredValueSets = searchQuery
    ? valueSets.filter(vs =>
      vs.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vs.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : valueSets;

  const filteredEditValues = valueSearch
    ? editValues.map((v, i) => ({ ...v, _origIndex: i })).filter(v =>
      v.valueName.toLowerCase().includes(valueSearch.toLowerCase()) ||
      v.label.toLowerCase().includes(valueSearch.toLowerCase())
    )
    : editValues.map((v, i) => ({ ...v, _origIndex: i }));

  return (
    <div className="space-y-4">
      {/* メッセージ */}
      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm ${
          message.type === 'success'
            ? isDark ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-green-50 text-green-700 border border-green-200'
            : isDark ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          <span className="flex-1">{message.text}</span>
          <button onClick={() => setMessage(null)} className="opacity-60 hover:opacity-100"><X size={14} /></button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4" style={{ minHeight: 500 }}>
        {/* === 左: GVS一覧 === */}
        <div className={cardClass}>
          <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <List size={16} className="text-purple-400" />
              <span className={`text-sm font-semibold ${textClass}`}>グローバル選択リスト</span>
              {listLoaded && <span className={`text-xs ${subTextClass}`}>({valueSets.length})</span>}
            </div>
            <button
              onClick={handleLoadList}
              disabled={listLoading}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isDark ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              } disabled:opacity-50`}
            >
              {listLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {listLoaded ? '更新' : '読み込み'}
            </button>
          </div>

          {listLoaded && (
            <div className="p-2">
              <div className="relative">
                <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${subTextClass}`} />
                <input
                  type="text"
                  placeholder="検索..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className={`${inputClass} w-full pl-8 py-1.5`}
                />
              </div>
            </div>
          )}

          <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
            {!listLoaded && !listLoading && (
              <div className={`p-8 text-center text-sm ${subTextClass}`}>
                「読み込み」ボタンで一覧を取得してください
              </div>
            )}
            {filteredValueSets.map(vs => (
              <button
                key={vs.id}
                onClick={() => handleSelectGvs(vs.id)}
                className={`w-full text-left px-4 py-3 border-b transition-colors ${
                  selectedGvsId === vs.id
                    ? isDark ? 'bg-purple-500/20 border-purple-500/30' : 'bg-purple-50 border-purple-200'
                    : isDark ? 'border-white/5 hover:bg-white/5' : 'border-gray-100 hover:bg-gray-50'
                }`}
              >
                <div className={`text-sm font-medium ${textClass}`}>{vs.label}</div>
                {vs.description && (
                  <div className={`text-xs mt-0.5 ${subTextClass} truncate`}>{vs.description}</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* === 右: 値の編集 === */}
        <div className={`col-span-2 ${cardClass}`}>
          <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <Palette size={16} className="text-purple-400" />
              <span className={`text-sm font-semibold ${textClass}`}>
                {gvsDetail ? gvsDetail.label : '選択リストの値'}
              </span>
              {gvsDetail && (
                <span className={`text-xs ${subTextClass}`}>
                  ({editValues.filter(v => v.isActive).length}個のアクティブ値 / {editValues.length}個の合計)
                </span>
              )}
              {hasChanges && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-50 text-amber-700'
                }`}>未保存</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {gvsDetail && (
                <>
                  <button
                    onClick={handleAddValue}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isDark ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30' : 'bg-green-50 text-green-700 hover:bg-green-100'
                    }`}
                  >
                    <Plus size={14} />
                    値を追加
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isDark ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                    } disabled:opacity-50`}
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    SFに保存
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 値の検索 */}
          {gvsDetail && editValues.length > 10 && (
            <div className={`px-4 py-2 border-b ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
              <div className="relative">
                <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${subTextClass}`} />
                <input
                  type="text"
                  placeholder="値を検索..."
                  value={valueSearch}
                  onChange={e => setValueSearch(e.target.value)}
                  className={`${inputClass} w-full pl-8 py-1.5`}
                />
              </div>
            </div>
          )}

          {detailLoading ? (
            <div className={`p-16 text-center ${subTextClass}`}>
              <Loader2 size={24} className="animate-spin mx-auto mb-2" />
              <div className="text-sm">読み込み中...</div>
            </div>
          ) : !gvsDetail ? (
            <div className={`p-16 text-center text-sm ${subTextClass}`}>
              左の一覧から選択リストを選んでください
            </div>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: 440 }}>
              {/* ヘッダー行 */}
              <div className={`sticky top-0 z-10 grid grid-cols-[1fr_1.5fr_60px_60px_80px_60px] gap-2 px-4 py-2 text-xs font-semibold border-b ${
                isDark ? 'bg-white/5 border-white/10 text-white/60' : 'bg-gray-50 border-gray-200 text-gray-500'
              }`}>
                <div>API名</div>
                <div>ラベル</div>
                <div className="text-center">有効</div>
                <div className="text-center">既定</div>
                <div className="text-center">色</div>
                <div className="text-center">操作</div>
              </div>

              {filteredEditValues.map((val) => {
                const idx = val._origIndex;
                const isNew = !gvsDetail.values?.some(v => v.valueName === val.valueName);
                return (
                  <div
                    key={val._key}
                    className={`grid grid-cols-[1fr_1.5fr_60px_60px_80px_60px] gap-2 px-4 py-2 items-center border-b transition-colors ${
                      !val.isActive
                        ? isDark ? 'bg-red-500/5 border-white/5 opacity-60' : 'bg-red-50/50 border-gray-100 opacity-60'
                        : isNew
                          ? isDark ? 'bg-green-500/5 border-white/5' : 'bg-green-50/50 border-gray-100'
                          : isDark ? 'border-white/5 hover:bg-white/5' : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    {/* API名 */}
                    <input
                      type="text"
                      value={val.valueName}
                      onChange={e => updateValue(idx, 'valueName', e.target.value)}
                      disabled={!isNew}
                      placeholder="API_Name"
                      className={`${inputClass} py-1 text-xs font-mono ${!isNew ? 'opacity-70 cursor-not-allowed' : ''}`}
                    />
                    {/* ラベル */}
                    <input
                      type="text"
                      value={val.label}
                      onChange={e => updateValue(idx, 'label', e.target.value)}
                      placeholder="表示ラベル"
                      className={`${inputClass} py-1 text-xs`}
                    />
                    {/* 有効 */}
                    <div className="flex justify-center">
                      <button
                        onClick={() => updateValue(idx, 'isActive', !val.isActive)}
                        className={`p-1 rounded transition-colors ${
                          val.isActive
                            ? isDark ? 'text-green-400 hover:bg-green-500/20' : 'text-green-600 hover:bg-green-50'
                            : isDark ? 'text-red-400 hover:bg-red-500/20' : 'text-red-600 hover:bg-red-50'
                        }`}
                      >
                        {val.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </div>
                    {/* デフォルト */}
                    <div className="flex justify-center">
                      <input
                        type="checkbox"
                        checked={val.default || false}
                        onChange={e => updateValue(idx, 'default', e.target.checked)}
                        className="w-4 h-4 accent-indigo-500"
                      />
                    </div>
                    {/* 色 */}
                    <div className="flex justify-center items-center gap-1">
                      <input
                        type="color"
                        value={val.color || '#6366f1'}
                        onChange={e => updateValue(idx, 'color', e.target.value)}
                        className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                      />
                      {val.color && (
                        <button
                          onClick={() => updateValue(idx, 'color', null)}
                          className={`text-xs ${subTextClass} hover:opacity-80`}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    {/* 操作 */}
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleRemoveValue(idx)}
                        title={isNew ? '削除' : '無効化'}
                        className={`p-1 rounded transition-colors ${
                          isDark ? 'text-red-400 hover:bg-red-500/20' : 'text-red-500 hover:bg-red-50'
                        }`}
                      >
                        {isNew ? <Trash2 size={14} /> : <EyeOff size={14} />}
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredEditValues.length === 0 && editValues.length > 0 && (
                <div className={`p-8 text-center text-sm ${subTextClass}`}>
                  検索に一致する値がありません
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalPicklistManager;
