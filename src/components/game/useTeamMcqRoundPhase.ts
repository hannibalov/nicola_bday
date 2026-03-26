"use client";

import { useEffect, useMemo, useState } from "react";
import type { TeamMcqPublicSync } from "@/types";

export type TeamMcqUiPhase =
  | "answering"
  | "reveal"
  | "syncing"
  | "awaiting_host"
  | "idle";

const TICK_MS = 250;

export function useTeamMcqRoundPhase(sync: TeamMcqPublicSync | null): {
  phase: TeamMcqUiPhase;
  /** Whole seconds left while answering (10 … 1, then 0 at deadline). */
  secondsLeft: number;
} {
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!sync) return;
    const bump = () => setNow(Date.now());
    const initial = window.setTimeout(bump, 0);
    const id = window.setInterval(bump, TICK_MS);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(id);
    };
  }, [sync]);

  return useMemo(() => {
    if (!sync) {
      return { phase: "idle" as const, secondsLeft: 0 };
    }
    if (now === 0) {
      return { phase: "answering" as const, secondsLeft: Math.ceil(sync.answerMs / 1000) };
    }
    const elapsed = now - sync.roundStartedAtEpochMs;
    const { answerMs, revealMs } = sync;

    if (elapsed < answerMs) {
      const sec = Math.max(0, Math.ceil((answerMs - elapsed) / 1000));
      return { phase: "answering" as const, secondsLeft: sec };
    }

    if (elapsed < answerMs + revealMs) {
      return { phase: "reveal" as const, secondsLeft: 0 };
    }

    const isLast = sync.questionIndex >= sync.totalQuestions - 1;
    if (isLast) {
      return { phase: "awaiting_host" as const, secondsLeft: 0 };
    }
    return { phase: "syncing" as const, secondsLeft: 0 };
  }, [sync, now]);
}
