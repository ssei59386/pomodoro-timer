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

/**
 * `initialData` を下敷きに欠損フィールドを補完し、templateKey 未設定の既存データ
 * （正規5教科名のみ）を名前から逆引きして補う。loadData（localStorageからの復元）と
 * parseImportedData（バックアップファイルからの復元）の両方が同じ堅牢化を必要とするため共通化する。
 */
function normalizeAppData(parsed: Partial<AppData>): AppData {
  const merged: AppData = {
    ...initialData,
    ...parsed,
    availability: { ...initialData.availability, ...parsed.availability },
  };
  merged.subjects = merged.subjects.map((subject) => ({
    ...subject,
    templateKey: subject.templateKey ?? reverseNameToTemplateKey(subject.name) ?? "social",
  }));
  return merged;
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialData;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return normalizeAppData(parsed);
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

/** バックアップ書き出し用に整形済みJSON文字列へ変換する（純粋関数、DOM操作はSettings.tsx側で行う） */
export function exportDataToJson(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * 配列の各要素が「オブジェクトかつ id（string）を持つ」ことだけを確認する。
 * 壊れたバックアップファイル（要素の型が崩れている等）をここで弾かないと、
 * replaceAllData 後の描画中に例外が起き白画面になりうる（ErrorBoundary はあるが
 * 事前に弾けるものは弾く）。過剰に厳しくすると正当なバックアップまで拒否してしまうため
 * id の存在チェック程度に留める（ux-reviewer指摘）。
 */
function isValidRecordArray(value: unknown): value is Array<{ id: string }> {
  return (
    Array.isArray(value) &&
    value.every(
      (item) => typeof item === "object" && item !== null && typeof (item as { id?: unknown }).id === "string",
    )
  );
}

/**
 * バックアップファイルの中身（JSON文字列）を AppData に復元する。
 * 最低限の形状検証（subjects/chapters/sessions が配列で、各要素がidを持つオブジェクトであること）
 * を通らなければ null を返し、呼び出し側（Settings.tsx）でエラー表示に使う。検証を通ったものは
 * loadData と同じ堅牢化（normalizeAppData）を適用してから返す。
 */
export function parseImportedData(raw: string): AppData | null {
  try {
    const parsed = JSON.parse(raw) as Partial<AppData>;
    if (
      !isValidRecordArray(parsed.subjects) ||
      !isValidRecordArray(parsed.chapters) ||
      !isValidRecordArray(parsed.sessions)
    ) {
      return null;
    }
    return normalizeAppData(parsed);
  } catch {
    return null;
  }
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
