"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Fire vote POSTs without blocking the UI; flush outstanding requests on unmount
 * (e.g. host advances to leaderboard).
 */
export function useTeamMcqBackgroundVotes(
  postVote: (questionId: string, optionIndex: number) => Promise<boolean>
): (questionId: string, optionIndex: number) => void {
  const pendingRef = useRef<Promise<unknown>[]>([]);

  const enqueue = useCallback(
    (questionId: string, optionIndex: number) => {
      const p = postVote(questionId, optionIndex);
      pendingRef.current.push(p);
    },
    [postVote]
  );

  useEffect(
    () => () => {
      void Promise.all(pendingRef.current);
    },
    []
  );

  return enqueue;
}
