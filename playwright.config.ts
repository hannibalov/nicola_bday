import { defineConfig, devices } from "@playwright/test";

/** Dedicated port avoids clashing with a developer’s `next dev` on :3000 and the single `.next/dev` lock. */
const port = Number(process.env.E2E_PORT ?? "3040");
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 3,
  timeout: 180_000,
  expect: { timeout: 25_000 },
  use: {
    baseURL,
    headless: true,
    testIdAttribute: "data-test-id",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  /**
   * `next dev` takes a process-wide lock under `.next/dev` — a second dev instance fails if you
   * already run `yarn dev`. Production `next start` avoids that and matches CI-like behavior.
   */
  webServer: {
    command: `yarn build && yarn exec next start -p ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      NICOLA_E2E_FAST_LOBBY: "1",
      NEXT_PUBLIC_NICOLA_PROTOCOL_TEST: "1",
      NEXT_PUBLIC_NICOLA_DISABLE_SSE: "1",
    },
  },
});
