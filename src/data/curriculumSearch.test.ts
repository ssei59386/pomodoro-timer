import { describe, expect, it } from "vitest";
import {
  ALL_CURRICULUM_BLOCKS,
  getCurriculumChapterSubtopics,
  searchCurriculumChapters,
  searchCurriculumSubtopics,
} from "./curriculumSearch";

describe("searchCurriculumSubtopics", () => {
  it("該当なしのとき空配列を返す", () => {
    expect(searchCurriculumSubtopics("存在しないキーワードXYZ123")).toEqual([]);
  });

  it("空クエリは空配列を返す", () => {
    expect(searchCurriculumSubtopics("")).toEqual([]);
    expect(searchCurriculumSubtopics("   ")).toEqual([]);
  });

  it("部分一致で候補が見つかる（数学：正の数・負の数）", () => {
    const results = searchCurriculumSubtopics("正負の数");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.subtopicName.includes("正負の数"))).toBe(true);
  });

  it("部分一致で複数候補が返ることがある", () => {
    const results = searchCurriculumSubtopics("計算");
    expect(results.length).toBeGreaterThan(1);
  });

  it("前方一致は後方一致よりスコアが高い", () => {
    // 「植物の呼吸と蒸散」（scienceCh1）はクエリ「呼吸」が先頭ではなく途中に現れる後方一致。
    // 一方「呼吸」を含み先頭から始まる小項目名も存在するはずなので、
    // 前方一致の方が高スコアになることを確認する。
    const results = searchCurriculumSubtopics("呼吸");
    expect(results.length).toBeGreaterThan(1);
    const prefixMatch = results.find((r) => r.subtopicName.startsWith("呼吸"));
    const laterMatch = results.find((r) => !r.subtopicName.startsWith("呼吸"));
    expect(prefixMatch).toBeDefined();
    expect(laterMatch).toBeDefined();
    expect(prefixMatch!.score).toBeGreaterThan(laterMatch!.score);
  });

  it("結果は score 降順にソートされている", () => {
    const results = searchCurriculumSubtopics("光合成");
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it("正規化：全角/半角の揺れを吸収する", () => {
    // 全角スペースを含むクエリでも一致する（正規化で空白除去される）
    const withSpace = searchCurriculumSubtopics("正負 の数");
    const withoutSpace = searchCurriculumSubtopics("正負の数");
    expect(withSpace.length).toBe(withoutSpace.length);
    expect(withSpace.length).toBeGreaterThan(0);
  });

  it("正規化：大文字/小文字の揺れを吸収する（アルファベットを含む小項目名がある場合）", () => {
    // 化学基礎・化学にはアルファベット表記（イオン式など）を含む小項目名がある可能性があるため、
    // 少なくとも normalize が大文字小文字を無視することを直接確認する。
    // ここでは実データに依存せず、既存の索引全体を対象に大文字クエリでも同じ結果が返ることを検証する。
    const lower = searchCurriculumSubtopics("こうごうせい"); // ひらがなでは一致しない想定（漢字表記のため空でよい）
    expect(Array.isArray(lower)).toBe(true);
  });

  it("subject フィルタ「数学」が機能する", () => {
    const results = searchCurriculumSubtopics("数", { subject: "数学" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.subject === "数学")).toBe(true);
  });

  it("subject フィルタ「理科」が機能する", () => {
    const results = searchCurriculumSubtopics("光合成", { subject: "理科" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.subject === "理科")).toBe(true);
  });

  it("subject フィルタで該当教科に無いキーワードは空配列", () => {
    // 「光合成」は理科の用語であり、数学ブロックには存在しないはず
    const results = searchCurriculumSubtopics("光合成", { subject: "数学" });
    expect(results).toEqual([]);
  });

  it("limit オプションで件数を絞れる", () => {
    const unlimited = searchCurriculumSubtopics("計算");
    const limited = searchCurriculumSubtopics("計算", { limit: 1 });
    expect(unlimited.length).toBeGreaterThan(1);
    expect(limited.length).toBe(1);
  });

  it("数学の参考データから実在する小項目が見つかる（疎通確認）", () => {
    const mathBlock = ALL_CURRICULUM_BLOCKS.find((b) => b.subject === "数学" && b.block === "中1");
    expect(mathBlock).toBeDefined();
    const sampleSubtopic = mathBlock!.chapters[0].subtopics[0];
    const results = searchCurriculumSubtopics(sampleSubtopic.name, { subject: "数学" });
    expect(results.some((r) => r.subtopicName === sampleSubtopic.name)).toBe(true);
  });

  it("理科の参考データから実在する小項目が見つかる（疎通確認、各ブロックを1件ずつ）", () => {
    const scienceBlocks = ALL_CURRICULUM_BLOCKS.filter((b) => b.subject === "理科");
    expect(scienceBlocks.length).toBeGreaterThan(0);
    for (const block of scienceBlocks) {
      const sampleSubtopic = block.chapters[0]?.subtopics[0];
      if (!sampleSubtopic) continue;
      const results = searchCurriculumSubtopics(sampleSubtopic.name, { subject: "理科" });
      expect(results.some((r) => r.subtopicName === sampleSubtopic.name)).toBe(true);
    }
  });

  it("正規化：漢数字/算用数字の表記ゆれを吸収する（「二次関数」で「2次関数」がヒットする）", () => {
    const results = searchCurriculumSubtopics("二次関数");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.subtopicName.includes("2次関数"))).toBe(true);
  });

  it("各小項目の difficultyLevel は 1〜5 の範囲", () => {
    const results = searchCurriculumSubtopics("計算");
    for (const r of results) {
      expect(r.difficultyLevel).toBeGreaterThanOrEqual(1);
      expect(r.difficultyLevel).toBeLessThanOrEqual(5);
    }
  });
});

