/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import PlayPageContent from "./PlayPageContent";
import { KEYS, KEYS_PT } from "@/lib/clientStorage";

const mockReplace = jest.fn();
const mockSearchParams = jest.fn(() => new URLSearchParams());
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams(),
}));

jest.mock("./PlayView", () => ({
  __esModule: true,
  default: function MockPlayView() {
    return <div data-test-id="play-view">play</div>;
  },
}));

describe("PlayPageContent", () => {
  const origFetch = global.fetch;

  jest.setTimeout(30000);
jest.setTimeout(30000); beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    mockReplace.mockClear();
    mockSearchParams.mockImplementation(() => new URLSearchParams());
    document.cookie = "playerId=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    global.fetch = origFetch;
  });

  afterEach(() => {
    global.fetch = origFetch;
  });

  it("redirects to check-in when there is no playerId", async () => {
    render(<PlayPageContent />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/");
    });
    expect(screen.queryByTestId("play-view")).not.toBeInTheDocument();
  });

  it("registers when protocolTest=1 and nickname are present", async () => {
    mockSearchParams.mockImplementation(
      () => new URLSearchParams("protocolTest=1&nickname=QA"),
    );
    const fetchMock = jest.fn((url: string | URL) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/api/players")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ playerId: "pt-player-1" }),
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch ${u}`));
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<PlayPageContent />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/players",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ nickname: "QA" }),
        }),
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("play-view")).toBeInTheDocument();
    });
    expect(sessionStorage.getItem(KEYS_PT.playerId)).toBe("pt-player-1");
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("renders PlayView when protocolTest matches session profile", async () => {
    mockSearchParams.mockImplementation(
      () => new URLSearchParams("protocolTest=1&nickname=Same"),
    );
    sessionStorage.setItem(KEYS_PT.playerId, "pid-s");
    sessionStorage.setItem(KEYS_PT.nickname, "Same");
    render(<PlayPageContent />);
    await waitFor(() => {
      expect(screen.getByTestId("play-view")).toBeInTheDocument();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("redirects home when protocolTest=1 without nickname and no identity", async () => {
    mockSearchParams.mockImplementation(
      () => new URLSearchParams("protocolTest=1"),
    );
    render(<PlayPageContent />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/?protocolTest=1");
    });
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
