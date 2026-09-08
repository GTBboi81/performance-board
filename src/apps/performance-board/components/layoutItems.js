export const LAYOUT_ITEM_TYPES = [
  'kpiSection',
  'chart',
  'dataTable',
  'comparisonTable',
  'pivotTable',
  'vendorPivotTable',
  'ranking',
  'heading',
  'row',
];

export const LAYOUT_ITEM_LABELS = {
  kpiSection: 'KPIセクション',
  chart: 'グラフ',
  dataTable: 'データテーブル',
  comparisonTable: '比較テーブル',
  pivotTable: 'ピボットテーブル',
  vendorPivotTable: 'クロス集計テーブル',
  ranking: 'ランキング',
  heading: '見出し',
  row: '横並びグループ',
};

export const widthClass = (width = 'full') => ({
  full: 'w-full',
  twoThird: 'w-full lg:w-[calc(66.666%-5.33px)]',
  half: 'w-full md:w-[calc(50%-8px)]',
  third: 'w-full md:w-[calc(50%-8px)] lg:w-[calc(33.333%-10.67px)]',
  quarter: 'w-full sm:w-[calc(50%-8px)] lg:w-[calc(25%-12px)]',
}[width] || 'w-full');
