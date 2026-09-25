import { Moon, Scale } from "lucide-react";
import type { DailyLog } from "../../types";
import { calcSleepDurationHours, formatDurationHours } from "../../utils/date";

interface ConditionSectionProps {
  log: DailyLog;
  onChange: (updater: (log: DailyLog) => DailyLog) => void;
}

export default function ConditionSection({ log, onChange }: ConditionSectionProps) {
  const duration = log.sleep?.durationHours;

  function updateSleep(patch: Partial<NonNullable<DailyLog["sleep"]>>) {
    onChange((prev) => {
      const nextSleep = { ...prev.sleep, ...patch };
      nextSleep.durationHours = calcSleepDurationHours(nextSleep.bedtime, nextSleep.waketime);
      return { ...prev, sleep: nextSleep };
    });
  }

  return (
    <section className="mx-4 mt-4 rounded-2xl bg-white p-4 shadow-card">
      <h2 className="mb-3 text-sm font-semibold text-brand-700">コンディション</h2>

      <label className="mb-3 flex items-center gap-3">
        <Scale size={18} className="text-brand-500" />
        <span className="w-16 text-sm text-slate-600">体重</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder="0.0"
          value={log.weight ?? ""}
          onChange={(e) =>
            onChange((prev) => ({
              ...prev,
              weight: e.target.value === "" ? undefined : Number(e.target.value),
            }))
          }
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-right text-base focus:border-brand-400 focus:outline-none"
        />
        <span className="text-sm text-slate-500">kg</span>
      </label>

      <div className="flex items-center gap-3">
        <Moon size={18} className="text-brand-500" />
        <span className="w-16 text-sm text-slate-600">睡眠</span>
        <input
          type="time"
          value={log.sleep?.bedtime ?? ""}
          onChange={(e) => updateSleep({ bedtime: e.target.value })}
          className="flex-1 rounded-lg border border-slate-200 px-2 py-2 text-center text-sm focus:border-brand-400 focus:outline-none"
        />
        <span className="text-xs text-slate-400">〜</span>
        <input
          type="time"
          value={log.sleep?.waketime ?? ""}
          onChange={(e) => updateSleep({ waketime: e.target.value })}
          className="flex-1 rounded-lg border border-slate-200 px-2 py-2 text-center text-sm focus:border-brand-400 focus:outline-none"
        />
      </div>
      {duration !== undefined && (
        <p className="mt-2 pl-9 text-sm text-brand-600">
          睡眠時間: {formatDurationHours(duration)}
        </p>
      )}
    </section>
  );
}
