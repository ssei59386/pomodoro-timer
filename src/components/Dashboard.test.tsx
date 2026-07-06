import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Dashboard } from "./Dashboard";
import { StoreProvider } from "../store";
import { toISODate } from "../logic";
import type { AppData } from "../types";

const emptyChaptersData: AppData = {
  subjects: [{ id: "s1", name: "数学", testDate: "2026-08-01" }],
  chapters: [],
  sessions: [],
  availability: { weeklySchedule: {}, dateOverrides: {} },
  vocabRanges: [],
  vocabChunks: [],
  todayPlan: null,
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
  vocabRanges: [],
  vocabChunks: [],
  todayPlan: null,
  onboarded: true,
};

const subtopicChapterData: AppData = {
  subjects: [{ id: "s1", name: "数学", testDate: "2026-08-01" }],
  chapters: [
    {
      id: "c1",
      subjectId: "s1",
      name: "確率",
      pointWeight: 20,
      understanding: 0.4,
      targetUnderstanding: 0.8,
      lastStudiedDate: null,
      subtopics: [
        { id: "st1", name: "場合の数", understanding: 0.7, targetUnderstanding: 0.8 },
        { id: "st2", name: "条件付き確率", understanding: 0.3, targetUnderstanding: 0.8 },
      ],
    },
  ],
  sessions: [],
  availability: { weeklySchedule: {}, dateOverrides: {} },
  vocabRanges: [],
  vocabChunks: [],
  todayPlan: null,
  onboarded: true,
};

function renderDashboard(onGoSettings: () => void = () => {}, onGoHome: () => void = () => {}) {
  return render(
    <StoreProvider>
      <Dashboard onGoSettings={onGoSettings} onGoHome={onGoHome} />
    </StoreProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

const vocabData: AppData = {
  subjects: [{ id: "s1", name: "英語", testDate: "2026-08-01" }],
  chapters: [],
  sessions: [],
  availability: { weeklySchedule: {}, dateOverrides: {} },
  vocabRanges: [{ id: "r1", subjectId: "s1", label: "ターゲット1900", startNumber: 371, endNumber: 430 }],
  vocabChunks: [
    {
      id: "r1-371-390",
      rangeId: "r1",
      startNumber: 371,
      endNumber: 390,
      introduced: true,
      box: 5,
      nextReviewDate: "2026-09-01",
      completed: true,
    },
    {
      id: "r1-391-410",
      rangeId: "r1",
      startNumber: 391,
      endNumber: 410,
      introduced: true,
      box: 2,
      nextReviewDate: "2026-07-10",
      completed: false,
    },
    {
      id: "r1-411-430",
      rangeId: "r1",
      startNumber: 411,
      endNumber: 430,
      introduced: false,
      box: 0,
      nextReviewDate: null,
      completed: false,
    },
  ],
  todayPlan: null,
  onboarded: true,
};

describe("Dashboard（単語帳の進捗）", () => {
  it("単語帳が登録されているとき、範囲・完了した枠数が実装用語を使わずに表示される", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(vocabData));
    renderDashboard();

    expect(screen.getByText("単語帳の進捗")).toBeDefined();
    expect(screen.getByText("ターゲット1900")).toBeDefined();
    expect(screen.getByText(/371〜430番のうち、完了した枠 1／3枠/)).toBeDefined();
    expect(screen.queryByText(/box5/)).toBeNull();
  });

  it("単語帳が未登録のときは「単語帳の進捗」セクションが表示されない", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(emptyChaptersData));
    renderDashboard();

    expect(screen.queryByText("単語帳の進捗")).toBeNull();
  });

  it("社会・国語の暗記範囲も、英語と同じ「単語帳の進捗」セクションにまとめて表示される", () => {
    const multiSubjectVocabData: AppData = {
      ...vocabData,
      subjects: [
        ...vocabData.subjects,
        { id: "s2", name: "社会", testDate: "2026-08-01" },
        { id: "s3", name: "国語", testDate: "2026-08-01" },
      ],
      vocabRanges: [
        ...vocabData.vocabRanges,
        { id: "r2", subjectId: "s2", label: "一問一答 歴史", startNumber: 1, endNumber: 20 },
        { id: "r3", subjectId: "s3", label: "漢字ドリル", startNumber: 1, endNumber: 20 },
      ],
      vocabChunks: [
        ...vocabData.vocabChunks,
        {
          id: "r2-1-20",
          rangeId: "r2",
          startNumber: 1,
          endNumber: 20,
          introduced: false,
          box: 0,
          nextReviewDate: null,
          completed: false,
        },
        {
          id: "r3-1-20",
          rangeId: "r3",
          startNumber: 1,
          endNumber: 20,
          introduced: false,
          box: 0,
          nextReviewDate: null,
          completed: false,
        },
      ],
    };
    localStorage.setItem("study-planner-data-v1", JSON.stringify(multiSubjectVocabData));
    renderDashboard();

    expect(screen.getByText("ターゲット1900")).toBeDefined();
    expect(screen.getByText("一問一答 歴史")).toBeDefined();
    expect(screen.getByText("漢字ドリル")).toBeDefined();
  });
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

  it("社会・国語（章を持たない教科）では「章がありません」という行き止まりの空状態を表示しない（修正2）", () => {
    const chapterlessSubjectsData: AppData = {
      subjects: [
        { id: "s2", name: "社会", testDate: "2026-08-01" },
        { id: "s3", name: "国語", testDate: "2026-08-01" },
      ],
      chapters: [],
      sessions: [],
      availability: { weeklySchedule: {}, dateOverrides: {} },
      vocabRanges: [],
      vocabChunks: [],
      todayPlan: null,
      onboarded: true,
    };
    localStorage.setItem("study-planner-data-v1", JSON.stringify(chapterlessSubjectsData));
    renderDashboard();

    expect(screen.queryByText("章がありません。")).toBeNull();
    expect(screen.queryByText("設定で章を登録する")).toBeNull();
    expect(screen.getAllByText(/単語帳の進捗/).length).toBeGreaterThan(0);
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

    // 学習履歴セクションなど教科に紐づかない section.card もあるため、
    // 「教科ごとに分かれているか」は教科見出し（.subject-head）の数で確認する
    const subjectSections = document.querySelectorAll(".subject-head");
    expect(subjectSections).toHaveLength(2);
  });

  it("小項目を持たない章では見通しバッジ・展開ボタンが表示されない（既存表示に回帰なし）", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(twoSubjectsData));
    renderDashboard();

    expect(screen.queryByText("小項目の内訳を見る")).toBeNull();
    expect(document.querySelector(".tier-badge")).toBeNull();
  });

  it("小項目を持つ章では理解度バッジが表示される", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(subtopicChapterData));
    renderDashboard();

    expect(screen.getByText("小項目の内訳を見る")).toBeDefined();
    expect(document.querySelector(".tier-badge")).not.toBeNull();
  });

  it("展開ボタンを押すと小項目ごとの内訳が表示される", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(subtopicChapterData));
    renderDashboard();

    expect(screen.queryByText("場合の数")).toBeNull();
    fireEvent.click(screen.getByText("小項目の内訳を見る"));

    expect(screen.getByText("場合の数")).toBeDefined();
    expect(screen.getByText("条件付き確率")).toBeDefined();
    expect(screen.getByText("閉じる")).toBeDefined();
  });
});

