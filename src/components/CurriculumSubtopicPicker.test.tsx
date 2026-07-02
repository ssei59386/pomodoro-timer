import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CurriculumSubtopicPicker } from "./CurriculumSubtopicPicker";

// 「正の数・負の数」（中1・数学）は curriculumSearch のデータに実在する章名で、
// 複数の小項目を持つため候補選択のテストに使える。

afterEach(() => {
  cleanup();
});

describe("CurriculumSubtopicPicker", () => {
  it("一致する章が無いとき何もレンダリングされない", () => {
    const onAdd = vi.fn();
    const { container } = render(
      <CurriculumSubtopicPicker
        chapterName="存在しない架空の章名XYZ123"
        subject="数学"
        onAdd={onAdd}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("章名が空のとき何もレンダリングされない", () => {
    const onAdd = vi.fn();
    const { container } = render(
      <CurriculumSubtopicPicker chapterName="" subject="数学" onAdd={onAdd} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("一致する章があるとき「候補から選ぶ」ボタンが表示される", () => {
    const onAdd = vi.fn();
    render(
      <CurriculumSubtopicPicker chapterName="正の数・負の数" subject="数学" onAdd={onAdd} />,
    );
    expect(screen.getByText("候補から選ぶ")).toBeDefined();
  });

  it("ボタンを押すと候補一覧（チェックボックス）が展開される", () => {
    const onAdd = vi.fn();
    render(
      <CurriculumSubtopicPicker chapterName="正の数・負の数" subject="数学" onAdd={onAdd} />,
    );
    expect(document.querySelectorAll('input[type="checkbox"]').length).toBe(0);

    fireEvent.click(screen.getByText("候補から選ぶ"));

    expect(document.querySelectorAll('input[type="checkbox"]').length).toBeGreaterThan(0);
  });

  it("何も選択していない状態では確定ボタンが無効", () => {
    const onAdd = vi.fn();
    render(
      <CurriculumSubtopicPicker chapterName="正の数・負の数" subject="数学" onAdd={onAdd} />,
    );
    fireEvent.click(screen.getByText("候補から選ぶ"));

    const confirmBtn = screen.getByText("選択した小項目を追加") as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
  });

  it("チェックして確定ボタンを押すと、選択した候補だけが正しい引数で onAdd に渡される", () => {
    const onAdd = vi.fn();
    render(
      <CurriculumSubtopicPicker chapterName="正の数・負の数" subject="数学" onAdd={onAdd} />,
    );
    fireEvent.click(screen.getByText("候補から選ぶ"));

    const checkboxes = document.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
    expect(checkboxes.length).toBeGreaterThan(1);
    fireEvent.click(checkboxes[0]);

    const confirmBtn = screen.getByText("選択した小項目を追加") as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(false);
    fireEvent.click(confirmBtn);

    expect(onAdd).toHaveBeenCalledTimes(1);
    const arg = onAdd.mock.calls[0][0];
    expect(arg.length).toBe(1);
    expect(arg[0]).toHaveProperty("name");
    expect(arg[0]).toHaveProperty("difficultyLevel");
  });

  it("確定後、パネルが閉じて選択状態がリセットされる", () => {
    const onAdd = vi.fn();
    render(
      <CurriculumSubtopicPicker chapterName="正の数・負の数" subject="数学" onAdd={onAdd} />,
    );
    fireEvent.click(screen.getByText("候補から選ぶ"));

    const checkboxes = document.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
    fireEvent.click(checkboxes[0]);
    fireEvent.click(screen.getByText("選択した小項目を追加"));

    // パネルが閉じているのでチェックボックスも確定ボタンも存在しない
    expect(document.querySelectorAll('input[type="checkbox"]').length).toBe(0);
    expect(screen.queryByText("選択した小項目を追加")).toBeNull();

    // 再度開くと選択状態はリセットされている（全て未チェック）
    fireEvent.click(screen.getByText("候補から選ぶ"));
    const reopened = document.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
    reopened.forEach((cb) => expect(cb.checked).toBe(false));
  });
});
