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
  buildPlanFromItemKeys,
  applySessionToChapter,
  applySessionToSubtopic,
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
  learnedProblemRates,
  MIN_SESSIONS_FOR_LEARNED_RATE,
  TEACHER_HINT_PRIORITY_BOOST,
  cumulativeSubtopicProblemsCompleted,
  recentSubtopicProblemsCompleted,
  subtopicUnderstandingTier,
  subtopicProblemTier,
  worstProgressTier,
  RECENT_ACTIVITY_WINDOW_DAYS,
  simulateForward,
  triageSubtopics,
  shouldSurfaceForecastForSubject,
  FORECAST_SHORTFALL_THRESHOLD_MINUTES,
  SESSION_MINUTES,
  VOCAB_BOX_INTERVAL_DAYS,
  VOCAB_CHUNK_SIZE,
  generateChunksForRange,
  advanceVocabChunk,
  completeVocabChunk,
  calculateDailyNewVocabPace,
  getTodaysVocabChunks,
  validateVocabRangeDraft,
  MAX_VOCAB_RANGE_SIZE,
  estimateVocabMinutes,
  toISODate,
  estimateChapterRemainingMinutes,
  MINUTES_PER_PROBLEM_CHAPTER_ESTIMATE,
  CHAPTER_ESTIMATE_GAP_INCREMENT,
  subjectPaceMultiplier,
  MIN_SESSIONS_FOR_PACE_MULTIPLIER,
  PACE_MULTIPLIER_MIN,
  PACE_MULTIPLIER_MAX,
  BASELINE_UNDERSTANDING_GAIN_PER_MINUTE,
} from "./logic";
import type { ForwardSimulationResult, SubjectForecastSummary } from "./logic";
import type {
  AvailabilitySettings,
  Chapter,
  ChapterSubtopic,
  StudySession,
  Subject,
  TimeSlot,
  VocabChunk,
  VocabRange,
} from "./types";

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

describe("§6.3 計画生成（フェーズ4.5・小項目単位）", () => {
  const subjects: Subject[] = [{ id: "s1", name: "数学", testDate: "2026-07-03" }];

  it("小項目を持つ章からは、小項目ごとに複数の PlanItem（subtopic が non-null）が生成される", () => {
    const c = chapter({
      id: "a",
      subjectId: "s1",
      pointWeight: 40,
      understanding: 0.9, // 章レベルの understanding は使われない（デュアルパスで無視される）はず
      subtopics: [
        subtopic({ id: "st1", name: "小項目1", understanding: 0.1, basicProblems: 5 }),
        subtopic({ id: "st2", name: "小項目2", understanding: 0.1, basicProblems: 5 }),
      ],
    });
    const plan = generateTodayPlan([c], subjects, 120, today);
    expect(plan.length).toBe(2);
    expect(plan.every((p) => p.subtopic !== null)).toBe(true);
    const ids = plan.map((p) => p.subtopic?.id).sort();
    expect(ids).toEqual(["st1", "st2"]);
  });

  it("同じ章の複数小項目が同日プランに並びうる（1小項目集中・章単位のまとめ上限は無い）", () => {
    const c = chapter({
      id: "a",
      subjectId: "s1",
      pointWeight: 40,
      subtopics: [
        subtopic({ id: "st1", name: "小項目1", understanding: 0.1, basicProblems: 3 }),
        subtopic({ id: "st2", name: "小項目2", understanding: 0.1, basicProblems: 3 }),
        subtopic({ id: "st3", name: "小項目3", understanding: 0.1, basicProblems: 3 }),
      ],
    });
    const plan = generateTodayPlan([c], subjects, 200, today);
    expect(plan.filter((p) => p.chapter.id === "a")).toHaveLength(3);
  });

  it("小項目の割当時間は MIN_SUBTOPIC_SESSION_MINUTES 〜 SESSION_MINUTES の範囲にクランプされる", () => {
    const c = chapter({
      id: "a",
      subjectId: "s1",
      pointWeight: 40,
      subtopics: [
        // 理解度が高く見積もりがほぼ0分になるケース → 下限でクランプされるはず
        subtopic({ id: "st1", name: "ほぼ完了", understanding: 0.99, basicProblems: 1 }),
        // 問題数が非常に多く見積もりが SESSION_MINUTES を超えるケース → 上限でクランプされるはず
        subtopic({ id: "st2", name: "問題数膨大", understanding: 0, basicProblems: 100, advancedProblems: 100 }),
      ],
    });
    const plan = generateTodayPlan([c], subjects, 500, today);
    for (const item of plan) {
      expect(item.allocatedMinutes).toBeGreaterThanOrEqual(10);
      expect(item.allocatedMinutes).toBeLessThanOrEqual(45);
    }
    const st2Item = plan.find((p) => p.subtopic?.id === "st2");
    expect(st2Item?.allocatedMinutes).toBe(45);
  });

  it("sessions を渡すと learnedProblemRates 経由で割当時間の見積もりに反映される", () => {
    const c = chapter({
      id: "a",
      subjectId: "s1",
      pointWeight: 40,
      subtopics: [subtopic({ id: "st1", name: "小項目1", understanding: 0, basicProblems: 2 })],
    });
    // デフォルト単価（MINUTES_PER_BASIC_PROBLEM=13）よりずっと軽い実測値を学習させる
    const sessions: StudySession[] = Array.from({ length: 3 }, (_, i) => ({
      id: `sess${i}`,
      chapterId: "a",
      subtopicId: "st1",
      date: "2026-06-20",
      minutes: 2,
      correctRate: 0.8,
      selfReport: 4,
      basicProblemsCompleted: 1,
    }));

    const withoutSessions = generateTodayPlan([c], subjects, 500, today);
    const withSessions = generateTodayPlan([c], subjects, 500, today, sessions);

    expect(withSessions[0].allocatedMinutes).toBeLessThan(withoutSessions[0].allocatedMinutes);
  });

  it("teacherHinted な小項目の reasons には「先生のヒントあり」が含まれる", () => {
    const c = chapter({
      id: "a",
      subjectId: "s1",
      pointWeight: 40,
      subtopics: [
        subtopic({ id: "st1", name: "ヒントあり", understanding: 0.1, basicProblems: 3, teacherHinted: true }),
      ],
    });
    const plan = generateTodayPlan([c], subjects, 120, today);
    expect(plan[0].reasons).toContain("先生のヒントあり");
  });

  it("小項目を持つ章と持たない章が混在するとき、正しく統合されソートされる", () => {
    const withSubtopics = chapter({
      id: "a",
      subjectId: "s1",
      pointWeight: 40,
      subtopics: [subtopic({ id: "st1", name: "小項目1", understanding: 0, basicProblems: 3 })],
    });
    const withoutSubtopics = chapter({
      id: "b",
      subjectId: "s1",
      pointWeight: 10,
      understanding: 0.75,
    });
    const plan = generateTodayPlan([withSubtopics, withoutSubtopics], subjects, 120, today);
    expect(plan.length).toBe(2);
    // 統合された1つのリストとして priority 降順でソートされていること
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i - 1].priority).toBeGreaterThanOrEqual(plan[i].priority);
    }
    const chapterOnlyItem = plan.find((p) => p.chapter.id === "b");
    expect(chapterOnlyItem?.subtopic).toBeNull();
  });

  it("小項目を持たない章のみを渡した場合、既存の generateTodayPlan（章単位・1章45分固定）と完全に一致する", () => {
    const chapters: Chapter[] = [
      chapter({ id: "a", subjectId: "s1", pointWeight: 40, understanding: 0.3 }),
      chapter({ id: "c", subjectId: "s1", pointWeight: 10, understanding: 0.75 }),
    ];
    const plan = generateTodayPlan(chapters, subjects, 60, today);
    expect(plan.every((p) => p.subtopic === null)).toBe(true);
    expect(plan.every((p) => p.allocatedMinutes === 45 || p.allocatedMinutes <= 60)).toBe(true);
  });
});

