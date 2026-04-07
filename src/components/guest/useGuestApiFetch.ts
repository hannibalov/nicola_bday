"use client";

import { useCallback } from "react";
import { guestFetch } from "@/lib/guestFetch";

/** Authenticated guest `fetch` (cookies). */
export function useGuestApiFetch() {
  return useCallback((input: string, init?: RequestInit) => guestFetch(input, init), []);
}
