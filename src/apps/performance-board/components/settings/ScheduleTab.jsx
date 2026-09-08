// src/apps/performance-board/components/settings/ScheduleTab.jsx
// cron スケジュール設定（自動更新タイミング）

import { Clock, Calendar } from 'lucide-react';

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 10, 15, 20, 30, 40, 45, 50];

export default function ScheduleTab({
  localConfig,
  updateLocalConfig,
  theme,
  glassClass,
  cardClass,
  inputClass,
  textClass,
  textMutedClass,
  labelClass,
  labelSmClass,
  borderClass,
}) {
  const schedule = localConfig?.schedule || { enabled: false, hour: null, minute: null, dayOfWeek: [] };

  const updateSchedule = (patch) => {
    updateLocalConfig('schedule', { ...schedule, ...patch });
  };

  const toggleDay = (d) => {
    const days = Array.isArray(schedule.dayOfWeek) ? schedule.dayOfWeek : [];
    const next = days.includes(d) ? days.filter(x => x !== d) : [...days, d].sort((a, b) => a - b);
    updateSchedule({ dayOfWeek: next });
  };

  // プレビュー文章を組み立て
  const buildPreviewText = () => {
    if (!schedule.enabled) return '自動更新は無効です';
    const days = Array.isArray(schedule.dayOfWeek) && schedule.dayOfWeek.length > 0
      ? schedule.dayOfWeek.map(d => DAY_LABELS[d]).join('・')
      : '毎日';
    const hour = schedule.hour !== null && schedule.hour !== '' ? String(schedule.hour).padStart(2, '0') : '--';
    const minute = schedule.minute !== null && schedule.minute !== '' ? String(schedule.minute).padStart(2, '0') : '--';
    return `${days}の ${hour}:${minute} 頃に自動更新されます`;
  };

  return (
    <div className="space-y-4">
      {/* 有効/無効トグル */}
      <div className={`p-4 rounded-2xl ${glassClass} border ${borderClass}`}>
        <label className="flex items-center justify-between cursor-pointer">
          <div className="flex items-center gap-3">
            <Clock size={20} className={textClass} />
            <div>
              <div className={`font-medium ${textClass}`}>自動更新</div>
              <div className={`text-xs ${textMutedClass}`}>サーバー側で定期的にデータを再生成します</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={!!schedule.enabled}
            onChange={(e) => updateSchedule({ enabled: e.target.checked })}
            className="w-5 h-5 rounded cursor-pointer"
          />
        </label>
      </div>

      {/* 時刻設定 */}
      <div className={`p-4 rounded-2xl ${glassClass} border ${borderClass} ${!schedule.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className={`text-sm font-medium mb-3 flex items-center gap-2 ${textClass}`}>
          <Clock size={16} /> 実行時刻
        </div>
        <div className="flex items-center gap-2">
          <select
            value={schedule.hour ?? ''}
            onChange={(e) => updateSchedule({ hour: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
            className={`${inputClass} w-24`}
          >
            <option value="">--</option>
            {HOURS.map(h => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}時</option>
            ))}
          </select>
          <span className={textClass}>:</span>
          <select
            value={schedule.minute ?? ''}
            onChange={(e) => updateSchedule({ minute: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
            className={`${inputClass} w-24`}
          >
            <option value="">--</option>
            {MINUTES.map(m => (
              <option key={m} value={m}>{String(m).padStart(2, '0')}分</option>
            ))}
          </select>
        </div>
        <div className={`text-xs mt-2 ${textMutedClass}`}>
          ※ サーバーの cron 実行間隔（通常 1時間毎）に依存するため、設定時刻の ±15分以内で実行されます
        </div>
      </div>

      {/* 曜日設定 */}
      <div className={`p-4 rounded-2xl ${glassClass} border ${borderClass} ${!schedule.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className={`text-sm font-medium mb-3 flex items-center gap-2 ${textClass}`}>
          <Calendar size={16} /> 実行曜日
        </div>
        <div className="flex gap-2 flex-wrap">
          {DAY_LABELS.map((label, i) => {
            const days = Array.isArray(schedule.dayOfWeek) ? schedule.dayOfWeek : [];
            const active = days.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  active
                    ? (theme === 'dark' ? 'bg-indigo-500 text-white' : 'bg-indigo-600 text-white')
                    : (theme === 'dark' ? 'bg-white/10 text-white/60 hover:bg-white/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className={`text-xs mt-2 ${textMutedClass}`}>
          ※ 空欄（曜日未選択）の場合は毎日実行されます
        </div>
      </div>

      {/* プレビュー */}
      <div className={`p-4 rounded-2xl ${cardClass} border ${borderClass}`}>
        <div className={`text-xs ${labelSmClass} mb-1`}>プレビュー</div>
        <div className={`text-sm font-medium ${textClass}`}>
          {buildPreviewText()}
        </div>
      </div>
    </div>
  );
}
