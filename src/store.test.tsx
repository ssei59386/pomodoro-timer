import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { StoreProvider, useStore } from "./store";
import { initialData } from "./storage";
import type { AvailabilitySettings, Chapter, ChapterSubtopic, Subject, VocabChunk, VocabRange } from "./types";

// StoreContext を直接テストするための小さなプローブコンポーネント。
// 専用の renderHook ユーティリティは導入していないため、useStore() の値を
// コールバック経由でテスト側に取り出す。
let latest: ReturnType<typeof useStore> | null = null;

function Probe() {
  latest = useStore();
  return null;
}

function renderStore() {
  render(
    <StoreProvider>
      <Probe />
    </StoreProvider>,
  );
}

function getStore(): ReturnType<typeof useStore> {
  if (!latest) throw new Error("store not ready");
  return latest;
}

const subject: Subject = { id: "s1", name: "数学", testDate: "2026-08-01" };

function chapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: "c1",
    subjectId: "s1",
    name: "二次関数",
    understanding: 0.4,
    targetUnderstanding: 0.8,
    lastStudiedDate: null,
    ...overrides,
  };
}

const availability: AvailabilitySettings = {
  weeklySchedule: { 1: [{ start: "18:00", end: "19:00" }] },
  dateOverrides: {},
};

// ensureTodayPlan/todayPlanプルーンの検証には「2026-07-01に十分な空き時間がある」ことが要る
// （weeklySchedule基準の availability は曜日が合わないと0分になり得るため、日付上書きで確実にする）。
const plannableAvailability: AvailabilitySettings = {
  weeklySchedule: {},
  dateOverrides: { "2026-07-01": [{ start: "18:00", end: "20:00" }] },
};

