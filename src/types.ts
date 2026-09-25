export interface SetEntry {
  setNumber: number;
  weight: number;
  reps: number;
}

export interface WorkoutEntry {
  id: string;
  exerciseName: string;
  sets: SetEntry[];
}

export interface MealEntry {
  id: string;
  foodName: string;
  amount: string;
}

export interface SleepInfo {
  bedtime?: string; // "HH:mm"
  waketime?: string; // "HH:mm"
  durationHours?: number; // 起床 - 就寝 の時間（日跨ぎ対応）
}

export interface DailyLog {
  date: string; // "YYYY-MM-DD" (Primary Key)
  weight?: number;
  sleep?: SleepInfo;
  meals: MealEntry[];
  workouts: WorkoutEntry[];
}

export interface ExerciseHistoryEntry {
  name: string; // Primary Key
  lastUsedAt: Date;
}

export interface BackupPayload {
  version: 1;
  exportedAt: string;
  dailyLogs: DailyLog[];
  exerciseHistory: ExerciseHistoryEntry[];
}
