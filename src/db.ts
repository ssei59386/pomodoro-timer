import Dexie, { type Table } from "dexie";
import type { BackupPayload, DailyLog, ExerciseHistoryEntry } from "./types";

class MyFitLogDB extends Dexie {
  dailyLogs!: Table<DailyLog, string>;
  exerciseHistory!: Table<ExerciseHistoryEntry, string>;

  constructor() {
    super("myfitlog-db");
    this.version(1).stores({
      dailyLogs: "date",
      exerciseHistory: "name, lastUsedAt",
    });
  }
}

export const db = new MyFitLogDB();

export function emptyDailyLog(date: string): DailyLog {
  return { date, meals: [], workouts: [] };
}

export async function getDailyLog(date: string): Promise<DailyLog> {
  const log = await db.dailyLogs.get(date);
  return log ?? emptyDailyLog(date);
}

export async function saveDailyLog(log: DailyLog): Promise<void> {
  const isEmpty =
    log.weight === undefined &&
    !log.sleep?.bedtime &&
    !log.sleep?.waketime &&
    log.meals.length === 0 &&
    log.workouts.length === 0;

  if (isEmpty) {
    await db.dailyLogs.delete(log.date);
    return;
  }
  await db.dailyLogs.put(log);
}

export async function getAllDailyLogs(): Promise<DailyLog[]> {
  return db.dailyLogs.orderBy("date").toArray();
}

export async function getDailyLogsInRange(
  startDate: string,
  endDate: string
): Promise<DailyLog[]> {
  return db.dailyLogs.where("date").between(startDate, endDate, true, true).toArray();
}

export async function touchExerciseName(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await db.exerciseHistory.put({ name: trimmed, lastUsedAt: new Date() });
}

export async function getExerciseSuggestions(query: string): Promise<string[]> {
  const all = await db.exerciseHistory.orderBy("lastUsedAt").reverse().toArray();
  const q = query.trim().toLowerCase();
  const filtered = q ? all.filter((e) => e.name.toLowerCase().includes(q)) : all;
  return filtered.slice(0, 8).map((e) => e.name);
}

export async function exportBackup(): Promise<BackupPayload> {
  const [dailyLogs, exerciseHistory] = await Promise.all([
    db.dailyLogs.toArray(),
    db.exerciseHistory.toArray(),
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    dailyLogs,
    exerciseHistory,
  };
}

export async function importBackup(payload: BackupPayload): Promise<void> {
  await db.transaction("rw", db.dailyLogs, db.exerciseHistory, async () => {
    await db.dailyLogs.clear();
    await db.exerciseHistory.clear();
    await db.dailyLogs.bulkAdd(payload.dailyLogs);
    await db.exerciseHistory.bulkAdd(
      payload.exerciseHistory.map((e) => ({
        ...e,
        lastUsedAt: new Date(e.lastUsedAt),
      }))
    );
  });
}
