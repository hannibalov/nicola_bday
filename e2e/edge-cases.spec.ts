import { test, expect } from "@playwright/test";
import {
  adminPageUrl,
  adminAdvance,
  registerGuestThroughProtocol,
  resetParty,
  ADMIN_SECRET,
} from "./helpers";

test.describe("edges that could break the flow", () => {
  test.beforeEach(async ({ request }) => {
    await resetParty(request);
  });

  test("check-in rejects empty nickname", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("party-protocol-continue").click();
    await page.getByTestId("guest-join-submit").click();
    await expect(
      page.getByRole("alert").filter({ hasText: /enter a nickname/i })
    ).toBeVisible();
  });

  test("admin panel rejects wrong key", async ({ page }) => {
    await page.goto("/admin?key=not-the-real-secret");
    await expect(
      page.getByText(/invalid admin key/i)
    ).toBeVisible({ timeout: 15_000 });
  });

  test("reset requires confirmation — cancelled leaves players", async ({
    browser,
  }) => {
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await registerGuestThroughProtocol(guestPage, "KeepMe");

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await adminPage.goto(adminPageUrl());
    await expect(adminPage.getByTestId("admin-player-count")).toHaveText("1");

    adminPage.once("dialog", (d) => d.dismiss());
    await adminPage.getByTestId("admin-reset-session").click();

    await expect(adminPage.getByTestId("admin-player-count")).toHaveText("1");
    await adminContext.close();
    await guestContext.close();
  });

  test("advancing while guest still on protocol screen — host can still move session", async ({
    browser,
  }) => {
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await adminPage.goto(adminPageUrl());

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto("/");
    await expect(
      guestPage.getByTestId("party-protocol-continue")
    ).toBeVisible();

    await adminAdvance(adminPage);

    await guestPage.getByTestId("party-protocol-continue").click();
    await guestPage.getByTestId("guest-nickname-input").fill("LateProtocol");
    await guestPage.getByTestId("guest-join-submit").click();
    await guestPage.waitForURL("**/play");

    await expect(guestPage.getByTestId("lobby-screen-trivia")).toBeVisible({
      timeout: 20_000,
    });

    await adminContext.close();
    await guestContext.close();
  });

  test("trivia vote API returns error if spoofed phase (no cookie hijack of phase)", async ({
    request,
  }) => {
    await resetParty(request);
    const join = await request.post("/api/players", {
      data: { nickname: "ApiOnly" },
    });
    expect(join.ok()).toBeTruthy();
    const { playerId } = (await join.json()) as { playerId: string };
    const vote = await request.post("/api/game/trivia/vote", {
      headers: { Cookie: `playerId=${playerId}` },
      data: { questionId: "t1", optionIndex: 0 },
    });
    expect(vote.status()).toBe(400);
    const body = (await vote.json()) as { error?: string };
    expect(body.error).toBe("not_active");
  });

  test("admin APIs reject missing secret", async ({ request }) => {
    const start = await request.post("/api/admin/start-next");
    expect(start.status()).toBe(401);
    const resetRes = await request.post("/api/admin/reset");
    expect(resetRes.status()).toBe(401);
    const state = await request.get(
      `/api/admin/state?key=${encodeURIComponent(ADMIN_SECRET + "x")}`
    );
    expect(state.status()).toBe(401);
  });
});
