// 後悔防止トリガー限定のAI壁打ち相談機能。fetch呼び出しはこのファイルだけに閉じ込める
// （store.tsx/storage.ts と同じ層。logic.ts の「純粋関数のみ」不変条件には触れない）。
// 会話は永続化しない設計のため、ここには localStorage 書き込みは匿名ID以外一切ない。
// 詳細は CLAUDE.md「AI advice — the one exception to "no backend, no login"」を参照。

const AI_ADVICE_ENDPOINT = "https://study-planner-ai-advice.ssei59386.workers.dev/advice";

// 本体データの STORAGE_KEY（"study-planner-data-v1"、storage.ts）とは別の独立したキー。
// アカウントとは無関係の乱数IDで、Worker側の粗い日次レート制限にのみ使う。
const ANON_ID_KEY = "study-planner-anon-id-v1";

export const MAX_HISTORY_TURNS = 6;

export interface AiAdviceContext {
  subjectName: string;
  chapterName: string;
  subtopicName: string | null;
  daysLeftUntilTest: number;
}

export interface AiAdviceTurn {
  role: "user" | "assistant";
  content: string;
}

export type AiAdviceResult =
  | { ok: true; reply: string }
  | { ok: false; reason: "rate_limited" | "network_error" | "server_error" | "invalid_response" };

/**
 * 匿名IDを取得、無ければ生成して保存する。取得/生成に失敗した場合（localStorage無効化・
 * crypto非対応等）はメモリ内のみのフォールバックIDを返す。レート制限の粗い網に過ぎず、
 * 毎回変わっても致命的ではないため、失敗時にユーザー操作をブロックしない。
 */
export function getOrCreateAnonId(): string {
  try {
    const existing = localStorage.getItem(ANON_ID_KEY);
    if (existing) return existing;
    const generated = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(ANON_ID_KEY, generated);
    return generated;
  } catch {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}

function isValidReplyShape(value: unknown): value is { reply: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { reply?: unknown }).reply === "string"
  );
}

export async function requestAiAdvice(input: {
  context: AiAdviceContext;
  message: string;
  history: AiAdviceTurn[];
}): Promise<AiAdviceResult> {
  const trimmedHistory = input.history.slice(-MAX_HISTORY_TURNS);

  let response: Response;
  try {
    response = await fetch(AI_ADVICE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anonId: getOrCreateAnonId(),
        subjectName: input.context.subjectName,
        chapterName: input.context.chapterName,
        subtopicName: input.context.subtopicName,
        daysLeftUntilTest: input.context.daysLeftUntilTest,
        message: input.message,
        history: trimmedHistory,
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return { ok: false, reason: "network_error" };
  }

  if (response.status === 429) {
    return { ok: false, reason: "rate_limited" };
  }
  if (!response.ok) {
    return { ok: false, reason: "server_error" };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, reason: "invalid_response" };
  }
  if (!isValidReplyShape(body)) {
    return { ok: false, reason: "invalid_response" };
  }
  return { ok: true, reply: body.reply };
}
