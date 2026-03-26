# Nicola Birthday Games – Plan

## Overview

Mobile-first website (Next.js, React, Tailwind, TypeScript) for quiz/games. No auth, no database; server state in memory. Deploy on Vercel. Admin at `/admin` drives the flow; players join with nicknames and play games in sequence.

---

## Architecture

### Tech stack
- **Framework:** Next.js (App Router)
- **UI:** React 19, Tailwind CSS
- **Language:** TypeScript
- **State:** In-memory on server (API routes + module-level store). *Note: On Vercel serverless, in-memory is per-instance; for a single-event setup it’s acceptable; for multi-instance you’d need Redis/Upstash later.*
- **Deploy:** Vercel

### Data model (in-memory)

- **Players:** `{ id: string, nickname: string }` — registered on initial screen
- **Teams:** `{ id: string, name: string, playerIds: string[] }` — random, 6–7 players per team, formed when first team game starts
- **Game config:** List of games with: `id`, `name`, `type: 'individual' | 'team'`, countdown seconds (10 for individual, 60 for team)
- **Scores:** Per game: individual scores `playerId -> points` and/or team scores `teamId -> points`
- **Session state:** Current phase and current game index
  - Phases: `lobby` | `countdown` | `game` | `leaderboard` | `final_leaderboard`
  - Current game index and countdown remaining (for countdown phase)

### API (Route Handlers)

- `POST /api/players` — Register nickname, return `playerId` (and optional client token if we store in cookie/localStorage for “this device”)
- `GET /api/state` — Public state for players: phase, current game, countdown, my team (if team game), leaderboard after game, etc.
- `GET /api/admin/state` — Full state for admin (same + list of players, teams, all scores)
- `POST /api/admin/start-next` — Admin only: advance to next step (start countdown → start game → show leaderboard → next game or final leaderboard). Protected by simple secret in header or query (e.g. `?key=...`).
- `POST /api/admin/reset` — (Optional) Reset session for a new run.

Client can poll `GET /api/state` (e.g. every 2s) or we can add Server-Sent Events later for real-time.

---

## Screens & Pages

### Player-facing (mobile)

1. **`/` – Lobby / Nickname entry**
   - Input: nickname
   - Submit → register via `POST /api/players`, then stay on same page or redirect to “waiting” view
   - Show: “Waiting for host to start…” when phase is `lobby`
   - No auth; we identify by `playerId` in cookie or localStorage

2. **`/play` – Main player experience (single page, content depends on phase)**
   - **Lobby (after nickname):** “Get ready! Host will start soon.”
   - **Countdown:** Big countdown (10 or 60 seconds). If team game: show “Your team” and list of teammate nicknames.
   - **Game:** Placeholder/mock per game (e.g. “Game 1 – [Name]” with a mock UI). Real game UI to be defined later.
   - **Leaderboard (after a game):** Title “Game X – [Name]” and list of teams or players with scores (mock data for now).
   - **Final leaderboard:** “Final scores” – combined individual scores (individual game points + share of team points for team games). List of nicknames + total points.

3. **Routes**
   - `/` — Entry + nickname
   - `/play` — All post-lobby states (countdown, game, leaderboard, final). Optional: we could use `/` for everything and switch UI by phase.

### Admin

4. **`/admin` – Control panel**
   - Simple protection: e.g. query param `?key=SECRET` or env-based (no login UI).
   - Shows: current phase, current game index, list of registered players (nicknames), teams (when formed).
   - Button: **“Start next”** → `POST /api/admin/start-next`. This drives:
     - Lobby → start first game countdown
     - Countdown → start game
     - Game → end game (record mock scores), show leaderboard
     - Leaderboard → next game countdown or final leaderboard
     - Final leaderboard → optional reset or “end”
   - Optional: “Reset” button to go back to lobby and clear state.

---

## Components (high level)

### Layout
- **`MobileLayout`** — Max-width, safe area, vertical stack for phone.

### Lobby / entry
- **`NicknameForm`** — Input + submit; calls `POST /api/players`, stores `playerId` (e.g. in localStorage), then redirects or switches to waiting.
- **`WaitingLobby`** — “Waiting for host to start…” message.

