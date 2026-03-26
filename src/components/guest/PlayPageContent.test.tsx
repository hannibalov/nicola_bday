/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import PlayPageContent from "./PlayPageContent";
import { KEYS } from "@/lib/clientStorage";

const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("./PlayView", () => ({
  __esModule: true,
  default: function MockPlayView() {
    return <div data-test-id="play-view">play</div>;
  },
}));

describe("PlayPageContent", () => {
  beforeEach(() => {
    localStorage.clear();
    mockReplace.mockClear();
    document.cookie = "playerId=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("redirects to check-in when there is no playerId", async () => {
    render(<PlayPageContent />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/");
    });
    expect(screen.queryByTestId("play-view")).not.toBeInTheDocument();
  });

  it("renders PlayView after check-in when playerId is in localStorage", async () => {
    localStorage.setItem(KEYS.playerId, "player-ls");
    render(<PlayPageContent />);
    await waitFor(() => {
      expect(screen.getByTestId("play-view")).toBeInTheDocument();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("renders PlayView when playerId exists only in the cookie", async () => {
    document.cookie = "playerId=cookie-only";
    render(<PlayPageContent />);
    await waitFor(() => {
      expect(screen.getByTestId("play-view")).toBeInTheDocument();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