describe("§6.3 フェーズ6：シミュレーションに基づく除外・安全策（generateTodayPlan）", () => {
  // テストまで3日（today, +1, +2の3日分）× 45分/日 = 135分しか使えない、というタイトな設定
  const subjects: Subject[] = [{ id: "s1", name: "数学", testDate: "2026-07-01" }];

  function flatAvailability(minutesPerDay: number): AvailabilitySettings {
    const h = String(Math.floor(minutesPerDay / 60)).padStart(2, "0");
    const m = String(minutesPerDay % 60).padStart(2, "0");
    const slot: TimeSlot = { start: "00:00", end: `${h}:${m}` };
    const weeklySchedule: Partial<Record<number, TimeSlot[]>> = {};
    for (let day = 0; day <= 6; day++) weeklySchedule[day] = [slot];
    return { weeklySchedule, dateOverrides: {} };
  }

  it("availability を渡さない場合は従来通り除外を行わない（後方互換）", () => {
    // 伸びしろが大きく、タイトな時間では絶対に間に合わない章
    const hopeless = chapter({ id: "a", subjectId: "s1", pointWeight: 20, understanding: 0, targetUnderstanding: 0.8 });
    const easy = chapter({ id: "b", subjectId: "s1", pointWeight: 20, understanding: 0.75, targetUnderstanding: 0.8 });
    const plan = generateTodayPlan([hopeless, easy], subjects, 200, today);
    expect(plan.map((p) => p.chapter.id).sort()).toEqual(["a", "b"]);
  });

  it("availability を渡すと、まとまった不足が出る章は候補から除外され、間に合う章が優先的に時間を確保する", () => {
    // 伸びしろ0.8 → 見積もり360分必要。1日45分×3日=135分では全く足りない
    const hopeless = chapter({ id: "a", subjectId: "s1", pointWeight: 20, understanding: 0, targetUnderstanding: 0.8 });
    // 伸びしろ0.05 → 見積もり約22.5分。相手が割当を独占してもこの章自身の不足は閾値未満に収まる
    const easy = chapter({ id: "b", subjectId: "s1", pointWeight: 20, understanding: 0.75, targetUnderstanding: 0.8 });

    const withoutAvailability = generateTodayPlan([hopeless, easy], subjects, 200, today);
    expect(withoutAvailability.map((p) => p.chapter.id).sort()).toEqual(["a", "b"]);

    // 間に合う章（easy）が先に割り当てられ、なお余った時間はスピルオーバーで間に合わない章（hopeless）にも回る
    const withAvailability = generateTodayPlan([hopeless, easy], subjects, 200, today, [], flatAvailability(45));
    expect(withAvailability.map((p) => p.chapter.id)).toEqual(["b", "a"]);
  });

  it("除外後の候補だけでは dailyMinutes を使い切れない場合、除外された項目がスピルオーバー（2周目）で埋まる", () => {
    const hopeless = chapter({ id: "a", subjectId: "s1", pointWeight: 20, understanding: 0, targetUnderstanding: 0.8 });
    const easy = chapter({ id: "b", subjectId: "s1", pointWeight: 20, understanding: 0.75, targetUnderstanding: 0.8 });

    // easy 1件（45分）だけでは埋まらない90分を渡す → 余り45分がスピルオーバーで hopeless に回る
    const plan = generateTodayPlan([hopeless, easy], subjects, 90, today, [], flatAvailability(45));
    expect(plan.map((p) => p.chapter.id)).toEqual(["b", "a"]);
    expect(plan.reduce((sum, p) => sum + p.allocatedMinutes, 0)).toBe(90);
  });

  it("候補だけで dailyMinutes を使い切れる場合はスピルオーバーが発生しない（除外された項目は入らない）", () => {
    const hopeless = chapter({ id: "a", subjectId: "s1", pointWeight: 20, understanding: 0, targetUnderstanding: 0.8 });
    const easy = chapter({ id: "b", subjectId: "s1", pointWeight: 20, understanding: 0.75, targetUnderstanding: 0.8 });

    // easy 1件（45分）ちょうどしか渡さない → 余りが無いのでスピルオーバーは起きない
    const plan = generateTodayPlan([hopeless, easy], subjects, 45, today, [], flatAvailability(45));
    expect(plan.map((p) => p.chapter.id)).toEqual(["b"]);
  });

  it("スピルオーバーは除外された項目の中でもスコアの高い順に埋める", () => {
    // 配点30・5どちらも同じ伸びしろ0.8（＝同じ見積もり所要時間）で除外されるが、優先度スコアは配点差で異なる
    const hopelessHighWeight = chapter({ id: "a", subjectId: "s1", pointWeight: 30, understanding: 0, targetUnderstanding: 0.8 });
    const hopelessLowWeight = chapter({ id: "b", subjectId: "s1", pointWeight: 5, understanding: 0, targetUnderstanding: 0.8 });
    const easy = chapter({ id: "c", subjectId: "s1", pointWeight: 20, understanding: 0.75, targetUnderstanding: 0.8 });

    // easy(45分) + スピルオーバー1件分(45分)しか入らない90分。2件とも間に合わない見込みだが、
    // スコアが高い hopelessHighWeight が優先してスピルオーバーに入るはず
    const plan = generateTodayPlan(
      [hopelessHighWeight, hopelessLowWeight, easy],
      subjects,
      90,
      today,
      [],
      flatAvailability(45),
    );
    expect(plan.map((p) => p.chapter.id)).toEqual(["c", "a"]);
  });

  it("除外の結果、候補が0件になってしまう場合は最優先1件を必ず残す（安全策。スピルオーバー導入後も引き続き成立する）", () => {
    // 唯一の章が間に合わない見込みでも、プランが0件にはならない
    const hopeless = chapter({ id: "a", subjectId: "s1", pointWeight: 20, understanding: 0, targetUnderstanding: 0.8 });
    const plan = generateTodayPlan([hopeless], subjects, 200, today, [], flatAvailability(45));
    expect(plan).toHaveLength(1);
    expect(plan[0].chapter.id).toBe("a");
  });
});

