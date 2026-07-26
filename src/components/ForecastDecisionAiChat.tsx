import { useState } from "react";
import {
  requestAiAdvice,
  MAX_HISTORY_TURNS,
  type AiAdviceContext,
  type AiAdviceTurn,
} from "../aiAdvice";

type AiAdviceErrorReason = "rate_limited" | "network_error" | "server_error" | "invalid_response";

/**
 * 後悔防止トリガーカード内の「🤖 AIに相談する」壁打ちチャット。
 * 意図的にエフェメラル：state は useState のみで保持し、AppData/localStorage には
 * 一切書き込まない（CLAUDE.md「AI advice」節）。閉じる／画面遷移で会話は消える。
 */
export function ForecastDecisionAiChat({ context }: { context: AiAdviceContext }) {
  const [expanded, setExpanded] = useState(false);
  const [turns, setTurns] = useState<AiAdviceTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorReason, setErrorReason] = useState<AiAdviceErrorReason | null>(null);
  // 会話がある状態での「閉じる」誤タップで全消去しないよう、一度押すと確認表示に切り替える
  // （Settings.tsx の confirmingReset と同じ二段階パターン。ux-reviewer指摘）。
  const [confirmingClose, setConfirmingClose] = useState(false);

  // turns には user/assistant が交互に積まれるため、MAX_HISTORY_TURNS（6件）で
  // ちょうど3往復ぶんの上限になる（aiAdvice.ts が送信時に履歴を切り詰める件数と揃える）。
  const reachedLimit = turns.length >= MAX_HISTORY_TURNS;
  // 上限の1往復前（残り2ターン）から予告を出す。3往復目の回答直後にいきなり打ち切りメッセージへ
  // 差し替わる唐突さを防ぐため（ux-reviewer指摘）。
  const oneRoundLeft = !reachedLimit && turns.length === MAX_HISTORY_TURNS - 2;

  const resetConversation = () => {
    setTurns([]);
    setDraft("");
    setStatus("idle");
    setErrorReason(null);
    setConfirmingClose(false);
  };

  const handleCloseClick = () => {
    if (turns.length > 0 && !confirmingClose) {
      setConfirmingClose(true);
      return;
    }
    setExpanded(false);
    resetConversation();
  };

  const handleSubmit = async () => {
    const trimmed = draft.trim();
    if (!trimmed || status === "loading" || reachedLimit) return;

    setConfirmingClose(false);
    setStatus("loading");
    setErrorReason(null);
    const result = await requestAiAdvice({ context, message: trimmed, history: turns });
    if (result.ok) {
      setTurns((prev) => [...prev, { role: "user", content: trimmed }, { role: "assistant", content: result.reply }]);
      setDraft("");
      setStatus("idle");
    } else {
      setErrorReason(result.reason);
      setStatus("error");
    }
  };

  if (!expanded) {
    return (
      <button type="button" className="link-btn forecast-decision-ai-toggle" onClick={() => setExpanded(true)}>
        🤖 AIに相談する
      </button>
    );
  }

  return (
    <div className="forecast-decision-ai-panel">
      <p className="muted small forecast-decision-ai-notice">
        この相談はこの画面を離れると消えます。
      </p>

      {turns.map((turn, index) => (
        <p
          key={index}
          className={
            turn.role === "user"
              ? "forecast-decision-ai-turn forecast-decision-ai-turn-user"
              : "forecast-decision-ai-turn forecast-decision-ai-turn-assistant"
          }
        >
          {turn.content}
        </p>
      ))}

      {status === "loading" && <p className="muted small">考え中…</p>}

      {status === "error" && errorReason && (
        <p className="forecast-decision-ai-error">
          {errorReason === "rate_limited"
            ? "今日はAI相談を使える回数の上限に達したみたい。また明日試してみて。"
            : "うまく繋がらなかったみたい。もう一度試すか、時間をおいてからにしてね。"}
        </p>
      )}

      {reachedLimit ? (
        <p className="muted small">このセッションでの相談は一旦ここまでにしましょう。続きはまた今度。</p>
      ) : (
        <>
          {oneRoundLeft && <p className="muted small">残り1回相談できます。</p>}
          <div className="forecast-decision-ai-input-row">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              placeholder="相談したいことを書いてみて"
              disabled={status === "loading"}
              aria-label="AIへの相談メッセージ"
            />
            <button
              type="button"
              className="secondary"
              disabled={status === "loading" || draft.trim() === ""}
              onClick={handleSubmit}
            >
              送信
            </button>
          </div>
        </>
      )}

      {turns.length > 0 && (
        <p className="muted small forecast-decision-ai-back-hint">決めたら、上のボタンからどうぞ。</p>
      )}

      <button type="button" className="link-btn" onClick={handleCloseClick}>
        {confirmingClose ? "本当に閉じる？" : "閉じる"}
      </button>
    </div>
  );
}
