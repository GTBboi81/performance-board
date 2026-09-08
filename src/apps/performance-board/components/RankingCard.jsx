import { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { HEIGHT_UNITS } from '../../../constants';
import { widthClass } from './layoutItems';
import { applyArithmeticCalc } from '../utils/dataTableUtils';
import { aggregateField, finalizeGroup, initFieldValue } from '../utils/processDataTablePure';

const numericValue = (value) => {
  if (typeof value === 'number') return value;
  const parsed = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const calculationInputFields = (calculation, valueField) => {
  if (!calculation) return [valueField];
  if (calculation.terms?.length) return calculation.terms.map((term) => term.field).filter(Boolean);
  return [calculation.fieldA, calculation.fieldB].filter(Boolean);
};

const RankingCard = ({ title, data = [], groupByField, valueField, limit = 5, sortOrder = 'desc', glassClass, theme = 'dark', width, height, calculations = [], systemFields = [] }) => {
  const rankings = useMemo(() => {
    const calculation = calculations.find((item) => item.id === valueField && item.type === 'arithmetic');
    const inputFields = calculationInputFields(calculation, valueField);
    const aggregationMethods = Object.fromEntries(inputFields.map((fieldId) => [
      fieldId,
      systemFields.find((field) => field.id === fieldId)?.aggregationMethod || 'sum',
    ]));
    const groups = new Map();
    data.forEach((row) => {
      const name = row[groupByField] || '(未設定)';
      const group = groups.get(name) || { name, termSums: { _count: 0 } };
      inputFields.forEach((fieldId) => {
        if (group.termSums[fieldId] === undefined) group.termSums[fieldId] = initFieldValue(aggregationMethods[fieldId]);
        aggregateField(group.termSums, fieldId, numericValue(row[fieldId]), aggregationMethods[fieldId]);
      });
      group.termSums._count += 1;
      groups.set(name, group);
    });
    return [...groups.values()]
      .map((group) => {
        finalizeGroup(group.termSums, [], aggregationMethods);
        return {
          name: group.name,
          value: calculation ? applyArithmeticCalc(group.termSums, calculation) : group.termSums[valueField],
        };
      })
      .sort((a, b) => (sortOrder === 'asc' ? a.value - b.value : b.value - a.value))
      .slice(0, Number(limit) || 5);
  }, [calculations, data, groupByField, limit, sortOrder, systemFields, valueField]);
  const calculation = calculations.find((item) => item.id === valueField && item.type === 'arithmetic');
  const formatValue = (value) => calculation?.format === 'percent'
    ? `${value.toFixed(calculation.decimals ?? 2)}%`
    : value.toLocaleString();
  const cardHeight = HEIGHT_UNITS[height || '1'] || HEIGHT_UNITS['1'];

  return (
    <section className={`${widthClass(width || 'third')} rounded-2xl p-4 flex flex-col ${glassClass}`} style={{ height: cardHeight }} aria-label={title || 'ランキング'}>
      <div className={`flex items-center gap-2 mb-3 pb-2 border-b ${theme === 'dark' ? 'border-white/10 text-white' : 'border-gray-200 text-gray-800'}`}>
        <Trophy size={18} className="text-amber-400" /><h2 className="text-sm font-semibold">{title || 'ランキング'}</h2>
      </div>
      <div className="space-y-2 overflow-auto">
        {rankings.map((item, index) => (
          <div key={item.name} className={`flex items-center gap-3 rounded-lg p-2 ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
            <span className="w-6 h-6 rounded-full bg-amber-400 text-white text-xs font-bold flex items-center justify-center">{index + 1}</span>
            <span className={`flex-1 truncate text-sm ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>{item.name}</span>
            <strong className="text-sm text-amber-500">{formatValue(item.value)}</strong>
          </div>
        ))}
        {rankings.length === 0 && <p className={`text-center py-8 text-sm ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>データがありません</p>}
      </div>
    </section>
  );
};

export default RankingCard;
