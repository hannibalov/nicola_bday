"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { Be_Vietnam_Pro, Epilogue } from "next/font/google";
import PrimaryActionButton from "@/components/game/PrimaryActionButton";
import { bingoCardTitlesForPlayer, bingoSeedForPlayer } from "@/lib/bingoCard";
import {
  BINGO_CELL_COUNT,
  BINGO_COLS,
  completedBingoLineKeys,
} from "@/lib/bingoLine";
import {
  getBingoLocal,
  getPersistedPlayerId,
  setBingoLocal,
} from "@/lib/clientStorage";

const headline = Epilogue({
  subsets: ["latin"],
  weight: ["800", "900"],
  variable: "--font-bingo-headline",
});

const body = Be_Vietnam_Pro({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-bingo-body",
});

export type MusicBingoScreenProps = {
  serverClaimedLineKeys: string[];
  myBingoScore: number;
};

function markedToIndices(marked: boolean[]): number[] {
  return marked.flatMap((m, i) => (m ? [i] : []));
}

function titlesMatch(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

export default function MusicBingoScreen({
  serverClaimedLineKeys,
  myBingoScore,
}: MusicBingoScreenProps) {
  const fontBody = "var(--font-bingo-body), ui-sans-serif, system-ui";
  const fontHeadline = "var(--font-bingo-headline), ui-sans-serif, system-ui";
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [marked, setMarked] = useState<boolean[]>(() =>
    Array.from({ length: BINGO_CELL_COUNT }, () => false)
  );
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    startTransition(() => {
      setPlayerId(getPersistedPlayerId());
    });
  }, []);

  const titles = useMemo(
    () => (playerId ? bingoCardTitlesForPlayer(playerId) : []),
    [playerId]
  );

  useEffect(() => {
    if (!playerId || titles.length !== BINGO_CELL_COUNT) return;
    const saved = getBingoLocal();
    if (
      saved &&
      saved.playerId === playerId &&
      titlesMatch(saved.titles, titles)
    ) {
      setMarked(saved.marked);
    } else {
      setMarked(Array.from({ length: BINGO_CELL_COUNT }, () => false));
    }
    setHydrated(true);
  }, [playerId, titles]);

  useEffect(() => {
    if (
      !hydrated ||
      !playerId ||
      titles.length !== BINGO_CELL_COUNT
    ) {
      return;
    }
    setBingoLocal({
      playerId,
      seed: bingoSeedForPlayer(playerId),
      titles,
      marked,
    });
  }, [hydrated, playerId, titles, marked]);

  const newLineKeys = useMemo(() => {
    const completed = completedBingoLineKeys(markedToIndices(marked));
    const claimed = new Set(serverClaimedLineKeys);
    return completed.filter((k) => !claimed.has(k));
  }, [marked, serverClaimedLineKeys]);

  const toggleCell = useCallback((index: number) => {
    setMarked((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }, []);

  const onClaim = useCallback(async () => {
    if (newLineKeys.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/game/bingo/claim", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineKeys: newLineKeys }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Could not claim bingo";
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }, [newLineKeys, submitting]);

  if (!playerId) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4 text-center text-zinc-600">
        <p className="text-lg">We couldn’t load your player id.</p>
        <p className="text-sm">Go back to check-in and join again.</p>
      </div>
    );
  }

  const canClaim = newLineKeys.length > 0 && !submitting;

  return (
    <div
      className={`${headline.variable} ${body.variable} relative -mx-4 -my-6 min-h-[calc(100dvh-3rem)] overflow-x-hidden bg-[#fef6e7] px-4 pb-32 pt-2 text-[#322e25]`}
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
        className="pointer-events-none absolute top-52 -right-10 h-64 w-64 rounded-full bg-[#0e666a]/12 blur-3xl"
        aria-hidden
      />

      <header className="relative z-10 mb-6">
        <p
          className="mb-2 text-[10px] font-bold uppercase tracking-[0.35em] text-[#b50552]"
          style={{ fontFamily: fontHeadline }}
        >
          The Golden Jubilee · 1970s classics
        </p>
        <h1
          className="text-4xl font-black uppercase italic leading-[0.95] tracking-tighter text-[#a33700] sm:text-5xl"
          style={{ fontFamily: fontHeadline }}
        >
          Music bingo
        </h1>
        <p className="mt-3 max-w-md text-base leading-relaxed text-[#605b50]">
          Tap a tile when you hear that song in the room. Complete any full row
          or column, then call bingo to bank{" "}
          <span className="font-bold text-[#a33700]">500 pts</span> per new line.
        </p>
        <p
          className="mt-4 text-sm font-bold text-[#0e666a]"
          style={{ fontFamily: fontHeadline }}
        >
          Your score this round: {myBingoScore}
        </p>
      </header>

      <section
        className="relative z-10 rounded-3xl border-2 border-[#a33700]/15 bg-white/80 p-4 shadow-lg shadow-[#a33700]/10 backdrop-blur-sm"
        aria-label="Bingo card"
      >
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${BINGO_COLS}, minmax(0, 1fr))`,
          }}
        >
          {titles.map((title, index) => {
            const isOn = marked[index];
            return (
              <button
                key={index}
                type="button"
                data-test-id={`bingo-cell-${index}`}
                onClick={() => toggleCell(index)}
                className={`min-h-[100px] rounded-2xl border-2 px-2 py-3 text-left text-sm font-bold leading-snug transition-all active:scale-[0.98] sm:min-h-[120px] sm:text-base ${
                  isOn
                    ? "border-[#0e666a] bg-[#a6eff3]/50 text-[#005b5f] shadow-inner"
                    : "border-[#e5dcc9] bg-[#fef6e7]/90 text-[#322e25] hover:border-[#a33700]/40"
                }`}
                style={{ fontFamily: fontHeadline }}
              >
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-[#a33700]/70">
                  {index + 1}
                </span>
                {title}
              </button>
            );
          })}
        </div>
      </section>

      {error ? (
        <p className="relative z-10 mt-4 text-center text-sm font-medium text-[#b02500]">
          {error}
        </p>
      ) : null}

      <div className="relative z-10 mx-auto mt-8 max-w-md">
        <PrimaryActionButton
          type="button"
          disabled={!canClaim}
          onClick={() => void onClaim()}
          variant="gradient"
          data-test-id="bingo-claim"
        >
          {submitting ? "Claiming…" : "Call bingo!"}
        </PrimaryActionButton>
        {!canClaim && !submitting ? (
          <p className="mt-3 text-center text-xs text-[#605b50]">
            {newLineKeys.length === 0 && completedBingoLineKeys(markedToIndices(marked)).length > 0
              ? "Those lines are already banked — keep listening for another."
              : "Mark a full row or column, then tap to bank your points."}
          </p>
        ) : null}
      </div>
    </div>
  );
}
