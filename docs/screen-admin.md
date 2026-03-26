# Screen: Admin panel

**Audience:** Implementation agent (UI + APIs + optional SSE broadcast).  
**Route:** `/admin` (`src/app/admin/page.tsx`, `src/components/admin/AdminPanel.tsx`).

**Process:** **TDD**, then **`yarn lint`** — [§11](./ARCHITECTURE.md#tdd), [§12](./ARCHITECTURE.md#lint).

---

## Purpose

Host-only control surface (protected by shared **secret**, not user accounts). Shows:

- **How many players** have connected (registered).
- Current **global step** / phase / game.
- Actions to **advance** the party so every guest device moves to the correct screen.

---

## Product requirements

- **Player count** and list of nicknames (already listed today).
- Trigger **each segment:** open first lobby, start trivia, end trivia → leaderboard, open bingo lobby, start bingo, etc. The exact control model can be **one “Advance”** button (current `start-next`) or **explicit buttons** per transition; product prefers clarity for a stressed host.
- When advancing, clients should receive updates quickly — **SSE** push recommended (`ARCHITECTURE.md`).

---

## Current implementation

- Key via `?key=` or input; must match `ADMIN_SECRET` (default `admin-secret`).
- Polls `GET /api/admin/state?key=` every **1s**.
- **Start next** → `POST /api/admin/start-next?key=` → `advancePhase()` in `src/lib/store.ts`.
- Phase machine: `lobby` → `countdown` → `game` → `leaderboard` → next game or `final_leaderboard`.
- **Gap:** Six placeholder games; not mapped to the **three** real games + multiple lobbies; no SSE; no dedicated “open lobby only” vs “start game” if you split steps.

---

## Security notes

- Secret in query string is **OK for a party** but leaks in logs/referrers; prefer **header** `x-admin-key` for production hygiene (route already supports header for state).

---

## TDD (required)

- **`AdminPanel.test.tsx`**: unauthorized state, player list rendering, `Start next` triggers POST with key, error message on failure (extend existing tests).
- **API tests** for any new admin routes (`*.route.test.ts`): 401 without key, 200 shape, side effects on store (mock or isolated store if introduced).
- **SSE:** unit-test helper that formats messages; optional integration test documented if skipped.
- **`yarn test`** passes.

## Lint (required)

- **`yarn lint`** after tests — [ARCHITECTURE.md §12](./ARCHITECTURE.md#lint).

## Acceptance criteria

- [ ] **Tests first** for new admin actions and API contracts.
- [ ] **`yarn lint`** passes.
- [ ] Displays **connected player count** prominently.
- [ ] Shows **current step** in human-readable labels (not only `phase` enums).
- [ ] Advancing updates all guests within ~1s (SSE) or documents polling interval.
- [ ] Optional: **Reset session** endpoint/button for rehearsal (exists as `resetSession` in store but may need API route).
- [ ] Mobile-usable layout (host may use phone).

---

## Files likely touched

- `src/components/admin/AdminPanel.tsx`
- `src/app/api/admin/start-next/route.ts` — may accept **action** body instead of single advance
- New `src/app/api/events/route.ts` (SSE) + publisher hook from advance
- `src/lib/store.ts` — richer step machine

---

## Related docs

- [ARCHITECTURE.md](./ARCHITECTURE.md)
