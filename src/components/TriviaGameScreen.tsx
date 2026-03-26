"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { Be_Vietnam_Pro, Epilogue } from "next/font/google";
import {
  TRIVIA_QUESTIONS,
  type TriviaQuestion,
} from "@/content/trivia";
import {
  getTriviaAnswersLocal,
  setTriviaAnswersLocal,
} from "@/lib/clientStorage";
import type { TeamMcqPublicSync } from "@/types";
import QuestionProgress from "@/components/game/QuestionProgress";
import TeamMajorityExplainer from "@/components/game/TeamMajorityExplainer";
import MultipleChoicePanel from "@/components/game/MultipleChoicePanel";
import McqRoundCountdownBar from "@/components/game/McqRoundCountdownBar";
import { useTeamMcqRoundPhase } from "@/components/game/useTeamMcqRoundPhase";
import { useTeamMcqBackgroundVotes } from "@/components/game/useTeamMcqBackgroundVotes";

const headline = Epilogue({
  subsets: ["latin"],
  weight: ["800", "900"],
  variable: "--font-trivia-headline",
});

const body = Be_Vietnam_Pro({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-trivia-body",
});

function topicLabel(topic: TriviaQuestion["topic"]): string {
  if (topic === "UK") return "United Kingdom";
  if (topic === "1970s") return "1970s";
  return "Barcelona";
}

export type TriviaGameScreenProps = {
  teamMcqSync: TeamMcqPublicSync | null;
  serverMyVotes: Record<string, number>;
};

export default function TriviaGameScreen({
  teamMcqSync,
  serverMyVotes,
}: TriviaGameScreenProps) {
  const fontBody = "var(--font-trivia-body), ui-sans-serif, system-ui";
  const fontHeadline = "var(--font-trivia-headline), ui-sans-serif, system-ui";
  const total = TRIVIA_QUESTIONS.length;
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const postVote = useCallback(async (questionId: string, optionIndex: number) => {
    const res = await fetch("/api/game/trivia/vote", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, optionIndex }),
    });
    return res.ok;
  }, []);

  const enqueueVote = useTeamMcqBackgroundVotes(postVote);

  useEffect(() => {
    const local = getTriviaAnswersLocal() ?? {};
    startTransition(() => {
      setAnswers({ ...local, ...serverMyVotes });
    });
  }, [serverMyVotes]);

  const q = useMemo(() => {
    if (!teamMcqSync) return null;
    return TRIVIA_QUESTIONS[teamMcqSync.questionIndex] ?? null;
  }, [teamMcqSync]);

  const { phase, secondsLeft } = useTeamMcqRoundPhase(teamMcqSync);

  const canAnswer = phase === "answering";
  const showReveal =
    phase === "reveal" || phase === "syncing" || phase === "awaiting_host";

  const handleSelect = useCallback(
    (optionIndex: number) => {
      if (!q || !canAnswer) return;
      setAnswers((prev) => {
        const next = { ...prev, [q.id]: optionIndex };
        setTriviaAnswersLocal(next);
        return next;
      });
      enqueueVote(q.id, optionIndex);
    },
    [q, canAnswer, enqueueVote]
  );

  const selected = q ? (answers[q.id] ?? null) : null;
  const revealCorrectIndex =
    showReveal && q ? q.correctIndex : null;

  if (!teamMcqSync || !q) {
    return null;
  }

  return (
    <div
      className={`${headline.variable} ${body.variable} relative -mx-4 -my-6 min-h-[calc(100dvh-3rem)] overflow-x-hidden bg-[#fef6e7] px-4 pb-28 pt-4 text-[#322e25]`}
      style={{ fontFamily: fontBody }}
    >
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.03] [background-image:radial-gradient(#7c766a_0.5px,transparent_0.5px)] [background-size:4px_4px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -top-10 -left-10 h-48 w-48 rounded-full bg-[#ff7943]/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-40 -right-10 h-64 w-64 rounded-full bg-[#0e666a]/10 blur-3xl"
        aria-hidden
      />

      <header className="relative z-10 mb-6">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#0e666a]"
          style={{ fontFamily: fontHeadline }}
        >
          Level 50 · Team trivia
        </p>
        <h1
          className="mt-2 text-3xl font-black uppercase italic leading-none tracking-tighter text-[#a33700] sm:text-4xl"
          style={{ fontFamily: fontHeadline }}
        >
          Trivia
        </h1>
        <p className="mt-3 text-sm font-medium text-[#605b50]">
          United Kingdom · 1970s · Barcelona ·{" "}
          <span className="font-bold text-[#a33700]">50 pts</span> per correct
          team answer when the majority picks right.
        </p>
        <div className="mt-5 space-y-3">
          <McqRoundCountdownBar phase={phase} secondsLeft={secondsLeft} />
          <QuestionProgress
            current={teamMcqSync.questionIndex + 1}
            total={total}
            label="Question"
            variant="bar"
          />
        </div>
      </header>

      <div className="relative z-10 mb-6">
        <TeamMajorityExplainer />
      </div>

      <section className="relative z-10 rounded-3xl border border-[#e5dcc9] bg-white/80 p-5 shadow-lg shadow-[#a33700]/5 backdrop-blur-sm">
        <MultipleChoicePanel
          prompt={q.prompt}
          topicLabel={topicLabel(q.topic)}
          options={q.options}
          selectedIndex={selected}
          onSelect={(i) => handleSelect(i)}
          disabled={!canAnswer}
          revealCorrectIndex={revealCorrectIndex}
        />
      </section>
    </div>
  );
}
