/** Guest API `fetch` with cookies (session `playerId`). */
export function guestFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: init?.credentials ?? "include",
  });
}
