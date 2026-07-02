import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SessionRecord } from "./SessionRecord";
import { StoreProvider, useStore } from "../store";
import type { AppData } from "../types";

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
    {
      id: "c2",
      subjectId: "s1",
      name: "図形の性質",
      pointWeight: 10,
      understanding: 0.5,
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

// data.sessions を画面外から検証するためのプローブ。App.test.tsx/store.test.tsx と同じ手法。
let latestData: AppData | null = null;

function Probe() {
  latestData = useStore().data;
  return null;
}

function renderSessionRecord(props: {
  preselectChapterId?: string | null;
  onDone?: () => void;
  onGoSettings?: () => void;
}) {
  return render(
    <StoreProvider>
      <Probe />
      <SessionRecord
        preselectChapterId={props.preselectChapterId ?? null}
        onDone={props.onDone ?? (() => {})}
        onGoSettings={props.onGoSettings ?? (() => {})}
      />
    </StoreProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  latestData = null;
});

afterEach(() => {
  cleanup();
});

describe("SessionRecord", () => {
  it("章が無いときは空状態メッセージとボタンが表示され、押すと onGoSettings が呼ばれる", () => {
    let called = false;
    renderSessionRecord({ onGoSettings: () => (called = true) });

    expect(screen.getByText("先に章を登録してください（設定から追加できます）。")).toBeDefined();
    const button = screen.getByText("設定で章を登録する");
    fireEvent.click(button);

    expect(called).toBe(true);
  });

  it("章があるとき、章選択・時間入力・正答率スライダー・手応え選択・保存ボタンが表示される", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));
    renderSessionRecord({});

    expect(screen.getByText("勉強した章")).toBeDefined();
    expect(document.querySelector("select")).not.toBeNull();
    expect(document.querySelector('input[type="number"]')).not.toBeNull();
    expect(document.querySelector('input[type="range"]')).not.toBeNull();
    expect(screen.getByRole("radiogroup")).toBeDefined();
    expect(screen.getByText("記録して理解度を更新")).toBeDefined();
  });

  it("保存ボタンを押すと recordSession が正しい入力でセッションを記録する", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));
    renderSessionRecord({});

    const select = document.querySelector("select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "c1" } });

    const minutesInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(minutesInput, { target: { value: "30" } });

    const rangeInput = document.querySelector('input[type="range"]') as HTMLInputElement;
    fireEvent.change(rangeInput, { target: { value: "80" } });

    const selfReportButtons = screen.getAllByRole("radio");
    fireEvent.click(selfReportButtons[3]); // 4: できる

    const saveButton = screen.getByText("記録して理解度を更新");
    fireEvent.click(saveButton);

    expect(latestData?.sessions).toHaveLength(1);
    expect(latestData?.sessions[0]).toMatchObject({
      chapterId: "c1",
      minutes: 30,
      correctRate: 0.8,
      selfReport: 4,
    });
  });

  it("preselectChapterId が渡されたとき、その章が初期選択される", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));
    renderSessionRecord({ preselectChapterId: "c2" });

    const select = document.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("c2");
  });
});
