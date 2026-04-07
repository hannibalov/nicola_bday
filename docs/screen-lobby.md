# Screen: Lobby (instructions + roster)

**Audience:** Implementation agent (UI + data wiring).

**Process:** **TDD**, then **`yarn lint`** — [§11](./ARCHITECTURE.md#tdd), [§12](./ARCHITECTURE.md#lint). **Reuse:** one `LobbyScreen` for both game lobbies — [ARCHITECTURE.md §13](./ARCHITECTURE.md#reuse).

---

## Purpose

A **waiting / briefing** screen before a game starts. Two variants in the product:

| Variant | Game | Team model | Must show |
|---------|------|------------|-----------|
| **Lobby A** | Trivia (game 1) | **Team** | Instructions for **team trivia**; **player names grouped by team** |
| **Lobby B** | Music bingo (game 2) | **Individual** | Instructions for **music bingo**; no team roster (or “everyone plays solo”) |

Reuse the **same page/component** with different **copy** and **optional team roster** props.

---

## Product requirements

- Visible only when:
  1. Guest has completed check-in **and** party protocol (local flags).
  2. **Admin** has advanced the session to “lobby for this game.”
- When the host opens this step, **all connected clients should auto-navigate** here (WebSocket preferred; polling fallback today in `PlayView`).
- Clear explanation for trivia (and the quote game lobby): **team answer = option chosen by the majority of phones in the team** (ties: lower option index wins — see `majorityVote.ts`).
- For **team MCQ** games (trivia + quotes), each prompt uses a **15 s** synchronized answer window and a short reveal; constants live in `src/lib/teamMcqTiming.ts` ([ARCHITECTURE.md](./ARCHITECTURE.md) §2 / §5.3).

---

## Current implementation

- **`LobbyScreen`** (`src/components/guest/LobbyScreen.tsx`) with `variant: 'trivia' | 'music_bingo' | 'identify_quote'`, wired from `PlayView` on `lobby_trivia`, `lobby_bingo`, `lobby_quotes`.
- **Music bingo** variant: individual copy (50-title pool, host plays one song at a time, **20 min** round cap after `game_bingo` starts, scoring tiers, wrong-tap penalty); no team roster. See [game-music-bingo.md](./game-music-bingo.md).
- **Countdown** after lobby schedules `game_*` via `scheduledGameStartsAtEpochMs` + `applyDueScheduledTransitions` (same pattern for all games).

---

## Data needs

From server (`PublicState`):

- Current **step** / game id.
- **`lobbyTeams`** — full roster with nicknames per team on trivia / quote lobby steps (see `getPublicState` in `src/lib/store.ts`).
- **`myTeam` / `myTeammateNicknames`** — highlight the current player’s team where relevant.

---

## TDD (required)

- **`LobbyScreen.test.tsx`**: trivia variant renders all team names and member nicknames from props; music bingo variant does not list opposing teams (or shows solo copy); empty teams edge case.
- **Store / public state tests** if extending `getPublicState`: roster shape matches what lobby needs.
- **`yarn test`** passes.

## Lint (required)

- **`yarn lint`** after tests — [ARCHITECTURE.md §12](./ARCHITECTURE.md#lint).

## Acceptance criteria

- [ ] **Tests first** for props → rendered output, then styling.
- [ ] **`yarn lint`** passes.
- [ ] One `LobbyScreen` (name TBD) with props: `variant: 'trivia' | 'music_bingo'`, `teams?`, `onReady` noop (host drives).
- [ ] Trivia variant: list **every** team and member nicknames.
- [ ] Music bingo variant: individual instructions + bingo rules copy from the product spec.
- [ ] Mobile-first lobby layout (hero, instruction cards, clear primary area).
- [ ] When admin leaves lobby (starts countdown/game), clients leave this screen without manual refresh.

---

## Files likely touched

- New `src/components/guest/LobbyScreen.tsx` (or split thin wrappers)
- `src/components/guest/PlayView.tsx` — map new server phase/step to `LobbyScreen`
- `src/lib/store.ts` / `src/types/index.ts` — extend public payload for full team roster
- `src/app/api/state/route.ts` — pass extended state

---

## Related docs

- [game-trivia-team.md](./game-trivia-team.md)
- [game-music-bingo.md](./game-music-bingo.md)
- [screen-admin.md](./screen-admin.md)
