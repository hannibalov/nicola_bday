# Screen: Lobby (instructions + roster)

**Audience:** Implementation agent (UI + data wiring).  
**Design reference:** `stitch_birthday_trivia_individual_game_lobby/code.html`

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
- When the host opens this step, **all connected clients should auto-navigate** here (SSE preferred; polling fallback today in `PlayView`).
- Clear explanation for trivia: **team answer = option chosen by the majority of phones in the team** (ties need a defined rule).

---

## Current implementation

- No dedicated lobby; `WaitingLobby` is only “Waiting for host to start…” during server `lobby` phase.
- `CountdownScreen` shows teammates during **team** countdown, not a full lobby with instructions + roster.
- **Gap:** Stitch lobby layout not implemented; admin cannot distinguish “lobby for game 1” vs “in game” without extending session model.

---

## Data needs

From server (`PublicState` or extended):

- Current **step** / game id.
- For team lobby: **teams** with **player nicknames** (not only `myTeammateNicknames` for current user — need full roster or per-team lists).

Today `getPublicState` only exposes the **current player’s** team and teammate nicknames. Lobby likely needs **`teams: { name, nicknames[] }[]`** or similar for all guests.

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
- [ ] Music bingo variant: individual instructions + reference to `music_bingo_rules` copy/design.
- [ ] Styled per Stitch lobby reference (hero, cards, CTA area).
- [ ] When admin leaves lobby (starts countdown/game), clients leave this screen without manual refresh.

---

## Files likely touched

- New `src/components/LobbyScreen.tsx` (or split thin wrappers)
- `src/components/PlayView.tsx` — map new server phase/step to `LobbyScreen`
- `src/lib/store.ts` / `src/types/index.ts` — extend public payload for full team roster
- `src/app/api/state/route.ts` — pass extended state

---

## Related docs

- [game-trivia-team.md](./game-trivia-team.md)
- [game-music-bingo.md](./game-music-bingo.md)
- [screen-admin.md](./screen-admin.md)
