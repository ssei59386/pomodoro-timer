import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Home } from "./Home";
import { StoreProvider } from "../store";
import type { AppData } from "../types";

// 何曜日にテストが実行されても today の空き時間が確保されるよう、全曜日に時間帯を設定する
const everydaySchedule = {
  0: [{ start: "09:00", end: "12:00" }],
  1: [{ start: "09:00", end: "12:00" }],
  2: [{ start: "09:00", end: "12:00" }],
  3: [{ start: "09:00", end: "12:00" }],
  4: [{ start: "09:00", end: "12:00" }],
  5: [{ start: "09:00", end: "12:00" }],
  6: [{ start: "09:00", end: "12:00" }],
};

const futureTestDate = "2099-12-31";

const chapterOnlyData: AppData = {
  subjects: [{ id: "s1", name: "数学", testDate: futureTestDate }],
  chapters: [
    {
      id: "c1",
      subjectId: "s1",
      name: "二次関数",
      pointWeight: 40,
      understanding: 0.2,
      targetUnderstanding: 0.8,
      lastStudiedDate: null,
    },
  ],
  sessions: [],
  availability: { weeklySchedule: everydaySchedule, dateOverrides: {} },
  onboarded: true,
};

const subtopicChapterData: AppData = {
  subjects: [{ id: "s1", name: "数学", testDate: futureTestDate }],
  chapters: [
    {
      id: "c1",
      subjectId: "s1",
      name: "確率",
      pointWeight: 40,
      understanding: 0.2,
      targetUnderstanding: 0.8,
      lastStudiedDate: null,
      metadata: { learningScope: "教科書p.10-20" },
      subtopics: [
        { id: "st1", name: "場合の数", understanding: 0.1, basicProblems: 5, teacherHinted: true },
        { id: "st2", name: "条件付き確率", understanding: 0.1, basicProblems: 5 },
      ],
    },
  ],
  sessions: [],
  availability: { weeklySchedule: everydaySchedule, dateOverrides: {} },
  onboarded: true,
};

function renderHome(onRecord: (chapterId?: string, subtopicId?: string) => void = () => {}) {
  return render(
    <StoreProvider>
      <Home onRecord={onRecord} onGoSettings={() => {}} />
    </StoreProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("Home", () => {
  it("小項目を持たない章のみのとき、章単位のプランが表示される", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(chapterOnlyData));
    renderHome();

    expect(screen.getByText("二次関数")).toBeDefined();
    expect(document.querySelectorAll(".plan-card")).toHaveLength(1);
    expect(document.querySelector(".plan-subtopic-name")).toBeNull();
  });

  it("小項目を持つ章のプランでは、小項目名がカードに表示される（1件目は章名+矢印表記、2件目以降は章名の繰り返しを避けて小項目名が見出しになる）", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(subtopicChapterData));
    renderHome();

    expect(screen.getAllByText("確率").length).toBeGreaterThan(0);
    const subtopicNames = Array.from(document.querySelectorAll(".plan-subtopic-name")).map(
      (el) => el.textContent,
    );
    expect(subtopicNames).toContain("→ 場合の数");

    const headings = Array.from(document.querySelectorAll(".plan-card h3")).map(
      (el) => el.textContent,
    );
    expect(headings).toContain("条件付き確率");
  });

  it("小項目を持つ章で「終わった → 記録する」を押すと、章IDと小項目IDの両方で onRecord が呼ばれる", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(subtopicChapterData));
    let called: [string | undefined, string | undefined] | null = null;
    renderHome((chapterId, subtopicId) => (called = [chapterId, subtopicId]));

    const buttons = screen.getAllByText("終わった → 記録する");
    fireEvent.click(buttons[0]);

    expect(called).not.toBeNull();
    expect(called?.[0]).toBe("c1");
    expect(["st1", "st2"]).toContain(called?.[1]);
  });

  it("小項目を持たない章で「終わった → 記録する」を押すと、onRecord は章IDのみ（第2引数 undefined）で呼ばれる", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(chapterOnlyData));
    let called: [string | undefined, string | undefined] | null = null;
    renderHome((chapterId, subtopicId) => (called = [chapterId, subtopicId]));

    fireEvent.click(screen.getByText("終わった → 記録する"));

    expect(called).toEqual(["c1", undefined]);
  });

  it("同じ章の小項目が2件以上連続するとき、2件目以降は小項目名が見出しになり「章名の続き」と表示される", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(subtopicChapterData));
    renderHome();

    const cards = document.querySelectorAll(".plan-card");
    expect(cards.length).toBeGreaterThanOrEqual(2);

    const secondCard = cards[1];
    expect(secondCard.querySelector(".plan-chapter-continued")?.textContent).toBe("確率の続き");
    expect(secondCard.querySelector("h3")?.textContent).toBe("条件付き確率");
  });

  it("先生のヒントがある小項目は、通常の理由チップではなく独立したバッジで表示される", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(subtopicChapterData));
    renderHome();

    const badge = document.querySelector(".teacher-hint-badge");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain("先生のヒント");

    const reasonChipTexts = Array.from(document.querySelectorAll(".reason-chip")).map(
      (el) => el.textContent,
    );
    expect(reasonChipTexts).not.toContain("先生のヒントあり");
  });

  it("小項目が対象のカードでは、章に learningScope が設定されていても表示されない", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(subtopicChapterData));
    renderHome();

    expect(screen.queryByText(/教科書p\.10-20/)).toBeNull();
  });
});
