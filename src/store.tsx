// 仕様書 §4: 状態管理は React の state / Context で十分。
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AppData,
  AvailabilitySettings,
  Chapter,
  ForecastDecisionState,
  StudySession,
  Subject,
  VocabChunk,
  VocabRange,
} from "./types";
import {
  advanceVocabChunk as advanceVocabChunkPure,
  applySessionToChapter,
  applySessionToSubtopic,
  availableMinutesForDate,
  completeVocabChunk as completeVocabChunkPure,
  forecastDecisionKey,
  generateChunksForRange,
  generateTodayPlan,
  restoreUnderstandMode as restoreUnderstandModePure,
  simulateForward,
  snoozeForecastDecision,
  switchToMemorizeMode as switchToMemorizeModePure,
  toISODate,
  updateForecastDecisions,
} from "./logic";
import { clearData, initialData, loadData, saveData, uid } from "./storage";

interface StoreValue {
  data: AppData;
  /** 直近の localStorage 保存に失敗したか（容量超過やプライベートブラウジング制限など） */
  saveError: boolean;
  /** オンボーディングを確定する（教科・章・勉強時間・単語帳の範囲をまとめて保存） */
  completeOnboarding: (input: {
    subjects: Subject[];
    chapters: Chapter[];
    availability: AvailabilitySettings;
    vocabRanges?: VocabRange[];
    vocabChunks?: VocabChunk[];
  }) => void;
  /** セッションを記録し、対象章の理解度を更新する（§6.1） */
  recordSession: (input: Omit<StudySession, "id">) => void;
  /**
   * 「今日の計画」の対象集合（todayPlan）を固定する。既に同じ日付のスナップショットが
   * あれば何もしない（1件記録するたびに次善の項目が滑り込んでくる挙動を防ぐための固定化）。
   */
  ensureTodayPlan: (today: Date) => void;
  /**
   * 後悔防止トリガー（Phase 2）：前向きシミュレーション結果から連続shortfall日数を1日1回だけ更新する。
   * updateForecastDecisions 自体が同日の二重カウントを防ぐので、ensureTodayPlan と違い
   * ここでの no-op ガードは無い（呼び出し側の Home useEffect が todayISO 変化時のみ呼ぶことで
   * 実質1日1回になる）。
   */
  evaluateForecastDecisions: (today: Date) => void;
  /** 「このまま続ける」：ストリークをリセットし、数日は再確認しない */
  continueDecision: (chapterId: string, subtopicId: string | null, today: Date) => void;
  /** 「解き方/訳文を覚えるモードに切り替える」：対象の章/小項目の studyMode を 'memorize' にする */
  switchToMemorizeMode: (chapterId: string, subtopicId: string | null) => void;
  /** 暗記モードから理解モードに戻す（取り消し手段。Home のインライン「元に戻す」/Settings 一覧の両方から呼ばれる） */
  restoreUnderstandMode: (chapterId: string, subtopicId: string | null) => void;
  updateSubject: (subject: Subject) => void;
  /** 教科を新規追加する（段階3：教科の複数登録） */
  addSubject: (subject: Omit<Subject, "id">) => void;
  /** 教科を削除する。その教科に属する章・セッション・単語帳範囲/枠・後悔防止トリガー状態・今日の計画をカスケードで削除する */
  removeSubject: (subjectId: string) => void;
  updateChapter: (chapter: Chapter) => void;
  addChapter: (chapter: Omit<Chapter, "id">) => void;
  removeChapter: (chapterId: string) => void;
  setAvailability: (availability: AvailabilitySettings) => void;
  /** 単語帳の枠1つの「まだ完璧じゃない」を記録し、Leitner箱を進める（docs/feature-memorization.md） */
  advanceVocabChunk: (chunkId: string) => void;
  /** 単語帳の枠1つを「完璧になった」として完了扱いにする。出題対象から外れる */
  completeVocabChunk: (chunkId: string) => void;
  /** オンボーディング後に単語帳の範囲を追加する（Settings から利用。枠ごとの VocabChunk も同時生成する） */
  addVocabRange: (range: Omit<VocabRange, "id">) => void;
  /** 単語帳の範囲とその枠をまとめて削除する */
  removeVocabRange: (rangeId: string) => void;
  resetAll: () => void;
}

