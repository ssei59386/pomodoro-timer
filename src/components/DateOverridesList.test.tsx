import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DateOverridesList } from "./DateOverridesList";
import type { TimeSlot } from "../types";

function Wrapper({ initial = {} }: { initial?: Record<string, TimeSlot[]> }) {
  const [value, setValue] = useState<Record<string, TimeSlot[]>>(initial);
  return <DateOverridesList value={value} onChange={setValue} />;
}

afterEach(() => {
  cleanup();
});

describe("DateOverridesList", () => {
  it("「＋ 予定を追加」を押すと日付入力と時間帯行が追加される", () => {
    render(<Wrapper />);

    expect(screen.getByText("特に登録された予定はありません。")).toBeDefined();

    fireEvent.click(screen.getByText("＋ 予定を追加"));

    expect(screen.queryByText("特に登録された予定はありません。")).toBeNull();
    expect(document.querySelector('input[type="date"]')).not.toBeNull();
    expect(document.querySelectorAll('input[type="time"]')).toHaveLength(2);
  });

  it("日付を入力すると onChange 経由で value に反映される", () => {
    render(<Wrapper />);
    fireEvent.click(screen.getByText("＋ 予定を追加"));

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2026-08-05" } });

    expect(dateInput.value).toBe("2026-08-05");
  });

  it("「＋ 時間帯を追加」を押すと時間帯入力が増える", () => {
    render(<Wrapper />);
    fireEvent.click(screen.getByText("＋ 予定を追加"));

    fireEvent.click(screen.getByText("＋ 時間帯を追加"));

    expect(document.querySelectorAll('input[type="time"]')).toHaveLength(4);
  });

  it("この予定を削除ボタンでエントリが消える", () => {
    render(<Wrapper />);
    fireEvent.click(screen.getByText("＋ 予定を追加"));
    expect(document.querySelector('input[type="date"]')).not.toBeNull();

    fireEvent.click(screen.getByLabelText("この予定を削除"));

    expect(document.querySelector('input[type="date"]')).toBeNull();
    expect(screen.getByText("特に登録された予定はありません。")).toBeDefined();
  });

  it("この時間帯を削除ボタンで該当の時間帯だけ消える", () => {
    render(<Wrapper />);
    fireEvent.click(screen.getByText("＋ 予定を追加"));
    fireEvent.click(screen.getByText("＋ 時間帯を追加"));
    expect(document.querySelectorAll('input[type="time"]')).toHaveLength(4);

    const removeSlotButtons = screen.getAllByLabelText("この時間帯を削除");
    fireEvent.click(removeSlotButtons[0]);

    expect(document.querySelectorAll('input[type="time"]')).toHaveLength(2);
  });

  it("終了が開始より前だとインラインエラーが表示される", () => {
    render(<Wrapper />);
    fireEvent.click(screen.getByText("＋ 予定を追加"));

    const timeInputs = document.querySelectorAll('input[type="time"]') as NodeListOf<HTMLInputElement>;
    const [startInput, endInput] = Array.from(timeInputs);

    fireEvent.change(startInput, { target: { value: "19:00" } });
    fireEvent.change(endInput, { target: { value: "18:00" } });

    expect(screen.getByText("終了は開始より後にしてください")).toBeDefined();
  });

  it("同じ日付が複数エントリにあると重複警告が表示される", () => {
    render(<Wrapper />);
    fireEvent.click(screen.getByText("＋ 予定を追加"));
    fireEvent.click(screen.getByText("＋ 予定を追加"));

    const dateInputs = document.querySelectorAll('input[type="date"]') as NodeListOf<HTMLInputElement>;
    fireEvent.change(dateInputs[0], { target: { value: "2026-08-05" } });
    fireEvent.change(dateInputs[1], { target: { value: "2026-08-05" } });

    // 重複は双方のエントリに表示される仕様のため getAllByText で確認する
    expect(
      screen.getAllByText("同じ日付が他にも登録されています（あとの内容で上書きされます）"),
    ).toHaveLength(2);
  });

  it("過去の日付を入力すると過去日付の警告が表示される", () => {
    render(<Wrapper />);
    fireEvent.click(screen.getByText("＋ 予定を追加"));

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2000-01-01" } });

    expect(screen.getByText("この日付は過去の日付です")).toBeDefined();
  });

  it("初期値に渡した既存の日付エントリが表示される", () => {
    render(
      <Wrapper
        initial={{ "2026-08-05": [{ start: "16:00", end: "17:00" }] }}
      />,
    );

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput.value).toBe("2026-08-05");
  });
});