### Countdown
- **`CountdownScreen`** — Receives `seconds`, `gameName`, `isTeamGame`, `teammateNicknames?`. Renders big countdown number and, if team game, list of teammates.

### Game (mock)
- **`MockGameScreen`** — Receives `gameName`, `gameIndex`. Placeholder: “Game [index]: [name]” and a “Playing…” or mock quiz placeholder. Each real game will get its own component later.

### Leaderboards
- **`GameLeaderboard`** — Receives `gameName`, `entries: { name, score }[]`, `type: 'individual' | 'team'`. Renders title and list.
- **`FinalLeaderboard`** — Receives `entries: { nickname, totalScore }[]`. Renders “Final scores” and list.

### Admin
- **`AdminPanel`** — Fetches `/api/admin/state`, shows phase, game index, players, teams; “Start next” button calling `POST /api/admin/start-next` with secret.

### Shared
- **`PhaseGate`** or **`PlayView`** — Fetches `/api/state`, switches between CountdownScreen, MockGameScreen, GameLeaderboard, FinalLeaderboard, WaitingLobby based on phase and game index.

---

## Game configuration (mock)

- Stored in code or in-memory config. Example:
  - Game 1: name TBD, individual, countdown 10s
  - Game 2: name TBD, team, countdown 60s
  - Game 3: name TBD, individual, countdown 10s
- Scoring: for now, mock scores when admin advances from game to leaderboard (e.g. random or fixed). Real scoring per game later.

---

## Flow summary

1. Players open site, enter nickname, land in lobby.
2. Admin opens `/admin?key=...`, sees players, clicks “Start next” → first game countdown (10 or 60s).
3. Players see countdown; for team game they see teammates.
4. Countdown ends (admin clicks “Start next” or auto after N seconds) → game starts; players see mock game screen.
5. Admin clicks “Start next” → game ends, mock scores recorded; players see game leaderboard.
6. Repeat 3–5 for each game.
7. After last game leaderboard, admin clicks “Start next” → final leaderboard. Individual total = sum of individual game points + (for team games) team’s score added to each member (or shared equally).
8. Optional: admin “Reset” → back to lobby, clear players/scores for a new round.

---

## File structure (target)

```
src/
  app/
    page.tsx                 # Entry: nickname form + redirect to /play
    layout.tsx
    play/
      page.tsx               # PlayView: phase-based UI
    admin/
      page.tsx               # AdminPanel (protected)
    api/
      players/
        route.ts             # POST register
      state/
        route.ts             # GET public state
      admin/
        state/
          route.ts           # GET full state
        start-next/
          route.ts           # POST advance flow
    globals.css
  components/
    MobileLayout.tsx
    NicknameForm.tsx
    WaitingLobby.tsx
    CountdownScreen.tsx
    MockGameScreen.tsx
    GameLeaderboard.tsx
    FinalLeaderboard.tsx
    AdminPanel.tsx
    PlayView.tsx
  lib/
    store.ts                 # In-memory state (players, teams, phase, scores, game config)
    gameConfig.ts            # List of games (names TBD)
  types/
    index.ts                 # Player, Team, Game, Phase, etc.
```

---

## TDD approach

- **Tests first** for:
  - Store: register player, form teams, advance phase, record scores, compute final individual scores.
  - API routes: POST /api/players, GET /api/state, POST /api/admin/start-next (with mock store).
  - Components: NicknameForm (submit), CountdownScreen (displays number and teammates), GameLeaderboard, FinalLeaderboard, AdminPanel (button and state display), PlayView (phase switching).
- Then implement to make tests pass. Game content stays mock until we define each game.

---

## Environment

- **ADMIN_SECRET** (optional): Secret for `/admin` and admin API routes. Default: `admin-secret`. Set in Vercel (or `.env`) to protect the admin panel; then open `/admin?key=YOUR_SECRET`.

---

## Out of scope (for now)

- Real game logic and UI (only mock screens).
- Authentication; admin protected by URL secret only.
- Persistence across serverless cold starts (in-memory only).
- Real-time (polling only for now).
