import type { GuestStep, PublicState } from "@/types";

/**
 * Browsers limit concurrent HTTP/1.1 connections per host (often 6). Each
 * `WebSocket` holds one until closed.
 *
 * `NEXT_PUBLIC_NICOLA_DISABLE_SSE=1` skips the guest PlayView WebSocket (poll
 * only) — useful for some E2E setups. The admin panel always tries WebSocket
 * first; on failure it falls back to SSE or polling (SSE is also skipped when
 * that env is set).
 */

/** Payload pushed by WebSocket connection. */
export interface WebSocketSessionPayload {
  revision: number;
  guestStep: GuestStep;
  playerCount: number;
  fullState?: PublicState;
}

/** Parse a WebSocket message string into a typed payload; returns null on parse error. */
export function parseWebSocketPayload(data: string): WebSocketSessionPayload | null {
  try {
    const parsed = JSON.parse(data) as Partial<WebSocketSessionPayload>;
    if (
      typeof parsed.revision !== "number" ||
      typeof parsed.guestStep !== "string" ||
      typeof parsed.playerCount !== "number"
    ) {
      return null;
    }
    if (parsed.fullState !== undefined && typeof parsed.fullState !== "object") {
      return null;
    }
    return parsed as WebSocketSessionPayload;
  } catch {
    return null;
  }
}

export function shouldGuestPlayViewUseWebSocket(): boolean {
  return process.env.NEXT_PUBLIC_NICOLA_DISABLE_SSE !== "1";
}

/** Admin always uses WebSocket as the primary realtime transport (guest-only env does not apply). */
export function shouldAdminPanelUseWebSocket(): boolean {
  return true;
}

export function parseSsePayload(data: string): WebSocketSessionPayload | null {
  return parseWebSocketPayload(data);
}

export const shouldAdminPanelUseEventSource = shouldAdminPanelUseWebSocket;
