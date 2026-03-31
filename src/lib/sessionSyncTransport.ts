import {
  isProtocolTestSearchMode,
  PROTOCOL_TEST_QP,
  type SearchParamsLike,
} from "./protocolTestMode";

/**
 * Browsers limit concurrent HTTP/1.1 connections per host (often 6). Each
 * `EventSource` holds one until closed, so many `/play` tabs can block the next
 * tab’s `fetch` (e.g. register player). Protocol-test QA uses many tabs; poll
 * instead of SSE there. Set `NEXT_PUBLIC_NICOLA_DISABLE_SSE=1` to force polling
 * for normal guests and the admin panel too.
 */

export function shouldGuestPlayViewUseEventSource(
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

export function shouldAdminPanelUseEventSource(): boolean {
  return process.env.NEXT_PUBLIC_NICOLA_DISABLE_SSE !== "1";
}
