import { useState } from "react";
import BottomNav from "./components/BottomNav";
import RecordScreen from "./screens/RecordScreen";
import CalendarScreen from "./screens/CalendarScreen";
import GraphScreen from "./screens/GraphScreen";
import SettingsScreen from "./screens/SettingsScreen";
import { todayKey } from "./utils/date";

export type TabKey = "record" | "calendar" | "graph" | "settings";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("record");
  const [recordDate, setRecordDate] = useState<string>(todayKey());

  function openRecordFor(date: string) {
    setRecordDate(date);
    setActiveTab("record");
  }

  return (
    <div className="min-h-screen bg-[#f8faf9]">
      <div className="safe-top mx-auto max-w-lg pb-24">
        {activeTab === "record" && (
          <RecordScreen date={recordDate} onDateChange={setRecordDate} />
        )}
        {activeTab === "calendar" && <CalendarScreen onEditDate={openRecordFor} />}
        {activeTab === "graph" && <GraphScreen />}
        {activeTab === "settings" && <SettingsScreen />}
      </div>
      <BottomNav active={activeTab} onChange={setActiveTab} />
    </div>
  );
}
