// 教科テンプレート・レジストリ（教科の複数登録対応、段階1: 型＋テンプレート基盤のみ）。
// 「教科ごとの振る舞い」（章を持てるか、暗記範囲を持てるか、カリキュラム参考データの対象か、
// 勉強方針ラダー、暗記カードの表示名）を union 型 SubjectTemplateKey に対する1つのレジストリへ
// 集約する。onboarding/onboardingTypes.ts の SubjectKey はこの型の再エクスポートへ寄せていく
// （段階1では consumer 側の SUBJECT_LABELS/SUBJECT_ORDER 等はまだ残す。段階4/5で移設）。
import type { Subject } from "../types";
import type { SubjectStudyPolicy } from "./studyPolicy";
import { STUDY_POLICY_BY_SUBJECT } from "./studyPolicy";

export type SubjectTemplateKey = "math" | "science" | "english" | "social" | "japanese";

export interface SubjectTemplate {
  key: SubjectTemplateKey;
  /** 新規追加時の初期表示名（例：「数学」）。ユーザーは後で自由文字列に変更できる想定（段階5以降） */
  defaultName: string;
  chapterCapable: boolean;
  vocabCapable: boolean;
  /** カリキュラム参考データ（src/data/curriculumSearch.ts）の対象教科。数学・理科のみ */
  curriculumSubject: "数学" | "理科" | null;
  studyPolicy: SubjectStudyPolicy;
  vocabHeading: string;
  vocabItemWord: string;
}

/**
 * 国語の勉強方針ラダーは未整備（docs/feature-study-policy.md で後回しと明記）。
 * STUDY_POLICY_BY_SUBJECT に japanese エントリを追加せず、社会と同じ周回ベースのラダーを
 * 暫定で流用する（型を満たすためだけで、現状 StudyPolicy.tsx の表示順からは除外されている）。
 */
const JAPANESE_STUDY_POLICY: SubjectStudyPolicy = {
  ...STUDY_POLICY_BY_SUBJECT.social!,
  subjectKey: "japanese",
};

export const SUBJECT_TEMPLATES: Record<SubjectTemplateKey, SubjectTemplate> = {
  math: {
    key: "math",
    defaultName: "数学",
    chapterCapable: true,
    vocabCapable: false,
    curriculumSubject: "数学",
    studyPolicy: STUDY_POLICY_BY_SUBJECT.math!,
    vocabHeading: "今日の暗記",
    vocabItemWord: "暗記事項",
  },
  science: {
    key: "science",
    defaultName: "理科",
    chapterCapable: true,
    vocabCapable: false,
    curriculumSubject: "理科",
    studyPolicy: STUDY_POLICY_BY_SUBJECT.science!,
    vocabHeading: "今日の暗記",
    vocabItemWord: "暗記事項",
  },
  english: {
    key: "english",
    defaultName: "英語",
    chapterCapable: true,
    vocabCapable: true,
    curriculumSubject: null,
    studyPolicy: STUDY_POLICY_BY_SUBJECT.english!,
    vocabHeading: "今日の単語",
    vocabItemWord: "単語",
  },
  social: {
    key: "social",
    defaultName: "社会",
    // 社会の chapterCapable を true にするのは段階6（章＋周回カウントへの移行）。段階1では現行どおり false。
    chapterCapable: false,
    vocabCapable: true,
    curriculumSubject: null,
    studyPolicy: STUDY_POLICY_BY_SUBJECT.social!,
    vocabHeading: "今日の重要語",
    vocabItemWord: "重要語",
  },
  japanese: {
    key: "japanese",
    defaultName: "国語",
    chapterCapable: false,
    vocabCapable: true,
    curriculumSubject: null,
    studyPolicy: JAPANESE_STUDY_POLICY,
    vocabHeading: "今日の漢字・古文単語",
    vocabItemWord: "漢字・古文単語",
  },
};

const NAME_TO_TEMPLATE_KEY: Record<string, SubjectTemplateKey> = {
  数学: "math",
  理科: "science",
  英語: "english",
  社会: "social",
  国語: "japanese",
};

/** 正規5教科名からの逆引き。任意の自由教科名（「保健体育」等）は null を返す */
export function reverseNameToTemplateKey(name: string): SubjectTemplateKey | null {
  return NAME_TO_TEMPLATE_KEY[name] ?? null;
}

/**
 * subject.templateKey が未設定の既存データ（正規5教科名のみ）は名前から逆引きし、
 * それでも解決できない場合は社会（章を持たない暗記専用）へフォールバックする。
 */
export function resolveTemplate(subject: Subject): SubjectTemplate {
  const key = subject.templateKey ?? reverseNameToTemplateKey(subject.name) ?? "social";
  return SUBJECT_TEMPLATES[key];
}

/** 達成段階（1〜5）→ 理解度（0.0〜1.0）。4 => 0.8 = logic.ts の DEFAULT_TARGET_UNDERSTANDING と一致 */
export function levelToUnderstanding(level: 1 | 2 | 3 | 4 | 5): number {
  return level / 5;
}
