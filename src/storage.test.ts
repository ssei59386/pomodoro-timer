import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearData, initialData, loadData, saveData, uid } from "./storage";

const STORAGE_KEY = "study-planner-data-v1";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadData", () => {
  it("localStorage が空のときは initialData と同じ内容を返す", () => {
    expect(loadData()).toEqual(initialData);
  });

  it("部分的なデータしか保存されていない場合、欠損フィールドを initialData で補完する", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ onboarded: true }));
    const data = loadData();
    expect(data.onboarded).toBe(true);
    expect(data.subjects).toEqual([]);
    expect(data.chapters).toEqual([]);
    expect(data.sessions).toEqual([]);
    expect(data.availability).toEqual(initialData.availability);
  });

  it("壊れた JSON が保存されている場合は例外を投げず initialData を返す", () => {
    localStorage.setItem(STORAGE_KEY, "{not valid json");
    expect(() => loadData()).not.toThrow();
    expect(loadData()).toEqual(initialData);
  });
});

describe("saveData", () => {
  it("通常時は localStorage に書き込まれ true を返す", () => {
    const data = { ...initialData, onboarded: true };
    expect(saveData(data)).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "")).toEqual(data);
  });

  it("localStorage.setItem が例外を投げる場合は例外を漏らさず false を返す", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    expect(() => saveData(initialData)).not.toThrow();
    expect(saveData(initialData)).toBe(false);
    spy.mockRestore();
  });
});

describe("clearData", () => {
  it("呼び出し後に localStorage.getItem が null を返す", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
    clearData();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("uid", () => {
  it("複数回呼び出した結果が重複しない", () => {
    const ids = new Set(Array.from({ length: 20 }, () => uid()));
    expect(ids.size).toBe(20);
  });
});
