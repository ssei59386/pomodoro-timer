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
  VocabItem,
  VocabRange,
} from "./types";
import {
  advanceVocabItem,
  applySessionToChapter,
  applySessionToSubtopic,
  generateVocabItemsForRange,
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
    vocabItems?: VocabItem[];
  }) => void;
  /** セッションを記録し、対象章の理解度を更新する（§6.1） */
  recordSession: (input: Omit<StudySession, "id">) => void;
  updateSubject: (subject: Subject) => void;
  updateChapter: (chapter: Chapter) => void;
  addChapter: (chapter: Omit<Chapter, "id">) => void;
  removeChapter: (chapterId: string) => void;
  setAvailability: (availability: AvailabilitySettings) => void;
  /** 単語1件の「わかった/わからなかった」を記録し、Leitner箱を更新する（見通し docs/feature-memorization.md） */
  recordVocabAnswer: (itemId: string, wasCorrect: boolean) => void;
  /** オンボーディング後に単語帳の範囲を追加する（Settings から利用。番号ごとの VocabItem も同時生成する） */
  addVocabRange: (range: Omit<VocabRange, "id">) => void;
  /** 単語帳の範囲とその番号アイテムをまとめて削除する */
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

      completeOnboarding: ({ subjects, chapters, availability, vocabRanges = [], vocabItems = [] }) => {
        setData((prev) => ({
          ...prev,
          subjects,
          chapters,
          availability,
          vocabRanges,
          vocabItems,
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

      recordVocabAnswer: (itemId, wasCorrect) => {
        setData((prev) => ({
          ...prev,
          vocabItems: prev.vocabItems.map((item) =>
            item.id === itemId ? advanceVocabItem(item, wasCorrect, new Date()) : item,
          ),
        }));
      },

      addVocabRange: (range) => {
        const newRange: VocabRange = { ...range, id: uid() };
        const newItems = generateVocabItemsForRange(newRange);
        setData((prev) => ({
          ...prev,
          vocabRanges: [...prev.vocabRanges, newRange],
          vocabItems: [...prev.vocabItems, ...newItems],
        }));
      },

      removeVocabRange: (rangeId) => {
        setData((prev) => ({
          ...prev,
          vocabRanges: prev.vocabRanges.filter((r) => r.id !== rangeId),
          vocabItems: prev.vocabItems.filter((i) => i.rangeId !== rangeId),
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
