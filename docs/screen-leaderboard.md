# Screen: Leaderboard (between games)

**Audience:** Implementation agent (UI + data).  
**Design reference:** `stitch_birthday_trivia_individual_game_leaderboard/code.html`

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
- **Team games (trivia, quotes):** Leaderboard can show **teams** or **individuals** — product decision; spec mentions leaderboard after each game; be consistent with “teams copied to each member” (everyone on the team has the same points from that round).
- **Music bingo:** Individual points; show players.
- Visuals: align with Stitch leaderboard HTML (podium, list, accents).

---

## Current implementation

- `src/components/GameLeaderboard.tsx` — takes `gameName`, `entries: { name, score }[]`, `type: 'individual' | 'team'`.
- Shown when server `phase === 'leaderboard'` in `PlayView`.
- Scores come from `getLeaderboardForCurrentGame()` reading `gameScores` filled by **mock** logic.

---

## Data needs

- `PublicState.leaderboard` already exists for current game end.
- Ensure server writes **real** cumulative or per-round scores when advancing from `game` → `leaderboard`.
- For **final** event totals, either reuse `FinalLeaderboard` or unify — current code has `final_leaderboard` phase with `getFinalLeaderboard()` which **averages** team points across members; **this conflicts** with the **product spec** (“team points **copied** to each player”). Update store math when implementing real scoring (see `ARCHITECTURE.md`).

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
- [ ] Pixel-rough alignment with Stitch leaderboard design.
- [ ] Correct ordering (descending score); stable tie-break (alphabetical or join order — document).
- [ ] Works for both `team` and `individual` preceding games.
- [ ] Accessible on mobile (large touch targets, readable contrast).

---

## Files likely touched

- `src/components/GameLeaderboard.tsx`
- `src/components/FinalLeaderboard.tsx` (if final vs intermediate differ)
- `src/lib/store.ts` — scoring and aggregation
- `src/components/PlayView.tsx` — when to show intermediate vs final

---

## Related docs

- [game-trivia-team.md](./game-trivia-team.md)
- [game-music-bingo.md](./game-music-bingo.md)
- [game-identify-quote-team.md](./game-identify-quote-team.md)
