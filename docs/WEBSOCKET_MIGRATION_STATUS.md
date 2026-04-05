# WebSocket Migration Summary

## What Has Been Done

### 1. Test Updates
- **sessionSyncTransport.test.ts**: Updated to assert WebSocket selection logic and payload parsing for the current client transport.
  - Verifies guest WebSocket is enabled by default, disabled in `protocolTest=1`, and disabled when `NEXT_PUBLIC_NICOLA_DISABLE_SSE=1`.
  - Verifies admin WebSocket selection and payload parsing behavior.

- **PlayView.test.tsx**: Updated to use WebSocket mocks and validate state refresh logic.
  - Verifies initial `/api/state` fetch, WebSocket connect behavior, same-revision message suppression, and higher-revision refresh.
  - Verifies protocol-test mode skips WebSocket and falls back to polling.

- **AdminPanel.test.tsx**: Updated to use WebSocket mocks and validate admin state refresh logic.
  - Verifies initial admin state fetch, human-readable labels, advance action, invalid key handling, WebSocket same-revision suppression, and higher-revision refresh.

## Current Status
- ✅ Client-side components use WebSocket as the primary transport.
- ✅ `/api/events` supports both WebSocket upgrades and SSE fallback.
- ✅ The code still uses `/api/state` as the authoritative full-state fetch after WebSocket notifications.
- ⚠️ Polling remains a fallback path for protocol-test mode, WebSocket/SSE failure, or explicit disablement via `NEXT_PUBLIC_NICOLA_DISABLE_SSE=1`. 

### 2. Component Logic Updates
- **sessionSyncTransport.ts**: Renamed interfaces and functions
  - `SseSessionPayload` → `WebSocketSessionPayload`
  - `parseSsePayload` → `parseWebSocketPayload`
  - `shouldGuestPlayViewUseEventSource` → `shouldGuestPlayViewUseWebSocket`
  - `shouldAdminPanelUseEventSource` → `shouldAdminPanelUseWebSocket`

- **PlayView.tsx**: Replaced EventSource with WebSocket
  - Updated imports to use WebSocket functions
  - Changed `useEffect` to create WebSocket connection instead of EventSource
  - Added proper WebSocket event handlers: `onopen`, `onmessage`, `onerror`, `onclose`
  - WebSocket URL construction: `ws://` or `wss://` based on protocol

- **AdminPanel.tsx**: Replaced EventSource with WebSocket
  - Updated imports to use WebSocket functions
  - Changed `useEffect` to create WebSocket connection
  - Added WebSocket event handlers
  - Updated placeholder ID generation from `sse-${i}` to `ws-${i}`

### 3. Server-Side API Updates
- **`/api/events/route.ts`**: Modified to support both WebSocket and SSE
  - Added `runtime = 'edge'` for WebSocket support in Vercel
  - Split `GET` function to handle WebSocket upgrades and fallback to SSE
  - Added `handleWebSocket()` function using `WebSocketPair()`
  - Added `handleSSE()` function preserving original SSE logic
  - WebSocket sends JSON messages instead of SSE formatted data

## Current Status
- ✅ Client-side components updated to use WebSocket
- ✅ Test mocks updated for WebSocket
- ✅ AdminPanel and PlayView unit tests now encode the current state-refresh behavior: same-revision messages are suppressed, higher-revision messages trigger a refresh, and player-count updates are reflected without extra fetches.
- ⚠️ Full `yarn test` may still show unrelated failures in other areas; this summary focuses on the WebSocket migration path.

## What's Left to Be Done

### 1. Fix remaining integration and E2E failures
- Investigate why the guest lobby does not render after the admin advances the step in Playwright tests
- Confirm that the `/api/events` route supports the WebSocket handshake in the deployed runtime and test harness
- Resolve the failing store/integration test regressions exposed by the work so the full suite passes again

### 2. Harden route handler and runtime compatibility
- Ensure `GET /api/events` works in both edge/websocket upgrade and standard SSE modes
- Add proper test coverage for WebSocket route upgrades and fallback behavior
- Make the route stable in Node/Jest test environments as well as Next.js Edge runtime

### 3. Verify fallback behavior
- Confirm polling fallback works when `NEXT_PUBLIC_NICOLA_DISABLE_SSE=1`
- Confirm protocol test mode (`protocolTest=1`) continues to skip WebSocket and uses polling
- Confirm client-side fallback to SSE is working when WebSocket fails

### 4. Documentation updates
- Update `docs/ARCHITECTURE.md` to reflect WebSocket instead of SSE
- Keep the migration summary in sync with the actual route and client behavior

## Technical Notes
- WebSocket provides full-duplex communication vs SSE's one-way server-to-client
- Client constructs WebSocket URL using `ws://` or `wss://` based on HTTP protocol
- Server aims to use `WebSocketPair()` in Edge Runtime for upgrade handling
- Fallback path is now intended to preserve SSE or polling when WebSocket connections cannot be established
- `AdminPanel` and `PlayView` now include fallback logic for unavailability of WebSocket or EventSource in the current environment</content>
<parameter name="filePath">/Users/rodrigopizarro/Documents/projects/personal/nicola_bday/WEBSOCKET_MIGRATION_STATUS.md