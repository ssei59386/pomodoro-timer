import Anthropic from "@anthropic-ai/sdk";
import type { AdviceRequest, Env } from "./types";

const MAX_TOKENS = 500;

/**
 * 「落ち着いた伴走者」トーン固定。生徒からの入力ではこのシステムプロンプトは変更できない
 * （historyやmessageはuser/assistantロールとしてのみ渡し、systemには一切混ぜない）。
 * 理解度の数値や学習履歴そのものは渡していない前提の会話であることを明記する
 * （教科名・章名・残り日数・生徒の発言のみが渡っている）。
 */
function buildSystemPrompt(request: AdviceRequest): string {
  const subtopicLine = request.subtopicName ? `小項目「${request.subtopicName}」の` : "";
  return `あなたは中学生・高校生の定期テスト勉強に伴走するAIアシスタントです。
生徒は「${request.subjectName}」の「${request.chapterName}」の${subtopicLine}学習について、
このまま理解を深める勉強を続けるか、暗記中心のモードに切り替えるかを迷っています（テストまで残り${request.daysLeftUntilTest}日）。

以下のトーン・方針を厳守してください：
- 「落ち着いた伴走者」のトーンで話す。煽らない、熱血にならない、説教しない。
- 最終判断（続ける／覚えるモードにする）は生徒自身に委ねる。代わりに決めない。
- あなたに渡されている情報は教科名・章名・残り日数・生徒の発言のみで、
  詳細な理解度の数値や学習履歴は渡っていない。無いはずの情報を知っているかのように話さない。
- 返信は短く、2〜4文程度にする。`;
}

export class AnthropicUpstreamError extends Error {}

export async function requestAdviceReply(request: AdviceRequest, env: Env): Promise<string> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  let response;
  try {
    response = await client.messages.create({
      model: env.MODEL_ID,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(request),
      messages: [
        ...request.history.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        { role: "user" as const, content: request.message },
      ],
    });
  } catch (error) {
    throw new AnthropicUpstreamError(error instanceof Error ? error.message : "unknown error");
  }

  const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === "text");
  if (!textBlock || !textBlock.text) {
    throw new AnthropicUpstreamError("no text content in response");
  }

  return textBlock.text;
}
