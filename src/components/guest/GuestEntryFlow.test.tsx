import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import GuestEntryFlow from "./GuestEntryFlow";
import { KEYS } from "@/lib/clientStorage";
import { partyProtocolUnlockEpochMs } from "@/lib/partyProtocolGate";

const mockPrefetch = jest.fn();
const mockSearchParams = jest.fn(() => new URLSearchParams());

jest.mock("next/navigation", () => ({
  useRouter: () => ({ prefetch: mockPrefetch }),
  useSearchParams: () => mockSearchParams(),
}));

describe("GuestEntryFlow", () => {
  jest.setTimeout(30000);
jest.setTimeout(30000); beforeEach(async () => {
    mockPrefetch.mockClear();
    mockSearchParams.mockImplementation(() => new URLSearchParams());
    localStorage.clear();
  });

  it("prefetches /play when nickname check-in is shown", async () => {
    localStorage.setItem(KEYS.partyProtocolComplete, "1");
    render(<GuestEntryFlow />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: /guest/i })
      ).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(mockPrefetch).toHaveBeenCalledWith("/play");
    });
  });

  it("does not prefetch /play while party protocol gate is shown", () => {
    jest.useFakeTimers({ now: partyProtocolUnlockEpochMs() - 60_000 });
    render(<GuestEntryFlow />);
    expect(mockPrefetch).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("prefetches /play after completing party protocol with bypass", async () => {
    mockSearchParams.mockImplementation(
      () => new URLSearchParams("protocolTest=1")
    );
    jest.useFakeTimers({ now: partyProtocolUnlockEpochMs() - 60_000 });
    render(<GuestEntryFlow />);
    fireEvent.click(screen.getByRole("button", { name: /let's party/i }));
    await waitFor(() => {
      expect(mockPrefetch).toHaveBeenCalledWith("/play?protocolTest=1");
    });
    jest.useRealTimers();
  });
});
