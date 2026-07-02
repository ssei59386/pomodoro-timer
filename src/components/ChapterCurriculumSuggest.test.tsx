import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ChapterCurriculumSuggest } from "./ChapterCurriculumSuggest";

afterEach(() => {
  cleanup();
});

describe("ChapterCurriculumSuggest", () => {
  it("queryが空のとき何も表示されない", () => {
    const { container } = render(<ChapterCurriculumSuggest query="" subject="数学" />);
    expect(container.innerHTML).toBe("");
  });

  it("queryが1文字のとき何も表示されない", () => {
    const { container } = render(<ChapterCurriculumSuggest query="関" subject="数学" />);
    expect(container.innerHTML).toBe("");
  });

  it("一致する候補があるとき候補リストが表示される", () => {
    render(<ChapterCurriculumSuggest query="2次関数" subject="数学" />);
    expect(screen.getByRole("listbox")).toBeDefined();
    expect(screen.getByText("2次関数")).toBeDefined();
  });

  it("該当候補が無いときは何も表示されない", () => {
    const { container } = render(
      <ChapterCurriculumSuggest query="存在しない架空の章名XYZ" subject="数学" />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("候補をクリックするとドロップダウンが閉じる（フィールドを書き換える副作用は無い）", () => {
    render(<ChapterCurriculumSuggest query="2次関数" subject="数学" />);
    expect(screen.getByRole("listbox")).toBeDefined();

    fireEvent.mouseDown(screen.getByText("2次関数"));

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("subjectフィルタが効く（理科の章名で数学subjectを指定すると出ない）", () => {
    const { container } = render(
      <ChapterCurriculumSuggest query="植物の生活と種類" subject="数学" />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("subjectを理科に指定すると理科の候補が表示される", () => {
    render(<ChapterCurriculumSuggest query="植物の生活と種類" subject="理科" />);
    expect(screen.getByRole("listbox")).toBeDefined();
  });
});
