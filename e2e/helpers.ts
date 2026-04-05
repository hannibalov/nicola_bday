import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "admin-secret";

export function adminPageUrl(): string {
  return `/admin?key=${encodeURIComponent(ADMIN_SECRET)}`;
}

export async function resetParty(request: APIRequestContext): Promise<void> {
  const res = await request.post(
    `/api/admin/reset?key=${encodeURIComponent(ADMIN_SECRET)}`
  );
  expect(res.ok(), await res.text()).toBeTruthy();
}

/** Party protocol (first), check-in, open /play, confirm waiting room. */
export async function registerGuestThroughProtocol(
  page: Page,
  nickname: string
): Promise<void> {
  await page.goto("/");
  await page.getByTestId("party-protocol-continue").click();
  await page.getByTestId("guest-nickname-input").fill(nickname);
  await page.getByTestId("guest-join-submit").click();
  await page.waitForURL("**/play");
  await expect(page.getByTestId("waiting-lobby")).toBeVisible();
}

export async function adminAdvance(page: Page): Promise<void> {
  const btn = page.getByTestId("admin-start-next");
  await expect(btn).toBeEnabled();
  await btn.click();
}

export async function setupApiMocks(
  page: Page,
  getGuestStep: () => string,
  getPlayerCount: () => number
): Promise<void> {
  let countdownStartMs: number | null = null;

  // Mock /api/players POST
  await page.route("**/api/players", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      const nickname = body?.nickname?.trim();
      if (!nickname) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: "nickname is required" }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ playerId: "test-player" }),
          headers: { "Set-Cookie": "playerId=test-player; Path=/" },
        });
      }
    } else {
      await route.continue();
    }
  });

  // Mock /api/state
  await page.route("**/api/state", async (route) => {
    const step = getGuestStep();
    const isCountdown = step.startsWith("countdown");
    const fast = process.env.NICOLA_E2E_FAST_LOBBY === "1";
    const countdownDurationMs = fast ? 2200 : 61000;

    if (!isCountdown) {
      countdownStartMs = null;
    } else if (countdownStartMs == null) {
      countdownStartMs = Date.now();
    }

    const scheduled = isCountdown && countdownStartMs != null
      ? countdownStartMs + countdownDurationMs
      : null;

    let finalStep = step;
    if (isCountdown && scheduled != null && Date.now() >= scheduled) {
      const game = step.split("_")[1];
      finalStep = `game_${game}`;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        guestStep: finalStep,
        playerCount: getPlayerCount(),
        revision: 0,
        players: [],
        teams: [],
        currentGame: null,
        scheduledGameStartsAtEpochMs: scheduled,
        myBingoMarkedCells: [],
        myBingoClaimedLineKeys: [],
        myBingoScore: 0,
        bingoRoundEndsAtEpochMs: null,
        lobbyTeams: [],
      }),
    });
  });

  // Mock /api/admin/state
  await page.route("**/api/admin/state*", async (route) => {
    const url = new URL(route.request().url());
    const queryKey = url.searchParams.get("key");
    const headerKey = route.request().headers()["x-admin-key"];
    const key = queryKey || headerKey;
    if (key !== ADMIN_SECRET) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unauthorized" }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          guestStep: getGuestStep(),
          revision: 0,
          scheduledGameStartsAtEpochMs: null,
          teamMcqRoundIndex: 0,
          teamMcqRoundStartedAtEpochMs: null,
          games: [],
          bingoSongOrder: [],
          bingoCurrentSongIndex: 0,
          bingoRoundEndsAtEpochMs: null,
          players: Array.from({ length: getPlayerCount() }, (_, i) => ({
            id: `player-${i}`,
            nickname: `Player ${i}`,
          })),
          teams: [],
          gameScores: {},
          bingoClaimedLineKeysByPlayer: {},
          bingoMarkedByPlayer: {},
          triviaVotesByPlayer: {},
          quoteVotesByPlayer: {},
        }),
      });
    }
  });

  // Mock /api/admin/start-next
  await page.route("**/api/admin/start-next*", async (route) => {
    const url = new URL(route.request().url());
    const queryKey = url.searchParams.get("key");
    const headerKey = route.request().headers()["x-admin-key"];
    const key = queryKey || headerKey;
    if (key !== ADMIN_SECRET) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unauthorized" }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    }
  });

  // Mock /api/admin/reset
  await page.route("**/api/admin/reset*", async (route) => {
    const url = new URL(route.request().url());
    const queryKey = url.searchParams.get("key");
    const headerKey = route.request().headers()["x-admin-key"];
    const key = queryKey || headerKey;
    if (key !== ADMIN_SECRET) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unauthorized" }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    }
  });

  // Mock /api/admin/bingo-advance-song
  await page.route("**/api/admin/bingo-advance-song*", async (route) => {
    const url = new URL(route.request().url());
    const queryKey = url.searchParams.get("key");
    const headerKey = route.request().headers()["x-admin-key"];
    const key = queryKey || headerKey;
    if (key !== ADMIN_SECRET) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unauthorized" }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    }
  });

  // Mock game APIs
  await page.route("**/api/game/trivia/vote", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route("**/api/game/quotes/vote", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route("**/api/game/bingo/mark", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route("**/api/game/bingo/claim", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
}
