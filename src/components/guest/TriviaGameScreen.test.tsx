/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TriviaGameScreen from "./TriviaGameScreen";
import { TRIVIA_QUESTIONS } from "@/content/trivia";
import type { TeamMcqPublicSync } from "@/types";

function syncAtQuestion(i: number): TeamMcqPublicSync {
  return {
    questionIndex: i,
    roundStartedAtEpochMs: Date.now(),
    totalQuestions: TRIVIA_QUESTIONS.length,
    answerMs: 10_000,
    revealMs: 3_000,
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
});
