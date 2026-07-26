import type { AiAdviceContext } from "../aiAdvice";
import { AiAdviceChatPanel } from "./AiAdviceChatPanel";

/**
 * 後悔防止トリガーカード内の「🤖 AIに相談する」壁打ちチャット。
 * 見た目・挙動そのものは AiAdviceChatPanel（TodayStrategyAiChat と共有）に委譲し、
 * ここはCSSクラス名の名前空間（forecast-decision-ai-*、既存のまま）と文言だけを固定する薄いラッパー。
 * 会話は永続化しない設計（CLAUDE.md「AI advice」節、AiAdviceChatPanel側で担保）。
 */
export function ForecastDecisionAiChat({ context }: { context: AiAdviceContext }) {
  return (
    <AiAdviceChatPanel
      context={context}
      classPrefix="forecast-decision-ai"
      toggleLabel="🤖 AIに相談する"
      backHintText="決めたら、上のボタンからどうぞ。"
    />
  );
}
