const DEFAULT_HEADER_FONT_SIZE = 12;

const normalizeFontSize = (fontSize) => {
  const numeric = Number(fontSize);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : DEFAULT_HEADER_FONT_SIZE;
};

export const getDataTableHeaderLineHeight = (fontSize) => normalizeFontSize(fontSize) + 2;

// 2行分の文字高 + 上下8pxの余白 + 1pxの下罫線。
export const getDefaultDataTableHeaderRowHeight = (fontSize) => (
  normalizeFontSize(fontSize) * 2 + 21
);

/**
 * テーブルのフォントサイズ・行高さを一括解決する（DataTable.jsx / useDataTableLayout.js の
 * 重複計算を統一する単一の実体）。
 * 優先順位: テーブル個別設定（headerFontSize等 or 旧来の共通fontSize） > 自動算出。
 * ここがずれると STICKY_H（仮想スクロールの可視範囲）と実際の描画高さが食い違う。
 * @param {object} tableConfig
 */
export const resolveDataTableDensity = (tableConfig = {}) => {
  const headerFontSize = tableConfig.headerFontSize || tableConfig.fontSize || DEFAULT_HEADER_FONT_SIZE;
  const summaryFontSize = tableConfig.summaryFontSize || tableConfig.fontSize || DEFAULT_HEADER_FONT_SIZE;
  const dataFontSize = tableConfig.dataFontSize || tableConfig.fontSize || DEFAULT_HEADER_FONT_SIZE;

  const headerRowHeight = tableConfig.headerRowHeight || getDefaultDataTableHeaderRowHeight(headerFontSize);
  const summaryRowHeight = tableConfig.summaryRowHeight || (summaryFontSize + 18);
  const dataRowHeight = tableConfig.dataRowHeight || Math.max(20, dataFontSize + 14);

  return { headerFontSize, summaryFontSize, dataFontSize, headerRowHeight, summaryRowHeight, dataRowHeight };
};
