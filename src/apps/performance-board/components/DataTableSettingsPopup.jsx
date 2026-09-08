// src/apps/performance-board/components/DataTableSettingsPopup.jsx
// テーブル設定ポップアップ（テーブル名・集計設定・ソート・高さ・固定列・フォントサイズ）

import React, { useState, useLayoutEffect } from 'react';
import DataTableInlinePopup from './DataTableInlinePopup';
import { getDefaultDataTableHeaderRowHeight } from '../utils/dataTableHeaderLayout';

const DataTableSettingsPopup = ({
  open,
  anchorRef,
  tableConfig,
  aggregationConfigs = [],
  theme = 'dark',
  onChange,    // ライブプレビュー用
  onSave,
  onDelete,
  onClose,
}) => {
  // ユーザーが実際に変更したフィールドだけを持つパッチ。tableConfig全体はコピーしない。
  // 全量コピーだと、ポップアップを開いている間に他の経路（ツールバー等）で変更された
  // フィールドを保存時に古い値で上書きしてしまうため。
  const [patch, setPatch] = useState({});
  // 表示・入力欄が参照する実効値（保存済み設定 + このポップアップでの未保存変更）
  const localSettings = { ...tableConfig, ...patch };
  const [anchorRect, setAnchorRect] = useState(null);

  // anchorRef から描画前に rect を取得し、位置のちらつきを防ぐ
  useLayoutEffect(() => {
    if (open && anchorRef?.current) {
      setAnchorRect(anchorRef.current.getBoundingClientRect());
    } else {
      setAnchorRect(null);
    }
  }, [open, anchorRef]);

  const update = (field, val) => {
    const next = { ...patch, [field]: val };
    setPatch(next);
    onChange?.(next); // ライブプレビューにもパッチだけを渡す
  };

  const handleSave = () => {
    onSave?.(patch); // 保存もパッチだけ。変更していないフィールドは一切上書きしない
  };

  const handleDelete = () => {
    onDelete?.();
  };

  const isDark = theme === 'dark';
  const labelClass = `block text-[10px] font-medium mb-0.5 ${isDark ? 'text-white/50' : 'text-gray-500'}`;
  const sectionTitleClass = `text-[10px] font-semibold mb-2 ${isDark ? 'text-indigo-200/70' : 'text-indigo-700'}`;
  const sectionBorderClass = isDark ? 'border-white/10' : 'border-gray-200';
  const inputClass = `w-full px-2 py-1 text-xs rounded border outline-none transition-colors ${
    isDark
      ? 'bg-slate-700 border-white/20 text-white focus:border-indigo-400'
      : 'bg-white border-gray-300 text-gray-800 focus:border-indigo-400'
  }`;
  const selectClass = `w-full px-2 py-1 text-xs rounded border outline-none transition-colors cursor-pointer ${
    isDark
      ? 'bg-slate-700 border-white/20 text-white focus:border-indigo-400'
      : 'bg-white border-gray-300 text-gray-800 focus:border-indigo-400'
  }`;
  const optionClass = isDark ? 'bg-slate-800' : 'bg-white';

  // ソート候補フィールドを取得
  const sortableFields = aggregationConfigs.length > 0
    ? aggregationConfigs[0]?.fields || []
    : [];
  const defaultGroupByOptions = aggregationConfigs.filter(cfg => cfg.id !== '__no_aggregation__');

  return (
    <DataTableInlinePopup
      open={open}
      anchorRect={anchorRect}
      title="テーブル設定"
      onClose={onClose}
      onSave={handleSave}
      onDelete={handleDelete}
      theme={theme}
      maxWidth={320}
      saveLabel="保存"
      deleteLabel="テーブルを削除"
    >
      <div className="space-y-4">
        <section className="space-y-2">
          <h4 className={sectionTitleClass}>基本</h4>
          <div>
            <label className={labelClass}>テーブル名</label>
            <input
              type="text"
              value={localSettings.name || ''}
              onChange={(e) => update('name', e.target.value)}
              className={inputClass}
              placeholder="テーブル名"
            />
          </div>

          <div>
            <label className={labelClass}>デフォルト集計条件</label>
            <select
              value={localSettings.defaultGroupBy || ''}
              onChange={(e) => update('defaultGroupBy', e.target.value)}
              className={selectClass}
            >
              <option value="" className={optionClass}>集計条件なし（表示項目を使用）</option>
              {defaultGroupByOptions.map(cfg => (
                <option key={cfg.id} value={cfg.id} className={optionClass}>{cfg.label}</option>
              ))}
            </select>
          </div>

          {aggregationConfigs.length > 0 && (
            <div>
              <label className={labelClass}>集計設定</label>
              <select
                value={localSettings.aggregationConfigId || aggregationConfigs[0]?.id || ''}
                onChange={(e) => update('aggregationConfigId', e.target.value)}
                className={selectClass}
              >
                {aggregationConfigs.map(cfg => (
                  <option key={cfg.id} value={cfg.id} className={optionClass}>{cfg.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <label className={labelClass}>横幅</label>
              <select
                value={localSettings.width || 'full'}
                onChange={(e) => update('width', e.target.value)}
                className={selectClass}
              >
                <option value="full" className={optionClass}>100%</option>
                <option value="twoThird" className={optionClass}>2/3</option>
                <option value="half" className={optionClass}>1/2</option>
                <option value="third" className={optionClass}>1/3</option>
              </select>
            </div>
            <div className="flex-1 min-w-0">
              <label className={labelClass}>表示件数</label>
              <input
                type="number"
                min={0}
                value={localSettings.displayLimit ?? 0}
                onChange={(e) => update('displayLimit', parseInt(e.target.value, 10) || 0)}
                className={inputClass}
                placeholder="0=全件"
              />
            </div>
          </div>
        </section>

        <section className={`space-y-2 border-t pt-3 ${sectionBorderClass}`}>
          <h4 className={sectionTitleClass}>並び順</h4>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <label className={labelClass}>デフォルトソート</label>
              <select
                value={localSettings.defaultSortField || ''}
                onChange={(e) => update('defaultSortField', e.target.value || null)}
                className={selectClass}
              >
                <option value="" className={optionClass}>なし</option>
                {sortableFields.map(f => (
                  <option key={f.id} value={f.id} className={optionClass}>{f.label || f.id}</option>
                ))}
              </select>
            </div>
            <div className="w-20 flex-shrink-0">
              <label className={labelClass}>方向</label>
              <select
                value={localSettings.defaultSortDirection || 'asc'}
                onChange={(e) => update('defaultSortDirection', e.target.value)}
                className={selectClass}
              >
                <option value="asc" className={optionClass}>昇順</option>
                <option value="desc" className={optionClass}>降順</option>
              </select>
            </div>
          </div>
        </section>

        <section className={`space-y-2 border-t pt-3 ${sectionBorderClass}`}>
          <h4 className={sectionTitleClass}>サイズ</h4>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <label className={labelClass}>最大高さ (px)</label>
              <input
                type="number"
                value={localSettings.maxHeight || 600}
                onChange={(e) => update('maxHeight', parseInt(e.target.value, 10) || 600)}
                className={inputClass}
                min={100}
                max={2000}
                step={50}
              />
            </div>
            <div className="flex-1 min-w-0">
              <label className={labelClass}>固定カラム (列)</label>
              <input
                type="number"
                value={localSettings.stickyColumns ?? 0}
                onChange={(e) => update('stickyColumns', parseInt(e.target.value, 10) || 0)}
                className={inputClass}
                min={0}
                max={10}
                step={1}
              />
            </div>
          </div>
        </section>

        <section className={`space-y-2 border-t pt-3 ${sectionBorderClass}`}>
          <h4 className={sectionTitleClass}>文字サイズ (px)</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>全体</label>
              <input
                type="number"
                min={8}
                max={20}
                value={localSettings.fontSize || 12}
                onChange={(e) => update('fontSize', parseInt(e.target.value, 10) || 12)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>ヘッダー</label>
              <input
                type="number"
                min={8}
                max={20}
                value={localSettings.headerFontSize || ''}
                placeholder="自動"
                onChange={(e) => update('headerFontSize', parseInt(e.target.value, 10) || null)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>合計値</label>
              <input
                type="number"
                min={8}
                max={20}
                value={localSettings.summaryFontSize || ''}
                placeholder="自動"
                onChange={(e) => update('summaryFontSize', parseInt(e.target.value, 10) || null)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>データ行</label>
              <input
                type="number"
                min={8}
                max={20}
                value={localSettings.dataFontSize || ''}
                placeholder="自動"
                onChange={(e) => update('dataFontSize', parseInt(e.target.value, 10) || null)}
                className={inputClass}
              />
            </div>
          </div>
        </section>

        <section className={`space-y-2 border-t pt-3 ${sectionBorderClass}`}>
          <h4 className={sectionTitleClass}>行高さ (px)</h4>
          <div className="grid grid-cols-3 gap-2">
            <div className="min-w-0">
              <label className={labelClass}>ヘッダー</label>
              <input
                type="number"
                min={16}
                max={80}
                value={localSettings.headerRowHeight || ''}
                placeholder={`自動(${getDefaultDataTableHeaderRowHeight(localSettings.headerFontSize || localSettings.fontSize || 12)})`}
                onChange={(e) => update('headerRowHeight', e.target.value ? parseInt(e.target.value, 10) : null)}
                className={inputClass}
              />
            </div>
            <div className="min-w-0">
              <label className={labelClass}>合計値</label>
              <input
                type="number"
                min={16}
                max={80}
                value={localSettings.summaryRowHeight || ''}
                placeholder={`自動(${(localSettings.fontSize || 12) + 18})`}
                onChange={(e) => update('summaryRowHeight', e.target.value ? parseInt(e.target.value, 10) : null)}
                className={inputClass}
              />
            </div>
            <div className="min-w-0">
              <label className={labelClass}>データ行</label>
              <input
                type="number"
                min={16}
                max={80}
                value={localSettings.dataRowHeight || ''}
                placeholder={`自動(${(localSettings.fontSize || 12) + 14})`}
                onChange={(e) => update('dataRowHeight', e.target.value ? parseInt(e.target.value, 10) : null)}
                className={inputClass}
              />
            </div>
          </div>
        </section>

        <p className={`text-[10px] pt-2 border-t ${sectionBorderClass} ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
          指標フィルター・カラム値フィルター・表示フィールドの順序は
          「設定 &amp; データ」画面から設定できます。
        </p>
      </div>
    </DataTableInlinePopup>
  );
};

export default DataTableSettingsPopup;
