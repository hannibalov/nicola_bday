import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import GuestEntryFlow from "./GuestEntryFlow";
import { KEYS } from "@/lib/clientStorage";

const mockPrefetch = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ prefetch: mockPrefetch }),
}));

describe("GuestEntryFlow", () => {
  beforeEach(() => {
    mockPrefetch.mockClear();
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

  it("does not prefetch /play while party protocol screen is shown", () => {
    render(<GuestEntryFlow />);
    expect(mockPrefetch).not.toHaveBeenCalled();
  });

  it("prefetches /play after completing party protocol", async () => {
    render(<GuestEntryFlow />);
    fireEvent.click(screen.getByRole("button", { name: /let's party/i }));
    await waitFor(() => {
      expect(mockPrefetch).toHaveBeenCalledWith("/play");
    });
  });
});
