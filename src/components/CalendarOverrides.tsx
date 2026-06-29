import { useState } from "react";
import type { AvailabilitySettings, TimeSlot } from "../types";
import { availableMinutesForDate, toISODate } from "../logic";

// 曜日ごとの既定スケジュールとは別に、特定の日だけ空き時間を変更したい場合の
// カレンダー画面。旅行・用事などで「この日だけ違う」を表現する。
const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

interface Props {
  availability: AvailabilitySettings;
  onChange: (dateOverrides: Record<string, TimeSlot[]>) => void;
}

export function CalendarOverrides({ availability, onChange }: Props) {
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<string | null>(null);

  const { dateOverrides } = availability;
  const days = buildMonthGrid(monthCursor);

  const startEditing = (iso: string, weekday: number) => {
    setSelected(iso);
    if (!(iso in dateOverrides)) {
      // 曜日の既定設定を初期値として複製し、そこから調整できるようにする
      const base = availability.weeklySchedule[weekday] ?? [];
      onChange({ ...dateOverrides, [iso]: [...base] });
    }
  };

  const updateSlots = (iso: string, slots: TimeSlot[]) => {
    onChange({ ...dateOverrides, [iso]: slots });
  };

  const addSlot = (iso: string) => {
    updateSlots(iso, [...(dateOverrides[iso] ?? []), { start: "16:00", end: "17:00" }]);
  };

  const updateSlot = (iso: string, index: number, patch: Partial<TimeSlot>) => {
    const slots = dateOverrides[iso] ?? [];
    updateSlots(iso, slots.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const removeSlot = (iso: string, index: number) => {
    const slots = dateOverrides[iso] ?? [];
    updateSlots(iso, slots.filter((_, i) => i !== index));
  };

  const clearOverride = (iso: string) => {
    const next = { ...dateOverrides };
    delete next[iso];
    onChange(next);
    setSelected(null);
  };

  const selectedSlots = selected ? dateOverrides[selected] ?? [] : [];

  return (
    <div className="calendar-overrides">
      <div className="calendar-month-head">
        <button
          type="button"
          className="icon-btn"
          aria-label="前の月"
          onClick={() => setMonthCursor(addMonths(monthCursor, -1))}
        >
          ‹
        </button>
        <span className="calendar-month-label">
          {monthCursor.getFullYear()}年{monthCursor.getMonth() + 1}月
        </span>
        <button
          type="button"
          className="icon-btn"
          aria-label="次の月"
          onClick={() => setMonthCursor(addMonths(monthCursor, 1))}
        >
          ›
        </button>
      </div>

      <div className="calendar-grid">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="calendar-weekday">
            {w}
          </div>
        ))}
        {days.map((date, i) => {
          if (!date) return <div key={i} className="calendar-cell empty" />;
          const iso = toISODate(date);
          const minutes = availableMinutesForDate(availability, date);
          const overridden = iso in dateOverrides;
          const classNames = [
            "calendar-cell",
            selected === iso && "selected",
            overridden && "overridden",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              type="button"
              key={iso}
              className={classNames}
              onClick={() => startEditing(iso, date.getDay())}
            >
              <span className="calendar-date">{date.getDate()}</span>
              <span className="calendar-minutes">{minutes > 0 ? `${minutes}分` : "-"}</span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="calendar-day-editor">
          <div className="calendar-day-editor-head">
            <h4>{formatDateLabel(selected)}</h4>
            <button type="button" className="secondary small" onClick={() => clearOverride(selected)}>
              曜日の設定に戻す
            </button>
          </div>
          {selectedSlots.map((slot, i) => (
            <div key={i} className="time-slot-row">
              <input
                type="time"
                value={slot.start}
                onChange={(e) => updateSlot(selected, i, { start: e.target.value })}
              />
              <span className="muted">〜</span>
              <input
                type="time"
                value={slot.end}
                onChange={(e) => updateSlot(selected, i, { end: e.target.value })}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label="この時間帯を削除"
                onClick={() => removeSlot(selected, i)}
              >
                ✕
              </button>
            </div>
          ))}
          {selectedSlots.length === 0 && <p className="muted small">この日は予定なし（0分）です。</p>}
          <button type="button" className="secondary small" onClick={() => addSlot(selected)}>
            ＋ 時間帯を追加
          </button>
        </div>
      )}
    </div>
  );
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

/** 月グリッド（日曜始まり）。月の前後の空白セルは null で埋める */
function buildMonthGrid(monthStart: Date): (Date | null)[] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const firstWeekday = monthStart.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
}

function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}
