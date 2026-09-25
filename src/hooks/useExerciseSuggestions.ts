import { useEffect, useState } from "react";
import { getExerciseSuggestions } from "../db";

export function useExerciseSuggestions(query: string, enabled: boolean) {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    getExerciseSuggestions(query).then((list) => {
      if (!cancelled) setSuggestions(list);
    });
    return () => {
      cancelled = true;
    };
  }, [query, enabled]);

  return suggestions;
}
