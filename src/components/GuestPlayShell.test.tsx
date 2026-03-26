/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import GuestPlayShell from "./GuestPlayShell";

describe("GuestPlayShell", () => {
  it("renders children and status in the header", () => {
    render(
      <GuestPlayShell statusLabel="Test status">
        <p>Inner content</p>
      </GuestPlayShell>
    );
    expect(screen.getByText("Inner content")).toBeInTheDocument();
    expect(screen.getByText("Test status")).toBeInTheDocument();
    expect(screen.getByText(/vice & vices/i)).toBeInTheDocument();
  });
});