describe("学習履歴セクション", () => {
  it("セッション記録が1件も無ければ空状態メッセージが表示される", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(twoSubjectsData));
    renderDashboard();

    expect(
      screen.getByText("まだ記録がありません。セッションを記録すると、ここに学習の様子が表示されます。"),
    ).toBeDefined();
  });

  it("直近のセッションがあれば週合計と棒グラフが表示される", () => {
    const data: AppData = {
      ...twoSubjectsData,
      sessions: [
        {
          id: "sess1",
          chapterId: "c1",
          date: toISODate(new Date()),
          minutes: 30,
          correctRate: 0.8,
          selfReport: 4,
        },
      ],
    };
    localStorage.setItem("study-planner-data-v1", JSON.stringify(data));
    renderDashboard();

    expect(screen.getByText("直近7日間の合計：30分")).toBeDefined();
    expect(document.querySelectorAll(".study-history-bar-btn")).toHaveLength(7);
  });

  it("棒をタップするとその日のセッション内訳が展開表示される", () => {
    const data: AppData = {
      ...twoSubjectsData,
      sessions: [
        {
          id: "sess1",
          chapterId: "c1",
          date: toISODate(new Date()),
          minutes: 30,
          correctRate: 0.8,
          selfReport: 4,
        },
      ],
    };
    localStorage.setItem("study-planner-data-v1", JSON.stringify(data));
    renderDashboard();

    expect(screen.queryByText(/数学 ・ 二次関数/)).toBeNull();

    const todayBar = document.querySelectorAll(".study-history-bar-btn-today");
    expect(todayBar).toHaveLength(1);
    fireEvent.click(todayBar[0]);

    expect(screen.getByText(/数学 ・ 二次関数/)).toBeDefined();
  });
});

