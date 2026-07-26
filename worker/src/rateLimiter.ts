import type { Env } from "./types";

const COUNTER_TTL_SECONDS = 172800; // 2日。日付が変わったキーは自然に不要になるので長めのTTLで掃除だけしておく

/** JST(UTC+9)基準の日付文字列 "YYYY-MM-DD" を返す。KVキーの日次バケツ分けに使う。 */
export function jstDateString(now: Date = new Date()): string {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = jst.getUTCFullYear();
  const month = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type RateLimitScope = "global" | "anon";

/**
 * 指定キーのカウンタを読み取り、上限未満なら+1してtrueを返す（許可）。上限以上ならfalse（拒否）。
 * get→putは非アトミック（同時リクエストで多少のオーバーカウントを許容する）。
 * ここでの目的は「最大被害額（Anthropic APIコスト）に天井を決める」ことであり、
 * 1〜数リクエスト分のズレより先に、上限自体が機能していることの方が重要という設計判断。
 */
async function checkAndIncrement(kv: KVNamespace, key: string, limit: number): Promise<boolean> {
  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) || 0 : 0;
  if (count >= limit) {
    return false;
  }
  await kv.put(key, String(count + 1), { expirationTtl: COUNTER_TTL_SECONDS });
  return true;
}

/**
 * グローバル日次上限→匿名ID別日次上限の順にチェックする。
 * どちらもAnthropic呼び出し「前」にインクリメントする（呼び出し前にコストの天井を決めるため）。
 * 拒否された場合、どのスコープで拒否されたかを返す。
 */
export async function checkRateLimits(
  env: Env,
  anonId: string,
  now: Date = new Date(),
): Promise<{ allowed: true } | { allowed: false; scope: RateLimitScope }> {
  const date = jstDateString(now);
  const globalLimit = parseInt(env.GLOBAL_DAILY_LIMIT, 10);
  const anonLimit = parseInt(env.PER_ANON_DAILY_LIMIT, 10);

  const globalAllowed = await checkAndIncrement(env.RATE_LIMIT_KV, `g:${date}`, globalLimit);
  if (!globalAllowed) {
    return { allowed: false, scope: "global" };
  }

  const anonAllowed = await checkAndIncrement(env.RATE_LIMIT_KV, `a:${anonId}:${date}`, anonLimit);
  if (!anonAllowed) {
    return { allowed: false, scope: "anon" };
  }

  return { allowed: true };
}
