/**
 * Resolve guest player id from the incoming request. In development, test, or
 * when NICOLA_PROTOCOL_TEST_API=1, `x-nicola-player-id` wins over the cookie
 * (useful for multi-tab API testing).
 */

export const NICOLA_PLAYER_ID_HEADER = "x-nicola-player-id";

export function protocolTestApiAcceptsPlayerIdHeader(): boolean {
  return (
    process.env.NICOLA_PROTOCOL_TEST_API === "1" ||
    process.env.NODE_ENV === "development" ||
    process.env.NODE_ENV === "test"
  );
}

function parseCookieValue(
  cookieHeader: string | null,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(`${name}=`)) {
      const raw = p.slice(name.length + 1).trim();
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return null;
}

export function resolvePlayerIdFromRequest(request: Request): string | null {
  if (protocolTestApiAcceptsPlayerIdHeader()) {
    const fromHeader = request.headers.get(NICOLA_PLAYER_ID_HEADER)?.trim();
    if (fromHeader) return fromHeader;
  }
  const cookieHeader = request.headers.get("cookie");
  return parseCookieValue(cookieHeader, "playerId");
}
