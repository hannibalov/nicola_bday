/**
 * @jest-environment jsdom
 */
import { act, render, screen, waitFor, fireEvent } from "@testing-library/react";
import IdentifyQuoteGameScreen from "./IdentifyQuoteGameScreen";

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
import { getQuoteQuestions } from "@/lib/quoteContent";
import type { TeamMcqPublicSync } from "@/types";

const QUESTIONS = getQuoteQuestions();
const QUOTE_T0 = 15_000_000;

function syncAtQuestion(
  i: number,
  opts?: { roundStartedAtEpochMs?: number; answerMs?: number; revealMs?: number }
): TeamMcqPublicSync {
  return {
    questionIndex: i,
    roundStartedAtEpochMs: opts?.roundStartedAtEpochMs ?? Date.now(),
    totalQuestions: QUESTIONS.length,
    answerMs: opts?.answerMs ?? 10_000,
    revealMs: opts?.revealMs ?? 3_000,
  };
}

describe("IdentifyQuoteGameScreen", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it("submits selected option to the quotes vote API", async () => {
    const fetchMock = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <IdentifyQuoteGameScreen
        teamMcqSync={syncAtQuestion(0)}
        serverQuoteVotes={{}}
      />
    );

    const q_id = getQuoteQuestions()[0].id;
    fireEvent.click(screen.getByRole("button", { name: /^B\./i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/game/quotes/vote",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining(q_id) as string,
        })
      );
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      questionId: string;
      optionIndex: number;
    };
    expect(body.questionId).toBe(q_id);
    expect(body.optionIndex).toBe(1);
  });

  it("renders the quote for the synchronized question index", () => {
    const { rerender } = render(
      <IdentifyQuoteGameScreen
        teamMcqSync={syncAtQuestion(0)}
        serverQuoteVotes={{}}
      />
    );
    expect(screen.getByText(QUESTIONS[0].quote, { exact: false })).toBeInTheDocument();

    rerender(
      <IdentifyQuoteGameScreen
        teamMcqSync={syncAtQuestion(1)}
        serverQuoteVotes={{}}
      />
    );
    expect(screen.getByText(QUESTIONS[1].quote, { exact: false })).toBeInTheDocument();
  });

  it("advances to the next quote after reveal without new server sync props", async () => {
    jest.useFakeTimers({ now: QUOTE_T0 });
    const answerMs = 500;
    const revealMs = 250;
    const cycle = answerMs + revealMs;

    render(
      <IdentifyQuoteGameScreen
        teamMcqSync={syncAtQuestion(0, {
          roundStartedAtEpochMs: QUOTE_T0,
          answerMs,
          revealMs,
        })}
        serverQuoteVotes={{}}
      />
    );

    expect(
      screen.getByText(QUESTIONS[0].quote, { exact: false })
    ).toBeInTheDocument();

    await act(async () => {
      jest.setSystemTime(QUOTE_T0 + cycle + 100);
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(
        screen.getByText(QUESTIONS[1].quote, { exact: false })
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText(QUESTIONS[0].quote, { exact: false })
    ).not.toBeInTheDocument();
  });
});
