// src/apps/performance-board/components/settings/ReshapeSettingsPanel.jsx
// 稼働実績用変換の設定パネル（自動検出対応版）

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Shuffle, Eye, Wand2, Clock, Search, Download } from 'lucide-react';
import { generateGroups, generateGroupsFromPatterns, generateReshapePreview, detectWidePattern, detectWidePatterns } from '../../utils/reshapeUtils';

// フィールド名にラベルを付けて表示
const displayFieldName = (name, metadata) => {
  if (!metadata?.[name]) return name;
  return `${name} (${metadata[name]})`;
};

// ヘルプテキストのスタイル
const helpTextClass = (theme) =>
  `text-[9px] mb-1 ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`;

const ReshapeSettingsPanel = ({
  source,
  updateReshapeSettings,
  updateReshapeSettingsBatch,
  updateReshapeGroups,
  theme,
  inputClass,
  labelSmClass,
  borderClass,
  optionClass,
  sourceCache,
  mainKeyInfo,
}) => {
  const rs = source.reshapeSettings || {};
  const enabled = rs.enabled || false;
  const rawHeaders = source._rawHeaders || source.headers || [];
  const fieldMetadata = source.fieldMetadata || {};

  // rawHeaders + soqlFields の合集合で全カラムリストを作成（リレーション含む）
  const allAvailableColumns = useMemo(() => {
    const set = new Set(rawHeaders);
    if (source.soqlFields) {
      source.soqlFields.split(',').map(f => f.trim()).filter(Boolean).forEach(f => set.add(f));
    }
    return [...set];
  }, [rawHeaders, source.soqlFields]);

  // パターン設定（複数パターン対応）
  const [patterns, setPatterns] = useState(() => {
    if (rs._patterns?.length > 0) return rs._patterns;
    // 旧フォーマットからマイグレーション
    return [{
      id: 'p0',
      startIdx: rs._patternStartIdx ?? 0,
      colsPerDay: rs._patternColsPerDay ?? 4,
      numDays: rs._patternNumDays ?? 31,
      labels: rs._patternLabels ?? ['開始時間', '終了時間', '休憩有無', '稼働時間'],
      labelsVisible: rs._patternLabelsVisible ?? [true, true, true, true],
    }];
  });
  const [detectResult, setDetectResult] = useState(null);
  const [columnSearchQuery, setColumnSearchQuery] = useState('');

  const prevPattern = useRef(null);
  const hasAutoDetected = useRef(!!(rs._patterns?.length > 0 || rs._patternLabels));

  // 有効化 + fieldMetadata取得済みの場合、パターンを自動検出
  useEffect(() => {
    if (!enabled || hasAutoDetected.current) return;
    if (rawHeaders.length === 0 || Object.keys(fieldMetadata).length === 0) return;
    hasAutoDetected.current = true;
    const result = detectWidePatterns(rawHeaders, fieldMetadata);
    if (result.success && result.patterns) {
      setDetectResult(result);
      setPatterns(result.patterns);
      const batchUpdates = {};
      if (result.dateColumnCandidate) batchUpdates.dateColumnName = result.dateColumnCandidate;
      if (result.fixedColumnCandidates?.length > 0) {
        const existingRelation = (rs.fixedColumnNames || []).filter(n => n.includes('.'));
        batchUpdates.fixedColumnNames = [...result.fixedColumnCandidates, ...existingRelation];
      }
      if (Object.keys(batchUpdates).length > 0) updateReshapeSettingsBatch(source.id, batchUpdates);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, rawHeaders.length, Object.keys(fieldMetadata).length]);

  // パターン変更時にグループを自動生成
  useEffect(() => {
    if (!enabled || rawHeaders.length === 0) return;

    const headersKey = rawHeaders.join('\0');
    const patternKey = JSON.stringify(patterns) + headersKey;
    if (prevPattern.current === patternKey) return;
    prevPattern.current = patternKey;

    const groups = generateGroupsFromPatterns(patterns, rawHeaders, fieldMetadata);
    const mergedLabelsVisible = patterns.flatMap(p => p.labelsVisible || []);

    updateReshapeSettingsBatch(source.id, {
      groups,
      _patterns: patterns,
      _patternLabelsVisible: mergedLabelsVisible,
      // 後方互換: 旧フィールドもpatterns[0]から同期
      _patternStartIdx: patterns[0]?.startIdx,
      _patternColsPerDay: patterns[0]?.colsPerDay,
      _patternNumDays: patterns[0]?.numDays,
      _patternLabels: patterns[0]?.labels,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, patterns, rawHeaders]);

  // パターン追加
  const addPattern = useCallback(() => {
    setPatterns(prev => [...prev, {
      id: `p${Date.now()}`,
      startIdx: 0,
      colsPerDay: 1,
      numDays: 31,
      labels: ['列1'],
      labelsVisible: [true],
    }]);
  }, []);

  // パターン削除（最低1つは残す）
  const removePattern = useCallback((id) => {
    setPatterns(prev => prev.length > 1 ? prev.filter(p => p.id !== id) : prev);
  }, []);

  // パターン個別更新
  const updatePatternField = useCallback((id, field, value) => {
    setPatterns(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  }, []);

  // パターン内のcolsPerDay変更（labels配列長も調整）
  const handlePatternColsChange = useCallback((id, newCount) => {
    setPatterns(prev => prev.map(p => {
      if (p.id !== id) return p;
      const nextLabels = [...p.labels];
      while (nextLabels.length < newCount) nextLabels.push(`列${nextLabels.length + 1}`);
      if (nextLabels.length > newCount) nextLabels.length = newCount;
      const nextVisible = [...p.labelsVisible];
      while (nextVisible.length < newCount) nextVisible.push(true);
      if (nextVisible.length > newCount) nextVisible.length = newCount;
      return { ...p, colsPerDay: newCount, labels: nextLabels, labelsVisible: nextVisible };
    }));
  }, []);

  // 自動検出ハンドラ
  const handleAutoDetect = useCallback(() => {
    const result = detectWidePatterns(rawHeaders, fieldMetadata);
    setDetectResult(result);
    if (result.success && result.patterns) {
      setPatterns(result.patterns);
      const batchUpdates = {};
      if (result.dateColumnCandidate) {
        batchUpdates.dateColumnName = result.dateColumnCandidate;
      }
      if (result.fixedColumnCandidates?.length > 0) {
        const existingRelation = (rs.fixedColumnNames || []).filter(n => n.includes('.'));
        batchUpdates.fixedColumnNames = [...result.fixedColumnCandidates, ...existingRelation];
      }
      if (Object.keys(batchUpdates).length > 0) {
        updateReshapeSettingsBatch(source.id, batchUpdates);
      }
    }
  }, [rawHeaders, fieldMetadata, source.id, updateReshapeSettingsBatch, rs.fixedColumnNames]);

  // 整形後プレビューデータ（設定変更時のみ再計算）
  const preview = useMemo(() => {
    if (!enabled || rawHeaders.length === 0) return null;
    return generateReshapePreview(rawHeaders, rs, fieldMetadata, source.soqlFields || '');
  }, [enabled, rs, rawHeaders, fieldMetadata, source.soqlFields]);

  if (rawHeaders.length === 0) return null;

  // 日付カラム候補の分類
  const dateRelatedHeaders = rawHeaders.filter(h => {
    const label = fieldMetadata[h] || '';
    return label.includes('日付') || label.includes('Date');
  });
  const otherHeaders = rawHeaders.filter(h => !dateRelatedHeaders.includes(h));

  const accentColor = theme === 'dark' ? 'text-cyan-300/80' : 'text-cyan-600';
  const panelBg = theme === 'dark' ? 'bg-black/20' : 'bg-cyan-50';
  const panelBorder = 'border-cyan-500/30';
  const sectionLabel = `text-[10px] font-medium ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'}`;
  const mutedText = theme === 'dark' ? 'text-white/40' : 'text-gray-400';

  return (
    <div className="space-y-2 mt-2">
      <label className={`flex items-center gap-2 text-xs cursor-pointer ${accentColor}`}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => updateReshapeSettings(source.id, 'enabled', e.target.checked)}
          className="accent-cyan-500"
        />
        <Shuffle size={10} /> 稼働実績用変換
      </label>

      {enabled && (
        <div className={`p-3 rounded-lg border ${panelBorder} ${panelBg} space-y-3`}>
          {/* 自動検出 */}
          <div className={`p-2 rounded border ${borderClass} ${theme === 'dark' ? 'bg-white/5' : 'bg-white/50'} flex items-center gap-3`}>
            <button
              type="button"
              onClick={handleAutoDetect}
              className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded whitespace-nowrap ${
                theme === 'dark'
                  ? 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30'
                  : 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200'
              } transition-colors`}
            >
              <Wand2 size={10} /> パターンを自動検出
            </button>
            <p className={`text-[9px] ${mutedText}`}>
              フィールドラベルから「N日○○」の繰り返しパターンを自動認識します
            </p>
            {detectResult && (
              <div className={`ml-auto px-2 py-1 rounded text-[10px] whitespace-nowrap ${
                detectResult.success
                  ? (theme === 'dark' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700')
                  : (theme === 'dark' ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-700')
              }`}>
                {detectResult.message}
              </div>
            )}
          </div>

          {/* 2カラムレイアウト: 左=データ設定, 右=パターン設定 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ===== 左カラム: データ設定 ===== */}
            <div className="space-y-3">
              {/* 日付カラム（年 + 月） */}
              <div>
                <label className={`text-[10px] ${labelSmClass} block mb-0.5`}>稼働日の元データ</label>
                <p className={helpTextClass(theme)}>
                  年月カラムの値 + N日 → 稼働日を生成（例: 2026年 + 3月 + 1日 → 2026/03/01）
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`text-[9px] ${mutedText} block mb-0.5`}>年（または年月日）カラム</label>
                    <select
                      value={rs.dateColumnName || ''}
                      onChange={(e) => updateReshapeSettings(source.id, 'dateColumnName', e.target.value)}
                      className={`w-full ${inputClass} rounded px-2 py-1 text-xs`}
                    >
                      <option value="" className={optionClass}>- 選択 -</option>
                      {dateRelatedHeaders.length > 0 && (
                        <optgroup label="日付フィールド">
                          {dateRelatedHeaders.map((h, i) => (
                            <option key={`date-${i}`} value={h} className={optionClass}>
                              {displayFieldName(h, fieldMetadata)}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="その他">
                        {otherHeaders.map((h, i) => (
                          <option key={`other-${i}`} value={h} className={optionClass}>
                            {displayFieldName(h, fieldMetadata)}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label className={`text-[9px] ${mutedText} block mb-0.5`}>月カラム（年月が別の場合）</label>
                    <select
                      value={rs.monthColumnName || ''}
                      onChange={(e) => updateReshapeSettings(source.id, 'monthColumnName', e.target.value)}
                      className={`w-full ${inputClass} rounded px-2 py-1 text-xs`}
                    >
                      <option value="" className={optionClass}>- 不要 -</option>
                      {rawHeaders.map((h, i) => (
                        <option key={i} value={h} className={optionClass}>
                          {displayFieldName(h, fieldMetadata)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 出力日付列名 + 空日スキップ + 時間変換 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`text-[10px] ${labelSmClass} block mb-1`}>出力日付列名</label>
                  <input
                    type="text"
                    value={rs.generatedDateColumnName || '稼働日'}
                    onChange={(e) => updateReshapeSettings(source.id, 'generatedDateColumnName', e.target.value)}
                    className={`w-full ${inputClass} rounded px-2 py-1 text-xs`}
                  />
                </div>
                <div className="flex flex-col justify-end gap-1 pb-1">
                  <label className={`flex items-center gap-2 text-[10px] cursor-pointer ${labelSmClass}`}>
                    <input
                      type="checkbox"
                      checked={rs.skipEmptyDays !== false}
                      onChange={(e) => updateReshapeSettings(source.id, 'skipEmptyDays', e.target.checked)}
                      className="accent-cyan-500"
                    />
                    空日スキップ
                  </label>
                  <label className={`flex items-center gap-1.5 text-[10px] cursor-pointer ${labelSmClass}`}>
                    <input
                      type="checkbox"
                      checked={rs.convertTimeToHours || false}
                      onChange={(e) => updateReshapeSettings(source.id, 'convertTimeToHours', e.target.checked)}
                      className="accent-cyan-500"
                    />
                    <Clock size={9} />
                    <span>時間→数値</span>
                    <span className={`${mutedText}`}>(8:00→8)</span>
                  </label>
                </div>
              </div>

              {/* 突合キー */}
              <div>
                <label className={`text-[10px] ${labelSmClass} block mb-0.5`}>突合キー</label>
                <p className={helpTextClass(theme)}>
                  メインソースのキーと一致するカラムを選択（ID等）。日付×キーでデータを結合します。
                </p>
                {mainKeyInfo && (
                  <div className={`mb-1 px-2 py-1 rounded text-[10px] ${
                    theme === 'dark' ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    メインソースのキー: <strong>{mainKeyInfo.sourceName}</strong> → <strong>{mainKeyInfo.keyColumnName}</strong>
                    <br />
                    <span className={theme === 'dark' ? 'text-amber-300/60' : 'text-amber-600/70'}>
                      このキーの値と同じ値が入っているカラムを選択してください
                    </span>
                  </div>
                )}
                <select
                  value={rs.reshapeKeyColumn || ''}
                  onChange={(e) => {
                    updateReshapeSettingsBatch(source.id, { reshapeKeyColumn: e.target.value });
                  }}
                  className={`w-full ${inputClass} rounded px-2 py-1 text-xs`}
                >
                  <option value="" className={optionClass}>- 自動（出力カラムの先頭） -</option>
                  {(source.headers || []).map((h, i) => (
                    <option key={i} value={h} className={optionClass}>
                      {fieldMetadata[h] || h}
                    </option>
                  ))}
                </select>
                {/* キー値サンプル */}
                {(() => {
                  const cachedRows = sourceCache?.[source.id];
                  if (!cachedRows || cachedRows.length === 0) return null;
                  const hdrs = source.headers || [];
                  const keyCol = rs.reshapeKeyColumn || hdrs[1] || '';
                  const keyIdx = hdrs.indexOf(keyCol);
                  if (keyIdx < 0) return null;
                  const uniqueVals = [...new Set(cachedRows.slice(0, 20).map(r => r[keyIdx]).filter(v => v != null && v !== ''))].slice(0, 5);
                  if (uniqueVals.length === 0) return null;
                  return (
                    <div className={`mt-1 px-2 py-1 rounded text-[9px] ${
                      theme === 'dark' ? 'bg-white/5 text-white/50' : 'bg-gray-50 text-gray-500'
                    }`}>
                      このカラムの値: {uniqueVals.map(String).join(', ')}
                      {mainKeyInfo && (
                        <span className={
                          theme === 'dark' ? ' text-amber-300/60' : ' text-amber-600/70'
                        }> ← メインソースの「{mainKeyInfo.keyColumnName}」と一致する？</span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* ===== 右カラム: パターン・出力設定 ===== */}
            <div className="space-y-3">
              {/* 繰返しパターン（複数対応） */}
              <div>
                <div className={`${sectionLabel} mb-2`}>繰返しパターン</div>
                {patterns.map((pattern, pIdx) => (
                  <div key={pattern.id} className={`mb-2 p-2 rounded border ${borderClass} ${theme === 'dark' ? 'bg-white/5' : 'bg-white/50'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-medium ${accentColor}`}>パターン{pIdx + 1}</span>
                      {patterns.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePattern(pattern.id)}
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            theme === 'dark' ? 'text-rose-300 hover:bg-rose-500/20' : 'text-rose-600 hover:bg-rose-100'
                          } transition-colors`}
                        >&times;</button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className={`text-[10px] ${labelSmClass} block mb-0.5`}>開始列</label>
                        <p className={helpTextClass(theme)}>繰り返しの最初の列</p>
                        <select
                          value={pattern.startIdx}
                          onChange={(e) => updatePatternField(pattern.id, 'startIdx', parseInt(e.target.value))}
                          className={`w-full ${inputClass} rounded px-2 py-1 text-xs`}
                        >
                          {rawHeaders.map((h, i) => (
                            <option key={i} value={i} className={optionClass}>
                              {displayFieldName(h, fieldMetadata)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={`text-[10px] ${labelSmClass} block mb-0.5`}>1日あたり列数</label>
                        <p className={helpTextClass(theme)}>1日分のカラム数</p>
                        <input
                          type="number"
                          min={1} max={20}
                          value={pattern.colsPerDay}
                          onChange={(e) => handlePatternColsChange(pattern.id, Math.max(1, parseInt(e.target.value) || 1))}
                          className={`w-full ${inputClass} rounded px-2 py-1 text-xs`}
                        />
                      </div>
                      <div>
                        <label className={`text-[10px] ${labelSmClass} block mb-0.5`}>日数</label>
                        <p className={helpTextClass(theme)}>繰り返す日数</p>
                        <input
                          type="number"
                          min={1} max={31}
                          value={pattern.numDays}
                          onChange={(e) => updatePatternField(pattern.id, 'numDays', Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
                          className={`w-full ${inputClass} rounded px-2 py-1 text-xs`}
                        />
                      </div>
                    </div>

                    <div className="mt-2">
                      <label className={`text-[10px] ${labelSmClass} block mb-1`}>パターン列（チェック = 出力に含める）</label>
                      <p className={helpTextClass(theme)}>
                        元データ「N日○○」→ チェックONの列のみ出力されます
                      </p>
                      <div className="space-y-1">
                        {pattern.labels.map((label, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={pattern.labelsVisible[i] !== false}
                              onChange={(e) => {
                                const next = [...pattern.labelsVisible];
                                next[i] = e.target.checked;
                                updatePatternField(pattern.id, 'labelsVisible', next);
                              }}
                              className="accent-cyan-500"
                            />
                            <span className={`text-[9px] ${mutedText} whitespace-nowrap`}>N日</span>
                            <input
                              type="text"
                              value={label}
                              onChange={(e) => {
                                const next = [...pattern.labels];
                                next[i] = e.target.value;
                                updatePatternField(pattern.id, 'labels', next);
                              }}
                              className={`${inputClass} rounded px-2 py-0.5 text-[10px] flex-1 ${pattern.labelsVisible[i] === false ? 'opacity-40' : ''}`}
                              placeholder={`列${i + 1}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addPattern}
                  className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded ${
                    theme === 'dark'
                      ? 'bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20'
                      : 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100'
                  } transition-colors`}
                >
                  + パターン追加
                </button>

                <div className={`mt-1 text-[9px] ${mutedText}`}>
                  {(rs.groups || []).length > 0
                    ? `${rs.groups.length}日分 × ${patterns.reduce((sum, p) => sum + p.labels.length, 0)}列のグループが自動生成されました`
                    : ''}
                </div>
              </div>

              {/* 出力カラム */}
              <div className={`pt-2 border-t ${borderClass}`}>
                <div className={`${sectionLabel} mb-0.5`}>出力カラム</div>
                <p className={helpTextClass(theme)}>
                  出力に含めるカラムを選択（日付・繰返しパターン以外）
                </p>
                {(() => {
                  const patternFields = new Set();
                  (rs.groups || []).forEach(g => g.columns?.forEach(c => patternFields.add(c.sourceName)));
                  const dateCol = rs.dateColumnName || '';
                  const normalFields = allAvailableColumns.filter(h => !patternFields.has(h) && h !== dateCol && !h.includes('.'));
                  const relationFields = allAvailableColumns.filter(h => h.includes('.'));
                  const q = columnSearchQuery.toLowerCase();
                  const matchesSearch = (h) => !q || h.toLowerCase().includes(q) || (fieldMetadata[h] || '').toLowerCase().includes(q);
                  const filteredNormal = normalFields.filter(matchesSearch);
                  const filteredRelation = relationFields.filter(matchesSearch);
                  const checkboxCls = `flex items-center gap-1.5 text-[10px] cursor-pointer ${
                    theme === 'dark' ? 'text-white/70 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                  }`;
                  const renderCheckbox = (h) => (
                    <label key={h} className={checkboxCls}>
                      <input
                        type="checkbox"
                        checked={(rs.fixedColumnNames || []).includes(h)}
                        onChange={(e) => {
                          const current = rs.fixedColumnNames || [];
                          const next = e.target.checked
                            ? [...current, h]
                            : current.filter(n => n !== h);
                          updateReshapeSettings(source.id, 'fixedColumnNames', next);
                        }}
                        className="accent-cyan-500"
                      />
                      <span className="font-mono">{displayFieldName(h, fieldMetadata)}</span>
                    </label>
                  );
                  return (
                    <>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded border ${borderClass} mb-1 ${theme === 'dark' ? 'bg-black/20' : 'bg-white'}`}>
                        <Search size={10} className={mutedText} />
                        <input
                          type="text"
                          value={columnSearchQuery}
                          onChange={(e) => setColumnSearchQuery(e.target.value)}
                          placeholder="カラム名・ラベルで検索"
                          className={`flex-1 bg-transparent text-[10px] outline-none ${theme === 'dark' ? 'text-white/80 placeholder:text-white/30' : 'text-gray-700 placeholder:text-gray-400'}`}
                        />
                      </div>
                      <div className={`max-h-40 overflow-y-auto p-2 rounded border ${borderClass} space-y-0.5`}>
                        {filteredNormal.length > 0 && (
                          <>
                            <div className={`text-[9px] font-medium pt-0.5 pb-0.5 ${mutedText}`}>元データ</div>
                            {filteredNormal.map(renderCheckbox)}
                          </>
                        )}
                        {filteredRelation.length > 0 && (
                          <>
                            <div className={`text-[9px] font-medium pt-1.5 pb-0.5 ${mutedText}`}>リレーション先</div>
                            {filteredRelation.map(renderCheckbox)}
                          </>
                        )}
                        {filteredNormal.length === 0 && filteredRelation.length === 0 && (
                          <p className={`text-[9px] ${mutedText}`}>
                            {q ? '一致するカラムがありません' : '利用可能なカラムがありません。「全フィールド取得」を実行してください。'}
                          </p>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* 整形後プレビュー（フル幅） */}
          {(() => {
            const cachedRows = sourceCache?.[source.id];
            const hasRealData = cachedRows && cachedRows.length > 0;
            const headers = hasRealData ? (source.headers || []) : preview?.displayHeaders;
            const rows = hasRealData ? cachedRows.slice(0, 5) : preview?.sampleRows;
            if (!headers || headers.length === 0) return null;
            return (
              <div className={`pt-2 border-t ${borderClass}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className={`${sectionLabel} flex items-center gap-1.5`}>
                    <Eye size={10} /> 整形後プレビュー
                    {hasRealData && (
                      <span className={`ml-1 px-1.5 py-0.5 rounded text-[8px] font-medium ${
                        theme === 'dark' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'
                      }`}>実データ</span>
                    )}
                  </div>
                  {hasRealData && (
                    <button
                      onClick={() => {
                        const allRows = cachedRows;
                        const escapeCsv = (val) => {
                          const s = String(val ?? '');
                          if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
                          return s;
                        };
                        const csvLines = [];
                        csvLines.push(headers.map(h => escapeCsv(fieldMetadata[h] || h)).join(','));
                        for (const row of allRows) {
                          csvLines.push(row.map(cell => escapeCsv(cell)).join(','));
                        }
                        const bom = '\uFEFF';
                        const blob = new Blob([bom + csvLines.join('\n')], { type: 'text/csv;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${source.name || 'reshape'}_整形後_${new Date().toISOString().slice(0, 10)}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className={`text-[10px] px-3 py-1 rounded flex items-center gap-1 ${
                        theme === 'dark' ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30' : 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200'
                      }`}
                    >
                      <Download size={10} /> CSVダウンロード ({cachedRows.length}件)
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="text-[10px] border-collapse w-full">
                    <thead>
                      <tr>
                        {headers.map((h, i) => {
                          const dateColName = rs.generatedDateColumnName || '稼働日';
                          const isDateCol = h === dateColName;
                          const isKeyCol = rs.reshapeKeyColumn ? h === rs.reshapeKeyColumn : (!isDateCol && i === 1);
                          return (
                            <th key={i} className={`px-2 py-1 border ${borderClass} font-medium whitespace-nowrap ${
                              theme === 'dark' ? 'bg-cyan-900/30 text-cyan-200' : 'bg-cyan-50 text-cyan-800'
                            }`}>
                              {fieldMetadata[h] || h}
                              {isDateCol && <span className={`ml-1 text-[8px] px-1 py-0.5 rounded ${
                                theme === 'dark' ? 'bg-sky-500/20 text-sky-300' : 'bg-sky-100 text-sky-600'
                              }`}>日付</span>}
                              {isKeyCol && <span className={`ml-1 text-[8px] px-1 py-0.5 rounded ${
                                theme === 'dark' ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-600'
                              }`}>突合キー</span>}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {(rows || []).map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td key={ci} className={`px-2 py-0.5 border ${borderClass} whitespace-nowrap ${
                              theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                            }`}>
                              {cell != null ? String(cell) : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className={`mt-1 text-[9px] ${mutedText}`}>
                  {hasRealData
                    ? `実データ先頭${rows.length}行。「更新」ボタンで最新データに更新されます。`
                    : '※ サンプルデータです。「更新」ボタンで実データに切り替わります。'
                  }
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default ReshapeSettingsPanel;
