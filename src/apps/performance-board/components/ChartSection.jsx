import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { HEIGHT_UNITS } from '../../../constants';
import { widthClass } from './layoutItems';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

const numericValue = (value) => Number(value) || 0;

const directSourceRows = (chartConfig, sourceCache, dataSources) => {
  const sourceId = chartConfig.sourceId;
  if (!sourceId) return [];
  const cache = sourceCache?.[sourceId];
  const rows = Array.isArray(cache) ? cache : cache?.rows;
  if (!Array.isArray(rows)) return [];
  const source = (dataSources || []).find((item) => item.id === sourceId);
  const xField = chartConfig.xField || 'category';
  const yField = chartConfig.yFields?.[0] || 'value';
  const categoryIndex = Number(chartConfig.categoryColumnIndex);
  const valueIndex = Number(chartConfig.valueColumnIndex);
  if (!source || !Number.isInteger(categoryIndex) || !Number.isInteger(valueIndex)) return [];
  return rows.map((row) => ({ [xField]: row[categoryIndex], [yField]: numericValue(row[valueIndex]) }));
};

export const buildChartData = ({ chartConfig, data = [], sourceCache = {}, dataSources = [] }) => {
  const rows = data.length > 0 ? data : directSourceRows(chartConfig, sourceCache, dataSources);
  const xField = chartConfig.xField || 'date';
  const yFields = chartConfig.yFields || [];
  const aggregation = chartConfig.aggregation || 'sum';
  const grouped = new Map();

  rows.forEach((row) => {
    const category = row[xField] === undefined || row[xField] === null || row[xField] === '' ? '(未設定)' : String(row[xField]);
    const item = grouped.get(category) || { [xField]: category, _count: 0 };
    item._count += 1;
    yFields.forEach((field) => {
      item[field] = (item[field] || 0) + numericValue(row[field]);
    });
    grouped.set(category, item);
  });

  const sortField = chartConfig.sortField || (aggregation === 'count' ? '_count' : '');
  const result = [...grouped.values()];
  if (sortField) {
    const direction = chartConfig.sortOrder === 'asc' ? 1 : -1;
    result.sort((a, b) => direction * (numericValue(a[sortField]) - numericValue(b[sortField])));
  } else if (xField === 'date') {
    result.sort((a, b) => String(a[xField]).localeCompare(String(b[xField])));
  }
  const limit = Number(chartConfig.limit) || 0;
  return limit > 0 ? result.slice(0, limit) : result;
};

const getFieldLabel = (id, systemFields, calculations) => {
  const field = [...systemFields, ...calculations].find((item) => item.id === id);
  return field?.label || id;
};

const ChartSection = ({ chartConfig, data = [], systemFields = [], calculations = [], sourceCache = {}, dataSources = [], glassClass, theme = 'dark' }) => {
  const chartData = useMemo(
    () => buildChartData({ chartConfig, data, sourceCache, dataSources }),
    [chartConfig, data, sourceCache, dataSources],
  );
  if (!chartConfig || chartConfig.visible === false) return null;

  const xField = chartConfig.xField || 'date';
  const yFields = chartConfig.aggregation === 'count' ? ['_count'] : (chartConfig.yFields || []);
  const height = HEIGHT_UNITS[chartConfig.height || '1'] || HEIGHT_UNITS['1'];
  const textColor = theme === 'dark' ? '#94a3b8' : '#64748b';
  const tooltipStyle = theme === 'dark'
    ? { backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,.12)' }
    : { backgroundColor: '#ffffff', border: '1px solid #e5e7eb' };

  const renderCartesian = (Chart, Item) => (
    <Chart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)'} />
      <XAxis dataKey={xField} tick={{ fill: textColor, fontSize: 11 }} />
      <YAxis tick={{ fill: textColor, fontSize: 11 }} />
      <Tooltip contentStyle={tooltipStyle} />
      <Legend />
      {yFields.map((field, index) => (
        <Item key={field} dataKey={field} name={field === '_count' ? '件数' : getFieldLabel(field, systemFields, calculations)} stroke={COLORS[index % COLORS.length]} fill={COLORS[index % COLORS.length]} strokeWidth={2} radius={[4, 4, 0, 0]} />
      ))}
    </Chart>
  );

  const renderChart = () => {
    if (chartConfig.type === 'pie') {
      const valueField = yFields[0];
      return (
        <PieChart>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Pie data={chartData} dataKey={valueField} nameKey={xField} name={getFieldLabel(valueField, systemFields, calculations)} outerRadius="78%" label>
            {chartData.map((item, index) => <Cell key={`${item[xField]}-${index}`} fill={(chartConfig.colors || [])[index] || COLORS[index % COLORS.length]} />)}
          </Pie>
        </PieChart>
      );
    }
    if (chartConfig.type === 'bar') return renderCartesian(BarChart, Bar);
    return renderCartesian(LineChart, Line);
  };

  return (
    <section className={`${widthClass(chartConfig.width || 'half')} rounded-2xl p-4 ${glassClass}`} aria-label={chartConfig.title || 'グラフ'}>
      <h2 className={`mb-3 text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{chartConfig.title || 'グラフ'}</h2>
      {chartData.length === 0 ? (
        <div className={`flex items-center justify-center text-sm ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`} style={{ height }}>{'表示できるデータがありません'}</div>
      ) : <ResponsiveContainer width="100%" height={height}>{renderChart()}</ResponsiveContainer>}
    </section>
  );
};

export default ChartSection;
