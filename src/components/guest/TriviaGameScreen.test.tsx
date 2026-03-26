/**
 * @jest-environment jsdom
 */
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import TriviaGameScreen from "./TriviaGameScreen";
import { TRIVIA_QUESTIONS } from "@/content/trivia";
import type { TeamMcqPublicSync } from "@/types";

const TRIVIA_T0 = 12_000_000;

function syncAtQuestion(
  i: number,
  opts?: { roundStartedAtEpochMs?: number; answerMs?: number; revealMs?: number }
): TeamMcqPublicSync {
  return {
    questionIndex: i,
    roundStartedAtEpochMs: opts?.roundStartedAtEpochMs ?? Date.now(),
    totalQuestions: TRIVIA_QUESTIONS.length,
    answerMs: opts?.answerMs ?? 10_000,
    revealMs: opts?.revealMs ?? 3_000,
  };
}

describe("TriviaGameScreen", () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response)
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("submits a vote when an option is selected", async () => {
    render(
      <TriviaGameScreen
        teamMcqSync={syncAtQuestion(0)}
        serverMyVotes={{}}
      />
    );
    const first = TRIVIA_QUESTIONS[0];
    fireEvent.click(screen.getByText(first.options[0]));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/game/trivia/vote",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("shows majority explainer", () => {
    render(
      <TriviaGameScreen teamMcqSync={syncAtQuestion(0)} serverMyVotes={{}} />
    );
    expect(screen.getByText(/most of you/i)).toBeInTheDocument();
  });

  it("shows synchronized countdown bar", () => {
    render(
      <TriviaGameScreen teamMcqSync={syncAtQuestion(0)} serverMyVotes={{}} />
    );
    expect(screen.getByTestId("mcq-round-countdown")).toBeInTheDocument();
  });

  it("shows the next question after reveal without a new teamMcqSync from the server", async () => {
    jest.useFakeTimers({ now: TRIVIA_T0 });
    const answerMs = 500;
    const revealMs = 250;
    const cycle = answerMs + revealMs;

    render(
      <TriviaGameScreen
        teamMcqSync={syncAtQuestion(0, {
          roundStartedAtEpochMs: TRIVIA_T0,
          answerMs,
          revealMs,
        })}
        serverMyVotes={{}}
      />
    );

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: TRIVIA_QUESTIONS[0].prompt,
      })
    ).toBeInTheDocument();

    await act(async () => {
      jest.setSystemTime(TRIVIA_T0 + cycle + 100);
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          level: 2,
          name: TRIVIA_QUESTIONS[1].prompt,
        })
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("heading", {
        level: 2,
        name: TRIVIA_QUESTIONS[0].prompt,
      })
    ).not.toBeInTheDocument();
  });
});
