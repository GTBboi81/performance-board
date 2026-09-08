// src/apps/performance-board/components/ErrorActionModal.jsx
// エラー種別に応じたアクションモーダル

import { AlertCircle, RefreshCw, Play, Settings, Wifi } from 'lucide-react';

/**
 * エラー種別ごとのメタ情報
 */
const ERROR_CONFIGS = {
  '404': {
    title: 'データがまだ生成されていません',
    description: 'このボードのデータがキャッシュにありません。サーバーで生成してください。',
    actions: [{ label: 'データを生成する', key: 'generate', icon: Play, primary: true }],
  },
  'GENERATE_FAIL': {
    title: 'データ生成に失敗しました',
    description: 'サーバーでデータ生成中にエラーが発生しました。',
    actions: [{ label: '再試行', key: 'retry', icon: RefreshCw, primary: true }],
  },
  'NETWORK': {
    title: 'ネットワークエラー',
    description: 'サーバーと通信できませんでした。接続を確認してください。',
    actions: [{ label: '再試行', key: 'retry', icon: Wifi, primary: true }],
  },
  'AUTH_FAIL': {
    title: 'Salesforce認証に失敗しました',
    description: 'SF接続設定を確認してください（クライアントID/シークレット/ユーザー名など）。',
    actions: [
      { label: '設定を開く', key: 'openSettings', icon: Settings, primary: true },
      { label: '再試行', key: 'retry', icon: RefreshCw },
    ],
  },
  'SOQL_FAIL': {
    title: 'SOQL実行に失敗しました',
    description: 'SOQLクエリの構文、オブジェクト名、フィールド名、権限などを確認してください。',
    actions: [
      { label: '設定を開く', key: 'openSettings', icon: Settings, primary: true },
      { label: '再試行', key: 'retry', icon: RefreshCw },
    ],
  },
  'VLOOKUP_FAIL': {
    title: 'VLOOKUP実行に失敗しました',
    description: 'VLOOKUP設定の参照先オブジェクト・フィールド・キー列を確認してください。',
    actions: [
      { label: '設定を開く', key: 'openSettings', icon: Settings, primary: true },
    ],
  },
  'RESHAPE_FAIL': {
    title: 'Reshape変換に失敗しました',
    description: 'Wide→Long変換の設定（グループ定義・日付列など）を確認してください。',
    actions: [
      { label: '設定を開く', key: 'openSettings', icon: Settings, primary: true },
    ],
  },
  'WRITE_FAIL': {
    title: 'ファイル書き込みに失敗しました',
    description: 'サーバーの cache/ ディレクトリの書き込み権限を確認してください。',
    actions: [{ label: '再試行', key: 'retry', icon: RefreshCw, primary: true }],
  },
  'CONFIG_FAIL': {
    title: 'ボード設定の読み込みに失敗しました',
    description: 'ボード設定が存在しない、またはデータソースが未設定です。',
    actions: [
      { label: '設定を開く', key: 'openSettings', icon: Settings, primary: true },
    ],
  },
  'HEADER_FETCH_FAIL': {
    title: 'ヘッダー取得に失敗しました',
    description: 'SF オブジェクトのフィールド情報を取得できませんでした。',
    actions: [
      { label: '設定を開く', key: 'openSettings', icon: Settings, primary: true },
      { label: '再試行', key: 'retry', icon: RefreshCw },
    ],
  },
  'UNKNOWN': {
    title: '予期せぬエラーが発生しました',
    description: 'しばらく待ってから再試行してください。',
    actions: [{ label: '再試行', key: 'retry', icon: RefreshCw, primary: true }],
  },
};

const FALLBACK_CONFIG = ERROR_CONFIGS.UNKNOWN;
const DEMO_AUTH_CONFIG = {
  title: 'デモ環境では Salesforce 連携を実行できません',
  description: 'このポートフォリオでは、実データと認証情報を扱わないため Salesforce 接続を無効にしています。',
  actions: [],
};

export default function ErrorActionModal({ error, theme, onRetry, onGenerate, onOpenSettings, onDismiss }) {
  if (!error || typeof error !== 'object') return null;
  const errorType = error.type || 'UNKNOWN';
  const config = errorType === 'AUTH_FAIL' ? DEMO_AUTH_CONFIG : (ERROR_CONFIGS[errorType] || FALLBACK_CONFIG);

  const handleAction = (key) => {
    switch (key) {
      case 'retry': onRetry?.(); break;
      case 'generate': onGenerate?.(); break;
      case 'openSettings': onOpenSettings?.(); break;
      default: break;
    }
  };

  const glass = theme === 'dark'
    ? 'bg-slate-800/95 border border-white/10'
    : 'bg-white/95 border border-gray-200';
  const text = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const subtext = theme === 'dark' ? 'text-white/70' : 'text-gray-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className={`absolute inset-0 ${theme === 'dark' ? 'bg-slate-900/90' : 'bg-white/90'}`} />
      <div className={`relative flex flex-col items-center gap-4 p-8 rounded-2xl shadow-2xl min-w-[360px] max-w-md ${glass}`}>
        <AlertCircle className={`w-12 h-12 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} />
        <div className={`text-lg font-semibold text-center ${text}`}>{config.title}</div>
        <div className={`text-sm text-center ${subtext}`}>{config.description}</div>
        {error.message && (
          <div className={`text-xs px-3 py-2 rounded w-full text-left ${
            theme === 'dark' ? 'bg-slate-900/60 text-white/60' : 'bg-gray-100 text-gray-500'
          }`}>
            {error.message}
          </div>
        )}
        <div className="flex flex-col gap-2 w-full">
          {config.actions.map(action => {
            const Icon = action.icon;
            const classes = action.primary
              ? (theme === 'dark'
                ? 'bg-indigo-500 hover:bg-indigo-400 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white')
              : (theme === 'dark'
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-800');
            return (
              <button
                key={action.key}
                onClick={() => handleAction(action.key)}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition ${classes}`}
              >
                <Icon size={16} />
                {action.label}
              </button>
            );
          })}
          <button
            onClick={onDismiss}
            className={`text-xs mt-1 ${theme === 'dark' ? 'text-white/50 hover:text-white/70' : 'text-gray-500 hover:text-gray-700'}`}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
