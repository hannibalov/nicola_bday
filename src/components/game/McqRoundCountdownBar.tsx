"use client";

import type { TeamMcqUiPhase } from "./useTeamMcqRoundPhase";

type Props = {
  phase: TeamMcqUiPhase;
  secondsLeft: number;
};

export default function McqRoundCountdownBar({ phase, secondsLeft }: Props) {
  if (phase === "idle") return null;

  let label: string;
  if (phase === "answering") {
    label =
      secondsLeft > 0 ? `${secondsLeft}s` : "Time’s up — showing the answer…";
  } else if (phase === "reveal") {
    label = "Answer revealed";
  } else if (phase === "syncing") {
    label = "Next question…";
  } else {
    label = "Round complete — wait for the host";
  }

  return (
    <div
      className="rounded-2xl border border-[#e5dcc9] bg-[#f8f0e0] px-4 py-3 text-center"
      data-test-id="mcq-round-countdown"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#605b50]">
        {phase === "answering"
          ? "Answer window"
          : phase === "reveal"
            ? "Reveal"
            : phase === "syncing"
              ? "Sync"
              : "Status"}
      </p>
      <p className="mt-1 text-2xl font-black tabular-nums text-[#a33700]">
        {label}
      </p>
    </div>
  );
}
