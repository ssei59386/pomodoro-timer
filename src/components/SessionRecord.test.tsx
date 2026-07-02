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
    {
      id: "c3",
      subjectId: "s1",
      name: "確率",
      pointWeight: 15,
      understanding: 0.3,
      targetUnderstanding: 0.8,
      lastStudiedDate: null,
      subtopics: [
        { id: "st1", name: "場合の数" },
        { id: "st2", name: "条件付き確率" },
      ],
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
  preselectSubtopicId?: string | null;
  onDone?: () => void;
  onGoSettings?: () => void;
}) {
  return render(
    <StoreProvider>
      <Probe />
      <SessionRecord
        preselectChapterId={props.preselectChapterId ?? null}
        preselectSubtopicId={props.preselectSubtopicId ?? null}
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

  it("解いた問題数を入力して保存すると recordSession に problemsCompleted が渡る", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));
    renderSessionRecord({});

    const select = document.querySelector("select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "c1" } });

    const numberInputs = document.querySelectorAll(
      'input[type="number"]',
    ) as NodeListOf<HTMLInputElement>;
    const problemsInput = numberInputs[1];
    fireEvent.change(problemsInput, { target: { value: "12" } });

    fireEvent.click(screen.getByText("記録して理解度を更新"));

    expect(latestData?.sessions).toHaveLength(1);
    expect(latestData?.sessions[0]).toMatchObject({
      chapterId: "c1",
      problemsCompleted: 12,
    });
  });

  it("解いた問題数を未入力のまま保存すると problemsCompleted は undefined のまま渡る", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));
    renderSessionRecord({});

    const select = document.querySelector("select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "c1" } });

    fireEvent.click(screen.getByText("記録して理解度を更新"));

    expect(latestData?.sessions).toHaveLength(1);
    expect(latestData?.sessions[0].problemsCompleted).toBeUndefined();
  });

  it("preselectChapterId が渡されたとき、その章が初期選択される", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));
    renderSessionRecord({ preselectChapterId: "c2" });

    const select = document.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("c2");
  });

  it("小項目を持たない章を選んでいるときは小項目選択が表示されない", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));
    renderSessionRecord({ preselectChapterId: "c1" });

    expect(screen.queryByText("小項目")).toBeNull();
  });

  it("小項目を持つ章を選ぶと小項目選択が表示され、選ばずに保存すると subtopicId は渡されない", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));
    renderSessionRecord({ preselectChapterId: "c3" });

    expect(screen.getByText("小項目")).toBeDefined();
    const selects = document.querySelectorAll("select") as NodeListOf<HTMLSelectElement>;
    const subtopicSelect = selects[1];
    expect(subtopicSelect.value).toBe("");

    fireEvent.click(screen.getByText("記録して理解度を更新"));

    expect(latestData?.sessions).toHaveLength(1);
    expect(latestData?.sessions[0].chapterId).toBe("c3");
    expect(latestData?.sessions[0].subtopicId).toBeUndefined();
  });

  it("小項目を選んで保存すると recordSession に subtopicId が渡される", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));
    renderSessionRecord({ preselectChapterId: "c3" });

    const selects = document.querySelectorAll("select") as NodeListOf<HTMLSelectElement>;
    const subtopicSelect = selects[1];
    fireEvent.change(subtopicSelect, { target: { value: "st2" } });

    fireEvent.click(screen.getByText("記録して理解度を更新"));

    expect(latestData?.sessions[0]).toMatchObject({
      chapterId: "c3",
      subtopicId: "st2",
    });
  });

  it("小項目を選んだ状態で基礎/発展の問題数を入力して保存すると、recordSession に basicProblemsCompleted/advancedProblemsCompleted が渡り problemsCompleted は渡らない", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));
    renderSessionRecord({ preselectChapterId: "c3" });

    const selects = document.querySelectorAll("select") as NodeListOf<HTMLSelectElement>;
    fireEvent.change(selects[1], { target: { value: "st1" } });

    const numberInputs = document.querySelectorAll(
      'input[type="number"]',
    ) as NodeListOf<HTMLInputElement>;
    // 0: かけた時間, 1: 基礎で解いた問題数, 2: 発展で解いた問題数
    fireEvent.change(numberInputs[1], { target: { value: "5" } });
    fireEvent.change(numberInputs[2], { target: { value: "2" } });

    fireEvent.click(screen.getByText("記録して理解度を更新"));

    expect(latestData?.sessions).toHaveLength(1);
    expect(latestData?.sessions[0]).toMatchObject({
      chapterId: "c3",
      subtopicId: "st1",
      basicProblemsCompleted: 5,
      advancedProblemsCompleted: 2,
    });
    expect(latestData?.sessions[0].problemsCompleted).toBeUndefined();
  });

  it("小項目未選択（章全体）で保存すると problemsCompleted だけが渡り basic/advancedProblemsCompleted は渡らない", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));
    renderSessionRecord({ preselectChapterId: "c1" });

    const numberInputs = document.querySelectorAll(
      'input[type="number"]',
    ) as NodeListOf<HTMLInputElement>;
    const problemsInput = numberInputs[1];
    fireEvent.change(problemsInput, { target: { value: "8" } });

    fireEvent.click(screen.getByText("記録して理解度を更新"));

    expect(latestData?.sessions).toHaveLength(1);
    expect(latestData?.sessions[0]).toMatchObject({
      chapterId: "c1",
      problemsCompleted: 8,
    });
    expect(latestData?.sessions[0].basicProblemsCompleted).toBeUndefined();
    expect(latestData?.sessions[0].advancedProblemsCompleted).toBeUndefined();
  });

  it("小項目選択→問題数入力→章全体に戻す、という操作をすると problemsCompleted はリセットされ古い値が復活しない", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));
    renderSessionRecord({ preselectChapterId: "c1" });

    // 章全体のまま「解いた問題数」に値を入れる
    let numberInputs = document.querySelectorAll(
      'input[type="number"]',
    ) as NodeListOf<HTMLInputElement>;
    fireEvent.change(numberInputs[1], { target: { value: "9" } });

    // 章を切り替えて小項目を選択する（c3 は小項目を持つ）
    const chapterSelect = document.querySelectorAll("select")[0] as HTMLSelectElement;
    fireEvent.change(chapterSelect, { target: { value: "c3" } });
    const subtopicSelect = document.querySelectorAll("select")[1] as HTMLSelectElement;
    fireEvent.change(subtopicSelect, { target: { value: "st1" } });

    // 章全体に戻す
    fireEvent.change(subtopicSelect, {
      target: { value: "__whole_chapter__" },
    });

    fireEvent.click(screen.getByText("記録して理解度を更新"));

    expect(latestData?.sessions).toHaveLength(1);
    expect(latestData?.sessions[0].problemsCompleted).toBeUndefined();
  });

  it("preselectSubtopicId が渡されたとき、章と一緒に小項目も初期選択される", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));
    renderSessionRecord({ preselectChapterId: "c3", preselectSubtopicId: "st2" });

    const selects = document.querySelectorAll("select") as NodeListOf<HTMLSelectElement>;
    expect(selects[0].value).toBe("c3");
    expect(selects[1].value).toBe("st2");
  });

  it("章を切り替えると小項目選択がリセットされる", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));
    renderSessionRecord({ preselectChapterId: "c3" });

    let selects = document.querySelectorAll("select") as NodeListOf<HTMLSelectElement>;
    fireEvent.change(selects[1], { target: { value: "st1" } });
    expect((document.querySelectorAll("select")[1] as HTMLSelectElement).value).toBe("st1");

    const chapterSelect = document.querySelectorAll("select")[0] as HTMLSelectElement;
    fireEvent.change(chapterSelect, { target: { value: "c1" } });

    // c1 は小項目を持たないので、小項目選択自体が消える
    expect(screen.queryByText("小項目")).toBeNull();

    fireEvent.change(chapterSelect, { target: { value: "c3" } });
    selects = document.querySelectorAll("select") as NodeListOf<HTMLSelectElement>;
    expect(selects[1].value).toBe("");
  });
});
