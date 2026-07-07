import { useState } from "react";
import { useStore } from "./store";
import { Onboarding } from "./components/Onboarding";
import { Home } from "./components/Home";
import { SessionRecord } from "./components/SessionRecord";
import { Dashboard } from "./components/Dashboard";
import { Settings } from "./components/Settings";
import { VocabQuiz } from "./components/VocabQuiz";
import { StudyPolicy } from "./components/StudyPolicy";

// 仕様書 §7: 最小版で必要な画面は5つ。
export type Tab = "home" | "record" | "dashboard" | "settings";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "今日", icon: "📋" },
  { id: "record", label: "記録", icon: "✏️" },
  { id: "dashboard", label: "理解度", icon: "📊" },
  { id: "settings", label: "設定", icon: "⚙️" },
];

export function App() {
  const { data, saveError } = useStore();
  const [tab, setTab] = useState<Tab>("home");
  // 「記録する」ボタンから記録画面へ来たときに章・小項目を事前選択するための受け渡し
  const [preselectChapterId, setPreselectChapterId] = useState<string | null>(null);
  const [preselectSubtopicId, setPreselectSubtopicId] = useState<string | null>(null);
  // 暗記カード（今日の単語／今日の重要語／今日の漢字・古文単語）から開く暗記クイズ。
  // 新しいタブは増やさず、ホームの中の一時的なサブ画面として扱う（記録画面への遷移と同じ
  // 「プリセレクトして画面を切り替える」流儀）。どの教科カードから開いたかを保持し、
  // VocabQuiz 側でその教科の暗記範囲だけに出題を絞り込めるようにする（修正1、
  // docs/feature-memorization.md。以前は教科を問わず全ての VocabRange を混ぜて出題していた）。
  const [vocabQuizSubjectId, setVocabQuizSubjectId] = useState<string | null>(null);
  // 理解度(Dashboard)タブから開く「勉強方針」の一時サブ画面。VocabQuizと同じ流儀（新規タブは作らない）。
  const [showStudyPolicy, setShowStudyPolicy] = useState(false);

  // 仕様書 §7.1: 未オンボーディングなら初期設定画面を全画面で表示
  if (!data.onboarded) {
    return <Onboarding />;
  }

  const goRecord = (chapterId?: string, subtopicId?: string) => {
    setPreselectChapterId(chapterId ?? null);
    setPreselectSubtopicId(subtopicId ?? null);
    setTab("record");
  };
  const goSettings = () => setTab("settings");
  const goHome = () => setTab("home");

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>定期テスト学習進捗管理</h1>
      </header>

      {saveError && (
        <div className="save-error-banner" role="alert">
          変更を保存できませんでした。ブラウザの空き容量を確認するか、プライベートブラウジングを解除してください。
        </div>
      )}

      <main className="app-main">
        {tab === "home" &&
          (vocabQuizSubjectId ? (
            <VocabQuiz
              subjectId={vocabQuizSubjectId}
              onDone={() => setVocabQuizSubjectId(null)}
            />
          ) : (
            <Home
              onRecord={goRecord}
              onGoSettings={goSettings}
              onVocabQuiz={(subjectId) => setVocabQuizSubjectId(subjectId)}
              onShowStudyPolicy={() => {
                // 勉強方針は理解度タブのサブ画面として実装済みなので、Home からはタブごと
                // 切り替えて開く（App.tsx の showStudyPolicy state をそのまま再利用）。
                setTab("dashboard");
                setShowStudyPolicy(true);
              }}
            />
          ))}
        {tab === "record" && (
          <SessionRecord
            preselectChapterId={preselectChapterId}
            preselectSubtopicId={preselectSubtopicId}
            onDone={() => setTab("dashboard")}
            onGoSettings={goSettings}
          />
        )}
        {tab === "dashboard" &&
          (showStudyPolicy ? (
            <StudyPolicy onDone={() => setShowStudyPolicy(false)} />
          ) : (
            <Dashboard
              onGoSettings={goSettings}
              onGoHome={goHome}
              onShowStudyPolicy={() => setShowStudyPolicy(true)}
            />
          ))}
        {tab === "settings" && <Settings />}
      </main>

      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={t.id === tab ? "tab active" : "tab"}
            onClick={() => {
              setTab(t.id);
              setVocabQuizSubjectId(null);
              setShowStudyPolicy(false);
            }}
          >
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
