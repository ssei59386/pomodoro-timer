import { useState } from "react";
import { useStore } from "./store";
import { Onboarding } from "./components/Onboarding";
import { Home } from "./components/Home";
import { SessionRecord } from "./components/SessionRecord";
import { Dashboard } from "./components/Dashboard";
import { Settings } from "./components/Settings";

// 仕様書 §7: 最小版で必要な画面は5つ。
export type Tab = "home" | "record" | "dashboard" | "settings";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "今日", icon: "📋" },
  { id: "record", label: "記録", icon: "✏️" },
  { id: "dashboard", label: "理解度", icon: "📊" },
  { id: "settings", label: "設定", icon: "⚙️" },
];

export function App() {
  const { data } = useStore();
  const [tab, setTab] = useState<Tab>("home");
  // 「記録する」ボタンから記録画面へ来たときに章を事前選択するための受け渡し
  const [preselectChapterId, setPreselectChapterId] = useState<string | null>(null);

  // 仕様書 §7.1: 未オンボーディングなら初期設定画面を全画面で表示
  if (!data.onboarded) {
    return <Onboarding />;
  }

  const goRecord = (chapterId?: string) => {
    setPreselectChapterId(chapterId ?? null);
    setTab("record");
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>定期テスト学習進捗管理</h1>
      </header>

      <main className="app-main">
        {tab === "home" && <Home onRecord={goRecord} />}
        {tab === "record" && (
          <SessionRecord
            preselectChapterId={preselectChapterId}
            onDone={() => setTab("dashboard")}
          />
        )}
        {tab === "dashboard" && <Dashboard />}
        {tab === "settings" && <Settings />}
      </main>

      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={t.id === tab ? "tab active" : "tab"}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
