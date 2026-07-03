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
  vocabItems: [],
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
  vocabItems: [],
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
  vocabItems: [],
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
  vocabRanges: [{ id: "r1", subjectId: "s1", label: "ターゲット1900", startNumber: 371, endNumber: 373 }],
  vocabItems: [
    { id: "r1-371", rangeId: "r1", number: 371, introduced: true, box: 5, nextReviewDate: "2026-09-01" },
    { id: "r1-372", rangeId: "r1", number: 372, introduced: true, box: 2, nextReviewDate: "2026-07-10" },
    { id: "r1-373", rangeId: "r1", number: 373, introduced: false, box: 0, nextReviewDate: null },
  ],
  onboarded: true,
};

describe("Dashboard（単語帳の進捗）", () => {
  it("単語帳が登録されているとき、範囲・着手済み数・習得済み数が実装用語を使わずに表示される", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(vocabData));
    renderDashboard();

    expect(screen.getByText("単語帳の進捗")).toBeDefined();
    expect(screen.getByText("ターゲット1900")).toBeDefined();
    expect(
      screen.getByText(/371〜373番のうち、着手済み 2個・5回連続で正解した語 1個/),
    ).toBeDefined();
    expect(screen.queryByText(/box5/)).toBeNull();
  });

  it("単語帳が未登録のときは「単語帳の進捗」セクションが表示されない", () => {
    localStorage.setItem("study-planner-data-v1", JSON.stringify(emptyChaptersData));
    renderDashboard();

    expect(screen.queryByText("単語帳の進捗")).toBeNull();
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

    const sections = document.querySelectorAll("section.card");
    expect(sections).toHaveLength(2);
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
      vocabItems: [],
      availability: {
        weeklySchedule: { 0: [{ start: "00:00", end: "00:30" }], 1: [{ start: "00:00", end: "00:30" }], 2: [{ start: "00:00", end: "00:30" }], 3: [{ start: "00:00", end: "00:30" }], 4: [{ start: "00:00", end: "00:30" }], 5: [{ start: "00:00", end: "00:30" }], 6: [{ start: "00:00", end: "00:30" }] },
        dateOverrides: {},
      },
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
    expect(screen.getByText(/小項目未設定の章はこの見通しの対象外です/)).toBeDefined();

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
