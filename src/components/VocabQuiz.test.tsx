import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VocabQuiz } from "./VocabQuiz";
import { StoreProvider } from "../store";
import { toISODate } from "../logic";
import type { AppData } from "../types";

// pace 計算（calculateDailyNewVocabPace）が新規2件とも今日出題対象になるよう、
// テスト日を「明日」にして daysLeft を 1 に固定する（未着手2件 ÷ 1日 = 2件）。
const tomorrow = toISODate(new Date(Date.now() + 24 * 60 * 60 * 1000));
const yesterday = "2020-01-01"; // 復習期限（nextReviewDate）が過去であればよく、絶対値は関係ない

const dataWithVocab: AppData = {
  subjects: [{ id: "s1", name: "英語", testDate: tomorrow }],
  chapters: [],
  sessions: [],
  availability: { weeklySchedule: {}, dateOverrides: {} },
  vocabRanges: [{ id: "r1", subjectId: "s1", label: "ターゲット1900", startNumber: 1, endNumber: 3 }],
  vocabItems: [
    { id: "r1-1", rangeId: "r1", number: 1, introduced: false, box: 0, nextReviewDate: null },
    { id: "r1-2", rangeId: "r1", number: 2, introduced: false, box: 0, nextReviewDate: null },
    { id: "r1-3", rangeId: "r1", number: 3, introduced: true, box: 2, nextReviewDate: yesterday },
  ],
  onboarded: true,
};

const emptyVocabData: AppData = {
  subjects: [],
  chapters: [],
  sessions: [],
  availability: { weeklySchedule: {}, dateOverrides: {} },
  vocabRanges: [],
  vocabItems: [],
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

  it("新規・復習あわせて3問が順番に出題され、意味テキストは一切表示されない", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(dataWithVocab));
    renderQuiz();

    expect(screen.getByText("1 / 3 問目")).toBeDefined();
    // 番号だけが表示され、意味・単語そのもののテキストは登場しない
    expect(screen.getByText("1 番")).toBeDefined();
    expect(screen.getByText("ターゲット1900")).toBeDefined();
  });

  it("「わかった」「わからなかった」で回答すると次の問題に進み、最後は完了画面になる", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(dataWithVocab));
    let done = false;
    renderQuiz(() => (done = true));

    fireEvent.click(screen.getByText("わかった"));
    expect(screen.getByText("2 / 3 問目")).toBeDefined();

    fireEvent.click(screen.getByText("わからなかった"));
    expect(screen.getByText("3 / 3 問目")).toBeDefined();

    fireEvent.click(screen.getByText("わかった"));

    expect(screen.getByText(/3問中 2問「わかった」でした/)).toBeDefined();
    fireEvent.click(screen.getByText("ホームに戻る"));
    expect(done).toBe(true);

    const saved = JSON.parse(localStorage.getItem("study-planner-data-v1") ?? "{}") as AppData;
    const item1 = saved.vocabItems.find((i) => i.id === "r1-1");
    // 未着手だったアイテムに初めて回答すると、正誤に関わらず箱1からスタートする
    expect(item1?.introduced).toBe(true);
    expect(item1?.box).toBe(1);
  });
});
