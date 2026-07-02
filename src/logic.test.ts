import { describe, expect, it } from "vitest";
import {
  computeObserved,
  updateUnderstanding,
  selfReportToInitialUnderstanding,
  computeInitialUnderstanding,
  averageInitialUnderstanding,
  daysLeft,
  proximity,
  priority,
  generateTodayPlan,
  applySessionToChapter,
  slotMinutes,
  availableMinutesForDate,
  decayedUnderstanding,
  isValidTimeSlot,
  isPastDate,
  subtopicPointWeights,
  decayedSubtopicUnderstanding,
  subtopicPriority,
  scoreChapterOrSubtopics,
  estimateSubtopicRemainingMinutes,
  CONCEPT_LEARNING_COST_MINUTES,
  MINUTES_PER_BASIC_PROBLEM,
  MINUTES_PER_ADVANCED_PROBLEM,
} from "./logic";
import type { AvailabilitySettings, Chapter, ChapterSubtopic, StudySession, Subject } from "./types";

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

function subtopic(overrides: Partial<ChapterSubtopic> = {}): ChapterSubtopic {
  return {
    id: "st1",
    name: "因数分解",
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

  it("computeInitialUnderstanding: 正答率が無ければ自己申告のみと同じ結果", () => {
    expect(computeInitialUnderstanding(3)).toBeCloseTo(selfReportToInitialUnderstanding(3));
    expect(computeInitialUnderstanding(5)).toBeCloseTo(selfReportToInitialUnderstanding(5));
  });

  it("computeInitialUnderstanding: 正答率があれば 0.7×正答率 + 0.3×(自己申告/5) で合成する", () => {
    // 0.7*0.8 + 0.3*(4/5) = 0.56 + 0.24 = 0.8
    expect(computeInitialUnderstanding(4, 0.8)).toBeCloseTo(0.8);
  });

  it("computeInitialUnderstanding は 0〜1 にクランプされる", () => {
    expect(computeInitialUnderstanding(5, 1)).toBeLessThanOrEqual(1);
    expect(computeInitialUnderstanding(1, 0)).toBeGreaterThanOrEqual(0);
  });

  it("averageInitialUnderstanding: 1個だけなら selfReportToInitialUnderstanding と同じ結果", () => {
    expect(averageInitialUnderstanding([5])).toBeCloseTo(selfReportToInitialUnderstanding(5));
    expect(averageInitialUnderstanding([1])).toBeCloseTo(selfReportToInitialUnderstanding(1));
  });

  it("averageInitialUnderstanding: 複数の自己申告を平均する", () => {
    const expected =
      (selfReportToInitialUnderstanding(1) + selfReportToInitialUnderstanding(5)) / 2;
    expect(averageInitialUnderstanding([1, 5])).toBeCloseTo(expected);
  });

  it("averageInitialUnderstanding は 0〜1 にクランプされる", () => {
    expect(averageInitialUnderstanding([5, 5, 5])).toBeLessThanOrEqual(1);
    expect(averageInitialUnderstanding([1, 1, 1])).toBeGreaterThanOrEqual(0);
  });
});

