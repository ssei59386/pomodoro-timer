import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ForecastDecisionAiChat } from "./ForecastDecisionAiChat";
import type { AiAdviceContext, AiAdviceResult } from "../aiAdvice";

const { requestAiAdviceMock } = vi.hoisted(() => ({
  requestAiAdviceMock: vi.fn<(...args: unknown[]) => Promise<AiAdviceResult>>(),
}));

vi.mock("../aiAdvice", async () => {
  const actual = await vi.importActual<typeof import("../aiAdvice")>("../aiAdvice");
  return {
    ...actual,
    requestAiAdvice: requestAiAdviceMock,
  };
});

const context: AiAdviceContext = {
  mode: "decision",
  subjectName: "数学",
  chapterName: "二次関数",
  subtopicName: null,
  daysLeftUntilTest: 5,
};

beforeEach(() => {
  localStorage.clear();
  requestAiAdviceMock.mockReset();
});

afterEach(() => {
  cleanup();
});

async function expandPanel() {
  fireEvent.click(screen.getByText("🤖 AIに相談する"));
}

async function sendMessage(message: string) {
  const input = screen.getByLabelText("AIへの相談メッセージ") as HTMLInputElement;
  fireEvent.change(input, { target: { value: message } });
  fireEvent.click(screen.getByText("送信"));
}

