"use client";

import { Suspense, startTransition, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PlayView from "./PlayView";
import {
  getGuestPlayerIdForClient,
  getPersistedPlayerId,
  persistProtocolTestPlayerProfile,
} from "@/lib/clientStorage";
import {
  buildProtocolTestPreserveQuery,
  isProtocolTestSearchMode,
  PROTOCOL_TEST_NICKNAME_QP,
} from "@/lib/protocolTestMode";

/** Guest flow: require check-in identity, then `PlayView` (protocol + host-driven steps). */

export default function PlayPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const goHome = () => {
      const q = buildProtocolTestPreserveQuery(searchParams);
      router.replace(q ? `/?${q}` : "/");
    };

    const protocol = isProtocolTestSearchMode(
      searchParams.get("protocolTest"),
    );
    const urlNick = searchParams.get(PROTOCOL_TEST_NICKNAME_QP)?.trim() ?? "";

    startTransition(() => {
      if (!protocol) {
        if (!getPersistedPlayerId()) {
          goHome();
          return;
        }
        setAllowed(true);
        return;
      }

      if (urlNick) {
        const match = getGuestPlayerIdForClient(searchParams);
        if (match) {
          setAllowed(true);
          return;
        }
        void (async () => {
          try {
            const res = await fetch("/api/players", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ nickname: urlNick }),
              credentials: "include",
            });
            const data: { playerId?: string } = await res.json();
            if (cancelled) return;
            if (!res.ok || !data.playerId) {
              goHome();
              return;
            }
            persistProtocolTestPlayerProfile({
              playerId: data.playerId,
              nickname: urlNick,
            });
            setAllowed(true);
          } catch {
            if (!cancelled) goHome();
          }
        })();
        return;
      }

      const pid = getGuestPlayerIdForClient(searchParams);
      if (!pid) {
        goHome();
        return;
      }
      setAllowed(true);
    });

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  if (!allowed) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-zinc-500">Loading…</p>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-zinc-500">Loading…</p>
        </div>
      }
    >
      <PlayView />
    </Suspense>
  );
}
