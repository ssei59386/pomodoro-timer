import { useState } from "react";
import { requestAiAdvice, MAX_HISTORY_TURNS, type AiAdviceContext, type AiAdviceTurn } from "../aiAdvice";

type AiAdviceErrorReason = "rate_limited" | "network_error" | "server_error" | "invalid_response";

/**
 * 後悔防止トリガー（ForecastDecisionAiChat）とダッシュボードの「今日の作戦」相談
 * （TodayStrategyAiChat）が共有する、AI壁打ちチャットの見た目・挙動そのもの。
 * 会話は useState のみで保持し、AppData/localStorage には一切書き込まない
 * （CLAUDE.md「AI advice」節）。閉じる／画面遷移で会話は消える。
 * classPrefix でCSSクラス名の名前空間を分け、既存（forecast-decision-ai-*）の見た目に
 * 一切回帰が無いようにする。
 */
export function AiAdviceChatPanel({
  context,
  classPrefix,
  toggleLabel,
  toggleClassName,
  summaryLine,
  expectationHintText,
  backHintText,
}: {
  context: AiAdviceContext;
  classPrefix: string;
  toggleLabel: string;
  /**
   * トグルボタンに追加する見た目クラス（例："secondary"）。省略時は既存の link-btn 見た目のまま
   * （ForecastDecisionAiChat 側の見た目に回帰を出さないため、呼び出し元が明示的に指定した時だけ足す）。
   */
  toggleClassName?: string;
  /** パネル展開直後、会話が始まる前から常に表示する状況サマリ文（AI呼び出し不要のローカル文言） */
  summaryLine?: string;
  /**
   * 「AIは断定せず問いかけに徹する」という期待値を、対話が始まる前に伝える一言。
   * 後悔防止トリガー版は事前にカード上で二択が提示済みで対話の着地点があるため不要だが、
   * より開かれた相談になる「今日の作戦」版では期待値のズレを防ぐために表示する（ux-reviewer指摘）。
   * 省略時は表示しない。
   */
  expectationHintText?: string;
  /**
   * 会話が始まった後に出す「決めたらどうする」案内。呼び出し元の文脈依存の文言のため
   * 呼び出し元に委ねる（後悔防止トリガーでは「上のボタン」を指すが、他の文脈では意味が変わるため）。
   * 省略時は表示しない。
   */
  backHintText?: string;
}) {
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
      <button
        type="button"
        className={`link-btn ${classPrefix}-toggle${toggleClassName ? ` ${toggleClassName}` : ""}`}
        onClick={() => setExpanded(true)}
      >
        {toggleLabel}
      </button>
    );
  }

  return (
    <div className={`${classPrefix}-panel`}>
      {summaryLine && <p className={`${classPrefix}-summary`}>{summaryLine}</p>}
      {expectationHintText && (
        <p className={`muted small ${classPrefix}-expectation-hint`}>{expectationHintText}</p>
      )}
      <p className={`muted small ${classPrefix}-notice`}>この相談はこの画面を離れると消えます。</p>

      {turns.map((turn, index) => (
        <p
          key={index}
          className={
            turn.role === "user"
              ? `${classPrefix}-turn ${classPrefix}-turn-user`
              : `${classPrefix}-turn ${classPrefix}-turn-assistant`
          }
        >
          {turn.content}
        </p>
      ))}

      {status === "loading" && <p className="muted small">考え中…</p>}

      {status === "error" && errorReason && (
        <p className={`${classPrefix}-error`}>
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
          <div className={`${classPrefix}-input-row`}>
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

      {turns.length > 0 && backHintText && (
        <p className={`muted small ${classPrefix}-back-hint`}>{backHintText}</p>
      )}

      <button type="button" className="link-btn" onClick={handleCloseClick}>
        {confirmingClose ? "本当に閉じる？" : "閉じる"}
      </button>
    </div>
  );
}
