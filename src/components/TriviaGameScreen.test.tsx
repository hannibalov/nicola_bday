/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TriviaGameScreen from "./TriviaGameScreen";
import { TRIVIA_QUESTIONS } from "@/content/trivia";

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
    const onVoteSynced = jest.fn();
    render(
      <TriviaGameScreen serverMyVotes={{}} onVoteSynced={onVoteSynced} />
    );
    const first = TRIVIA_QUESTIONS[0];
    fireEvent.click(screen.getByText(first.options[0]));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/game/trivia/vote",
        expect.objectContaining({ method: "POST" })
      );
    });
    expect(onVoteSynced).toHaveBeenCalled();
  });

  it("shows majority explainer", () => {
    render(<TriviaGameScreen serverMyVotes={{}} />);
    expect(screen.getByText(/most of you/i)).toBeInTheDocument();
  });
});
