"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import { Be_Vietnam_Pro, Epilogue } from "next/font/google";
import {
  TRIVIA_QUESTIONS,
  type TriviaQuestion,
} from "@/content/trivia";
import {
  getTriviaAnswersLocal,
  setTriviaAnswersLocal,
} from "@/lib/clientStorage";
import QuestionProgress from "@/components/game/QuestionProgress";
import TeamMajorityExplainer from "@/components/game/TeamMajorityExplainer";
import MultipleChoicePanel from "@/components/game/MultipleChoicePanel";

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

async function postVote(
  questionId: string,
  optionIndex: number
): Promise<boolean> {
  const res = await fetch("/api/game/trivia/vote", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionId, optionIndex }),
  });
  return res.ok;
}

export type TriviaGameScreenProps = {
  serverMyVotes: Record<string, number>;
  onVoteSynced?: () => void;
};

export default function TriviaGameScreen({
  serverMyVotes,
  onVoteSynced,
}: TriviaGameScreenProps) {
  const fontBody = "var(--font-trivia-body), ui-sans-serif, system-ui";
  const fontHeadline = "var(--font-trivia-headline), ui-sans-serif, system-ui";
  const total = TRIVIA_QUESTIONS.length;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  useEffect(() => {
    const local = getTriviaAnswersLocal() ?? {};
    startTransition(() => {
      setAnswers({ ...local, ...serverMyVotes });
    });
  }, [serverMyVotes]);

  useEffect(() => {
    let alive = true;
    const local = getTriviaAnswersLocal() ?? {};
    (async () => {
      for (const [qid, idx] of Object.entries(local)) {
        if (!alive) return;
        if (serverMyVotes[qid] !== undefined) continue;
        const ok = await postVote(qid, Number(idx));
        if (ok && alive) onVoteSynced?.();
      }
    })();
    return () => {
      alive = false;
    };
  }, [serverMyVotes, onVoteSynced]);

  const q = TRIVIA_QUESTIONS[index];
  const selected = q ? (answers[q.id] ?? null) : null;

  const handleSelect = useCallback(
    async (optionIndex: number) => {
      const current = TRIVIA_QUESTIONS[index];
      if (!current) return;
      setAnswers((prev) => {
        const next = { ...prev, [current.id]: optionIndex };
        setTriviaAnswersLocal(next);
        return next;
      });
      const ok = await postVote(current.id, optionIndex);
      if (ok) onVoteSynced?.();
    },
    [index, onVoteSynced]
  );

  if (!q) {
    return null;
  }

  return (
    <div
      className={`${headline.variable} ${body.variable} relative -mx-4 -my-6 min-h-[calc(100dvh-3rem)] overflow-x-hidden bg-[#fef6e7] px-4 pb-32 pt-4 text-[#322e25]`}
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
        <div className="mt-5">
          <QuestionProgress
            current={index + 1}
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
          onSelect={(i) => void handleSelect(i)}
        />
      </section>

      <nav
        className="fixed bottom-0 left-0 right-0 z-20 flex gap-3 border-t border-[#e5dcc9] bg-[#fef6e7]/95 px-4 py-4 backdrop-blur-md"
        aria-label="Question navigation"
      >
        <button
          type="button"
          disabled={index <= 0}
          data-test-id="trivia-back"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="flex-1 rounded-full border-2 border-[#b3ac9f] bg-white py-4 text-center text-sm font-bold text-[#322e25] disabled:opacity-40"
        >
          Back
        </button>
        {index < total - 1 ? (
          <button
            type="button"
            data-test-id="trivia-next"
            onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
            className="flex-1 rounded-full border-2 border-[#a33700] bg-[#ff7943]/20 py-4 text-center text-sm font-black uppercase tracking-wide text-[#a33700]"
          >
            Next question
          </button>
        ) : (
          <div className="flex flex-[2] items-center justify-center rounded-full bg-[#f8f0e0] px-4 text-center text-xs font-bold text-[#605b50]">
            You’re on the last question. The host will end the round when it’s
            time.
          </div>
        )}
      </nav>
    </div>
  );
}
