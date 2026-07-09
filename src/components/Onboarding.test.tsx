import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { App } from "../App";
import { Onboarding } from "./Onboarding";
import { StoreProvider, useStore } from "../store";
import type { AppData } from "../types";

// 本格ステップ式ウィザード版（docs/feature-onboarding-wizard.md）のテスト。
// 「使う教科を選ぶ→テスト日→教科ごとの内容→勉強できる時間→特別な予定→確認画面」の
// ステップ遷移を挟む形に書き直してある。

// jsdom は scrollIntoView 未実装のため、ステップ遷移時の scrollIntoView 呼び出しでも
// 例外にならないようにモックする。
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

function clickNext() {
  fireEvent.click(screen.getByText("次へ"));
}

function clickBack() {
  fireEvent.click(screen.getByText("＜ 戻る"));
}

function clickStart() {
  fireEvent.click(screen.getByText("この内容で始める"));
}

/**
 * テンプレートを選んで教科を1件追加する（教科の複数登録対応、段階5）。テンプレート未指定なら
 * デフォルトの「数学」のまま追加する。追加直後の教科名はテンプレートの初期名と一致する。
 */
function addSubject(templateLabel = "数学") {
  const select = screen.getByLabelText("テンプレート") as HTMLSelectElement;
  const option = within(select).getByText(templateLabel) as HTMLOptionElement;
  fireEvent.change(select, { target: { value: option.value } });
  fireEvent.click(screen.getByText("＋ 教科を追加"));
}

function setTestDate(subjectLabel: string, date: string) {
  fireEvent.change(screen.getByLabelText(`${subjectLabel}のテスト日`), { target: { value: date } });
}

function fillWeeklySlot() {
  const timeInputs = document.querySelectorAll('input[type="time"]') as NodeListOf<HTMLInputElement>;
  fireEvent.change(timeInputs[0], { target: { value: "18:00" } });
  fireEvent.change(timeInputs[1], { target: { value: "19:00" } });
}

/** 教科を1つ追加し、テスト日を入れて、その教科の内容ステップまで進める */
function goToSubjectContent(subjectLabel: string, testDate = "2099-08-01") {
  addSubject(subjectLabel);
  clickNext(); // subjects -> testDates
  setTestDate(subjectLabel, testDate);
  clickNext(); // testDates -> subjectContent
}

/** 内容ステップの入力が終わった状態から、勉強できる時間→特別な予定→確認画面→送信まで進める */
function finishFromContentStep() {
  clickNext(); // content -> schedule
  fillWeeklySlot();
  clickNext(); // schedule -> overrides
  clickNext(); // overrides -> review
  clickStart(); // submit
}

