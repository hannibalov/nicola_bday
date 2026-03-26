/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import IdentifyQuoteGameScreen from "./IdentifyQuoteGameScreen";
import { getQuoteQuestions } from "@/lib/quoteContent";

describe("IdentifyQuoteGameScreen", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("submits selected option to the quotes vote API", async () => {
    const fetchMock = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<IdentifyQuoteGameScreen serverQuoteVotes={{}} />);

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

  it("advances to next quote after Next when an answer is selected", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      })
    ) as unknown as typeof fetch;

    render(<IdentifyQuoteGameScreen serverQuoteVotes={{}} />);
    fireEvent.click(screen.getByRole("button", { name: /^A\./i }));
    fireEvent.click(screen.getByRole("button", { name: /next quote/i }));
    expect(screen.getByTestId("question-progress")).toHaveTextContent(
      /Quote 2 /
    );
  });
});
