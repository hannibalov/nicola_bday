import { render, screen, fireEvent } from "@testing-library/react";
import PrimaryActionButton from "./PrimaryActionButton";

describe("PrimaryActionButton", () => {
  it("renders children and forwards click", () => {
    const onClick = jest.fn();
    render(
      <PrimaryActionButton onClick={onClick}>Tap me</PrimaryActionButton>
    );
    fireEvent.click(screen.getByRole("button", { name: /tap me/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("accepts type submit for forms", () => {
    render(
      <PrimaryActionButton type="submit">Send</PrimaryActionButton>
    );
    expect(screen.getByRole("button", { name: /send/i })).toHaveAttribute(
      "type",
      "submit"
    );
  });

  it("supports gradient variant for protocol-style CTAs", () => {
    const { container } = render(
      <PrimaryActionButton variant="gradient">Go</PrimaryActionButton>
    );
    expect(container.querySelector("button")?.className).toContain(
      "bg-gradient-to-r"
    );
  });
});
