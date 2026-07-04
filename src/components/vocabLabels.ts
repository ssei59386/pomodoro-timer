// 暗記対応教科ごとの表示名（docs/feature-memorization.md 確定設計v4、ceo方針：
// 「暗記」という抽象語は中高生の語彙感覚とズレるため、教科ごとに専用の呼び方を出し分ける）。
// Home.tsx（今日やることリストの暗記カード）と VocabQuiz.tsx（クイズ画面の見出し・文言）の
// 両方から参照するため、重複定義を避けてここに集約する（logic.ts には置かない＝教科非依存の
// 原則を保つため。ux-reviewer指摘、2026-07-03）。
export const VOCAB_HEADING_BY_SUBJECT: Record<string, string> = {
  英語: "今日の単語",
  社会: "今日の重要語",
  国語: "今日の漢字・古文単語",
};

export const VOCAB_ITEM_WORD_BY_SUBJECT: Record<string, string> = {
  英語: "単語",
  社会: "重要語",
  国語: "漢字・古文単語",
};

/** マップに無い教科（想定外の状態。データ不整合など）向けのフォールバック表示名 */
export const DEFAULT_VOCAB_HEADING = "今日の暗記";
export const DEFAULT_VOCAB_ITEM_WORD = "暗記事項";
