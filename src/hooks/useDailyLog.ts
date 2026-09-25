import { useEffect, useRef, useState } from "react";
import { emptyDailyLog, getDailyLog, saveDailyLog } from "../db";
import type { DailyLog } from "../types";

export type SaveState = "idle" | "saving" | "saved";

export function useDailyLog(date: string) {
  const [log, setLog] = useState<DailyLog>(() => emptyDailyLog(date));
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const loadedForDate = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadedForDate.current = null;
    getDailyLog(date).then((loaded) => {
      if (cancelled) return;
      setLog(loaded);
      loadedForDate.current = date;
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [date]);

  useEffect(() => {
    if (loadedForDate.current !== date) return; // 読み込み直後の反映では保存しない
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDailyLog(log).then(() => setSaveState("saved"));
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log, date]);

  return { log, setLog, loading, saveState };
}
