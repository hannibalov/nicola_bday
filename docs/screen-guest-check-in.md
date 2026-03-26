# Screen: Guest check-in

**Audience:** Implementation agent (UI + client gating + API hook).  
**Route today:** `/` (`src/app/page.tsx` + `src/components/NicknameForm.tsx`).

**Process:** **TDD**, then **`yarn lint`** — [ARCHITECTURE.md §11](./ARCHITECTURE.md#tdd), [§12](./ARCHITECTURE.md#lint).

---

## Purpose

First screen for guests. Collect a **quirky nickname** explicitly **not** a real name. Successful submission registers the player with the server and moves them into the **post-check-in** flow (party protocol).

---

## Product requirements

- Copy and UX should nudge **fun / weird nicknames** (not legal names).
- After success: navigate to the **party protocol** path (today `/play` may show generic instructions — align with global `ARCHITECTURE.md` target steps).
- **Persistence:** Store nickname + `playerId` in **localStorage** as backup alongside the existing **`playerId` cookie** from `POST /api/players` (`src/app/api/players/route.ts`), so refresh recovery works on poor connectivity.

---

## Current implementation

- `NicknameForm` posts `{ nickname }` to `POST /api/players`, then `router.push("/play")`.
- Server sets httpOnly-style cookie via `NextResponse` (see route).
- **Gap:** No localStorage; placeholder text is generic (“Your nickname”).

---

## API / state

- **Register:** `POST /api/players` → `{ playerId }`; sets cookie `playerId`.
- Server adds player to in-memory store (`registerPlayer` in `src/lib/store.ts`).

---

## TDD (required)

- Extend **`NicknameForm.test.tsx`** (or add colocated tests): validation (empty nickname), successful submit calls `fetch` with correct body, error path from non-OK response, loading/disabled states.
- If extracting **localStorage helpers**, add **`*.test.ts`** with jsdom: keys used, values persisted after mock successful register, graceful degradation when `localStorage` throws.
- Run **`yarn test`** before completing the task.

## Lint (required)

- Run **`yarn lint`** after tests; fix all ESLint issues in files you changed. See [ARCHITECTURE.md §12](./ARCHITECTURE.md#lint).

## Acceptance criteria (for this screen)

- [ ] **Tests written first** (red) for new behavior, then implementation (green), then refactor.
- [ ] **`yarn lint`** passes on touched files.
- [ ] Visual layout: mobile-first, readable typography, safe areas, cohesive with `GuestPlayShell` / party theme.
- [ ] Explicit messaging: quirky nicknames, not real names.
- [ ] On success: `playerId` + nickname persisted in **localStorage** (namespaced key prefix per `ARCHITECTURE.md`).
- [ ] Still works if localStorage fails (cookie-only path).
- [ ] E2E: empty submit blocked; server error surfaced.

---

## Files likely touched

- `src/components/NicknameForm.tsx`
- `src/app/page.tsx` (wrap / layout only if needed)
- Optional: small `src/lib/clientStorage.ts` helper

---

## Dependencies

- Global session step model must eventually **block** `/play` game content until check-in + protocol complete (see `screen-party-protocol.md`).
