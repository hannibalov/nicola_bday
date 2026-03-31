/**
 * @jest-environment jsdom
 */
import type { ComponentProps } from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import MusicBingoScreen from "./MusicBingoScreen";

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
import { bingoCardTitlesForPlayer } from "@/lib/bingoCard";
import { BINGO_FULL_CARD_CLAIM_KEY } from "@/lib/bingoLine";
import { KEYS } from "@/lib/clientStorage";

const playerId = "bingo-tester-id";

const defaultRoundEnd = Date.now() + 900_000;

function baseProps(
  over: Partial<ComponentProps<typeof MusicBingoScreen>> = {}
) {
  return {
    serverClaimedLineKeys: [] as string[],
    myBingoScore: 0,
    bingoRoundEndsAtEpochMs: defaultRoundEnd,
    myBingoMarkedCells: [] as boolean[],
    ...over,
  };
}

describe("MusicBingoScreen", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(KEYS.playerId, playerId);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("enables Call bingo only when a new full line is marked on the server", async () => {
    const marked = Array.from({ length: 6 }, () => false);
    const fetchMock = jest.fn((url: string | URL, init?: RequestInit) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/api/game/bingo/mark")) {
        const body = JSON.parse((init?.body as string) ?? "{}") as {
          cellIndex: number;
          mark: boolean;
        };
        marked[body.cellIndex] = body.mark;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              marked: [...marked],
              score: 0,
              wrongTapPenalty: false,
            }),
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch: ${u}`));
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<MusicBingoScreen {...baseProps()} />);
    const titles = bingoCardTitlesForPlayer(playerId);
    await waitFor(() =>
      expect(screen.getByText(titles[0]!, { exact: false })).toBeInTheDocument()
    );
    const callBingo = screen.getByRole("button", { name: /call bingo/i });
    expect(callBingo).toBeDisabled();
    const allButtons = screen.getAllByRole("button");
    const cellButtons = allButtons.filter((b) => b !== callBingo);
    fireEvent.click(cellButtons[0]!);
    fireEvent.click(cellButtons[1]!);
    expect(callBingo).toBeDisabled();
    fireEvent.click(cellButtons[2]!);
    await waitFor(() => expect(callBingo).not.toBeDisabled());
  });

  it("keeps Call bingo disabled when completed lines are already on the server", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            marked: [true, true, true, false, false, false],
            score: 100,
            wrongTapPenalty: false,
          }),
      } as Response)
    ) as unknown as typeof fetch;

    render(
      <MusicBingoScreen
        {...baseProps({
          serverClaimedLineKeys: ["0,1,2"],
          myBingoScore: 100,
          myBingoMarkedCells: [true, true, true, false, false, false],
        })}
      />
    );
    const titles = bingoCardTitlesForPlayer(playerId);
    await waitFor(() =>
      expect(screen.getByText(titles[0]!, { exact: false })).toBeInTheDocument()
    );
    const callBingo = screen.getByRole("button", { name: /call bingo/i });
    const allButtons = screen.getAllByRole("button");
    const cellButtons = allButtons.filter((b) => b !== callBingo);
    fireEvent.click(cellButtons[0]!);
    fireEvent.click(cellButtons[1]!);
    fireEvent.click(cellButtons[2]!);
    expect(callBingo).toBeDisabled();
  });

  it("POSTs line keys when claiming", async () => {
    const previous = global.fetch;
    const marked = [true, true, true, false, false, false];
    const fetchMock = jest.fn((url: string | URL) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/api/game/bingo/mark")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              marked,
              score: 0,
              wrongTapPenalty: false,
            }),
        } as Response);
      }
      if (u.includes("/api/game/bingo/claim")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ awarded: 100, totalForPlayer: 100 }),
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch: ${u}`));
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <MusicBingoScreen
        {...baseProps({ myBingoMarkedCells: [...marked] })}
      />
    );
    const titles = bingoCardTitlesForPlayer(playerId);
    await waitFor(() =>
      expect(screen.getByText(titles[0]!, { exact: false })).toBeInTheDocument()
    );
    const callBingo = screen.getByRole("button", { name: /call bingo/i });
    await waitFor(() => expect(callBingo).not.toBeDisabled());
    fireEvent.click(callBingo);
    try {
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/game/bingo/claim",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("0,1,2"),
          })
        )
      );
    } finally {
      global.fetch = previous;
    }
  });

  it("includes full-card key when all six tiles are marked", async () => {
    const previous = global.fetch;
    const marked = Array.from({ length: 6 }, () => false);
    const fetchMock = jest.fn((url: string | URL, init?: RequestInit) => {
      const u = typeof url === "string" ? url : url.toString();
      if (u.includes("/api/game/bingo/mark")) {
        const body = JSON.parse((init?.body as string) ?? "{}") as {
          cellIndex: number;
          mark: boolean;
        };
        marked[body.cellIndex] = body.mark;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              marked: [...marked],
              score: 0,
              wrongTapPenalty: false,
            }),
        } as Response);
      }
      if (u.includes("/api/game/bingo/claim")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ awarded: 850, totalForPlayer: 850 }),
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch: ${u}`));
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<MusicBingoScreen {...baseProps()} />);
    const titles = bingoCardTitlesForPlayer(playerId);
    await waitFor(() =>
      expect(screen.getByText(titles[0]!, { exact: false })).toBeInTheDocument()
    );
    const callBingo = screen.getByRole("button", { name: /call bingo/i });
    const allButtons = screen.getAllByRole("button");
    const cellButtons = allButtons.filter((b) => b !== callBingo);
    for (let i = 0; i < 6; i++) fireEvent.click(cellButtons[i]!);
    await waitFor(() => expect(callBingo).not.toBeDisabled());
    fireEvent.click(callBingo);
    try {
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/game/bingo/claim",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining(BINGO_FULL_CARD_CLAIM_KEY),
          })
        )
      );
    } finally {
      global.fetch = previous;
    }
  });

  it("shows round countdown when bingoRoundEndsAtEpochMs is set", async () => {
    render(<MusicBingoScreen {...baseProps()} />);
    const titles = bingoCardTitlesForPlayer(playerId);
    await waitFor(() =>
      expect(screen.getByText(titles[0]!, { exact: false })).toBeInTheDocument()
    );
    expect(screen.getByTestId("bingo-round-countdown")).toBeInTheDocument();
  });
});
