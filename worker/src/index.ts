import { handlePreflight, resolveCorsHeadersForRequest } from "./cors";
import { checkRateLimits } from "./rateLimiter";
import { AnthropicUpstreamError, requestAdviceReply } from "./anthropic";
import type { AdviceHistoryMessage, AdviceRequest, AdviceResponse, Env } from "./types";

const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY_ENTRIES = 6;

function jsonResponse(body: AdviceResponse, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * クライアントを信用しない：必須フィールドの型・存在チェックに加え、
 * messageは上限文字数超過なら拒否、historyは直近6件までにサーバー側で切り詰める。
 */
function validateAndSanitize(body: unknown): { ok: true; data: AdviceRequest } | { ok: false; message: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "request body must be a JSON object" };
  }
  const candidate = body as Record<string, unknown>;

  if (typeof candidate.anonId !== "string" || candidate.anonId.length === 0) {
    return { ok: false, message: "anonId is required" };
  }
  if (typeof candidate.subjectName !== "string" || candidate.subjectName.length === 0) {
    return { ok: false, message: "subjectName is required" };
  }
  if (typeof candidate.chapterName !== "string" || candidate.chapterName.length === 0) {
    return { ok: false, message: "chapterName is required" };
  }
  if (candidate.subtopicName !== null && typeof candidate.subtopicName !== "string") {
    return { ok: false, message: "subtopicName must be a string or null" };
  }
  if (typeof candidate.daysLeftUntilTest !== "number" || !Number.isFinite(candidate.daysLeftUntilTest)) {
    return { ok: false, message: "daysLeftUntilTest must be a finite number" };
  }
  if (typeof candidate.message !== "string" || candidate.message.length === 0) {
    return { ok: false, message: "message is required" };
  }
  if (candidate.message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, message: `message must be at most ${MAX_MESSAGE_LENGTH} characters` };
  }
  if (!Array.isArray(candidate.history)) {
    return { ok: false, message: "history must be an array" };
  }
  const sanitizedHistory: AdviceHistoryMessage[] = [];
  for (const entry of candidate.history) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      (entry as Record<string, unknown>).role === undefined ||
      ((entry as Record<string, unknown>).role !== "user" && (entry as Record<string, unknown>).role !== "assistant") ||
      typeof (entry as Record<string, unknown>).content !== "string"
    ) {
      return { ok: false, message: "history entries must be { role: 'user'|'assistant', content: string }" };
    }
    sanitizedHistory.push({
      role: (entry as { role: "user" | "assistant" }).role,
      content: (entry as { content: string }).content,
    });
  }
  // 直近6件までに切り詰める（クライアントが多く送ってきても信用しない）
  const trimmedHistory = sanitizedHistory.slice(-MAX_HISTORY_ENTRIES);

  return {
    ok: true,
    data: {
      anonId: candidate.anonId,
      subjectName: candidate.subjectName,
      chapterName: candidate.chapterName,
      subtopicName: candidate.subtopicName as string | null,
      daysLeftUntilTest: candidate.daysLeftUntilTest,
      message: candidate.message,
      history: trimmedHistory,
    },
  };
}

async function handleAdvice(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_request", message: "body must be valid JSON" }, 400, corsHeaders);
  }

  const validated = validateAndSanitize(body);
  if (!validated.ok) {
    return jsonResponse({ error: "invalid_request", message: validated.message }, 400, corsHeaders);
  }

  const rateLimitResult = await checkRateLimits(env, validated.data.anonId);
  if (!rateLimitResult.allowed) {
    return jsonResponse({ error: "rate_limited", scope: rateLimitResult.scope }, 429, corsHeaders);
  }

  try {
    const reply = await requestAdviceReply(validated.data, env);
    return jsonResponse({ reply }, 200, corsHeaders);
  } catch (error) {
    if (error instanceof AnthropicUpstreamError) {
      console.error("AnthropicUpstreamError:", error.message);
      return jsonResponse({ error: "upstream_error" }, 502, corsHeaders);
    }
    throw error;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return handlePreflight(request, env);
    }

    if (url.pathname === "/advice" && request.method === "POST") {
      const corsHeaders = resolveCorsHeadersForRequest(request, env);
      if (!corsHeaders) {
        return new Response(null, { status: 403 });
      }
      try {
        return await handleAdvice(request, env, corsHeaders);
      } catch {
        return jsonResponse({ error: "upstream_error" }, 502, corsHeaders);
      }
    }

    return new Response("not found", { status: 404 });
  },
};
