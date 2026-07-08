// 勉強方針・後悔防止トリガー機能（docs/feature-study-policy.md Phase 1）。
// 理解度の各段階が何を意味し、次に何をすればよいかを教科ごとに1つの情報源として持つ。
// 「勉強方針」画面（src/components/StudyPolicy.tsx）はこのデータを表示するだけで、
// 判定ロジック（3日連続トリガー等）はここには置かない（Phase 2、logic.ts 側）。
import type { SubjectTemplateKey } from "./subjectTemplates";

/** 理解度の1段階（1〜5）。既存の 0.0〜1.0 スケールに 0.2 刻みで対応する（理解度4 = 0.8 = DEFAULT_TARGET_UNDERSTANDING） */
export interface UnderstandingLevel {
  level: 1 | 2 | 3 | 4 | 5;
  /** その段階まで達成したこと */
  achieved: string;
  /** 次の段階に進むためにやること */
  next: string;
}

export interface SubjectStudyPolicy {
  subjectKey: SubjectTemplateKey;
  levels: UnderstandingLevel[];
  /** 教科固有の補足説明（英語の単語/文法・読解トラックの説明など） */
  extraNote?: string;
}

/**
 * 数学・理科共通の理解度ラダー。「どれだけ時間をかけてもいいから、各段階を完璧にしてから
 * 次の段階へ」進む前提（docs/feature-study-policy.md「決定事項」1.）。
 */
const MATH_SCIENCE_LEVELS: UnderstandingLevel[] = [
  { level: 1, achieved: "まだ手つかず", next: "教科書の公式・例題を理解する" },
  { level: 2, achieved: "公式・例題を理解した", next: "教科書の基本練習問題を解く" },
  { level: 3, achieved: "基本練習問題が完璧に解ける", next: "ワークの基本問題を解く" },
  {
    level: 4,
    achieved: "ワークの基本問題が解ける（2回反復済み・次の章に進んでOK）",
    next: "発展問題に挑戦する",
  },
  { level: 5, achieved: "発展問題が解ける", next: "維持・応用（他の単元にも時間を回してOK）" },
];

/**
 * 社会は周回ベースで理解度を決める（docs/feature-study-policy.md「決定事項」1.社会）。
 * 1周=理解度2、2周=理解度3、3周=理解度4。ちょうど3周までしか決定事項に明記が無いため、
 * 1（着手前）と5（3周後の維持）は数学・理科と同じ枠組みに合わせて自然な形で補っている。
 */
const SOCIAL_LEVELS: UnderstandingLevel[] = [
  { level: 1, achieved: "まだ手つかず（0周）", next: "ワークを1周解く" },
  { level: 2, achieved: "ワークを1周終えた", next: "間違えたところを中心に、もう1周解き直す" },
  { level: 3, achieved: "ワークを2周終えた", next: "3周目で仕上げる" },
  { level: 4, achieved: "ワークを3周終えた（次の章に進んでOK）", next: "維持・応用（他の単元にも時間を回してOK）" },
  { level: 5, achieved: "十分に定着している", next: "維持・応用" },
];

const ENGLISH_EXTRA_NOTE =
  "英単語はこの理解度ラダーの対象外です。既存の暗記システム（Leitner方式の復習）にそのまま任せてください。" +
  "また、文法と読解が教材上はっきり分かれている場合は、章の中で「文法」「読解」を別の小項目として登録できます。" +
  "読解はテスト範囲の長文をいくつかに等分し、1本を完璧に訳せるごとに1段階進みます。" +
  "文法は教科書の理解（半分で理解度2、全部で理解度3）と、文法ワークを3回解けるようになったら理解度4、という基準です。" +
  "文法と読解が分かれていない教材なら、精読（全文を訳せる）と文法ワーク完了の両方で理解度4とみなしてください。";

export const STUDY_POLICY_BY_SUBJECT: Partial<Record<SubjectTemplateKey, SubjectStudyPolicy>> = {
  math: { subjectKey: "math", levels: MATH_SCIENCE_LEVELS },
  science: { subjectKey: "science", levels: MATH_SCIENCE_LEVELS },
  english: { subjectKey: "english", levels: MATH_SCIENCE_LEVELS, extraNote: ENGLISH_EXTRA_NOTE },
  social: { subjectKey: "social", levels: SOCIAL_LEVELS },
};

/** 「勉強方針」画面に表示する順序。国語は理解度ラダーの整理が後回し（docs/feature-study-policy.md）のため対象外 */
export const STUDY_POLICY_SUBJECT_ORDER: SubjectTemplateKey[] = ["math", "science", "english", "social"];

/**
 * 後悔防止トリガーの説明（docs/feature-study-policy.md「この機能が解決したい本当の課題」
 * 「2. 後悔防止トリガー」を、学習者向けにやさしくかみ砕いた短い箇条書き）。
 * 元は約350字の一段落だったが、最重要説明が最も目立たない表示になっていたため
 * 箇条書きに再構成した（ux-reviewer指摘）。中身の意味は変えていない。
 */
export const REGRET_PREVENTION_TRIGGER_POINTS: string[] = [
  "テストが終わったあとに「この単元にもっと時間をかけていれば…」と後悔するのを防ぐ仕組みです。",
  "数学・理科・英語は、どれだけ時間をかけてもいいので、各段階を完璧にしてから次に進んでOKです。",
  "ただし3日連続で「このペースだと間に合わなそう」という判定になった時だけ、アプリから声をかけます。",
  "そのとき「このまま続ける」か「覚えるモードに切り替える」かを自分で選べます。続けるを選べば数日は再確認しません。",
];
