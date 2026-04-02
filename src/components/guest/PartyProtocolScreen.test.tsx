/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import PartyProtocolScreen from "./PartyProtocolScreen";
import { KEYS } from "@/lib/clientStorage";
import { partyProtocolUnlockEpochMs } from "@/lib/partyProtocolGate";

describe("PartyProtocolScreen", () => {
  jest.setTimeout(30000);
jest.setTimeout(30000); beforeEach(async () => {
    localStorage.clear();
  });

  it("persists completion and calls onCompleted when bypass allows continue", () => {
    jest.useFakeTimers({ now: partyProtocolUnlockEpochMs() - 60_000 });
    const onCompleted = jest.fn();
    render(
      <PartyProtocolScreen
        phase="pre_check_in"
        gateBypass
        onCompleted={onCompleted}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /let's party/i }));
    expect(localStorage.getItem(KEYS.partyProtocolComplete)).toBe("1");
    expect(onCompleted).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("disables continue before unlock date when not bypassed", () => {
    jest.useFakeTimers({ now: partyProtocolUnlockEpochMs() - 60_000 });
    const onCompleted = jest.fn();
    render(
      <PartyProtocolScreen
        phase="pre_check_in"
        gateBypass={false}
        onCompleted={onCompleted}
      />
    );
    const btn = screen.getByTestId("party-protocol-continue");
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onCompleted).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEYS.partyProtocolComplete)).toBeNull();
    jest.useRealTimers();
  });

  it("enables continue at unlock without bypass", () => {
    jest.useFakeTimers({ now: partyProtocolUnlockEpochMs() });
    const onCompleted = jest.fn();
    render(
      <PartyProtocolScreen
        phase="pre_check_in"
        gateBypass={false}
        onCompleted={onCompleted}
      />
    );
    expect(screen.getByTestId("party-protocol-continue")).not.toBeDisabled();
    jest.useRealTimers();
  });

  it("renders protocol headline, venue section, and maps link", () => {
    jest.useFakeTimers({ now: partyProtocolUnlockEpochMs() });
    render(
      <PartyProtocolScreen
        phase="pre_check_in"
        gateBypass
        onCompleted={jest.fn()}
      />
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
    jest.useRealTimers();
  });

  it("shows checked-in label in post_check_in phase", () => {
    jest.useFakeTimers({ now: partyProtocolUnlockEpochMs() });
    render(
      <PartyProtocolScreen
        phase="post_check_in"
        gateBypass
        onCompleted={jest.fn()}
      />
    );
    expect(screen.getByText(/quick recap below/i)).toBeInTheDocument();
    jest.useRealTimers();
  });
});
