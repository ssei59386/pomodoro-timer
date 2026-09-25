import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { eachDayOfInterval, format, subDays } from "date-fns";
import { ja } from "date-fns/locale";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { db } from "../db";
import { toDateKey } from "../utils/date";

type Period = "7d" | "30d" | "all";

const PERIODS: { key: Period; label: string }[] = [
  { key: "7d", label: "過去7日間" },
  { key: "30d", label: "過去30日間" },
  { key: "all", label: "全期間" },
];

interface ChartPoint {
  date: string;
  label: string;
  weight: number | null;
  sleepHours: number | null;
}

export default function GraphScreen() {
  const [period, setPeriod] = useState<Period>("7d");
  const logs = useLiveQuery(() => db.dailyLogs.orderBy("date").toArray(), []);

  const data = useMemo<ChartPoint[]>(() => {
    if (!logs) return [];
    const byDate = new Map(logs.map((l) => [l.date, l]));

    if (period === "all") {
      return logs
        .filter((l) => l.weight !== undefined || l.sleep?.durationHours !== undefined)
        .map((l) => ({
          date: l.date,
          label: format(new Date(l.date), "M/d", { locale: ja }),
          weight: l.weight ?? null,
          sleepHours: l.sleep?.durationHours ?? null,
        }));
    }

    const days = period === "7d" ? 6 : 29;
    const interval = eachDayOfInterval({ start: subDays(new Date(), days), end: new Date() });
    return interval.map((day) => {
      const key = toDateKey(day);
      const log = byDate.get(key);
      return {
        date: key,
        label: format(day, "M/d", { locale: ja }),
        weight: log?.weight ?? null,
        sleepHours: log?.sleep?.durationHours ?? null,
      };
    });
  }, [logs, period]);

  const weightValues = data.map((d) => d.weight).filter((v): v is number => v !== null);
  const hasWeightData = weightValues.length > 0;
  const hasSleepData = data.some((d) => d.sleepHours !== null);
  const weightDomain: [number, number] = hasWeightData
    ? [Math.floor(Math.min(...weightValues) - 1), Math.ceil(Math.max(...weightValues) + 1)]
    : [0, 1];

  return (
    <div>
      <header className="px-4 pt-4">
        <h1 className="text-lg font-bold text-brand-800">グラフ</h1>
      </header>

      <div className="mx-4 mt-3 flex gap-1.5 rounded-full bg-white p-1 shadow-card">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            className={`flex-1 rounded-full py-1.5 text-xs font-medium transition-colors ${
              period === p.key ? "bg-brand-500 text-white" : "text-slate-500"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <section className="mx-4 mt-4 rounded-2xl bg-white p-4 shadow-card">
        <h2 className="mb-2 text-sm font-semibold text-brand-700">体重 (kg)</h2>
        {hasWeightData ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5efe9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                domain={weightDomain}
                width={40}
              />
              <Tooltip
                formatter={(value: number) => [`${value}kg`, "体重"]}
                labelStyle={{ fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#1f7352"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState />
        )}
      </section>

      <section className="mx-4 mt-4 rounded-2xl bg-white p-4 shadow-card">
        <h2 className="mb-2 text-sm font-semibold text-brand-700">睡眠時間 (h)</h2>
        {hasSleepData ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5efe9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} width={40} />
              <Tooltip
                formatter={(value: number) => [`${value}時間`, "睡眠"]}
                labelStyle={{ fontSize: 12 }}
              />
              <Bar
                dataKey="sleepHours"
                fill="#7fcaa8"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState />
        )}
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[160px] items-center justify-center text-sm text-slate-400">
      データがありません
    </div>
  );
}
