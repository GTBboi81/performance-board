// src/constants.js

export const DEFAULT_API_KEY = '';
export const SUPPORTED_SOURCE_TYPES = ['spreadsheet', 'salesforce', 'salesforce-soql'];

// --- デフォルトの共通設定 ---
export const DEFAULT_GLOBAL_SETTINGS = {
  appName: 'CallData Analysis',    // アプリケーション名（全ダッシュボード共通）
  logoLight: null,                  // ライトモード用ロゴ（Base64）
  logoDark: null,                   // ダークモード用ロゴ（Base64）
  hiddenBoards: [],                 // 閲覧権限ユーザーに非表示にするボードID配列
  boardNames: {}                    // カスタムボード名 { 'analytics': '新しい名前', ... }
};

// --- デフォルトのロール設定 ---
export const DEFAULT_ROLES = {
  'admin': {
    id: 'admin',
    name: '管理者',
    description: '全ての機能にアクセス可能',
    isSystem: true,  // システムロール（削除不可）
    permissions: { '*': true }  // 全権限
  },
  'viewer': {
    id: 'viewer',
    name: '閲覧者',
    description: '閲覧のみ可能',
    isSystem: true,
    permissions: {
      // 全モジュール閲覧のみ
    }
  }
};

// --- デフォルトのアカウント設定 ---
export const DEFAULT_ACCOUNTS = import.meta.env.DEV ? {
  'admin': {
    password: 'CHANGE_ME',
    name: '管理者アカウント',
    roleId: 'admin',  // role → roleId に変更
    dashboardAccess: [] // 空配列 = 全ダッシュボードにアクセス可能
  },
  'viewer': {
    password: 'CHANGE_ME',
    name: '閲覧用アカウント',
    roleId: 'viewer',  // role → roleId に変更
    dashboardAccess: [] // 空配列 = 全ダッシュボードにアクセス可能
  }
} : {};

// --- 高さ単位の定義 (1単位 = 350px) ---
export const HEIGHT_UNITS = {
  '0.25': 87.5,
  '0.5': 175,
  '1': 350,
  '1.5': 525,
  '2': 700,
  '2.5': 875,
  '3': 1050,
};

// 高さ単位の選択肢（UI用）
export const HEIGHT_OPTIONS = [
  { value: '0.25', label: '0.25 (87.5px)' },
  { value: '0.5', label: '0.5 (175px)' },
  { value: '1', label: '1 (350px)' },
  { value: '1.5', label: '1.5 (525px)' },
  { value: '2', label: '2 (700px)' },
  { value: '2.5', label: '2.5 (875px)' },
  { value: '3', label: '3 (1050px)' },
];

// --- デフォルトの計算指標 ---
export const DEFAULT_CALCULATIONS = [
  {
    id: 'talkRate',
    label: '対話率',
    type: 'arithmetic',
    format: 'percent',
    terms: [
      { field: 'talk' },
      { operator: '/', field: 'call' }
    ]
  },
  {
    id: 'orderEff',
    label: '受注効率',
    type: 'arithmetic',
    format: 'number',
    terms: [
      { field: 'order' },
      { operator: '/', field: 'workTime' }
    ]
  },
];

// --- デフォルトのセクション ---
// width: 'full' (3ブロック), 'twoThird' (2ブロック), 'half' (1.5ブロック), 'third' (1ブロック)
export const DEFAULT_SECTIONS = [
  { id: 'section_main', title: '主要指標', fields: ['call', 'talk', 'order', 'workTime'], width: 'full' },
  { id: 'section_kpi', title: 'KPI', fields: ['talkRate', 'orderEff'], width: 'full' }
];

// --- デフォルトのフィルター ---
export const DEFAULT_FILTERS = [
  { id: 'filter_dept', field: 'dept', label: '部署' },
  { id: 'filter_date', field: 'date', label: '日付' },
];

