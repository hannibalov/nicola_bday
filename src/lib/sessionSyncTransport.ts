import {
  isProtocolTestSearchMode,
  PROTOCOL_TEST_QP,
  type SearchParamsLike,
} from "./protocolTestMode";
import type { GuestStep } from "@/types";

/**
 * Browsers limit concurrent HTTP/1.1 connections per host (often 6). Each
 * `WebSocket` holds one until closed, so many `/play` tabs can block the next
 * tab's `fetch` (e.g. register player). Protocol-test QA uses many tabs; poll
 * instead of WebSocket there. Set `NEXT_PUBLIC_NICOLA_DISABLE_SSE=1` to force polling
 * for normal guests and the admin panel too.
 */

/** Payload pushed by WebSocket connection. */
export interface WebSocketSessionPayload {
  revision: number;
  guestStep: GuestStep;
  playerCount: number;
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
    return parsed as WebSocketSessionPayload;
  } catch {
    return null;
  }
}

export function shouldGuestPlayViewUseWebSocket(
  searchParams: SearchParamsLike,
): boolean {
  if (process.env.NEXT_PUBLIC_NICOLA_DISABLE_SSE === "1") {
    return false;
  }
  if (isProtocolTestSearchMode(searchParams.get(PROTOCOL_TEST_QP))) {
    return false;
  }
  return true;
}

export function shouldAdminPanelUseWebSocket(): boolean {
  return process.env.NEXT_PUBLIC_NICOLA_DISABLE_SSE !== "1";
}

export function parseSsePayload(data: string): WebSocketSessionPayload | null {
  return parseWebSocketPayload(data);
}

export const shouldAdminPanelUseEventSource = shouldAdminPanelUseWebSocket;
