import { CalendarDays, LineChart, NotebookPen, Settings } from "lucide-react";
import type { TabKey } from "../App";

interface BottomNavProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

const TABS: { key: TabKey; label: string; icon: typeof NotebookPen }[] = [
  { key: "record", label: "記録", icon: NotebookPen },
  { key: "calendar", label: "カレンダー", icon: CalendarDays },
  { key: "graph", label: "グラフ", icon: LineChart },
  { key: "settings", label: "設定", icon: Settings },
];

export default function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-20 border-t border-brand-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg">
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                isActive ? "text-brand-600" : "text-slate-400"
              }`}
              aria-current={isActive}
            >
              <Icon size={22} strokeWidth={isActive ? 2.4 : 1.9} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
