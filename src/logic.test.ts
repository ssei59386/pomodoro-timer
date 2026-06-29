import { describe, expect, it } from "vitest";
import {
  computeObserved,
  updateUnderstanding,
  selfReportToInitialUnderstanding,
  daysLeft,
  proximity,
  priority,
  generateTodayPlan,
  applySessionToChapter,
} from "./logic";
import type { Chapter, StudySession, Subject } from "./types";

const today = new Date(2026, 5, 29); // 2026-06-29

function chapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: "c1",
    subjectId: "s1",
    name: "二次関数",
    pointWeight: 20,
    understanding: 0.4,
    targetUnderstanding: 0.8,
    lastStudiedDate: null,
    ...overrides,
  };
}

describe("§6.1 理解度の更新", () => {
  it("observed は 0.7×正答率 + 0.3×(自己申告/5)", () => {
    // 0.7*0.8 + 0.3*(4/5) = 0.56 + 0.24 = 0.8
    expect(computeObserved(0.8, 4)).toBeCloseTo(0.8);
  });

  it("平滑化 α=0.5 で旧値と観測値の中点になる", () => {
    expect(updateUnderstanding(0.4, 0.8)).toBeCloseTo(0.6);
  });

  it("理解度は 0〜1 にクランプされる", () => {
    expect(updateUnderstanding(1, 2)).toBeLessThanOrEqual(1);
    expect(updateUnderstanding(0, -1)).toBeGreaterThanOrEqual(0);
  });

  it("自己申告（5段階）を初期理解度にマップする", () => {
    expect(selfReportToInitialUnderstanding(3)).toBeCloseTo(0.6);
    expect(selfReportToInitialUnderstanding(5)).toBeCloseTo(1);
  });
});

describe("§6.2 優先度スコア", () => {
  it("残り日数は最低1日", () => {
    expect(daysLeft("2026-06-29", today)).toBe(1);
    expect(daysLeft("2020-01-01", today)).toBe(1);
  });

  it("テストが近いほど proximity が大きい", () => {
    const near = proximity("2026-07-01", today); // 2日
    const far = proximity("2026-07-29", today); // 30日
    expect(near).toBeGreaterThan(far);
  });

  it("ギャップが負（目標到達済み）の章は priority 0 にクランプ", () => {
    const subject: Subject = { id: "s1", name: "数学", testDate: "2026-07-09" };
    const done = chapter({ understanding: 0.9, targetUnderstanding: 0.8 });
    expect(priority(done, subject, today)).toBe(0);
  });

  it("配点が高いほど priority が高い", () => {
    const subject: Subject = { id: "s1", name: "数学", testDate: "2026-07-09" };
    const low = priority(chapter({ pointWeight: 10 }), subject, today);
    const high = priority(chapter({ pointWeight: 40 }), subject, today);
    expect(high).toBeGreaterThan(low);
  });
});

describe("§6.3 計画生成（貪欲法・1章集中）", () => {
  const subjects: Subject[] = [
    { id: "s1", name: "数学", testDate: "2026-07-03" },
    { id: "s2", name: "理科", testDate: "2026-07-20" },
  ];
  const chapters: Chapter[] = [
    chapter({ id: "a", subjectId: "s1", pointWeight: 40, understanding: 0.3 }),
    chapter({ id: "b", subjectId: "s2", pointWeight: 20, understanding: 0.5 }),
    chapter({ id: "c", subjectId: "s1", pointWeight: 10, understanding: 0.75 }),
  ];

  it("優先度の高い順に章を割り当てる", () => {
    const plan = generateTodayPlan(chapters, subjects, 120, today);
    expect(plan[0].chapter.id).toBe("a"); // 配点高・理解度低・テスト近
  });

  it("dailyMinutes を超えて割り当てない", () => {
    const plan = generateTodayPlan(chapters, subjects, 60, today);
    const total = plan.reduce((sum, p) => sum + p.allocatedMinutes, 0);
    expect(total).toBeLessThanOrEqual(60);
  });

  it("目標到達済み（priority 0）の章は計画に入らない", () => {
    const allDone = chapters.map((c) => ({ ...c, understanding: 0.9 }));
    const plan = generateTodayPlan(allDone, subjects, 120, today);
    expect(plan).toHaveLength(0);
  });
});

describe("applySessionToChapter", () => {
  it("セッション適用で理解度が更新され、最終学習日が入る", () => {
    const c = chapter({ understanding: 0.4 });
    const session: StudySession = {
      id: "x",
      chapterId: "c1",
      date: "2026-06-29",
      minutes: 45,
      correctRate: 0.8,
      selfReport: 4,
    };
    const updated = applySessionToChapter(c, session);
    // observed=0.8, new=0.5*0.8+0.5*0.4=0.6
    expect(updated.understanding).toBeCloseTo(0.6);
    expect(updated.lastStudiedDate).toBe("2026-06-29");
  });
});
