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

/** Mirrors server `applyDueTeamMcqRoundAdvance` so clients advance rounds in lockstep. */
export function effectiveTeamMcqSync(
  sync: TeamMcqPublicSync,
  nowMs: number
): TeamMcqPublicSync {
  let questionIndex = sync.questionIndex;
  let roundStartedAtEpochMs = sync.roundStartedAtEpochMs;
  const cycle = sync.answerMs + sync.revealMs;
  while (
    questionIndex < sync.totalQuestions - 1 &&
    nowMs >= roundStartedAtEpochMs + cycle
  ) {
    questionIndex += 1;
    roundStartedAtEpochMs += cycle;
  }
  return {
    ...sync,
    questionIndex,
    roundStartedAtEpochMs,
  };
}

export function useTeamMcqRoundPhase(sync: TeamMcqPublicSync | null): {
  phase: TeamMcqUiPhase;
  /** Whole seconds left while answering (10 … 1, then 0 at deadline). */
  secondsLeft: number;
  /** Timeline-adjusted sync (question index + round start) for binding UI. */
  activeSync: TeamMcqPublicSync | null;
} {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!sync) return;
    const bump = () => setNow(Date.now());
    const id = window.setInterval(bump, TICK_MS);
    return () => window.clearInterval(id);
  }, [sync]);

  return useMemo(() => {
    if (!sync) {
      return {
        phase: "idle" as const,
        secondsLeft: 0,
        activeSync: null,
      };
    }
    const active = effectiveTeamMcqSync(sync, now);
    const elapsed = now - active.roundStartedAtEpochMs;
    const { answerMs, revealMs } = active;

    if (elapsed < answerMs) {
      const sec = Math.max(0, Math.ceil((answerMs - elapsed) / 1000));
      return {
        phase: "answering" as const,
        secondsLeft: sec,
        activeSync: active,
      };
    }

    if (elapsed < answerMs + revealMs) {
      return {
        phase: "reveal" as const,
        secondsLeft: 0,
        activeSync: active,
      };
    }

    const isLast = active.questionIndex >= active.totalQuestions - 1;
    if (isLast) {
      return {
        phase: "awaiting_host" as const,
        secondsLeft: 0,
        activeSync: active,
      };
    }
    return {
      phase: "syncing" as const,
      secondsLeft: 0,
      activeSync: active,
    };
  }, [sync, now]);
}
