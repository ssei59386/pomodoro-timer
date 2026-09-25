import { Dumbbell, Plus } from "lucide-react";
import type { DailyLog, WorkoutEntry } from "../../types";
import { generateId } from "../../utils/id";
import ExerciseCard from "./ExerciseCard";

interface WorkoutSectionProps {
  log: DailyLog;
  onChange: (updater: (log: DailyLog) => DailyLog) => void;
}

export default function WorkoutSection({ log, onChange }: WorkoutSectionProps) {
  function addWorkout() {
    const workout: WorkoutEntry = {
      id: generateId(),
      exerciseName: "",
      sets: [{ setNumber: 1, weight: 0, reps: 0 }],
    };
    onChange((prev) => ({ ...prev, workouts: [...prev.workouts, workout] }));
  }

  function updateWorkout(id: string, patch: Partial<WorkoutEntry>) {
    onChange((prev) => ({
      ...prev,
      workouts: prev.workouts.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    }));
  }

  function removeWorkout(id: string) {
    onChange((prev) => ({ ...prev, workouts: prev.workouts.filter((w) => w.id !== id) }));
  }

  return (
    <section className="mx-4 mt-4 rounded-2xl bg-white p-4 shadow-card">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-700">
        <Dumbbell size={16} /> トレーニング
      </h2>

      <div className="flex flex-col gap-3">
        {log.workouts.map((workout) => (
          <ExerciseCard
            key={workout.id}
            workout={workout}
            onChange={(patch) => updateWorkout(workout.id, patch)}
            onRemove={() => removeWorkout(workout.id)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addWorkout}
        className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-brand-300 py-2 text-sm font-medium text-brand-600 active:bg-brand-50"
      >
        <Plus size={16} /> 種目を追加
      </button>
    </section>
  );
}
