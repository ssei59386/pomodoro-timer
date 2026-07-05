import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Settings } from "./Settings";
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
      subtopics: [{ id: "st1", name: "頂点" }],
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
  vocabRanges: [],
  vocabChunks: [],
  todayPlan: null,
  onboarded: true,
};

// 暗記範囲（旧・単語帳）セクションは数学・理科の教科カードには出さない設計（社会・国語への展開に
// 伴う仕様変更）ため、暗記範囲まわりのテストは数学ではなく英語の教科で行う。
const englishOnboardedData: AppData = {
  ...onboardedData,
  subjects: [{ id: "s1", name: "英語", testDate: "2026-08-01" }],
};

// data を画面外から検証するためのプローブ。SessionRecord.test.tsx と同じ手法。
let latestData: AppData | null = null;

function Probe() {
  latestData = useStore().data;
  return null;
}

function renderSettings() {
  return render(
    <StoreProvider>
      <Probe />
      <Settings />
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

describe("Settings", () => {
  it("週間スケジュールの時間帯を追加すると setAvailability 経由で保存される", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));
    renderSettings();

    const addButtons = screen.getAllByText("＋ 時間帯を追加");
    fireEvent.click(addButtons[0]);

    const timeInputs = document.querySelectorAll('input[type="time"]');
    expect(timeInputs.length).toBeGreaterThan(2); // 元々の月曜1件 + 追加分

    const [startInput] = Array.from(timeInputs) as HTMLInputElement[];
    fireEvent.change(startInput, { target: { value: "20:00" } });

    const updatedSlots = Object.values(latestData?.availability.weeklySchedule ?? {}).flat();
    expect(updatedSlots.some((s) => s?.start === "20:00")).toBe(true);
  });

  it("章を削除ボタンで押すと removeChapter が呼ばれ章が消える", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));
    renderSettings();

    expect(screen.getByDisplayValue("二次関数")).toBeDefined();

    const removeButtons = screen.getAllByLabelText("章を削除");
    fireEvent.click(removeButtons[0]);

    expect(screen.queryByDisplayValue("二次関数")).toBeNull();
    expect(latestData?.chapters).toHaveLength(1);
    expect(latestData?.chapters[0].name).toBe("図形の性質");
  });

  it("章の配点を変更すると updateChapter 経由で反映される", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));
    renderSettings();

    const pointWeightInput = screen.getByDisplayValue("20") as HTMLInputElement;
    fireEvent.change(pointWeightInput, { target: { value: "35" } });

    expect(latestData?.chapters.find((c) => c.id === "c1")?.pointWeight).toBe(35);
  });

  it("＋ 章を追加ボタンで新しい章が追加される", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));
    renderSettings();

    fireEvent.click(screen.getByText("＋ 章を追加"));

    expect(latestData?.chapters).toHaveLength(3);
    expect(latestData?.chapters[2].name).toBe("新しい章");
  });

  it("小項目の追加・リネーム・削除ができる", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));
    renderSettings();

    // 既存の小項目「頂点」が表示されている
    expect(screen.getByDisplayValue("頂点")).toBeDefined();

    // 追加
    const addSubtopicButtons = screen.getAllByText("＋ 小項目を追加");
    fireEvent.click(addSubtopicButtons[0]);
    expect(latestData?.chapters.find((c) => c.id === "c1")?.subtopics).toHaveLength(2);

    // リネーム
    const nameInput = screen.getByDisplayValue("頂点") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "軸" } });
    expect(
      latestData?.chapters.find((c) => c.id === "c1")?.subtopics?.[0].name,
    ).toBe("軸");

    // 削除
    const removeSubtopicButtons = screen.getAllByLabelText("小項目を削除");
    fireEvent.click(removeSubtopicButtons[0]);
    expect(latestData?.chapters.find((c) => c.id === "c1")?.subtopics).toHaveLength(1);
  });

  it("小項目の基礎問題数・発展問題数を入力すると反映される", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));
    renderSettings();

    const basicInput = screen.getByPlaceholderText("教科書の例題+問題集の基礎問題") as HTMLInputElement;
    fireEvent.change(basicInput, { target: { value: "12" } });
    expect(
      latestData?.chapters.find((c) => c.id === "c1")?.subtopics?.[0].basicProblems,
    ).toBe(12);

    const advancedInput = screen.getByPlaceholderText("教科書+問題集の発展問題") as HTMLInputElement;
    fireEvent.change(advancedInput, { target: { value: "5" } });
    expect(
      latestData?.chapters.find((c) => c.id === "c1")?.subtopics?.[0].advancedProblems,
    ).toBe(5);
  });

  it("小項目名にカリキュラム候補が一致すると候補が表示され、選ぶとdifficultyLevelのみ反映され名前は変わらない", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));
    renderSettings();

    const nameInput = screen.getByDisplayValue("頂点") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "正負の数の意味・数直線・絶対値" } });

    const suggestion = screen.getByText("正負の数の意味・数直線・絶対値", { selector: ".curriculum-suggest-name" });
    fireEvent.mouseDown(suggestion);

    const subtopic = latestData?.chapters.find((c) => c.id === "c1")?.subtopics?.[0];
    expect(subtopic?.name).toBe("正負の数の意味・数直線・絶対値"); // ユーザー入力した名前のまま（上書きされない）
    expect(subtopic?.difficultyLevel).toBe(1);
  });

  it("小項目の「先生からテストのヒントがあった」チェックボックスが teacherHinted として反映される", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));
    renderSettings();

    const hintCheckbox = screen.getByLabelText("先生からテストのヒントがあった") as HTMLInputElement;
    expect(hintCheckbox.checked).toBe(false);
    fireEvent.click(hintCheckbox);

    expect(
      latestData?.chapters.find((c) => c.id === "c1")?.subtopics?.[0].teacherHinted,
    ).toBe(true);
  });

  it("特別な予定（カレンダー）セクションが組み込まれている", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));
    renderSettings();

    expect(screen.getByText("特別な予定（カレンダー）")).toBeDefined();
    expect(document.querySelector(".calendar-grid")).not.toBeNull();
  });

  it("データをリセットボタンで確認状態になり、本当に削除するを押すと resetAll が呼ばれる", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));
    renderSettings();

    fireEvent.click(screen.getByText("データをリセット"));
    expect(screen.getByText("本当に削除する")).toBeDefined();

    fireEvent.click(screen.getByText("本当に削除する"));

    expect(latestData?.onboarded).toBe(false);
    expect(latestData?.chapters).toHaveLength(0);
  });

  it("単語帳の範囲を追加できる（オンボーディング後に追加する運用ができなかった問題の修正）", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(englishOnboardedData));
    renderSettings();

    fireEvent.change(screen.getByPlaceholderText("ラベル（例：ターゲット1900）"), {
      target: { value: "ターゲット1900" },
    });
    fireEvent.change(screen.getByPlaceholderText("例：371"), { target: { value: "371" } });
    fireEvent.change(screen.getByPlaceholderText("例：670"), { target: { value: "670" } });
    fireEvent.click(screen.getByText("＋ 暗記範囲を追加"));

    expect(latestData?.vocabRanges).toHaveLength(1);
    expect(latestData?.vocabRanges[0]).toMatchObject({
      label: "ターゲット1900",
      subjectId: "s1",
      startNumber: 371,
      endNumber: 670,
    });
    expect(latestData?.vocabChunks).toHaveLength(300 / 20);
    expect(screen.getByText("ターゲット1900（371〜670番）")).toBeDefined();
  });

  it("ラベルが空欄のまま追加しようとするとエラーが表示され追加されない", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(englishOnboardedData));
    renderSettings();

    fireEvent.change(screen.getByPlaceholderText("例：371"), { target: { value: "1" } });
    fireEvent.change(screen.getByPlaceholderText("例：670"), { target: { value: "10" } });
    fireEvent.click(screen.getByText("＋ 暗記範囲を追加"));

    expect(screen.getByText("暗記範囲のラベルを入力してください。")).toBeDefined();
    expect(latestData?.vocabRanges).toHaveLength(0);
  });

  it("登録済みの単語帳の範囲を削除できる", () => {
    localStorage.setItem(
      "study-planner-data-v1",
      JSON.stringify({
        ...englishOnboardedData,
        vocabRanges: [{ id: "r1", subjectId: "s1", label: "ターゲット1900", startNumber: 371, endNumber: 373 }],
        vocabChunks: [
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
        ],
      }),
    );
    renderSettings();

    expect(screen.getByText("ターゲット1900（371〜373番）")).toBeDefined();
    fireEvent.click(screen.getByLabelText("暗記範囲を削除"));

    expect(latestData?.vocabRanges).toHaveLength(0);
    expect(latestData?.vocabChunks).toHaveLength(0);
    expect(screen.queryByText("ターゲット1900（371〜373番）")).toBeNull();
  });

  it("数学・理科の教科カードには暗記範囲セクションが表示されない", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(onboardedData));
    renderSettings();

    expect(screen.queryByText("暗記範囲")).toBeNull();
  });

  it("社会・国語の教科カードには暗記範囲セクションが表示され、それぞれ登録・削除できる", () => {
    const socialJapaneseData: AppData = {
      ...onboardedData,
      subjects: [
        { id: "s2", name: "社会", testDate: "2026-08-01" },
        { id: "s3", name: "国語", testDate: "2026-08-01" },
      ],
      chapters: [],
      vocabRanges: [
        { id: "r-social", subjectId: "s2", label: "一問一答 歴史", startNumber: 1, endNumber: 20 },
        { id: "r-japanese", subjectId: "s3", label: "漢字ドリル", startNumber: 1, endNumber: 20 },
      ],
      vocabChunks: [
        {
          id: "r-social-1-20",
          rangeId: "r-social",
          startNumber: 1,
          endNumber: 20,
          introduced: false,
          box: 0,
          nextReviewDate: null,
          completed: false,
        },
        {
          id: "r-japanese-1-20",
          rangeId: "r-japanese",
          startNumber: 1,
          endNumber: 20,
          introduced: false,
          box: 0,
          nextReviewDate: null,
          completed: false,
        },
      ],
    };
    localStorage.setItem("study-planner-data-v1", JSON.stringify(socialJapaneseData));
    renderSettings();

    expect(screen.getAllByText("暗記範囲")).toHaveLength(2);
    expect(screen.getByText("一問一答 歴史（1〜20番）")).toBeDefined();
    expect(screen.getByText("漢字ドリル（1〜20番）")).toBeDefined();

    const removeButtons = screen.getAllByLabelText("暗記範囲を削除");
    fireEvent.click(removeButtons[0]);

    expect(latestData?.vocabRanges).toHaveLength(1);
    expect(latestData?.vocabRanges[0].id).toBe("r-japanese");
  });
});
