import { AlignLeft, Plus, Trash2 } from 'lucide-react';

const HeadingTab = ({ localConfig, updateLocalConfig, glassClass, cardClass, inputClass, optionClass, textClass, labelSmClass }) => {
  const headings = localConfig.headingCards || [];
  const update = (id, changes) => updateLocalConfig('headingCards', headings.map((heading) => heading.id === id ? { ...heading, ...changes } : heading));
  const add = () => updateLocalConfig('headingCards', [...headings, { id: `heading_${Date.now()}`, text: '新規見出し', subText: '', icon: 'default', align: 'left', width: 'full' }]);
  return <section className={`rounded-2xl p-6 ${glassClass}`}>
    <div className="flex justify-between items-center mb-6"><h2 className={`text-lg font-semibold flex items-center gap-2 ${textClass}`}><AlignLeft size={20} className="text-sky-400" />見出し設定</h2><button type="button" onClick={add} className="px-3 py-2 rounded-lg bg-sky-500/20 text-sky-400 text-sm flex gap-1"><Plus size={15} />追加</button></div>
    <div className="space-y-4">{headings.map((heading) => <article key={heading.id} className={`rounded-xl border p-4 ${cardClass}`}>
      <div className="flex gap-2 mb-3"><input aria-label="見出し" value={heading.text || ''} onChange={(event) => update(heading.id, { text: event.target.value })} className={`flex-1 ${inputClass} rounded px-3 py-2 text-sm`} /><button type="button" aria-label="見出しを削除" onClick={() => updateLocalConfig('headingCards', headings.filter((item) => item.id !== heading.id))} className="p-2 text-rose-400"><Trash2 size={16} /></button></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <label className={`text-xs ${labelSmClass}`}>補足<input value={heading.subText || ''} onChange={(event) => update(heading.id, { subText: event.target.value })} className={`mt-1 w-full ${inputClass} rounded px-2 py-2`} /></label>
        <label className={`text-xs ${labelSmClass}`}>アイコン<select value={heading.icon || 'default'} onChange={(event) => update(heading.id, { icon: event.target.value })} className={`mt-1 w-full ${inputClass} rounded px-2 py-2`}>{['default', 'tag', 'bookmark', 'hash', 'star', 'zap', 'target', 'trending'].map((value) => <option key={value} value={value} className={optionClass}>{value}</option>)}</select></label>
        <label className={`text-xs ${labelSmClass}`}>配置<select value={heading.align || 'left'} onChange={(event) => update(heading.id, { align: event.target.value })} className={`mt-1 w-full ${inputClass} rounded px-2 py-2`}>{['left', 'center', 'right'].map((value) => <option key={value} value={value} className={optionClass}>{value}</option>)}</select></label>
        <label className={`text-xs ${labelSmClass}`}>幅<select value={heading.width || 'full'} onChange={(event) => update(heading.id, { width: event.target.value })} className={`mt-1 w-full ${inputClass} rounded px-2 py-2`}>{['third', 'half', 'twoThird', 'full'].map((value) => <option key={value} value={value} className={optionClass}>{value}</option>)}</select></label>
      </div>
    </article>)}</div>
  </section>;
};

export default HeadingTab;
