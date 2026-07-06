import type { TimeSlot } from "../../types";
import { uid } from "../../store";

// 仕様書 §7.1 初期設定 / オンボーディング（本格ステップ式ウィザード版、docs/feature-onboarding-wizard.md）。
// ステップ間で共有する型・定数・下書き用のヘルパーをここに集約する。
// 社会・国語は暗記専用教科（章を持たず、暗記範囲のみ）— docs/feature-memorization.md 確定設計v4。

export type SubjectKey = "math" | "science" | "english" | "social" | "japanese";

/** 初期理解度確認用は曖昧な手応えラベルではなく、行動レベルの具体的な指標にする */
export const INITIAL_UNDERSTANDING_LABELS = [
  "解いたことがない",
  "解説を読めば分かる",
  "ヒントがあれば解ける",
  "自力でほぼ解ける",
  "人に教えられる",
];

export const SUBJECT_LABELS: Record<SubjectKey, "数学" | "理科" | "英語" | "社会" | "国語"> = {
  math: "数学",
  science: "理科",
  english: "英語",
  social: "社会",
  japanese: "国語",
};

/** ステップの組み立て・表示順（ワイヤーフレーム通り）。使う教科ステップ・テスト日ステップもこの順で並ぶ */
export const SUBJECT_ORDER: SubjectKey[] = ["math", "science", "english", "social", "japanese"];

/** 暗記範囲を登録できる教科（数学・理科は暗記対象外） */
export const VOCAB_SUBJECT_KEYS: SubjectKey[] = ["english", "social", "japanese"];

/** 章を持てる教科（社会・国語は暗記専用教科で章を持たない、docs/feature-memorization.md 確定設計v4） */
export const CHAPTER_CAPABLE_SUBJECT_KEYS: SubjectKey[] = ["math", "science", "english"];

// カリキュラムサジェスト機能（ChapterCurriculumSuggest/CurriculumSuggest/CurriculumSubtopicPicker）は
// 数学・理科向け参考データ専用（著作権上の理由で英語・社会・国語向けデータは作らない方針）。
export function curriculumSubjectFor(subjectKey: SubjectKey): "数学" | "理科" | null {
  if (subjectKey === "math") return "数学";
  if (subjectKey === "science") return "理科";
  return null;
}

export interface DraftSubtopic {
  key: string; // uid()
  name: string;
  selfReport: number; // 1〜5, デフォルト 3
  basicProblems: number | null; // 任意（教科書の例題＋問題集の基礎レベル問題の合計）
  advancedProblems: number | null; // 任意（教科書＋問題集の発展レベル問題の合計）
  difficultyLevel: 1 | 2 | 3 | 4 | 5 | null; // 任意。カリキュラム候補選択で自動入力、手動上書き可
  teacherHinted: boolean; // 先生からテストに出るヒントがあったかどうか
}

/**
 * 章の下書き。metadata（演習問題数・学習範囲・章の難易度）はオンボーディングでは収集せず、
 * Settings 専用に移した（本格ウィザード化にあたり、教科ループで最大5回繰り返すと密度負荷が
 * 増すため。ux-reviewer/ceo指摘、docs/feature-onboarding-wizard.md）。
 */
export interface DraftChapter {
  key: string; // フォーム内での一時キー
  subjectKey: SubjectKey;
  name: string;
  selfReport: number; // 1〜5
  correctRate: number | null; // 直近の正答率（%表記、未入力なら null）
  subtopics: DraftSubtopic[]; // 空配列なら従来通り chapter 全体の self-report/correctRate を使う
}

/**
 * 暗記範囲の登録（確定設計 v2〜v4、docs/feature-memorization.md 参照）。
 * chapterKey は DraftChapter.key への参照（実際の Chapter.id は送信時に採番されるため、
 * 送信時に id へ変換する）。ステップで教科が固定されるため、教科を選ぶドロップダウンは持たない
 * （subjectKey フィールド自体は絞り込み・送信変換用に保持する）。
 */
export interface DraftVocabRange {
  key: string;
  label: string;
  subjectKey: SubjectKey;
  chapterKey: string | null;
  startNumber: number | null;
  endNumber: number | null;
}

export function makeBlankChapter(subjectKey: SubjectKey): DraftChapter {
  return {
    key: uid(),
    subjectKey,
    name: "",
    selfReport: 3,
    correctRate: null,
    subtopics: [],
  };
}

export function makeBlankSubtopic(): DraftSubtopic {
  return {
    key: uid(),
    name: "",
    selfReport: 3,
    basicProblems: null,
    advancedProblems: null,
    difficultyLevel: null,
    teacherHinted: false,
  };
}

export function makeBlankVocabRange(subjectKey: SubjectKey): DraftVocabRange {
  return {
    key: uid(),
    label: "",
    subjectKey,
    chapterKey: null,
    startNumber: null,
    endNumber: null,
  };
}

/**
 * ステップ間の下書き永続化用スナップショット（storage.ts の saveOnboardingDraft/loadOnboardingDraft
 * を通じて本番データとは別キーで保存する）。JSON化するだけなのでこの形をそのまま使う。
 */
export interface OnboardingDraft {
  version: 1;
  selectedSubjects: SubjectKey[];
  testDates: Partial<Record<SubjectKey, string>>;
  chapters: DraftChapter[];
  vocabRanges: DraftVocabRange[];
  weeklySchedule: Partial<Record<number, TimeSlot[]>>;
  dateOverrides: Record<string, TimeSlot[]>;
  currentStepIndex: number;
}
