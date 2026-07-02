/**
 * カリキュラム参考データ（数学13ファイル中の1配列＋理科12ファイル）を1つのインデックスに統合し、
 * 章・小項目名の部分一致検索を提供する。
 *
 * 想定用途（未実装・別タスク）：Onboarding/Settings で章・小項目名を入力した際に、
 * この参考データとあいまい一致させて難易度・演習量の初期値候補を提示する（フェーズ3以降）。
 */
import type { CurriculumBlockData } from "./curriculumTypes";
import { mathCurriculumReference } from "./mathCurriculumReference";
import { scienceCh1 } from "./scienceCurriculumReference_ch1";
import { scienceCh2 } from "./scienceCurriculumReference_ch2";
import { scienceCh3 } from "./scienceCurriculumReference_ch3";
import { sciencePhysicsBase } from "./scienceCurriculumReference_physicsBase";
import { sciencePhysics } from "./scienceCurriculumReference_physics";
import { scienceChemistryBase } from "./scienceCurriculumReference_chemistryBase";
import { scienceChemistry } from "./scienceCurriculumReference_chemistry";
import { scienceBiologyBase } from "./scienceCurriculumReference_biologyBase";
import { scienceBiology } from "./scienceCurriculumReference_biology";
import { scienceEarthScienceBase } from "./scienceCurriculumReference_earthScienceBase";
import { scienceEarthScience } from "./scienceCurriculumReference_earthScience";

/** 数学13ブロック＋理科11ブロック（中1〜3・高校8ブロック）を統合した全ブロック一覧 */
export const ALL_CURRICULUM_BLOCKS: CurriculumBlockData[] = [
  ...mathCurriculumReference,
  scienceCh1,
  scienceCh2,
  scienceCh3,
  sciencePhysicsBase,
  sciencePhysics,
  scienceChemistryBase,
  scienceChemistry,
  scienceBiologyBase,
  scienceBiology,
  scienceEarthScienceBase,
  scienceEarthScience,
];

export interface CurriculumSearchResult {
  block: CurriculumBlockData["block"];
  subject: CurriculumBlockData["subject"];
  chapterName: string;
  subtopicName: string;
  difficultyLevel: 1 | 2 | 3 | 4 | 5;
  /** マッチスコア（大きいほど良い一致）。前方一致にボーナス */
  score: number;
}

interface FlatEntry {
  block: CurriculumBlockData["block"];
  subject: CurriculumBlockData["subject"];
  chapterName: string;
  subtopicName: string;
  difficultyLevel: 1 | 2 | 3 | 4 | 5;
  normalizedName: string;
}

/**
 * 漢数字（一〜九）→算用数字の変換マップ。
 * カリキュラム参考データ自体に表記ゆれがある（中学ブロックは「一次関数」「二次方程式」のように
 * 漢数字、高校数Iブロックは「2次関数」のように算用数字で登録されている）ため、
 * データファイル群は変更せず、正規化側で吸収する。
 */
const KANJI_DIGIT_MAP: Record<string, string> = {
  一: "1",
  二: "2",
  三: "3",
  四: "4",
  五: "5",
  六: "6",
  七: "7",
  八: "8",
  九: "9",
};

/**
 * 「十」「百」「千」などの位取りを含む変換は対象外（意図的にスコープ外）。
 * 「十分」のような数詞以外の熟語を誤変換するリスクの方が大きいため、
 * 「二次関数」「三平方の定理」のように常に単一桁の漢数字を使う章名・小項目名のみを対象とする。
 */
function convertKanjiDigits(text: string): string {
  return text.replace(/[一二三四五六七八九]/g, (ch) => KANJI_DIGIT_MAP[ch] ?? ch);
}

/**
 * 全角/半角・大小文字・空白揺れ・漢数字/算用数字の揺れを吸収する正規化。
 * NFKC で全角英数・記号を半角化し、空白を除去、大文字を小文字化し、漢数字を算用数字に変換する。
 */
function normalize(text: string): string {
  return convertKanjiDigits(text.normalize("NFKC").replace(/\s+/g, "").toLowerCase());
}

let flatIndexCache: FlatEntry[] | null = null;

/** モジュールスコープでメモ化したフラットインデックスを構築する */
function buildFlatIndex(): FlatEntry[] {
  if (flatIndexCache) return flatIndexCache;
  const entries: FlatEntry[] = [];
  for (const block of ALL_CURRICULUM_BLOCKS) {
    for (const chapter of block.chapters) {
      for (const subtopic of chapter.subtopics) {
        entries.push({
          block: block.block,
          subject: block.subject,
          chapterName: chapter.name,
          subtopicName: subtopic.name,
          difficultyLevel: subtopic.difficultyLevel,
          normalizedName: normalize(subtopic.name),
        });
      }
    }
  }
  flatIndexCache = entries;
  return entries;
}

export interface SearchCurriculumSubtopicsOptions {
  subject?: "数学" | "理科";
  limit?: number;
}

/**
 * 小項目名の部分一致検索。
 * 前方一致は後方一致よりスコアが高い。該当なしなら空配列を返す。
 */
export function searchCurriculumSubtopics(
  query: string,
  options: SearchCurriculumSubtopicsOptions = {},
): CurriculumSearchResult[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const index = buildFlatIndex();
  const matches: CurriculumSearchResult[] = [];

  for (const entry of index) {
    if (options.subject && entry.subject !== options.subject) continue;
    const matchIndex = entry.normalizedName.indexOf(normalizedQuery);
    if (matchIndex === -1) continue;
    const score = matchIndex === 0 ? 2 : 1;
    matches.push({
      block: entry.block,
      subject: entry.subject,
      chapterName: entry.chapterName,
      subtopicName: entry.subtopicName,
      difficultyLevel: entry.difficultyLevel,
      score,
    });
  }

  matches.sort((a, b) => b.score - a.score);

  const limit = options.limit ?? matches.length;
  return matches.slice(0, limit);
}
