const formatNumber = (value, decimals) => {
  const numeric = Number(value) || 0;
  return numeric.toLocaleString(undefined, typeof decimals === 'number'
    ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
    : undefined);
};

const KpiCard = ({ label, value, unit = '', color = 'from-sky-400 to-indigo-500', glassClass, theme = 'dark', decimals }) => (
  <article className={`rounded-xl p-3 md:p-4 relative overflow-hidden ${glassClass}`}>
    <div className={`absolute top-0 right-0 w-16 h-16 rounded-bl-full bg-gradient-to-br ${color} opacity-15`} />
    <p className={`text-sm font-medium mb-1 ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>{label}</p>
    <div className="flex items-baseline gap-1">
      <strong className={`text-xl md:text-2xl tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
        {formatNumber(value, decimals)}
      </strong>
      {unit && <span className={`text-xs ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>{unit}</span>}
    </div>
  </article>
);

export default KpiCard;
