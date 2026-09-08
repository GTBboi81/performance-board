import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const TYPE_COLORS = {
  major: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  minor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  patch: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const TYPE_COLORS_LIGHT = {
  major: 'bg-rose-100 text-rose-700 border-rose-200',
  minor: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  patch: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const CATEGORY_COLORS = {
  feat: 'bg-indigo-500/20 text-indigo-400',
  fix: 'bg-rose-500/20 text-rose-400',
  perf: 'bg-amber-500/20 text-amber-400',
  refactor: 'bg-sky-500/20 text-sky-400',
  docs: 'bg-gray-500/20 text-gray-400',
  chore: 'bg-slate-500/20 text-slate-400',
};

const CATEGORY_COLORS_LIGHT = {
  feat: 'bg-indigo-100 text-indigo-700',
  fix: 'bg-rose-100 text-rose-700',
  perf: 'bg-amber-100 text-amber-700',
  refactor: 'bg-sky-100 text-sky-700',
  docs: 'bg-gray-100 text-gray-600',
  chore: 'bg-slate-100 text-slate-600',
};

const VersionHistoryModal = ({ theme, data, onClose }) => {
  const isDark = theme === 'dark';

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className={`absolute inset-0 ${isDark ? 'bg-black/60' : 'bg-black/30'}`} />
      <div
        className={`relative w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl shadow-2xl ${
          isDark
            ? 'bg-slate-800 border border-white/10'
            : 'bg-white border border-gray-200'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className={`sticky top-0 flex items-center justify-between p-5 border-b ${
          isDark ? 'bg-slate-800 border-white/10' : 'bg-white border-gray-200'
        }`}>
          <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            バージョン履歴（実績ボード）
          </h2>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-all ${
              isDark ? 'hover:bg-white/10 text-white/60 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-800'
            }`}
          >
            <X size={16} />
          </button>
        </div>

        {/* 履歴リスト */}
        <div className="p-5 space-y-4">
          {data.history.map((entry, idx) => {
            const isLatest = idx === 0;
            const typeColor = isDark
              ? (TYPE_COLORS[entry.type] || TYPE_COLORS.patch)
              : (TYPE_COLORS_LIGHT[entry.type] || TYPE_COLORS_LIGHT.patch);

            return (
              <div
                key={entry.version}
                className={`rounded-xl p-4 border-2 ${
                  isLatest
                    ? isDark
                      ? 'border-indigo-500/40 bg-indigo-500/10'
                      : 'border-indigo-300 bg-indigo-50'
                    : isDark
                      ? 'border-white/10 bg-white/5'
                      : 'border-gray-200 bg-gray-50'
                }`}
              >
                {/* バージョンヘッダー */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`text-sm font-mono font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    v{entry.version}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${typeColor}`}>
                    {entry.type}
                  </span>
                  <span className={`text-xs ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
                    {entry.date}
                  </span>
                  {isLatest && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      isDark ? 'bg-indigo-500/30 text-indigo-300' : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      最新
                    </span>
                  )}
                </div>

                {/* サマリー */}
                <p className={`text-sm font-bold mb-3 ${isDark ? 'text-white/90' : 'text-gray-800'}`}>
                  {entry.summary}
                </p>

                {/* 変更一覧 */}
                {entry.changes && entry.changes.length > 0 && (
                  <ul className="space-y-1.5">
                    {entry.changes.map((change, ci) => {
                      const catColor = isDark
                        ? (CATEGORY_COLORS[change.category] || CATEGORY_COLORS.chore)
                        : (CATEGORY_COLORS_LIGHT[change.category] || CATEGORY_COLORS_LIGHT.chore);
                      return (
                        <li key={ci} className="flex items-start gap-2 text-xs">
                          <span className={`flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded font-mono font-medium ${catColor}`}>
                            {change.category}
                          </span>
                          <span className={isDark ? 'text-white/70' : 'text-gray-600'}>
                            {change.description}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default VersionHistoryModal;