// --- デフォルトのデータソース ---
// sourceType: 'spreadsheet' (Google Sheets API)
export const DEFAULT_DATA_SOURCES = [
  {
    id: 'src_main',
    name: '担当者リスト(Main)',
    sourceType: 'spreadsheet',
    // スプレッドシート設定
    spreadsheetId: '',
    sheetName: 'Sheet1',
    // 共通設定
    headers: [],
    keyColumnIndex: 0,
    dateColumnIndex: 1, // ソースごとの日付列
    pivotSettings: { // ピボット設定
      enabled: false,
      labelColumnIndex: null,
      valueColumnIndex: null,
    },
    reshapeSettings: { // ワイド→ロング変換設定
      enabled: false,
      dateColumnName: '',
      fixedColumnNames: [],
      groups: [],
      generatedDateColumnName: '稼働日',
      skipEmptyDays: true,
    }
  },
  {
    id: 'src_orders',
    name: '受注履歴(Sub)',
    sourceType: 'spreadsheet',
    spreadsheetId: '',
    sheetName: 'Orders',
    headers: [],
    keyColumnIndex: 1,
    dateColumnIndex: 3,
    pivotSettings: {
      enabled: false,
      labelColumnIndex: null,
      valueColumnIndex: null,
    },
    reshapeSettings: {
      enabled: false,
      dateColumnName: '',
      fixedColumnNames: [],
      groups: [],
      generatedDateColumnName: '稼働日',
      skipEmptyDays: true,
    }
  }
];

// --- デフォルトのマッピング ---
export const DEFAULT_MAPPING = {};

// --- デフォルトの表示項目 ---
export const DEFAULT_VISIBLE_FIELDS = ['call', 'talk', 'order', 'workTime', 'talkRate', 'orderEff'];

// --- デフォルトの統合データテーブル設定 ---
// width: 'full' (3ブロック), 'twoThird' (2ブロック), 'half' (1.5ブロック), 'third' (1ブロック)
// size: 'small', 'medium', 'large' (テーブル高さ)
export const DEFAULT_DATA_TABLES = [
  {
    id: 'table_main',
    name: '統合データテーブル',
    sourceId: '',
    fields: ['date', 'time', 'name', 'dept', 'call', 'talk', 'order', 'result'],
    width: 'full',
    size: 'medium',
    metricFilters: []
  }
];

// --- ピボット集計テーブル設定 ---
// 複数の日付カラムを月別に集計し、1つのテーブルで表示
export const DEFAULT_PIVOT_TABLES = [
  // {
  //   id: 'pivot_monthly',
  //   name: '月別集計',
  //   sourceId: '',  // シンプルモードで使用するソースID
  //   dateTransform: 'month',  // 'month', 'year', 'weekday'
  //   columns: [
  //     { id: 'col_1', label: 'ET数', columnIndex: 1, aggregation: 'count' },
  //     { id: 'col_2', label: '工事完了数', columnIndex: 3, aggregation: 'count' }
  //   ],
  //   width: 'full',
  //   height: '1'
  // }
];

// --- 比較テーブル設定 ---
// 手動セグメントによる比較テーブル
export const DEFAULT_COMPARISON_TABLES = [
  // {
  //   id: 'comp_example',
  //   label: '比較テーブル',
  //   enabled: true,
  //   width: 'full',
  //   height: '1',
  //   segments: [],           // 手動セグメント配列
  //   layout: 'horizontal',   // 'horizontal' | 'vertical'
  //   showDiff: true,         // 差分表示
  //   baseSegmentId: null,    // 基準セグメントID
  // }
];

