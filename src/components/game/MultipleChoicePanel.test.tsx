/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import MultipleChoicePanel from "./MultipleChoicePanel";

describe("MultipleChoicePanel", () => {
  it("calls onSelect when an option is chosen", () => {
    const onSelect = jest.fn();
    render(
      <MultipleChoicePanel
        options={["One", "Two", "Three", "Four"]}
        selectedIndex={null}
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Two/i }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("does not call onSelect when disabled", () => {
    const onSelect = jest.fn();
    render(
      <MultipleChoicePanel
        options={["A", "B", "C", "D"]}
        selectedIndex={null}
        onSelect={onSelect}
        disabled
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^A\./i }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows prompt and topic when provided", () => {
    render(
      <MultipleChoicePanel
        prompt="What color?"
        topicLabel="UK"
        options={["Red", "Blue", "Green", "Yellow"]}
        selectedIndex={null}
        onSelect={() => {}}
      />
    );
    expect(screen.getByText("What color?")).toBeInTheDocument();
    expect(screen.getByText("UK")).toBeInTheDocument();
  });
});
