import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AchievementLevelPicker } from "./AchievementLevelPicker";
import type { UnderstandingLevel } from "../data/studyPolicy";

const levels: UnderstandingLevel[] = [
  { level: 1, achieved: "まだ手つかず", next: "教科書の公式・例題を理解する" },
  { level: 2, achieved: "公式・例題を理解した", next: "教科書の基本練習問題を解く" },
  { level: 3, achieved: "基本練習問題が完璧に解ける", next: "ワークの基本問題を解く" },
  { level: 4, achieved: "ワークの基本問題が解ける", next: "発展問題に挑戦する" },
  { level: 5, achieved: "発展問題が解ける", next: "維持・応用" },
];

afterEach(() => {
  cleanup();
});

describe("AchievementLevelPicker", () => {
  it("5段階のラジオボタンが表示され、achieved文言が出る", () => {
    render(<AchievementLevelPicker value={3} onChange={() => {}} levels={levels} />);

    const options = screen.getAllByRole("radio");
    expect(options).toHaveLength(5);
    expect(screen.getByText("基本練習問題が完璧に解ける")).toBeDefined();
  });

  it("現在の value に一致する段階が aria-checked=true になる", () => {
    render(<AchievementLevelPicker value={2} onChange={() => {}} levels={levels} />);

    const options = screen.getAllByRole("radio");
    expect(options[1].getAttribute("aria-checked")).toBe("true");
    expect(options[0].getAttribute("aria-checked")).toBe("false");
  });

  it("段階を選ぶと onChange が選んだ段階番号で発火する", () => {
    let changedTo: number | null = null;
    render(<AchievementLevelPicker value={3} onChange={(n) => (changedTo = n)} levels={levels} />);

    fireEvent.click(screen.getByText("発展問題が解ける"));

    expect(changedTo).toBe(5);
  });
});
