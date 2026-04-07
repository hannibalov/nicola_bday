"use client";

import { Suspense, startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PlayView from "./PlayView";
import { getPersistedPlayerId } from "@/lib/clientStorage";

/** Guest flow: require check-in identity, then `PlayView` (protocol + host-driven steps). */

export default function PlayPageContent() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    startTransition(() => {
      if (!getPersistedPlayerId()) {
        router.replace("/");
        return;
      }
      setAllowed(true);
    });
  }, [router]);

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
