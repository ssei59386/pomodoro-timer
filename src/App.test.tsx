import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { App } from "./App";
import { StoreProvider } from "./store";
import type { AppData } from "./types";

function renderApp() {
  return render(
    <StoreProvider>
      <App />
    </StoreProvider>,
  );
}

const onboardedData: AppData = {
  subjects: [{ id: "s1", name: "数学", testDate: "2026-08-01" }],
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
  ],
  sessions: [],
  availability: {
    weeklySchedule: { 1: [{ start: "18:00", end: "19:00" }] },
    dateOverrides: {},
  },
  onboarded: true,
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("App", () => {
  it("未オンボーディング時はオンボーディング画面が表示され、タブバーは出ない", () => {
    renderApp();

    expect(screen.getByRole("heading", { name: "はじめの設定" })).toBeDefined();
    expect(screen.queryByText("今日")).toBeNull();
    expect(screen.queryByText("記録")).toBeNull();
    expect(screen.queryByText("理解度")).toBeNull();
    expect(screen.queryByText("設定")).toBeNull();
  });

  it("オンボーディング済みならタブバーとホーム画面が表示される", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));

    renderApp();

    expect(screen.getByText("定期テスト学習進捗管理")).toBeDefined();
    const tabBar = document.querySelector(".tab-bar");
    expect(tabBar).not.toBeNull();
    const tabButtons = tabBar!.querySelectorAll("button");
    expect(tabButtons).toHaveLength(4);
  });

  it("設定タブをクリックすると設定画面に切り替わる", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));

    renderApp();

    const settingsTab = screen.getByText("設定").closest("button");
    expect(settingsTab).not.toBeNull();
    fireEvent.click(settingsTab!);

    expect(screen.getByRole("heading", { name: "設定" })).toBeDefined();
  });
});
