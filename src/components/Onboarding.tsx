import { useState } from "react";
import type { Chapter, Subject, TimeSlot } from "../types";
import {
  DEFAULT_TARGET_UNDERSTANDING,
  selfReportToInitialUnderstanding,
} from "../logic";
import { useStore, uid } from "../store";
import { SelfReportPicker } from "./SelfReportPicker";
import { WeeklyScheduleEditor } from "./WeeklyScheduleEditor";

// 仕様書 §7.1 初期設定 / オンボーディング
// 数学・理科の2教科（Phase 0）と各教科のテスト日、章（名前・配点・自己申告）、勉強可能時間を登録。

type SubjectKey = "math" | "science";

interface DraftChapter {
  key: string; // フォーム内での一時キー
  subjectKey: SubjectKey;
  name: string;
  pointWeight: number;
  selfReport: number; // 1〜5
}

const SUBJECT_LABELS: Record<SubjectKey, string> = {
  math: "数学",
  science: "理科",
};

export function Onboarding() {
  const { completeOnboarding } = useStore();

  const [mathDate, setMathDate] = useState("");
  const [scienceDate, setScienceDate] = useState("");
  const [weeklySchedule, setWeeklySchedule] = useState<Partial<Record<number, TimeSlot[]>>>({});
  const [chapters, setChapters] = useState<DraftChapter[]>([
    { key: uid(), subjectKey: "math", name: "", pointWeight: 20, selfReport: 3 },
  ]);
  const [error, setError] = useState<string | null>(null);

  const addChapter = (subjectKey: SubjectKey) => {
    setChapters((prev) => [
      ...prev,
      { key: uid(), subjectKey, name: "", pointWeight: 20, selfReport: 3 },
    ]);
  };

  const updateChapter = (key: string, patch: Partial<DraftChapter>) => {
    setChapters((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  };

  const removeChapter = (key: string) => {
    setChapters((prev) => prev.filter((c) => c.key !== key));
  };

  const handleSubmit = () => {
    const named = chapters.filter((c) => c.name.trim() !== "");
    if (named.length === 0) {
      setError("章を1つ以上登録してください。");
      return;
    }
    const usedMath = named.some((c) => c.subjectKey === "math");
    const usedScience = named.some((c) => c.subjectKey === "science");
    if (usedMath && !mathDate) {
      setError("数学のテスト日を入力してください。");
      return;
    }
    if (usedScience && !scienceDate) {
      setError("理科のテスト日を入力してください。");
      return;
    }

    const subjects: Subject[] = [];
    const subjectIdByKey: Partial<Record<SubjectKey, string>> = {};
    if (usedMath) {
      const id = uid();
      subjectIdByKey.math = id;
      subjects.push({ id, name: SUBJECT_LABELS.math, testDate: mathDate });
    }
    if (usedScience) {
      const id = uid();
      subjectIdByKey.science = id;
      subjects.push({ id, name: SUBJECT_LABELS.science, testDate: scienceDate });
    }

    const builtChapters: Chapter[] = named.map((c) => ({
      id: uid(),
      subjectId: subjectIdByKey[c.subjectKey]!,
      name: c.name.trim(),
      pointWeight: c.pointWeight,
      // 初回はセッションが無いので、自己申告をそのまま初期理解度にする（§6.1）
      understanding: selfReportToInitialUnderstanding(c.selfReport),
      targetUnderstanding: DEFAULT_TARGET_UNDERSTANDING,
      lastStudiedDate: null,
    }));

    completeOnboarding({
      subjects,
      chapters: builtChapters,
      availability: { weeklySchedule, dateOverrides: {} },
    });
  };

  return (
    <div className="onboarding">
      <header className="onboarding-header">
        <h1>はじめの設定</h1>
        <p className="muted">
          数学・理科のテスト日と、勉強する章を登録しましょう。あとから設定で変更できます。
        </p>
      </header>

      <section className="card">
        <h2>テスト日</h2>
        <label className="field">
          <span>数学のテスト日</span>
          <input
            type="date"
            value={mathDate}
            onChange={(e) => setMathDate(e.target.value)}
          />
        </label>
        <label className="field">
          <span>理科のテスト日</span>
          <input
            type="date"
            value={scienceDate}
            onChange={(e) => setScienceDate(e.target.value)}
          />
        </label>
      </section>

      <section className="card">
        <h2>勉強できる時間</h2>
        <p className="muted">
          曜日ごとに勉強できる時間帯を入れてください。予定が無い曜日は空のままで大丈夫です。
        </p>
        <WeeklyScheduleEditor value={weeklySchedule} onChange={setWeeklySchedule} />
      </section>

      <section className="card">
        <h2>章の登録</h2>
        <p className="muted">
          章ごとに「名前・配点・今の理解度（自己申告）」を入れてください。
        </p>

        {chapters.map((c) => (
          <div key={c.key} className="chapter-draft">
            <div className="chapter-draft-row">
              <select
                value={c.subjectKey}
                onChange={(e) =>
                  updateChapter(c.key, { subjectKey: e.target.value as SubjectKey })
                }
              >
                <option value="math">数学</option>
                <option value="science">理科</option>
              </select>
              <input
                type="text"
                placeholder="章名（例：二次関数）"
                value={c.name}
                onChange={(e) => updateChapter(c.key, { name: e.target.value })}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label="削除"
                onClick={() => removeChapter(c.key)}
              >
                ✕
              </button>
            </div>
            <div className="chapter-draft-row">
              <label className="field inline">
                <span>配点</span>
                <input
                  type="number"
                  min={0}
                  value={c.pointWeight}
                  onChange={(e) =>
                    updateChapter(c.key, { pointWeight: Math.max(0, Number(e.target.value)) })
                  }
                />
              </label>
            </div>
            <div className="self-report-block">
              <span className="self-report-label">今の理解度（自己申告）</span>
              <SelfReportPicker
                value={c.selfReport}
                onChange={(v) => updateChapter(c.key, { selfReport: v })}
              />
            </div>
          </div>
        ))}

        <div className="add-chapter-buttons">
          <button type="button" className="secondary" onClick={() => addChapter("math")}>
            ＋ 数学の章
          </button>
          <button type="button" className="secondary" onClick={() => addChapter("science")}>
            ＋ 理科の章
          </button>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      <button type="button" className="primary big" onClick={handleSubmit}>
        この内容で始める
      </button>
    </div>
  );
}