beforeEach(() => {
  localStorage.clear();
  latest = null;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("StoreProvider / useStore", () => {
  it("completeOnboarding で onboarded/subjects/chapters/availability が反映される", () => {
    renderStore();
    act(() => {
      getStore().completeOnboarding({
        subjects: [subject],
        chapters: [chapter()],
        availability,
      });
    });
    expect(getStore().data.onboarded).toBe(true);
    expect(getStore().data.subjects).toEqual([subject]);
    expect(getStore().data.chapters).toEqual([chapter()]);
    expect(getStore().data.availability).toEqual(availability);
  });

  it("recordSession でセッションが追加され章の理解度が更新される", () => {
    renderStore();
    act(() => {
      getStore().completeOnboarding({
        subjects: [subject],
        chapters: [chapter()],
        availability,
      });
    });

    act(() => {
      getStore().recordSession({
        chapterId: "c1",
        date: "2026-07-01",
        minutes: 45,
        correctRate: 0.8,
        selfReport: 4,
      });
    });

    expect(getStore().data.sessions).toHaveLength(1);
    expect(getStore().data.sessions[0]).toMatchObject({
      chapterId: "c1",
      minutes: 45,
      correctRate: 0.8,
      selfReport: 4,
    });

    const updated = getStore().data.chapters.find((c) => c.id === "c1");
    // observed = 0.7*0.8 + 0.3*(4/5) = 0.8, updated = 0.5*0.4 + 0.5*0.8 = 0.6
    expect(updated?.understanding).toBeCloseTo(0.6);
    expect(updated?.lastStudiedDate).toBe("2026-07-01");
  });

  it("recordSession に subtopicId を指定すると、対象の小項目の理解度が更新され章レベルの understanding は変わらない", () => {
    const subtopics: ChapterSubtopic[] = [
      { id: "st-a", name: "因数分解", understanding: 0.3 },
      { id: "st-b", name: "平方完成", understanding: 0.5 },
    ];
    renderStore();
    act(() => {
      getStore().completeOnboarding({
        subjects: [subject],
        chapters: [chapter({ subtopics })],
        availability,
      });
    });

    act(() => {
      getStore().recordSession({
        chapterId: "c1",
        subtopicId: "st-a",
        date: "2026-07-01",
        minutes: 45,
        correctRate: 0.8,
        selfReport: 4,
      });
    });

    const updated = getStore().data.chapters.find((c) => c.id === "c1");
    const updatedA = updated?.subtopics?.find((s) => s.id === "st-a");
    const updatedB = updated?.subtopics?.find((s) => s.id === "st-b");

    // observed = 0.7*0.8 + 0.3*(4/5) = 0.8, updated = 0.5*0.3 + 0.5*0.8 = 0.55
    expect(updatedA?.understanding).toBeCloseTo(0.55);
    expect(updatedA?.lastStudiedDate).toBe("2026-07-01");

    // 対象外の小項目は変更されない
    expect(updatedB?.understanding).toBeCloseTo(0.5);

    // 章レベルの understanding は subtopicId 指定時には変更されない
    expect(updated?.understanding).toBeCloseTo(0.4);
    expect(updated?.lastStudiedDate).toBe(null);
  });

  it("updateChapter / addChapter / removeChapter が chapters を正しく更新する", () => {
    renderStore();
    act(() => {
      getStore().completeOnboarding({
        subjects: [subject],
        chapters: [chapter()],
        availability,
      });
    });

    act(() => {
      getStore().updateChapter({ ...chapter(), name: "図形の性質" });
    });
    expect(getStore().data.chapters[0].name).toBe("図形の性質");

    act(() => {
      getStore().addChapter({
        subjectId: "s1",
        name: "確率",
        understanding: 0.2,
        targetUnderstanding: 0.8,
        lastStudiedDate: null,
      });
    });
    expect(getStore().data.chapters).toHaveLength(2);
    const added = getStore().data.chapters.find((c) => c.name === "確率");
    expect(added).toBeDefined();
    expect(added?.id).not.toBe("");

    act(() => {
      getStore().removeChapter("c1");
    });
    expect(getStore().data.chapters.map((c) => c.id)).not.toContain("c1");
    expect(getStore().data.chapters).toHaveLength(1);
  });

  it("addSubject で subjects が増える", () => {
    renderStore();
    act(() => {
      getStore().completeOnboarding({
        subjects: [subject],
        chapters: [chapter()],
        availability,
      });
    });

    act(() => {
      getStore().addSubject({ name: "英語", testDate: "2026-09-01" });
    });

    expect(getStore().data.subjects).toHaveLength(2);
    const added = getStore().data.subjects.find((s) => s.name === "英語");
    expect(added).toBeDefined();
    expect(added?.id).not.toBe("");
    expect(added?.testDate).toBe("2026-09-01");
  });

  it("removeSubject で対象教科と、その章・セッション・vocabRange・vocabChunk・forecastDecisions・todayPlanをカスケード削除し、無関係な他教科は残る", () => {
    renderStore();

    const otherSubject: Subject = { id: "s2", name: "理科", testDate: "2026-08-05" };
    const otherChapter = chapter({ id: "c2", subjectId: "s2", name: "力学" });

    const vocabRange: VocabRange = {
      id: "r1",
      subjectId: "s1",
      label: "ターゲット1900",
      startNumber: 1,
      endNumber: 20,
    };
    const otherVocabRange: VocabRange = {
      id: "r2",
      subjectId: "s2",
      label: "セミナー化学",
      startNumber: 1,
      endNumber: 20,
    };
    const vocabChunks: VocabChunk[] = [
      {
        id: "r1-1-20",
        rangeId: "r1",
        startNumber: 1,
        endNumber: 20,
        introduced: false,
        box: 0,
        nextReviewDate: null,
        completed: false,
      },
      {
        id: "r2-1-20",
        rangeId: "r2",
        startNumber: 1,
        endNumber: 20,
        introduced: false,
        box: 0,
        nextReviewDate: null,
        completed: false,
      },
    ];

    act(() => {
      getStore().completeOnboarding({
        subjects: [subject, otherSubject],
        chapters: [chapter(), otherChapter],
        availability: plannableAvailability,
        vocabRanges: [vocabRange, otherVocabRange],
        vocabChunks,
      });
    });

    act(() => {
      getStore().recordSession({
        chapterId: "c1",
        date: "2026-07-01",
        minutes: 45,
        correctRate: 0.8,
        selfReport: 4,
      });
    });
    act(() => {
      getStore().recordSession({
        chapterId: "c2",
        date: "2026-07-01",
        minutes: 30,
        correctRate: 0.5,
        selfReport: 3,
      });
    });

    act(() => {
      getStore().ensureTodayPlan(new Date("2026-07-01"));
    });
    // c1（対象教科の章）が今日の計画に含まれることを前提にする
    expect(getStore().data.todayPlan?.itemKeys.some((k) => k.chapterId === "c1")).toBe(true);

    act(() => {
      // forecastDecisions を直接投入して削除対象/非対象の両方を検証する
      getStore().continueDecision("c1", null, new Date("2026-07-01"));
    });
    act(() => {
      getStore().continueDecision("c2", null, new Date("2026-07-01"));
    });
    expect(Object.keys(getStore().data.forecastDecisions ?? {})).toEqual(
      expect.arrayContaining(["c1:", "c2:"]),
    );

    act(() => {
      getStore().removeSubject("s1");
    });

    const result = getStore().data;
    expect(result.subjects.map((s) => s.id)).toEqual(["s2"]);
    expect(result.chapters.map((c) => c.id)).toEqual(["c2"]);
    expect(result.sessions.map((s) => s.chapterId)).toEqual(["c2"]);
    expect(result.vocabRanges.map((r) => r.id)).toEqual(["r2"]);
    expect(result.vocabChunks.map((c) => c.id)).toEqual(["r2-1-20"]);
    expect(Object.keys(result.forecastDecisions ?? {})).toEqual(["c2:"]);
    expect(result.todayPlan?.itemKeys.some((k) => k.chapterId === "c1")).toBe(false);
    expect(result.todayPlan?.itemKeys.some((k) => k.chapterId === "c2")).toBe(true);
  });

  it("removeChapter が forecastDecisions / todayPlan からも当該章のキーをプルーンする", () => {
    renderStore();

    act(() => {
      getStore().completeOnboarding({
        subjects: [subject],
        chapters: [chapter()],
        availability: plannableAvailability,
      });
    });

    act(() => {
      getStore().recordSession({
        chapterId: "c1",
        date: "2026-07-01",
        minutes: 45,
        correctRate: 0.8,
        selfReport: 4,
      });
    });

    act(() => {
      getStore().ensureTodayPlan(new Date("2026-07-01"));
    });
    expect(getStore().data.todayPlan?.itemKeys.some((k) => k.chapterId === "c1")).toBe(true);

    act(() => {
      getStore().continueDecision("c1", null, new Date("2026-07-01"));
    });
    expect(getStore().data.forecastDecisions?.["c1:"]).toBeDefined();

    act(() => {
      getStore().removeChapter("c1");
    });

    expect(getStore().data.forecastDecisions?.["c1:"]).toBeUndefined();
    expect(getStore().data.todayPlan?.itemKeys.some((k) => k.chapterId === "c1")).toBe(false);
  });

  it("setAvailability が availability を更新する", () => {
    renderStore();
    const newAvailability: AvailabilitySettings = {
      weeklySchedule: { 2: [{ start: "17:00", end: "18:30" }] },
      dateOverrides: {},
    };
    act(() => {
      getStore().setAvailability(newAvailability);
    });
    expect(getStore().data.availability).toEqual(newAvailability);
  });

  it("resetAll が data を initialData 相当にリセットする", () => {
    renderStore();
    act(() => {
      getStore().completeOnboarding({
        subjects: [subject],
        chapters: [chapter()],
        availability,
      });
    });
    expect(getStore().data.onboarded).toBe(true);

    act(() => {
      getStore().resetAll();
    });
    expect(getStore().data).toEqual(initialData);
  });

  it("completeOnboarding に vocabRanges/vocabChunks を渡すと保存される（省略時は空配列のまま）", () => {
    renderStore();

    const vocabRange: VocabRange = {
      id: "r1",
      subjectId: "s1",
      label: "ターゲット1900",
      startNumber: 371,
      endNumber: 373,
    };
    const vocabChunks: VocabChunk[] = [
      {
        id: "r1-371-373",
        rangeId: "r1",
        startNumber: 371,
        endNumber: 373,
        introduced: false,
        box: 0,
        nextReviewDate: null,
        completed: false,
      },
    ];

    act(() => {
      getStore().completeOnboarding({
        subjects: [subject],
        chapters: [chapter()],
        availability,
        vocabRanges: [vocabRange],
        vocabChunks,
      });
    });

    expect(getStore().data.vocabRanges).toEqual([vocabRange]);
    expect(getStore().data.vocabChunks).toEqual(vocabChunks);
  });

  it("advanceVocabChunk: 未着手の枠に回答すると着手済みになり箱1に入る、既に着手済みならさらに箱が1つ上がる", () => {
    renderStore();

    const vocabRange: VocabRange = {
      id: "r1",
      subjectId: "s1",
      label: "ターゲット1900",
      startNumber: 1,
      endNumber: 40,
    };
    const vocabChunks: VocabChunk[] = [
      {
        id: "r1-1-20",
        rangeId: "r1",
        startNumber: 1,
        endNumber: 20,
        introduced: false,
        box: 0,
        nextReviewDate: null,
        completed: false,
      },
      {
        id: "r1-21-40",
        rangeId: "r1",
        startNumber: 21,
        endNumber: 40,
        introduced: true,
        box: 2,
        nextReviewDate: "2020-01-01",
        completed: false,
      },
    ];

    act(() => {
      getStore().completeOnboarding({
        subjects: [subject],
        chapters: [chapter()],
        availability,
        vocabRanges: [vocabRange],
        vocabChunks,
      });
    });

    act(() => {
      getStore().advanceVocabChunk("r1-1-20");
    });
    const chunk1 = getStore().data.vocabChunks.find((c) => c.id === "r1-1-20");
    expect(chunk1?.introduced).toBe(true);
    expect(chunk1?.box).toBe(1);

    act(() => {
      getStore().advanceVocabChunk("r1-21-40");
    });
    const chunk2 = getStore().data.vocabChunks.find((c) => c.id === "r1-21-40");
    expect(chunk2?.box).toBe(3);
  });

  it("completeVocabChunk: 指定した枠の completed を true にする（box/nextReviewDateは変えない）", () => {
    renderStore();

    const vocabRange: VocabRange = {
      id: "r1",
      subjectId: "s1",
      label: "ターゲット1900",
      startNumber: 1,
      endNumber: 20,
    };
    const vocabChunks: VocabChunk[] = [
      {
        id: "r1-1-20",
        rangeId: "r1",
        startNumber: 1,
        endNumber: 20,
        introduced: true,
        box: 3,
        nextReviewDate: "2026-07-10",
        completed: false,
      },
    ];

    act(() => {
      getStore().completeOnboarding({
        subjects: [subject],
        chapters: [chapter()],
        availability,
        vocabRanges: [vocabRange],
        vocabChunks,
      });
    });

    act(() => {
      getStore().completeVocabChunk("r1-1-20");
    });
    const chunk = getStore().data.vocabChunks.find((c) => c.id === "r1-1-20");
    expect(chunk?.completed).toBe(true);
    expect(chunk?.box).toBe(3);
    expect(chunk?.nextReviewDate).toBe("2026-07-10");
  });

  it("saveError: 保存失敗時に true、成功に戻れば false に戻る", () => {
    renderStore();

    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    act(() => {
      getStore().setAvailability(availability);
    });
    expect(getStore().saveError).toBe(true);

    spy.mockRestore();

    act(() => {
      getStore().setAvailability({ ...availability, dateOverrides: {} });
    });
    expect(getStore().saveError).toBe(false);
  });
});
