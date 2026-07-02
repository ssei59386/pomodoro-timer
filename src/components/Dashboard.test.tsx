import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Dashboard } from "./Dashboard";
import { StoreProvider } from "../store";
import type { AppData } from "../types";

const emptyChaptersData: AppData = {
  subjects: [{ id: "s1", name: "数学", testDate: "2026-08-01" }],
  chapters: [],
  sessions: [],
  availability: { weeklySchedule: {}, dateOverrides: {} },
  onboarded: true,
};

const twoSubjectsData: AppData = {
  subjects: [
    { id: "s1", name: "数学", testDate: "2026-08-01" },
    { id: "s2", name: "理科", testDate: "2026-08-10" },
  ],
  chapters: [
    {
      id: "c1",
      subjectId: "s1",
      name: "二次関数",
      pointWeight: 20,
      understanding: 0.4,
      targetUnderstanding: 0.8,
      lastStudiedDate: null,
    },
    {
      id: "c2",
      subjectId: "s2",
      name: "化学変化",
      pointWeight: 15,
      understanding: 0.6,
      targetUnderstanding: 0.8,
      lastStudiedDate: null,
    },
  ],
  sessions: [],
  availability: { weeklySchedule: {}, dateOverrides: {} },
  onboarded: true,
};

function renderDashboard(onGoSettings: () => void = () => {}) {
  return render(
    <StoreProvider>
      <Dashboard onGoSettings={onGoSettings} />
    </StoreProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("Dashboard", () => {
  it("章が無い教科は「章がありません。」とボタンが表示され、押すと onGoSettings が呼ばれる", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(emptyChaptersData));
    let called = false;
    renderDashboard(() => (called = true));

    expect(screen.getByText("章がありません。")).toBeDefined();
    fireEvent.click(screen.getByText("設定で章を登録する"));

    expect(called).toBe(true);
  });

  it("章があるとき、章名・理解度・目標・配点・テストまでの日数が表示される", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(twoSubjectsData));
    renderDashboard();

    expect(screen.getByText("二次関数")).toBeDefined();
    expect(screen.getByText("40% / 目標 80%")).toBeDefined();
    expect(screen.getByText(/配点 20 点/)).toBeDefined();
    expect(screen.getAllByText(/テストまで \d+ 日/).length).toBeGreaterThan(0);
  });

  it("複数教科があるとき、教科ごとにセクションが分かれて表示される", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(twoSubjectsData));
    renderDashboard();

    expect(screen.getByText("数学")).toBeDefined();
    expect(screen.getByText("理科")).toBeDefined();
    expect(screen.getByText("二次関数")).toBeDefined();
    expect(screen.getByText("化学変化")).toBeDefined();

    const sections = document.querySelectorAll("section.card");
    expect(sections).toHaveLength(2);
  });
});
