// src/apps/performance-board/components/DataTableColumnEditPopup.jsx
// 列編集ポップアップ: DataTableInlinePopup + CalcEditForm を組み合わせ

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import DataTableInlinePopup from './DataTableInlinePopup';
import CalcEditForm from './CalcEditForm';
import { PRESET_COLORS } from '../../../constants';

const DataTableColumnEditPopup = ({
  open,
  anchorRef,
  col,
  calc,
  systemFields = [],
  dataSources = [],
  aggregationConfigs = [],
  allCalcs = [],
  theme = 'dark',
  isEditMode = false,
  onCalcChange,
  onCalcSave,
  onCalcDelete,
  onClose,
  columnAliases = {},
  columnColors = {},
  onAliasChange,
  onColorChange,
}) => {
  const isNewCalc = col?.id === '__new__';
  const isCalcCol = !!calc || isNewCalc;
  const currentColorId = columnColors[col?.id] || 'default';
  const currentAlias = columnAliases[col?.id] || '';
  const [localCalc, setLocalCalc] = useState(calc);
  const [anchorRect, setAnchorRect] = useState(null);
  const [aliasDraft, setAliasDraft] = useState(currentAlias);
  const aliasDraftRef = useRef(currentAlias);
  const lastCommittedAliasRef = useRef(currentAlias);

  // anchorRef から描画前に rect を取得し、位置のちらつきを防ぐ
  useLayoutEffect(() => {
    if (open && anchorRef?.current) {
      setAnchorRect(anchorRef.current.getBoundingClientRect());
    } else {
      setAnchorRect(null);
    }
  }, [open, anchorRef]);

  // calc が外部から変わった時に同期（ポップアップが再オープンする場合）
  useEffect(() => {
    setLocalCalc(calc);
  }, [calc]);

  // 入力中の空白を保持し、ポップアップを開いた時と対象列の変更時だけ保存済み値へ同期する。
  // columnAliases は毎レンダー新しい参照になり得るため依存に含めない（含めると入力が巻き戻る）。
  useEffect(() => {
    const savedAlias = columnAliases[col?.id] || '';
    setAliasDraft(savedAlias);
    aliasDraftRef.current = savedAlias;
    lastCommittedAliasRef.current = savedAlias;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, col?.id]);

  const handleCalcFormChange = (updated) => {
    setLocalCalc(updated);
    onCalcChange?.(updated);
  };

  const commitAlias = () => {
    if (isNewCalc) return;
    const nextAlias = aliasDraftRef.current;
    if (nextAlias === lastCommittedAliasRef.current) return;
    lastCommittedAliasRef.current = nextAlias;
    onAliasChange?.(col?.id, nextAlias);
  };

  const handleClose = () => {
    commitAlias();
    onClose?.();
  };

  const handleSave = () => {
    commitAlias();
    if (localCalc && isEditMode) {
      onCalcSave?.(localCalc);
    }
    onClose?.();
  };

  const handleDelete = calc?.id && isEditMode
    ? () => {
        onCalcDelete?.(calc.id);
        onClose?.();
      }
    : null;

  const isDark = theme === 'dark';
  const inputClass = isDark
    ? 'bg-white/10 border border-white/20 text-white placeholder-white/30 focus:border-indigo-400'
    : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-indigo-500';
  const labelClass = isDark ? 'text-white/60' : 'text-gray-500';

  const title = isCalcCol
    ? `${isEditMode ? '計算式を編集' : '列の設定'}: ${col?.label || ''}`
    : `列を編集: ${col?.label || ''}`;

  return (
    <DataTableInlinePopup
      open={open}
      anchorRect={anchorRect}
      title={title}
      onClose={handleClose}
      onSave={handleSave}
      onDelete={handleDelete}
      deleteLabel="削除"
      saveLabel={isCalcCol && !isEditMode ? '閉じる' : '保存'}
      theme={theme}
      maxWidth={420}
    >
      <div className="space-y-4">
        {!isNewCalc && (
          <>
            {/* 表示名（エイリアス）入力 */}
            <div>
              <label className={`text-xs block mb-1 ${labelClass}`}>表示名（列ヘッダー）</label>
              <input
                type="text"
                value={aliasDraft}
                onChange={(e) => {
                  setAliasDraft(e.target.value);
                  aliasDraftRef.current = e.target.value;
                }}
                onBlur={commitAlias}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                className={`w-full ${inputClass} rounded-lg px-3 py-2 text-sm outline-none transition-colors`}
                placeholder={col?.label || ''}
              />
              {currentAlias && (
                <p className={`text-[10px] mt-0.5 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
                  元のラベル: {col?.label}
                </p>
              )}
            </div>

            {/* カラー選択 */}
            <div>
              <label className={`text-xs block mb-1 ${labelClass}`}>列カラー（ヘッダー下のラインの色）</label>
              <div className="flex gap-1 flex-wrap">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color.id}
                    onClick={() => onColorChange?.(col?.id, color.id)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                      currentColorId === color.id
                        ? 'border-indigo-500 ring-2 ring-indigo-500/50'
                        : isDark ? 'border-white/20' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color.hex || (isDark ? '#64748b' : '#94a3b8') }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* 計算式列の場合: CalcEditForm を表示 */}
        {isCalcCol && (
          <div className={`border-t pt-4 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
            {isEditMode ? (
              <>
                <h4 className={`text-xs font-semibold mb-3 ${isDark ? 'text-white/80' : 'text-gray-700'}`}>計算式設定</h4>
                <CalcEditForm
                  calc={localCalc}
                  systemFields={systemFields}
                  dataSources={dataSources}
                  aggregationConfigs={aggregationConfigs}
                  allCalcs={allCalcs}
                  onChange={handleCalcFormChange}
                  theme={theme}
                />
              </>
            ) : (
              <p className={`text-xs leading-relaxed ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                計算式を編集するには、ツールバーの「✏️ 編集」から編集モードに入ってください。
              </p>
            )}
          </div>
        )}
      </div>
    </DataTableInlinePopup>
  );
};

export default DataTableColumnEditPopup;
