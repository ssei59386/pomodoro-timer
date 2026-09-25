import { addDays, format, parse } from "date-fns";
import { ja } from "date-fns/locale";

export const DATE_FORMAT = "yyyy-MM-dd";

export function todayKey(): string {
  return format(new Date(), DATE_FORMAT);
}

export function toDateKey(date: Date): string {
  return format(date, DATE_FORMAT);
}

export function fromDateKey(key: string): Date {
  return parse(key, DATE_FORMAT, new Date());
}

export function shiftDateKey(key: string, days: number): string {
  return toDateKey(addDays(fromDateKey(key), days));
}

/**
 * 就寝〜起床の時刻(HH:mm)から睡眠時間(時間, 小数)を計算する。
 * 起床時刻が就寝時刻以前の場合は日を跨いだとみなす。
 */
export function calcSleepDurationHours(
  bedtime?: string,
  waketime?: string
): number | undefined {
  if (!bedtime || !waketime) return undefined;
  const [bh, bm] = bedtime.split(":").map(Number);
  const [wh, wm] = waketime.split(":").map(Number);
  if ([bh, bm, wh, wm].some((n) => Number.isNaN(n))) return undefined;

  const bedMinutes = bh * 60 + bm;
  let wakeMinutes = wh * 60 + wm;
  if (wakeMinutes <= bedMinutes) {
    wakeMinutes += 24 * 60;
  }
  const diffMinutes = wakeMinutes - bedMinutes;
  return Math.round((diffMinutes / 60) * 100) / 100;
}

export function formatDurationHours(hours?: number): string {
  if (hours === undefined || Number.isNaN(hours)) return "";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

export function formatDateLabel(key: string): string {
  const date = fromDateKey(key);
  return format(date, "M月d日 (E)", { locale: ja });
}

export function formatMonthLabel(date: Date): string {
  return format(date, "yyyy年M月", { locale: ja });
}

export function isToday(key: string): boolean {
  return key === todayKey();
}
