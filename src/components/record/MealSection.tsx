import { Plus, Trash2, Utensils } from "lucide-react";
import type { DailyLog, MealEntry } from "../../types";
import { generateId } from "../../utils/id";

interface MealSectionProps {
  log: DailyLog;
  onChange: (updater: (log: DailyLog) => DailyLog) => void;
}

export default function MealSection({ log, onChange }: MealSectionProps) {
  function addMeal() {
    const meal: MealEntry = { id: generateId(), foodName: "", amount: "" };
    onChange((prev) => ({ ...prev, meals: [...prev.meals, meal] }));
  }

  function updateMeal(id: string, patch: Partial<MealEntry>) {
    onChange((prev) => ({
      ...prev,
      meals: prev.meals.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  }

  function removeMeal(id: string) {
    onChange((prev) => ({ ...prev, meals: prev.meals.filter((m) => m.id !== id) }));
  }

  return (
    <section className="mx-4 mt-4 rounded-2xl bg-white p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-700">
          <Utensils size={16} /> 食事メモ
        </h2>
      </div>

      <div className="flex flex-col gap-2">
        {log.meals.map((meal) => (
          <div key={meal.id} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="食品名（例: 納豆ご飯）"
              value={meal.foodName}
              onChange={(e) => updateMeal(meal.id, { foodName: e.target.value })}
              className="flex-[2] rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            />
            <input
              type="text"
              placeholder="量（例: 1杯）"
              value={meal.amount}
              onChange={(e) => updateMeal(meal.id, { amount: e.target.value })}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            />
            <button
              type="button"
              aria-label="削除"
              onClick={() => removeMeal(meal.id)}
              className="rounded-lg p-2 text-slate-400 active:bg-slate-100"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addMeal}
        className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-brand-300 py-2 text-sm font-medium text-brand-600 active:bg-brand-50"
      >
        <Plus size={16} /> 食品を追加
      </button>
    </section>
  );
}
