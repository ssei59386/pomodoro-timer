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
  generateChunksForRange,
  generateTodayPlan,
  toISODate,
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
  updateSubject: (subject: Subject) => void;
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
          const plan = generateTodayPlan(prev.chapters, prev.subjects, todayMinutes, today, prev.sessions);
          const itemKeys = plan.map((item) => ({
            chapterId: item.chapter.id,
            subtopicId: item.subtopic?.id ?? null,
          }));
          return { ...prev, todayPlan: { date: todayISO, itemKeys } };
        });
      },

      updateSubject: (subject) => {
        setData((prev) => ({
          ...prev,
          subjects: prev.subjects.map((s) => (s.id === subject.id ? subject : s)),
        }));
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
        setData((prev) => ({
          ...prev,
          chapters: prev.chapters.filter((c) => c.id !== chapterId),
          sessions: prev.sessions.filter((s) => s.chapterId !== chapterId),
        }));
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
