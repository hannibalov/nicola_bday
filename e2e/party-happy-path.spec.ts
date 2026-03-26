import { test, expect } from "@playwright/test";
import { TRIVIA_QUESTIONS } from "../src/content/trivia";
import { getQuoteQuestions } from "../src/lib/quoteContent";
import {
  adminAdvance,
  adminPageUrl,
  registerGuestThroughProtocol,
  resetParty,
} from "./helpers";

test.describe("happy path — host drives full party", () => {
  test.beforeEach(async ({ request }) => {
    await resetParty(request);
  });

  test("guest completes trivia, bingo claim, quotes, and final leaderboard", async ({
    browser,
  }) => {
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await adminPage.goto(adminPageUrl());

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await registerGuestThroughProtocol(guestPage, "E2E_Hero");

    await expect(adminPage.getByTestId("admin-player-count")).toHaveText("1");

    await adminAdvance(adminPage);
    await expect(guestPage.getByTestId("lobby-screen-trivia")).toBeVisible();

    await adminAdvance(adminPage);
    await expect(guestPage.getByTestId("lobby-embedded-countdown")).toBeVisible({
      timeout: 15_000,
    });

    await expect(guestPage.getByTestId("question-progress")).toBeVisible({
      timeout: 30_000,
    });

    for (let i = 0; i < TRIVIA_QUESTIONS.length; i++) {
      const correct = TRIVIA_QUESTIONS[i]!.correctIndex;
      await guestPage.getByTestId(`mcq-option-${correct}`).click();
      if (i < TRIVIA_QUESTIONS.length - 1) {
        await guestPage.getByTestId("trivia-next").click();
      }
    }

    await adminAdvance(adminPage);
    await expect(guestPage.getByTestId("game-mid-leaderboard")).toBeVisible();

    await adminAdvance(adminPage);
    await expect(guestPage.getByTestId("lobby-screen-music_bingo")).toBeVisible();

    await adminAdvance(adminPage);
    await expect(guestPage.getByTestId("lobby-embedded-countdown")).toBeVisible({
      timeout: 15_000,
    });

    await expect(guestPage.getByText(/Music bingo/i).first()).toBeVisible({
      timeout: 30_000,
    });
    for (const idx of [0, 1, 2]) {
      await guestPage.getByTestId(`bingo-cell-${idx}`).click();
    }
    await guestPage.getByTestId("bingo-claim").click();

    await adminAdvance(adminPage);
    await expect(guestPage.getByTestId("game-mid-leaderboard")).toBeVisible();

    await adminAdvance(adminPage);
    await expect(guestPage.getByTestId("lobby-screen-identify_quote")).toBeVisible();

    await adminAdvance(adminPage);
    await expect(guestPage.getByTestId("lobby-embedded-countdown")).toBeVisible({
      timeout: 15_000,
    });

    const quotes = getQuoteQuestions();
    await expect(guestPage.getByTestId("question-progress")).toBeVisible({
      timeout: 30_000,
    });
    for (let i = 0; i < quotes.length; i++) {
      const correct = quotes[i]!.correctIndex;
      await guestPage.getByTestId(`mcq-option-${correct}`).click();
      if (i < quotes.length - 1) {
        await guestPage.getByTestId("quote-next").click();
      }
    }

    await adminAdvance(adminPage);
    await expect(guestPage.getByTestId("final-leaderboard")).toBeVisible();

    await adminContext.close();
    await guestContext.close();
  });
});
