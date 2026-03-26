# Game: Music bingo (1970s)

**Audience:** Implementation agent (UI + deterministic card + local scoring). **Individual** game.

**Process:** **TDD**, then **`yarn lint`** — [§11](./ARCHITECTURE.md#tdd), [§12](./ARCHITECTURE.md#lint). Reuse shell/header patterns from [§13](./ARCHITECTURE.md#reuse); grid UI stays game-specific.

---

## Rules (from product)

- **Individual** — no team majority.
- Each player sees a **random bingo card** of song titles.
- Grid: **2 columns × 3 rows** = **6** cells per card.
- Pool: **30** well-known **1970s** songs (titles as strings; host plays audio **externally** — no in-app audio required).
- Player taps cells when they recognize a song played in the room (**self-reported**, no auto validation).
- **Bingo = 500 points** (define what counts as bingo on a 2×3 grid: e.g. **any full row**, **any full column**, or **all six** — product should pick; **any line of 3 in row or column** is a common choice for 2×3).

---

## Card generation

- Use a **seeded** PRNG from `playerId` (and maybe `gameId`) so the same device always gets the same card after refresh.
- Sample **6** distinct songs from the pool of 30 without replacement.
- Store in **localStorage:** `{ seed, songIds[], marked[] }`.

---

## Scoring

- Client can **propose** “bingo claimed” to server; server trusts claim (honor system) or host confirms — product says manual; simplest is **auto-award on button** “Call bingo!” with optional admin ack later.
- **500** points per bingo event; clarify if multiple bingos on same card stack (e.g. second line +500).

---

## Current codebase

- Placeholder individual game in `gameConfig` ordering must be updated to match **real** party sequence (trivia → bingo → quotes).
- No bingo UI.

---

## Content

- `src/lib/content/bingoSongs.ts` — array of **30** strings (song titles).

---

## TDD (required)

- **Unit tests first** for: seeded card generation (same seed → same 6 titles), sampling without replacement from 30, **bingo line detection** for the chosen rule (rows/columns/full card).
- **`MusicBingoScreen.test.tsx`**: tap toggles cell; claim bingo disabled until pattern valid (if applicable).
- **Store/API:** points +500 tests when claim accepted.
- **`yarn test`** passes.

## Lint (required)

- **`yarn lint`** after tests — [ARCHITECTURE.md §12](./ARCHITECTURE.md#lint).

## Reuse

Prefer **`GameScreenHeader`** / primary CTA components if present; do **not** rebuild MCQ components — bingo is grid-only. See [ARCHITECTURE.md §13](./ARCHITECTURE.md#reuse).

## Acceptance criteria

- [ ] **Tests first** for card generation and bingo detection; UI implements those contracts.
- [ ] **`yarn lint`** passes.
- [ ] 2×3 grid UI; tap toggles “heard” state with clear visual.
- [ ] Card stable across refresh (localStorage + deterministic seed).
- [ ] 30-song pool from 1970s pop/rock icons (legally safe: **titles only** on screen).
- [ ] Bingo detection matches chosen rule; +500 applied to **player’s** score; behavior locked by tests.
- [ ] Styled per `music_bingo_rules` reference.

---

## Files likely touched

- New `src/components/guest/MusicBingoScreen.tsx`
- `src/lib/store.ts` — add player score update API
- Optional `POST /api/game/bingo/claim`

---

## Related docs

- [screen-lobby.md](./screen-lobby.md) — bingo lobby variant
- [screen-leaderboard.md](./screen-leaderboard.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