describe("buildPlanFromItemKeys（「今日の計画」の固定スナップショットから再構築）", () => {
  const subjects: Subject[] = [{ id: "s1", name: "数学", testDate: "2026-07-03" }];

  it("章単位のitemKeyから、章単位の generateTodayPlan と同じ allocatedMinutes・reasons を再構築する", () => {
    const c = chapter({ id: "a", subjectId: "s1", pointWeight: 40, understanding: 0.3 });
    const plan = buildPlanFromItemKeys([c], subjects, [{ chapterId: "a", subtopicId: null }], today);

    expect(plan).toHaveLength(1);
    expect(plan[0].subtopic).toBeNull();
    expect(plan[0].allocatedMinutes).toBe(SESSION_MINUTES);
    expect(plan[0].reasons.length).toBeGreaterThan(0);
  });

  it("小項目単位のitemKeyから、対応する PlanItem を再構築する", () => {
    const c = chapter({
      id: "a",
      subjectId: "s1",
      pointWeight: 40,
      subtopics: [subtopic({ id: "st1", name: "小項目1", understanding: 0.1, basicProblems: 5 })],
    });
    const plan = buildPlanFromItemKeys([c], subjects, [{ chapterId: "a", subtopicId: "st1" }], today);

    expect(plan).toHaveLength(1);
    expect(plan[0].subtopic?.id).toBe("st1");
    expect(plan[0].allocatedMinutes).toBeGreaterThanOrEqual(10);
    expect(plan[0].allocatedMinutes).toBeLessThanOrEqual(45);
  });

  it("対象の章が既に存在しない（Settingsで削除された等）場合、その項目は結果から除外される", () => {
    const c = chapter({ id: "a", subjectId: "s1" });
    const plan = buildPlanFromItemKeys(
      [c],
      subjects,
      [
        { chapterId: "a", subtopicId: null },
        { chapterId: "deleted", subtopicId: null },
      ],
      today,
    );
    expect(plan).toHaveLength(1);
    expect(plan[0].chapter.id).toBe("a");
  });

  it("対象の小項目が既に存在しない場合、その項目は結果から除外される", () => {
    const c = chapter({
      id: "a",
      subjectId: "s1",
      subtopics: [subtopic({ id: "st1", name: "小項目1", understanding: 0.1, basicProblems: 5 })],
    });
    const plan = buildPlanFromItemKeys(
      [c],
      subjects,
      [
        { chapterId: "a", subtopicId: "st1" },
        { chapterId: "a", subtopicId: "removed" },
      ],
      today,
    );
    expect(plan).toHaveLength(1);
    expect(plan[0].subtopic?.id).toBe("st1");
  });

  it("itemKeys の順序をそのまま保持する（優先度順への再ソートはしない）", () => {
    const low = chapter({ id: "low", subjectId: "s1", pointWeight: 5, understanding: 0.7 });
    const high = chapter({ id: "high", subjectId: "s1", pointWeight: 40, understanding: 0.1 });
    const plan = buildPlanFromItemKeys(
      [low, high],
      subjects,
      [
        { chapterId: "low", subtopicId: null },
        { chapterId: "high", subtopicId: null },
      ],
      today,
    );
    expect(plan.map((p) => p.chapter.id)).toEqual(["low", "high"]);
  });

  it("章データが更新されると、allocatedMinutes は再計算される（対象集合は固定のまま、値だけ最新化される）", () => {
    const c = chapter({
      id: "a",
      subjectId: "s1",
      subtopics: [subtopic({ id: "st1", name: "小項目1", understanding: 0, basicProblems: 100, advancedProblems: 100 })],
    });
    const before = buildPlanFromItemKeys([c], subjects, [{ chapterId: "a", subtopicId: "st1" }], today);
    expect(before[0].allocatedMinutes).toBe(SESSION_MINUTES); // 見積もりが大きく上限クランプ

    const almostDone = chapter({
      id: "a",
      subjectId: "s1",
      subtopics: [subtopic({ id: "st1", name: "小項目1", understanding: 0.99, basicProblems: 1 })],
    });
    const after = buildPlanFromItemKeys([almostDone], subjects, [{ chapterId: "a", subtopicId: "st1" }], today);
    expect(after[0].allocatedMinutes).toBe(10); // 見積もりがほぼ0分になり下限クランプ
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

describe("applySessionToSubtopic", () => {
  const session: StudySession = {
    id: "x",
    chapterId: "c1",
    subtopicId: "st-a",
    date: "2026-06-29",
    minutes: 45,
    correctRate: 0.8,
    selfReport: 4,
  };

  it("対象の小項目の understanding が更新され、lastStudiedDate がセッションの日付になる", () => {
    const subtopics = [
      subtopic({ id: "st-a", understanding: 0.4, lastStudiedDate: null }),
      subtopic({ id: "st-b", understanding: 0.5, lastStudiedDate: null }),
    ];
    const c = chapter({ subtopics });
    const updated = applySessionToSubtopic(c, "st-a", session);
    const updatedA = updated.subtopics?.find((s) => s.id === "st-a");
    // observed=0.8, new=0.5*0.8+0.5*0.4=0.6
    expect(updatedA?.understanding).toBeCloseTo(0.6);
    expect(updatedA?.lastStudiedDate).toBe("2026-06-29");
  });

  it("対象外の小項目・章本体のフィールドは変更されない", () => {
    const subtopics = [
      subtopic({ id: "st-a", understanding: 0.4, lastStudiedDate: null }),
      subtopic({ id: "st-b", understanding: 0.5, lastStudiedDate: "2026-01-01" }),
    ];
    const c = chapter({ understanding: 0.3, lastStudiedDate: "2025-12-01", subtopics });
    const updated = applySessionToSubtopic(c, "st-a", session);

    const updatedB = updated.subtopics?.find((s) => s.id === "st-b");
    expect(updatedB?.understanding).toBeCloseTo(0.5);
    expect(updatedB?.lastStudiedDate).toBe("2026-01-01");

    // 章本体のフィールドは小項目単位の更新では変更しない
    expect(updated.understanding).toBeCloseTo(0.3);
    expect(updated.lastStudiedDate).toBe("2025-12-01");
  });

  it("該当する subtopicId が見つからない場合、章がそのまま返る", () => {
    const subtopics = [subtopic({ id: "st-a", understanding: 0.4 })];
    const c = chapter({ subtopics });
    const updated = applySessionToSubtopic(c, "does-not-exist", session);
    expect(updated).toEqual(c);
  });

  it("subtopics が未設定の章では、章がそのまま返る", () => {
    const c = chapter({ subtopics: undefined });
    const updated = applySessionToSubtopic(c, "st-a", session);
    expect(updated).toEqual(c);
  });

  it("小項目の understanding が未設定（初回）の場合、0 から更新が始まる", () => {
    const subtopics = [subtopic({ id: "st-a", understanding: undefined })];
    const c = chapter({ subtopics });
    const updated = applySessionToSubtopic(c, "st-a", session);
    const updatedA = updated.subtopics?.find((s) => s.id === "st-a");
    // observed=0.8, new=0.5*0.8+0.5*0=0.4
    expect(updatedA?.understanding).toBeCloseTo(0.4);
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

    it("teacherHinted: true の小項目は、そうでない場合の TEACHER_HINT_PRIORITY_BOOST 倍のスコアになる", () => {
      const subtopics = [subtopic({ id: "a" })];
      const c = chapter({ pointWeight: 20, targetUnderstanding: 0.8, subtopics });
      const stWithoutHint = { ...subtopics[0], understanding: 0.4, lastStudiedDate: null };
      const stWithHint = { ...stWithoutHint, teacherHinted: true };
      const baseScore = subtopicPriority(c, stWithoutHint, subject, today);
      const hintedScore = subtopicPriority(c, stWithHint, subject, today);
      expect(hintedScore).toBeCloseTo(baseScore * TEACHER_HINT_PRIORITY_BOOST);
    });

    it("teacherHinted: false は teacherHinted 未設定と同じスコアになる（後方互換）", () => {
      const subtopics = [subtopic({ id: "a" })];
      const c = chapter({ pointWeight: 20, targetUnderstanding: 0.8, subtopics });
      const stUnset = { ...subtopics[0], understanding: 0.4, lastStudiedDate: null };
      const stFalse = { ...stUnset, teacherHinted: false };
      expect(subtopicPriority(c, stFalse, subject, today)).toBeCloseTo(
        subtopicPriority(c, stUnset, subject, today),
      );
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

  it("rates 引数を渡すと、その学習済みレートで計算される", () => {
    const st = subtopic({ understanding: 0.5, lastStudiedDate: null, basicProblems: 10, advancedProblems: 4 });
    const rates = { basicMinutesPerProblem: 100, advancedMinutesPerProblem: 200 };
    const estimate = estimateSubtopicRemainingMinutes(st, today, rates);
    const remainingRatio = 0.5;
    expect(estimate.basicMinutes).toBeCloseTo(10 * 100 * remainingRatio);
    expect(estimate.advancedMinutes).toBeCloseTo(4 * 200 * remainingRatio);
  });

  it("rates 引数を省略した場合は従来通りデフォルト値（MINUTES_PER_BASIC_PROBLEM/MINUTES_PER_ADVANCED_PROBLEM）が使われる", () => {
    const st = subtopic({ understanding: 0.5, lastStudiedDate: null, basicProblems: 10, advancedProblems: 4 });
    const estimate = estimateSubtopicRemainingMinutes(st, today);
    const remainingRatio = 0.5;
    expect(estimate.basicMinutes).toBeCloseTo(10 * MINUTES_PER_BASIC_PROBLEM * remainingRatio);
    expect(estimate.advancedMinutes).toBeCloseTo(4 * MINUTES_PER_ADVANCED_PROBLEM * remainingRatio);
  });

  it("フェーズ6：paceMultiplier を省略した場合は1（補正なし）として扱われる", () => {
    const st = subtopic({ understanding: 0.5, lastStudiedDate: null, basicProblems: 10, advancedProblems: 4 });
    const withoutMultiplier = estimateSubtopicRemainingMinutes(st, today);
    const withMultiplierOne = estimateSubtopicRemainingMinutes(
      st,
      today,
      { basicMinutesPerProblem: MINUTES_PER_BASIC_PROBLEM, advancedMinutesPerProblem: MINUTES_PER_ADVANCED_PROBLEM },
      1,
    );
    expect(withMultiplierOne.totalMinutes).toBeCloseTo(withoutMultiplier.totalMinutes);
  });

  it("フェーズ6：paceMultiplier で全体を割った値が返る（速いペースほど短く見積もる）", () => {
    const st = subtopic({ understanding: 0.5, lastStudiedDate: null, basicProblems: 10, advancedProblems: 4 });
    const base = estimateSubtopicRemainingMinutes(st, today);
    const faster = estimateSubtopicRemainingMinutes(
      st,
      today,
      { basicMinutesPerProblem: MINUTES_PER_BASIC_PROBLEM, advancedMinutesPerProblem: MINUTES_PER_ADVANCED_PROBLEM },
      2,
    );
    expect(faster.totalMinutes).toBeCloseTo(base.totalMinutes / 2);
    expect(faster.basicMinutes).toBeCloseTo(base.basicMinutes / 2);
    expect(faster.advancedMinutes).toBeCloseTo(base.advancedMinutes / 2);
  });
});

describe("小項目を持たない章の所要時間見積もり（estimateChapterRemainingMinutes、フェーズ6）", () => {
  it("metadata.exerciseCount がある場合：演習数 × MINUTES_PER_PROBLEM_CHAPTER_ESTIMATE × 伸びしろ で見積もる", () => {
    const c = chapter({
      understanding: 0.4,
      targetUnderstanding: 0.8,
      lastStudiedDate: null,
      metadata: { exerciseCount: 20 },
    });
    const gap = 0.4; // 0.8 - 0.4
    expect(estimateChapterRemainingMinutes(c, today)).toBeCloseTo(20 * MINUTES_PER_PROBLEM_CHAPTER_ESTIMATE * gap);
  });

  it("metadata.exerciseCount が無い場合：伸びしろに比例した粗い見積もりにフォールバックする", () => {
    const c = chapter({ understanding: 0.4, targetUnderstanding: 0.8, lastStudiedDate: null });
    const gap = 0.4;
    expect(estimateChapterRemainingMinutes(c, today)).toBeCloseTo((gap / CHAPTER_ESTIMATE_GAP_INCREMENT) * SESSION_MINUTES);
  });

  it("既に目標理解度に到達している場合は0を返す", () => {
    const c = chapter({ understanding: 0.9, targetUnderstanding: 0.8, lastStudiedDate: null });
    expect(estimateChapterRemainingMinutes(c, today)).toBe(0);
  });

  it("減衰後の理解度を使う（lastStudiedDate から日数が経つほど残り時間が増える）", () => {
    const recentlyStudied = chapter({ understanding: 0.7, targetUnderstanding: 0.8, lastStudiedDate: "2026-06-29" });
    const longAgoStudied = chapter({ understanding: 0.7, targetUnderstanding: 0.8, lastStudiedDate: "2026-05-18" }); // 42日前
    expect(estimateChapterRemainingMinutes(longAgoStudied, today)).toBeGreaterThan(
      estimateChapterRemainingMinutes(recentlyStudied, today),
    );
  });

  it("paceMultiplier で割った値が返る（速いペースほど短く見積もる）", () => {
    const c = chapter({ understanding: 0.4, targetUnderstanding: 0.8, lastStudiedDate: null });
    const base = estimateChapterRemainingMinutes(c, today);
    expect(estimateChapterRemainingMinutes(c, today, 2)).toBeCloseTo(base / 2);
  });
});

describe("教科ごとの学習ペース倍率（subjectPaceMultiplier、フェーズ6）", () => {
  function paceSession(chapterId: string, date: string, observedValue: number, minutes = 1): StudySession {
    // computeObserved(V, 5V) = 0.7V + 0.3V = V という性質を使い、observed が厳密に
    // observedValue になるよう correctRate・selfReport を逆算する（テスト用の作為的な値）。
    return {
      id: `${chapterId}-${date}`,
      chapterId,
      date,
      minutes,
      correctRate: observedValue,
      selfReport: 5 * observedValue,
    };
  }

  function makeChapters(ids: string[]): Chapter[] {
    return ids.map((id) => chapter({ id, subjectId: "s1" }));
  }

  // 2セッション/entity = 1サンプル/entity なので、entity数を MIN_SESSIONS_FOR_PACE_MULTIPLIER に
  // 合わせればちょうど閾値ぴったりのサンプル数になる（境界のentity数を動的に作る）
  const idsAtThreshold = Array.from({ length: MIN_SESSIONS_FOR_PACE_MULTIPLIER }, (_, i) => `c${i}`);
  const idsBelowThreshold = idsAtThreshold.slice(0, -1);

  it("サンプル数が MIN_SESSIONS_FOR_PACE_MULTIPLIER 未満なら倍率は1.0（補正なし）", () => {
    const chapters = makeChapters(idsBelowThreshold);
    const sessions = idsBelowThreshold.flatMap((id) => [
      paceSession(id, "2026-06-01", 0),
      paceSession(id, "2026-06-02", 1),
    ]);
    expect(subjectPaceMultiplier(sessions, chapters, "s1")).toBe(1.0);
  });

  it("実測ペースが基準より大幅に速ければ倍率は上限 PACE_MULTIPLIER_MAX にクランプされる", () => {
    const chapters = makeChapters(idsAtThreshold);
    const sessions = idsAtThreshold.flatMap((id) => [
      paceSession(id, "2026-06-01", 0),
      paceSession(id, "2026-06-02", 1),
    ]);
    expect(subjectPaceMultiplier(sessions, chapters, "s1")).toBeCloseTo(PACE_MULTIPLIER_MAX, 5);
  });

  it("実測ペースが基準より大幅に遅ければ（マイナスでも）倍率は下限 PACE_MULTIPLIER_MIN にクランプされる", () => {
    const chapters = makeChapters(idsAtThreshold);
    const sessions = idsAtThreshold.flatMap((id) => [
      paceSession(id, "2026-06-01", 1),
      paceSession(id, "2026-06-02", 0),
    ]);
    expect(subjectPaceMultiplier(sessions, chapters, "s1")).toBeCloseTo(PACE_MULTIPLIER_MIN, 5);
  });

  it("中央値を使うため、1件だけ極端な外れ値があっても引きずられない", () => {
    const ids = idsAtThreshold;
    const chapters = makeChapters(ids);
    const baseline = BASELINE_UNDERSTANDING_GAIN_PER_MINUTE;
    const perGroupDelta = [baseline * 0.5, baseline * 0.8, baseline, baseline * 1.2, baseline * 20]; // 最後だけ極端な外れ値
    const sessions = ids.flatMap((id, i) => [
      paceSession(id, "2026-06-01", 0),
      paceSession(id, "2026-06-02", perGroupDelta[i]),
    ]);
    expect(subjectPaceMultiplier(sessions, chapters, "s1")).toBeCloseTo(1.0, 2);
  });

  it("他教科のセッションは対象に含めない（対象セッションが無ければ1.0にフォールバック）", () => {
    const chapters = [chapter({ id: "c1", subjectId: "s1" }), chapter({ id: "cOther", subjectId: "s2" })];
    const sessions = [paceSession("cOther", "2026-06-01", 0), paceSession("cOther", "2026-06-02", 1)];
    expect(subjectPaceMultiplier(sessions, chapters, "s1")).toBe(1.0);
  });
});

describe("演習時間の実測値学習（learnedProblemRates）", () => {
  function makeSession(overrides: Partial<StudySession> = {}): StudySession {
    return {
      id: "sess1",
      chapterId: "c1",
      subtopicId: "st-a",
      date: "2026-06-29",
      minutes: 30,
      correctRate: 0.8,
      selfReport: 4,
      ...overrides,
    };
  }

  const chapters = [chapter({ id: "c1", subjectId: "s1" })];

  it("純粋な基礎/発展セッションが MIN_SESSIONS_FOR_LEARNED_RATE 件未満ならデフォルト値を返す", () => {
    const sessions = [
      makeSession({ id: "1", basicProblemsCompleted: 5 }),
      makeSession({ id: "2", basicProblemsCompleted: 5 }),
    ];
    const rates = learnedProblemRates(sessions, chapters, "s1");
    expect(rates.basicMinutesPerProblem).toBe(MINUTES_PER_BASIC_PROBLEM);
    expect(rates.advancedMinutesPerProblem).toBe(MINUTES_PER_ADVANCED_PROBLEM);
  });

  it("純粋な基礎セッションが MIN_SESSIONS_FOR_LEARNED_RATE 件以上あれば、その実測平均を返す", () => {
    expect(MIN_SESSIONS_FOR_LEARNED_RATE).toBe(3);
    const sessions = [
      makeSession({ id: "1", minutes: 50, basicProblemsCompleted: 5 }), // 10分/問
      makeSession({ id: "2", minutes: 60, basicProblemsCompleted: 6 }), // 10分/問
      makeSession({ id: "3", minutes: 40, basicProblemsCompleted: 4 }), // 10分/問
    ];
    const rates = learnedProblemRates(sessions, chapters, "s1");
    expect(rates.basicMinutesPerProblem).toBeCloseTo(10);
    // 発展は対象セッションが無いのでデフォルトのまま
    expect(rates.advancedMinutesPerProblem).toBe(MINUTES_PER_ADVANCED_PROBLEM);
  });

  it("発展セッションについても同様に学習される", () => {
    const sessions = [
      makeSession({ id: "1", minutes: 60, advancedProblemsCompleted: 3 }), // 20分/問
      makeSession({ id: "2", minutes: 80, advancedProblemsCompleted: 4 }), // 20分/問
      makeSession({ id: "3", minutes: 100, advancedProblemsCompleted: 5 }), // 20分/問
    ];
    const rates = learnedProblemRates(sessions, chapters, "s1");
    expect(rates.advancedMinutesPerProblem).toBeCloseTo(20);
    expect(rates.basicMinutesPerProblem).toBe(MINUTES_PER_BASIC_PROBLEM);
  });

  it("基礎と発展が混在するセッションは学習対象から除外される", () => {
    const sessions = [
      makeSession({ id: "1", minutes: 50, basicProblemsCompleted: 5, advancedProblemsCompleted: 2 }),
      makeSession({ id: "2", minutes: 50, basicProblemsCompleted: 5, advancedProblemsCompleted: 2 }),
      makeSession({ id: "3", minutes: 50, basicProblemsCompleted: 5, advancedProblemsCompleted: 2 }),
    ];
    const rates = learnedProblemRates(sessions, chapters, "s1");
    // 全セッションが混在扱いで除外されるため、両方デフォルト値のまま
    expect(rates.basicMinutesPerProblem).toBe(MINUTES_PER_BASIC_PROBLEM);
    expect(rates.advancedMinutesPerProblem).toBe(MINUTES_PER_ADVANCED_PROBLEM);
  });

  it("対象外の教科・章のセッションは無視される", () => {
    const otherChapters = [chapter({ id: "c1", subjectId: "s1" }), chapter({ id: "c2", subjectId: "s2" })];
    const sessions = [
      // s2 に属する章 c2 のセッション。s1 の学習には使われない
      makeSession({ id: "1", chapterId: "c2", minutes: 50, basicProblemsCompleted: 5 }),
      makeSession({ id: "2", chapterId: "c2", minutes: 50, basicProblemsCompleted: 5 }),
      makeSession({ id: "3", chapterId: "c2", minutes: 50, basicProblemsCompleted: 5 }),
    ];
    const rates = learnedProblemRates(sessions, otherChapters, "s1");
    expect(rates.basicMinutesPerProblem).toBe(MINUTES_PER_BASIC_PROBLEM);
  });

  it("subtopicId の無いセッション（章全体記録）は学習対象から除外される", () => {
    const sessions = [
      makeSession({ id: "1", subtopicId: undefined, minutes: 50, basicProblemsCompleted: 5 }),
      makeSession({ id: "2", subtopicId: undefined, minutes: 50, basicProblemsCompleted: 5 }),
      makeSession({ id: "3", subtopicId: undefined, minutes: 50, basicProblemsCompleted: 5 }),
    ];
    const rates = learnedProblemRates(sessions, chapters, "s1");
    expect(rates.basicMinutesPerProblem).toBe(MINUTES_PER_BASIC_PROBLEM);
  });
});

describe("実績ベースのペース判定", () => {
  function makeSession(overrides: Partial<StudySession> = {}): StudySession {
    return {
      id: "sess1",
      chapterId: "c1",
      subtopicId: "st-a",
      date: "2026-06-29",
      minutes: 30,
      correctRate: 0.8,
      selfReport: 4,
      ...overrides,
    };
  }

  describe("cumulativeSubtopicProblemsCompleted / recentSubtopicProblemsCompleted", () => {
    it("対象の小項目のセッションだけを集計し、他の小項目・章のセッションは無視する", () => {
      const sessions: StudySession[] = [
        makeSession({ id: "a", subtopicId: "st-a", basicProblemsCompleted: 3, advancedProblemsCompleted: 1 }),
        makeSession({ id: "b", subtopicId: "st-a", basicProblemsCompleted: 2, advancedProblemsCompleted: 0 }),
        makeSession({ id: "c", subtopicId: "st-b", basicProblemsCompleted: 10, advancedProblemsCompleted: 10 }),
        makeSession({ id: "d", chapterId: "c2", subtopicId: "st-a", basicProblemsCompleted: 99 }),
      ];
      // st-b は同じ ID 文字列でも別データとして扱われる（subtopicId のみで絞り込むため、意図通りの仕様）
      const result = cumulativeSubtopicProblemsCompleted(sessions, "st-a");
      expect(result).toEqual({ basic: 3 + 2 + 99, advanced: 1 });
    });

    it("recentSubtopicProblemsCompleted は指定日数より古いセッションを除外する", () => {
      const today = new Date(2026, 5, 29); // 2026-06-29
      const sessions: StudySession[] = [
        makeSession({ id: "recent", date: "2026-06-25", basicProblemsCompleted: 5 }), // 4日前
        makeSession({ id: "old", date: "2026-06-01", basicProblemsCompleted: 100 }), // 28日前
      ];
      const result = recentSubtopicProblemsCompleted(sessions, "st-a", today, RECENT_ACTIVITY_WINDOW_DAYS);
      expect(result).toEqual({ basic: 5, advanced: 0 });
    });
  });

  describe("subtopicUnderstandingTier", () => {
    const today = new Date(2026, 5, 29);
    const c = chapter({ targetUnderstanding: 0.8 });

    it("ギャップが小さければ直近取り組みが無くても on_track", () => {
      const st = subtopic({ id: "st-a", understanding: 0.7, lastStudiedDate: null }); // gap=0.1
      expect(subtopicUnderstandingTier(c, st, [], today)).toBe("on_track");
    });

    it("ギャップが中程度で直近取り組みがあれば slightly_behind", () => {
      const st = subtopic({ id: "st-a", understanding: 0.5, lastStudiedDate: null }); // gap=0.3
      const sessions = [makeSession({ subtopicId: "st-a", date: "2026-06-28" })];
      expect(subtopicUnderstandingTier(c, st, sessions, today)).toBe("slightly_behind");
    });

    it("ギャップが中程度でセッションが一度も記録されていなければ slightly_behind（本来 at_risk のケースだが、登録直後との区別がつかないため悪いほうに倒さない）", () => {
      const st = subtopic({ id: "st-a", understanding: 0.5, lastStudiedDate: null }); // gap=0.3
      expect(subtopicUnderstandingTier(c, st, [], today)).toBe("slightly_behind");
    });

    it("ギャップが大きくてもセッションが一度も記録されていなければ slightly_behind に留める", () => {
      const st = subtopic({ id: "st-a", understanding: 0.2, lastStudiedDate: null }); // gap=0.6
      expect(subtopicUnderstandingTier(c, st, [], today)).toBe("slightly_behind");
    });

    it("ギャップが大きく、かつセッションが記録済みなら at_risk（直近取り組みの有無に関わらず）", () => {
      const st = subtopic({ id: "st-a", understanding: 0.2, lastStudiedDate: null }); // gap=0.6
      const sessions = [makeSession({ subtopicId: "st-a", date: "2026-06-28" })];
      expect(subtopicUnderstandingTier(c, st, sessions, today)).toBe("at_risk");
    });

    it("対象小項目以外のセッションしか無い場合はセッション0件と同じ扱いになる", () => {
      const st = subtopic({ id: "st-a", understanding: 0.2, lastStudiedDate: null }); // gap=0.6
      const sessions = [makeSession({ subtopicId: "st-other", date: "2026-06-28" })];
      expect(subtopicUnderstandingTier(c, st, sessions, today)).toBe("slightly_behind");
    });
  });

  describe("subtopicProblemTier", () => {
    const today = new Date(2026, 5, 29);
    const testDate = "2026-07-13"; // today から2週間後 → weeksLeft=2

    it("目標問題数が未設定なら null", () => {
      const st = subtopic({ id: "st-a", basicProblems: undefined, advancedProblems: undefined });
      const result = subtopicProblemTier(st, [], testDate, today);
      expect(result.basic).toBeNull();
      expect(result.advanced).toBeNull();
    });

    it("テストまで残り3日以下なら、実績があっても basic/advanced とも null（詰め込み期は判定しない）", () => {
      const st = subtopic({ id: "st-a", basicProblems: 20, advancedProblems: 20 });
      const sessions = [
        makeSession({ subtopicId: "st-a", date: "2026-06-29", basicProblemsCompleted: 1, advancedProblemsCompleted: 1 }),
      ];
      const nearTestDate = "2026-07-01"; // today (2026-06-29) から2日後
      const result = subtopicProblemTier(st, sessions, nearTestDate, today);
      expect(result.basic).toBeNull();
      expect(result.advanced).toBeNull();
    });

    it("残り問題数が0以下なら on_track", () => {
      const st = subtopic({ id: "st-a", basicProblems: 5 });
      const sessions = [makeSession({ subtopicId: "st-a", basicProblemsCompleted: 5 })];
      const result = subtopicProblemTier(st, sessions, testDate, today);
      expect(result.basic).toBe("on_track");
    });

    it("直近実績が必要ペース以上なら on_track", () => {
      // remaining=20, weeksLeft=2 → requiredPerWeek=10。直近7日で10問こなしていれば ratio=1.0
      const st = subtopic({ id: "st-a", basicProblems: 20 });
      const sessions = [makeSession({ subtopicId: "st-a", date: "2026-06-29", basicProblemsCompleted: 10 })];
      const result = subtopicProblemTier(st, sessions, testDate, today);
      expect(result.basic).toBe("on_track");
    });

    it("直近実績が必要ペースの0.5〜1.0倍なら slightly_behind", () => {
      const st = subtopic({ id: "st-a", basicProblems: 20 }); // requiredPerWeek=10
      const sessions = [makeSession({ subtopicId: "st-a", date: "2026-06-29", basicProblemsCompleted: 6 })]; // ratio=0.6
      const result = subtopicProblemTier(st, sessions, testDate, today);
      expect(result.basic).toBe("slightly_behind");
    });

    it("直近実績が必要ペースの0.5倍未満なら at_risk", () => {
      const st = subtopic({ id: "st-a", basicProblems: 20 }); // requiredPerWeek=10
      const sessions = [makeSession({ subtopicId: "st-a", date: "2026-06-29", basicProblemsCompleted: 1 })]; // ratio=0.1
      const result = subtopicProblemTier(st, sessions, testDate, today);
      expect(result.basic).toBe("at_risk");
    });

    it("basic/advanced はそれぞれ独立して判定される", () => {
      const st = subtopic({ id: "st-a", basicProblems: 20, advancedProblems: undefined });
      const sessions = [makeSession({ subtopicId: "st-a", basicProblemsCompleted: 10 })];
      const result = subtopicProblemTier(st, sessions, testDate, today);
      expect(result.basic).toBe("on_track");
      expect(result.advanced).toBeNull();
    });

    it("セッションが一度も記録されていない場合、本来 at_risk になる条件（直近実績0）でも slightly_behind に留める（登録直後との区別がつかないため悪いほうに倒さない）", () => {
      const st = subtopic({ id: "st-a", basicProblems: 20, advancedProblems: 10 });
      const result = subtopicProblemTier(st, [], testDate, today);
      expect(result.basic).toBe("slightly_behind");
      expect(result.advanced).toBe("slightly_behind");
    });

    it("対象小項目以外のセッションしか無い場合はセッション0件と同じ扱いになり slightly_behind に留める", () => {
      const st = subtopic({ id: "st-a", basicProblems: 20 });
      const sessions = [makeSession({ subtopicId: "st-other", date: "2026-06-29", basicProblemsCompleted: 10 })];
      const result = subtopicProblemTier(st, sessions, testDate, today);
      expect(result.basic).toBe("slightly_behind");
    });
  });

  describe("worstProgressTier", () => {
    it("null混じりの配列から最も悪いティアを返す", () => {
      expect(worstProgressTier(["on_track", null, "slightly_behind"])).toBe("slightly_behind");
      expect(worstProgressTier(["on_track", "at_risk", "slightly_behind"])).toBe("at_risk");
      expect(worstProgressTier(["on_track", "on_track"])).toBe("on_track");
    });

    it("全てnullならnullを返す", () => {
      expect(worstProgressTier([null, null])).toBeNull();
    });
  });
});

describe("フェーズ5：前向きシミュレーション（simulateForward）／トリアージ（triageSubtopics）", () => {
  const today = new Date(2026, 5, 29); // 2026-06-29

  function minutesToClock(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  /** 毎日同じ分数だけ勉強できる、というシンプルな AvailabilitySettings を作る */
  function dailyAvailability(minutesPerDay: number): AvailabilitySettings {
    const slot: TimeSlot = { start: "00:00", end: minutesToClock(minutesPerDay) };
    const weeklySchedule: Partial<Record<number, TimeSlot[]>> = {};
    for (let day = 0; day <= 6; day++) {
      weeklySchedule[day] = [slot];
    }
    return { weeklySchedule, dateOverrides: {} };
  }

  describe("simulateForward", () => {
    it("既に理解度が目標を満たしている小項目は day0（today）時点で完了扱いになる", () => {
      const subjects: Subject[] = [{ id: "s1", name: "数学", testDate: "2026-08-15" }];
      const c = chapter({
        id: "a",
        subjectId: "s1",
        subtopics: [subtopic({ id: "st1", understanding: 1, targetUnderstanding: 0.8 })],
      });
      const result = simulateForward([c], subjects, dailyAvailability(200), today);
      expect(result.subtopics).toHaveLength(1);
      const forecast = result.subtopics[0];
      expect(forecast.totalMinutesNeeded).toBe(0);
      expect(forecast.onTrack).toBe(true);
      expect(forecast.shortfallMinutes).toBe(0);
      expect(forecast.projectedCompletionDate).toBe("2026-06-29");
    });

    it("複数日にまたがって完了する場合、正しい完了日を予測する", () => {
      const subjects: Subject[] = [{ id: "s1", name: "数学", testDate: "2026-08-15" }];
      const c = chapter({
        id: "a",
        subjectId: "s1",
        subtopics: [subtopic({ id: "st1", understanding: 0, basicProblems: 10 })], // 13*10 + 20(概念) = 150分
      });
      const result = simulateForward([c], subjects, dailyAvailability(200), today, []);
      const forecast = result.subtopics[0];
      expect(forecast.totalMinutesNeeded).toBe(150);
      // 45分/日ずつ3日消化(135分)→残り15分は4日目(2026-07-02)に完了
      expect(forecast.projectedCompletionDate).toBe("2026-07-02");
      expect(forecast.onTrack).toBe(true);
      expect(forecast.shortfallMinutes).toBe(0);
    });

    it("テスト日までに終わらない場合、shortfallMinutesが残り、projectedCompletionDateはnull", () => {
      // テストまで3日（today, +1, +2 の3日分）、1日45分しか使えない場合の最大割当は135分
      const subjects: Subject[] = [{ id: "s1", name: "数学", testDate: "2026-07-01" }];
      const c = chapter({
        id: "a",
        subjectId: "s1",
        subtopics: [subtopic({ id: "st1", understanding: 0, basicProblems: 10 })], // 150分必要
      });
      const result = simulateForward([c], subjects, dailyAvailability(SESSION_MINUTES), today);
      const forecast = result.subtopics[0];
      expect(forecast.totalMinutesNeeded).toBe(150);
      expect(forecast.onTrack).toBe(false);
      expect(forecast.projectedCompletionDate).toBeNull();
      expect(forecast.shortfallMinutes).toBeCloseTo(15, 5); // 150 - 135
    });

    it("ある教科は自分のテスト日を過ぎたら対象から脱落し、以降の日は他教科に回る", () => {
      const subjects: Subject[] = [
        { id: "sA", name: "数学", testDate: "2026-07-01" }, // today から3日分だけ有効（today, +1, +2）
        { id: "sB", name: "理科", testDate: "2026-07-20" }, // 十分先
      ];
      const chapterA = chapter({
        id: "a",
        subjectId: "sA",
        pointWeight: 20,
        understanding: 0,
        targetUnderstanding: 0.8,
        subtopics: [subtopic({ id: "stA", understanding: 0, basicProblems: 1000 })], // 絶対に終わらない量
      });
      const chapterB = chapter({
        id: "b",
        subjectId: "sB",
        pointWeight: 20,
        understanding: 0,
        targetUnderstanding: 0.8,
        subtopics: [subtopic({ id: "stB", understanding: 0, basicProblems: 0 })], // 概念コスト20分のみ
      });
      // 1日45分（＝1小項目分）しか無いので、A・B同時に進めることはできない。
      // A の方がテストが近い＝proximityが大きいのでA優先のはず。
      const result = simulateForward([chapterA, chapterB], subjects, dailyAvailability(SESSION_MINUTES), today);

      const forecastA = result.subtopics.find((f) => f.subtopicId === "stA")!;
      const forecastB = result.subtopics.find((f) => f.subtopicId === "stB")!;

      // Aがテスト日(3日分=135分)を使い切っても終わらない量なので shortfall が発生する
      expect(forecastA.onTrack).toBe(false);
      expect(forecastA.shortfallMinutes).toBeGreaterThan(0);

      // Bはtoday,+1,+2の3日間まったく割当を受けられず（Aが優先されるため）、
      // Aがテスト日を過ぎて脱落した4日目（2026-07-02）にようやく20分を割り当てられ完了する
      expect(forecastB.totalMinutesNeeded).toBe(20);
      expect(forecastB.onTrack).toBe(true);
      expect(forecastB.projectedCompletionDate).toBe("2026-07-02");
    });

    it("フェーズ6：小項目を持たない章も対象に含まれる（subtopicIdはnull）", () => {
      const subjects: Subject[] = [{ id: "s1", name: "数学", testDate: "2026-08-15" }];
      const withSubtopics = chapter({
        id: "a",
        subjectId: "s1",
        subtopics: [subtopic({ id: "st1", understanding: 0, basicProblems: 1 })],
      });
      const withoutSubtopics = chapter({ id: "b", subjectId: "s1", pointWeight: 100, understanding: 0 });
      const result = simulateForward([withSubtopics, withoutSubtopics], subjects, dailyAvailability(200), today);
      expect(result.subtopics).toHaveLength(2);
      const withSubtopicsForecast = result.subtopics.find((f) => f.chapterId === "a")!;
      expect(withSubtopicsForecast.subtopicId).toBe("st1");
      const plainChapterForecast = result.subtopics.find((f) => f.chapterId === "b")!;
      expect(plainChapterForecast.subtopicId).toBeNull();
      expect(plainChapterForecast.totalMinutesNeeded).toBeGreaterThan(0);
    });

    it("章も教科も無ければ空の結果を返す（クラッシュしない）", () => {
      const result = simulateForward([], [], dailyAvailability(200), today);
      expect(result.subtopics).toEqual([]);
      expect(result.subjects).toEqual([]);
    });

    it("該当する教科が見つからない章は対象外（クラッシュしない）", () => {
      const c = chapter({ id: "a", subjectId: "missing-subject" });
      const result = simulateForward([c], [], dailyAvailability(200), today);
      expect(result.subtopics).toEqual([]);
      expect(result.subjects).toEqual([]);
    });

    it("教科ごとのサマリー（totalShortfallMinutes / atRiskSubtopicIds）が正しく集計される", () => {
      const subjects: Subject[] = [{ id: "s1", name: "数学", testDate: "2026-07-01" }];
      const c = chapter({
        id: "a",
        subjectId: "s1",
        subtopics: [
          subtopic({ id: "st1", understanding: 0, basicProblems: 10 }), // 150分、間に合わない想定
          subtopic({ id: "st2", understanding: 1, targetUnderstanding: 0.8 }), // 既に完了
        ],
      });
      const result = simulateForward([c], subjects, dailyAvailability(SESSION_MINUTES), today);
      expect(result.subjects).toHaveLength(1);
      const summary = result.subjects[0];
      expect(summary.subjectId).toBe("s1");
      expect(summary.atRiskSubtopicIds).toEqual(["st1"]);
      expect(summary.totalShortfallMinutes).toBeGreaterThan(0);
    });
  });

  describe("triageSubtopics", () => {
    it("shortfallMinutes > 0 の小項目だけを対象に、効率（配点按分 ÷ totalMinutesNeeded）の低い順に並べる", () => {
      const chapters: Chapter[] = [
        chapter({
          id: "x",
          subjectId: "s1",
          pointWeight: 40,
          subtopics: [subtopic({ id: "stA" }), subtopic({ id: "stB" })], // 均等按分で各20
        }),
        chapter({
          id: "y",
          subjectId: "s1",
          pointWeight: 10,
          subtopics: [subtopic({ id: "stC" })], // 按分10
        }),
      ];
      const result: ForwardSimulationResult = {
        subtopics: [
          {
            chapterId: "x",
            subtopicId: "stA",
            subjectId: "s1",
            totalMinutesNeeded: 100,
            projectedCompletionDate: null,
            shortfallMinutes: 50,
            onTrack: false,
          }, // efficiency = 20/100 = 0.2（所要時間が長い割に配点は同じ → 効率が悪い）
          {
            chapterId: "x",
            subtopicId: "stB",
            subjectId: "s1",
            totalMinutesNeeded: 40,
            projectedCompletionDate: null,
            shortfallMinutes: 10,
            onTrack: false,
          }, // efficiency = 20/40 = 0.5（shortfallはstAより小さいが、denominatorはtotalMinutesNeededなので効率はこちらが上）
          {
            chapterId: "y",
            subtopicId: "stC",
            subjectId: "s1",
            totalMinutesNeeded: 50,
            projectedCompletionDate: "2026-07-01",
            shortfallMinutes: 0,
            onTrack: true,
          }, // 間に合うので対象外
        ],
        subjects: [],
      };

      const candidates = triageSubtopics(result, chapters);
      expect(candidates).toHaveLength(2);
      // 効率が低い（＝切る候補として優先度が高い）順：stA(0.2) → stB(0.5)
      expect(candidates.map((c) => c.subtopicId)).toEqual(["stA", "stB"]);
      expect(candidates[0].efficiency).toBeCloseTo(0.2, 5);
      expect(candidates[1].efficiency).toBeCloseTo(0.5, 5);
    });

    it("対応する章が見つからない場合は配点按分0として扱う（クラッシュしない）", () => {
      const result: ForwardSimulationResult = {
        subtopics: [
          {
            chapterId: "missing",
            subtopicId: "st1",
            subjectId: "s1",
            totalMinutesNeeded: 50,
            projectedCompletionDate: null,
            shortfallMinutes: 20,
            onTrack: false,
          },
        ],
        subjects: [],
      };
      const candidates = triageSubtopics(result, []);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].efficiency).toBe(0);
    });

    it("totalMinutesNeeded が0（理論上ありえないが防御的に）の場合は efficiency を0として扱う（ゼロ除算を避ける）", () => {
      const chapters: Chapter[] = [
        chapter({ id: "x", subjectId: "s1", pointWeight: 20, subtopics: [subtopic({ id: "stA" })] }),
      ];
      const result: ForwardSimulationResult = {
        subtopics: [
          {
            chapterId: "x",
            subtopicId: "stA",
            subjectId: "s1",
            totalMinutesNeeded: 0,
            projectedCompletionDate: null,
            shortfallMinutes: 5,
            onTrack: false,
          },
        ],
        subjects: [],
      };
      const candidates = triageSubtopics(result, chapters);
      expect(candidates[0].efficiency).toBe(0);
    });
  });

  describe("shouldSurfaceForecastForSubject", () => {
    const chapters: Chapter[] = [chapter({ id: "a", subjectId: "s1" })];

    function makeSummary(overrides: Partial<SubjectForecastSummary> = {}): SubjectForecastSummary {
      return { subjectId: "s1", totalShortfallMinutes: 0, atRiskSubtopicIds: [], ...overrides };
    }

    it("不足がまとまって大きく、かつその教科を勉強し始めている場合のみ true", () => {
      const summary = makeSummary({ totalShortfallMinutes: FORECAST_SHORTFALL_THRESHOLD_MINUTES + 1 });
      const sessions: StudySession[] = [
        {
          id: "sess1",
          chapterId: "a",
          subtopicId: "st1",
          date: "2026-06-28",
          minutes: 30,
          correctRate: 0.8,
          selfReport: 4,
        },
      ];
      expect(shouldSurfaceForecastForSubject(summary, sessions, chapters)).toBe(true);
    });

    it("不足が閾値以下なら、セッションがあっても false", () => {
      const summary = makeSummary({ totalShortfallMinutes: FORECAST_SHORTFALL_THRESHOLD_MINUTES });
      const sessions: StudySession[] = [
        {
          id: "sess1",
          chapterId: "a",
          subtopicId: "st1",
          date: "2026-06-28",
          minutes: 30,
          correctRate: 0.8,
          selfReport: 4,
        },
      ];
      expect(shouldSurfaceForecastForSubject(summary, sessions, chapters)).toBe(false);
    });

    it("不足が閾値を超えていても、その教科の小項目セッションが1件も無ければ false（登録直後の誤警報防止）", () => {
      const summary = makeSummary({ totalShortfallMinutes: FORECAST_SHORTFALL_THRESHOLD_MINUTES + 100 });
      expect(shouldSurfaceForecastForSubject(summary, [], chapters)).toBe(false);
    });

    it("フェーズ6：章全体としてのセッション（subtopicId未指定）も「取り組み始めている」証拠として数える（小項目を持たない章もシミュレーション対象になったため）", () => {
      const summary = makeSummary({ totalShortfallMinutes: FORECAST_SHORTFALL_THRESHOLD_MINUTES + 100 });
      const sessions: StudySession[] = [
        { id: "sess1", chapterId: "a", date: "2026-06-28", minutes: 30, correctRate: 0.8, selfReport: 4 },
      ];
      expect(shouldSurfaceForecastForSubject(summary, sessions, chapters)).toBe(true);
    });

    it("他教科の小項目セッションは数えない", () => {
      const summary = makeSummary({ subjectId: "s1", totalShortfallMinutes: FORECAST_SHORTFALL_THRESHOLD_MINUTES + 100 });
      const otherChapters: Chapter[] = [chapter({ id: "other", subjectId: "s2" })];
      const sessions: StudySession[] = [
        {
          id: "sess1",
          chapterId: "other",
          subtopicId: "st1",
          date: "2026-06-28",
          minutes: 30,
          correctRate: 0.8,
          selfReport: 4,
        },
      ];
      expect(shouldSurfaceForecastForSubject(summary, sessions, otherChapters)).toBe(false);
    });
  });
});

describe("英単語暗記（確定設計 v3：枠単位）", () => {
  function vocabRange(overrides: Partial<VocabRange> = {}): VocabRange {
    return {
      id: "r1",
      subjectId: "s1",
      label: "ターゲット1900",
      startNumber: 371,
      endNumber: 670,
      ...overrides,
    };
  }

  function vocabChunk(overrides: Partial<VocabChunk> = {}): VocabChunk {
    return {
      id: "r1-371-390",
      rangeId: "r1",
      startNumber: 371,
      endNumber: 390,
      introduced: false,
      box: 0,
      nextReviewDate: null,
      completed: false,
      ...overrides,
    };
  }

  describe("generateChunksForRange", () => {
    it("startNumber〜endNumberをVOCAB_CHUNK_SIZE語ずつの枠に分割する", () => {
      const range = vocabRange({ startNumber: 371, endNumber: 670 }); // 300語
      const chunks = generateChunksForRange(range);
      expect(chunks).toHaveLength(300 / VOCAB_CHUNK_SIZE);
      expect(chunks[0]).toMatchObject({
        startNumber: 371,
        endNumber: 390,
        introduced: false,
        box: 0,
        nextReviewDate: null,
        completed: false,
      });
      expect(chunks[chunks.length - 1]).toMatchObject({ startNumber: 651, endNumber: 670 });
    });

    it("生成された各枠のrangeIdが範囲のidと一致する", () => {
      const range = vocabRange({ id: "r2", startNumber: 1, endNumber: 40 });
      const chunks = generateChunksForRange(range);
      expect(chunks.every((c) => c.rangeId === "r2")).toBe(true);
      expect(chunks.map((c) => [c.startNumber, c.endNumber])).toEqual([
        [1, 20],
        [21, 40],
      ]);
    });

    it("最後の枠が5語未満になる場合は直前の枠と合算する（極端に短い枠を避ける）", () => {
      const range = vocabRange({ startNumber: 1, endNumber: 44 }); // 20, 20, 4語 -> 最後を合算
      const chunks = generateChunksForRange(range);
      expect(chunks).toHaveLength(2);
      expect(chunks[1]).toMatchObject({ startNumber: 21, endNumber: 44 });
    });

    it("端数が5〜19語ならそのまま独立した最後の枠になる", () => {
      const range = vocabRange({ startNumber: 1, endNumber: 45 }); // 20, 20, 5語
      const chunks = generateChunksForRange(range);
      expect(chunks).toHaveLength(3);
      expect(chunks[2]).toMatchObject({ startNumber: 41, endNumber: 45 });
    });

    it("範囲全体がVOCAB_CHUNK_SIZE未満なら1枠だけ生成する", () => {
      const range = vocabRange({ startNumber: 1, endNumber: 5 });
      const chunks = generateChunksForRange(range);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toMatchObject({ startNumber: 1, endNumber: 5 });
    });
  });

  describe("advanceVocabChunk", () => {
    it("未着手の枠に初めて「まだ完璧じゃない」と回答すると、箱1に入り間隔1日後が次回復習日になる", () => {
      const chunk = vocabChunk({ introduced: false, box: 0, nextReviewDate: null });
      const result = advanceVocabChunk(chunk, today);
      expect(result.introduced).toBe(true);
      expect(result.box).toBe(1);
      expect(result.nextReviewDate).toBe(toISODate(new Date(2026, 5, 30)));
    });

    it("着手済みの枠に「まだ完璧じゃない」と回答すると、箱を1つ上げて間隔もその箱のものになる", () => {
      const chunk = vocabChunk({ introduced: true, box: 2 });
      const result = advanceVocabChunk(chunk, today);
      expect(result.box).toBe(3);
      // 箱3の間隔は7日
      expect(result.nextReviewDate).toBe(toISODate(new Date(2026, 6, 6)));
    });

    it("箱5でも箱5より上には上がらない（上限）が、次回復習日は箱5の間隔で更新される", () => {
      const chunk = vocabChunk({ introduced: true, box: 5, nextReviewDate: "2020-01-01" });
      const result = advanceVocabChunk(chunk, today);
      expect(result.box).toBe(5);
      // 箱5の間隔は30日
      expect(result.nextReviewDate).toBe(toISODate(new Date(2026, 6, 29)));
    });

    it("VOCAB_BOX_INTERVAL_DAYSは箱1〜5に対応する5要素の配列", () => {
      expect(VOCAB_BOX_INTERVAL_DAYS).toEqual([1, 3, 7, 14, 30]);
    });
  });

  describe("completeVocabChunk", () => {
    it("completedをtrueにするだけで、box/nextReviewDateは変えない", () => {
      const chunk = vocabChunk({
        introduced: true,
        box: 3,
        nextReviewDate: "2026-07-10",
        completed: false,
      });
      const result = completeVocabChunk(chunk);
      expect(result.completed).toBe(true);
      expect(result.box).toBe(3);
      expect(result.nextReviewDate).toBe("2026-07-10");
    });
  });

  describe("calculateDailyNewVocabPace", () => {
    it("未着手の枠数をテストまでの残り日数で割って切り上げる", () => {
      const range = vocabRange({ id: "r1", startNumber: 1, endNumber: 220 }); // 220語 = 11枠
      // today = 2026-06-29, testDate = 2026-07-04 -> daysLeft = 5
      const chunks = generateChunksForRange(range);
      const pace = calculateDailyNewVocabPace(range, chunks, "2026-07-04", today);
      expect(pace).toBe(Math.ceil(11 / 5));
    });

    it("他の範囲の枠は数えない", () => {
      const range = vocabRange({ id: "r1", startNumber: 1, endNumber: 200 }); // 10枠
      const chunks = [
        ...generateChunksForRange(range),
        ...generateChunksForRange(vocabRange({ id: "other", startNumber: 1, endNumber: 100 })), // 5枠
      ];
      const pace = calculateDailyNewVocabPace(range, chunks, "2026-07-04", today);
      expect(pace).toBe(Math.ceil(10 / 5));
    });

    it("未着手の枠が0件なら0を返す", () => {
      const range = vocabRange({ id: "r1", startNumber: 1, endNumber: 40 });
      const chunks = generateChunksForRange(range).map((c) => ({ ...c, introduced: true }));
      expect(calculateDailyNewVocabPace(range, chunks, "2026-07-04", today)).toBe(0);
    });

    it("テスト日が既に過ぎている場合は0を返す", () => {
      const range = vocabRange({ id: "r1", startNumber: 1, endNumber: 40 });
      const chunks = generateChunksForRange(range);
      expect(calculateDailyNewVocabPace(range, chunks, "2026-06-01", today)).toBe(0);
    });
  });

  describe("getTodaysVocabChunks", () => {
    const subjects: Subject[] = [{ id: "s1", name: "英語", testDate: "2026-07-04" }];

    it("未着手の枠をその範囲のペース分だけ、番号の若い順に新規として選ぶ", () => {
      const range = vocabRange({ id: "r1", subjectId: "s1", startNumber: 1, endNumber: 220 }); // 11枠
      const chunks = generateChunksForRange(range);
      const result = getTodaysVocabChunks([range], chunks, subjects, today);
      // daysLeft("2026-07-04", 2026-06-29) = 5, 11/5 切り上げ = 3
      expect(result.newChunks.map((c) => c.startNumber)).toEqual([1, 21, 41]);
    });

    it("nextReviewDateが今日以前の着手済み・未完了の枠を復習対象にする", () => {
      const range = vocabRange({ id: "r1", subjectId: "s1", startNumber: 1, endNumber: 60 });
      const chunks: VocabChunk[] = [
        vocabChunk({
          id: "c1",
          rangeId: "r1",
          startNumber: 1,
          endNumber: 20,
          introduced: true,
          box: 2,
          nextReviewDate: "2026-06-29",
        }),
        vocabChunk({
          id: "c2",
          rangeId: "r1",
          startNumber: 21,
          endNumber: 40,
          introduced: true,
          box: 2,
          nextReviewDate: "2026-06-20",
        }),
        vocabChunk({
          id: "c3",
          rangeId: "r1",
          startNumber: 41,
          endNumber: 60,
          introduced: true,
          box: 2,
          nextReviewDate: "2026-07-01",
        }),
      ];
      const result = getTodaysVocabChunks([range], chunks, subjects, today);
      expect(result.reviewChunks.map((c) => c.id).sort()).toEqual(["c1", "c2"]);
    });

    it("completedな枠は新規・復習どちらの対象にも含めない（設計の肝）", () => {
      const range = vocabRange({ id: "r1", subjectId: "s1", startNumber: 1, endNumber: 20 });
      const chunks: VocabChunk[] = [
        vocabChunk({
          id: "c1",
          rangeId: "r1",
          startNumber: 1,
          endNumber: 20,
          introduced: true,
          box: 3,
          nextReviewDate: "2026-06-20",
          completed: true,
        }),
      ];
      const result = getTodaysVocabChunks([range], chunks, subjects, today);
      expect(result.newChunks).toHaveLength(0);
      expect(result.reviewChunks).toHaveLength(0);
    });

    it("復習日がまだ来ていない枠は復習対象に含めない", () => {
      const range = vocabRange({ id: "r1", subjectId: "s1", startNumber: 1, endNumber: 20 });
      const chunks: VocabChunk[] = [
        vocabChunk({
          id: "c1",
          rangeId: "r1",
          startNumber: 1,
          endNumber: 20,
          introduced: true,
          box: 2,
          nextReviewDate: "2026-07-10",
        }),
      ];
      const result = getTodaysVocabChunks([range], chunks, subjects, today);
      expect(result.reviewChunks).toHaveLength(0);
    });

    it("対応する教科のテスト日を過ぎている範囲は新規・復習どちらからも除外する", () => {
      const pastSubjects: Subject[] = [{ id: "s1", name: "英語", testDate: "2026-06-01" }];
      const range = vocabRange({ id: "r1", subjectId: "s1", startNumber: 1, endNumber: 100 });
      const chunks: VocabChunk[] = [
        ...generateChunksForRange(vocabRange({ id: "r1", startNumber: 21, endNumber: 100 })),
        vocabChunk({
          id: "due",
          rangeId: "r1",
          startNumber: 1,
          endNumber: 20,
          introduced: true,
          box: 2,
          nextReviewDate: "2026-06-20",
        }),
      ];
      const result = getTodaysVocabChunks([range], chunks, pastSubjects, today);
      expect(result.newChunks).toHaveLength(0);
      expect(result.reviewChunks).toHaveLength(0);
    });

    it("対応する教科が存在しない範囲は無視する", () => {
      const range = vocabRange({ id: "r1", subjectId: "unknown", startNumber: 1, endNumber: 20 });
      const chunks = generateChunksForRange(range);
      const result = getTodaysVocabChunks([range], chunks, subjects, today);
      expect(result.newChunks).toHaveLength(0);
      expect(result.reviewChunks).toHaveLength(0);
    });

    it("hasBacklog: 復習予定日をちょうど today に迎えた枠だけなら false（毎日きちんと取り組んでいる状態）", () => {
      const range = vocabRange({ id: "r1", subjectId: "s1", startNumber: 1, endNumber: 20 });
      const chunks: VocabChunk[] = [
        vocabChunk({
          id: "c1",
          rangeId: "r1",
          startNumber: 1,
          endNumber: 20,
          introduced: true,
          box: 2,
          nextReviewDate: "2026-06-29",
        }),
      ];
      const result = getTodaysVocabChunks([range], chunks, subjects, today);
      expect(result.hasBacklog).toBe(false);
    });

    it("hasBacklog: 復習予定日を1日以上過ぎた枠があれば true（間が空いて溜まった状態）", () => {
      const range = vocabRange({ id: "r1", subjectId: "s1", startNumber: 1, endNumber: 20 });
      const chunks: VocabChunk[] = [
        vocabChunk({
          id: "c1",
          rangeId: "r1",
          startNumber: 1,
          endNumber: 20,
          introduced: true,
          box: 2,
          nextReviewDate: "2026-06-20",
        }),
      ];
      const result = getTodaysVocabChunks([range], chunks, subjects, today);
      expect(result.hasBacklog).toBe(true);
    });
  });

  describe("validateVocabRangeDraft", () => {
    it("ラベル・開始番号・終了番号がすべて正しければ null（エラー無し）を返す", () => {
      expect(validateVocabRangeDraft({ label: "ターゲット1900", startNumber: 371, endNumber: 670 })).toBeNull();
    });

    it("ラベルが空欄だとエラーになる（開始・終了番号は入力済みでも黙って無視しない）", () => {
      const error = validateVocabRangeDraft({ label: "", startNumber: 1, endNumber: 10 });
      expect(error).toBe("暗記範囲のラベルを入力してください。");
    });

    it("開始・終了番号が未入力、または終了が開始より前だとエラーになる", () => {
      expect(validateVocabRangeDraft({ label: "L", startNumber: null, endNumber: null })).toBe(
        "暗記範囲（開始番号・終了番号）を正しく入力してください。",
      );
      expect(validateVocabRangeDraft({ label: "L", startNumber: 10, endNumber: 5 })).toBe(
        "暗記範囲（開始番号・終了番号）を正しく入力してください。",
      );
    });

    it("範囲サイズが MAX_VOCAB_RANGE_SIZE を超えるとエラーになる（入力ミスでの大量生成を防ぐ）", () => {
      const error = validateVocabRangeDraft({ label: "L", startNumber: 1, endNumber: MAX_VOCAB_RANGE_SIZE + 1 });
      expect(error).toContain(`${MAX_VOCAB_RANGE_SIZE}語`);
    });

    it("範囲サイズがちょうど MAX_VOCAB_RANGE_SIZE ならエラーにならない", () => {
      const error = validateVocabRangeDraft({ label: "L", startNumber: 1, endNumber: MAX_VOCAB_RANGE_SIZE });
      expect(error).toBeNull();
    });
  });

  describe("estimateVocabMinutes", () => {
    it("件数0のときは0分", () => {
      expect(estimateVocabMinutes(0)).toEqual({ lowMinutes: 0, highMinutes: 0 });
    });

    it("件数が多いほど幅のある分数見積もりを返す（下限は1分以上）", () => {
      const result = estimateVocabMinutes(30);
      expect(result.lowMinutes).toBeGreaterThanOrEqual(1);
      expect(result.highMinutes).toBeGreaterThanOrEqual(result.lowMinutes);
    });
  });
});
