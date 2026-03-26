"use client";

import {
  startTransition,
  useCallback,
  useLayoutEffect,
  useState,
} from "react";
import { Be_Vietnam_Pro, Epilogue } from "next/font/google";
import MultipleChoicePanel from "@/components/game/MultipleChoicePanel";
import QuestionProgress from "@/components/game/QuestionProgress";
import TeamMajorityExplainer from "@/components/game/TeamMajorityExplainer";
import PrimaryActionButton from "@/components/game/PrimaryActionButton";
import { getQuoteQuestions } from "@/lib/quoteContent";
import {
  KEYS,
  getLocalJson,
  setLocalJson,
} from "@/lib/clientStorage";

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
  serverQuoteVotes: Record<string, number>;
};

export default function IdentifyQuoteGameScreen({
  serverQuoteVotes,
}: IdentifyQuoteGameScreenProps) {
  const fontBody = "var(--font-quote-body), ui-sans-serif, system-ui";
  const fontHeadline = "var(--font-quote-headline), ui-sans-serif, system-ui";
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => {
    startTransition(() => {
      const fromLs = getLocalJson<Record<string, number>>(KEYS.quoteVotes) ?? {};
      setAnswers({ ...fromLs, ...serverQuoteVotes });
    });
  }, [serverQuoteVotes]);

  const q = QUESTIONS[qi];
  const total = QUESTIONS.length;
  const selected = q ? (answers[q.id] ?? null) : null;
  const isLast = qi >= total - 1;

  const persistAndSubmit = useCallback(async (questionId: string, index: number) => {
    setSaving(true);
    setError(null);
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: index };
      setLocalJson(KEYS.quoteVotes, next);
      return next;
    });
    try {
      const res = await fetch("/api/game/quotes/vote", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, optionIndex: index }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }, []);

  const onSelect = useCallback(
    (index: number) => {
      if (!q) return;
      void persistAndSubmit(q.id, index);
    },
    [q, persistAndSubmit]
  );

  const goNext = useCallback(() => {
    if (qi < total - 1) setQi((i) => i + 1);
  }, [qi, total]);

  if (!q) {
    return null;
  }

  return (
    <div
      className={`${headline.variable} ${body.variable} min-h-[70vh] pb-8 text-[#322e25]`}
      style={{ fontFamily: fontBody }}
    >
      <header className="mb-6 flex items-center justify-between gap-2">
        <span
          className="rounded-full bg-[#a33700]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#a33700]"
          style={{ fontFamily: fontBody }}
        >
          Challenge active
        </span>
        <QuestionProgress current={qi + 1} total={total} label="Quote" />
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

      <div className="mt-8 space-y-4">
        <MultipleChoicePanel
          options={q.options}
          selectedIndex={selected}
          onSelect={onSelect}
          disabled={saving}
        />
        {error ? (
          <p className="text-center text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-8">
        {isLast ? (
          <p className="text-center text-sm text-[#605b50]">
            You’ve reached the last quote — keep this screen open until the host
            advances.
          </p>
        ) : (
          <PrimaryActionButton
            type="button"
            disabled={selected === null}
            onClick={goNext}
            data-test-id="quote-next"
          >
            Next quote
          </PrimaryActionButton>
        )}
      </div>
    </div>
  );
}
