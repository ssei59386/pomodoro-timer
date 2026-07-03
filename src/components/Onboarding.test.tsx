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

  it("章名が空のまま送信するとエラーになり onboarded にならない（単語帳も未登録の場合）", () => {
    renderApp();

    const mathDateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(mathDateInput, { target: { value: "2099-08-01" } });

    const timeInputs = document.querySelectorAll('input[type="time"]') as NodeListOf<HTMLInputElement>;
    fireEvent.change(timeInputs[0], { target: { value: "18:00" } });
    fireEvent.change(timeInputs[1], { target: { value: "19:00" } });

    fireEvent.click(screen.getByText("この内容で始める"));

    expect(screen.getByText("章または単語帳の範囲を1つ以上登録してください。")).toBeDefined();
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

  it("「＋ 英語の章」で章を追加し英語のテスト日とともに送信すると、英語の教科として保存される", () => {
    renderOnboarding();

    fireEvent.click(screen.getByText("＋ 英語の章"));

    // 1つ目（初期の数学章、未入力）はフィルタされるため、2つ目が今追加した英語の章の入力欄になる
    const chapterNameInputs = screen.getAllByPlaceholderText("章名（例：二次関数）");
    fireEvent.change(chapterNameInputs[1], { target: { value: "Lesson 5 単語" } });

    const englishDateInput = screen.getByLabelText("英語のテスト日") as HTMLInputElement;
    fireEvent.change(englishDateInput, { target: { value: "2099-08-01" } });

    const timeInputs = document.querySelectorAll('input[type="time"]') as NodeListOf<HTMLInputElement>;
    fireEvent.change(timeInputs[0], { target: { value: "18:00" } });
    fireEvent.change(timeInputs[1], { target: { value: "19:00" } });

    fireEvent.click(screen.getByText("この内容で始める"));

    expect(latestData?.onboarded).toBe(true);
    const subject = latestData?.subjects.find((s) => s.name === "英語");
    expect(subject).toBeDefined();
    expect(subject?.testDate).toBe("2099-08-01");
    const chapter = latestData?.chapters.find((c) => c.name === "Lesson 5 単語");
    expect(chapter?.subjectId).toBe(subject?.id);
  });

  it("英語の章名を入力しても英語のテスト日が未入力だと送信できない", () => {
    renderOnboarding();

    fireEvent.click(screen.getByText("＋ 英語の章"));

    const chapterNameInputs = screen.getAllByPlaceholderText("章名（例：二次関数）");
    fireEvent.change(chapterNameInputs[1], { target: { value: "Lesson 5 単語" } });

    const timeInputs = document.querySelectorAll('input[type="time"]') as NodeListOf<HTMLInputElement>;
    fireEvent.change(timeInputs[0], { target: { value: "18:00" } });
    fireEvent.change(timeInputs[1], { target: { value: "19:00" } });

    fireEvent.click(screen.getByText("この内容で始める"));

    expect(screen.getByText("英語のテスト日を入力してください。")).toBeDefined();
    expect(latestData?.onboarded).toBe(false);
  });

  it("英語の章ではカリキュラムサジェスト（数学・理科専用の参考データ）が表示されない", () => {
    renderOnboarding();

    fireEvent.click(screen.getByText("＋ 英語の章"));

    // "2次関数" は数学の参考データに実在する章名（ChapterCurriculumSuggest.test.tsx 参照）。
    // 英語の章として入力しても、著作権上の理由で英語向けデータが無いため候補は出ないはず。
    const chapterNameInputs = screen.getAllByPlaceholderText("章名（例：二次関数）");
    fireEvent.change(chapterNameInputs[1], { target: { value: "2次関数" } });

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("英語の章でも「演習問題数」の表示は変わらない（旧「単語数」表示分岐は廃止済み）", () => {
    renderOnboarding();

    fireEvent.click(screen.getByText("＋ 英語の章"));

    expect(screen.getAllByText("演習問題数")).toHaveLength(2);
    expect(screen.queryByText("単語数")).toBeNull();
  });

  it("小項目の「先生からテストのヒントがあった」チェックボックスが Chapter.subtopics[].teacherHinted に反映される", () => {
    renderOnboarding();

    const mathDateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(mathDateInput, { target: { value: "2099-08-01" } });

    const chapterNameInput = screen.getByPlaceholderText("章名（例：二次関数）");
    fireEvent.change(chapterNameInput, { target: { value: "二次関数" } });

    fireEvent.click(screen.getByText("＋ 小項目を追加"));

    const subtopicNameInputs = screen.getAllByPlaceholderText("小項目名（例：頂点）");
    fireEvent.change(subtopicNameInputs[0], { target: { value: "頂点" } });

    const hintCheckbox = screen.getByLabelText("先生からテストのヒントがあった") as HTMLInputElement;
    fireEvent.click(hintCheckbox);

    const timeInputs = document.querySelectorAll('input[type="time"]') as NodeListOf<HTMLInputElement>;
    fireEvent.change(timeInputs[0], { target: { value: "18:00" } });
    fireEvent.change(timeInputs[1], { target: { value: "19:00" } });

    fireEvent.click(screen.getByText("この内容で始める"));

    expect(latestData?.onboarded).toBe(true);
    expect(latestData?.chapters[0].subtopics?.[0].teacherHinted).toBe(true);
  });
});

describe("Onboarding（単語帳の登録）", () => {
  it("単語帳の範囲（開始〜終了番号）を登録すると、英語の教科として保存され、20語ずつの VocabChunk が生成される", () => {
    renderOnboarding();

    const mathDateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(mathDateInput, { target: { value: "2099-08-01" } });
    const chapterNameInput = screen.getByPlaceholderText("章名（例：二次関数）");
    fireEvent.change(chapterNameInput, { target: { value: "二次関数" } });

    fireEvent.click(screen.getByText("＋ 単語帳の範囲を追加"));

    fireEvent.change(screen.getByPlaceholderText("ラベル（例：ターゲット1900）"), {
      target: { value: "ターゲット1900" },
    });
    fireEvent.change(screen.getByPlaceholderText("例：371"), { target: { value: "371" } });
    fireEvent.change(screen.getByPlaceholderText("例：670"), { target: { value: "373" } });

    const englishDateInput = screen.getByLabelText("英語のテスト日") as HTMLInputElement;
    fireEvent.change(englishDateInput, { target: { value: "2099-08-01" } });

    const timeInputs = document.querySelectorAll('input[type="time"]') as NodeListOf<HTMLInputElement>;
    fireEvent.change(timeInputs[0], { target: { value: "18:00" } });
    fireEvent.change(timeInputs[1], { target: { value: "19:00" } });

    fireEvent.click(screen.getByText("この内容で始める"));

    expect(latestData?.onboarded).toBe(true);
    const englishSubject = latestData?.subjects.find((s) => s.name === "英語");
    expect(englishSubject).toBeDefined();

    expect(latestData?.vocabRanges).toHaveLength(1);
    const range = latestData?.vocabRanges[0];
    expect(range?.label).toBe("ターゲット1900");
    expect(range?.startNumber).toBe(371);
    expect(range?.endNumber).toBe(373);
    expect(range?.subjectId).toBe(englishSubject?.id);
    expect(range?.chapterId).toBeUndefined();

    // 371〜373番は3語しかなくVOCAB_CHUNK_SIZE未満なので、1枠にまとまる
    expect(latestData?.vocabChunks).toHaveLength(1);
    expect(latestData?.vocabChunks[0]).toMatchObject({ startNumber: 371, endNumber: 373 });
    expect(latestData?.vocabChunks.every((c) => !c.introduced && c.box === 0 && !c.completed)).toBe(
      true,
    );
  });

  it("対応する章を選択すると、VocabRange.chapterId にその章の実際の Chapter.id が反映される", () => {
    renderOnboarding();

    fireEvent.click(screen.getByText("＋ 英語の章"));
    const chapterNameInputs = screen.getAllByPlaceholderText("章名（例：二次関数）");
    fireEvent.change(chapterNameInputs[1], { target: { value: "Lesson 5 単語" } });

    fireEvent.click(screen.getByText("＋ 単語帳の範囲を追加"));
    fireEvent.change(screen.getByPlaceholderText("ラベル（例：ターゲット1900）"), {
      target: { value: "教科書 Lesson 5" },
    });
    fireEvent.change(screen.getByPlaceholderText("例：371"), { target: { value: "1" } });
    fireEvent.change(screen.getByPlaceholderText("例：670"), { target: { value: "10" } });

    const chapterSelect = screen.getByLabelText(
      "対応する章（任意・教科書レッスンに紐づける場合のみ）",
    ) as HTMLSelectElement;
    const option = within(chapterSelect).getByText("Lesson 5 単語") as HTMLOptionElement;
    fireEvent.change(chapterSelect, { target: { value: option.value } });

    const englishDateInput = screen.getByLabelText("英語のテスト日") as HTMLInputElement;
    fireEvent.change(englishDateInput, { target: { value: "2099-08-01" } });

    const timeInputs = document.querySelectorAll('input[type="time"]') as NodeListOf<HTMLInputElement>;
    fireEvent.change(timeInputs[0], { target: { value: "18:00" } });
    fireEvent.change(timeInputs[1], { target: { value: "19:00" } });

    fireEvent.click(screen.getByText("この内容で始める"));

    expect(latestData?.onboarded).toBe(true);
    const chapter = latestData?.chapters.find((c) => c.name === "Lesson 5 単語");
    expect(latestData?.vocabRanges[0].chapterId).toBe(chapter?.id);
  });

  it("単語帳のラベルを入力しても開始・終了番号が不正だと送信できずエラーになる", () => {
    renderOnboarding();

    const mathDateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(mathDateInput, { target: { value: "2099-08-01" } });
    const chapterNameInput = screen.getByPlaceholderText("章名（例：二次関数）");
    fireEvent.change(chapterNameInput, { target: { value: "二次関数" } });

    fireEvent.click(screen.getByText("＋ 単語帳の範囲を追加"));
    fireEvent.change(screen.getByPlaceholderText("ラベル（例：ターゲット1900）"), {
      target: { value: "ターゲット1900" },
    });
    // 終了番号を未入力のまま送信する

    const timeInputs = document.querySelectorAll('input[type="time"]') as NodeListOf<HTMLInputElement>;
    fireEvent.change(timeInputs[0], { target: { value: "18:00" } });
    fireEvent.change(timeInputs[1], { target: { value: "19:00" } });

    fireEvent.click(screen.getByText("この内容で始める"));

    expect(
      screen.getByText("単語帳の範囲（開始番号・終了番号）を正しく入力してください。"),
    ).toBeDefined();
    expect(latestData?.onboarded).toBe(false);
  });

  it("章を1つも登録せず、単語帳の範囲だけを登録しても送信できる（章 or 単語帳のどちらかがあればよい）", () => {
    renderOnboarding();

    fireEvent.click(screen.getByText("＋ 単語帳の範囲を追加"));
    fireEvent.change(screen.getByPlaceholderText("ラベル（例：ターゲット1900）"), {
      target: { value: "ターゲット1900" },
    });
    fireEvent.change(screen.getByPlaceholderText("例：371"), { target: { value: "371" } });
    fireEvent.change(screen.getByPlaceholderText("例：670"), { target: { value: "670" } });

    const englishDateInput = screen.getByLabelText("英語のテスト日") as HTMLInputElement;
    fireEvent.change(englishDateInput, { target: { value: "2099-08-01" } });

    const timeInputs = document.querySelectorAll('input[type="time"]') as NodeListOf<HTMLInputElement>;
    fireEvent.change(timeInputs[0], { target: { value: "18:00" } });
    fireEvent.change(timeInputs[1], { target: { value: "19:00" } });

    fireEvent.click(screen.getByText("この内容で始める"));

    expect(latestData?.onboarded).toBe(true);
    expect(latestData?.chapters).toHaveLength(0);
    expect(latestData?.vocabRanges).toHaveLength(1);
  });

  it("開始・終了番号を入力してもラベルが空欄だと、黙って消えずにエラー表示される", () => {
    renderOnboarding();

    const mathDateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(mathDateInput, { target: { value: "2099-08-01" } });
    const chapterNameInput = screen.getByPlaceholderText("章名（例：二次関数）");
    fireEvent.change(chapterNameInput, { target: { value: "二次関数" } });

    fireEvent.click(screen.getByText("＋ 単語帳の範囲を追加"));
    // ラベルは空欄のまま、開始・終了番号だけ入力する
    fireEvent.change(screen.getByPlaceholderText("例：371"), { target: { value: "371" } });
    fireEvent.change(screen.getByPlaceholderText("例：670"), { target: { value: "670" } });

    const timeInputs = document.querySelectorAll('input[type="time"]') as NodeListOf<HTMLInputElement>;
    fireEvent.change(timeInputs[0], { target: { value: "18:00" } });
    fireEvent.change(timeInputs[1], { target: { value: "19:00" } });

    fireEvent.click(screen.getByText("この内容で始める"));

    expect(screen.getByText("単語帳のラベルを入力してください。")).toBeDefined();
    expect(latestData?.onboarded).toBe(false);
  });

  it("範囲が広すぎる（上限を超える）と具体的なエラーメッセージで送信できない", () => {
    renderOnboarding();

    const mathDateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(mathDateInput, { target: { value: "2099-08-01" } });
    const chapterNameInput = screen.getByPlaceholderText("章名（例：二次関数）");
    fireEvent.change(chapterNameInput, { target: { value: "二次関数" } });

    fireEvent.click(screen.getByText("＋ 単語帳の範囲を追加"));
    fireEvent.change(screen.getByPlaceholderText("ラベル（例：ターゲット1900）"), {
      target: { value: "ターゲット1900" },
    });
    // 入力ミスを想定：371 → 3710 のような桁間違い
    fireEvent.change(screen.getByPlaceholderText("例：371"), { target: { value: "1" } });
    fireEvent.change(screen.getByPlaceholderText("例：670"), { target: { value: "3710" } });

    const timeInputs = document.querySelectorAll('input[type="time"]') as NodeListOf<HTMLInputElement>;
    fireEvent.change(timeInputs[0], { target: { value: "18:00" } });
    fireEvent.change(timeInputs[1], { target: { value: "19:00" } });

    fireEvent.click(screen.getByText("この内容で始める"));

    expect(screen.getByText(/1000語までにしてください/)).toBeDefined();
    expect(latestData?.onboarded).toBe(false);
  });
});
