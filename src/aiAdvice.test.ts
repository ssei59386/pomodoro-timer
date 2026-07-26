import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getOrCreateAnonId, requestAiAdvice, type AiAdviceContext } from "./aiAdvice";

const STORAGE_KEY = "study-planner-data-v1";
const ANON_ID_KEY = "study-planner-anon-id-v1";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getOrCreateAnonId", () => {
  it("初回呼び出しでIDを生成し、localStorageに保存する", () => {
    const id = getOrCreateAnonId();
    expect(id).toBeTruthy();
    expect(localStorage.getItem(ANON_ID_KEY)).toBe(id);
  });

  it("再度呼び出しても同じIDが返る", () => {
    const first = getOrCreateAnonId();
    const second = getOrCreateAnonId();
    expect(second).toBe(first);
  });

  it("本体データの STORAGE_KEY とは別のキーに保存される", () => {
    getOrCreateAnonId();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(ANON_ID_KEY)).not.toBeNull();
  });
});

const baseContext: AiAdviceContext = {
  mode: "decision",
  subjectName: "数学",
  chapterName: "二次関数",
  subtopicName: null,
  daysLeftUntilTest: 5,
};

describe("requestAiAdvice", () => {
  it("200成功時は { ok: true, reply } を返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ reply: "焦らなくて大丈夫だよ" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAiAdvice({ context: baseContext, message: "不安です", history: [] });

    expect(result).toEqual({ ok: true, reply: "焦らなくて大丈夫だよ" });
  });

  it("送信bodyにcontextのフィールドがフラットな形で（Worker側の期待通りに）載る", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ reply: "ok" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const history = [
      { role: "user" as const, content: "前回の質問" },
      { role: "assistant" as const, content: "前回の返信" },
    ];
    await requestAiAdvice({ context: baseContext, message: "続きの質問", history });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(requestInit.body as string);
    // Worker側（worker/src/index.ts）はcontextでネストせず直接これらのフィールドを読む
    expect(body.mode).toBe("decision");
    expect(body.subjectName).toBe(baseContext.subjectName);
    expect(body.chapterName).toBe(baseContext.chapterName);
    expect(body.subtopicName).toBe(baseContext.subtopicName);
    expect(body.daysLeftUntilTest).toBe(baseContext.daysLeftUntilTest);
    expect(body.context).toBeUndefined();
    expect(body.message).toBe("続きの質問");
    expect(body.history).toEqual(history);
    expect(typeof body.anonId).toBe("string");
  });

  it("mode: 'strategy' のcontextでは、Worker側の期待通りのフラットなフィールドが載る", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ reply: "ok" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const strategyContext: AiAdviceContext = {
      mode: "strategy",
      shortfallCount: 2,
      onTrackCount: 5,
      topPriorityLabel: "英語",
    };
    await requestAiAdvice({ context: strategyContext, message: "今日どうすればいい？", history: [] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(requestInit.body as string);
    expect(body.mode).toBe("strategy");
    expect(body.shortfallCount).toBe(2);
    expect(body.onTrackCount).toBe(5);
    expect(body.topPriorityLabel).toBe("英語");
    // decisionモード固有のフィールドは載らない
    expect(body.subjectName).toBeUndefined();
    expect(body.chapterName).toBeUndefined();
    expect(body.daysLeftUntilTest).toBeUndefined();
    expect(body.message).toBe("今日どうすればいい？");
    expect(typeof body.anonId).toBe("string");
  });

  it("429のときは rate_limited を返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAiAdvice({ context: baseContext, message: "質問", history: [] });

    expect(result).toEqual({ ok: false, reason: "rate_limited" });
  });

  it("5xxのときは server_error を返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAiAdvice({ context: baseContext, message: "質問", history: [] });

    expect(result).toEqual({ ok: false, reason: "server_error" });
  });

  it("fetch自体が例外を投げたときは network_error を返す", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAiAdvice({ context: baseContext, message: "質問", history: [] });

    expect(result).toEqual({ ok: false, reason: "network_error" });
  });

  it("2xxでも reply が欠損している場合は invalid_response を返す", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAiAdvice({ context: baseContext, message: "質問", history: [] });

    expect(result).toEqual({ ok: false, reason: "invalid_response" });
  });
});
