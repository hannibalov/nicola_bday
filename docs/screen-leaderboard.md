# Screen: Leaderboard (between games)

**Audience:** Implementation agent (UI + data).

**Process:** **TDD**, then **`yarn lint`** — [§11](./ARCHITECTURE.md#tdd), [§12](./ARCHITECTURE.md#lint).

---

## Purpose

Show standings **after** a game completes, before the next lobby or the final wrap-up. This screen appears **multiple times** in the evening:

1. After **team trivia**
2. After **music bingo**
3. After **who said it** (and optionally as “final” if combined)

---

## Product requirements

- Rankings must reflect **actual** scoring rules for the preceding game (not mock random data — see `src/lib/store.ts` `recordMockScores` to replace).
- **Team games (trivia, quotes):** `GameLeaderboard` toggles **Individual** vs **Squad**. Everyone on the team has the **same** round score (the team’s total for that game — not divided). **Squad** rows show that total **once**; they are not the sum of all members’ stored scores (members already each hold the full amount).
- **Music bingo:** Individual points; show players.
- Visuals: clear ranking (podium or list), readable names/scores, mobile-friendly accents.

---

## Current implementation

- `src/components/guest/GameLeaderboard.tsx` — takes `gameName`, `entries: { name, score }[]`, `type: 'individual' | 'team'`.
- Shown when `guestStep` is `leaderboard_post_trivia`, `leaderboard_post_bingo`, etc., in `PlayView`.
- Entries come from `getLeaderboardForGameSlot` / `gameScores` after **`recordRoundScoresForCompletedGame`** runs at each leaderboard transition (real trivia/quote scoring and bingo rounds, not mock placeholders).

---

## Data needs

- `PublicState.leaderboard` already exists for current game end.
- Ensure server writes **real** cumulative or per-round scores when advancing from `game` → `leaderboard`.
- For **final** totals, `FinalLeaderboard` uses `getFinalLeaderboard()`, which **adds** each player’s per-game scores. For trivia and quotes, each player already has the full team round total on their row, so the final list is per-person cumulative points (no averaging step).

---

## TDD (required)

- **`GameLeaderboard.test.tsx` / `FinalLeaderboard.test.tsx`**: extend with new entry shapes if needed; descending order; empty list; `team` vs `individual` labels.
- **`store.test.ts`**: scoring aggregation that feeds leaderboards (per-game and final) must have tests **before** or **with** store changes.
- **`yarn test`** passes.

## Lint (required)

- **`yarn lint`** after tests — [ARCHITECTURE.md §12](./ARCHITECTURE.md#lint).

## Acceptance criteria

- [ ] **Tests first** for sort order and score display rules.
- [ ] **`yarn lint`** passes.
- [ ] Cohesive leaderboard UI consistent with `GameLeaderboard` / `FinalLeaderboard`.
- [ ] Correct ordering (descending score); stable tie-break (alphabetical or join order — document).
- [ ] Works for both `team` and `individual` preceding games.
- [ ] Accessible on mobile (large touch targets, readable contrast).

---

## Files likely touched

- `src/components/guest/GameLeaderboard.tsx`
- `src/components/guest/FinalLeaderboard.tsx` (if final vs intermediate differ)
- `src/lib/store.ts` — scoring and aggregation
- `src/components/guest/PlayView.tsx` — when to show intermediate vs final

---

## Related docs

- [game-trivia-team.md](./game-trivia-team.md)
- [game-music-bingo.md](./game-music-bingo.md)
- [game-identify-quote-team.md](./game-identify-quote-team.md)
