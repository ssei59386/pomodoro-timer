import { Dumbbell, Moon, Pencil, Scale, Utensils } from "lucide-react";
import type { DailyLog } from "../types";
import { formatDateLabel, formatDurationHours } from "../utils/date";

interface DayDetailCardProps {
  date: string;
  log?: DailyLog;
  onEdit: () => void;
}

export default function DayDetailCard({ date, log, onEdit }: DayDetailCardProps) {
  const hasData =
    log &&
    (log.weight !== undefined ||
      log.sleep?.bedtime ||
      log.meals.length > 0 ||
      log.workouts.length > 0);

  return (
    <div className="mx-4 mt-4 rounded-2xl bg-white p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-800">{formatDateLabel(date)}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-600 active:bg-brand-100"
        >
          <Pencil size={13} /> 編集
        </button>
      </div>

      {!hasData && <p className="py-4 text-center text-sm text-slate-400">記録はありません</p>}

      {hasData && (
        <div className="flex flex-col gap-3 text-sm">
          {(log!.weight !== undefined || log!.sleep?.bedtime) && (
            <div className="flex flex-wrap gap-4">
              {log!.weight !== undefined && (
                <span className="flex items-center gap-1.5 text-slate-600">
                  <Scale size={15} className="text-brand-500" /> {log!.weight}kg
                </span>
              )}
              {log!.sleep?.bedtime && (
                <span className="flex items-center gap-1.5 text-slate-600">
                  <Moon size={15} className="text-brand-500" />
                  {log!.sleep.bedtime}〜{log!.sleep.waketime || "?"}
                  {log!.sleep.durationHours !== undefined &&
                    `（${formatDurationHours(log!.sleep.durationHours)}）`}
                </span>
              )}
            </div>
          )}

          {log!.workouts.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
                <Dumbbell size={15} className="text-brand-500" /> トレーニング
              </p>
              <ul className="flex flex-col gap-1.5 pl-1">
                {log!.workouts.map((w) => (
                  <li key={w.id}>
                    <p className="font-medium text-slate-700">{w.exerciseName || "(種目未入力)"}</p>
                    <p className="text-xs text-slate-500">
                      {w.sets
                        .map((s) => `${s.setNumber}セット: ${s.weight}kg × ${s.reps}回`)
                        .join(" / ")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {log!.meals.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-1.5 font-medium text-slate-700">
                <Utensils size={15} className="text-brand-500" /> 食事
              </p>
              <ul className="pl-1 text-xs text-slate-600">
                {log!.meals.map((m) => (
                  <li key={m.id}>
                    {m.foodName || "(食品名未入力)"} - {m.amount || "―"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