describe("ForecastDecisionAiChat", () => {
  it("折りたたみ時はトグルのみ表示され、クリックで展開する", () => {
    render(<ForecastDecisionAiChat context={context} />);

    expect(screen.getByText("🤖 AIに相談する")).toBeDefined();
    expect(screen.queryByLabelText("AIへの相談メッセージ")).toBeNull();

    fireEvent.click(screen.getByText("🤖 AIに相談する"));

    expect(screen.getByLabelText("AIへの相談メッセージ")).toBeDefined();
  });

  it("送信中はローディング表示になる", async () => {
    let resolvePromise: (value: AiAdviceResult) => void = () => {};
    requestAiAdviceMock.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );
    render(<ForecastDecisionAiChat context={context} />);
    await expandPanel();

    await sendMessage("不安です");

    expect(screen.getByText("考え中…")).toBeDefined();

    resolvePromise({ ok: true, reply: "大丈夫だよ" });
    await waitFor(() => expect(screen.queryByText("考え中…")).toBeNull());
  });

  it("成功時はユーザーの発言とAIの返信の両方が表示される", async () => {
    requestAiAdviceMock.mockResolvedValue({ ok: true, reply: "焦らなくて大丈夫" });
    render(<ForecastDecisionAiChat context={context} />);
    await expandPanel();

    await sendMessage("間に合うか不安です");

    await waitFor(() => expect(screen.getByText("焦らなくて大丈夫")).toBeDefined());
    expect(screen.getByText("間に合うか不安です")).toBeDefined();
  });

  it("rate_limitedのときは落ち着いたトーンのエラー文言が表示される", async () => {
    requestAiAdviceMock.mockResolvedValue({ ok: false, reason: "rate_limited" });
    render(<ForecastDecisionAiChat context={context} />);
    await expandPanel();

    await sendMessage("質問");

    await waitFor(() =>
      expect(
        screen.getByText("今日はAI相談を使える回数の上限に達したみたい。また明日試してみて。"),
      ).toBeDefined(),
    );
  });

  it("network_errorのときは繋がらなかった旨のエラー文言が表示される", async () => {
    requestAiAdviceMock.mockResolvedValue({ ok: false, reason: "network_error" });
    render(<ForecastDecisionAiChat context={context} />);
    await expandPanel();

    await sendMessage("質問");

    await waitFor(() =>
      expect(
        screen.getByText("うまく繋がらなかったみたい。もう一度試すか、時間をおいてからにしてね。"),
      ).toBeDefined(),
    );
  });

  it("3往復（6ターン）に達すると入力欄が無効化され終了メッセージが表示される", async () => {
    requestAiAdviceMock.mockResolvedValue({ ok: true, reply: "了解" });
    render(<ForecastDecisionAiChat context={context} />);
    await expandPanel();

    for (let i = 0; i < 3; i++) {
      await sendMessage(`質問${i}`);
      await waitFor(() => expect(requestAiAdviceMock).toHaveBeenCalledTimes(i + 1));
    }

    await waitFor(() =>
      expect(
        screen.getByText("このセッションでの相談は一旦ここまでにしましょう。続きはまた今度。"),
      ).toBeDefined(),
    );
    expect(screen.queryByLabelText("AIへの相談メッセージ")).toBeNull();
  });

  it("会話が無い状態では閉じるを1回押すだけで即座に閉じる", async () => {
    render(<ForecastDecisionAiChat context={context} />);
    await expandPanel();

    fireEvent.click(screen.getByText("閉じる"));
    expect(screen.queryByLabelText("AIへの相談メッセージ")).toBeNull();
  });

  it("会話がある状態で閉じるを押すと確認表示になり、もう一度押すとturnsがリセットされて閉じる", async () => {
    requestAiAdviceMock.mockResolvedValue({ ok: true, reply: "大丈夫" });
    render(<ForecastDecisionAiChat context={context} />);
    await expandPanel();
    await sendMessage("質問");
    await waitFor(() => expect(screen.getByText("大丈夫")).toBeDefined());

    fireEvent.click(screen.getByText("閉じる"));
    // 1回目のクリックではまだ閉じず、確認表示に切り替わるだけ
    expect(screen.getByText("大丈夫")).toBeDefined();
    expect(screen.getByText("本当に閉じる？")).toBeDefined();

    fireEvent.click(screen.getByText("本当に閉じる？"));
    expect(screen.queryByText("大丈夫")).toBeNull();
    expect(screen.queryByLabelText("AIへの相談メッセージ")).toBeNull();

    await expandPanel();
    expect(screen.queryByText("大丈夫")).toBeNull();
    expect(screen.queryByText("質問")).toBeNull();
    expect(screen.queryByText("本当に閉じる？")).toBeNull();
  });

  it("2往復目のAI回答後に残り1回の案内が表示され、3往復目の回答後は表示が終了メッセージに置き換わる", async () => {
    requestAiAdviceMock.mockResolvedValue({ ok: true, reply: "了解" });
    render(<ForecastDecisionAiChat context={context} />);
    await expandPanel();

    await sendMessage("質問0");
    await waitFor(() => expect(requestAiAdviceMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("残り1回相談できます。")).toBeNull();

    await sendMessage("質問1");
    await waitFor(() => expect(requestAiAdviceMock).toHaveBeenCalledTimes(2));
    expect(screen.getByText("残り1回相談できます。")).toBeDefined();

    await sendMessage("質問2");
    await waitFor(() => expect(requestAiAdviceMock).toHaveBeenCalledTimes(3));
    expect(screen.queryByText("残り1回相談できます。")).toBeNull();
    expect(
      screen.getByText("このセッションでの相談は一旦ここまでにしましょう。続きはまた今度。"),
    ).toBeDefined();
  });

  it("会話が始まったら、上のボタンに戻る案内が表示される", async () => {
    requestAiAdviceMock.mockResolvedValue({ ok: true, reply: "大丈夫" });
    render(<ForecastDecisionAiChat context={context} />);
    await expandPanel();

    expect(screen.queryByText("決めたら、上のボタンからどうぞ。")).toBeNull();

    await sendMessage("質問");
    await waitFor(() => expect(screen.getByText("決めたら、上のボタンからどうぞ。")).toBeDefined());
  });

  it("パネル展開時に会話が画面遷移で消える旨の注意書きが表示される", async () => {
    render(<ForecastDecisionAiChat context={context} />);
    await expandPanel();

    expect(screen.getByText("この相談はこの画面を離れると消えます。")).toBeDefined();
  });
});
