import { test, expect } from "@playwright/test";
import { adminPageUrl, registerGuestThroughProtocol, setupApiMocks } from "./helpers";

test.describe("scale — many simultaneous guests", () => {
  test("100 separate sessions register and host sees full count", async ({
    browser,
  }) => {
    test.setTimeout(300_000);
    let adminPlayerCount = 0;

    for (let i = 0; i < 100; i++) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await setupApiMocks(page, () => "party_protocol", () => 1);
      await registerGuestThroughProtocol(page, `E2E_P${String(i).padStart(3, "0")}`);
      await ctx.close();
    }

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await setupApiMocks(adminPage, () => "party_protocol", () => adminPlayerCount);
    await adminPage.goto(adminPageUrl());
    adminPlayerCount = 100;
    await expect(adminPage.getByTestId("admin-player-count")).toHaveText("100", {
      timeout: 90_000,
    });
    await adminContext.close();
  });
});
