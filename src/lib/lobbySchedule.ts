/**
 * Server and client share these values so guests can run the lobby countdown locally
 * from {@link scheduledGameStartsAtEpochMs} with minimal polling.
 *
 * Timeline (server clock): admin taps → +buffer → visible 60s → 1s “Go!” → game step.
 * `NICOLA_E2E_FAST_LOBBY=1` shortens intervals for Playwright against `next start`.
 */

const fast = process.env.NICOLA_E2E_FAST_LOBBY === "1";

/** Visible numeric countdown length (seconds); always 60 in production. */
export const LOBBY_COUNTDOWN_SECONDS = fast ? 2 : 60;

/** Full-screen “Go!” duration before the game step opens. */
export const LOBBY_GO_PHASE_MS = fast ? 200 : 1000;

/**
 * Lead time after admin schedules so slow clients can receive SSE / first fetch
 * before the 60s timer starts ticking.
 */
export const LOBBY_SCHEDULE_BUFFER_MS = fast ? 200 : 3000;

/** From admin “start countdown” until the game step begins (buffer + countdown + Go!). */
export const LOBBY_PRE_GAME_LEAD_MS =
  LOBBY_SCHEDULE_BUFFER_MS +
  LOBBY_COUNTDOWN_SECONDS * 1000 +
  LOBBY_GO_PHASE_MS;
