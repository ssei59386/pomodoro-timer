import { useRef, useState } from "react";
import type { Chapter, ChapterMetadata, Subject, TimeSlot, VocabChunk, VocabRange } from "../types";
import {
  DEFAULT_TARGET_UNDERSTANDING,
  computeInitialUnderstanding,
  averageInitialUnderstanding,
  generateChunksForRange,
  isPastDate,
  isValidTimeSlot,
  validateVocabRangeDraft,
} from "../logic";
import { useStore, uid } from "../store";
import { SelfReportPicker } from "./SelfReportPicker";
import { WeeklyScheduleEditor } from "./WeeklyScheduleEditor";
import { DateOverridesList } from "./DateOverridesList";
import { CurriculumSuggest } from "./CurriculumSuggest";
import { ChapterCurriculumSuggest } from "./ChapterCurriculumSuggest";
import { CurriculumSubtopicPicker } from "./CurriculumSubtopicPicker";

// 仕様書 §7.1 初期設定 / オンボーディング
// 数学・理科・英語・社会・国語の5教科と各教科のテスト日、章（名前・配点・自己申告）、勉強可能時間を登録。
// 社会・国語は暗記専用教科（章を持たず、暗記範囲のみ）— docs/feature-memorization.md 確定設計v4。

// 初期理解度確認用は曖昧な手応えラベルではなく、行動レベルの具体的な指標にする
const INITIAL_UNDERSTANDING_LABELS = [
  "解いたことがない",
  "解説を読めば分かる",
  "ヒントがあれば解ける",
  "自力でほぼ解ける",
  "人に教えられる",
];

type SubjectKey = "math" | "science" | "english" | "social" | "japanese";

// カリキュラムサジェスト機能（ChapterCurriculumSuggest/CurriculumSuggest/CurriculumSubtopicPicker）は
// 数学・理科向け参考データ専用（著作権上の理由で英語・社会・国語向けデータは作らない方針）。
// これらの教科の章ではこれらのコンポーネントを呼ばないよう、対象教科のときだけ絞り込んだ subject 値を返す。
function curriculumSubjectFor(subjectKey: SubjectKey): "数学" | "理科" | null {
  if (subjectKey === "math") return "数学";
  if (subjectKey === "science") return "理科";
  return null;
}

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
  basicProblems: number | null; // 任意（教科書の例題＋問題集の基礎レベル問題の合計）
  advancedProblems: number | null; // 任意（教科書＋問題集の発展レベル問題の合計）
  difficultyLevel: 1 | 2 | 3 | 4 | 5 | null; // 任意。カリキュラム候補選択で自動入力、手動上書き可
  teacherHinted: boolean; // 先生からテストに出るヒントがあったかどうか
}

const SUBJECT_LABELS: Record<SubjectKey, "数学" | "理科" | "英語" | "社会" | "国語"> = {
  math: "数学",
  science: "理科",
  english: "英語",
  social: "社会",
  japanese: "国語",
};

/** 暗記範囲登録セクションで選べる教科（数学・理科は暗記対象外）とその選択肢の並び順 */
const VOCAB_SUBJECT_KEYS: SubjectKey[] = ["english", "social", "japanese"];

/** 章を持てる教科（社会・国語は暗記専用教科で章を持たない、docs/feature-memorization.md 確定設計v4） */
const CHAPTER_CAPABLE_SUBJECT_KEYS: SubjectKey[] = ["math", "science", "english"];

/**
 * 暗記範囲の登録（確定設計 v2〜v4、docs/feature-memorization.md 参照）。
 * 単語・重要語・漢字/古文単語の意味は一切入力させず、番号の範囲だけを登録する。chapterKey は
 * DraftChapter.key への参照（実際の Chapter.id は送信時に採番されるため、送信時に id へ変換する）。
 * 章を持てるのは数学・理科・英語のみ（社会・国語は暗記専用教科で章を持たない設計、
 * docs/feature-memorization.md 確定設計v4）なので、社会・国語を選んだ場合は「対応する章」は
 * 常に「なし」のみになる。
 */