// --- 販社別ピボットテーブル設定 ---
// 月別×販社別で同じ指標を横並びで表示
export const DEFAULT_VENDOR_PIVOT_TABLES = [
  // {
  //   id: 'vendor_pivot_1',
  //   name: '月別×販社別 登録率',
  //   enabled: true,
  //   width: 'full',
  //   height: '1.5',
  //
  //   // データソース
  //   sourceId: 'src_main',           // 設定画面で選択
  //
  //   // 軸設定（設定画面で変更可能）
  //   rowField: '',                   // 行軸：ET月フィールド（データソースのヘッダーから選択）
  //   columnField: '',                // 列軸：販社フィールド（データソースのヘッダーから選択）
  //
  //   // 指標設定（設定画面で変更可能）
  //   metrics: [
  //     { id: 'metric_1', label: 'ET数', field: '', aggregation: 'sum', format: 'number' },
  //     { id: 'metric_2', label: '登録数', field: '', aggregation: 'sum', format: 'number' },
  //     { id: 'metric_3', label: '登録率', type: 'calculated',
  //       numerator: 'metric_2', denominator: 'metric_1', format: 'percent' }
  //   ],
  //
  //   // 表示設定
  //   sortOrder: 'desc',
  //   showTotalRow: true,
  //   vendorColors: {}  // 販社ごとの色設定
  // }
];

// --- デフォルトの集計条件設定 ---
export const DEFAULT_AGGREGATION_CONFIGS = [
  {
    id: 'agg_none',
    label: '集計なし (詳細)',
    groupByField: '', // 空の場合は集計なし
    displayFields: ['date', 'time', 'name', 'dept', 'call', 'talk', 'order', 'result'] // デフォルトの表示項目
  },
  {
    id: 'agg_dept',
    label: '部署別',
    groupByField: 'dept',
    displayFields: ['call', 'talk', 'order', 'workTime', 'talkRate', 'orderEff']
  },
  {
    id: 'agg_name',
    label: '担当者名別',
    groupByField: 'name',
    displayFields: ['call', 'talk', 'order', 'workTime', 'talkRate', 'orderEff']
  }
];

// --- デフォルトのシステムフィールド ---
export const DEFAULT_SYSTEM_FIELDS = [
  { id: 'id', label: 'ID', type: 'string' },
  { id: 'date', label: '日付', type: 'date' },
];

// --- 日付変換オプション（集計用） ---
export const DATE_TRANSFORM_OPTIONS = [
  { id: 'none', label: 'そのまま（日単位）' },
  { id: 'month', label: '月単位（2025年11月）' },
  { id: 'year', label: '年単位（2025年）' },
  { id: 'weekday', label: '曜日別（月曜日〜日曜日）' },
];

// --- 条件演算子の定義（条件付きカウント用） ---
export const CONDITIONAL_OPERATORS = [
  { id: 'notEmpty', label: '空でない', needsValue: false, description: 'カラムに値がある行をカウント' },
  { id: 'empty', label: '空である', needsValue: false, description: 'カラムが空の行をカウント' },
  { id: 'equals', label: '一致する', needsValue: true, description: '指定した値と一致する行をカウント' },
  { id: 'notEquals', label: '一致しない', needsValue: true, description: '指定した値と一致しない行をカウント' },
  { id: 'contains', label: '含む', needsValue: true, description: '指定した文字列を含む行をカウント' },
  { id: 'notContains', label: '含まない', needsValue: true, description: '指定した文字列を含まない行をカウント' },
  { id: 'greaterThan', label: 'より大きい (>)', needsValue: true, description: '指定した数値より大きい行をカウント' },
  { id: 'lessThan', label: 'より小さい (<)', needsValue: true, description: '指定した数値より小さい行をカウント' },
  { id: 'greaterOrEqual', label: '以上 (>=)', needsValue: true, description: '指定した数値以上の行をカウント' },
  { id: 'lessOrEqual', label: '以下 (<=)', needsValue: true, description: '指定した数値以下の行をカウント' },
  { id: 'between', label: '範囲内', needsValue: true, needsValue2: true, description: '指定した範囲内の行をカウント' },
  { id: 'thisMonth2ndToEnd', label: '当月2日〜月末', needsValue: false, description: '当月2日〜月末の日付に該当する行をカウント' },
];

// --- 条件付き書式の比較演算子 ---
export const CONDITIONAL_FORMAT_OPERATORS = [
  { id: 'gt',  label: '>', symbol: '>' },
  { id: 'gte', label: '>=', symbol: '>=' },
  { id: 'lt',  label: '<', symbol: '<' },
  { id: 'lte', label: '<=', symbol: '<=' },
  { id: 'eq',  label: '=', symbol: '=' },
];

