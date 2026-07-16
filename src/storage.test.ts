import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearData,
  exportDataToJson,
  initialData,
  loadData,
  parseImportedData,
  saveData,
  uid,
} from "./storage";

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

describe("exportDataToJson / parseImportedData", () => {
  it("round-trip: export してから parse すると同じデータに戻る", () => {
    const data = {
      ...initialData,
      onboarded: true,
      subjects: [{ id: "s1", name: "数学", testDate: "2026-08-01", templateKey: "math" as const }],
      chapters: [
        {
          id: "c1",
          subjectId: "s1",
          name: "二次関数",
          understanding: 0.5,
          targetUnderstanding: 0.8,
          lastStudiedDate: null,
        },
      ],
    };
    const json = exportDataToJson(data);
    expect(parseImportedData(json)).toEqual(data);
  });

  it("欠損フィールドがある場合は initialData で補完される", () => {
    const json = JSON.stringify({ subjects: [], chapters: [], sessions: [], onboarded: true });
    const result = parseImportedData(json);
    expect(result?.onboarded).toBe(true);
    expect(result?.availability).toEqual(initialData.availability);
    expect(result?.vocabRanges).toEqual([]);
  });

  it("templateKey が未設定でも教科名から補完される", () => {
    const json = JSON.stringify({
      subjects: [{ id: "s1", name: "数学", testDate: "2026-08-01" }],
      chapters: [],
      sessions: [],
    });
    const result = parseImportedData(json);
    expect(result?.subjects[0].templateKey).toBe("math");
  });

  it("不正なJSONの場合は null を返す", () => {
    expect(parseImportedData("{not valid json")).toBeNull();
  });

  it("subjects/chapters/sessions が配列でない場合は null を返す", () => {
    expect(parseImportedData(JSON.stringify({ subjects: "not-an-array" }))).toBeNull();
    expect(parseImportedData(JSON.stringify({ subjects: [], chapters: {}, sessions: [] }))).toBeNull();
    expect(parseImportedData(JSON.stringify({ subjects: [], chapters: [], sessions: null }))).toBeNull();
  });

  it("配列の要素がidを持たないオブジェクトの場合は null を返す（壊れたバックアップの事前弾き）", () => {
    const json = JSON.stringify({
      subjects: [{ name: "数学", testDate: "2026-08-01" }], // idが無い
      chapters: [],
      sessions: [],
    });
    expect(parseImportedData(json)).toBeNull();
  });

  it("配列の要素がオブジェクトでない場合は null を返す", () => {
    const json = JSON.stringify({ subjects: ["not-an-object"], chapters: [], sessions: [] });
    expect(parseImportedData(json)).toBeNull();
  });
});
