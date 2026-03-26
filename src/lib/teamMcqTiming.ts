/**
 * Synchronized team MCQ rounds (trivia + quotes): shared server constants.
 * With `NICOLA_E2E_FAST_LOBBY=1` (Playwright), intervals shorten like lobby timing.
 */

const fast = process.env.NICOLA_E2E_FAST_LOBBY === "1";

/** Time players have to tap an answer. */
export const TEAM_MCQ_ANSWER_MS = fast ? 400 : 10_000;

/** After answer window: show correct option (green) for everyone. */
export const TEAM_MCQ_REVEAL_MS = fast ? 150 : 3_000;

export const TEAM_MCQ_CYCLE_MS = TEAM_MCQ_ANSWER_MS + TEAM_MCQ_REVEAL_MS;
