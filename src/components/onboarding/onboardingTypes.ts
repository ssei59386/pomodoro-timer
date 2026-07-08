import type { TimeSlot } from "../../types";
import type { SubjectTemplateKey } from "../../data/subjectTemplates";
import { uid } from "../../store";

// 仕様書 §7.1 初期設定 / オンボーディング（本格ステップ式ウィザード版、docs/feature-onboarding-wizard.md）。
// ステップ間で共有する型・定数・下書き用のヘルパーをここに集約する。
// 社会・国語は暗記専用教科（章を持たず、暗記範囲のみ）— docs/feature-memorization.md 確定設計v4。
//
// 教科の複数登録対応（段階5）で、固定5教科の union キーに依存していた形を卒業した。
// 「教科ごとの振る舞い」は SubjectTemplateKey（src/data/subjectTemplates.ts）が持ち、
// オンボーディングのドラフトは教科の実インスタンス（DraftSubject、複数登録・同テンプレ重複可）を
// 主として持つ。旧 SUBJECT_LABELS/SUBJECT_ORDER/VOCAB_SUBJECT_KEYS/CHAPTER_CAPABLE_SUBJECT_KEYS/
// curriculumSubjectFor/SubjectKey は役目を終えたため削除した（他ファイルからの参照は無いことを確認済み）。

/**
 * 教科の下書き1件（教科の複数登録対応、段階5）。同じ templateKey を複数回登録できる
 * （数学I/数学Aのような分割、保健体育のような自由教科名の追加、いずれも1つの仕組みで表現する）。
 */
export interface DraftSubject {
  instanceId: string; // uid()。章・暗記範囲の subjectInstanceId が参照する
  templateKey: SubjectTemplateKey;
  name: string; // 自由編集可。追加時の初期値はテンプレートの defaultName
  testDate: string;
}

export function makeDraftSubject(templateKey: SubjectTemplateKey, defaultName: string): DraftSubject {
  return { instanceId: uid(), templateKey, name: defaultName, testDate: "" };
}

export interface DraftSubtopic {
  key: string; // uid()
  name: string;
  achievedLevel: 1 | 2 | 3 | 4 | 5; // 初期理解度（達成段階）、デフォルト 3。記録画面と同じ言葉に統一
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
  subjectInstanceId: string; // DraftSubject.instanceId への参照
  name: string;
  achievedLevel: 1 | 2 | 3 | 4 | 5; // 初期理解度（達成段階）。記録画面と同じラダーを使う
  subtopics: DraftSubtopic[]; // 空配列なら従来通り chapter 全体の achievedLevel を使う
}

/**
 * 暗記範囲の登録（確定設計 v2〜v4、docs/feature-memorization.md 参照）。
 * chapterKey は DraftChapter.key への参照（実際の Chapter.id は送信時に採番されるため、
 * 送信時に id へ変換する）。ステップで教科が固定されるため、教科を選ぶドロップダウンは持たない
 * （subjectInstanceId フィールド自体は絞り込み・送信変換用に保持する）。
 */
export interface DraftVocabRange {
  key: string;
  label: string;
  subjectInstanceId: string;
  chapterKey: string | null;
  startNumber: number | null;
  endNumber: number | null;
}

export function makeBlankChapter(subjectInstanceId: string): DraftChapter {
  return {
    key: uid(),
    subjectInstanceId,
    name: "",
    achievedLevel: 3,
    subtopics: [],
  };
}

export function makeBlankSubtopic(): DraftSubtopic {
  return {
    key: uid(),
    name: "",
    achievedLevel: 3,
    basicProblems: null,
    advancedProblems: null,
    difficultyLevel: null,
    teacherHinted: false,
  };
}

export function makeBlankVocabRange(subjectInstanceId: string): DraftVocabRange {
  return {
    key: uid(),
    label: "",
    subjectInstanceId,
    chapterKey: null,
    startNumber: null,
    endNumber: null,
  };
}

/**
 * ステップ間の下書き永続化用スナップショット（storage.ts の saveOnboardingDraft/loadOnboardingDraft
 * を通じて本番データとは別キーで保存する）。JSON化するだけなのでこの形をそのまま使う。
 * version 2（教科インスタンスキー化、段階5）。旧 version 1 の下書きは読み込み時に破棄される
 * （loadOnboardingDraft の expectedVersion チェック、storage.ts 参照）。
 */
export interface OnboardingDraft {
  version: 2;
  subjects: DraftSubject[];
  chapters: DraftChapter[];
  vocabRanges: DraftVocabRange[];
  weeklySchedule: Partial<Record<number, TimeSlot[]>>;
  dateOverrides: Record<string, TimeSlot[]>;
  currentStepIndex: number;
}
