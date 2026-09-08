// src/apps/performance-board/components/SalesforceExportModal.jsx
// Salesforceインポートプレビュー＆実行モーダル

import React, { useState } from 'react';
import { X, Upload, CheckCircle, AlertTriangle, Loader2, Eye } from 'lucide-react';
import salesforceApi from '../services/salesforceApi';

const SalesforceExportModal = ({
  isOpen,
  onClose,
  theme = 'dark',
  objectName,
  externalIdField,
  records,
  fieldMappings = [],
  keyMapping = {},
  allAvailableFields = [],
  presetSfFields = [],
  matchMode = 'externalId',
  matchResult = null,
  recordMetadata = {},
  metadataColumns = [],
  unmatchedRows = [],
  onImportComplete,
}) => {
  const [phase, setPhase] = useState('preview'); // preview | running | done
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleExecute = async () => {
    setPhase('running');
    setError(null);
    setProgress({ current: 0, total: records.length });

    try {
      const res = await salesforceApi.upsertRecords(
        objectName,
        externalIdField,
        records,
        (prog) => setProgress({ current: prog.current, total: prog.total })
      );
      setResult(res);
      setPhase('done');
      if (res) {
        onImportComplete?.({
          totalRecords: res.totalRecords,
          created: res.created,
          updated: res.updated,
          errors: res.errors,
          errorSummary: res.errorDetails?.slice(0, 3).map(e => e.message).join(', ') || '',
        }, records);
      }
    } catch (e) {
      setError(e.message);
      setPhase('done');
    }
  };

  const handleClose = () => {
    setPhase('preview');
    setResult(null);
    setError(null);
    onClose();
  };

  // SF フィールド名 → ラベル変換
  const sfFieldLabel = (apiName) => {
    const f = presetSfFields.find(sf => sf.name === apiName);
    return f ? f.label : apiName;
  };

  // DataTable フィールド名 → ラベル変換
  const dtFieldLabel = (fieldId) => {
    const f = allAvailableFields.find(af => af.id === fieldId);
    return f ? f.label : fieldId;
  };

  // マッピング情報付きのヘッダー生成
  const previewColumns = [];
  // キーフィールド
  if (matchMode === 'soqlLookup') {
    previewColumns.push({
      sfApiName: 'Id',
      sfLabel: 'SF Record ID',
      dtLabel: dtFieldLabel(keyMapping.dataTableColumnId),
      isKey: true,
    });
  } else if (keyMapping.sfFieldApiName) {
    previewColumns.push({
      sfApiName: keyMapping.sfFieldApiName,
      sfLabel: sfFieldLabel(keyMapping.sfFieldApiName),
      dtLabel: dtFieldLabel(keyMapping.dataTableColumnId),
      isKey: true,
    });
  }
  // マッピングされたフィールド
  fieldMappings.forEach(m => {
    if (m.sfFieldApiName && m.enabled) {
      previewColumns.push({
        sfApiName: m.sfFieldApiName,
        sfLabel: sfFieldLabel(m.sfFieldApiName),
        dtLabel: dtFieldLabel(m.dataTableColumnId),
        isKey: false,
      });
    }
  });

  const bgClass = theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-gray-200';
  const textClass = theme === 'dark' ? 'text-white' : 'text-gray-800';
  const mutedClass = theme === 'dark' ? 'text-white/60' : 'text-gray-500';
  const cardClass = theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={phase !== 'running' ? handleClose : undefined} />
      <div className={`relative w-full max-w-5xl mx-4 rounded-2xl border shadow-2xl ${bgClass} max-h-[90vh] flex flex-col`}>
        {/* ヘッダー */}
        <div className={`flex items-center justify-between p-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
          <h3 className={`text-lg font-bold ${textClass}`}>
            {phase === 'preview' && 'インポートプレビュー'}
            {phase === 'running' && 'インポート実行中...'}
            {phase === 'done' && 'インポート完了'}
          </h3>
          {phase !== 'running' && (
            <button onClick={handleClose} className={`p-1 rounded-lg ${theme === 'dark' ? 'hover:bg-white/10 text-white/60' : 'hover:bg-gray-100 text-gray-400'}`}>
              <X size={20} />
            </button>
          )}
        </div>

        {/* コンテンツ */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {phase === 'preview' && (
            <>
              {/* サマリー */}
              <div className={`rounded-xl border p-4 space-y-2 ${cardClass}`}>
                <div className="flex justify-between text-sm">
                  <span className={mutedClass}>対象オブジェクト</span>
                  <span className={textClass}>{objectName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={mutedClass}>{matchMode === 'soqlLookup' ? '更新方式' : '突合キー (SF側)'}</span>
                  <span className={textClass}>
                    {matchMode === 'soqlLookup'
                      ? 'SOQL Lookup → SF Record ID直接更新'
                      : `${sfFieldLabel(externalIdField)} (${externalIdField})`}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={mutedClass}>{matchMode === 'soqlLookup' ? 'マッチ済みレコード数' : 'レコード数'}</span>
                  <span className={textClass}>{records.length} 件</span>
                </div>
                {matchMode === 'soqlLookup' && matchResult && (
                  <div className="flex justify-between text-sm">
                    <span className={mutedClass}>未マッチ（スキップ）</span>
                    <span className={`${matchResult.unmatched > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {matchResult.unmatched} 件
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className={mutedClass}>マッピング項目数</span>
                  <span className={textClass}>{fieldMappings.length} 項目</span>
                </div>
              </div>

              {/* フルプレビューテーブル */}
              {records.length > 0 && previewColumns.length > 0 && (
                <div>
                  <div className={`text-xs mb-2 ${mutedClass}`}>
                    インポートデータプレビュー（{Math.min(records.length, 50)}件 / {records.length}件表示）
                  </div>
                  <div className={`rounded-lg border overflow-x-auto ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className={`sticky top-0 ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-100'}`}>
                          <tr>
                            <th className={`px-3 py-2 text-left font-medium whitespace-nowrap ${mutedClass}`}>#</th>
                            {previewColumns.map((col, i) => (
                              <th
                                key={i}
                                className={`px-3 py-2 text-left font-medium whitespace-nowrap ${
                                  col.isKey
                                    ? theme === 'dark' ? 'text-indigo-300 bg-indigo-500/10' : 'text-indigo-700 bg-indigo-50'
                                    : mutedClass
                                }`}
                              >
                                <div>{col.sfLabel}</div>
                                <div className={`font-normal ${mutedClass}`}>{col.dtLabel} &rarr; {col.sfApiName}</div>
                              </th>
                            ))}
                            {metadataColumns.map((mc, i) => (
                              <th
                                key={`meta_${i}`}
                                className={`px-3 py-2 text-left font-medium whitespace-nowrap ${
                                  theme === 'dark' ? 'text-teal-300 bg-teal-500/10' : 'text-teal-700 bg-teal-50'
                                }`}
                              >
                                <div>{mc.label}</div>
                                <div className={`font-normal ${mutedClass}`}>参照情報</div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {records.slice(0, 50).map((record, i) => (
                            <tr key={i} className={theme === 'dark' ? 'border-t border-white/5' : 'border-t border-gray-100'}>
                              <td className={`px-3 py-1.5 whitespace-nowrap ${mutedClass}`}>{i + 1}</td>
                              {previewColumns.map((col, j) => (
                                <td
                                  key={j}
                                  className={`px-3 py-1.5 whitespace-nowrap ${
                                    col.isKey
                                      ? theme === 'dark' ? 'text-indigo-300 bg-indigo-500/5' : 'text-indigo-700 bg-indigo-50/50'
                                      : textClass
                                  }`}
                                >
                                  {record[col.sfApiName] !== null && record[col.sfApiName] !== undefined
                                    ? (typeof record[col.sfApiName] === 'number'
                                      ? record[col.sfApiName].toLocaleString()
                                      : String(record[col.sfApiName]))
                                    : '-'}
                                </td>
                              ))}
                              {metadataColumns.map((mc, j) => {
                                const meta = recordMetadata[record.Id];
                                const val = meta ? meta[mc.fieldPath] : null;
                                return (
                                  <td
                                    key={`meta_${j}`}
                                    className={`px-3 py-1.5 whitespace-nowrap ${
                                      theme === 'dark' ? 'text-teal-300/80 bg-teal-500/5' : 'text-teal-700 bg-teal-50/50'
                                    }`}
                                  >
                                    {val != null ? String(val) : '-'}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {records.length > 50 && (
                    <div className={`text-xs mt-1 ${mutedClass}`}>
                      ...他 {records.length - 50}件（プレビューは先頭50件のみ表示）
                    </div>
                  )}
                </div>
              )}

              {/* 未マッチデータ（SOQL Lookupモードのみ） */}
              {matchMode === 'soqlLookup' && unmatchedRows.length > 0 && previewColumns.length > 0 && (
                <div>
                  <div className={`text-xs mb-2 flex items-center gap-1.5 ${theme === 'dark' ? 'text-amber-300' : 'text-amber-600'}`}>
                    <AlertTriangle size={12} />
                    未マッチデータ（スキップ対象）: {unmatchedRows.length}件
                    {unmatchedRows.length > 50 && `（先頭50件表示）`}
                  </div>
                  <div className={`rounded-lg border overflow-x-auto ${theme === 'dark' ? 'border-amber-500/20' : 'border-amber-200'}`}>
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className={`sticky top-0 ${theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-50'}`}>
                          <tr>
                            <th className={`px-3 py-2 text-left font-medium whitespace-nowrap ${mutedClass}`}>#</th>
                            {previewColumns.map((col, i) => (
                              <th
                                key={i}
                                className={`px-3 py-2 text-left font-medium whitespace-nowrap ${mutedClass}`}
                              >
                                <div>{col.sfLabel}</div>
                                <div className={`font-normal ${mutedClass}`}>{col.dtLabel} &rarr; {col.sfApiName}</div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {unmatchedRows.slice(0, 50).map((row, i) => (
                            <tr key={i} className={theme === 'dark' ? 'border-t border-amber-500/10' : 'border-t border-amber-100'}>
                              <td className={`px-3 py-1.5 whitespace-nowrap ${mutedClass}`}>{i + 1}</td>
                              {previewColumns.map((col, j) => (
                                <td
                                  key={j}
                                  className={`px-3 py-1.5 whitespace-nowrap ${
                                    col.isKey
                                      ? theme === 'dark' ? 'text-amber-300/60' : 'text-amber-500'
                                      : theme === 'dark' ? 'text-white/40' : 'text-gray-400'
                                  }`}
                                >
                                  {row[col.sfApiName] != null
                                    ? (typeof row[col.sfApiName] === 'number'
                                      ? row[col.sfApiName].toLocaleString()
                                      : String(row[col.sfApiName]))
                                    : '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${theme === 'dark' ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                <span>この操作はSalesforceのレコードを更新します。上記のデータ内容をよく確認してから実行してください。</span>
              </div>
            </>
          )}

          {phase === 'running' && (
            <div className="text-center py-8 space-y-4">
              <Loader2 size={40} className="animate-spin mx-auto text-indigo-400" />
              <div className={`text-sm ${textClass}`}>
                {progress.current} / {progress.total} 件処理中...
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total * 100) : 0}%` }}
                />
              </div>
            </div>
          )}

          {phase === 'done' && (
            <>
              {error ? (
                <div className="text-center py-6 space-y-3">
                  <AlertTriangle size={40} className="mx-auto text-rose-400" />
                  <div className={`text-sm ${textClass}`}>エラーが発生しました</div>
                  <div className={`text-xs ${theme === 'dark' ? 'text-rose-300' : 'text-rose-600'}`}>{error}</div>
                </div>
              ) : result && (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <CheckCircle size={40} className="mx-auto text-emerald-400 mb-3" />
                    <div className={`text-sm font-medium ${textClass}`}>インポートが完了しました</div>
                  </div>
                  <div className={`rounded-xl border p-4 space-y-2 ${cardClass}`}>
                    <div className="flex justify-between text-sm">
                      <span className={mutedClass}>処理レコード数</span>
                      <span className={textClass}>{result.totalRecords} 件</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className={mutedClass}>新規作成</span>
                      <span className="text-emerald-400">{result.created} 件</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className={mutedClass}>更新</span>
                      <span className="text-blue-400">{result.updated} 件</span>
                    </div>
                    {result.errors > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className={mutedClass}>エラー</span>
                        <span className="text-rose-400">{result.errors} 件</span>
                      </div>
                    )}
                  </div>
                  {result.errorDetails && result.errorDetails.length > 0 && (
                    <div>
                      <div className={`text-xs mb-1 ${mutedClass}`}>エラー詳細</div>
                      <div className={`rounded-lg border p-3 max-h-32 overflow-y-auto text-xs space-y-1 ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                        {result.errorDetails.map((err, i) => (
                          <div key={i} className={theme === 'dark' ? 'text-rose-300' : 'text-rose-600'}>
                            {err.referenceId && `[${err.referenceId}] `}{err.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* フッター */}
        <div className={`flex justify-end gap-3 p-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
          {phase === 'preview' && (
            <>
              <button
                onClick={handleClose}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white/80' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
              >
                キャンセル
              </button>
              <button
                onClick={handleExecute}
                className="px-4 py-2 rounded-lg text-sm bg-indigo-500 hover:bg-indigo-600 text-white transition-colors flex items-center gap-2"
              >
                <Upload size={14} />
                {matchMode === 'soqlLookup' ? 'PATCH更新実行' : 'インポート実行'} ({records.length}件)
              </button>
            </>
          )}
          {phase === 'done' && (
            <button
              onClick={handleClose}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white/80' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
            >
              閉じる
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesforceExportModal;
