import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { StoreProvider, useStore } from "./store";
import { initialData } from "./storage";
import type { AvailabilitySettings, Chapter, ChapterSubtopic, Subject, VocabItem, VocabRange } from "./types";

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
    pointWeight: 20,
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
        pointWeight: 10,
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

  it("completeOnboarding に vocabRanges/vocabItems を渡すと保存される（省略時は空配列のまま）", () => {
    renderStore();

    const vocabRange: VocabRange = {
      id: "r1",
      subjectId: "s1",
      label: "ターゲット1900",
      startNumber: 371,
      endNumber: 373,
    };
    const vocabItems: VocabItem[] = [
      { id: "r1-371", rangeId: "r1", number: 371, introduced: false, box: 0, nextReviewDate: null },
    ];

    act(() => {
      getStore().completeOnboarding({
        subjects: [subject],
        chapters: [chapter()],
        availability,
        vocabRanges: [vocabRange],
        vocabItems,
      });
    });

    expect(getStore().data.vocabRanges).toEqual([vocabRange]);
    expect(getStore().data.vocabItems).toEqual(vocabItems);
  });

  it("recordVocabAnswer: 未着手の単語に回答すると着手済みになり箱1に入る、既に着手済みなら正誤で箱が上下する", () => {
    renderStore();

    const vocabRange: VocabRange = {
      id: "r1",
      subjectId: "s1",
      label: "ターゲット1900",
      startNumber: 1,
      endNumber: 2,
    };
    const vocabItems: VocabItem[] = [
      { id: "r1-1", rangeId: "r1", number: 1, introduced: false, box: 0, nextReviewDate: null },
      { id: "r1-2", rangeId: "r1", number: 2, introduced: true, box: 2, nextReviewDate: "2020-01-01" },
    ];

    act(() => {
      getStore().completeOnboarding({
        subjects: [subject],
        chapters: [chapter()],
        availability,
        vocabRanges: [vocabRange],
        vocabItems,
      });
    });

    act(() => {
      getStore().recordVocabAnswer("r1-1", false);
    });
    const item1 = getStore().data.vocabItems.find((i) => i.id === "r1-1");
    expect(item1?.introduced).toBe(true);
    expect(item1?.box).toBe(1);

    act(() => {
      getStore().recordVocabAnswer("r1-2", true);
    });
    const item2 = getStore().data.vocabItems.find((i) => i.id === "r1-2");
    expect(item2?.box).toBe(3);
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
