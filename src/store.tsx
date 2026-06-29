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
} from "./types";
import { applySessionToChapter } from "./logic";
import { clearData, initialData, loadData, saveData, uid } from "./storage";

interface StoreValue {
  data: AppData;
  /** オンボーディングを確定する（教科・章・勉強時間をまとめて保存） */
  completeOnboarding: (input: {
    subjects: Subject[];
    chapters: Chapter[];
    availability: AvailabilitySettings;
  }) => void;
  /** セッションを記録し、対象章の理解度を更新する（§6.1） */
  recordSession: (input: Omit<StudySession, "id">) => void;
  updateSubject: (subject: Subject) => void;
  updateChapter: (chapter: Chapter) => void;
  addChapter: (chapter: Omit<Chapter, "id">) => void;
  removeChapter: (chapterId: string) => void;
  setAvailability: (availability: AvailabilitySettings) => void;
  resetAll: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData());

  // データが変わるたびに端末ローカルへ保存
  useEffect(() => {
    saveData(data);
  }, [data]);

  const value = useMemo<StoreValue>(() => {
    return {
      data,

      completeOnboarding: ({ subjects, chapters, availability }) => {
        setData((prev) => ({
          ...prev,
          subjects,
          chapters,
          availability,
          onboarded: true,
        }));
      },

      recordSession: (input) => {
        const session: StudySession = { ...input, id: uid() };
        setData((prev) => ({
          ...prev,
          sessions: [...prev.sessions, session],
          chapters: prev.chapters.map((c) =>
            c.id === session.chapterId ? applySessionToChapter(c, session) : c,
          ),
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

      resetAll: () => {
        clearData();
        setData(initialData);
      },
    };
  }, [data]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export { uid };
