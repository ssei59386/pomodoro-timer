import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateLabel, isToday, shiftDateKey, todayKey } from "../../utils/date";

interface DateSelectorProps {
  date: string;
  onChange: (date: string) => void;
}

export default function DateSelector({ date, onChange }: DateSelectorProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 pt-4">
      <button
        type="button"
        aria-label="前日"
        onClick={() => onChange(shiftDateKey(date, -1))}
        className="rounded-full bg-white p-2 shadow-card active:scale-95"
      >
        <ChevronLeft size={20} />
      </button>

      <div className="flex flex-col items-center">
        <span className="text-base font-semibold text-brand-800">
          {formatDateLabel(date)}
        </span>
        {!isToday(date) && (
          <button
            type="button"
            onClick={() => onChange(todayKey())}
            className="text-xs text-brand-500 underline underline-offset-2"
          >
            今日に戻る
          </button>
        )}
        {isToday(date) && <span className="text-xs text-slate-400">今日</span>}
      </div>

      <button
        type="button"
        aria-label="翌日"
        onClick={() => onChange(shiftDateKey(date, 1))}
        className="rounded-full bg-white p-2 shadow-card active:scale-95"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
