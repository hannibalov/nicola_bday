"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { guestFetch } from "@/lib/guestFetch";

/** `fetch` with `x-nicola-player-id` when `protocolTest=1` (per-tab identity). */
export function useGuestApiFetch() {
  const searchParams = useSearchParams();
  return useCallback(
    (input: string, init?: RequestInit) =>
      guestFetch(input, searchParams, init),
    [searchParams],
  );
}
