# Nicola Birthday Party — System Architecture

This document describes the **product flow** (from spec), the **implemented codebase**, and how server state, client persistence, and real-time updates fit together. It also records **differences from the early `PLAN.md` skeleton** now that the full guest journey is built.

**Development process:** Behavior changes **must follow TDD** and **must pass the linter** after tests — see [Section 11](#tdd) and [Section 12](#lint). Feature and screen/game briefs repeat these requirements. Shared UI building blocks are described in [Section 13](#reuse).

---

## 1. Product summary

Mobile-first web app for a birthday party: **no authentication**, **Supabase for shared state**. Two roles:

- **Guest (player):** joins with a quirky nickname, reads party info, waits for the host, then plays games in sequence with updates when the host advances the session.
- **Admin (host):** opens a protected panel, sees how many players are connected, and advances the **global guest step** so every device stays aligned.

**Connectivity constraints:** Poor network is expected. **localStorage** backs up identity and game-local state; **WebSocket** push session changes with **SSE/polling fallback** if the connection fails. The event stream carries minimal sync metadata, while `/api/state` remains the canonical full-state refresh path. State is persisted in **Supabase** to ensure consistency across Vercel serverless instances.

---

## 2. Target guest journey (canonical order)

| Step | Screen / phase | Team vs individual | Notes |
|------|----------------|-------------------|--------|
| 1 | Guest check-in | — | Ask for **quirky nicknames**, not real names. |
| 2 | Party protocol / theme | — | Visible **only after** check-in. |
| 3 | Lobby (game 1) | Team (trivia) | After 1+2 **and** admin advances to trivia lobby; **instructions** and **roster per team**. |
| 4 | Game 1: Trivia | Team | Admin starts game. **20** questions, **4** options. Topics: **UK**, **1970s**, **Barcelona**. **50** points per correct answer per question for **each** team member when the team’s **majority** choice is correct. |
| 5 | Leaderboard | — | After trivia. |
| 6 | Lobby (game 2) | Individual | Reuse lobby UI; music bingo copy. |
| 7 | Game 2: Music bingo | Individual | Random **2×3** card (**6** cells), **50** 1970s songs; host-driven play order + **15 min** auto-finish to leaderboard. **50** / **100** / **500** pts column / row / full card; wrong tile **−5**; `POST /api/game/bingo/mark` + `POST /api/game/bingo/claim`. |
| 8 | Leaderboard | — | After bingo. |
| 9 | Game 3: Who said it | Team | **New random teams** (rebuilt when entering quote countdown). **All** quotes in `quoteQuestions.json`, **4** options each, **50** points per correct team answer (same majority rule). |
| 10 | Leaderboard | — | Final standings (`leaderboard_final`). |

### 2.1 Party protocol — theme & dress (`party_protocol`)

**Theme:** Vice & Vices

> “Reality doesn’t impress me. I believe in intoxication, in ecstasy, and when ordinary life shackles me, I escape, one way or another.” — Anaïs Nin

**Dress prompt:** What’s your reality avoiding indulgence? Dress as your vice…

| Vice     | Suggestion                    |
|----------|-------------------------------|
| Lust     | Leather, lace, sexy           |
| Greed    | Gold chains, cash aesthetic   |
| Gluttony | Excess & indulgence           |
| Pride    | Over-the-top glam             |
| Sloth    | Tracksuit, onesie, PJs        |
| Envy     | Sneaky, paranoid              |
| Wrath    | Stern, black, angry           |

**Note:** The theme is a bit of dress-up fun; if it stresses you out, skip it.

**Admin:** Sees connected players and drives the **global step** via **Start next** (and optional **Reset**).

**Implementation mapping:** These steps correspond to `GuestStep` in `src/types/index.ts` (`party_protocol` → … → `leaderboard_final`), not the old `lobby` / `game` / `leaderboard` phase enum from the skeleton plan.

---

## 3. UI and styling

Guest screens live under **`src/components/guest/`**, shared chrome under **`src/components/layout/`**, the host panel under **`src/components/admin/`**, and game primitives under **`src/components/game/`**, using **React** and **Tailwind CSS 4** (fonts via `next/font`). There are no separate static HTML design dumps in the repo; treat the live components as the source of truth for layout and visuals.

---

## 4. Tech stack (current)

| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| Persistence | **Supabase** (JSONB store for session state) |
| Language | TypeScript |
| Tests | Jest, React Testing Library; Playwright for E2E (`yarn test:e2e`) |
| Lint | ESLint (Next.js config) — **mandatory green lint** before finishing a task ([Section 12](#lint)) |

---

## 5. Implementation snapshot (current)

The repository implements the **full guest sequence** above: real trivia, music bingo, identify-quote flow, party protocol, game lobbies, majority-based team scoring, WebSocket + fallback, and localStorage helpers. Server state is persisted in **Supabase** to ensure consistency across multiple serverless instances (eliminating the "unknown player" issue on Vercel).

### 5.1 Routes

| Route | Purpose |
|-------|---------|
| `/` | `guest/GuestEntryFlow` → `NicknameForm` — quirky-alias copy; `POST /api/players`; persists `playerId` + nickname via `persistPlayerProfile()`; redirects to `/play`. |
| `/play` | `guest/PlayPageContent` requires persisted `playerId` (cookie and/or localStorage), then `guest/PlayView`. |
| `/admin` | `admin/AdminPanel` — `?key=` or typed admin key (`x-admin-key` header); WebSocket + SSE/poll fallback; **Start next** and **Reset session**. |
| `/join` | Dev/QA shortcut: redirects to `/?protocolTest=1` (unlocks protocol CTA for testing). |

### 5.2 API

| Method / path | Role |
|---------------|------|
| `POST /api/players` | Register nickname; response includes `playerId`; **httpOnly `playerId` cookie** set by server. |
| `GET /api/state` | **`PublicState`** for the current cookie’s player: `guestStep`, revision, game, teams/lobby, leaderboards, vote snapshots; during bingo, `myBingoMarkedCells`, `myBingoClaimedLineKeys`, `myBingoScore`, `bingoRoundEndsAtEpochMs`. |
| `GET /api/events` | **WebSocket** (primary) with **SSE** (`text/event-stream`) fallback: pushes `revision`, `guestStep`, and `playerCount` on change; initial event on connect. Clients refresh `/api/state` as needed to fetch the full session payload. |
| `POST /api/game/trivia/vote` | Submit trivia option per question (active in `game_trivia` only). |
| `POST /api/game/quotes/vote` | Submit quote option per question (active in `game_quotes` only). |
| `POST /api/game/bingo/mark` | Toggle a cell vs. server “now playing” title; apply **−5** if the tile does not match. |
| `POST /api/game/bingo/claim` | Claim completed line keys + optional full card (requires server marks); awards **50** / **100** / **500** per new column / row / full card. |
| `POST /api/admin/bingo-advance-song` | Host: advance to next title in the shuffled pool. |
| `GET /api/admin/state` | Full **`SessionState`** if `x-admin-key` matches `ADMIN_SECRET`. |
| `POST /api/admin/start-next` | Advances **`guestStep`** to the next step in `GUEST_STEP_SEQUENCE`; runs transition side effects (teams, scores, countdown seed). |
| `POST /api/admin/reset` | Clears session to initial `party_protocol` state. |

**Real-time:** `PlayView` and `AdminPanel` open **WebSocket** connection to `/api/events` and use message payloads as update notifications; when a pushed revision or guest step changes, the client refetches `/api/state` for the full session state. On error they close the connection and fall back to SSE or polling (adaptive interval). The WebSocket implementation uses Supabase realtime subscriptions, allowing it to work reliably across multiple Vercel Lambda instances.

<a id="server-state"></a>

### 5.3 Server state (`src/lib/store.ts`)

- Persisted in **Supabase** (`session` table) as the authoritative session row.
- **Async store:** All store access and mutation functions are `async` and perform `getStoreState` (select) and `commitState` (upsert) operations.
- **Step model:** `guestStep: GuestStep` with ordered transitions via `getNextGuestStep()`; initial step **`party_protocol`**.
- **Teams:** `rebuildTeams()` runs when entering **`lobby_trivia`** and again when entering **`countdown_quotes`** so quote teams are **independent** from trivia teams. Chunk size **7** players per team (`Team 1`, …).
- **Games:** `src/lib/gameConfig.ts` — three games: team trivia, music bingo, team quotes (`GAMES[0]…[2]`).
- **Scoring:**
  - Trivia & quotes: `computeTriviaScoresFromVotes` + `majorityVote` / `teamChoiceMatchesCorrect` — **50** points per question when the team majority matches `correctIndex`; plurality tie-break uses **lower option index** (`pluralityWinner`).
  - Bingo: shuffled `bingoSongOrder`, **15 min** `bingoRoundEndsAtEpochMs` → auto `leaderboard_post_bingo`; `markBingoCell` vs. current title; `claimBingo` adds **50** / **100** / **500** per new column / row / `full` (all cells marked on server).
  - Round scores persisted when entering each leaderboard / final step via `recordRoundScoresForCompletedGame`.
- **Revision:** Incremented on advancing step, bingo marks, bingo claims, and host “next song”; exposed to clients for sync.
- **Countdown:** `countdownRemaining` is set when **entering** a `countdown_*` step; the **UI** (`CountdownScreen`) runs a local ticking timer. The server does **not** auto-advance when it hits zero — the **host** advances to the game step. (Product copy can still say “get ready”; technically it is host-gated.)

### 5.4 Content modules

| Content | Location |
|---------|----------|
| Trivia (20 × 4 options, topics UK / 1970s / Barcelona) | `src/content/trivia.ts` |
| Bingo pool (50 titles) | `src/content/bingo.ts`; round timer + playlist in `store` + `bingoRound.ts`; card seeded in `bingoCard.ts` |
| Quotes (N × 4 from JSON) | `src/lib/content/quoteQuestions.json` + `quoteContent.ts` |

### 5.5 Client persistence (`src/lib/clientStorage.ts`)

| Mechanism | What’s stored |
|-----------|----------------|
| Cookie `playerId` | Set by server on register. |
| localStorage `nicola-bday:playerId` / `nickname` | Mirror for recovery; `getPersistedPlayerId()` merges cookie + LS. |
| `nicola-bday:lastKnownStep` | `{ step, revision, at }` on each `/api/state` sync. |
| `nicola-bday:party-protocol-complete` | Gates repeating party protocol after refresh. |
| `nicola-bday:triviaAnswers`, `nicola-bday:bingo`, `nicola-bday:quoteVotes` | Offline / refresh resilience for game UIs (see game briefs). |

### 5.6 UI components (high level)

- **`layout/MobileLayout`** / **`layout/GuestPlayShell`** — mobile shells.
- **`guest/NicknameForm`** — check-in with quirky copy + `PrimaryActionButton`.
- **`guest/PlayPageContent`** — redirect to `/` if no persisted player id.
- **`guest/PlayView`** — switches on **`guestStep`**: `PartyProtocolScreen`, `LobbyScreen` (trivia / music_bingo), `CountdownScreen`, `TriviaGameScreen`, `MusicBingoScreen`, `IdentifyQuoteGameScreen`, `GameLeaderboard`, `FinalLeaderboard`, `WaitingLobby`.
- **`admin/AdminPanel`** — full session dump, next-step preview labels, start-next + reset; during `game_bingo`, **now playing** + **advance song**.
- **Shared game UI** under `src/components/game/`: `MultipleChoicePanel`, `QuestionProgress`, `TeamMajorityExplainer`, `PrimaryActionButton`, etc.

**Legacy:** `guest/MockGameScreen.tsx` remains in the repo but is **not** used by `PlayView` (replaced by real game screens).

---

## 6. Residual gaps, spec nuances, and plan drift

### 6.1 Small product / UX nuances

| Topic | Detail |
|-------|--------|
| Countdown vs host | Countdown is **visual** on the client; **advancement** to the game is **manual** via admin “Start next,” not automatic when the timer reaches 0. |
| Deploy scale-out | State is shared via Supabase. WebSocket/SSE updates are delivered through Supabase realtime subscriptions, making it scale-out safe. |
| Team size | Implementation uses **7** players per chunk; spec said ~6–7 — acceptable fixed choice. |
| Empty / partial team votes | Majority logic only awards points when a team choice is resolved and matches correct; edge cases are covered in `majorityVote` / trivia scoring tests. |

### 6.2 Compared to `PLAN.md` (original skeleton)

`PLAN.md` described the **first iteration**: coarse **phases** (`lobby` → `countdown` → `game` → `leaderboard` → `final_leaderboard`), **mock** games, **polling only**, and “real game logic out of scope.”

| `PLAN.md` assumption | Actual implementation |
|---------------------|------------------------|
| Phase + game index | Explicit **`GuestStep`** sequence matching product order (protocol, per-game lobby + countdown + game + leaderboard, final). |
| Mock sounds + random scores | **Real** trivia/bingo/quote UIs; scoring from votes, bingo claims, and content `correctIndex`. |
| Poll only | **`GET /api/events`** WebSocket (primary) + **SSE + poll fallback** on connection error. |
| Game line-up TBD | **Three** games in `gameConfig.ts` aligned with spec (trivia, bingo, quotes). |
| Optional `POST /api/admin/reset` | **Implemented.** |
| `InstructionsScreen` + sessionStorage gate | **Removed** from flow; **party protocol** is `PartyProtocolScreen` + localStorage `party-protocol-complete`. |

The **file layout** in `PLAN.md` is outdated; use [Section 8](#8-repository-map-implementation) below.

---

## 7. Evolution notes (scale, polish)

### 7.1 Session model

The **`GuestStep`** approach ([Section 5.3](#server-state)) is the canonical model going forward. Extending the party (e.g. extra mini-game) means inserting steps into `GUEST_STEP_SEQUENCE` and wiring `PlayView` + transition effects.

### 7.2 Client cache and first-load prefetch

localStorage keys are centralized in `clientStorage.ts`. On load: hydrate from localStorage, then **fetch** `/api/state`; if the server **revision** is ahead, game briefs describe dropping stale local round data.

**Route prefetch:** When the guest reaches the nickname check-in (party protocol already done for this device, or they just completed it on `/`), `GuestEntryFlow` calls `router.prefetch("/play")` so the App Router loads `/play`’s RSC payload and client chunks in the background. That reduces the chance of a heavy download exactly when they tap “Join the party” and helps on congested Wi‑Fi. It does **not** remove the need for `/api/state`, WebSocket/SSE fallback, or vote POSTs during play.

**Production HTTP cache:** [`next.config.ts`](../next.config.ts) sets long-lived `Cache-Control` in **production** only for `/_next/static/*` (immutable, fingerprinted assets) and `/images/*` so repeat visits and reloads reuse JS/CSS/fonts and party images without hammering the origin.

- Today: The `/api/events` handler uses Supabase realtime subscriptions for session and player updates, sending JSON over WebSocket or SSE. If the WebSocket upgrade fails, the client can fall back to SSE; if the stream closes, the UI falls back to polling.
- Benefit: This works across any number of serverless instances without needing a separate Pub/Sub service like Redis.

### 7.4 Team majority voting

Implemented in `src/lib/majorityVote.ts` and `triviaScoring.ts` (reused for quotes). Music bingo: line keys in `bingoLine.ts`.

### 7.5 Content as data

Trivia TS module, bingo TS array, quotes JSON — all validated / typed in loaders.

---

## 8. Repository map (implementation)

```
src/
  app/
    page.tsx                    # Guest check-in (guest/GuestEntryFlow)
    layout.tsx
    join/page.tsx               # redirect → /?protocolTest=1
    play/page.tsx               # guest/PlayPageContent → guest/PlayView
    admin/page.tsx              # admin/AdminPanel
    api/
      players/route.ts
      state/route.ts
      events/route.ts           # WebSocket (primary) + SSE fallback
      game/
        trivia/vote/route.ts
        quotes/vote/route.ts
        bingo/claim/route.ts
        bingo/mark/route.ts
      admin/
        state/route.ts
        start-next/route.ts
        reset/route.ts
        bingo-advance-song/route.ts
  components/
    layout/
      MobileLayout.tsx
      GuestPlayShell.tsx
    guest/
      GuestEntryFlow.tsx        # home: nickname → party protocol
      NicknameForm.tsx
      PlayPageContent.tsx
      PlayView.tsx
      WaitingLobby.tsx
      PartyProtocolScreen.tsx
      LobbyScreen.tsx
      CountdownScreen.tsx
      TriviaGameScreen.tsx
      MusicBingoScreen.tsx
      IdentifyQuoteGameScreen.tsx
      GameLeaderboard.tsx
      FinalLeaderboard.tsx
      MockGameScreen.tsx        # legacy, unused by PlayView
    admin/
      AdminPanel.tsx
    game/
      MultipleChoicePanel.tsx
      QuestionProgress.tsx
      TeamMajorityExplainer.tsx
      PrimaryActionButton.tsx
  content/
    trivia.ts
    bingo.ts
  lib/
    store.ts
    gameConfig.ts
    sessionNotify.ts
    sseFormat.ts
    clientStorage.ts
    bingoLine.ts
    bingoCard.ts
    bingoRound.ts
    majorityVote.ts
    triviaScoring.ts
    quoteContent.ts
    leaderboardSort.ts
    guestStepLabels.ts
    content/quoteQuestions.json
  types/index.ts
e2e/                            # Playwright specs + helpers
```

---

## 9. Agent-oriented docs

Detailed briefs for parallel work. **Each brief includes mandatory `## TDD (required)` and `## Lint (required)` sections** and links to [Section 11](#tdd) / [Section 12](#lint). Before adding new game UI, read [Section 13](#reuse) and **extend shared pieces** instead of copying screens.

| Doc | Focus |
|-----|--------|
| [screen-guest-check-in.md](./screen-guest-check-in.md) | Check-in UX and gating |
| [screen-party-protocol.md](./screen-party-protocol.md) | Post-check-in protocol screen |
| [screen-lobby.md](./screen-lobby.md) | Lobby + instructions (both games) |
| [screen-leaderboard.md](./screen-leaderboard.md) | Leaderboard between rounds |
| [screen-admin.md](./screen-admin.md) | Host control panel |
| [game-trivia-team.md](./game-trivia-team.md) | Team trivia (majority, scoring) |
| [game-music-bingo.md](./game-music-bingo.md) | Music bingo: 50-title pool, host playlist, marks/claims, 15 min round, scoring |
| [game-identify-quote-team.md](./game-identify-quote-team.md) | Team quotes + new teams |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | Normalized database structure & SQL |

---

## 10. Environment

- **`ADMIN_SECRET`** — protects admin API and panel (default `admin-secret`).
- **`NEXT_PUBLIC_SUPABASE_URL`** — your Supabase project URL.
- **`SUPABASE_SECRET_KEY`** — your Supabase **service_role** key (bypasses RLS).

---

<a id="tdd"></a>

## 11. Testing & TDD (required)

Implementation **must** use **test-driven development**:

1. **Write a failing test first** that specifies the desired behavior (red).
2. **Implement the minimum code** to pass (green).
3. **Refactor** with tests staying green.

Do **not** add new logic without tests that would fail if that logic were wrong or missing. For bug fixes, add a regression test that fails on the old behavior, then fix.

### What to test by layer

| Layer | Tooling | Examples |
|-------|---------|----------|
| Pure domain logic | Jest | Majority vote, bingo lines, card generation, scoring, guest step helpers |
| Server store | Jest | `src/lib/store.ts`, `store.test.ts` |
| HTTP route handlers | Jest + `Request`/`Response` mocks | `src/app/api/**/route.test.ts` |
| React components | Jest + RTL | `*.test.tsx` beside components |
| Client persistence | Jest (jsdom) | `clientStorage.test.ts` |
| End-to-end | Playwright | `e2e/*.spec.ts` — happy path and edge cases |

SSE: `sseFormat.test.ts` and route tests where full streams are awkward; document intentional gaps.

### Running tests

- **`yarn test`** must pass before considering a feature done.
- **`yarn test:e2e`** for Playwright (see `playwright.config.ts`).

### Existing coverage

Unit and integration tests cover store, API routes, domain libs, and major components. E2E covers multi-player and admin flows. New work should **extend** the same patterns.

### Agent / contributor checklist

- [ ] Tests added or updated **before** or **in the same PR step as** the implementation they assert.
- [ ] `yarn test` passes locally.
- [ ] New domain rules have **focused unit tests**.

---

<a id="lint"></a>

## 12. Lint (required)

After **`yarn test`** passes, **`yarn lint`** must pass with **no errors** (and no new avoidable warnings in touched files).

1. Run **`yarn lint`** from the repo root (ESLint via `eslint-config-next`).
2. Fix reported issues in **your** changes; avoid broad rule disables.
3. Gate today is **`yarn lint`** only (no separate Prettier gate unless added).

### Agent / contributor checklist (lint)

- [ ] `yarn lint` passes locally **after** tests.
- [ ] No unrelated files “fixed” just to silence lint unless agreed.

---

<a id="reuse"></a>

## 13. Shared components & reuse (games and screens)

Goal: **one implementation** for patterns that appear on multiple flows. Game-specific screens under `src/components/guest/` stay **thin**; primitives live under `src/components/game/`; layout chrome under `src/components/layout/`.

### 13.1 In the repo (use and extend)

| Piece | Path | Reuse |
|-------|------|--------|
| Mobile shell | `layout/MobileLayout.tsx`, `layout/GuestPlayShell.tsx` | Guest full-screen chrome. |
| Play orchestration | `guest/PlayView.tsx` | Single place for fetch + SSE + `guestStep` routing. |
| Party protocol | `guest/PartyProtocolScreen.tsx` | Post-check-in theme/rules. |
| Lobby | `guest/LobbyScreen.tsx` | `variant`: `trivia` \| `music_bingo`; trivia shows `teams` roster. |
| Countdown | `guest/CountdownScreen.tsx` | Game name, team list, local timer display. |
| Trivia / quotes | `guest/TriviaGameScreen.tsx`, `guest/IdentifyQuoteGameScreen.tsx` | MCQ flows using shared game components. |
| Bingo | `guest/MusicBingoScreen.tsx` | 2×3 grid; mark/claim APIs; countdown; `bingoCard` / `bingoLine` / `bingoRound`. |
| Mid-event leaderboard | `guest/GameLeaderboard.tsx` | Per-round scores (`individual` \| `team`). |
| Final totals | `guest/FinalLeaderboard.tsx` | Cumulative standings. |
| Waiting copy | `guest/WaitingLobby.tsx` | Host-driven waits. |
| Check-in flow | `guest/GuestEntryFlow.tsx`, `guest/NicknameForm.tsx` | Home route; quirky alias + API register. |
| MCQ / progress / explainer | `components/game/*` | `MultipleChoicePanel`, `QuestionProgress`, `TeamMajorityExplainer`, `PrimaryActionButton` |

### 13.2 Domain logic (shared, not UI)

| Module | Responsibility |
|--------|----------------|
| `majorityVote.ts` | Plurality + tie-break; used by trivia and quotes scoring. |
| `triviaScoring.ts` | Per-question team scoring; reused for quotes via `computeTriviaScoresFromVotes`. |
| `bingoLine.ts` / `bingoCard.ts` / `bingoRound.ts` | Lines, points, card generation, round duration & wrong-tap penalty. |
| `leaderboardSort.ts` | Consistent ordering for displays. |

### 13.3 Folder convention

```
src/components/
  layout/         # MobileLayout, GuestPlayShell
  guest/          # Check-in, play shell routing, lobbies, games, leaderboards (player-facing)
  admin/          # AdminPanel
  game/           # MultipleChoicePanel, TeamMajorityExplainer, …
```

**Rule for agents:** Before adding a second copy of “four answers + prompt” or “team voting explainer,” **extend** `src/components/game/`, **add tests**, and import from both games.
