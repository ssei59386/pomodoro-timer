import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { SetEntry, WorkoutEntry } from "../../types";
import { touchExerciseName } from "../../db";
import { useExerciseSuggestions } from "../../hooks/useExerciseSuggestions";

interface ExerciseCardProps {
  workout: WorkoutEntry;
  onChange: (patch: Partial<WorkoutEntry>) => void;
  onRemove: () => void;
}

export default function ExerciseCard({ workout, onChange, onRemove }: ExerciseCardProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestions = useExerciseSuggestions(workout.exerciseName, showSuggestions);

  function updateSet(setNumber: number, patch: Partial<SetEntry>) {
    onChange({
      sets: workout.sets.map((s) => (s.setNumber === setNumber ? { ...s, ...patch } : s)),
    });
  }

  function removeSet(setNumber: number) {
    onChange({
      sets: workout.sets
        .filter((s) => s.setNumber !== setNumber)
        .map((s, i) => ({ ...s, setNumber: i + 1 })),
    });
  }

  function addSet() {
    const prevSet = workout.sets[workout.sets.length - 1];
    const newSet: SetEntry = {
      setNumber: workout.sets.length + 1,
      weight: prevSet?.weight ?? 0,
      reps: prevSet?.reps ?? 0,
    };
    onChange({ sets: [...workout.sets, newSet] });
  }

  function pickSuggestion(name: string) {
    onChange({ exerciseName: name });
    setShowSuggestions(false);
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <div className="relative mb-2 flex items-center gap-2">
        <input
          type="text"
          placeholder="種目名（例: ベンチプレス）"
          value={workout.exerciseName}
          onChange={(e) => onChange({ exerciseName: e.target.value })}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            window.setTimeout(() => setShowSuggestions(false), 120);
            if (workout.exerciseName.trim()) void touchExerciseName(workout.exerciseName);
          }}
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium focus:border-brand-400 focus:outline-none"
        />
        <button
          type="button"
          aria-label="種目を削除"
          onClick={onRemove}
          className="rounded-lg p-2 text-slate-400 active:bg-slate-200"
        >
          <Trash2 size={18} />
        </button>

        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {suggestions.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickSuggestion(name)}
                  className="block w-full px-3 py-2 text-left text-sm text-slate-700 active:bg-brand-50"
                >
                  {name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {workout.sets.map((set) => (
          <div key={set.setNumber} className="flex items-center gap-2">
            <span className="w-9 shrink-0 text-xs text-slate-400">{set.setNumber}セット</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              value={set.weight}
              onChange={(e) => updateSet(set.setNumber, { weight: Number(e.target.value) })}
              className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-sm focus:border-brand-400 focus:outline-none"
            />
            <span className="text-xs text-slate-500">kg ×</span>
            <input
              type="number"
              inputMode="numeric"
              value={set.reps}
              onChange={(e) => updateSet(set.setNumber, { reps: Number(e.target.value) })}
              className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-sm focus:border-brand-400 focus:outline-none"
            />
            <span className="text-xs text-slate-500">回</span>
            <button
              type="button"
              aria-label="セットを削除"
              onClick={() => removeSet(set.setNumber)}
              className="ml-auto rounded-lg p-1.5 text-slate-400 active:bg-slate-200"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addSet}
        className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-brand-300 py-1.5 text-xs font-medium text-brand-600 active:bg-brand-50"
      >
        <Plus size={14} /> セット追加
      </button>
    </div>
  );
}
