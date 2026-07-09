import { describe, it, expect } from "vitest";
import {
  studyLevelsForTrack,
  ENGLISH_GRAMMAR_LEVELS,
  ENGLISH_READING_LEVELS,
  STUDY_POLICY_BY_SUBJECT,
} from "./studyPolicy";

describe("studyLevelsForTrack（英語の文法/読解トラック・段階7）", () => {
  const base = STUDY_POLICY_BY_SUBJECT.english!.levels;

  it("track 未設定なら親教科の基本ラダーをそのまま返す", () => {
    expect(studyLevelsForTrack(base, undefined)).toBe(base);
  });

  it("track が grammar なら文法ラダーを返す", () => {
    expect(studyLevelsForTrack(base, "grammar")).toBe(ENGLISH_GRAMMAR_LEVELS);
  });

  it("track が reading なら読解ラダーを返す", () => {
    expect(studyLevelsForTrack(base, "reading")).toBe(ENGLISH_READING_LEVELS);
  });

  it("文法・読解ラダーはどちらも level 1〜5 が順に揃っている", () => {
    for (const ladder of [ENGLISH_GRAMMAR_LEVELS, ENGLISH_READING_LEVELS]) {
      expect(ladder.map((l) => l.level)).toEqual([1, 2, 3, 4, 5]);
      for (const l of ladder) {
        expect(l.achieved).toBeTruthy();
        expect(l.next).toBeTruthy();
      }
    }
  });
});
