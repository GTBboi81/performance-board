import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { HEIGHT_OPTIONS } from '../../../../constants';

const ChartEditor = ({ chart, fields, inputClass, optionClass, labelXsClass, cardClass, theme, onChange, onDelete }) => {
  const numericFields = fields.filter((field) => field.type === 'number');
  const categoryFields = fields.filter((field) => field.type !== 'number');
  const yFields = chart.yFields || [];
  const toggleField = (id) => onChange({ yFields: yFields.includes(id) ? yFields.filter((field) => field !== id) : [...yFields, id] });

  return (
    <article className={`rounded-xl p-4 border ${cardClass}`}>
      <div className="flex items-center gap-3 mb-4">
        <input aria-label="グラフ名" value={chart.title || ''} onChange={(event) => onChange({ title: event.target.value })} className={`flex-1 ${inputClass} rounded px-3 py-2 text-sm`} />
        <button type="button" onClick={() => onChange({ visible: chart.visible === false })} className="p-2 rounded-lg text-emerald-400 bg-emerald-500/10" aria-label="表示切替">
          {chart.visible === false ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
        <button type="button" onClick={onDelete} className="p-2 rounded-lg text-rose-400 bg-rose-500/10" aria-label="グラフを削除"><Trash2 size={16} /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className={`text-xs ${labelXsClass}`}>種別
          <select aria-label="グラフ種別" value={chart.type || 'line'} onChange={(event) => onChange({ type: event.target.value })} className={`mt-1 w-full ${inputClass} rounded px-2 py-2`}>
            <option value="line" className={optionClass}>折れ線</option>
            <option value="bar" className={optionClass}>棒</option>
            <option value="pie" className={optionClass}>円</option>
          </select>
        </label>
        <label className={`text-xs ${labelXsClass}`}>分類軸
          <select aria-label="分類軸" value={chart.xField || ''} onChange={(event) => onChange({ xField: event.target.value })} className={`mt-1 w-full ${inputClass} rounded px-2 py-2`}>
            <option value="" className={optionClass}>選択してください</option>
            {categoryFields.map((field) => <option key={field.id} value={field.id} className={optionClass}>{field.label}</option>)}
          </select>
        </label>
        <label className={`text-xs ${labelXsClass}`}>幅
          <select aria-label="グラフ幅" value={chart.width || 'half'} onChange={(event) => onChange({ width: event.target.value })} className={`mt-1 w-full ${inputClass} rounded px-2 py-2`}>
            {['third', 'half', 'twoThird', 'full'].map((width) => <option key={width} value={width} className={optionClass}>{width}</option>)}
          </select>
        </label>
        <label className={`text-xs ${labelXsClass}`}>高さ
          <select aria-label="グラフ高さ" value={chart.height || '1'} onChange={(event) => onChange({ height: event.target.value })} className={`mt-1 w-full ${inputClass} rounded px-2 py-2`}>
            {HEIGHT_OPTIONS.map((option) => <option key={option.value} value={option.value} className={optionClass}>{option.label}</option>)}
          </select>
        </label>
      </div>
      <fieldset className="mt-4">
        <legend className={`text-xs ${labelXsClass}`}>表示する数値（複数選択可）</legend>
        <div className="flex flex-wrap gap-2 mt-2">
          {numericFields.map((field) => (
            <button key={field.id} type="button" onClick={() => toggleField(field.id)} className={`px-2 py-1 rounded text-xs border ${yFields.includes(field.id) ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : theme === 'dark' ? 'border-white/10 text-white/60' : 'border-gray-300 text-gray-600'}`}>
              {field.label}
            </button>
          ))}
        </div>
      </fieldset>
    </article>
  );
};

export default ChartEditor;
