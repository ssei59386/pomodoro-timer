import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "../db";
import DayDetailCard from "../components/DayDetailCard";
import { formatMonthLabel, isToday, toDateKey, todayKey } from "../utils/date";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

interface CalendarScreenProps {
  onEditDate: (date: string) => void;
}

export default function CalendarScreen({ onEditDate }: CalendarScreenProps) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string>(todayKey());

  const logs = useLiveQuery(() => db.dailyLogs.toArray(), []);
  const loggedDates = useMemo(() => {
    const set = new Set<string>();
    for (const log of logs ?? []) {
      const hasData =
        log.weight !== undefined ||
        log.sleep?.bedtime ||
        log.meals.length > 0 ||
        log.workouts.length > 0;
      if (hasData) set.add(log.date);
    }
    return set;
  }, [logs]);

  const selectedLog = useMemo(
    () => logs?.find((l) => l.date === selectedDate),
    [logs, selectedDate]
  );

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth));
    const end = endOfWeek(endOfMonth(viewMonth));
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  return (
    <div>
      <header className="flex items-center justify-between px-4 pt-4">
        <button
          type="button"
          aria-label="前の月"
          onClick={() => setViewMonth((m) => addMonths(m, -1))}
          className="rounded-full bg-white p-2 shadow-card active:scale-95"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-base font-bold text-brand-800">{formatMonthLabel(viewMonth)}</h1>
        <button
          type="button"
          aria-label="次の月"
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="rounded-full bg-white p-2 shadow-card active:scale-95"
        >
          <ChevronRight size={20} />
        </button>
      </header>

      <div className="mx-4 mt-4 rounded-2xl bg-white p-3 shadow-card">
        <div className="grid grid-cols-7 text-center text-xs text-slate-400">
          {WEEKDAY_LABELS.map((w) => (
            <span key={w} className="py-1">
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {days.map((day) => {
            const key = toDateKey(day);
            const inMonth = isSameMonth(day, viewMonth);
            const hasLog = loggedDates.has(key);
            const isSelected = key === selectedDate;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDate(key)}
                className="flex flex-col items-center gap-0.5 py-1.5"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                    isSelected
                      ? "bg-brand-500 text-white"
                      : isToday(key)
                        ? "border border-brand-400 text-brand-600"
                        : inMonth
                          ? "text-slate-700"
                          : "text-slate-300"
                  }`}
                >
                  {day.getDate()}
                </span>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    hasLog ? "bg-brand-400" : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      <DayDetailCard
        date={selectedDate}
        log={selectedLog}
        onEdit={() => onEditDate(selectedDate)}
      />
    </div>
  );
}
