// src/apps/performance-board/components/PivotTable.jsx
// ピボット集計テーブルコンポーネント

import React, { useMemo } from 'react';

const PivotTable = React.memo(({ pivotConfig, sourceCache = {}, dataSources = [], glassClass, theme = 'dark' }) => {
  const textClass = theme === 'dark' ? 'text-white' : 'text-gray-800';
  const borderClass = theme === 'dark' ? 'border-white/10' : 'border-gray-200';
  const headerBg = theme === 'dark' ? 'bg-white/5' : 'bg-gray-50';
  const rowHoverBg = theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50';

  // ソースデータを取得
  const sourceId = pivotConfig.sourceId;
  const sourceRows = sourceCache[sourceId] || [];
  const sourceConfig = dataSources.find(s => s.id === sourceId);

  // 月変換関数
  const transformToMonth = (dateValue) => {
    if (!dateValue) return null;
    const strVal = String(dateValue);
    let date;
    if (strVal.includes('/')) {
      const parts = strVal.split('/');
      if (parts.length >= 3) {
        date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
    } else if (strVal.includes('-')) {
      const parts = strVal.split('-');
      if (parts.length >= 3) {
        date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
    }
    if (!date || isNaN(date.getTime())) return null;

    const transform = pivotConfig.dateTransform || 'month';
    if (transform === 'month') {
      return `${date.getFullYear()}年${date.getMonth() + 1}月`;
    } else if (transform === 'year') {
      return `${date.getFullYear()}年`;
    }
    return strVal;
  };

  // 集計データを計算
  const pivotData = useMemo(() => {
    if (!sourceRows.length || !pivotConfig.columns?.length) return [];

    // 全ての月を収集
    const allMonths = new Set();
    const columnCounts = {}; // { month: { colId: count } }

    pivotConfig.columns.forEach(col => {
      const colIdx = col.columnIndex;
      sourceRows.forEach(row => {
        const dateVal = row[colIdx];
        const month = transformToMonth(dateVal);
        if (month) {
          allMonths.add(month);
          if (!columnCounts[month]) columnCounts[month] = {};
          if (!columnCounts[month][col.id]) columnCounts[month][col.id] = 0;
          columnCounts[month][col.id]++;
        }
      });
    });

    // 月をソート（降順）
    const sortedMonths = Array.from(allMonths).sort((a, b) => {
      // 年月を抽出してソート
      const parseYM = (s) => {
        const match = s.match(/(\d+)年(\d+)月/);
        if (match) return parseInt(match[1]) * 100 + parseInt(match[2]);
        const yearMatch = s.match(/(\d+)年/);
        if (yearMatch) return parseInt(yearMatch[1]) * 100;
        return 0;
      };
      return parseYM(b) - parseYM(a);
    });

    return sortedMonths.map(month => ({
      month,
      ...pivotConfig.columns.reduce((acc, col) => {
        acc[col.id] = columnCounts[month]?.[col.id] || 0;
        return acc;
      }, {})
    }));
  }, [sourceRows, pivotConfig.columns, pivotConfig.dateTransform]);

  if (!sourceId || !sourceConfig) {
    return (
      <div className={`${glassClass} rounded-2xl p-4`}>
        <p className={`text-sm ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
          ソースが設定されていません
        </p>
      </div>
    );
  }

  const widthClass = {
    'full': 'w-full',
    'twoThird': 'w-full lg:w-[calc(66.666%-0.5rem)]',
    'half': 'w-full lg:w-[calc(50%-0.5rem)]',
    'third': 'w-full lg:w-[calc(33.333%-0.5rem)]',
  }[pivotConfig.width] || 'w-full';

  return (
    <div className={`${widthClass} ${glassClass} rounded-2xl p-4 overflow-hidden`}>
      <h3 className={`text-sm font-semibold mb-3 ${textClass}`}>
        {pivotConfig.name || 'ピボット集計'}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={`${headerBg} border-b ${borderClass}`}>
              <th className={`px-3 py-2 text-left font-medium ${textClass}`}>
                {pivotConfig.dateTransform === 'year' ? '年' : '月'}
              </th>
              {pivotConfig.columns?.map(col => (
                <th key={col.id} className={`px-3 py-2 text-right font-medium ${textClass}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pivotData.map((row, idx) => (
              <tr key={idx} className={`border-b ${borderClass} ${rowHoverBg}`}>
                <td className={`px-3 py-2 ${textClass}`}>{row.month}</td>
                {pivotConfig.columns?.map(col => (
                  <td key={col.id} className={`px-3 py-2 text-right ${textClass}`}>
                    {row[col.id]?.toLocaleString() || 0}
                  </td>
                ))}
              </tr>
            ))}
            {pivotData.length === 0 && (
              <tr>
                <td colSpan={(pivotConfig.columns?.length || 0) + 1} className={`px-3 py-4 text-center ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
                  データがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

PivotTable.displayName = 'PivotTable';

export default PivotTable;