// --- 条件付き書式のテキストカラー ---
export const CONDITIONAL_FORMAT_COLORS = [
  { id: 'emerald',  label: '緑',       dark: 'text-emerald-400', light: 'text-emerald-600', hex: '#10b981' },
  { id: 'blue',     label: '青',       dark: 'text-blue-400',    light: 'text-blue-600',    hex: '#3b82f6' },
  { id: 'red',      label: '赤',       dark: 'text-red-400',     light: 'text-red-600',     hex: '#ef4444' },
  { id: 'rose',     label: 'ローズ',   dark: 'text-rose-400',    light: 'text-rose-600',    hex: '#f43f5e' },
  { id: 'orange',   label: 'オレンジ', dark: 'text-orange-400',  light: 'text-orange-600',  hex: '#f97316' },
  { id: 'amber',    label: 'アンバー', dark: 'text-amber-400',   light: 'text-amber-600',   hex: '#f59e0b' },
  { id: 'purple',   label: '紫',       dark: 'text-purple-400',  light: 'text-purple-600',  hex: '#a855f7' },
  { id: 'cyan',     label: 'シアン',   dark: 'text-cyan-400',    light: 'text-cyan-600',    hex: '#06b6d4' },
  { id: 'pink',     label: 'ピンク',   dark: 'text-pink-400',    light: 'text-pink-600',    hex: '#ec4899' },
];

// --- 条件付き書式のフォントウェイト ---
export const CONDITIONAL_FORMAT_WEIGHTS = [
  { id: 'normal',   label: '通常',     class: 'font-normal' },
  { id: 'semibold', label: 'やや太字', class: 'font-semibold' },
  { id: 'bold',     label: '太字',     class: 'font-bold' },
];

// --- デフォルトの複合カード設定 ---
export const DEFAULT_COMPOSITE_CARDS = [];

// --- ヒートマップ用カラースケール（9段階） ---
// ライトモード用
export const HEATMAP_COLOR_SCALES = {
  blue: ['#f0f9ff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1', '#075985'],
  green: ['#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534'],
  red: ['#fef2f2', '#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b'],
  purple: ['#faf5ff', '#f3e8ff', '#e9d5ff', '#d8b4fe', '#c084fc', '#a855f7', '#9333ea', '#7c3aed', '#6b21a8'],
  orange: ['#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#9a3412'],
  teal: ['#f0fdfa', '#ccfbf1', '#99f6e4', '#5eead4', '#2dd4bf', '#14b8a6', '#0d9488', '#0f766e', '#115e59'],
};

// ダークモード用（暗めのカラースケール）
export const HEATMAP_COLOR_SCALES_DARK = {
  blue: ['#0c1929', '#0f2942', '#0e3a5c', '#0c4a76', '#0a5a90', '#0369a1', '#0284c7', '#0ea5e9', '#38bdf8'],
  green: ['#052e16', '#14532d', '#166534', '#15803d', '#16a34a', '#22c55e', '#4ade80', '#86efac', '#bbf7d0'],
  red: ['#2a0a0a', '#450a0a', '#7f1d1d', '#991b1b', '#b91c1c', '#dc2626', '#ef4444', '#f87171', '#fca5a5'],
  purple: ['#1e0a33', '#2e1065', '#4c1d95', '#5b21b6', '#6d28d9', '#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd'],
  orange: ['#2a1508', '#431407', '#7c2d12', '#9a3412', '#c2410c', '#ea580c', '#f97316', '#fb923c', '#fdba74'],
  teal: ['#042f2e', '#134e4a', '#115e59', '#0f766e', '#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4'],
};

