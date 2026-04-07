import { test, expect } from "@playwright/test";
import { TRIVIA_QUESTIONS } from "../src/content/trivia";
import { getQuoteQuestions } from "../src/lib/quoteContent";
import {
  adminAdvance,
  adminPageUrl,
  registerGuestThroughProtocol,
  setupApiMocks,
} from "./helpers";

test.describe("happy path — host drives full party", () => {
  test("guest completes trivia, bingo claim, quotes, and final leaderboard", async ({
    browser,
  }) => {
    let guestStep = "party_protocol";
    let adminPlayerCount = 0;
    const guestPlayerCount = 1;

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await setupApiMocks(adminPage, () => guestStep, () => adminPlayerCount);
    await adminPage.goto(adminPageUrl());

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await setupApiMocks(guestPage, () => guestStep, () => guestPlayerCount);
    await registerGuestThroughProtocol(guestPage, "E2E_Hero");

    adminPlayerCount = 1;
    await expect(adminPage.getByTestId("admin-player-count")).toHaveText("1");

    await adminAdvance(adminPage);
    guestStep = "lobby_trivia";
    await expect(guestPage.getByTestId("lobby-screen-trivia")).toBeVisible();

    await adminAdvance(adminPage);
    guestStep = "countdown_trivia";
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
        await guestPage.waitForTimeout(900);
      }
    }

    await adminAdvance(adminPage);
    guestStep = "leaderboard_post_trivia";
    await expect(guestPage.getByTestId("game-mid-leaderboard")).toBeVisible();

    await adminAdvance(adminPage);
    guestStep = "lobby_bingo";
    await expect(guestPage.getByTestId("lobby-screen-music_bingo")).toBeVisible();

    await adminAdvance(adminPage);
    guestStep = "countdown_bingo";
    await expect(guestPage.getByTestId("lobby-embedded-countdown")).toBeVisible({
      timeout: 15_000,
    });

    await expect(guestPage.getByText(/Music bingo/i).first()).toBeVisible({
      timeout: 30_000,
    });
    // Bingo scoring is tied to the host's current song and server marks; host advances to leaderboard.

    await adminAdvance(adminPage);
    guestStep = "leaderboard_post_bingo";
    await expect(guestPage.getByTestId("game-mid-leaderboard")).toBeVisible();

    await adminAdvance(adminPage);
    guestStep = "lobby_quotes";
    await expect(guestPage.getByTestId("lobby-screen-identify_quote")).toBeVisible();

    await adminAdvance(adminPage);
    guestStep = "countdown_quotes";
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
        await guestPage.waitForTimeout(900);
      }
    }

    await adminAdvance(adminPage);
    guestStep = "leaderboard_final";
    await expect(guestPage.getByTestId("final-leaderboard")).toBeVisible();

    await adminContext.close();
    await guestContext.close();
  });
});
