import { describe, expect, it } from "vitest";
import { calcSleepDurationHours, formatDurationHours, shiftDateKey } from "./date";

describe("calcSleepDurationHours", () => {
  it("同日内の睡眠時間を計算できる", () => {
    expect(calcSleepDurationHours("13:00", "14:30")).toBe(1.5);
  });

  it("日付を跨ぐ睡眠時間を計算できる", () => {
    expect(calcSleepDurationHours("23:30", "07:00")).toBe(7.5);
  });

  it("値が欠けている場合は undefined を返す", () => {
    expect(calcSleepDurationHours(undefined, "07:00")).toBeUndefined();
    expect(calcSleepDurationHours("23:00", undefined)).toBeUndefined();
  });
});

describe("formatDurationHours", () => {
  it("分単位を含めて表示できる", () => {
    expect(formatDurationHours(7.5)).toBe("7時間30分");
    expect(formatDurationHours(8)).toBe("8時間");
  });
});

describe("shiftDateKey", () => {
  it("日付を前後にずらせる", () => {
    expect(shiftDateKey("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDateKey("2026-01-31", 1)).toBe("2026-02-01");
  });
});
