"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { Be_Vietnam_Pro, Epilogue } from "next/font/google";
import MultipleChoicePanel from "@/components/game/MultipleChoicePanel";
import QuestionProgress from "@/components/game/QuestionProgress";
import TeamMajorityExplainer from "@/components/game/TeamMajorityExplainer";
import McqRoundCountdownBar from "@/components/game/McqRoundCountdownBar";
import { useTeamMcqRoundPhase } from "@/components/game/useTeamMcqRoundPhase";
import { useTeamMcqBackgroundVotes } from "@/components/game/useTeamMcqBackgroundVotes";
import { getQuoteQuestions } from "@/lib/quoteContent";
import { KEYS, getLocalJson, setLocalJson } from "@/lib/clientStorage";
import type { TeamMcqPublicSync } from "@/types";
import { useGuestApiFetch } from "./useGuestApiFetch";

const headline = Epilogue({
  subsets: ["latin"],
  weight: ["800", "900"],
  variable: "--font-quote-headline",
});

const body = Be_Vietnam_Pro({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-quote-body",
});

const QUESTIONS = getQuoteQuestions();

export type IdentifyQuoteGameScreenProps = {
  teamMcqSync: TeamMcqPublicSync | null;
  serverQuoteVotes: Record<string, number>;
};

export default function IdentifyQuoteGameScreen({
  teamMcqSync,
  serverQuoteVotes,
}: IdentifyQuoteGameScreenProps) {
  const fontBody = "var(--font-quote-body), ui-sans-serif, system-ui";
  const fontHeadline = "var(--font-quote-headline), ui-sans-serif, system-ui";
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const guestFetch = useGuestApiFetch();

  const postVote = useCallback(
    async (questionId: string, optionIndex: number) => {
      const res = await guestFetch("/api/game/quotes/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, optionIndex }),
      });
      return res.ok;
    },
    [guestFetch],
  );

  const enqueueVote = useTeamMcqBackgroundVotes(postVote);

  useEffect(() => {
    startTransition(() => {
      const fromLs = getLocalJson<Record<string, number>>(KEYS.quoteVotes) ?? {};
      setAnswers({ ...fromLs, ...serverQuoteVotes });
    });
  }, [serverQuoteVotes]);

  const { phase, secondsLeft, activeSync } = useTeamMcqRoundPhase(teamMcqSync);

  const q = useMemo(() => {
    if (!activeSync) return null;
    return QUESTIONS[activeSync.questionIndex] ?? null;
  }, [activeSync]);
  const canAnswer = phase === "answering";
  const showReveal =
    phase === "reveal" || phase === "syncing" || phase === "awaiting_host";

  const onSelect = useCallback(
    (index: number) => {
      if (!q || !canAnswer) return;
      setAnswers((prev) => {
        const next = { ...prev, [q.id]: index };
        setLocalJson(KEYS.quoteVotes, next);
        return next;
      });
      enqueueVote(q.id, index);
    },
    [q, canAnswer, enqueueVote]
  );

  const total = QUESTIONS.length;
  const selected = q ? (answers[q.id] ?? null) : null;
  const revealCorrectIndex =
    showReveal && q ? q.correctIndex : null;

  if (!teamMcqSync || !activeSync || !q) {
    return null;
  }

  return (
    <div
      className={`${headline.variable} ${body.variable} min-h-[70vh] pb-20 text-[#322e25]`}
      style={{ fontFamily: fontBody }}
    >
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <span
          className="self-start rounded-full bg-[#a33700]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#a33700]"
          style={{ fontFamily: fontBody }}
        >
          Challenge active
        </span>
        <div className="w-full sm:max-w-md">
          <McqRoundCountdownBar phase={phase} secondsLeft={secondsLeft} />
        </div>
        <QuestionProgress
          current={activeSync.questionIndex + 1}
          total={total}
          label="Quote"
        />
      </header>

      <div className="relative mb-8">
        <h1
          className="text-4xl font-black uppercase leading-none tracking-tight text-[#322e25] sm:text-5xl"
          style={{ fontFamily: fontHeadline }}
        >
          Who{" "}
          <span className="bg-gradient-to-r from-[#a33700] to-[#ff7943] bg-clip-text italic text-transparent">
            said
          </span>{" "}
          it?
        </h1>
      </div>

      <TeamMajorityExplainer />

      <div className="relative mt-6 rounded-2xl bg-[#f8f0e0] p-6 shadow-lg shadow-[#322e25]/5">
        <span
          aria-hidden
          className="absolute left-4 top-4 text-5xl leading-none text-[#a33700]/15"
          style={{ fontFamily: fontHeadline }}
        >
          “
        </span>
        <p
          className="relative z-10 px-2 pt-6 text-center text-xl font-black italic leading-snug sm:text-2xl"
          style={{
            fontFamily: fontHeadline,
            background: "linear-gradient(135deg, #a33700 0%, #ff7943 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {q.quote}
        </p>
        <span
          aria-hidden
          className="absolute bottom-2 right-4 text-5xl leading-none text-[#a33700]/15"
          style={{ fontFamily: fontHeadline }}
        >
          ”
        </span>
        <p className="mt-6 border-t border-[#e5dcc9]/80 pt-4 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#605b50]">
          Pick who probably said it (team vote counts)
        </p>
      </div>

      <div className="mt-8">
        <MultipleChoicePanel
          options={q.options}
          selectedIndex={selected}
          onSelect={onSelect}
          disabled={!canAnswer}
          revealCorrectIndex={revealCorrectIndex}
        />
      </div>
    </div>
  );
}
