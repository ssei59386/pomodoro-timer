import type { AiAdviceContext } from "../aiAdvice";
import { AiAdviceChatPanel } from "./AiAdviceChatPanel";

/**
 * ダッシュボードの「今日の作戦」相談（mode: "strategy"）。複数教科・複数章の見通し件数の
 * 要約だけをAIに渡し、どの章を切るべきかをAIに断定させず、生徒自身の状況判断を引き出す
 * 問いかけに徹させる（worker/src/anthropic.ts のシステムプロンプトで縛っている）。
 * 見た目・挙動そのものは AiAdviceChatPanel（ForecastDecisionAiChat と共有）に委譲する薄いラッパー。
 */
export function TodayStrategyAiChat({
  shortfallCount,
  onTrackCount,
  topPriorityLabel,
}: {
  shortfallCount: number;
  onTrackCount: number;
  topPriorityLabel: string | null;
}) {
  const context: AiAdviceContext = {
    mode: "strategy",
    shortfallCount,
    onTrackCount,
    topPriorityLabel,
  };

  const summaryLine =
    shortfallCount > 0
      ? topPriorityLabel
        ? `今、間に合わなそうな項目が${shortfallCount}件あります（一番気になるのは${topPriorityLabel}）。今日どう動くか、AIと一緒に整理してみましょう。`
        : `今、間に合わなそうな項目が${shortfallCount}件あります。今日どう動くか、AIと一緒に整理してみましょう。`
      : "今のところ順調です。今日の作戦を相談したいときはどうぞ。";

  return (
    <AiAdviceChatPanel
      context={context}
      classPrefix="today-strategy-ai"
      toggleLabel="🧭 今日の作戦をAIに相談する"
      toggleClassName="secondary"
      summaryLine={summaryLine}
      expectationHintText="AIが答えを決めるのではなく、一緒に整理するための質問をしてくれます。"
    />
  );
}
