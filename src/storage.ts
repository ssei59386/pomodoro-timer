// 仕様書 §4: データ保存は端末ローカル。最小版は localStorage で割り切る。
import type { AppData } from "./types";
import { reverseNameToTemplateKey } from "./data/subjectTemplates";

const STORAGE_KEY = "study-planner-data-v1";

export const initialData: AppData = {
  subjects: [],
  chapters: [],
  sessions: [],
  availability: { weeklySchedule: {}, dateOverrides: {} },
  vocabRanges: [],
  vocabChunks: [],
  todayPlan: null,
  forecastDecisions: {},
  onboarded: false,
};

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialData;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    // 欠損フィールドは初期値で補完しておく（前方互換のため）
    const merged: AppData = {
      ...initialData,
      ...parsed,
      availability: { ...initialData.availability, ...parsed.availability },
    };
    // templateKey 未設定の既存データ（正規5教科名のみ）は名前から逆引きして補う（改名耐性のため次回保存で永続化）
    merged.subjects = merged.subjects.map((subject) => ({
      ...subject,
      templateKey: subject.templateKey ?? reverseNameToTemplateKey(subject.name) ?? "social",
    }));
    return merged;
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

/**
 * expectedVersion と一致しない下書き（＝形が変わった旧バージョンの下書き）は破棄して null を返す
 * （教科の複数登録対応・段階5で OnboardingDraft が version 1→2 に変わった際、旧形式のまま
 * 読み込んでしまうと型が壊れるため）。オンボーディング途中中断者のみへの影響で軽微。
 */
export function loadOnboardingDraft<T extends { version: number }>(expectedVersion: number): T | null {
  try {
    const raw = localStorage.getItem(ONBOARDING_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    if (parsed.version !== expectedVersion) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearOnboardingDraft(): void {
  localStorage.removeItem(ONBOARDING_DRAFT_KEY);
}
