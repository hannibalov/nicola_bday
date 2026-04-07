/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import PartyProtocolScreen from "./PartyProtocolScreen";
import { KEYS } from "@/lib/clientStorage";

describe("PartyProtocolScreen", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists completion and calls onCompleted when continue is tapped", () => {
    const onCompleted = jest.fn();
    render(
      <PartyProtocolScreen
        phase="pre_check_in"
        onCompleted={onCompleted}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /let's party/i }));
    expect(localStorage.getItem(KEYS.partyProtocolComplete)).toBe("1");
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it("continue is always enabled (no date lock)", () => {
    jest.useFakeTimers({ now: new Date("2020-01-01T12:00:00Z").getTime() });
    const onCompleted = jest.fn();
    render(
      <PartyProtocolScreen
        phase="pre_check_in"
        onCompleted={onCompleted}
      />
    );
    const btn = screen.getByTestId("party-protocol-continue");
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onCompleted).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("renders protocol headline, venue section, and maps link", () => {
    render(
      <PartyProtocolScreen phase="pre_check_in" onCompleted={jest.fn()} />
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /welcome to nicola/i
    );
    const protocolTitle = screen.getByRole("heading", {
      level: 2,
      name: /party[\s\n]*protocol/i,
    });
    expect(protocolTitle).toBeInTheDocument();
    expect(screen.getByText(/date & place/i)).toBeInTheDocument();
    expect(screen.getByTestId("party-maps-link")).toHaveAttribute(
      "href",
      expect.stringContaining("maps.app.goo.gl")
    );
    expect(
      screen.getByRole("heading", { level: 2, name: /venue[\s\n]*&[\s\n]*logistics/i })
    ).toBeInTheDocument();
  });

  it("shows checked-in label in post_check_in phase", () => {
    render(
      <PartyProtocolScreen phase="post_check_in" onCompleted={jest.fn()} />
    );
    expect(screen.getByText(/quick recap below/i)).toBeInTheDocument();
  });
});
