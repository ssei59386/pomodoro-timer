import { useState } from "react";
import type { Chapter, ChapterMetadata, Subject, TimeSlot } from "../types";
import {
  DEFAULT_TARGET_UNDERSTANDING,
  computeInitialUnderstanding,
  averageInitialUnderstanding,
} from "../logic";
import { useStore, uid } from "../store";
import { SelfReportPicker } from "./SelfReportPicker";
import { WeeklyScheduleEditor } from "./WeeklyScheduleEditor";

// 仕様書 §7.1 初期設定 / オンボーディング
// 数学・理科の2教科（Phase 0）と各教科のテスト日、章（名前・配点・自己申告）、勉強可能時間を登録。

// 初期理解度確認用は曖昧な手応えラベルではなく、行動レベルの具体的な指標にする
const INITIAL_UNDERSTANDING_LABELS = [
  "解いたことがない",
  "解説を読めば分かる",
  "ヒントがあれば解ける",
  "自力でほぼ解ける",
  "人に教えられる",
];

type SubjectKey = "math" | "science";

interface DraftChapter {
  key: string; // フォーム内での一時キー
  subjectKey: SubjectKey;
  name: string;
  pointWeight: number;
  selfReport: number; // 1〜5
  correctRate: number | null; // 直近の正答率（%表記、未入力なら null）
  subtopics: DraftSubtopic[]; // 空配列なら従来通り chapter 全体の self-report/correctRate を使う
  metadata: {
    exerciseCount: number | null;
    learningScope: string;
    difficultyLevel: number; // 1: 簡単, 2: 中程度, 3: 難しい
  };
}

