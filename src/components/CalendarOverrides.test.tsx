import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CalendarOverrides } from "./CalendarOverrides";
import type { AvailabilitySettings } from "../types";

// カレンダーは実行時の「今月」を基準に描画されるため、テストでは日付そのものではなく
// 「最初に見える有効な日付セル」をクエリして操作する（DateOverridesList.test.tsx と同じ発想で
// 実装の内部日付計算に依存しないテストにする）。
function Wrapper({ initial }: { initial?: AvailabilitySettings }) {
  const [availability, setAvailability] = useState<AvailabilitySettings>(
    initial ?? { weeklySchedule: {}, dateOverrides: {} },
  );
  return (
    <CalendarOverrides
      availability={availability}
      onChange={(dateOverrides) => setAvailability({ ...availability, dateOverrides })}
    />
  );
}

function getDayCells(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll(".calendar-cell:not(.empty)"));
}

afterEach(() => {
  cleanup();
});

describe("CalendarOverrides", () => {
  it("日付セルをクリックすると、その日の時間帯編集UIが開く", () => {
    render(<Wrapper />);

    expect(document.querySelector(".calendar-day-editor")).toBeNull();

    const [firstCell] = getDayCells();
    fireEvent.click(firstCell);

    expect(document.querySelector(".calendar-day-editor")).not.toBeNull();
  });

  it("時間帯を追加すると onChange 経由で dateOverrides に反映される", () => {
    render(<Wrapper />);

    const [firstCell] = getDayCells();
    fireEvent.click(firstCell);

    fireEvent.click(screen.getByText("＋ 時間帯を追加"));

    // 1つの時間帯行につき開始・終了の2つの time input を持つ
    const timeInputs = document.querySelectorAll('input[type="time"]');
    expect(timeInputs).toHaveLength(2);
  });

  it("時間帯を削除すると該当の時間帯だけ消える", () => {
    render(<Wrapper />);

    const [firstCell] = getDayCells();
    fireEvent.click(firstCell);

    fireEvent.click(screen.getByText("＋ 時間帯を追加"));
    fireEvent.click(screen.getByText("＋ 時間帯を追加"));
    expect(document.querySelectorAll('input[type="time"]')).toHaveLength(4);

    fireEvent.click(screen.getAllByLabelText("この時間帯を削除")[0]);

    expect(document.querySelectorAll('input[type="time"]')).toHaveLength(2);
  });

  it("既にoverrideが設定されている日のセルは overridden クラスが付く", () => {
    render(<Wrapper />);

    const [firstCell] = getDayCells();
    expect(firstCell.className).not.toMatch(/overridden/);

    fireEvent.click(firstCell);
    // クリックしただけで曜日の既定設定が複製され dateOverrides にエントリが作られる
    expect(firstCell.className).toMatch(/overridden/);
  });

  it("曜日の設定に戻すボタンで override が削除され編集UIが閉じる", () => {
    render(<Wrapper />);

    const [firstCell] = getDayCells();
    fireEvent.click(firstCell);
    expect(firstCell.className).toMatch(/overridden/);

    fireEvent.click(screen.getByText("曜日の設定に戻す"));

    expect(document.querySelector(".calendar-day-editor")).toBeNull();
    expect(firstCell.className).not.toMatch(/overridden/);
  });

  it("終了が開始より前だとインラインエラーが表示される", () => {
    render(<Wrapper />);

    const [firstCell] = getDayCells();
    fireEvent.click(firstCell);
    fireEvent.click(screen.getByText("＋ 時間帯を追加"));

    const timeInputs = document.querySelectorAll('input[type="time"]') as NodeListOf<HTMLInputElement>;
    const [startInput, endInput] = Array.from(timeInputs);

    fireEvent.change(startInput, { target: { value: "19:00" } });
    fireEvent.change(endInput, { target: { value: "18:00" } });

    expect(screen.getByText("終了は開始より後にしてください")).toBeDefined();
  });

  it("前の月/次の月ボタンで月ラベルが変わる", () => {
    render(<Wrapper />);

    const label = document.querySelector(".calendar-month-label") as HTMLElement;
    const initialLabel = label.textContent;

    fireEvent.click(screen.getByLabelText("次の月"));
    expect(label.textContent).not.toBe(initialLabel);

    fireEvent.click(screen.getByLabelText("前の月"));
    expect(label.textContent).toBe(initialLabel);
  });
});