describe("忘却曲線（decayedUnderstanding）", () => {
  it("未学習（lastStudiedDate: null）なら understanding をそのまま返す", () => {
    const c = chapter({ understanding: 0.6, lastStudiedDate: null });
    expect(decayedUnderstanding(c, today)).toBeCloseTo(0.6);
    expect(decayedUnderstanding(c, new Date(2030, 0, 1))).toBeCloseTo(0.6);
  });

  it("ちょうど半減期（21日）経過で理解度が半分になる", () => {
    const c = chapter({ understanding: 0.8, lastStudiedDate: "2026-06-08" }); // today から21日前
    expect(decayedUnderstanding(c, today)).toBeCloseTo(0.4);
  });

  it("学習当日（経過0日）は減衰しない", () => {
    const c = chapter({ understanding: 0.8, lastStudiedDate: "2026-06-29" });
    expect(decayedUnderstanding(c, today)).toBeCloseTo(0.8);
  });

  it("半減期2回分（42日）経過で理解度が1/4になる", () => {
    const c = chapter({ understanding: 0.8, lastStudiedDate: "2026-05-18" }); // today から42日前
    expect(decayedUnderstanding(c, today)).toBeCloseTo(0.2);
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

describe("曜日ごとの空き時間", () => {
  it("slotMinutes は時間帯の長さ（分）を返す", () => {
    expect(slotMinutes({ start: "16:00", end: "17:30" })).toBe(90);
  });

  it("逆転した時間帯（終了が開始より前）は0分", () => {
    expect(slotMinutes({ start: "17:00", end: "16:00" })).toBe(0);
  });

  it("availableMinutesForDate は今日の曜日の時間帯を合計する", () => {
    const dow = today.getDay();
    const availability: AvailabilitySettings = {
      weeklySchedule: {
        [dow]: [
          { start: "16:00", end: "17:00" },
          { start: "19:00", end: "20:30" },
        ],
      },
      dateOverrides: {},
    };
    expect(availableMinutesForDate(availability, today)).toBe(150);
  });

  it("予定が無い曜日は0分", () => {
    const availability: AvailabilitySettings = { weeklySchedule: {}, dateOverrides: {} };
    expect(availableMinutesForDate(availability, today)).toBe(0);
  });

  it("dateOverrides がある日は曜日設定より優先される", () => {
    const dow = today.getDay();
    const iso = "2026-06-29";
    const availability: AvailabilitySettings = {
      weeklySchedule: { [dow]: [{ start: "16:00", end: "17:00" }] },
      dateOverrides: { [iso]: [{ start: "09:00", end: "12:00" }] },
    };
    expect(availableMinutesForDate(availability, today)).toBe(180);
  });

  it("dateOverrides が空配列なら、その日は曜日設定があっても0分", () => {
    const dow = today.getDay();
    const iso = "2026-06-29";
    const availability: AvailabilitySettings = {
      weeklySchedule: { [dow]: [{ start: "16:00", end: "17:00" }] },
      dateOverrides: { [iso]: [] },
    };
    expect(availableMinutesForDate(availability, today)).toBe(0);
  });

  it("isValidTimeSlot は正しい時間幅なら true", () => {
    expect(isValidTimeSlot({ start: "16:00", end: "17:00" })).toBe(true);
  });

  it("isValidTimeSlot は逆転した時間帯で false", () => {
    expect(isValidTimeSlot({ start: "17:00", end: "16:00" })).toBe(false);
  });

  it("isValidTimeSlot は開始と終了が同じで false（0分）", () => {
    expect(isValidTimeSlot({ start: "16:00", end: "16:00" })).toBe(false);
  });
});

describe("isPastDate", () => {
  it("今日より前の日付は true", () => {
    expect(isPastDate("2026-06-28", today)).toBe(true);
  });

  it("今日と同じ日付は false", () => {
    expect(isPastDate("2026-06-29", today)).toBe(false);
  });

  it("未来の日付は false", () => {
    expect(isPastDate("2026-06-30", today)).toBe(false);
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

describe("小項目単位の優先度スコア", () => {
  const subject: Subject = { id: "s1", name: "数学", testDate: "2026-07-09" };

  describe("subtopicPointWeights", () => {
    it("小項目が無い/空の章は空の Map を返す", () => {
      const c = chapter({ pointWeight: 20 });
      expect(subtopicPointWeights(c).size).toBe(0);
      expect(subtopicPointWeights(chapter({ pointWeight: 20, subtopics: [] })).size).toBe(0);
    });

    it("複数の小項目に均等按分し、合計が chapter.pointWeight と一致する", () => {
      const subtopics = [subtopic({ id: "a" }), subtopic({ id: "b" }), subtopic({ id: "c" })];
      const c = chapter({ pointWeight: 30, subtopics });
      const weights = subtopicPointWeights(c);
      expect(weights.get("a")).toBeCloseTo(10);
      expect(weights.get("b")).toBeCloseTo(10);
      expect(weights.get("c")).toBeCloseTo(10);
      const total = [...weights.values()].reduce((sum, v) => sum + v, 0);
      expect(total).toBeCloseTo(c.pointWeight);
    });
  });

  describe("decayedSubtopicUnderstanding", () => {
    it("understanding 未設定なら 0 として扱う", () => {
      const st = subtopic({ understanding: undefined, lastStudiedDate: null });
      expect(decayedSubtopicUnderstanding(st, today)).toBe(0);
    });

    it("lastStudiedDate 未設定なら understanding をそのまま返す（減衰しない）", () => {
      const st = subtopic({ understanding: 0.6, lastStudiedDate: null });
      expect(decayedSubtopicUnderstanding(st, today)).toBeCloseTo(0.6);
    });

    it("章版 decayedUnderstanding と同じ半減期の挙動になる（21日でちょうど半分）", () => {
      const st = subtopic({ understanding: 0.8, lastStudiedDate: "2026-06-08" }); // today から21日前
      const c = chapter({ understanding: 0.8, lastStudiedDate: "2026-06-08" });
      expect(decayedSubtopicUnderstanding(st, today)).toBeCloseTo(decayedUnderstanding(c, today));
      expect(decayedSubtopicUnderstanding(st, today)).toBeCloseTo(0.4);
    });

    it("学習当日（経過0日）は減衰しない", () => {
      const st = subtopic({ understanding: 0.8, lastStudiedDate: "2026-06-29" });
      expect(decayedSubtopicUnderstanding(st, today)).toBeCloseTo(0.8);
    });
  });

  describe("subtopicPriority", () => {
    it("按分weight × 伸びしろ × 近さ で計算される", () => {
      const subtopics = [subtopic({ id: "a" }), subtopic({ id: "b" })];
      const c = chapter({ pointWeight: 20, targetUnderstanding: 0.8, subtopics });
      const st = { ...subtopics[0], understanding: 0.4, lastStudiedDate: null };
      const score = subtopicPriority(c, st, subject, today);
      const expected = 10 * Math.max(0.8 - 0.4, 0) * proximity(subject.testDate, today);
      expect(score).toBeCloseTo(expected);
    });

    it("targetUnderstanding は小項目側の値があれば優先する", () => {
      const subtopics = [subtopic({ id: "a" })];
      const c = chapter({ pointWeight: 20, targetUnderstanding: 0.8, subtopics });
      const st = { ...subtopics[0], understanding: 0.5, targetUnderstanding: 0.6, lastStudiedDate: null };
      const score = subtopicPriority(c, st, subject, today);
      const expected = 20 * Math.max(0.6 - 0.5, 0) * proximity(subject.testDate, today);
      expect(score).toBeCloseTo(expected);
    });

    it("understanding/lastStudiedDate 未設定の小項目でもクラッシュせず計算できる", () => {
      const subtopics = [subtopic({ id: "a" })];
      const c = chapter({ pointWeight: 20, targetUnderstanding: 0.8, subtopics });
      expect(() => subtopicPriority(c, subtopics[0], subject, today)).not.toThrow();
      const score = subtopicPriority(c, subtopics[0], subject, today);
      // understanding未設定 -> 0扱い、gap = 0.8
      const expected = 20 * 0.8 * proximity(subject.testDate, today);
      expect(score).toBeCloseTo(expected);
    });

    it("目標到達済み（gap負）の小項目は0にクランプ", () => {
      const subtopics = [subtopic({ id: "a" })];
      const c = chapter({ pointWeight: 20, targetUnderstanding: 0.8, subtopics });
      const st = { ...subtopics[0], understanding: 0.9, lastStudiedDate: null };
      expect(subtopicPriority(c, st, subject, today)).toBe(0);
    });
  });

  describe("scoreChapterOrSubtopics", () => {
    it("小項目を持たない章は既存 priority() と同じスコアを1件返す（デュアルパスの後方互換）", () => {
      const c = chapter({ pointWeight: 20, understanding: 0.4, targetUnderstanding: 0.8 });
      const items = scoreChapterOrSubtopics(c, subject, today);
      expect(items).toHaveLength(1);
      expect(items[0].subtopic).toBeNull();
      expect(items[0].chapter).toBe(c);
      expect(items[0].score).toBeCloseTo(priority(c, subject, today));
    });

    it("空配列の subtopics も章レベル扱いになる", () => {
      const c = chapter({ subtopics: [] });
      const items = scoreChapterOrSubtopics(c, subject, today);
      expect(items).toHaveLength(1);
      expect(items[0].subtopic).toBeNull();
    });

    it("小項目がある章は小項目数分のスコアを返す", () => {
      const subtopics = [
        subtopic({ id: "a", understanding: 0.3, lastStudiedDate: null }),
        subtopic({ id: "b", understanding: 0.7, lastStudiedDate: null }),
      ];
      const c = chapter({ pointWeight: 20, targetUnderstanding: 0.8, subtopics });
      const items = scoreChapterOrSubtopics(c, subject, today);
      expect(items).toHaveLength(2);
      expect(items.every((i) => i.subtopic !== null)).toBe(true);
      expect(items[0].score).toBeCloseTo(subtopicPriority(c, subtopics[0], subject, today));
      expect(items[1].score).toBeCloseTo(subtopicPriority(c, subtopics[1], subject, today));
    });
  });
});

describe("小項目の所要時間見積もり（estimateSubtopicRemainingMinutes）", () => {
  it("理解度が0.2未満のときだけ概念学習コストが乗る", () => {
    const low = subtopic({ understanding: 0.1, lastStudiedDate: null });
    const high = subtopic({ understanding: 0.5, lastStudiedDate: null });
    expect(estimateSubtopicRemainingMinutes(low, today).conceptMinutes).toBe(CONCEPT_LEARNING_COST_MINUTES);
    expect(estimateSubtopicRemainingMinutes(high, today).conceptMinutes).toBe(0);
  });

  it("understanding 未設定（0扱い）なら概念学習コストが乗る", () => {
    const st = subtopic({ understanding: undefined, lastStudiedDate: null });
    expect(estimateSubtopicRemainingMinutes(st, today).conceptMinutes).toBe(CONCEPT_LEARNING_COST_MINUTES);
  });

  it("基礎/発展の問題数 × 理解度ギャップ(remainingRatio) で時間が計算される", () => {
    const st = subtopic({ understanding: 0.5, lastStudiedDate: null, basicProblems: 10, advancedProblems: 4 });
    const estimate = estimateSubtopicRemainingMinutes(st, today);
    const remainingRatio = 0.5; // 1 - 0.5
    expect(estimate.basicMinutes).toBeCloseTo(10 * MINUTES_PER_BASIC_PROBLEM * remainingRatio);
    expect(estimate.advancedMinutes).toBeCloseTo(4 * MINUTES_PER_ADVANCED_PROBLEM * remainingRatio);
    expect(estimate.totalMinutes).toBeCloseTo(estimate.conceptMinutes + estimate.basicMinutes + estimate.advancedMinutes);
  });

  it("問題数が未設定なら基礎/発展の時間は0", () => {
    const st = subtopic({ understanding: 0.5, lastStudiedDate: null });
    const estimate = estimateSubtopicRemainingMinutes(st, today);
    expect(estimate.basicMinutes).toBe(0);
    expect(estimate.advancedMinutes).toBe(0);
  });

  it("理解度が高いほど残り時間が短くなる（同じ問題数で比較）", () => {
    const lowUnderstanding = subtopic({ understanding: 0.2, lastStudiedDate: null, basicProblems: 10 });
    const highUnderstanding = subtopic({ understanding: 0.9, lastStudiedDate: null, basicProblems: 10 });
    const lowEstimate = estimateSubtopicRemainingMinutes(lowUnderstanding, today);
    const highEstimate = estimateSubtopicRemainingMinutes(highUnderstanding, today);
    expect(highEstimate.basicMinutes).toBeLessThan(lowEstimate.basicMinutes);
  });

  it("減衰後の理解度を使う（lastStudiedDate から日数が経つほど残り時間が増える）", () => {
    const recentlyStudied = subtopic({ understanding: 0.8, lastStudiedDate: "2026-06-29", basicProblems: 10 });
    const longAgoStudied = subtopic({ understanding: 0.8, lastStudiedDate: "2026-05-18", basicProblems: 10 }); // 42日前
    const recentEstimate = estimateSubtopicRemainingMinutes(recentlyStudied, today);
    const decayedEstimate = estimateSubtopicRemainingMinutes(longAgoStudied, today);
    expect(decayedEstimate.basicMinutes).toBeGreaterThan(recentEstimate.basicMinutes);
  });
});
