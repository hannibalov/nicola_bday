# Game: Music bingo (1970s)

**Audience:** Agents and maintainers implementing or changing bingo. **Individual** game.

**Process:** **TDD**, then **`yarn lint`** — [§11](./ARCHITECTURE.md#tdd), [§12](./ARCHITECTURE.md#lint). Reuse shell/header patterns from [§13](./ARCHITECTURE.md#reuse); grid UI stays game-specific.

---

## Rules (product)

- **Individual** — no team majority.
- Each player gets a **deterministic random card**: **6** distinct titles sampled from the pool, **2 rows × 3 columns** (indices row-major `0…5`). Grid layout matches [`bingoLine.ts`](../src/lib/bingoLine.ts) (rows of 3, columns of 2).
- **Pool:** **50** well-known **1970s** titles in [`src/content/bingo.ts`](../src/content/bingo.ts) (titles only on screen; host plays audio **externally**).
- **Host-driven playback:** On `game_bingo`, the server shuffles the full pool into `bingoSongOrder`, sets `bingoCurrentSongIndex` to **0**, and exposes the current title on **admin** only. The host uses **Advance to next song** (`POST /api/admin/bingo-advance-song`) after each clip. Guests never receive the current title in `PublicState` (anti-cheat).
- **Marking tiles:** Guests tap cells → `POST /api/game/bingo/mark` with `{ cellIndex, mark }`. Turning a cell **on** succeeds only if the cell’s title **equals** the server’s current song; otherwise **−5** points (see `BINGO_WRONG_TAP_PENALTY` in [`bingoRound.ts`](../src/lib/bingoRound.ts)) and the cell stays off. Turning **off** clears the cell without penalty.
- **Claims:** **Call bingo!** → `POST /api/game/bingo/claim` with `lineKeys`. The server only awards lines / full card that are **fully marked** in `bingoMarkedByPlayer` (not honor-only).
  - **Column** (2 cells): **50** pts  
  - **Row** (3 cells): **100** pts  
  - **Full card** (key `full`): **500** pts once, when all six cells are marked  
  - Multiple new lines in one claim stack (max theoretical from one full card: **850** pts before penalties).

---

## Round timer

- **`bingoRoundEndsAtEpochMs`** is set when entering `game_bingo` to **now + 20 minutes** (`BINGO_ROUND_DURATION_MS` in [`bingoRound.ts`](../src/lib/bingoRound.ts)).
- [`applyDueBingoRoundEnd`](../src/lib/store.ts) runs on the same read paths as other “due” transitions. When time has passed, the session advances to **`leaderboard_post_bingo`** and **`recordRoundScoresForCompletedGame(1)`** snapshots per-player bingo scores (including negative totals from wrong taps).

---

## Card generation

- Seeded PRNG from `playerId` in [`bingoCard.ts`](../src/lib/bingoCard.ts); same `playerId` → same six titles after refresh.
- Sample **6** distinct songs from the pool of **50** without replacement.
- **localStorage** (`nicola-bday:bingo` via [`clientStorage.ts`](../src/lib/clientStorage.ts)): mirrors `{ playerId, seed, titles, marked[] }` for resilience; when `/api/state` returns **`myBingoMarkedCells`** with length **6**, the UI prefers server marks over stale local marks.

---

## Server state (summary)

| Field | Role |
|--------|------|
| `bingoSongOrder` | Shuffled playlist for the round |
| `bingoCurrentSongIndex` | Active track index into `bingoSongOrder` |
| `bingoRoundEndsAtEpochMs` | Auto-end time for the round |
| `bingoMarkedByPlayer` | `playerId` → boolean[6], server truth for marks |
| `bingoClaimedLineKeysByPlayer` | Scored line keys + optional `"full"` |

See [`SessionState`](../src/types/index.ts) and [`store.ts`](../src/lib/store.ts) (`markBingoCell`, `claimBingo`, `adminAdvanceBingoSong`).

---

## APIs

| Method | Path | Role |
|--------|------|------|
| `POST` | `/api/game/bingo/mark` | Guest: toggle cell vs current song; wrong song → penalty |
| `POST` | `/api/game/bingo/claim` | Guest: claim new lines / full card |
| `POST` | `/api/admin/bingo-advance-song` | Host: next track (`x-admin-key`) |

---

## TDD (required)

- **Unit / store tests:** `bingoCard`, `bingoLine`, `markBingoCell`, `claimBingo`, `applyDueBingoRoundEnd`, `adminAdvanceBingoSong`.
- **Route tests:** `bingo/mark`, `bingo/claim`, `admin/bingo-advance-song`.
- **`MusicBingoScreen.test.tsx`:** countdown, mark/claim flows with mocked `fetch`.
- **`yarn test`** passes.

## Lint (required)

- **`yarn lint`** after tests — [ARCHITECTURE.md §12](./ARCHITECTURE.md#lint).

## Reuse

Prefer shared layout / `PrimaryActionButton`; do **not** rebuild MCQ for bingo. See [ARCHITECTURE.md §13](./ARCHITECTURE.md#reuse).

---

## Files (reference)

| Area | Path |
|------|------|
| Content | `src/content/bingo.ts` |
| Round constants | `src/lib/bingoRound.ts` |
| Lines / points | `src/lib/bingoLine.ts` |
| Card | `src/lib/bingoCard.ts` |
| Store | `src/lib/store.ts` |
| Guest UI | `src/components/guest/MusicBingoScreen.tsx` |
| Host UI | `src/components/admin/AdminPanel.tsx` (now playing + advance) |
| Routes | `src/app/api/game/bingo/mark/route.ts`, `claim/route.ts`, `src/app/api/admin/bingo-advance-song/route.ts` |

---

## Related docs

- [screen-lobby.md](./screen-lobby.md) — bingo lobby variant
- [screen-admin.md](./screen-admin.md) — host panel + bingo deck
- [screen-leaderboard.md](./screen-leaderboard.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
