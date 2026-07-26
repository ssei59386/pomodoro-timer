import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TodayStrategyAiChat } from "./TodayStrategyAiChat";
import type { AiAdviceResult } from "../aiAdvice";

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

beforeEach(() => {
  localStorage.clear();
  requestAiAdviceMock.mockReset();
});

afterEach(() => {
  cleanup();
});

async function expandPanel() {
  fireEvent.click(screen.getByText("🧭 今日の作戦をAIに相談する"));
}

async function sendMessage(message: string) {
  const input = screen.getByLabelText("AIへの相談メッセージ") as HTMLInputElement;
  fireEvent.change(input, { target: { value: message } });
  fireEvent.click(screen.getByText("送信"));
}

describe("TodayStrategyAiChat", () => {
  it("折りたたみ時はトグルのみ表示され、クリックで展開する", () => {
    render(<TodayStrategyAiChat shortfallCount={2} onTrackCount={5} topPriorityLabel="英語" />);

    expect(screen.getByText("🧭 今日の作戦をAIに相談する")).toBeDefined();
    expect(screen.queryByLabelText("AIへの相談メッセージ")).toBeNull();

    fireEvent.click(screen.getByText("🧭 今日の作戦をAIに相談する"));

    expect(screen.getByLabelText("AIへの相談メッセージ")).toBeDefined();
  });

  it("間に合わなそうな項目があるときは件数と最優先ラベルを含む状況サマリが表示される", async () => {
    render(<TodayStrategyAiChat shortfallCount={2} onTrackCount={5} topPriorityLabel="英語" />);
    await expandPanel();

    expect(
      screen.getByText(
        "今、間に合わなそうな項目が2件あります（一番気になるのは英語）。今日どう動くか、AIと一緒に整理してみましょう。",
      ),
    ).toBeDefined();
  });

  it("全項目が順調なときは順調である旨のサマリが表示される", async () => {
    render(<TodayStrategyAiChat shortfallCount={0} onTrackCount={5} topPriorityLabel={null} />);
    await expandPanel();

    expect(screen.getByText("今のところ順調です。今日の作戦を相談したいときはどうぞ。")).toBeDefined();
  });

  it("画面を離れると消える旨の注意書きも状況サマリと並んで表示される", async () => {
    render(<TodayStrategyAiChat shortfallCount={1} onTrackCount={1} topPriorityLabel="数学" />);
    await expandPanel();

    expect(screen.getByText("この相談はこの画面を離れると消えます。")).toBeDefined();
  });

  it("送信するとrequestAiAdviceにmode: 'strategy'のcontextが渡る", async () => {
    requestAiAdviceMock.mockResolvedValue({ ok: true, reply: "了解です" });
    render(<TodayStrategyAiChat shortfallCount={3} onTrackCount={4} topPriorityLabel="理科" />);
    await expandPanel();

    await sendMessage("今日は何からやればいい？");

    await waitFor(() => expect(requestAiAdviceMock).toHaveBeenCalledTimes(1));
    const call = requestAiAdviceMock.mock.calls[0][0] as { context: unknown };
    expect(call.context).toEqual({
      mode: "strategy",
      shortfallCount: 3,
      onTrackCount: 4,
      topPriorityLabel: "理科",
    });
  });

  it("成功時はユーザーの発言とAIの返信の両方が表示される", async () => {
    requestAiAdviceMock.mockResolvedValue({ ok: true, reply: "落ち着いていきましょう" });
    render(<TodayStrategyAiChat shortfallCount={1} onTrackCount={1} topPriorityLabel="英語" />);
    await expandPanel();

    await sendMessage("何を優先すべき？");

    await waitFor(() => expect(screen.getByText("落ち着いていきましょう")).toBeDefined());
    expect(screen.getByText("何を優先すべき？")).toBeDefined();
  });

  it("rate_limitedのときは落ち着いたトーンのエラー文言が表示される", async () => {
    requestAiAdviceMock.mockResolvedValue({ ok: false, reason: "rate_limited" });
    render(<TodayStrategyAiChat shortfallCount={1} onTrackCount={1} topPriorityLabel="英語" />);
    await expandPanel();

    await sendMessage("質問");

    await waitFor(() =>
      expect(
        screen.getByText("今日はAI相談を使える回数の上限に達したみたい。また明日試してみて。"),
      ).toBeDefined(),
    );
  });

  it("会話が無い状態では閉じるを1回押すだけで即座に閉じる", async () => {
    render(<TodayStrategyAiChat shortfallCount={1} onTrackCount={1} topPriorityLabel="英語" />);
    await expandPanel();

    fireEvent.click(screen.getByText("閉じる"));
    expect(screen.queryByLabelText("AIへの相談メッセージ")).toBeNull();
  });

  it("会話がある状態で閉じるを押すと確認表示になり、もう一度押すとturnsがリセットされて閉じる", async () => {
    requestAiAdviceMock.mockResolvedValue({ ok: true, reply: "大丈夫" });
    render(<TodayStrategyAiChat shortfallCount={1} onTrackCount={1} topPriorityLabel="英語" />);
    await expandPanel();
    await sendMessage("質問");
    await waitFor(() => expect(screen.getByText("大丈夫")).toBeDefined());

    fireEvent.click(screen.getByText("閉じる"));
    expect(screen.getByText("大丈夫")).toBeDefined();
    expect(screen.getByText("本当に閉じる？")).toBeDefined();

    fireEvent.click(screen.getByText("本当に閉じる？"));
    expect(screen.queryByText("大丈夫")).toBeNull();
    expect(screen.queryByLabelText("AIへの相談メッセージ")).toBeNull();
  });

  it("3往復（6ターン）に達すると入力欄が無効化され終了メッセージが表示される", async () => {
    requestAiAdviceMock.mockResolvedValue({ ok: true, reply: "了解" });
    render(<TodayStrategyAiChat shortfallCount={1} onTrackCount={1} topPriorityLabel="英語" />);
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

  it("後悔防止トリガー向けの「決めたら、上のボタンからどうぞ」案内は表示されない（文脈が異なるため）", async () => {
    requestAiAdviceMock.mockResolvedValue({ ok: true, reply: "了解" });
    render(<TodayStrategyAiChat shortfallCount={1} onTrackCount={1} topPriorityLabel="英語" />);
    await expandPanel();
    await sendMessage("質問");
    await waitFor(() => expect(screen.getByText("了解")).toBeDefined());

    expect(screen.queryByText("決めたら、上のボタンからどうぞ。")).toBeNull();
  });
});
