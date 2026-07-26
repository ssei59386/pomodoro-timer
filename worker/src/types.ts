export interface AdviceHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AdviceRequest {
  anonId: string;
  subjectName: string;
  chapterName: string;
  subtopicName: string | null;
  daysLeftUntilTest: number;
  message: string;
  history: AdviceHistoryMessage[];
}

export type AdviceResponse =
  | { reply: string }
  | { error: "invalid_request"; message: string }
  | { error: "rate_limited"; scope: "global" | "anon" }
  | { error: "upstream_error" };

export interface Env {
  RATE_LIMIT_KV: KVNamespace;
  ALLOWED_ORIGIN: string;
  GLOBAL_DAILY_LIMIT: string;
  PER_ANON_DAILY_LIMIT: string;
  MODEL_ID: string;
  ANTHROPIC_API_KEY: string;
}
