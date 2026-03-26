import { test, expect } from "@playwright/test";
import { adminPageUrl, registerGuestThroughProtocol, resetParty } from "./helpers";

test.describe("scale — many simultaneous guests", () => {
  test("100 separate sessions register and host sees full count", async ({
    browser,
    request,
  }) => {
    test.setTimeout(300_000);
    await resetParty(request);

    for (let i = 0; i < 100; i++) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await registerGuestThroughProtocol(page, `E2E_P${String(i).padStart(3, "0")}`);
      await ctx.close();
    }

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await adminPage.goto(adminPageUrl());
    await expect(adminPage.getByTestId("admin-player-count")).toHaveText("100", {
      timeout: 90_000,
    });
    await adminContext.close();
  });
});
