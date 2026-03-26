# Screen: Party protocol / theme

**Audience:** Implementation agent (UI + gating).  
**Route target:** After check-in, before any host-controlled lobby.  
**Design reference:** `stitch_birthday_trivia_individual_game/party_protocol_theme/code.html`

**Process:** **TDD**, then **`yarn lint`** — [§11](./ARCHITECTURE.md#tdd), [§12](./ARCHITECTURE.md#lint).

---

## Purpose

Show party rules, theme, or “how the evening works” in a **dedicated** full-screen experience. This screen is visible **only after** the guest has completed **guest check-in** (registered nickname / has `playerId`).

---

## Product requirements

- **Gating:** If no `playerId` (cookie or localStorage backup), redirect to `/` or check-in.
- Visible **once per device** or repeatable per product decision; prefer **localStorage flag** (not only `sessionStorage`) so refresh on bad network does not force re-read — or derive from “has completed protocol” boolean stored locally.
- Content: static or lightly configurable (Markdown-like sections or JSX); match Stitch reference for hierarchy and tone.

---

## Current implementation

- `src/components/InstructionsScreen.tsx` shows **generic** instructions and uses **`sessionStorage`** key `nicola-games-instructions-seen`.
- **Gap:** Not the Stitch party protocol design; not tied to check-in order as a distinct **server step**; lost on new session tab if sessionStorage-only.

---

## Server vs client gating

**Option A (client-only gate):** Check-in sets flags in localStorage; protocol screen reads them. Host does not need to track “read protocol” on server.

**Option B (server step):** Add `party_protocol` to session step enum; admin still drives game flow separately. Use when you need host visibility (“everyone past protocol”).

For poor connectivity, **Option A + localStorage** is simplest; sync with server later if needed.

---

## TDD (required)

- **`PartyProtocolScreen.test.tsx`** (or equivalent): without `playerId`, continue is blocked or redirect is triggered (mock `next/navigation` if used); after continue, localStorage flag is set; when flag set, screen is skipped.
- **`PlayPageContent` integration tests** if routing order changes: order check-in → protocol → play.
- **`yarn test`** passes.

## Lint (required)

- **`yarn lint`** after tests — [ARCHITECTURE.md §12](./ARCHITECTURE.md#lint).

## Acceptance criteria

- [ ] **Tests first** for gating and persistence, then UI implementation.
- [ ] **`yarn lint`** passes.
- [ ] Full-screen UI aligned with Stitch `party_protocol_theme` reference.
- [ ] Only reachable after successful registration (`playerId` present).
- [ ] “Continue” stores completion in **localStorage** so refresh skips re-read unless you intentionally want “always show.”
- [ ] After continue: land on “waiting for host / lobby locked” state until admin opens first lobby (see `screen-lobby.md`).

---

## Files likely touched

- New component e.g. `src/components/PartyProtocolScreen.tsx`
- `src/components/PlayPageContent.tsx` (order: protocol before `PlayView` or waiting)
- Possibly remove or repurpose `InstructionsScreen.tsx`

---

## Related docs

- [screen-guest-check-in.md](./screen-guest-check-in.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md) — target guest journey
