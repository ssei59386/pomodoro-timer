import type { TimeSlot } from "../types";
import { slotMinutes } from "../logic";

// 1日の勉強時間を直接指定する代わりに、曜日ごとの空き時間帯を入力する。
// オンボーディングと設定の両方で使う共通エディタ。
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS: Record<number, string> = {
  0: "日",
  1: "月",
  2: "火",
  3: "水",
  4: "木",
  5: "金",
  6: "土",
};

interface Props {
  value: Partial<Record<number, TimeSlot[]>>;
  onChange: (value: Partial<Record<number, TimeSlot[]>>) => void;
}

export function WeeklyScheduleEditor({ value, onChange }: Props) {
  const updateDay = (day: number, slots: TimeSlot[]) => {
    onChange({ ...value, [day]: slots });
  };

  const addSlot = (day: number) => {
    const slots = value[day] ?? [];
    updateDay(day, [...slots, { start: "16:00", end: "17:00" }]);
  };

  const updateSlot = (day: number, index: number, patch: Partial<TimeSlot>) => {
    const slots = value[day] ?? [];
    updateDay(day, slots.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const removeSlot = (day: number, index: number) => {
    const slots = value[day] ?? [];
    updateDay(day, slots.filter((_, i) => i !== index));
  };

  return (
    <div className="weekly-schedule">
      {DAY_ORDER.map((day) => {
        const slots = value[day] ?? [];
        const totalMinutes = slots.reduce((sum, s) => sum + slotMinutes(s), 0);
        return (
          <div key={day} className="weekly-schedule-day">
            <div className="weekly-schedule-day-head">
              <span className="day-label">{DAY_LABELS[day]}</span>
              <span className="muted small">
                {totalMinutes > 0 ? `${totalMinutes}分` : "予定なし"}
              </span>
            </div>
            {slots.map((slot, i) => (
              <div key={i} className="time-slot-row">
                <input
                  type="time"
                  value={slot.start}
                  onChange={(e) => updateSlot(day, i, { start: e.target.value })}
                />
                <span className="muted">〜</span>
                <input
                  type="time"
                  value={slot.end}
                  onChange={(e) => updateSlot(day, i, { end: e.target.value })}
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="この時間帯を削除"
                  onClick={() => removeSlot(day, i)}
                >
                  ✕
                </button>
              </div>
            ))}
            <button type="button" className="secondary small" onClick={() => addSlot(day)}>
              ＋ 時間帯を追加
            </button>
          </div>
        );
      })}
    </div>
  );
}
