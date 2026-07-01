import { useState } from "react";
import type { TimeSlot } from "../types";
import { isPastDate, isValidTimeSlot } from "../logic";
import { uid } from "../store";

// オンボーディング専用の「特別な予定」入力UI。
// Settings 側のカレンダーグリッド（CalendarOverrides）とは違い、任意項目・低頻度入力という
// 性質に合わせて「日付を1件ずつリストに積む」形にし、ネイティブの date/time ピッカーで操作コストを下げる。
// データ構造（ISO日付文字列 → TimeSlot[]）は CalendarOverrides と共通で、Onboarding 側の
// dateOverrides state / completeOnboarding への受け渡しはそのまま使う。

interface Entry {
  /** フォーム内での一時キー。日付が同じでも別エントリとして編集できるようにする */
  key: string;
  date: string;
  slots: TimeSlot[];
}

interface Props {
  value: Record<string, TimeSlot[]>;
  onChange: (next: Record<string, TimeSlot[]>) => void;
}

export function DateOverridesList({ value, onChange }: Props) {
  // 入力途中の日付未確定・重複状態も表現したいので、内部では entries（フォーム用の配列）を持ち、
  // 変更のたびに日付が確定しているものだけを value（Record）に変換して onChange する。
  const [entries, setEntries] = useState<Entry[]>(() =>
    Object.entries(value).map(([date, slots]) => ({ key: uid(), date, slots })),
  );

  const commit = (next: Entry[]) => {
    setEntries(next);
    const record: Record<string, TimeSlot[]> = {};
    for (const entry of next) {
      if (entry.date.trim() === "") continue;
      // 同じ日付が複数エントリにある場合はあとのエントリで上書きする（リストの下ほど優先）
      record[entry.date] = entry.slots;
    }
    onChange(record);
  };

  const addEntry = () => {
    commit([...entries, { key: uid(), date: "", slots: [{ start: "16:00", end: "17:00" }] }]);
  };

  const updateEntry = (key: string, patch: Partial<Entry>) => {
    commit(entries.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  };

  const removeEntry = (key: string) => {
    commit(entries.filter((e) => e.key !== key));
  };

  const addSlot = (key: string) => {
    updateEntry(key, {
      slots: [...(entries.find((e) => e.key === key)?.slots ?? []), { start: "16:00", end: "17:00" }],
    });
  };

  const updateSlot = (key: string, index: number, patch: Partial<TimeSlot>) => {
    const entry = entries.find((e) => e.key === key);
    if (!entry) return;
    updateEntry(key, {
      slots: entry.slots.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    });
  };

  const removeSlot = (key: string, index: number) => {
    const entry = entries.find((e) => e.key === key);
    if (!entry) return;
    updateEntry(key, { slots: entry.slots.filter((_, i) => i !== index) });
  };

  const today = new Date();

  return (
    <div className="date-overrides-list">
      {entries.length === 0 && (
        <p className="muted small">特に登録された予定はありません。</p>
      )}

      {entries.map((entry) => {
        const isDuplicate =
          entry.date.trim() !== "" &&
          entries.some((other) => other.key !== entry.key && other.date === entry.date);
        const isPast = entry.date.trim() !== "" && isPastDate(entry.date, today);

        return (
          <div key={entry.key} className="date-override-entry">
            <div className="date-override-entry-head">
              <input
                type="date"
                value={entry.date}
                onChange={(e) => updateEntry(entry.key, { date: e.target.value })}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label="この予定を削除"
                onClick={() => removeEntry(entry.key)}
              >
                ✕
              </button>
            </div>
            {isDuplicate && (
              <p className="error-inline">同じ日付が他にも登録されています（あとの内容で上書きされます）</p>
            )}
            {isPast && <p className="error-inline">この日付は過去の日付です</p>}

            {entry.slots.map((slot, i) => {
              const invalid = !isValidTimeSlot(slot);
              return (
                <div key={i}>
                  <div className={invalid ? "time-slot-row invalid" : "time-slot-row"}>
                    <input
                      type="time"
                      value={slot.start}
                      onChange={(e) => updateSlot(entry.key, i, { start: e.target.value })}
                    />
                    <span className="muted">〜</span>
                    <input
                      type="time"
                      value={slot.end}
                      onChange={(e) => updateSlot(entry.key, i, { end: e.target.value })}
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="この時間帯を削除"
                      onClick={() => removeSlot(entry.key, i)}
                    >
                      ✕
                    </button>
                  </div>
                  {invalid && <p className="error-inline">終了は開始より後にしてください</p>}
                </div>
              );
            })}
            <button type="button" className="secondary small" onClick={() => addSlot(entry.key)}>
              ＋ 時間帯を追加
            </button>
          </div>
        );
      })}

      <button type="button" className="secondary" onClick={addEntry}>
        ＋ 予定を追加
      </button>
    </div>
  );
}