describe("Onboarding（App経由の統合テスト）", () => {
  it("最小構成（教科1つ・章1つ・週間スケジュール1スロット）で送信すると onboarded になりホーム画面へ切り替わる", () => {
    renderApp();

    goToSubjectContent("数学");
    fireEvent.change(screen.getByPlaceholderText("章名（例：二次関数）"), { target: { value: "二次関数" } });
    finishFromContentStep();

    expect(screen.queryByRole("heading", { name: "はじめの設定" })).toBeNull();
    expect(screen.getByText("定期テスト学習進捗管理")).toBeDefined();
    const tabBar = document.querySelector(".tab-bar");
    expect(tabBar).not.toBeNull();

    const saved = JSON.parse(localStorage.getItem("study-planner-data-v1") ?? "{}") as AppData;
    expect(saved.onboarded).toBe(true);
    expect(saved.chapters).toHaveLength(1);
    expect(saved.chapters[0].name).toBe("二次関数");
    // 完了後は下書きが残らない（次回オンボーディングを開いたときに古い内容が復元されないように）
    expect(localStorage.getItem("study-planner-onboarding-draft-v1")).toBeNull();
  });

  it("使う教科を追加せずに次へに進もうとするとエラーになり、オンボーディングのままになる", () => {
    renderApp();

    clickNext();

    expect(screen.getByText("使う教科を1つ以上追加してください。")).toBeDefined();
    expect(screen.getByRole("heading", { name: "はじめの設定" })).toBeDefined();

    const saved = JSON.parse(localStorage.getItem("study-planner-data-v1") ?? "{}") as AppData;
    expect(saved.onboarded).toBe(false);
  });

  it("「特別な予定を設定する」ボタンで DateOverridesList セクションが展開表示される", () => {
    renderApp();

    goToSubjectContent("数学");
    fireEvent.change(screen.getByPlaceholderText("章名（例：二次関数）"), { target: { value: "二次関数" } });
    clickNext(); // content -> schedule
    fillWeeklySlot();
    clickNext(); // schedule -> overrides

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

describe("Onboarding（ステップ移動）", () => {
  it("「＜ 戻る」で1つ前のステップへ戻り、入力済みの内容は保持される", () => {
    renderOnboarding();

    addSubject("数学");
    clickNext(); // subjects -> testDates
    setTestDate("数学", "2099-08-01");

    clickBack(); // testDates -> subjects
    expect(screen.getByRole("heading", { name: "使う教科を選ぶ" })).toBeDefined();

    clickNext(); // subjects -> testDates（再度）
    expect((screen.getByLabelText("数学のテスト日") as HTMLInputElement).value).toBe("2099-08-01");
  });
});

describe("Onboarding（教科の複数登録）", () => {
  it("同じテンプレートを2回追加して数学I/数学Aを別のテスト日で登録すると、両方が別の Subject として保存される", () => {
    renderOnboarding();

    // テンプレートは「数学」のまま2回追加し、それぞれ名前を編集して数学I/数学Aにする
    addSubject("数学");
    addSubject("数学");

    const nameInputs = screen.getAllByLabelText("数学（教科名を編集）");
    expect(nameInputs).toHaveLength(2);
    fireEvent.change(nameInputs[0], { target: { value: "数学I" } });
    fireEvent.change(nameInputs[1], { target: { value: "数学A" } });

    clickNext(); // subjects -> testDates
    setTestDate("数学I", "2099-08-01");
    setTestDate("数学A", "2099-09-01");
    clickNext(); // testDates -> subjectContent(数学I)

    expect(screen.getByRole("heading", { name: /数学Iの内容/ })).toBeDefined();
    fireEvent.change(screen.getByPlaceholderText("章名（例：二次関数）"), { target: { value: "二次関数" } });
    clickNext(); // subjectContent(数学I) -> subjectContent(数学A)

    expect(screen.getByRole("heading", { name: /数学Aの内容/ })).toBeDefined();
    fireEvent.change(screen.getByPlaceholderText("章名（例：二次関数）"), { target: { value: "整数の性質" } });
    finishFromContentStep();

    expect(latestData?.onboarded).toBe(true);
    const mathI = latestData?.subjects.find((s) => s.name === "数学I");
    const mathA = latestData?.subjects.find((s) => s.name === "数学A");
    expect(mathI).toBeDefined();
    expect(mathA).toBeDefined();
    expect(mathI?.id).not.toBe(mathA?.id);
    expect(mathI?.testDate).toBe("2099-08-01");
    expect(mathA?.testDate).toBe("2099-09-01");
    expect(mathI?.templateKey).toBe("math");
    expect(mathA?.templateKey).toBe("math");

    const chapterI = latestData?.chapters.find((c) => c.name === "二次関数");
    const chapterA = latestData?.chapters.find((c) => c.name === "整数の性質");
    expect(chapterI?.subjectId).toBe(mathI?.id);
    expect(chapterA?.subjectId).toBe(mathA?.id);
  });

  it("追加した教科は「使う教科を選ぶ」ステップで削除できる", () => {
    renderOnboarding();

    addSubject("数学");
    addSubject("理科");
    expect(screen.getAllByLabelText(/（教科名を編集）/)).toHaveLength(2);

    fireEvent.click(screen.getByLabelText("数学を削除"));

    expect(screen.getAllByLabelText(/（教科名を編集）/)).toHaveLength(1);
    expect(screen.queryByLabelText("理科を削除")).not.toBeNull();
  });
});

describe("Onboarding（テスト日ステップのバリデーション）", () => {
  it("テスト日が未入力のまま次へに進もうとするとエラーになる", () => {
    renderOnboarding();

    addSubject("数学");
    clickNext(); // subjects -> testDates
    clickNext(); // 未入力のまま次へ

    expect(screen.getByText("数学のテスト日を入力してください。")).toBeDefined();
  });

  it("過去日だとエラーになる", () => {
    renderOnboarding();

    addSubject("数学");
    clickNext(); // subjects -> testDates
    setTestDate("数学", "2020-01-01");
    clickNext();

    expect(screen.getByText("数学のテスト日は今日以降の日付にしてください。")).toBeDefined();
  });
});

describe("Onboarding（教科ごとの内容ステップのバリデーション）", () => {
  it("章名が空・暗記範囲も未登録のまま次へに進もうとするとエラーになる（教科単位の either-or 緩和）", () => {
    renderOnboarding();

    goToSubjectContent("数学");
    clickNext(); // 章名も暗記範囲も未入力のまま次へ

    expect(screen.getByText("章または暗記範囲を1つ以上登録してください。")).toBeDefined();
    expect(screen.getByRole("heading", { name: /数学の内容/ })).toBeDefined();
    expect(latestData?.onboarded).toBe(false);
  });
});

describe("Onboarding（勉強できる時間ステップのバリデーション）", () => {
  it("週間スケジュールに有効なスロットが1つもないと次へに進めず、エディタにエラー表示が付く", () => {
    renderOnboarding();

    goToSubjectContent("数学");
    fireEvent.change(screen.getByPlaceholderText("章名（例：二次関数）"), { target: { value: "二次関数" } });
    clickNext(); // content -> schedule
    // 時間帯は未入力のまま次へ
    clickNext();

    expect(screen.getByText("勉強できる時間を少なくとも1つ設定してください。")).toBeDefined();
    expect(document.querySelector(".weekly-schedule-error")).not.toBeNull();
    expect(latestData?.onboarded).toBe(false);
  });
});

describe("Onboarding（下書き永続化）", () => {
  it("数歩進めてアンマウント→再マウントすると、入力内容とステップ位置が復元される", () => {
    const { unmount } = renderOnboarding();

    addSubject("数学");
    clickNext(); // subjects -> testDates
    setTestDate("数学", "2099-08-01");
    clickNext(); // testDates -> subjectContent(math)
    fireEvent.change(screen.getByPlaceholderText("章名（例：二次関数）"), { target: { value: "二次関数" } });

    unmount();

    renderOnboarding();

    // ステップ位置（数学の内容ステップ）が復元されていること
    expect(screen.getByRole("heading", { name: /数学の内容/ })).toBeDefined();
    // 章名の入力内容が復元されていること
    expect((screen.getByPlaceholderText("章名（例：二次関数）") as HTMLInputElement).value).toBe(
      "二次関数",
    );
  });
});

describe("Onboarding（小項目の反映）", () => {
  it("小項目（自己申告付き）を入力すると、completeOnboarding 経由で Chapter.subtopics に反映される", () => {
    renderOnboarding();

    goToSubjectContent("数学");
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

    finishFromContentStep();

    expect(latestData?.onboarded).toBe(true);
    const chapter = latestData?.chapters[0];
    expect(chapter?.subtopics).toHaveLength(2);
    expect(chapter?.subtopics?.map((st) => st.name)).toEqual(["頂点", "軸"]);
    // 各小項目の自己申告が Chapter.subtopics[].understanding に個別反映されること（旧バグの修正確認）。
    // 1つ目はデフォルトの自己申告3 → 0.6、2つ目は5（人に教えられる）→ 1.0。
    expect(chapter?.subtopics?.[0].understanding).toBeCloseTo(0.6);
    expect(chapter?.subtopics?.[1].understanding).toBeCloseTo(1.0);
  });

  it("「＋ 章を追加」で同じ教科に章を複数登録できる", () => {
    renderOnboarding();

    goToSubjectContent("数学");
    fireEvent.change(screen.getByPlaceholderText("章名（例：二次関数）"), { target: { value: "二次関数" } });
    fireEvent.click(screen.getByText("＋ 章を追加"));

    const chapterNameInputs = screen.getAllByPlaceholderText("章名（例：二次関数）");
    expect(chapterNameInputs).toHaveLength(2);
    fireEvent.change(chapterNameInputs[1], { target: { value: "図形と方程式" } });

    finishFromContentStep();

    expect(latestData?.onboarded).toBe(true);
    expect(latestData?.chapters.map((c) => c.name)).toEqual(["二次関数", "図形と方程式"]);
  });

  it("英語の教科として章を登録すると、テスト日とともに正しく保存される", () => {
    renderOnboarding();

    goToSubjectContent("英語");
    fireEvent.change(screen.getByPlaceholderText("章名（例：二次関数）"), {
      target: { value: "Lesson 5 単語" },
    });

    finishFromContentStep();

    expect(latestData?.onboarded).toBe(true);
    const subject = latestData?.subjects.find((s) => s.name === "英語");
    expect(subject).toBeDefined();
    expect(subject?.testDate).toBe("2099-08-01");
    const chapter = latestData?.chapters.find((c) => c.name === "Lesson 5 単語");
    expect(chapter?.subjectId).toBe(subject?.id);
  });

  it("英語の章ではカリキュラムサジェスト（数学・理科専用の参考データ）が表示されない", () => {
    renderOnboarding();

    goToSubjectContent("英語");

    // "2次関数" は数学の参考データに実在する章名（ChapterCurriculumSuggest.test.tsx 参照）。
    // 英語の章として入力しても、著作権上の理由で英語向けデータが無いため候補は出ないはず。
    fireEvent.change(screen.getByPlaceholderText("章名（例：二次関数）"), { target: { value: "2次関数" } });

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("小項目の「先生からテストのヒントがあった」チェックボックスが Chapter.subtopics[].teacherHinted に反映される", () => {
    renderOnboarding();

    goToSubjectContent("数学");
    fireEvent.change(screen.getByPlaceholderText("章名（例：二次関数）"), { target: { value: "二次関数" } });

    fireEvent.click(screen.getByText("＋ 小項目を追加"));

    const subtopicNameInputs = screen.getAllByPlaceholderText("小項目名（例：頂点）");
    fireEvent.change(subtopicNameInputs[0], { target: { value: "頂点" } });

    const hintCheckbox = screen.getByLabelText("先生からテストのヒントがあった") as HTMLInputElement;
    fireEvent.click(hintCheckbox);

    finishFromContentStep();

    expect(latestData?.onboarded).toBe(true);
    expect(latestData?.chapters[0].subtopics?.[0].teacherHinted).toBe(true);
  });
});

describe("Onboarding（単語帳の登録）", () => {
  it("単語帳の範囲（開始〜終了番号）を登録すると、英語の教科として保存され、20語ずつの VocabChunk が生成される", () => {
    renderOnboarding();

    goToSubjectContent("英語");
    fireEvent.click(screen.getByText("＋ 暗記範囲を追加"));

    fireEvent.change(screen.getByPlaceholderText("ラベル（例：ターゲット1900）"), {
      target: { value: "ターゲット1900" },
    });
    fireEvent.change(screen.getByPlaceholderText("例：371"), { target: { value: "371" } });
    fireEvent.change(screen.getByPlaceholderText("例：670"), { target: { value: "373" } });

    finishFromContentStep();

    expect(latestData?.onboarded).toBe(true);
    const englishSubject = latestData?.subjects.find((s) => s.name === "英語");
    expect(englishSubject).toBeDefined();
    // 章の名前は入力していないので、章は作られない
    expect(latestData?.chapters).toHaveLength(0);

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

    goToSubjectContent("英語");
    fireEvent.change(screen.getByPlaceholderText("章名（例：二次関数）"), {
      target: { value: "Lesson 5 単語" },
    });

    fireEvent.click(screen.getByText("＋ 暗記範囲を追加"));
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

    finishFromContentStep();

    expect(latestData?.onboarded).toBe(true);
    const chapter = latestData?.chapters.find((c) => c.name === "Lesson 5 単語");
    expect(latestData?.vocabRanges[0].chapterId).toBe(chapter?.id);
  });

  it("暗記範囲のラベルを入力しても開始・終了番号が不正だと次へに進めずエラーになる", () => {
    renderOnboarding();

    goToSubjectContent("英語");
    fireEvent.click(screen.getByText("＋ 暗記範囲を追加"));
    fireEvent.change(screen.getByPlaceholderText("ラベル（例：ターゲット1900）"), {
      target: { value: "ターゲット1900" },
    });
    // 終了番号を未入力のまま次へ
    clickNext();

    expect(
      screen.getByText("暗記範囲（開始番号・終了番号）を正しく入力してください。"),
    ).toBeDefined();
    expect(latestData?.onboarded).toBe(false);
  });

  it("章を1つも登録せず、暗記範囲だけを登録しても送信できる（章か暗記範囲のどちらかがあればよい）", () => {
    renderOnboarding();

    goToSubjectContent("英語");
    fireEvent.click(screen.getByText("＋ 暗記範囲を追加"));
    fireEvent.change(screen.getByPlaceholderText("ラベル（例：ターゲット1900）"), {
      target: { value: "ターゲット1900" },
    });
    fireEvent.change(screen.getByPlaceholderText("例：371"), { target: { value: "371" } });
    fireEvent.change(screen.getByPlaceholderText("例：670"), { target: { value: "670" } });

    finishFromContentStep();

    expect(latestData?.onboarded).toBe(true);
    expect(latestData?.chapters).toHaveLength(0);
    expect(latestData?.vocabRanges).toHaveLength(1);
  });

  it("開始・終了番号を入力してもラベルが空欄だと、黙って消えずにエラー表示される", () => {
    renderOnboarding();

    goToSubjectContent("英語");
    fireEvent.change(screen.getByPlaceholderText("章名（例：二次関数）"), { target: { value: "二次関数" } });
    fireEvent.click(screen.getByText("＋ 暗記範囲を追加"));
    // ラベルは空欄のまま、開始・終了番号だけ入力する
    fireEvent.change(screen.getByPlaceholderText("例：371"), { target: { value: "371" } });
    fireEvent.change(screen.getByPlaceholderText("例：670"), { target: { value: "670" } });
    clickNext();

    expect(screen.getByText("暗記範囲のラベルを入力してください。")).toBeDefined();
    expect(latestData?.onboarded).toBe(false);
  });

  it("範囲が広すぎる（上限を超える）と具体的なエラーメッセージで次へに進めない", () => {
    renderOnboarding();

    goToSubjectContent("英語");
    fireEvent.change(screen.getByPlaceholderText("章名（例：二次関数）"), { target: { value: "二次関数" } });
    fireEvent.click(screen.getByText("＋ 暗記範囲を追加"));
    fireEvent.change(screen.getByPlaceholderText("ラベル（例：ターゲット1900）"), {
      target: { value: "ターゲット1900" },
    });
    // 入力ミスを想定：371 → 3710 のような桁間違い
    fireEvent.change(screen.getByPlaceholderText("例：371"), { target: { value: "1" } });
    fireEvent.change(screen.getByPlaceholderText("例：670"), { target: { value: "3710" } });
    clickNext();

    expect(screen.getByText(/1000語までにしてください/)).toBeDefined();
    expect(latestData?.onboarded).toBe(false);
  });
});

describe("Onboarding（社会・国語の暗記範囲）", () => {
  it("社会を選んで暗記範囲だけを登録すると、社会の教科として保存され章は作られない", () => {
    renderOnboarding();

    goToSubjectContent("社会");
    fireEvent.click(screen.getByText("＋ 暗記範囲を追加"));

    fireEvent.change(screen.getByPlaceholderText("ラベル（例：ターゲット1900）"), {
      target: { value: "一問一答 歴史" },
    });
    fireEvent.change(screen.getByPlaceholderText("例：371"), { target: { value: "1" } });
    fireEvent.change(screen.getByPlaceholderText("例：670"), { target: { value: "50" } });

    finishFromContentStep();

    expect(latestData?.onboarded).toBe(true);
    const socialSubject = latestData?.subjects.find((s) => s.name === "社会");
    expect(socialSubject).toBeDefined();
    expect(socialSubject?.testDate).toBe("2099-08-01");
    expect(latestData?.vocabRanges[0].subjectId).toBe(socialSubject?.id);
    // 社会は章も暗記範囲も持てるが（段階6で章化）、暗記範囲だけ登録した場合は章は作られない
    expect(latestData?.chapters).toHaveLength(0);
  });

  it("社会は章の登録セクションが表示される（段階6で章＋周回化・暗記範囲と併存）", () => {
    renderOnboarding();

    goToSubjectContent("社会");
    expect(screen.getByText("章の登録")).toBeDefined();
    // 暗記範囲セクションも併存する（D1）
    expect(screen.getByText("＋ 暗記範囲を追加")).toBeDefined();
  });

  it("国語には章の登録セクション自体が表示されない（暗記範囲のみの教科）", () => {
    renderOnboarding();

    goToSubjectContent("国語");
    expect(screen.queryByText("章の登録")).toBeNull();
  });

  it("国語のステップでは「対応する章」欄自体が表示されない（国語は章を持たないため）", () => {
    renderOnboarding();

    goToSubjectContent("国語");
    fireEvent.click(screen.getByText("＋ 暗記範囲を追加"));

    expect(
      screen.queryByLabelText("対応する章（任意・教科書レッスンに紐づける場合のみ）"),
    ).toBeNull();
  });

  it("国語のテスト日が未入力のまま次へに進もうとするとエラーになる", () => {
    renderOnboarding();

    addSubject("国語");
    clickNext(); // subjects -> testDates
    clickNext(); // テスト日未入力のまま次へ

    expect(screen.getByText("国語のテスト日を入力してください。")).toBeDefined();
    expect(latestData?.onboarded).toBe(false);
  });
});

describe("Onboarding（確認画面）", () => {
  it("確認画面に教科ごとの件数が表示され、「編集」で該当ステップに戻れる", () => {
    renderOnboarding();

    goToSubjectContent("数学");
    fireEvent.change(screen.getByPlaceholderText("章名（例：二次関数）"), { target: { value: "二次関数" } });
    clickNext(); // content -> schedule
    fillWeeklySlot();
    clickNext(); // schedule -> overrides
    clickNext(); // overrides -> review

    expect(screen.getByRole("heading", { name: "内容を確認" })).toBeDefined();
    expect(screen.getByText(/章 1 件/)).toBeDefined();

    // 編集ボタンは「テスト日」「数学の内容」「勉強できる時間」「特別な予定」の4つ。2番目が数学の内容。
    const editButtons = screen.getAllByText("編集");
    expect(editButtons).toHaveLength(4);
    fireEvent.click(editButtons[1]);

    expect(screen.getByRole("heading", { name: /数学の内容/ })).toBeDefined();
  });
});