interface DraftVocabRange {
  key: string;
  label: string;
  subjectKey: SubjectKey;
  chapterKey: string | null;
  startNumber: number | null;
  endNumber: number | null;
}

export function Onboarding() {
  const { completeOnboarding } = useStore();

  const [mathDate, setMathDate] = useState("");
  const [scienceDate, setScienceDate] = useState("");
  const [englishDate, setEnglishDate] = useState("");
  const [socialDate, setSocialDate] = useState("");
  const [japaneseDate, setJapaneseDate] = useState("");
  const [weeklySchedule, setWeeklySchedule] = useState<Partial<Record<number, TimeSlot[]>>>({});
  const [dateOverrides, setDateOverrides] = useState<Record<string, TimeSlot[]>>({});
  const [showDateOverrides, setShowDateOverrides] = useState(false);
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
  const [vocabRanges, setVocabRanges] = useState<DraftVocabRange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [weeklyScheduleError, setWeeklyScheduleError] = useState(false);

  const testDateSectionRef = useRef<HTMLElement | null>(null);
  const weeklyScheduleSectionRef = useRef<HTMLElement | null>(null);
  const dateOverridesSectionRef = useRef<HTMLElement | null>(null);
  const chaptersSectionRef = useRef<HTMLElement | null>(null);
  const vocabSectionRef = useRef<HTMLElement | null>(null);

  const scrollToSection = (ref: React.RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
          ? {
              ...c,
              subtopics: [
                ...c.subtopics,
                {
                  key: uid(),
                  name: "",
                  selfReport: 3,
                  basicProblems: null,
                  advancedProblems: null,
                  difficultyLevel: null,
                  teacherHinted: false,
                },
              ],
            }
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

  const addVocabRange = () => {
    setVocabRanges((prev) => [
      ...prev,
      {
        key: uid(),
        label: "",
        subjectKey: "english",
        chapterKey: null,
        startNumber: null,
        endNumber: null,
      },
    ]);
  };

  const updateVocabRange = (key: string, patch: Partial<DraftVocabRange>) => {
    setVocabRanges((prev) => prev.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  };

  const removeVocabRange = (key: string) => {
    setVocabRanges((prev) => prev.filter((v) => v.key !== key));
  };

  const handleSubmit = () => {
    setWeeklyScheduleError(false);
    const named = chapters.filter((c) => c.name.trim() !== "");
    // 何かしら入力されている（ラベル or 開始/終了番号のいずれか）行だけをバリデーション対象にする。
    // ＋ボタンで足しただけの空行はスキップ扱いにする（送信をブロックしない）。
    const attemptedVocabRanges = vocabRanges.filter(
      (v) => v.label.trim() !== "" || v.startNumber !== null || v.endNumber !== null,
    );
    // 章と単語帳はどちらも「学習する範囲」の登録手段なので、どちらか1つでもあれば送信できる
    // （単語帳のみで使いたい生徒が、意味のない章を1つ登録させられるのを防ぐ。ux-reviewer指摘）。
    if (named.length === 0 && attemptedVocabRanges.length === 0) {
      setError(
        "章または暗記範囲を1つ以上登録してください（下の「暗記範囲の登録」からも登録できます）。",
      );
      scrollToSection(chaptersSectionRef);
      return;
    }
    for (const v of attemptedVocabRanges) {
      const vocabError = validateVocabRangeDraft(v);
      if (vocabError) {
        setError(vocabError);
        scrollToSection(vocabSectionRef);
        return;
      }
    }
    const usedMath =
      named.some((c) => c.subjectKey === "math") ||
      attemptedVocabRanges.some((v) => v.subjectKey === "math");
    const usedScience =
      named.some((c) => c.subjectKey === "science") ||
      attemptedVocabRanges.some((v) => v.subjectKey === "science");
    const usedEnglish =
      named.some((c) => c.subjectKey === "english") ||
      attemptedVocabRanges.some((v) => v.subjectKey === "english");
    const usedSocial =
      named.some((c) => c.subjectKey === "social") ||
      attemptedVocabRanges.some((v) => v.subjectKey === "social");
    const usedJapanese =
      named.some((c) => c.subjectKey === "japanese") ||
      attemptedVocabRanges.some((v) => v.subjectKey === "japanese");
    if (usedMath && !mathDate) {
      setError("数学のテスト日を入力してください。");
      scrollToSection(testDateSectionRef);
      return;
    }
    if (usedScience && !scienceDate) {
      setError("理科のテスト日を入力してください。");
      scrollToSection(testDateSectionRef);
      return;
    }
    if (usedEnglish && !englishDate) {
      setError("英語のテスト日を入力してください。");
      scrollToSection(testDateSectionRef);
      return;
    }
    if (usedSocial && !socialDate) {
      setError("社会のテスト日を入力してください。");
      scrollToSection(testDateSectionRef);
      return;
    }
    if (usedJapanese && !japaneseDate) {
      setError("国語のテスト日を入力してください。");
      scrollToSection(testDateSectionRef);
      return;
    }
    const today = new Date();
    if (usedMath && isPastDate(mathDate, today)) {
      setError("数学のテスト日は今日以降の日付にしてください。");
      scrollToSection(testDateSectionRef);
      return;
    }
    if (usedScience && isPastDate(scienceDate, today)) {
      setError("理科のテスト日は今日以降の日付にしてください。");
      scrollToSection(testDateSectionRef);
      return;
    }
    if (usedEnglish && isPastDate(englishDate, today)) {
      setError("英語のテスト日は今日以降の日付にしてください。");
      scrollToSection(testDateSectionRef);
      return;
    }
    if (usedSocial && isPastDate(socialDate, today)) {
      setError("社会のテスト日は今日以降の日付にしてください。");
      scrollToSection(testDateSectionRef);
      return;
    }
    if (usedJapanese && isPastDate(japaneseDate, today)) {
      setError("国語のテスト日は今日以降の日付にしてください。");
      scrollToSection(testDateSectionRef);
      return;
    }
    const hasInvalidSlot = Object.values(weeklySchedule).some((slots) =>
      (slots ?? []).some((slot) => !isValidTimeSlot(slot)),
    );
    if (hasInvalidSlot) {
      setError(
        "「勉強できる時間」に終了時刻が開始時刻より前の入力があります。修正してください。",
      );
      setWeeklyScheduleError(true);
      scrollToSection(weeklyScheduleSectionRef);
      return;
    }
    const hasAnyValidSlot = Object.values(weeklySchedule).some((slots) =>
      (slots ?? []).some((slot) => isValidTimeSlot(slot)),
    );
    if (!hasAnyValidSlot) {
      setError("勉強できる時間を少なくとも1つ設定してください。");
      setWeeklyScheduleError(true);
      scrollToSection(weeklyScheduleSectionRef);
      return;
    }
    const hasInvalidOverrideSlot = Object.values(dateOverrides).some((slots) =>
      (slots ?? []).some((slot) => !isValidTimeSlot(slot)),
    );
    if (hasInvalidOverrideSlot) {
      setError("「特別な予定」に終了時刻が開始時刻より前の入力があります。修正してください。");
      scrollToSection(dateOverridesSectionRef);
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
    if (usedEnglish) {
      const id = uid();
      subjectIdByKey.english = id;
      subjects.push({ id, name: SUBJECT_LABELS.english, testDate: englishDate });
    }
    if (usedSocial) {
      const id = uid();
      subjectIdByKey.social = id;
      subjects.push({ id, name: SUBJECT_LABELS.social, testDate: socialDate });
    }
    if (usedJapanese) {
      const id = uid();
      subjectIdByKey.japanese = id;
      subjects.push({ id, name: SUBJECT_LABELS.japanese, testDate: japaneseDate });
    }

    // 単語帳の範囲がどの章（教科書レッスン）に紐づくかは DraftChapter.key で参照しているため、
    // 実際の Chapter.id が採番されるこのループの中で対応表を作る（vocabRanges の構築はこの後）。
    const chapterIdByKey = new Map<string, string>();
    const builtChapters: Chapter[] = named.map((c) => {
      const chapterId = uid();
      chapterIdByKey.set(c.key, chapterId);
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
        id: chapterId,
        subjectId: subjectIdByKey[c.subjectKey]!,
        name: c.name.trim(),
        pointWeight: c.pointWeight,
        understanding,
        targetUnderstanding: DEFAULT_TARGET_UNDERSTANDING,
        lastStudiedDate: null,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        subtopics:
          namedSubtopics.length > 0
            ? namedSubtopics.map((st) => ({
                id: uid(),
                name: st.name.trim(),
                understanding: computeInitialUnderstanding(st.selfReport),
                basicProblems: st.basicProblems ?? undefined,
                advancedProblems: st.advancedProblems ?? undefined,
                difficultyLevel: st.difficultyLevel ?? undefined,
                teacherHinted: st.teacherHinted,
              }))
            : undefined,
      };
    });

    const builtVocabRanges: VocabRange[] = attemptedVocabRanges.map((v) => ({
      id: uid(),
      subjectId: subjectIdByKey[v.subjectKey]!,
      label: v.label.trim(),
      chapterId: v.chapterKey ? chapterIdByKey.get(v.chapterKey) : undefined,
      startNumber: v.startNumber!,
      endNumber: v.endNumber!,
    }));
    const builtVocabChunks: VocabChunk[] = builtVocabRanges.flatMap((range) =>
      generateChunksForRange(range),
    );

    completeOnboarding({
      subjects,
      chapters: builtChapters,
      availability: { weeklySchedule, dateOverrides },
      vocabRanges: builtVocabRanges,
      vocabChunks: builtVocabChunks,
    });
  };

  return (
    <div className="onboarding">
      <header className="onboarding-header">
        <h1>はじめの設定</h1>
        <p className="muted">
          数学・理科・英語・社会・国語のテスト日と、勉強する章や暗記範囲を登録しましょう。あとから設定で変更できます。
        </p>
      </header>

      <section className="card" ref={testDateSectionRef}>
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
        <label className="field">
          <span>英語のテスト日</span>
          <input
            type="date"
            value={englishDate}
            onChange={(e) => setEnglishDate(e.target.value)}
          />
        </label>
        <label className="field">
          <span>社会のテスト日</span>
          <input
            type="date"
            value={socialDate}
            onChange={(e) => setSocialDate(e.target.value)}
          />
        </label>
        <label className="field">
          <span>国語のテスト日</span>
          <input
            type="date"
            value={japaneseDate}
            onChange={(e) => setJapaneseDate(e.target.value)}
          />
        </label>
      </section>

      <section className="card" ref={weeklyScheduleSectionRef}>
        <h2>勉強できる時間</h2>
        <p className="muted">
          曜日ごとに「何時から何時まで」勉強できるかを入力してください。勉強しない曜日は空のままで大丈夫です。複数の時間帯がある場合は「＋ 時間帯を追加」で追加できます。
        </p>
        <WeeklyScheduleEditor
          value={weeklySchedule}
          onChange={setWeeklySchedule}
          showInitialSlots
          hasError={weeklyScheduleError}
        />
      </section>

      <section className="card" ref={dateOverridesSectionRef}>
        <div className="section-head-row">
          <h2>特別な予定</h2>
          <span className="optional-badge">任意</span>
        </div>
        <p className="muted">
          旅行・部活など、曜日の設定と違う日があればあとから追加できます。スキップしてもかまいません。あとで設定画面からも変更できます。
        </p>
        {showDateOverrides ? (
          <DateOverridesList value={dateOverrides} onChange={setDateOverrides} />
        ) : (
          <button type="button" className="secondary" onClick={() => setShowDateOverrides(true)}>
            特別な予定を設定する
          </button>
        )}
      </section>

      <section className="card" ref={chaptersSectionRef}>
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
                <option value="english">英語</option>
              </select>
              <div className="chapter-name-field">
                <input
                  type="text"
                  placeholder="章名（例：二次関数）"
                  value={c.name}
                  onChange={(e) => updateChapter(c.key, { name: e.target.value })}
                />
                {curriculumSubjectFor(c.subjectKey) && (
                  <ChapterCurriculumSuggest
                    query={c.name}
                    subject={curriculumSubjectFor(c.subjectKey)!}
                  />
                )}
              </div>
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
                <span className="muted small">学習メタデータ（任意・あとで使う項目です）</span>
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
                  <span>章の難易度（3段階）</span>
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
                <div className="subtopic-block-actions">
                  {curriculumSubjectFor(c.subjectKey) && (
                    <CurriculumSubtopicPicker
                      chapterName={c.name}
                      subject={curriculumSubjectFor(c.subjectKey)!}
                      onAdd={(candidates) => {
                        setChapters((prev) =>
                          prev.map((chapter) =>
                            chapter.key === c.key
                              ? {
                                  ...chapter,
                                  subtopics: [
                                    ...chapter.subtopics,
                                    ...candidates.map((cand) => ({
                                      key: uid(),
                                      name: cand.name,
                                      selfReport: 3,
                                      basicProblems: null,
                                      advancedProblems: null,
                                      difficultyLevel: cand.difficultyLevel,
                                      teacherHinted: false,
                                    })),
                                  ],
                                }
                              : chapter,
                          ),
                        );
                      }}
                    />
                  )}
                  <button type="button" className="link-btn" onClick={() => addSubtopic(c.key)}>
                    ＋ 小項目を追加
                  </button>
                </div>
              </div>
              {curriculumSubjectFor(c.subjectKey) && (
                <p className="muted small">
                  小項目名を入力すると、カリキュラム参考データとの一致で難易度が自動入力されます（手動で上書き可）。
                </p>
              )}
              {c.subtopics.map((st) => (
                <div key={st.key} className="subtopic-row">
                  <div className="subtopic-name-field">
                    <input
                      type="text"
                      className="grow"
                      placeholder="小項目名（例：頂点）"
                      value={st.name}
                      onChange={(e) => updateSubtopic(c.key, st.key, { name: e.target.value })}
                    />
                    {curriculumSubjectFor(c.subjectKey) && (
                      <CurriculumSuggest
                        query={st.name}
                        subject={curriculumSubjectFor(c.subjectKey)!}
                        onSelect={(result) =>
                          updateSubtopic(c.key, st.key, { difficultyLevel: result.difficultyLevel })
                        }
                      />
                    )}
                  </div>
                  {st.difficultyLevel !== null && (
                    <span className="muted small">
                      難易度（カリキュラム参考・5段階）：{st.difficultyLevel}
                    </span>
                  )}
                  <SelfReportPicker
                    value={st.selfReport}
                    onChange={(v) => updateSubtopic(c.key, st.key, { selfReport: v })}
                    labels={INITIAL_UNDERSTANDING_LABELS}
                  />
                  <div className="subtopic-problem-row">
                    <label className="field inline">
                      <span className="muted small">基礎問題数</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="教科書の例題+問題集の基礎問題"
                        value={st.basicProblems ?? ""}
                        onChange={(e) =>
                          updateSubtopic(c.key, st.key, {
                            basicProblems: e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                          })
                        }
                      />
                      <span className="muted small">
                        任意・教科書の例題＋問題集の基礎レベル問題の合計
                      </span>
                    </label>
                    <label className="field inline">
                      <span className="muted small">発展問題数</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="教科書+問題集の発展問題"
                        value={st.advancedProblems ?? ""}
                        onChange={(e) =>
                          updateSubtopic(c.key, st.key, {
                            advancedProblems:
                              e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                          })
                        }
                      />
                      <span className="muted small">
                        任意・教科書＋問題集の発展レベル問題の合計
                      </span>
                    </label>
                  </div>
                  <label className="subtopic-hint-row">
                    <input
                      type="checkbox"
                      checked={st.teacherHinted}
                      onChange={(e) =>
                        updateSubtopic(c.key, st.key, { teacherHinted: e.target.checked })
                      }
                    />
                    <span className="muted small">先生からテストのヒントがあった</span>
                  </label>
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
          <button type="button" className="secondary" onClick={() => addChapter("english")}>
            ＋ 英語の章
          </button>
        </div>
      </section>

      <section className="card" ref={vocabSectionRef}>
        <h2>暗記範囲の登録</h2>
        <p className="muted">
          暗記範囲（開始番号〜終了番号）を登録すると、20語ずつの「枠」単位で新規学習・復習の進み具合を自動で管理します（例：ターゲット1900 / 一問一答 歴史 / 漢字ドリル）。意味・読み方などの中身は入力不要です。
        </p>

        {vocabRanges.map((v) => {
          // 対応する章に紐づけられるのは、章を持つ教科（数学・理科・英語）のうち、
          // 今この範囲で選んでいる教科と同じ章だけ（社会・国語は章を持たない教科のため、
          // 選ぶと自動的に「なし」のみになる。docs/feature-memorization.md 確定設計v4）。
          const chapterOptions = chapters.filter(
            (c) => c.subjectKey === v.subjectKey && c.name.trim() !== "",
          );
          return (
            <div key={v.key} className="subtopic-row">
              <div className="chapter-draft-row">
                <select
                  aria-label="暗記範囲の教科"
                  value={v.subjectKey}
                  onChange={(e) =>
                    updateVocabRange(v.key, {
                      subjectKey: e.target.value as SubjectKey,
                      chapterKey: null,
                    })
                  }
                >
                  {VOCAB_SUBJECT_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {SUBJECT_LABELS[key]}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  className="grow"
                  placeholder="ラベル（例：ターゲット1900）"
                  value={v.label}
                  onChange={(e) => updateVocabRange(v.key, { label: e.target.value })}
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="暗記範囲を削除"
                  onClick={() => removeVocabRange(v.key)}
                >
                  ✕
                </button>
              </div>
              <div className="subtopic-problem-row">
                <label className="field inline">
                  <span className="muted small">開始番号</span>
                  <input
                    type="number"
                    min={1}
                    placeholder="例：371"
                    value={v.startNumber ?? ""}
                    onChange={(e) =>
                      updateVocabRange(v.key, {
                        startNumber: e.target.value === "" ? null : Math.max(1, Number(e.target.value)),
                      })
                    }
                  />
                </label>
                <label className="field inline">
                  <span className="muted small">終了番号</span>
                  <input
                    type="number"
                    min={1}
                    placeholder="例：670"
                    value={v.endNumber ?? ""}
                    onChange={(e) =>
                      updateVocabRange(v.key, {
                        endNumber: e.target.value === "" ? null : Math.max(1, Number(e.target.value)),
                      })
                    }
                  />
                </label>
              </div>
              {CHAPTER_CAPABLE_SUBJECT_KEYS.includes(v.subjectKey) && (
                <label className="field">
                  <span className="muted small">対応する章（任意・教科書レッスンに紐づける場合のみ）</span>
                  <select
                    value={v.chapterKey ?? ""}
                    onChange={(e) =>
                      updateVocabRange(v.key, {
                        chapterKey: e.target.value === "" ? null : e.target.value,
                      })
                    }
                  >
                    <option value="">なし</option>
                    {chapterOptions.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          );
        })}

        <button type="button" className="secondary" onClick={addVocabRange}>
          ＋ 暗記範囲を追加
        </button>
      </section>

      <p className="muted small">
        章か暗記範囲のどちらか一方は登録してください（両方登録してもかまいません）。
      </p>
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
