import { Check, Loader2 } from "lucide-react";
import DateSelector from "../components/record/DateSelector";
import ConditionSection from "../components/record/ConditionSection";
import WorkoutSection from "../components/record/WorkoutSection";
import MealSection from "../components/record/MealSection";
import { useDailyLog } from "../hooks/useDailyLog";

interface RecordScreenProps {
  date: string;
  onDateChange: (date: string) => void;
}

export default function RecordScreen({ date, onDateChange }: RecordScreenProps) {
  const { log, setLog, loading, saveState } = useDailyLog(date);

  return (
    <div>
      <header className="flex items-center justify-between px-4 pt-4">
        <h1 className="text-lg font-bold text-brand-800">MyFitLog</h1>
        <SaveIndicator state={saveState} />
      </header>

      <DateSelector date={date} onChange={onDateChange} />

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <>
          <ConditionSection log={log} onChange={setLog} />
          <WorkoutSection log={log} onChange={setLog} />
          <MealSection log={log} onChange={setLog} />
        </>
      )}
    </div>
  );
}

function SaveIndicator({ state }: { state: "idle" | "saving" | "saved" }) {
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1 text-xs text-slate-400">
        <Loader2 size={13} className="animate-spin" /> 保存中…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1 text-xs text-brand-500">
        <Check size={13} /> 保存済み
      </span>
    );
  }
  return null;
}
