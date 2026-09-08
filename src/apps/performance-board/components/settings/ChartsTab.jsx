import { BarChart3, Plus } from 'lucide-react';
import ChartEditor from './ChartEditor';

const ChartsTab = ({ localConfig, updateLocalConfig, glassClass, cardClass, inputClass, optionClass, textClass, textMutedClass, labelXsClass, theme }) => {
  const charts = localConfig.chartConfigs || [];
  const fields = [
    ...(localConfig.systemFields || []),
    ...(localConfig.calculations || []).map((field) => ({ ...field, type: 'number' })),
  ];
  const updateChart = (id, changes) => updateLocalConfig('chartConfigs', charts.map((chart) => chart.id === id ? { ...chart, ...changes } : chart));
  const addChart = () => updateLocalConfig('chartConfigs', [...charts, {
    id: `chart_${Date.now()}`,
    title: '新規グラフ',
    type: 'line',
    xField: (localConfig.systemFields || []).find((field) => field.type !== 'number')?.id || '',
    yFields: [],
    aggregation: 'sum',
    visible: true,
    width: 'half',
    height: '1',
    colors: ['#6366f1', '#10b981', '#f59e0b'],
  }]);

  return (
    <div className="space-y-6">
      <section className={`rounded-2xl p-6 ${glassClass}`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className={`text-lg font-semibold flex items-center gap-2 ${textClass}`}><BarChart3 size={20} className="text-emerald-400" />グラフ設定</h2>
          <button type="button" onClick={addChart} className="px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm flex items-center gap-1"><Plus size={15} />グラフを追加</button>
        </div>
        {charts.length === 0 ? <p className={`text-center py-10 text-sm ${textMutedClass}`}>グラフがありません</p> : <div className="space-y-4">
          {charts.map((chart) => <ChartEditor key={chart.id} chart={chart} fields={fields} inputClass={inputClass} optionClass={optionClass} labelXsClass={labelXsClass} cardClass={cardClass} theme={theme} onChange={(changes) => updateChart(chart.id, changes)} onDelete={() => updateLocalConfig('chartConfigs', charts.filter((item) => item.id !== chart.id))} />)}
        </div>}
      </section>
    </div>
  );
};

export default ChartsTab;
