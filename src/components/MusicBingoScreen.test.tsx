/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import MusicBingoScreen from "./MusicBingoScreen";
import { bingoCardTitlesForPlayer } from "@/lib/bingoCard";
import { KEYS } from "@/lib/clientStorage";

const playerId = "bingo-tester-id";

describe("MusicBingoScreen", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(KEYS.playerId, playerId);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("enables Call bingo only when a new full line is marked", async () => {
    render(<MusicBingoScreen serverClaimedLineKeys={[]} myBingoScore={0} />);
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
    render(
      <MusicBingoScreen
        serverClaimedLineKeys={["0,1,2"]}
        myBingoScore={500}
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
    const fetchMock = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ awarded: 500, totalForPlayer: 500 }),
      } as Response)
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<MusicBingoScreen serverClaimedLineKeys={[]} myBingoScore={0} />);
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
});
