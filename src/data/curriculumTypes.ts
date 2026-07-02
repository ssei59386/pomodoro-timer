/**
 * カリキュラム参考データ（数学・理科）共通の型定義。
 * mathCurriculumReference.ts / scienceCurriculumReference_*.ts が共有する。
 *
 * 想定用途（未実装・別タスク）：Onboarding/Settings で章・小項目名を入力した際に、
 * この参考データとあいまい一致させて難易度・演習量の初期値候補を提示する。
 * 生徒の自由記述入力を置き換えるものではなく、あくまで補助的な提案に使う。
 *
 * 注意：difficultyLevel はこの調査で新たに使う5段階評価であり、
 * 既存の Chapter.metadata.difficultyLevel（3段階）とは尺度が異なる。
 * 実装時にどちらかへ寄せるかは未決定（3→5段階への拡張 or 5→3段階への変換）。
 */

export type CurriculumBlock =
  | "中1"
  | "中2"
  | "中3"
  | "数I"
  | "数A"
  | "数II"
  | "数B"
  | "数III"
  | "数C"
  | "物理基礎"
  | "物理"
  | "化学基礎"
  | "化学"
  | "生物基礎"
  | "生物"
  | "地学基礎"
  | "地学";

export interface CurriculumSubtopic {
  name: string;
  /** 難易度（1: 易しい 〜 5: 難しい） */
  difficultyLevel: 1 | 2 | 3 | 4 | 5;
}

export interface CurriculumChapter {
  name: string;
  subtopics: CurriculumSubtopic[];
}

export interface CurriculumBlockData {
  block: CurriculumBlock;
  subject: "数学" | "理科";
  chapters: CurriculumChapter[];
}
