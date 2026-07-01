import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WeeklyScheduleEditor } from "./WeeklyScheduleEditor";
import type { TimeSlot } from "../types";

function Wrapper({ showInitialSlots }: { showInitialSlots?: boolean }) {
  const [value, setValue] = useState<Partial<Record<number, TimeSlot[]>>>({});
  return (
    <WeeklyScheduleEditor
      value={value}
      onChange={setValue}
      showInitialSlots={showInitialSlots}
    />
  );
}

afterEach(() => {
  cleanup();
});

describe("WeeklyScheduleEditor", () => {
  it("「＋ 時間帯を追加」を押すと時間帯が追加され time input が表示される", () => {
    render(<Wrapper />);

    const addButtons = screen.getAllByText("＋ 時間帯を追加");
    fireEvent.click(addButtons[0]);

    const timeInputs = document.querySelectorAll('input[type="time"]');
    expect(timeInputs.length).toBeGreaterThan(0);
  });

  it("開始時刻が終了時刻より後だとインラインエラーが表示される", () => {
    render(<Wrapper />);

    const addButtons = screen.getAllByText("＋ 時間帯を追加");
    fireEvent.click(addButtons[0]);

    const timeInputs = document.querySelectorAll('input[type="time"]');
    const [startInput, endInput] = Array.from(timeInputs) as HTMLInputElement[];

    fireEvent.change(startInput, { target: { value: "19:00" } });
    fireEvent.change(endInput, { target: { value: "18:00" } });

    expect(screen.getByText("終了は開始より後にしてください")).toBeDefined();
  });

  it("showInitialSlots=true のときは未入力でも注意書きが表示されない", () => {
    render(<Wrapper showInitialSlots />);

    expect(
      screen.queryByText("毎日の勉強できる時間はまだ入力されていません。"),
    ).toBeNull();
  });

  it("showInitialSlots を渡さない場合、未入力なら注意書きが表示される", () => {
    render(<Wrapper />);

    expect(
      screen.getByText("毎日の勉強できる時間はまだ入力されていません。"),
    ).toBeDefined();
  });
});
