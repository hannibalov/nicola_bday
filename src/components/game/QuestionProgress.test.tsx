/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import QuestionProgress from "./QuestionProgress";

describe("QuestionProgress", () => {
  it("shows current and total (inline)", () => {
    render(
      <QuestionProgress current={3} total={10} label="Question" />
    );
    expect(screen.getByTestId("question-progress")).toHaveTextContent(
      "Question 3 / 10"
    );
  });

  it("bar variant includes label in status region", () => {
    render(
      <QuestionProgress
        current={2}
        total={10}
        label="Question"
        variant="bar"
      />
    );
    const el = screen.getByTestId("question-progress");
    expect(el).toHaveAttribute("role", "status");
    expect(el).toHaveTextContent("Question 2 / 10");
  });
});
