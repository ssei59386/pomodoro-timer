import { useState } from "react";
import { useStore } from "./store";
import { Onboarding } from "./components/Onboarding";
import { Home } from "./components/Home";
import { SessionRecord } from "./components/SessionRecord";
import { Dashboard } from "./components/Dashboard";
import { Settings } from "./components/Settings";
import { VocabQuiz } from "./components/VocabQuiz";

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
  // 「今日の単語」カードから開く単語クイズ。新しいタブは増やさず、ホームの中の一時的な
  // サブ画面として扱う（記録画面への遷移と同じ「プリセレクトして画面を切り替える」流儀）。
  const [showVocabQuiz, setShowVocabQuiz] = useState(false);

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
          (showVocabQuiz ? (
            <VocabQuiz onDone={() => setShowVocabQuiz(false)} />
          ) : (
            <Home
              onRecord={goRecord}
              onGoSettings={goSettings}
              onVocabQuiz={() => setShowVocabQuiz(true)}
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
        {tab === "dashboard" && <Dashboard onGoSettings={goSettings} onGoHome={goHome} />}
        {tab === "settings" && <Settings />}
      </main>

      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={t.id === tab ? "tab active" : "tab"}
            onClick={() => {
              setTab(t.id);
              setShowVocabQuiz(false);
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
