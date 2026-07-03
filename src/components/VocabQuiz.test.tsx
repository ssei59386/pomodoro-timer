import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VocabQuiz } from "./VocabQuiz";
import { StoreProvider } from "../store";
import { toISODate } from "../logic";
import type { AppData } from "../types";

// pace 計算（calculateDailyNewVocabPace）が新規2枠とも今日出題対象になるよう、
// テスト日を「明日」にして daysLeft を 1 に固定する（未着手2枠 ÷ 1日 = 2枠）。
const tomorrow = toISODate(new Date(Date.now() + 24 * 60 * 60 * 1000));
const yesterday = "2020-01-01"; // 復習期限（nextReviewDate）が過去であればよく、絶対値は関係ない

const dataWithVocab: AppData = {
  subjects: [{ id: "s1", name: "英語", testDate: tomorrow }],
  chapters: [],
  sessions: [],
  availability: { weeklySchedule: {}, dateOverrides: {} },
  vocabRanges: [{ id: "r1", subjectId: "s1", label: "ターゲット1900", startNumber: 1, endNumber: 60 }],
  vocabChunks: [
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
      introduced: false,
      box: 0,
      nextReviewDate: null,
      completed: false,
    },
    {
      id: "r1-41-60",
      rangeId: "r1",
      startNumber: 41,
      endNumber: 60,
      introduced: true,
      box: 2,
      nextReviewDate: yesterday,
      completed: false,
    },
  ],
  onboarded: true,
};

const emptyVocabData: AppData = {
  subjects: [],
  chapters: [],
  sessions: [],
  availability: { weeklySchedule: {}, dateOverrides: {} },
  vocabRanges: [],
  vocabChunks: [],
  onboarded: true,
};

function renderQuiz(onDone: () => void = () => {}) {
  return render(
    <StoreProvider>
      <VocabQuiz onDone={onDone} />
    </StoreProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("VocabQuiz", () => {
  it("今日取り組む単語がないときは空メッセージと戻るボタンが表示される", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(emptyVocabData));
    let done = false;
    renderQuiz(() => (done = true));

    expect(screen.getByText("今日取り組む単語はありません。")).toBeDefined();
    fireEvent.click(screen.getByText("戻る"));
    expect(done).toBe(true);
  });

  it("新規・復習あわせて3枠が順番に出題され、意味テキストは一切表示されない", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(dataWithVocab));
    renderQuiz();

    expect(screen.getByText("1 / 3 枠目")).toBeDefined();
    // 番号の範囲だけが表示され、意味・単語そのもののテキストは登場しない
    expect(screen.getByText("1〜20 番")).toBeDefined();
    expect(screen.getByText("ターゲット1900")).toBeDefined();
  });

  it("「まだ完璧じゃない」「完璧になった」で回答すると次の枠に進み、最後は完了画面になる（「完璧になった」は2回タップで確定）", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(dataWithVocab));
    let done = false;
    renderQuiz(() => (done = true));

    // 誤タップ即確定を防ぐ2段階確認（ux-reviewer指摘）：1回目のタップではまだ確定しない
    fireEvent.click(screen.getByText("完璧になった"));
    expect(screen.getByText("1 / 3 枠目")).toBeDefined();
    expect(screen.getByText("本当に完璧？もう一度タップで確定")).toBeDefined();

    // 同じ場所をもう一度タップして初めて確定する
    fireEvent.click(screen.getByText("本当に完璧？もう一度タップで確定"));
    expect(screen.getByText("2 / 3 枠目")).toBeDefined();

    fireEvent.click(screen.getByText("まだ完璧じゃない"));
    expect(screen.getByText("3 / 3 枠目")).toBeDefined();

    fireEvent.click(screen.getByText("完璧になった"));
    fireEvent.click(screen.getByText("本当に完璧？もう一度タップで確定"));

    expect(screen.getByText(/3枠中 2枠が「完璧になった」でした/)).toBeDefined();
    fireEvent.click(screen.getByText("ホームに戻る"));
    expect(done).toBe(true);

    const saved = JSON.parse(localStorage.getItem("study-planner-data-v1") ?? "{}") as AppData;
    const chunk1 = saved.vocabChunks.find((c) => c.id === "r1-1-20");
    // 「完璧になった」を選んだ枠は completed になる
    expect(chunk1?.completed).toBe(true);

    const chunk2 = saved.vocabChunks.find((c) => c.id === "r1-21-40");
    // 「まだ完璧じゃない」を選んだ未着手の枠は、箱1からスタートする
    expect(chunk2?.introduced).toBe(true);
    expect(chunk2?.box).toBe(1);
    expect(chunk2?.completed).toBe(false);
  });

  it("「完璧になった」の確認状態中に「まだ完璧じゃない」を押すと、確定されずその枠は復習継続として記録される", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(dataWithVocab));
    renderQuiz();

    fireEvent.click(screen.getByText("完璧になった"));
    expect(screen.getByText("本当に完璧？もう一度タップで確定")).toBeDefined();

    fireEvent.click(screen.getByText("まだ完璧じゃない"));
    expect(screen.getByText("2 / 3 枠目")).toBeDefined();

    const saved = JSON.parse(localStorage.getItem("study-planner-data-v1") ?? "{}") as AppData;
    const chunk1 = saved.vocabChunks.find((c) => c.id === "r1-1-20");
    expect(chunk1?.completed).toBe(false);
    expect(chunk1?.introduced).toBe(true);
    expect(chunk1?.box).toBe(1);
  });
});
