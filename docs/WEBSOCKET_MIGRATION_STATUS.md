# WebSocket & realtime delivery (reference)

This doc summarizes how **session sync** works after the migration from **SSE-only** to **WebSocket-first** on `GET /api/events`. It complements [ARCHITECTURE.md §5.2.1](./ARCHITECTURE.md#521-client-transport-sessionSyncTransport).

---

## Current architecture

| Piece | Behavior |
|-------|----------|
| **`GET /api/events`** | **Edge** route: **WebSocket** upgrade when supported, else **SSE** (`text/event-stream`). Emits JSON: `revision`, `guestStep`, `playerCount`, optionally `fullState`. Backed by **Supabase Realtime** (unique channel names per connection so concurrent streams do not clash). |
| **Guest `PlayView`** | Opens WebSocket to `ws(s)://…/api/events` when `shouldGuestPlayViewUseWebSocket()` is true. Refetches **`GET /api/state`** when revision/step changes (or when `fullState` is not enough). Fallback: SSE → adaptive **polling**. |
| **Admin `AdminPanel`** | **Always** opens WebSocket first (`shouldAdminPanelUseWebSocket()` is always `true`). Refetches **`GET /api/admin/state`** (debounced). Same fallback chain; SSE step is skipped when `NEXT_PUBLIC_NICOLA_DISABLE_SSE=1`. |
| **`src/lib/sessionSyncTransport.ts`** | `parseWebSocketPayload`, guest vs admin WebSocket flags, shared parsing for WS and SSE payloads. |
| **`src/lib/guestFetch.ts`** | Cookie-authenticated `fetch` for guest APIs (not used for `/api/events`). |

### Environment: `NEXT_PUBLIC_NICOLA_DISABLE_SSE=1`

- **Guest:** Does **not** open a WebSocket; uses **polling** only for session sync. If WebSocket were opened and failed, the SSE fallback would also be skipped in favor of polling.
- **Admin:** **Unaffected** for the primary transport — still uses WebSocket first. Only the **SSE** leg of the fallback is skipped when the env is set (goes to polling after a failed socket).

**Playwright** sets this flag in `playwright.config.ts` so guest E2E avoids WebSocket harness quirks; the admin UI still exercises WebSocket against `next start`.

---

## Tests

| File | What it covers |
|------|----------------|
| **`sessionSyncTransport.test.ts`** | Guest WebSocket on/off vs env; admin WebSocket always on; `parseWebSocketPayload` edge cases. |
| **`PlayView.test.tsx`** | Mock WebSocket, `/api/state` refresh rules, stale-player redirect. |
| **`AdminPanel.test.tsx`** | Mock WebSocket, admin state fetch, debounced refetch, advance/reset flows. |

Run **`yarn test`** and **`yarn lint`** before merging (see [ARCHITECTURE.md §11–12](./ARCHITECTURE.md#tdd)).

---

## Historical migration notes (completed)

- **`SseSessionPayload`** → **`WebSocketSessionPayload`**; **`parseSsePayload`** → **`parseWebSocketPayload`** (SSE still uses the same parser for `data:` lines).
- **`PlayView`** / **`AdminPanel`**: `EventSource` replaced with **`WebSocket`**, with **`onopen` / `onmessage` / `onerror` / `onclose`** and timeout → SSE fallback.
- **Admin** placeholder player rows use ids like `ws-${i}` when count updates without full player list.
- **`/api/events`**: `WebSocketPair()` on Edge; **`handleSSE()`** preserves prior SSE behavior.

---

## Optional follow-ups

- Extra route-level tests for WebSocket upgrade + SSE fallback if the suite still gaps edge cases.
- Confirm production/runtime behavior matches local `next start` for long-lived admin tabs (reconnect + debounced refetch).

---

## Technical notes

- WebSocket is full-duplex; the app only uses **server → client** JSON messages today.
- URL scheme: `wss:` when the page is `https:`, else `ws:`.
- Supabase shared client: Realtime **channel names** must be unique per `/api/events` connection; postgres filters on `session` / `players` unchanged.
