import { Plus, Trash2, Trophy } from 'lucide-react';
import { HEIGHT_OPTIONS } from '../../../../constants';

const RankingTab = ({ localConfig, updateLocalConfig, glassClass, cardClass, inputClass, optionClass, textClass, labelSmClass }) => {
  const cards = localConfig.rankingCards || [];
  const textFields = (localConfig.systemFields || []).filter((field) => field.type !== 'number');
  const numericFields = [
    ...(localConfig.systemFields || []).filter((field) => field.type === 'number'),
    ...(localConfig.calculations || []).map((field) => ({ ...field, type: 'number' })),
  ];
  const update = (id, changes) => updateLocalConfig('rankingCards', cards.map((card) => card.id === id ? { ...card, ...changes } : card));
  const add = () => updateLocalConfig('rankingCards', [...cards, { id: `ranking_${Date.now()}`, title: '新規ランキング', mode: 'aggregate', groupByField: textFields[0]?.id || '', valueField: numericFields[0]?.id || '', limit: 5, sortOrder: 'desc', width: 'third', height: '1' }]);

  return <section className={`rounded-2xl p-6 ${glassClass}`}>
    <div className="flex justify-between items-center mb-6"><h2 className={`text-lg font-semibold flex items-center gap-2 ${textClass}`}><Trophy size={20} className="text-amber-400" />ランキング設定</h2><button type="button" onClick={add} className="px-3 py-2 rounded-lg bg-amber-500/20 text-amber-400 text-sm flex gap-1"><Plus size={15} />追加</button></div>
    <div className="space-y-4">{cards.map((card) => <article key={card.id} className={`rounded-xl border p-4 ${cardClass}`}>
      <div className="flex gap-2 mb-3"><input aria-label="ランキング名" value={card.title || ''} onChange={(event) => update(card.id, { title: event.target.value })} className={`flex-1 ${inputClass} rounded px-3 py-2 text-sm`} /><button type="button" aria-label="ランキングを削除" onClick={() => updateLocalConfig('rankingCards', cards.filter((item) => item.id !== card.id))} className="p-2 text-rose-400"><Trash2 size={16} /></button></div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <label className={`text-xs ${labelSmClass}`}>分類<select value={card.groupByField || ''} onChange={(event) => update(card.id, { groupByField: event.target.value })} className={`mt-1 w-full ${inputClass} rounded px-2 py-2`}>{textFields.map((field) => <option key={field.id} value={field.id} className={optionClass}>{field.label}</option>)}</select></label>
        <label className={`text-xs ${labelSmClass}`}>数値<select value={card.valueField || ''} onChange={(event) => update(card.id, { valueField: event.target.value })} className={`mt-1 w-full ${inputClass} rounded px-2 py-2`}>{numericFields.map((field) => <option key={field.id} value={field.id} className={optionClass}>{field.label}</option>)}</select></label>
        <label className={`text-xs ${labelSmClass}`}>件数<input type="number" min="1" value={card.limit || 5} onChange={(event) => update(card.id, { limit: Number(event.target.value) || 5 })} className={`mt-1 w-full ${inputClass} rounded px-2 py-2`} /></label>
        <label className={`text-xs ${labelSmClass}`}>幅<select value={card.width || 'third'} onChange={(event) => update(card.id, { width: event.target.value })} className={`mt-1 w-full ${inputClass} rounded px-2 py-2`}>{['third', 'half', 'twoThird', 'full'].map((value) => <option key={value} value={value} className={optionClass}>{value}</option>)}</select></label>
        <label className={`text-xs ${labelSmClass}`}>高さ<select value={card.height || '1'} onChange={(event) => update(card.id, { height: event.target.value })} className={`mt-1 w-full ${inputClass} rounded px-2 py-2`}>{HEIGHT_OPTIONS.map((option) => <option key={option.value} value={option.value} className={optionClass}>{option.label}</option>)}</select></label>
      </div>
    </article>)}</div>
  </section>;
};

export default RankingTab;
