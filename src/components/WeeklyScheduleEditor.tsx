import type { TimeSlot } from "../types";
import { isValidTimeSlot, slotMinutes } from "../logic";

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
  /** true のとき各曜日に初期スロットを1行表示（オンボーディング向け） */
  showInitialSlots?: boolean;
}

export function WeeklyScheduleEditor({ value, onChange, showInitialSlots }: Props) {
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
        // showInitialSlots モードでは、まだ入力が無い曜日に空のスロットを1行表示する
        const storedSlots = value[day] ?? [];
        const slots =
          showInitialSlots && storedSlots.length === 0
            ? [{ start: "", end: "" }]
            : storedSlots;
        const isInitialEmpty = showInitialSlots && storedSlots.length === 0;
        const totalMinutes = storedSlots.reduce((sum, s) => sum + slotMinutes(s), 0);
        return (
          <div key={day} className="weekly-schedule-day">
            <div className="weekly-schedule-day-head">
              <span className="day-label">{DAY_LABELS[day]}</span>
              {!showInitialSlots && (
                <span className="muted small">
                  {totalMinutes > 0 ? `${totalMinutes}分` : "予定なし"}
                </span>
              )}
            </div>
            {slots.map((slot, i) => {
              const invalid = !isInitialEmpty && !isValidTimeSlot(slot);
              const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                if (isInitialEmpty) {
                  updateDay(day, [{ start: e.target.value, end: slot.end }]);
                } else {
                  updateSlot(day, i, { start: e.target.value });
                }
              };
              const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                if (isInitialEmpty) {
                  updateDay(day, [{ start: slot.start, end: e.target.value }]);
                } else {
                  updateSlot(day, i, { end: e.target.value });
                }
              };
              return (
                <div key={i}>
                  <div className={invalid ? "time-slot-row invalid" : "time-slot-row"}>
                    <input
                      type="time"
                      value={slot.start}
                      placeholder="--:--"
                      onChange={handleStartChange}
                    />
                    <span className="muted">〜</span>
                    <input
                      type="time"
                      value={slot.end}
                      placeholder="--:--"
                      onChange={handleEndChange}
                    />
                    {!isInitialEmpty && (
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="この時間帯を削除"
                        onClick={() => removeSlot(day, i)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {invalid && <p className="error-inline">終了は開始より後にしてください</p>}
                </div>
              );
            })}
            <button type="button" className="secondary small" onClick={() => addSlot(day)}>
              ＋ 時間帯を追加
            </button>
          </div>
        );
      })}
    </div>
  );
}
