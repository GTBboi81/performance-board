import { useMemo, useState } from 'react';
import { Eye, EyeOff, GripVertical, Trash2 } from 'lucide-react';
import { LAYOUT_ITEM_LABELS, LAYOUT_ITEM_TYPES } from '../layoutItems';
import LayoutAddPanel from './LayoutAddPanel';

const WIDTHS = ['quarter', 'third', 'half', 'twoThird', 'full'];

const LayoutTab = ({ localConfig, updateLocalConfig, glassClass, cardClass, inputClass, optionClass, textClass, textMutedClass, theme }) => {
  const layoutOrder = useMemo(() => localConfig.layoutOrder || [], [localConfig.layoutOrder]);
  const [dragIndex, setDragIndex] = useState(null);
  const usedIds = useMemo(() => new Set(layoutOrder.map((item) => item.refId).filter(Boolean)), [layoutOrder]);
  const availableItems = useMemo(() => {
    const groups = [
      ['kpiSection', localConfig.sections || [], (item) => item.title || item.name],
      ['chart', localConfig.chartConfigs || [], (item) => item.title],
      ['dataTable', localConfig.dataTables || [], (item) => item.name],
      ['comparisonTable', (localConfig.comparisonTables || []).filter((item) => item.enabled), (item) => item.label || item.name],
      ['pivotTable', localConfig.pivotTables || [], (item) => item.name],
      ['vendorPivotTable', (localConfig.vendorPivotTables || []).filter((item) => item.enabled), (item) => item.name],
      ['ranking', localConfig.rankingCards || [], (item) => item.title],
      ['heading', localConfig.headingCards || [], (item) => item.text],
    ];
    return groups.flatMap(([type, entries, label]) => entries
      .filter((entry) => !usedIds.has(entry.id))
      .map((entry) => ({ type, refId: entry.id, label: label(entry) || entry.id })));
  }, [localConfig, usedIds]);

  const updateOrder = (next) => updateLocalConfig('layoutOrder', next);
  const addItem = ({ type, refId }) => updateOrder([...layoutOrder, { id: `layout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, type, refId, visible: true, width: 'full' }]);
  const updateItem = (index, changes) => updateOrder(layoutOrder.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
  const removeItem = (index) => updateOrder(layoutOrder.filter((_, itemIndex) => itemIndex !== index));
  const moveItem = (from, to) => {
    if (from === to || from === null || to < 0 || to >= layoutOrder.length) return;
    const next = [...layoutOrder];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    updateOrder(next);
  };
  const labelFor = (item) => {
    if (item.type === 'row') return LAYOUT_ITEM_LABELS.row;
    return availableItems.find((entry) => entry.refId === item.refId)?.label
      || [localConfig.sections, localConfig.chartConfigs, localConfig.dataTables, localConfig.rankingCards, localConfig.headingCards, localConfig.pivotTables, localConfig.comparisonTables, localConfig.vendorPivotTables]
        .flatMap((entries) => entries || []).find((entry) => entry.id === item.refId)?.title
      || item.refId;
  };

  return <div className="space-y-6">
    <section className={`rounded-2xl p-6 ${glassClass}`}>
      <h2 className={`text-lg font-semibold mb-2 ${textClass}`}>レイアウト設定</h2>
      <p className={`text-sm mb-5 ${textMutedClass}`}>ドラッグして表示順を変え、表示状態と幅を設定します。</p>
      <div className="space-y-2 mb-6">
        {layoutOrder.length === 0 && <p className={`text-sm py-6 text-center ${textMutedClass}`}>追加した要素がここに表示されます</p>}
        {layoutOrder.map((item, index) => (
          <article key={item.id} draggable onDragStart={(event) => { event.dataTransfer?.setData('text/plain', String(index)); setDragIndex(index); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const rawIndex = event.dataTransfer?.getData('text/plain'); const from = rawIndex === '' || rawIndex === undefined ? dragIndex : Number(rawIndex); moveItem(Number.isInteger(from) ? from : dragIndex, index); setDragIndex(null); }} className={`flex flex-wrap items-center gap-2 rounded-xl border p-3 ${cardClass} ${dragIndex === index ? 'opacity-50' : ''}`}>
            <GripVertical size={17} className="cursor-grab text-gray-400" />
            <span className={`rounded px-2 py-0.5 text-xs ${theme === 'dark' ? 'bg-white/10 text-white/60' : 'bg-gray-200 text-gray-600'}`}>{LAYOUT_ITEM_LABELS[item.type] || item.type}</span>
            <strong className={`text-sm flex-1 min-w-[9rem] ${textClass}`}>{labelFor(item)}</strong>
            <label className={`text-xs ${textMutedClass}`}>幅
              <select aria-label={`${labelFor(item)} の幅`} value={item.width || 'full'} onChange={(event) => updateItem(index, { width: event.target.value })} className={`ml-1 ${inputClass} rounded px-1 py-1`}>
                {WIDTHS.map((width) => <option key={width} value={width} className={optionClass}>{width}</option>)}
              </select>
            </label>
            <button type="button" aria-label={item.visible === false ? '表示する' : '非表示にする'} onClick={() => updateItem(index, { visible: item.visible === false })} className="p-1.5 text-sky-400">{item.visible === false ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            <button type="button" aria-label="レイアウト項目を削除" onClick={() => removeItem(index)} className="p-1.5 text-rose-400"><Trash2 size={16} /></button>
          </article>
        ))}
      </div>
      <LayoutAddPanel availableItems={availableItems.filter((item) => LAYOUT_ITEM_TYPES.includes(item.type))} onAdd={addItem} textClass={textClass} textMutedClass={textMutedClass} theme={theme} />
    </section>
  </div>;
};

export default LayoutTab;