interface DraftSubtopic {
  key: string; // uid()
  name: string;
  selfReport: number; // 1〜5, デフォルト 3
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
    {
      key: uid(),
      subjectKey: "math",
      name: "",
      pointWeight: 20,
      selfReport: 3,
      correctRate: null,
      subtopics: [],
      metadata: { exerciseCount: null, learningScope: "", difficultyLevel: 2 },
    },
  ]);
  const [error, setError] = useState<string | null>(null);

  const addChapter = (subjectKey: SubjectKey) => {
    setChapters((prev) => [
      ...prev,
      {
        key: uid(),
        subjectKey,
        name: "",
        pointWeight: 20,
        selfReport: 3,
        correctRate: null,
        subtopics: [],
        metadata: { exerciseCount: null, learningScope: "", difficultyLevel: 2 },
      },
    ]);
  };

  const updateChapter = (key: string, patch: Partial<DraftChapter>) => {
    setChapters((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  };

  const removeChapter = (key: string) => {
    setChapters((prev) => prev.filter((c) => c.key !== key));
  };

  const addSubtopic = (chapterKey: string) => {
    setChapters((prev) =>
      prev.map((c) =>
        c.key === chapterKey
          ? { ...c, subtopics: [...c.subtopics, { key: uid(), name: "", selfReport: 3 }] }
          : c,
      ),
    );
  };

  const updateSubtopic = (chapterKey: string, subtopicKey: string, patch: Partial<DraftSubtopic>) => {
    setChapters((prev) =>
      prev.map((c) =>
        c.key === chapterKey
          ? {
              ...c,
              subtopics: c.subtopics.map((st) => (st.key === subtopicKey ? { ...st, ...patch } : st)),
            }
          : c,
      ),
    );
  };

  const removeSubtopic = (chapterKey: string, subtopicKey: string) => {
    setChapters((prev) =>
      prev.map((c) =>
        c.key === chapterKey
          ? { ...c, subtopics: c.subtopics.filter((st) => st.key !== subtopicKey) }
          : c,
      ),
    );
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

    const builtChapters: Chapter[] = named.map((c) => {
      const namedSubtopics = c.subtopics.filter((st) => st.name.trim() !== "");
      // 初回はセッションが無いので、自己申告（＋わかれば直近の正答率）から初期理解度を決める（§6.1）。
      // 小項目に分けて自己申告していれば、その平均を使う（より精緻な初期値）。
      const understanding =
        namedSubtopics.length > 0
          ? averageInitialUnderstanding(namedSubtopics.map((st) => st.selfReport))
          : computeInitialUnderstanding(
              c.selfReport,
              c.correctRate !== null ? clampPercent(c.correctRate) / 100 : undefined,
            );
      const metadata: ChapterMetadata = {};
      if (c.metadata.exerciseCount !== null) {
        metadata.exerciseCount = c.metadata.exerciseCount;
      }
      if (c.metadata.learningScope.trim() !== "") {
        metadata.learningScope = c.metadata.learningScope.trim();
      }
      if (c.metadata.difficultyLevel > 0) {
        metadata.difficultyLevel = c.metadata.difficultyLevel;
      }
      return {
        id: uid(),
        subjectId: subjectIdByKey[c.subjectKey]!,
        name: c.name.trim(),
        pointWeight: c.pointWeight,
        understanding,
        targetUnderstanding: DEFAULT_TARGET_UNDERSTANDING,
        lastStudiedDate: null,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      };
    });

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
            <div className="metadata-block">
              <div className="metadata-block-head">
                <span className="muted small">学習メタデータ（任意・AI問題生成などで活用）</span>
              </div>
              <div className="metadata-row">
                <label className="field inline">
                  <span>演習問題数</span>
                  <input
                    type="number"
                    min={0}
                    placeholder="例：25"
                    value={c.metadata.exerciseCount ?? ""}
                    onChange={(e) =>
                      updateChapter(c.key, {
                        metadata: {
                          ...c.metadata,
                          exerciseCount:
                            e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                        },
                      })
                    }
                  />
                </label>
              </div>
              <div className="metadata-row">
                <label className="field">
                  <span className="muted small">学習範囲</span>
                  <input
                    type="text"
                    placeholder="例：第3章1節〜2節 / 教科書pp.45-62"
                    value={c.metadata.learningScope}
                    onChange={(e) =>
                      updateChapter(c.key, {
                        metadata: { ...c.metadata, learningScope: e.target.value },
                      })
                    }
                  />
                </label>
              </div>
              <div className="metadata-row">
                <label className="field inline">
                  <span>難易度</span>
                  <select
                    value={c.metadata.difficultyLevel}
                    onChange={(e) =>
                      updateChapter(c.key, {
                        metadata: { ...c.metadata, difficultyLevel: Number(e.target.value) },
                      })
                    }
                  >
                    <option value={1}>簡単</option>
                    <option value={2}>中程度</option>
                    <option value={3}>難しい</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="subtopic-block">
              <div className="subtopic-block-head">
                <span className="muted small">小項目（任意・プリントの見出しなど2〜4個）</span>
                <button type="button" className="link-btn" onClick={() => addSubtopic(c.key)}>
                  ＋ 小項目を追加
                </button>
              </div>
              {c.subtopics.map((st) => (
                <div key={st.key} className="subtopic-row">
                  <input
                    type="text"
                    className="grow"
                    placeholder="小項目名（例：頂点）"
                    value={st.name}
                    onChange={(e) => updateSubtopic(c.key, st.key, { name: e.target.value })}
                  />
                  <SelfReportPicker
                    value={st.selfReport}
                    onChange={(v) => updateSubtopic(c.key, st.key, { selfReport: v })}
                    labels={INITIAL_UNDERSTANDING_LABELS}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="小項目を削除"
                    onClick={() => removeSubtopic(c.key, st.key)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            {c.subtopics.length === 0 && (
              <div className="self-report-block">
                <span className="self-report-label">今の理解度（自己申告）</span>
                <SelfReportPicker
                  value={c.selfReport}
                  onChange={(v) => updateChapter(c.key, { selfReport: v })}
                  labels={INITIAL_UNDERSTANDING_LABELS}
                />
                <label className="field">
                  <span className="muted small">直近の正答率（任意・%、わかれば）</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={c.correctRate ?? ""}
                    onChange={(e) =>
                      updateChapter(c.key, {
                        correctRate: e.target.value === "" ? null : clampPercent(Number(e.target.value)),
                      })
                    }
                  />
                </label>
              </div>
            )}
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

/** ユーザー入力の正答率（%）を 0〜100 にクランプする */
function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}
