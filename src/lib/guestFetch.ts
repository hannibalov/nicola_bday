import {
  isProtocolTestSearchMode,
  PROTOCOL_TEST_QP,
  type SearchParamsLike,
} from "@/lib/protocolTestMode";
import { getGuestPlayerIdForClient } from "@/lib/clientStorage";
import { NICOLA_PLAYER_ID_HEADER } from "@/lib/requestPlayer";

/** Attaches `x-nicola-player-id` when `protocolTest=1` and a per-tab id is known. */
export function guestFetch(
  input: string,
  searchParams: SearchParamsLike,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (isProtocolTestSearchMode(searchParams.get(PROTOCOL_TEST_QP))) {
    const pid = getGuestPlayerIdForClient(searchParams);
    if (pid) {
      headers.set(NICOLA_PLAYER_ID_HEADER, pid);
    }
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: init?.credentials ?? "include",
  });
}