describe("フェーズ5：見通し（前向きシミュレーション）・切る候補（トリアージ）の表示", () => {
  function daysFromNow(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return toISODate(d);
  }

  // テストまで2日、1日30分しか使えない設定で、大量の演習問題を残した小項目を1つ登録する。
  // →「今のペースだと確実に間に合わない」大きな shortfall を作れる（閾値45分を余裕で超える）。
  function atRiskData(overrides: { sessions?: AppData["sessions"] } = {}): AppData {
    return {
      subjects: [{ id: "s1", name: "数学", testDate: daysFromNow(2) }],
      chapters: [
        {
          id: "c1",
          subjectId: "s1",
          name: "二次関数",
          pointWeight: 20,
          understanding: 0.4,
          targetUnderstanding: 0.8,
          lastStudiedDate: null,
          subtopics: [
            { id: "st1", name: "因数分解", understanding: 0, basicProblems: 50 },
          ],
        },
      ],
      sessions: overrides.sessions ?? [],
      vocabRanges: [],
      vocabChunks: [],
      availability: {
        weeklySchedule: { 0: [{ start: "00:00", end: "00:30" }], 1: [{ start: "00:00", end: "00:30" }], 2: [{ start: "00:00", end: "00:30" }], 3: [{ start: "00:00", end: "00:30" }], 4: [{ start: "00:00", end: "00:30" }], 5: [{ start: "00:00", end: "00:30" }], 6: [{ start: "00:00", end: "00:30" }] },
        dateOverrides: {},
      },
      todayPlan: null,
      onboarded: true,
    };
  }

  it("不足がまとまって大きく、かつセッションが記録されている教科では見通し・トリアージセクションが表示される", () => {
    const data = atRiskData({
      sessions: [
        {
          id: "sess1",
          chapterId: "c1",
          subtopicId: "st1",
          date: daysFromNow(-1),
          minutes: 30,
          correctRate: 0.5,
          selfReport: 2,
        },
      ],
    });
    localStorage.setItem("study-planner-data-v1", JSON.stringify(data));
    renderDashboard();

    expect(screen.getByText("🧭 今のペースでの見通し")).toBeDefined();
    // 同じ小項目が「見通し」と「トリアージ」の両方に出るので getAllByText で複数ヒットを許容する
    expect(screen.getAllByText(/二次関数 ・ 因数分解/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/今のペースだと、テストまでに あと約.+足りない見込みです/)).toBeDefined();
    expect(screen.getByText(/あくまで目安です/)).toBeDefined();
    expect(screen.getByText("→ 今日のプランを見る")).toBeDefined();

    // トリアージ（切る候補）も同じ小項目について表示される
    expect(screen.getByText(/時間配分の効率上、優先度を下げる候補です/)).toBeDefined();
    expect(screen.getByText(/配点効率 [\d.]+ 点\/分/)).toBeDefined();
  });

  it("「今日のプランを見る」を押すと onGoHome が呼ばれる", () => {
    const data = atRiskData({
      sessions: [
        {
          id: "sess1",
          chapterId: "c1",
          subtopicId: "st1",
          date: daysFromNow(-1),
          minutes: 30,
          correctRate: 0.5,
          selfReport: 2,
        },
      ],
    });
    localStorage.setItem("study-planner-data-v1", JSON.stringify(data));
    let called = false;
    renderDashboard(undefined, () => (called = true));

    fireEvent.click(screen.getByText("→ 今日のプランを見る"));
    expect(called).toBe(true);
  });

  it("セッションが1件も無ければ、不足が大きくても見通しセクションは表示されない（登録直後の誤警報防止）", () => {
    const data = atRiskData({ sessions: [] });
    localStorage.setItem("study-planner-data-v1", JSON.stringify(data));
    renderDashboard();

    expect(screen.queryByText("🧭 今のペースでの見通し")).toBeNull();
    expect(screen.queryByText(/小項目未設定の章はこの見通しの対象外です/)).toBeNull();
  });

  it("既に間に合っている（shortfallが無い）教科では見通しセクションは表示されない", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(subtopicChapterData));
    renderDashboard();

    expect(screen.queryByText("🧭 今のペースでの見通し")).toBeNull();
  });

  it("見通しリストは不足（shortfall）が大きい順に並ぶ", () => {
    const data = atRiskData({
      sessions: [
        {
          id: "sess1",
          chapterId: "c1",
          subtopicId: "st1",
          date: daysFromNow(-1),
          minutes: 30,
          correctRate: 0.5,
          selfReport: 2,
        },
      ],
    });
    // 2つ目の小項目（問題数が少ない＝shortfallが小さい）を追加する
    data.chapters[0].subtopics!.push({ id: "st2", name: "軽めの単元", understanding: 0, basicProblems: 3 });
    localStorage.setItem("study-planner-data-v1", JSON.stringify(data));
    renderDashboard();

    const names = Array.from(document.querySelectorAll(".forecast-item-name")).map((el) => el.textContent);
    expect(names[0]).toContain("因数分解"); // basicProblems=50 の方が shortfall が大きいので先頭
    expect(names[1]).toContain("軽めの単元");
  });

  it("60分以上のshortfallは「N時間M分」表記になる", () => {
    const data = atRiskData({
      sessions: [
        {
          id: "sess1",
          chapterId: "c1",
          subtopicId: "st1",
          date: daysFromNow(-1),
          minutes: 30,
          correctRate: 0.5,
          selfReport: 2,
        },
      ],
    });
    localStorage.setItem("study-planner-data-v1", JSON.stringify(data));
    renderDashboard();

    expect(screen.getByText(/あと約\d+時間(\d+分)?\s*足りない見込みです/)).toBeDefined();
  });
});