// 章削除（removeChapter/removeSubject共通）に伴う、forecastDecisions/todayPlanの
// カスケードプルーン。キーは chapterId が先頭（forecastDecisionKey参照）なので前方一致で判定する。
function pruneForecastDecisions(
  decisions: Record<string, ForecastDecisionState> | undefined,
  removedChapterIds: Set<string>,
): Record<string, ForecastDecisionState> | undefined {
  if (!decisions) return decisions;
  const entries = Object.entries(decisions).filter(([key]) => {
    const chapterId = key.slice(0, key.indexOf(":"));
    return !removedChapterIds.has(chapterId);
  });
  return Object.fromEntries(entries);
}

function pruneTodayPlan(plan: AppData["todayPlan"], removedChapterIds: Set<string>): AppData["todayPlan"] {
  if (!plan) return plan;
  return { ...plan, itemKeys: plan.itemKeys.filter((item) => !removedChapterIds.has(item.chapterId)) };
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData());
  const [saveError, setSaveError] = useState(false);

  // データが変わるたびに端末ローカルへ保存。失敗時はバナー表示のためフラグを立てる。
  // 一度失敗しても次回の保存が成功すればバナーを消したいので、成功時は false に戻す。
  useEffect(() => {
    setSaveError(!saveData(data));
  }, [data]);

  const value = useMemo<StoreValue>(() => {
    return {
      data,
      saveError,

      completeOnboarding: ({ subjects, chapters, availability, vocabRanges = [], vocabChunks = [] }) => {
        setData((prev) => ({
          ...prev,
          subjects,
          chapters,
          availability,
          vocabRanges,
          vocabChunks,
          onboarded: true,
        }));
      },

      recordSession: (input) => {
        const session: StudySession = { ...input, id: uid() };
        setData((prev) => ({
          ...prev,
          sessions: [...prev.sessions, session],
          chapters: prev.chapters.map((c) => {
            if (c.id !== session.chapterId) return c;
            return session.subtopicId
              ? applySessionToSubtopic(c, session.subtopicId, session)
              : applySessionToChapter(c, session);
          }),
        }));
      },

      ensureTodayPlan: (today) => {
        setData((prev) => {
          const todayISO = toISODate(today);
          if (prev.todayPlan && prev.todayPlan.date === todayISO) return prev;
          const todayMinutes = availableMinutesForDate(prev.availability, today);
          const plan = generateTodayPlan(
            prev.chapters,
            prev.subjects,
            todayMinutes,
            today,
            prev.sessions,
            prev.availability,
          );
          const itemKeys = plan.map((item) => ({
            chapterId: item.chapter.id,
            subtopicId: item.subtopic?.id ?? null,
          }));
          return { ...prev, todayPlan: { date: todayISO, itemKeys } };
        });
      },

      evaluateForecastDecisions: (today) => {
        setData((prev) => {
          const forecast = simulateForward(prev.chapters, prev.subjects, prev.availability, today, prev.sessions);
          const forecastDecisions = updateForecastDecisions(
            forecast,
            prev.chapters,
            prev.forecastDecisions ?? {},
            today,
          );
          return { ...prev, forecastDecisions };
        });
      },

      continueDecision: (chapterId, subtopicId, today) => {
        setData((prev) => {
          const key = forecastDecisionKey(chapterId, subtopicId);
          return {
            ...prev,
            forecastDecisions: {
              ...(prev.forecastDecisions ?? {}),
              [key]: snoozeForecastDecision(today),
            },
          };
        });
      },

      switchToMemorizeMode: (chapterId, subtopicId) => {
        setData((prev) => ({
          ...prev,
          chapters: prev.chapters.map((c) => (c.id === chapterId ? switchToMemorizeModePure(c, subtopicId) : c)),
        }));
      },

      restoreUnderstandMode: (chapterId, subtopicId) => {
        setData((prev) => ({
          ...prev,
          chapters: prev.chapters.map((c) => (c.id === chapterId ? restoreUnderstandModePure(c, subtopicId) : c)),
        }));
      },

      updateSubject: (subject) => {
        setData((prev) => ({
          ...prev,
          subjects: prev.subjects.map((s) => (s.id === subject.id ? subject : s)),
        }));
      },

      addSubject: (subject) => {
        setData((prev) => ({
          ...prev,
          subjects: [...prev.subjects, { ...subject, id: uid() }],
        }));
      },

      removeSubject: (subjectId) => {
        setData((prev) => {
          const removedChapterIds = new Set(
            prev.chapters.filter((c) => c.subjectId === subjectId).map((c) => c.id),
          );
          const removedRangeIds = new Set(
            prev.vocabRanges.filter((r) => r.subjectId === subjectId).map((r) => r.id),
          );
          return {
            ...prev,
            subjects: prev.subjects.filter((s) => s.id !== subjectId),
            chapters: prev.chapters.filter((c) => c.subjectId !== subjectId),
            sessions: prev.sessions.filter((s) => !removedChapterIds.has(s.chapterId)),
            vocabRanges: prev.vocabRanges.filter((r) => r.subjectId !== subjectId),
            vocabChunks: prev.vocabChunks.filter((c) => !removedRangeIds.has(c.rangeId)),
            forecastDecisions: pruneForecastDecisions(prev.forecastDecisions, removedChapterIds),
            todayPlan: pruneTodayPlan(prev.todayPlan, removedChapterIds),
          };
        });
      },

      updateChapter: (chapter) => {
        setData((prev) => ({
          ...prev,
          chapters: prev.chapters.map((c) => (c.id === chapter.id ? chapter : c)),
        }));
      },

      addChapter: (chapter) => {
        setData((prev) => ({
          ...prev,
          chapters: [...prev.chapters, { ...chapter, id: uid() }],
        }));
      },

      removeChapter: (chapterId) => {
        setData((prev) => {
          const removedChapterIds = new Set([chapterId]);
          return {
            ...prev,
            chapters: prev.chapters.filter((c) => c.id !== chapterId),
            sessions: prev.sessions.filter((s) => s.chapterId !== chapterId),
            forecastDecisions: pruneForecastDecisions(prev.forecastDecisions, removedChapterIds),
            todayPlan: pruneTodayPlan(prev.todayPlan, removedChapterIds),
          };
        });
      },

      setAvailability: (availability) => {
        setData((prev) => ({ ...prev, availability }));
      },

      advanceVocabChunk: (chunkId) => {
        setData((prev) => ({
          ...prev,
          vocabChunks: prev.vocabChunks.map((chunk) =>
            chunk.id === chunkId ? advanceVocabChunkPure(chunk, new Date()) : chunk,
          ),
        }));
      },

      completeVocabChunk: (chunkId) => {
        setData((prev) => ({
          ...prev,
          vocabChunks: prev.vocabChunks.map((chunk) =>
            chunk.id === chunkId ? completeVocabChunkPure(chunk) : chunk,
          ),
        }));
      },

      addVocabRange: (range) => {
        const newRange: VocabRange = { ...range, id: uid() };
        const newChunks = generateChunksForRange(newRange);
        setData((prev) => ({
          ...prev,
          vocabRanges: [...prev.vocabRanges, newRange],
          vocabChunks: [...prev.vocabChunks, ...newChunks],
        }));
      },

      removeVocabRange: (rangeId) => {
        setData((prev) => ({
          ...prev,
          vocabRanges: prev.vocabRanges.filter((r) => r.id !== rangeId),
          vocabChunks: prev.vocabChunks.filter((c) => c.rangeId !== rangeId),
        }));
      },

      resetAll: () => {
        clearData();
        setData(initialData);
      },
    };
  }, [data, saveError]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export { uid };