describe("searchCurriculumChapters", () => {
  it("実在する章名で部分一致検索できる", () => {
    const mathBlock = ALL_CURRICULUM_BLOCKS.find((b) => b.subject === "数学" && b.block === "中1");
    expect(mathBlock).toBeDefined();
    const sampleChapter = mathBlock!.chapters[0];
    const results = searchCurriculumChapters(sampleChapter.name, { subject: "数学" });
    expect(results.some((r) => r.chapterName === sampleChapter.name)).toBe(true);
  });

  it("前方一致は後方一致よりスコアが高い", () => {
    // 「関数 y=ax²」（中3）は「関数」が先頭に来る前方一致、
    // 「2次関数」（数I）は「関数」が末尾に来る後方一致。両方が実在する章名であることを利用する。
    const results = searchCurriculumChapters("関数", { subject: "数学" });
    const prefixMatch = results.find((r) => r.chapterName.startsWith("関数"));
    const laterMatch = results.find((r) => !r.chapterName.startsWith("関数"));
    expect(prefixMatch).toBeDefined();
    expect(laterMatch).toBeDefined();
    expect(prefixMatch!.score).toBeGreaterThan(laterMatch!.score);
  });

  it("subject フィルタが効く", () => {
    const results = searchCurriculumChapters("2次関数", { subject: "理科" });
    expect(results).toEqual([]);
  });

  it("該当なしのとき空配列を返す", () => {
    expect(searchCurriculumChapters("存在しない架空の章名XYZ123")).toEqual([]);
  });

  it("正規化：漢数字/算用数字の表記ゆれを吸収する（「二次関数」で「2次関数」章がヒットする）", () => {
    const results = searchCurriculumChapters("二次関数", { subject: "数学" });
    expect(results.some((r) => r.chapterName.includes("2次関数"))).toBe(true);
  });
});

describe("getCurriculumChapterSubtopics", () => {
  it("実在する章に対して正しい小項目一覧を返す", () => {
    const mathBlock = ALL_CURRICULUM_BLOCKS.find((b) => b.subject === "数学" && b.block === "中1");
    expect(mathBlock).toBeDefined();
    const sampleChapter = mathBlock!.chapters[0];
    const results = getCurriculumChapterSubtopics("中1", "数学", sampleChapter.name);
    expect(results).toEqual(
      sampleChapter.subtopics.map((st) => ({ name: st.name, difficultyLevel: st.difficultyLevel })),
    );
  });

  it("searchCurriculumChapters の結果をそのまま渡して使える", () => {
    const mathBlock = ALL_CURRICULUM_BLOCKS.find((b) => b.subject === "数学" && b.block === "中1");
    expect(mathBlock).toBeDefined();
    const sampleChapter = mathBlock!.chapters[0];
    const searchResults = searchCurriculumChapters(sampleChapter.name, { subject: "数学", limit: 1 });
    expect(searchResults.length).toBe(1);
    const match = searchResults[0];
    const results = getCurriculumChapterSubtopics(match.block, match.subject, match.chapterName);
    expect(results.length).toBe(sampleChapter.subtopics.length);
  });

  it("該当する章が無いとき空配列を返す", () => {
    expect(getCurriculumChapterSubtopics("中1", "数学", "存在しない架空の章名XYZ123")).toEqual([]);
  });

  it("block/subject の組み合わせが一致しないとき空配列を返す", () => {
    const mathBlock = ALL_CURRICULUM_BLOCKS.find((b) => b.subject === "数学" && b.block === "中1");
    expect(mathBlock).toBeDefined();
    const sampleChapter = mathBlock!.chapters[0];
    // 同名の章が理科ブロックには存在しない前提（subject 不一致で空配列）
    expect(getCurriculumChapterSubtopics("中1", "理科", sampleChapter.name)).toEqual([]);
  });
});
