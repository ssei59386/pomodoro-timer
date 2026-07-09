import { useEffect, useRef, useState } from "react";
import type { Chapter, Subject, TimeSlot, VocabChunk, VocabRange } from "../types";
import {
  DEFAULT_TARGET_UNDERSTANDING,
  averageInitialUnderstanding,
  generateChunksForRange,
  hasAnyValidTimeSlotInSchedule,
  hasInvalidTimeSlotInSchedule,
  slotMinutes,
  validateSubjectHasContent,
  validateTestDate,
  validateVocabRangeDraft,
} from "../logic";
import { useStore, uid } from "../store";
import { clearOnboardingDraft, loadOnboardingDraft, saveOnboardingDraft } from "../storage";
import { SUBJECT_TEMPLATES, levelToUnderstanding } from "../data/subjectTemplates";
import {
  makeBlankChapter,
  type DraftChapter,
  type DraftSubject,
  type DraftVocabRange,
  type OnboardingDraft,
} from "./onboarding/onboardingTypes";
import { OnboardingStepSubjects } from "./onboarding/OnboardingStepSubjects";
import { OnboardingStepTestDates } from "./onboarding/OnboardingStepTestDates";
import { OnboardingStepSubjectContent } from "./onboarding/OnboardingStepSubjectContent";
import { OnboardingStepSchedule } from "./onboarding/OnboardingStepSchedule";
import { OnboardingStepOverrides } from "./onboarding/OnboardingStepOverrides";
import { OnboardingStepReview, type ReviewSubjectSummary } from "./onboarding/OnboardingStepReview";

// 仕様書 §7.1 初期設定 / オンボーディング（本格ステップ式ウィザード版、docs/feature-onboarding-wizard.md）。
// 教科は固定5種のテンプレート（数学・理科・英語・社会・国語）から自由に追加でき、同じテンプレートを
// 複数回追加することもできる（教科の複数登録対応、段階5）。教科ごとのテスト日、章（名前・達成段階）、
// 勉強可能時間を登録する。章を持てるか・暗記範囲を持てるかは SUBJECT_TEMPLATES（段階1）が決める。
//
// ステップは「使う教科を選ぶ→テスト日→教科ごとの内容→勉強できる時間→特別な予定→確認画面」の順。
// Androidの物理戻る/スワイプバックとの統合は今回スコープ外（画面内の「戻る」ボタンのみ対応、
// docs/feature-onboarding-wizard.md「未確認・実装後にやること」参照）。

/** ウィザードの1ステップ。教科ごとの内容ステップは subjects（追加した教科インスタンス）から動的に組み立てる */
type Step =
  | { kind: "subjects" }
  | { kind: "testDates" }
  | { kind: "subjectContent"; subject: DraftSubject; indexInContent: number; totalContent: number }
  | { kind: "schedule" }
  | { kind: "overrides" }
  | { kind: "review" };

function buildSteps(subjects: DraftSubject[]): Step[] {
  return [
    { kind: "subjects" },
    { kind: "testDates" },
    ...subjects.map(
      (subject, i): Step => ({
        kind: "subjectContent",
        subject,
        indexInContent: i,
        totalContent: subjects.length,
      }),
    ),
    { kind: "schedule" },
    { kind: "overrides" },
    { kind: "review" },
  ];
}

function titleFor(step: Step): string {
  switch (step.kind) {
    case "subjects":
      return "使う教科を選ぶ";
    case "testDates":
      return "テスト日を登録";
    case "subjectContent":
      return `${step.subject.name}の内容（教科 ${step.indexInContent + 1}/${step.totalContent}）`;
    case "schedule":
      return "勉強できる時間";
    case "overrides":
      return "特別な予定";
    case "review":
      return "内容を確認";
  }
}

function introTextFor(step: Step): string {
  switch (step.kind) {
    case "subjects":
      // 教科は Settings からも追加・変更できるようになったため（段階3の addSubject/removeSubject）、
      // 「あとから増やせない」ことを前提にした注意書きは撤去した（教科の複数登録対応、段階5）。
      return "テストがある教科を選んで追加してください。同じ教科テンプレートを複数回追加することもできます（例：数学Iと数学Aを別々のテスト日で登録）。あとから設定でも教科を追加・変更できます。";
    case "testDates":
      return "追加した教科ごとに定期テストの日付を入力してください。";
    case "subjectContent":
      return "この教科の章や暗記範囲を登録します。あとから設定でも編集できます。";
    case "schedule":
      return "曜日ごとに「何時から何時まで」勉強できるかを入力してください。勉強しない曜日は空のままで大丈夫です。複数の時間帯がある場合は「＋ 時間帯を追加」で追加できます。";
    case "overrides":
      return "旅行・部活など、曜日の設定と違う日があればあとから追加できます。スキップしてもかまいません。あとで設定画面からも変更できます。";
    case "review":
      return "この内容で登録します。間違いがあれば各項目の「編集」から直せます。";
  }
}