// --- プリセットカラーパレット（カラム・KPI用） ---
// bg: header(濃), summary(中), data(薄) の3段階背景色
export const PRESET_COLORS = [
  { id: 'default', label: 'デフォルト', dark: '', light: '', hex: '' },
  {
    id: 'blue', label: '青', dark: 'text-blue-400', light: 'text-blue-600', hex: '#3b82f6',
    bg: {
      dark: { header: 'bg-blue-600/30', summary: 'bg-blue-500/20', data: 'bg-blue-500/10' },
      light: { header: 'bg-blue-200', summary: 'bg-blue-100', data: 'bg-blue-50' }
    }
  },
  {
    id: 'green', label: '緑', dark: 'text-emerald-400', light: 'text-emerald-600', hex: '#10b981',
    bg: {
      dark: { header: 'bg-emerald-600/30', summary: 'bg-emerald-500/20', data: 'bg-emerald-500/10' },
      light: { header: 'bg-emerald-200', summary: 'bg-emerald-100', data: 'bg-emerald-50' }
    }
  },
  {
    id: 'red', label: '赤', dark: 'text-red-400', light: 'text-red-600', hex: '#ef4444',
    bg: {
      dark: { header: 'bg-red-600/30', summary: 'bg-red-500/20', data: 'bg-red-500/10' },
      light: { header: 'bg-red-200', summary: 'bg-red-100', data: 'bg-red-50' }
    }
  },
  {
    id: 'orange', label: 'オレンジ', dark: 'text-orange-400', light: 'text-orange-600', hex: '#f97316',
    bg: {
      dark: { header: 'bg-orange-600/30', summary: 'bg-orange-500/20', data: 'bg-orange-500/10' },
      light: { header: 'bg-orange-200', summary: 'bg-orange-100', data: 'bg-orange-50' }
    }
  },
  {
    id: 'yellow', label: '黄', dark: 'text-yellow-400', light: 'text-yellow-600', hex: '#eab308',
    bg: {
      dark: { header: 'bg-yellow-600/30', summary: 'bg-yellow-500/20', data: 'bg-yellow-500/10' },
      light: { header: 'bg-yellow-200', summary: 'bg-yellow-100', data: 'bg-yellow-50' }
    }
  },
  {
    id: 'purple', label: '紫', dark: 'text-purple-400', light: 'text-purple-600', hex: '#a855f7',
    bg: {
      dark: { header: 'bg-purple-600/30', summary: 'bg-purple-500/20', data: 'bg-purple-500/10' },
      light: { header: 'bg-purple-200', summary: 'bg-purple-100', data: 'bg-purple-50' }
    }
  },
  {
    id: 'pink', label: 'ピンク', dark: 'text-pink-400', light: 'text-pink-600', hex: '#ec4899',
    bg: {
      dark: { header: 'bg-pink-600/30', summary: 'bg-pink-500/20', data: 'bg-pink-500/10' },
      light: { header: 'bg-pink-200', summary: 'bg-pink-100', data: 'bg-pink-50' }
    }
  },
  {
    id: 'teal', label: 'ティール', dark: 'text-teal-400', light: 'text-teal-600', hex: '#14b8a6',
    bg: {
      dark: { header: 'bg-teal-600/30', summary: 'bg-teal-500/20', data: 'bg-teal-500/10' },
      light: { header: 'bg-teal-200', summary: 'bg-teal-100', data: 'bg-teal-50' }
    }
  },
  {
    id: 'indigo', label: 'インディゴ', dark: 'text-indigo-400', light: 'text-indigo-600', hex: '#6366f1',
    bg: {
      dark: { header: 'bg-indigo-600/30', summary: 'bg-indigo-500/20', data: 'bg-indigo-500/10' },
      light: { header: 'bg-indigo-200', summary: 'bg-indigo-100', data: 'bg-indigo-50' }
    }
  },
  {
    id: 'cyan', label: 'シアン', dark: 'text-cyan-400', light: 'text-cyan-600', hex: '#06b6d4',
    bg: {
      dark: { header: 'bg-cyan-600/30', summary: 'bg-cyan-500/20', data: 'bg-cyan-500/10' },
      light: { header: 'bg-cyan-200', summary: 'bg-cyan-100', data: 'bg-cyan-50' }
    }
  },
  {
    id: 'amber', label: 'アンバー', dark: 'text-amber-400', light: 'text-amber-600', hex: '#f59e0b',
    bg: {
      dark: { header: 'bg-amber-600/30', summary: 'bg-amber-500/20', data: 'bg-amber-500/10' },
      light: { header: 'bg-amber-200', summary: 'bg-amber-100', data: 'bg-amber-50' }
    }
  },
  {
    id: 'lime', label: 'ライム', dark: 'text-lime-400', light: 'text-lime-600', hex: '#84cc16',
    bg: {
      dark: { header: 'bg-lime-600/30', summary: 'bg-lime-500/20', data: 'bg-lime-500/10' },
      light: { header: 'bg-lime-200', summary: 'bg-lime-100', data: 'bg-lime-50' }
    }
  },
  {
    id: 'rose', label: 'ローズ', dark: 'text-rose-400', light: 'text-rose-600', hex: '#f43f5e',
    bg: {
      dark: { header: 'bg-rose-600/30', summary: 'bg-rose-500/20', data: 'bg-rose-500/10' },
      light: { header: 'bg-rose-200', summary: 'bg-rose-100', data: 'bg-rose-50' }
    }
  },
  {
    id: 'violet', label: 'バイオレット', dark: 'text-violet-400', light: 'text-violet-600', hex: '#8b5cf6',
    bg: {
      dark: { header: 'bg-violet-600/30', summary: 'bg-violet-500/20', data: 'bg-violet-500/10' },
      light: { header: 'bg-violet-200', summary: 'bg-violet-100', data: 'bg-violet-50' }
    }
  },
  {
    id: 'fuchsia', label: 'フューシャ', dark: 'text-fuchsia-400', light: 'text-fuchsia-600', hex: '#d946ef',
    bg: {
      dark: { header: 'bg-fuchsia-600/30', summary: 'bg-fuchsia-500/20', data: 'bg-fuchsia-500/10' },
      light: { header: 'bg-fuchsia-200', summary: 'bg-fuchsia-100', data: 'bg-fuchsia-50' }
    }
  },
  {
    id: 'sky', label: 'スカイ', dark: 'text-sky-400', light: 'text-sky-600', hex: '#0ea5e9',
    bg: {
      dark: { header: 'bg-sky-600/30', summary: 'bg-sky-500/20', data: 'bg-sky-500/10' },
      light: { header: 'bg-sky-200', summary: 'bg-sky-100', data: 'bg-sky-50' }
    }
  },
  {
    id: 'slate', label: 'スレート', dark: 'text-slate-400', light: 'text-slate-600', hex: '#64748b',
    bg: {
      dark: { header: 'bg-slate-600/30', summary: 'bg-slate-500/20', data: 'bg-slate-500/10' },
      light: { header: 'bg-slate-200', summary: 'bg-slate-100', data: 'bg-slate-50' }
    }
  },
  {
    id: 'zinc', label: 'ジンク', dark: 'text-zinc-400', light: 'text-zinc-600', hex: '#71717a',
    bg: {
      dark: { header: 'bg-zinc-600/30', summary: 'bg-zinc-500/20', data: 'bg-zinc-500/10' },
      light: { header: 'bg-zinc-200', summary: 'bg-zinc-100', data: 'bg-zinc-50' }
    }
  },
  {
    id: 'stone', label: 'ストーン', dark: 'text-stone-400', light: 'text-stone-600', hex: '#78716c',
    bg: {
      dark: { header: 'bg-stone-600/30', summary: 'bg-stone-500/20', data: 'bg-stone-500/10' },
      light: { header: 'bg-stone-200', summary: 'bg-stone-100', data: 'bg-stone-50' }
    }
  },
];

