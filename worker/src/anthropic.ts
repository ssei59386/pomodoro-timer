import Anthropic from "@anthropic-ai/sdk";
import type { AdviceRequest, Env } from "./types";

const MAX_TOKENS = 500;

/**
 * 「落ち着いた伴走者」トーン固定。生徒からの入力ではこのシステムプロンプトは変更できない
 * （historyやmessageはuser/assistantロールとしてのみ渡し、systemには一切混ぜない）。
 * 理解度の数値や学習履歴そのものは渡していない前提の会話であることを明記する
 * （教科名・章名・残り日数・生徒の発言のみが渡っている）。
 */
function buildDecisionSystemPrompt(request: AdviceRequest): string {
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

/**
 * ダッシュボードの「今日の作戦」相談用（mode: "strategy"）。生徒は複数教科・複数章の
 * 全体状況を踏まえて「今日何をすべきか」を相談したい。渡す情報は件数の要約ラベルのみで、
 * 理解度の数値や学習履歴の詳細は一切渡していない。
 */
function buildStrategySystemPrompt(request: AdviceRequest): string {
  const shortfallCount = request.shortfallCount ?? 0;
  const onTrackCount = request.onTrackCount ?? 0;
  const priorityLine = request.topPriorityLabel
    ? `その中で今最も気にかけた方がよいのは「${request.topPriorityLabel}」です。`
    : "今のところ特に急ぎの項目はありません。";
  return `あなたは中学生・高校生の定期テスト勉強に伴走するAIアシスタントです。
生徒は複数教科・複数章の状況を踏まえて「今日何をすべきか」を相談したいと思っています。
今、間に合わなそうな見込みの項目が${shortfallCount}件、順調な見込みの項目が${onTrackCount}件あります。${priorityLine}

以下のトーン・方針を厳守してください：
- 「落ち着いた伴走者」のトーンで話す。煽らない、熱血にならない、説教しない。
- どの章を切る・諦めるべきかを断定的に提案しない。最終判断は生徒自身に委ねる。
- あなたにできる一番の助けは、生徒自身の状況判断を引き出す問いかけをすることです
  （例：「今、一番不安に感じている科目はどれ？」「最近の授業で先生が強調していた単元はある？」など）。
- あなたに渡されている情報は上記の件数の要約と生徒の発言のみで、
  詳細な理解度の数値や学習履歴は渡っていない。無いはずの情報を知っているかのように話さない。
- 返信は短く、2〜4文程度にする。`;
}

function buildSystemPrompt(request: AdviceRequest): string {
  return request.mode === "strategy" ? buildStrategySystemPrompt(request) : buildDecisionSystemPrompt(request);
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