export function Onboarding() {
  const { completeOnboarding } = useStore();

  // version 不一致（旧 version 1 の下書き）は破棄され null が返る。教科の複数登録対応（段階5）で
  // OnboardingDraft の形が変わったため、途中中断者のみ最初からになる（影響軽微、feature-onboarding-wizard.md参照）。
  const [initialDraft] = useState(() => loadOnboardingDraft<OnboardingDraft>(2));

  const [subjects, setSubjects] = useState<DraftSubject[]>(initialDraft?.subjects ?? []);
  const [chapters, setChapters] = useState<DraftChapter[]>(initialDraft?.chapters ?? []);
  const [vocabRanges, setVocabRanges] = useState<DraftVocabRange[]>(initialDraft?.vocabRanges ?? []);
  const [weeklySchedule, setWeeklySchedule] = useState<Partial<Record<number, TimeSlot[]>>>(
    initialDraft?.weeklySchedule ?? {},
  );
  const [dateOverrides, setDateOverrides] = useState<Record<string, TimeSlot[]>>(
    initialDraft?.dateOverrides ?? {},
  );

  const steps = buildSteps(subjects);
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.min(Math.max(initialDraft?.currentStepIndex ?? 0, 0), steps.length - 1),
  );
  // 教科選択に戻って選択数を減らした直後などで、steps の長さが currentIndex より短くなることがあるため
  // 安全側にクランプする。
  const safeIndex = Math.min(currentIndex, steps.length - 1);
  const currentStep = steps[safeIndex];

  const [stepError, setStepError] = useState<string | null>(null);
  const [weeklyScheduleError, setWeeklyScheduleError] = useState(false);

  const stepTopRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    stepTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [safeIndex]);

  // ステップ＋教科ループに分割すると完了までの所要時間・中断確率が増えるため、本番データとは
  // 別キーに下書きを保存し、途中でタブを閉じても再開できるようにする（docs/feature-onboarding-wizard.md）。
  useEffect(() => {
    saveOnboardingDraft<OnboardingDraft>({
      version: 2,
      subjects,
      chapters,
      vocabRanges,
      weeklySchedule,
      dateOverrides,
      currentStepIndex: safeIndex,
    });
  }, [subjects, chapters, vocabRanges, weeklySchedule, dateOverrides, safeIndex]);

  const goToIndex = (index: number) => {
    setStepError(null);
    setCurrentIndex(index);
  };

  /** 確認画面の「編集」ボタンから該当ステップへジャンプする。常に最新の steps に対して探す */
  const goToStepMatching = (predicate: (step: Step) => boolean) => {
    const index = steps.findIndex(predicate);
    if (index >= 0) goToIndex(index);
  };

  const handleBack = () => {
    goToIndex(Math.max(0, safeIndex - 1));
  };

  // バリデーション失敗時はエラー文をセットするだけでなく、ステップ先頭（エラー表示位置）まで
  // スクロールして戻す。章・小項目を多数登録して画面下部で「次へ」を押した場合、エラーは
  // 見出し直下（画面外）に出るためボタン付近では何も起きていないように見える＝サイレント失敗に
  // なるのを防ぐ（ux-reviewer P0 指摘。CLAUDE.md「最初の数分のサイレント失敗はP0」）。
  const fail = (message: string) => {
    setStepError(message);
    stepTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleNext = () => {
    if (currentStep.kind === "subjects") {
      if (subjects.length === 0) {
        fail("使う教科を1つ以上追加してください。");
        return;
      }
      // 章を持てる教科は、入力を始めやすいよう空の章を1つ用意しておく（この教科インスタンスにまだ章が無ければ）
      setChapters((prev) => {
        const additions: DraftChapter[] = [];
        for (const subject of subjects) {
          if (!SUBJECT_TEMPLATES[subject.templateKey].chapterCapable) continue;
          if (!prev.some((c) => c.subjectInstanceId === subject.instanceId)) {
            additions.push(makeBlankChapter(subject.instanceId));
          }
        }
        return additions.length > 0 ? [...prev, ...additions] : prev;
      });
      goToIndex(safeIndex + 1);
      return;
    }

    if (currentStep.kind === "testDates") {
      const today = new Date();
      for (const subject of subjects) {
        const dateError = validateTestDate(subject.name, subject.testDate, today);
        if (dateError) {
          fail(dateError);
          return;
        }
      }
      goToIndex(safeIndex + 1);
      return;
    }

    if (currentStep.kind === "subjectContent") {
      const { subject } = currentStep;
      const namedChapters = chapters.filter(
        (c) => c.subjectInstanceId === subject.instanceId && c.name.trim() !== "",
      );
      // 何かしら入力されている（ラベル or 開始/終了番号のいずれか）行だけをバリデーション対象にする。
      // ＋ボタンで足しただけの空行はスキップ扱いにする（次へをブロックしない）。
      const attemptedVocabRanges = vocabRanges.filter(
        (v) =>
          v.subjectInstanceId === subject.instanceId &&
          (v.label.trim() !== "" || v.startNumber !== null || v.endNumber !== null),
      );
      for (const v of attemptedVocabRanges) {
        const vocabError = validateVocabRangeDraft(v);
        if (vocabError) {
          fail(vocabError);
          return;
        }
      }
      const contentError = validateSubjectHasContent(namedChapters.length, attemptedVocabRanges.length);
      if (contentError) {
        fail(contentError);
        return;
      }
      goToIndex(safeIndex + 1);
      return;
    }

    if (currentStep.kind === "schedule") {
      const groups = Object.values(weeklySchedule).map((slots) => slots ?? []);
      if (hasInvalidTimeSlotInSchedule(groups)) {
        setWeeklyScheduleError(true);
        fail("「勉強できる時間」に終了時刻が開始時刻より前の入力があります。修正してください。");
        return;
      }
      if (!hasAnyValidTimeSlotInSchedule(groups)) {
        setWeeklyScheduleError(true);
        fail("勉強できる時間を少なくとも1つ設定してください。");
        return;
      }
      setWeeklyScheduleError(false);
      goToIndex(safeIndex + 1);
      return;
    }

    if (currentStep.kind === "overrides") {
      const groups = Object.values(dateOverrides).map((slots) => slots ?? []);
      if (hasInvalidTimeSlotInSchedule(groups)) {
        fail("「特別な予定」に終了時刻が開始時刻より前の入力があります。修正してください。");
        return;
      }
      goToIndex(safeIndex + 1);
      return;
    }

    submit();
  };

  const submit = () => {
    // ここまでの各ステップのバリデーションを通過済みなので、最終送信では組み立てのみ行う。
    const builtSubjects: Subject[] = [];
    const subjectIdByInstanceId: Record<string, string> = {};
    for (const draftSubject of subjects) {
      const id = uid();
      subjectIdByInstanceId[draftSubject.instanceId] = id;
      builtSubjects.push({
        id,
        name: draftSubject.name.trim(),
        testDate: draftSubject.testDate,
        templateKey: draftSubject.templateKey,
      });
    }

    // ステップ0（使う教科を選ぶ）で削除した教科インスタンスのデータが万一残っていても送信しない
    // （subjects が使用教科インスタンスの正）。
    const subjectInstanceIds = new Set(subjects.map((s) => s.instanceId));
    const named = chapters.filter(
      (c) => subjectInstanceIds.has(c.subjectInstanceId) && c.name.trim() !== "",
    );
    const attemptedVocabRanges = vocabRanges.filter(
      (v) =>
        subjectInstanceIds.has(v.subjectInstanceId) &&
        (v.label.trim() !== "" || v.startNumber !== null || v.endNumber !== null),
    );

    // 単語帳の範囲がどの章（教科書レッスン）に紐づくかは DraftChapter.key で参照しているため、
    // 実際の Chapter.id が採番されるこのループの中で対応表を作る（vocabRanges の構築はこの後）。
    const chapterIdByKey = new Map<string, string>();
    const builtChapters: Chapter[] = named.map((c) => {
      const chapterId = uid();
      chapterIdByKey.set(c.key, chapterId);
      const namedSubtopics = c.subtopics.filter((st) => st.name.trim() !== "");
      // 初回はセッションが無いので、達成段階の初期選択から理解度を決める（記録画面と同じ言葉に統一、
      // docs/feature-study-policy.md）。小項目に分けて入力していれば、その平均を使う（より精緻な初期値）。
      const understanding =
        namedSubtopics.length > 0
          ? averageInitialUnderstanding(namedSubtopics.map((st) => st.achievedLevel))
          : levelToUnderstanding(c.achievedLevel);
      return {
        id: chapterId,
        subjectId: subjectIdByInstanceId[c.subjectInstanceId]!,
        name: c.name.trim(),
        understanding,
        targetUnderstanding: DEFAULT_TARGET_UNDERSTANDING,
        lastStudiedDate: null,
        subtopics:
          namedSubtopics.length > 0
            ? namedSubtopics.map((st) => ({
                id: uid(),
                name: st.name.trim(),
                understanding: levelToUnderstanding(st.achievedLevel),
                basicProblems: st.basicProblems ?? undefined,
                difficultyLevel: st.difficultyLevel ?? undefined,
                teacherHinted: st.teacherHinted,
                track: st.track ?? undefined,
              }))
            : undefined,
      };
    });

    const builtVocabRanges: VocabRange[] = attemptedVocabRanges.map((v) => ({
      id: uid(),
      subjectId: subjectIdByInstanceId[v.subjectInstanceId]!,
      label: v.label.trim(),
      chapterId: v.chapterKey ? chapterIdByKey.get(v.chapterKey) : undefined,
      startNumber: v.startNumber!,
      endNumber: v.endNumber!,
    }));
    const builtVocabChunks: VocabChunk[] = builtVocabRanges.flatMap((range) =>
      generateChunksForRange(range),
    );

    completeOnboarding({
      subjects: builtSubjects,
      chapters: builtChapters,
      availability: { weeklySchedule, dateOverrides },
      vocabRanges: builtVocabRanges,
      vocabChunks: builtVocabChunks,
    });
    clearOnboardingDraft();
  };

  const reviewSubjects: ReviewSubjectSummary[] = subjects.map((s) => ({
    instanceId: s.instanceId,
    label: s.name,
    testDate: s.testDate,
    chapterCount: chapters.filter((c) => c.subjectInstanceId === s.instanceId && c.name.trim() !== "").length,
    vocabRangeCount: vocabRanges.filter(
      (v) =>
        v.subjectInstanceId === s.instanceId &&
        (v.label.trim() !== "" || v.startNumber !== null || v.endNumber !== null),
    ).length,
  }));
  const weeklyTotalMinutes = Object.values(weeklySchedule).reduce(
    (sum, slots) => sum + (slots ?? []).reduce((s, slot) => s + slotMinutes(slot), 0),
    0,
  );
  const overrideDayCount = Object.keys(dateOverrides).length;

  return (
    <div className="onboarding">
      <header className="onboarding-header" ref={stepTopRef}>
        <h1>はじめの設定</h1>
      </header>

      <div className="wizard-step-head">
        <h2>{titleFor(currentStep)}</h2>
        {currentStep.kind === "overrides" && <span className="optional-badge">任意</span>}
      </div>
      <p className="muted wizard-step-intro">{introTextFor(currentStep)}</p>

      {stepError && <p className="error">{stepError}</p>}

      {currentStep.kind === "subjects" && (
        <OnboardingStepSubjects subjects={subjects} onChange={setSubjects} />
      )}

      {currentStep.kind === "testDates" && (
        <OnboardingStepTestDates
          subjects={subjects}
          onChange={(instanceId, date) =>
            setSubjects((prev) =>
              prev.map((s) => (s.instanceId === instanceId ? { ...s, testDate: date } : s)),
            )
          }
        />
      )}

      {currentStep.kind === "subjectContent" && (
        <OnboardingStepSubjectContent
          subject={currentStep.subject}
          chapters={chapters}
          setChapters={setChapters}
          vocabRanges={vocabRanges}
          setVocabRanges={setVocabRanges}
        />
      )}

      {currentStep.kind === "schedule" && (
        <OnboardingStepSchedule
          value={weeklySchedule}
          onChange={setWeeklySchedule}
          hasError={weeklyScheduleError}
        />
      )}

      {currentStep.kind === "overrides" && (
        <OnboardingStepOverrides value={dateOverrides} onChange={setDateOverrides} />
      )}

      {currentStep.kind === "review" && (
        <OnboardingStepReview
          subjects={reviewSubjects}
          weeklyTotalMinutes={weeklyTotalMinutes}
          overrideDayCount={overrideDayCount}
          onEditTestDates={() => goToStepMatching((s) => s.kind === "testDates")}
          onEditSubjectContent={(instanceId) =>
            goToStepMatching((s) => s.kind === "subjectContent" && s.subject.instanceId === instanceId)
          }
          onEditSchedule={() => goToStepMatching((s) => s.kind === "schedule")}
          onEditOverrides={() => goToStepMatching((s) => s.kind === "overrides")}
        />
      )}

      <div className="wizard-nav-row">
        {safeIndex > 0 && (
          <button type="button" className="secondary" onClick={handleBack}>
            ＜ 戻る
          </button>
        )}
        <button type="button" className="primary big" onClick={handleNext}>
          {currentStep.kind === "review" ? "この内容で始める" : "次へ"}
        </button>
      </div>
    </div>
  );
}