// --- デフォルトのグラフ設定 ---
export const DEFAULT_CHART_CONFIGS = [];

// --- デフォルトのランキングカード設定 ---
export const DEFAULT_RANKING_CARDS = [];

// --- デフォルトの見出しカード設定 ---
export const DEFAULT_HEADING_CARDS = [];

// --- デフォルトのレイアウト設定 ---
// type: 'kpiSection' (個別KPIセクション), 'chart' (個別グラフ), 'dataTable' (個別データテーブル), 'chartRow' (グラフ横並びグループ)
// refId: 参照先のID（section.id, chartConfig.id, dataTable.id）
// items: chartRowの場合、含まれるグラフIDの配列
export const DEFAULT_LAYOUT_ORDER = [];

// ダッシュボード設定のひな形
export const DEFAULT_DASHBOARD_CONFIG = {
  id: 'default',
  name: 'デフォルトダッシュボード',
  dataSources: DEFAULT_DATA_SOURCES,
  mapping: DEFAULT_MAPPING,
  calculations: DEFAULT_CALCULATIONS,
  filters: DEFAULT_FILTERS,
  sections: DEFAULT_SECTIONS,
  visibleFields: DEFAULT_VISIBLE_FIELDS,
  dataTables: DEFAULT_DATA_TABLES,
  pivotTables: DEFAULT_PIVOT_TABLES, // ピボット集計テーブル
  comparisonTables: DEFAULT_COMPARISON_TABLES, // 比較テーブル
  systemFields: DEFAULT_SYSTEM_FIELDS,
  aggregationConfigs: DEFAULT_AGGREGATION_CONFIGS,
  compositeCards: DEFAULT_COMPOSITE_CARDS, // 複合カード設定
  chartConfigs: DEFAULT_CHART_CONFIGS, // グラフ設定
  rankingCards: DEFAULT_RANKING_CARDS, // ランキングカード設定
  headingCards: DEFAULT_HEADING_CARDS, // 見出しカード設定
  layoutOrder: DEFAULT_LAYOUT_ORDER, // レイアウト順序設定
  indicatorGroups: [], // 指標グループ（リレーション指標の合算カラム）
  allowedRoles: [], // 表示許可ロール（空配列=全ロールに表示）
  appName: 'CallData Analysis', // アプリケーション名

  mainKey: {
    sourceId: 'src_main',
    columnIndex: 0
  },

  dateSettings: {
    type: 'auto',  // 'auto' | 'source' | 'simple'
    sourceId: '',
    columnIndex: '',
    simpleConfig: {
      sourceId: '',  // シンプルモードで使用するデータソース
    }
  },

  // デフォルトフィルター設定（ダッシュボード表示時の初期フィルター値）
  defaultFilters: {
    dateRange: 'lastMonth' // 'today', 'thisWeek', 'thisMonth', 'lastMonth', 'last3Months', 'thisYear', 'all', 'custom'
  }
};

