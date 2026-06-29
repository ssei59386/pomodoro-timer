// 仕様書 §4: データ保存は端末ローカル。最小版は localStorage で割り切る。
import type { AppData } from "./types";

const STORAGE_KEY = "study-planner-data-v1";

export const initialData: AppData = {
  subjects: [],
  chapters: [],
  sessions: [],
  availability: { weeklySchedule: {}, dateOverrides: {} },
  onboarded: false,
};

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialData;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    // 欠損フィールドは初期値で補完しておく（前方互換のため）
    return {
      ...initialData,
      ...parsed,
      availability: { ...initialData.availability, ...parsed.availability },
    };
  } catch {
    return initialData;
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 保存に失敗しても致命的ではないので握りつぶす
  }
}

export function clearData(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** 簡易な一意ID生成 */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
