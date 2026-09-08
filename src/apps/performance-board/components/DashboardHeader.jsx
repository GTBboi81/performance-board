// src/apps/performance-board/components/DashboardHeader.jsx
// ダッシュボードヘッダー（アクションバー sticky）

import React from 'react';
import {
  RefreshCw, StopCircle,
  HardDriveDownload
} from 'lucide-react';

const DashboardHeader = ({
  theme = 'dark',
  isConnected,
  allRows,
  error,
  lastUpdated,
  isLoading,
  onCancelFetch,
  onRefresh,
  glassClass,
  serverCacheInfo = {},
  onCacheRebuild,
  hasServerCache = false,
  onToggleMobileSubSidebar,
  mobileSubSidebarOpen = false,
}) => {
  const actionBtnW = 'w-[120px]';

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const d = new Date(timestamp);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}/${m}/${dd} ${h}:${min}`;
  };

  return (
    <div className={`sticky top-14 md:top-0 z-20 -mx-6 px-6 py-3 border-b backdrop-blur-sm ${theme === 'dark' ? 'border-white/10' : 'border-gray-300'}`}>
      <div className="flex flex-wrap items-center gap-2">
        {/* データ再取得 / 中止（最左） */}
        {isLoading ? (
          <button onClick={onCancelFetch} className={`${actionBtnW} h-8 rounded-full text-sm font-medium flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${theme === 'dark' ? 'bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300' : 'bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-700'}`} title="データ取得をキャンセル">
            <StopCircle size={14} />
            中止
          </button>
        ) : onRefresh ? (
          <button onClick={onRefresh} className={`${actionBtnW} h-8 rounded-full text-sm font-medium flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${theme === 'dark' ? 'bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-200' : 'bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 text-indigo-700'}`} title="サーバーから最新データを取得">
            <RefreshCw size={14} />
            データ再取得
          </button>
        ) : null}
        {/* 接続エラー表示（未接続時のみ） */}
        {!isConnected && (
          <span className={`h-8 px-3 rounded-full text-xs flex items-center whitespace-nowrap ${theme === 'dark' ? 'bg-white/10 border border-white/10 text-white/50' : 'bg-gray-100 border border-gray-300 text-gray-600'}`}>
            {error ? 'エラー' : '未接続'}
          </span>
        )}
        {/* 更新日時 */}
        {isConnected && lastUpdated && (
          <span className={`text-xs whitespace-nowrap ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>
            {formatTimestamp(lastUpdated)}
          </span>
        )}
        {/* キャッシュ差分情報 */}
        {hasServerCache && (() => {
          const entries = Object.values(serverCacheInfo);
          if (entries.length === 0) return null;
          const latest = entries[entries.length - 1];
          const deltaText = latest.hit
            ? `差分 ${latest.deltaRecords}件`
            : (latest.cacheRebuilt ? '全件取得' : '');
          return deltaText ? (
            <span className={`text-[10px] whitespace-nowrap ${theme === 'dark' ? 'text-teal-400/60' : 'text-teal-600'}`}>
              {deltaText}
            </span>
          ) : null;
        })()}
        {/* キャッシュ再構築 */}
        {hasServerCache && !isLoading && onCacheRebuild && (
          <button onClick={onCacheRebuild} className={`py-1 px-3 rounded-full text-sm font-medium flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${theme === 'dark' ? 'bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-200' : 'bg-teal-100 hover:bg-teal-200 border border-teal-300 text-teal-700'}`} title="サーバーキャッシュを全件再取得で再構築">
            <HardDriveDownload size={14} />
            キャッシュ再構築
          </button>
        )}
      </div>
    </div>
  );
};

export default DashboardHeader;