// --- モックデータ ---

export const MOCK_SOURCE_1 = [
  ['ID', '日付', '時間帯', '担当者名', '部署', 'エリア', '実働時間', 'コール数', '対話数', '受注数', 'NG理由'],
  ['101', '2025/11/01', '10:00', '担当者A', '営業1課', '東京', '1.0', '20', '10', '1', ''],
  ['101', '2025/11/01', '11:00', '担当者A', '営業1課', '東京', '1.0', '15', '8', '0', '家族反対'],
  ['102', '2025/11/01', '10:00', '担当者B', '営業2課', '大阪', '1.0', '25', '12', '2', ''],
  ['102', '2025/11/05', '14:00', '担当者B', '営業2課', '大阪', '1.0', '10', '5', '0', '留守'],
  ['103', '2025/11/02', '09:00', '担当者C', '営業1課', '名古屋', '1.0', '30', '15', '0', 'ガチャ切り'],
];

export const MOCK_SOURCE_2 = [
  ['受注ID', '担当者ID', '顧客名', '受注日', '金額', '部署'],
  ['PO-001', '101', '顧客A', '2025/11/01', '5000', '営業1課'],
  ['PO-002', '101', '顧客B', '2025/11/01', '12000', '営業1課'],
  ['PO-003', '102', '顧客C', '2025/11/01', '3000', '営業2課'],
  ['PO-004', '102', '顧客D', '', '0', '営業2課'],
  ['PO-005', '103', '顧客E', '2025/11/02', '8000', '営業1課'],
  ['PO-006', '101', '顧客F', '2025/11/03', '15000', '営業1課'],
];
