import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { App } from "../App";
import { Onboarding } from "./Onboarding";
import { StoreProvider, useStore } from "../store";
import type { AppData } from "../types";

// jsdom は scrollIntoView 未実装のため、バリデーションエラー時の scrollToSection 呼び出しでも
// 例外にならないようにモックする。既存テストにも参照可能な前例が無いため新規に追加。
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

function renderApp() {
  return render(
    <StoreProvider>
      <App />
    </StoreProvider>,
  );
}

// 最小構成で埋めるヘルパー。章名・週間スケジュール（月曜の初期スロット）だけ入力する。
function fillMinimalChapterAndSchedule() {
  const chapterNameInput = screen.getByPlaceholderText("章名（例：二次関数）");
  fireEvent.change(chapterNameInput, { target: { value: "二次関数" } });

  const timeInputs = document.querySelectorAll('input[type="time"]') as NodeListOf<HTMLInputElement>;
  fireEvent.change(timeInputs[0], { target: { value: "18:00" } });
  fireEvent.change(timeInputs[1], { target: { value: "19:00" } });
}

describe("Onboarding（App経由の統合テスト）", () => {
  it("最小構成（教科1つ・章1つ・週間スケジュール1スロット）で送信すると onboarded になりホーム画面へ切り替わる", () => {
    renderApp();

    const mathDateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(mathDateInput, { target: { value: "2099-08-01" } });

    fillMinimalChapterAndSchedule();

    fireEvent.click(screen.getByText("この内容で始める"));

    expect(screen.queryByRole("heading", { name: "はじめの設定" })).toBeNull();
    expect(screen.getByText("定期テスト学習進捗管理")).toBeDefined();
    const tabBar = document.querySelector(".tab-bar");
    expect(tabBar).not.toBeNull();

    const saved = JSON.parse(localStorage.getItem("study-planner-data-v1") ?? "{}") as AppData;
    expect(saved.onboarded).toBe(true);
    expect(saved.chapters).toHaveLength(1);
    expect(saved.chapters[0].name).toBe("二次関数");
  });

  it("章名が空のまま送信するとエラーになり onboarded にならない", () => {
    renderApp();

    const mathDateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(mathDateInput, { target: { value: "2099-08-01" } });

    const timeInputs = document.querySelectorAll('input[type="time"]') as NodeListOf<HTMLInputElement>;
    fireEvent.change(timeInputs[0], { target: { value: "18:00" } });
    fireEvent.change(timeInputs[1], { target: { value: "19:00" } });

    fireEvent.click(screen.getByText("この内容で始める"));

    expect(screen.getByText("章を1つ以上登録してください。")).toBeDefined();
    expect(screen.getByRole("heading", { name: "はじめの設定" })).toBeDefined();

    const saved = JSON.parse(localStorage.getItem("study-planner-data-v1") ?? "{}") as AppData;
    expect(saved.onboarded).toBe(false);
  });

  it("週間スケジュールに有効なスロットが1つもないと送信できず、エディタにエラー表示が付く", () => {
    renderApp();

    const mathDateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(mathDateInput, { target: { value: "2099-08-01" } });

    const chapterNameInput = screen.getByPlaceholderText("章名（例：二次関数）");
    fireEvent.change(chapterNameInput, { target: { value: "二次関数" } });

    // 時間帯は未入力のまま送信する
    fireEvent.click(screen.getByText("この内容で始める"));

    expect(screen.getByText("勉強できる時間を少なくとも1つ設定してください。")).toBeDefined();
    expect(document.querySelector(".weekly-schedule-error")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "はじめの設定" })).toBeDefined();

    const saved = JSON.parse(localStorage.getItem("study-planner-data-v1") ?? "{}") as AppData;
    expect(saved.onboarded).toBe(false);
  });

  it("「特別な予定を設定する」ボタンで DateOverridesList セクションが展開表示される", () => {
    renderApp();

    expect(document.querySelector(".date-overrides-list")).toBeNull();

    fireEvent.click(screen.getByText("特別な予定を設定する"));

    expect(document.querySelector(".date-overrides-list")).not.toBeNull();
    expect(screen.queryByText("特別な予定を設定する")).toBeNull();
  });
});

// data を画面外から検証するためのプローブ。SessionRecord.test.tsx / Settings.test.tsx と同じ手法。
let latestData: AppData | null = null;

function Probe() {
  latestData = useStore().data;
  return null;
}

function renderOnboarding() {
  return render(
    <StoreProvider>
      <Probe />
      <Onboarding />
    </StoreProvider>,
  );
}

describe("Onboarding（小項目の反映）", () => {
  it("小項目（自己申告付き）を入力すると、completeOnboarding 経由で Chapter.subtopics に反映される", () => {
    renderOnboarding();

    const mathDateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(mathDateInput, { target: { value: "2099-08-01" } });

    const chapterNameInput = screen.getByPlaceholderText("章名（例：二次関数）");
    fireEvent.change(chapterNameInput, { target: { value: "二次関数" } });

    fireEvent.click(screen.getByText("＋ 小項目を追加"));
    fireEvent.click(screen.getByText("＋ 小項目を追加"));

    const subtopicNameInputs = screen.getAllByPlaceholderText("小項目名（例：頂点）");
    fireEvent.change(subtopicNameInputs[0], { target: { value: "頂点" } });
    fireEvent.change(subtopicNameInputs[1], { target: { value: "軸" } });

    // 小項目ごとの自己申告（radiogroup）が2つ表示されているはず。2つ目の小項目の自己申告を変更する。
    const radiogroups = screen.getAllByRole("radiogroup");
    const secondSubtopicRadios = within(radiogroups[1]).getAllByRole("radio");
    fireEvent.click(secondSubtopicRadios[4]); // 5: 人に教えられる

    const timeInputs = document.querySelectorAll('input[type="time"]') as NodeListOf<HTMLInputElement>;
    fireEvent.change(timeInputs[0], { target: { value: "18:00" } });
    fireEvent.change(timeInputs[1], { target: { value: "19:00" } });

    fireEvent.click(screen.getByText("この内容で始める"));

    expect(latestData?.onboarded).toBe(true);
    const chapter = latestData?.chapters[0];
    expect(chapter?.subtopics).toHaveLength(2);
    expect(chapter?.subtopics?.map((st) => st.name)).toEqual(["頂点", "軸"]);
    // 各小項目の自己申告が Chapter.subtopics[].understanding に個別反映されること（旧バグの修正確認）。
    // 1つ目はデフォルトの自己申告3 → 0.6、2つ目は5（人に教えられる）→ 1.0。
    expect(chapter?.subtopics?.[0].understanding).toBeCloseTo(0.6);
    expect(chapter?.subtopics?.[1].understanding).toBeCloseTo(1.0);
  });
});
