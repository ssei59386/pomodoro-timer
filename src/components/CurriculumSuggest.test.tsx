import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { CurriculumSuggest } from "./CurriculumSuggest";

afterEach(() => {
  cleanup();
});

describe("CurriculumSuggest", () => {
  it("queryが空のとき何も表示されない", () => {
    const { container } = render(
      <CurriculumSuggest query="" subject="数学" onSelect={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("queryが1文字のとき何も表示されない", () => {
    const { container } = render(
      <CurriculumSuggest query="正" subject="数学" onSelect={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("一致する候補があるとき候補リストが表示される", () => {
    render(<CurriculumSuggest query="正負の数" subject="数学" onSelect={vi.fn()} />);
    expect(screen.getByRole("listbox")).toBeDefined();
    expect(screen.getByText("正負の数の意味・数直線・絶対値")).toBeDefined();
  });

  it("該当候補が無いときは何も表示されない", () => {
    const { container } = render(
      <CurriculumSuggest query="存在しない架空の単元名XYZ" subject="数学" onSelect={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("候補をクリックするとonSelectが正しい引数で呼ばれる", () => {
    const onSelect = vi.fn();
    render(<CurriculumSuggest query="正負の数" subject="数学" onSelect={onSelect} />);

    fireEvent.mouseDown(screen.getByText("正負の数の意味・数直線・絶対値"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        subtopicName: "正負の数の意味・数直線・絶対値",
        subject: "数学",
        difficultyLevel: 1,
      }),
    );
  });

  it("subjectフィルタが効く（理科の単元名で数学subjectを指定すると出ない）", () => {
    const { container } = render(
      <CurriculumSuggest query="身近な植物の観察" subject="数学" onSelect={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("subjectを理科に指定すると理科の候補が表示される", () => {
    render(<CurriculumSuggest query="身近な植物の観察" subject="理科" onSelect={vi.fn()} />);
    expect(screen.getByText("身近な植物の観察")).toBeDefined();
  });
});
