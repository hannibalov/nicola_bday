/**
 * QA / dev: `/?protocolTest=1` bypasses the party-protocol date gate; optional
 * `nickname` skips the nickname form after protocol. Preserve these params on
 * client redirects so refreshes and stale-session handling stay in test mode.
 */

export const PROTOCOL_TEST_QP = "protocolTest" as const;
export const PROTOCOL_TEST_NICKNAME_QP = "nickname" as const;

/** `URLSearchParams` and Next.js `useSearchParams()` return type. */
export type SearchParamsLike = { get(name: string): string | null };

export function isProtocolTestSearchMode(
  protocolTest: string | null | undefined,
): boolean {
  return protocolTest === "1";
}

/** Query string to append after `?`, or "" if not in protocol test mode. */
export function buildProtocolTestPreserveQuery(
  searchParams: SearchParamsLike,
): string {
  if (!isProtocolTestSearchMode(searchParams.get(PROTOCOL_TEST_QP))) {
    return "";
  }
  const out = new URLSearchParams();
  out.set(PROTOCOL_TEST_QP, "1");
  const nickname = searchParams.get(PROTOCOL_TEST_NICKNAME_QP)?.trim();
  if (nickname) {
    out.set(PROTOCOL_TEST_NICKNAME_QP, nickname);
  }
  return out.toString();
}

export function withProtocolTestQuery(
  path: string,
  searchParams: SearchParamsLike,
): string {
  const q = buildProtocolTestPreserveQuery(searchParams);
  return q ? `${path}?${q}` : path;
}
