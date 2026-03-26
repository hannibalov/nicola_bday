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
