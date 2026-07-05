// 仕様書 §4: データ保存は端末ローカル。最小版は localStorage で割り切る。
import type { AppData } from "./types";

const STORAGE_KEY = "study-planner-data-v1";

export const initialData: AppData = {
  subjects: [],
  chapters: [],
  sessions: [],
  availability: { weeklySchedule: {}, dateOverrides: {} },
  vocabRanges: [],
  vocabChunks: [],
  todayPlan: null,
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

export function saveData(data: AppData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearData(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** 簡易な一意ID生成 */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- オンボーディング・ウィザードの下書き永続化 -------------------------
// 本番データ（STORAGE_KEY）とは別キーに保存する。ステップ＋教科ループに分割されたことで
// 完了までの所要時間・中断確率が増えるため、途中でタブを閉じても再開できるようにする
// （docs/feature-onboarding-wizard.md）。下書きの中身の型は呼び出し側（Onboarding.tsx）が持つ。

const ONBOARDING_DRAFT_KEY = "study-planner-onboarding-draft-v1";

export function saveOnboardingDraft<T>(draft: T): void {
  try {
    localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // 下書き保存の失敗はオンボーディング続行を妨げないので無視する（容量超過等）
  }
}

export function loadOnboardingDraft<T>(): T | null {
  try {
    const raw = localStorage.getItem(ONBOARDING_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearOnboardingDraft(): void {
  localStorage.removeItem(ONBOARDING_DRAFT_KEY);
}
