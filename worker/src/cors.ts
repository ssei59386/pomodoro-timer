import type { Env } from "./types";

/**
 * ワイルドカードは使わない。本番オリジンは完全一致のみ許可。
 * 開発用は `http://localhost:<任意のポート番号>` を許可する（Viteは5173番が使用中だと
 * 5174番以降に自動でずれるため、特定のポート番号に固定すると開発体験を損なう。localhost
 * 限定なので、他人の端末から到達できるオリジンではなくリスクはない）。
 */
const LOCALHOST_DEV_ORIGIN_PATTERN = /^http:\/\/localhost:\d+$/;

function resolveAllowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  if (origin === env.ALLOWED_ORIGIN) return origin;
  if (LOCALHOST_DEV_ORIGIN_PATTERN.test(origin)) return origin;
  return null;
}

export function buildCorsHeaders(allowedOrigin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/** OPTIONSプリフライト用。許可Originなら204+CORSヘッダ、そうでなければヘッダ無しの403。 */
export function handlePreflight(request: Request, env: Env): Response {
  const allowedOrigin = resolveAllowedOrigin(request, env);
  if (!allowedOrigin) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers: buildCorsHeaders(allowedOrigin) });
}

/** 実POST用。許可Originなら対応するCORSヘッダを返し、不一致ならnull（呼び出し側で403にする）。 */
export function resolveCorsHeadersForRequest(request: Request, env: Env): Record<string, string> | null {
  const allowedOrigin = resolveAllowedOrigin(request, env);
  if (!allowedOrigin) return null;
  return buildCorsHeaders(allowedOrigin);
}
