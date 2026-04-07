"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Be_Vietnam_Pro, Epilogue } from "next/font/google";
import PrimaryActionButton from "@/components/game/PrimaryActionButton";
import { bingoCardTitlesForPlayer, bingoSeedForPlayer } from "@/lib/bingoCard";
import {
  BINGO_CELL_COUNT,
  BINGO_COLS,
  BINGO_FULL_CARD_CLAIM_KEY,
  completedBingoLineKeys,
} from "@/lib/bingoLine";
import { getBingoLocal, getPersistedPlayerId, setBingoLocal } from "@/lib/clientStorage";
import { useGuestApiFetch } from "./useGuestApiFetch";

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
  bingoRoundEndsAtEpochMs: number | null;
  myBingoMarkedCells: boolean[];
  /** Refetch session after a successful mark/claim so score and marks stay aligned with the server. */
  onBingoMutation?: () => void;
};

function markedToIndices(marked: boolean[]): number[] {
  return marked.flatMap((m, i) => (m ? [i] : []));
}

function titlesMatch(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function MusicBingoScreen({
  serverClaimedLineKeys,
  myBingoScore,
  bingoRoundEndsAtEpochMs,
  myBingoMarkedCells,
  onBingoMutation,
}: MusicBingoScreenProps) {
  const fontBody = "var(--font-bingo-body), ui-sans-serif, system-ui";
  const fontHeadline = "var(--font-bingo-headline), ui-sans-serif, system-ui";
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [marked, setMarked] = useState<boolean[]>(() =>
    Array.from({ length: BINGO_CELL_COUNT }, () => false)
  );
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingMarkCells, setPendingMarkCells] = useState<Set<number>>(
    () => new Set()
  );
  const [error, setError] = useState<string | null>(null);
  const [penaltyHint, setPenaltyHint] = useState<string | null>(null);
  /** Until parent refetches, show score returned by mark/claim so penalties and claims feel immediate. */
  const [optimisticScore, setOptimisticScore] = useState<number | null>(null);
  const [tick, setTick] = useState(() => Date.now());
  const guestFetch = useGuestApiFetch();
  const markedRef = useRef(marked);
  markedRef.current = marked;

  useEffect(() => {
    setOptimisticScore(null);
  }, [myBingoScore]);

  const displayScore = optimisticScore ?? myBingoScore;

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
    if (myBingoMarkedCells.length === BINGO_CELL_COUNT) {
      setMarked([...myBingoMarkedCells]);
      setHydrated(true);
      return;
    }
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
  }, [playerId, titles, myBingoMarkedCells]);

  useEffect(() => {
    if (bingoRoundEndsAtEpochMs == null) return;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [bingoRoundEndsAtEpochMs]);

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
    const lines = completed.filter((k) => !claimed.has(k));
    const allMarked = marked.every(Boolean);
    const fullPending =
      allMarked && !claimed.has(BINGO_FULL_CARD_CLAIM_KEY);
    return [...lines, ...(fullPending ? [BINGO_FULL_CARD_CLAIM_KEY] : [])];
  }, [marked, serverClaimedLineKeys]);

  const toggleCell = useCallback(
    async (index: number) => {
      if (playerId == null) return;
      const nextMark = !markedRef.current[index];
      setPendingMarkCells((s) => new Set(s).add(index));
      setError(null);
      try {
        const res = await guestFetch("/api/game/bingo/mark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cellIndex: index, mark: nextMark }),
        });
        const data: unknown = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg =
            typeof data === "object" &&
            data !== null &&
            "error" in data &&
            typeof (data as { error: unknown }).error === "string"
              ? (data as { error: string }).error
              : "Could not update tile";
          setError(msg);
          return;
        }
        if (
          typeof data === "object" &&
          data !== null &&
          "marked" in data &&
          Array.isArray((data as { marked: unknown }).marked)
        ) {
          const next = (data as { marked: boolean[] }).marked;
          if (next.length === BINGO_CELL_COUNT) {
            setMarked(next);
          }
        }
        if (
          typeof data === "object" &&
          data !== null &&
          "score" in data &&
          typeof (data as { score: unknown }).score === "number"
        ) {
          setOptimisticScore((data as { score: number }).score);
        }
        if (
          typeof data === "object" &&
          data !== null &&
          (data as { wrongTapPenalty?: unknown }).wrongTapPenalty === true
        ) {
          setPenaltyHint("Wrong tile — not the song playing (−5 pts).");
          window.setTimeout(() => setPenaltyHint(null), 2800);
        }
        onBingoMutation?.();
      } finally {
        setPendingMarkCells((s) => {
          const next = new Set(s);
          next.delete(index);
          return next;
        });
      }
    },
    [guestFetch, onBingoMutation, playerId]
  );

  const onClaim = useCallback(async () => {
    if (newLineKeys.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await guestFetch("/api/game/bingo/claim", {
        method: "POST",
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
      } else if (
        typeof data === "object" &&
        data !== null &&
        "totalForPlayer" in data &&
        typeof (data as { totalForPlayer: unknown }).totalForPlayer === "number"
      ) {
        setOptimisticScore((data as { totalForPlayer: number }).totalForPlayer);
        onBingoMutation?.();
      }
    } finally {
      setSubmitting(false);
    }
  }, [guestFetch, newLineKeys, onBingoMutation, submitting]);

  if (!playerId) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4 text-center text-zinc-600">
        <p className="text-lg">We couldn’t load your player id.</p>
        <p className="text-sm">Go back to check-in and join again.</p>
      </div>
    );
  }

  if (!hydrated || titles.length !== BINGO_CELL_COUNT) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4 text-center text-zinc-600">
        <p className="text-lg">Loading your card…</p>
      </div>
    );
  }

  const canClaim =
    newLineKeys.length > 0 && !submitting && pendingMarkCells.size === 0;
  const allMarked = marked.every(Boolean);
  const fullClaimed = serverClaimedLineKeys.includes(BINGO_FULL_CARD_CLAIM_KEY);
  const hasCompletedLine =
    completedBingoLineKeys(markedToIndices(marked)).length > 0;

  const remainingMs =
    bingoRoundEndsAtEpochMs != null
      ? Math.max(0, bingoRoundEndsAtEpochMs - tick)
      : 0;

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
        {bingoRoundEndsAtEpochMs != null ? (
          <p
            className="mt-2 text-sm font-bold tabular-nums text-[#0e666a]"
            data-test-id="bingo-round-countdown"
            style={{ fontFamily: fontHeadline }}
          >
            Round ends in {formatRemaining(remainingMs)}
          </p>
        ) : null}
        <p className="mt-3 max-w-md text-base leading-relaxed text-[#605b50]">
          The host is playing one song at a time — tap a tile <strong>only</strong>{" "}
          when that exact track is playing. Bank a column for{" "}
          <span className="font-bold text-[#a33700]">50 pts</span>, a row for{" "}
          <span className="font-bold text-[#a33700]">100 pts</span>, and a one-time{" "}
          <span className="font-bold text-[#a33700]">500 pts</span> when the whole
          card is filled — call bingo to score each time. Wrong tile (when it
          isn’t the song playing) costs{" "}
          <span className="font-bold text-[#b02500]">5 pts</span>.
        </p>
        <p
          className="mt-4 text-sm font-bold text-[#0e666a]"
          style={{ fontFamily: fontHeadline }}
        >
          Your score this round: {displayScore}
        </p>
        {penaltyHint ? (
          <p
            className="mt-2 text-xs font-semibold text-[#b02500]/90"
            style={{ fontFamily: fontHeadline }}
            role="status"
          >
            {penaltyHint}
          </p>
        ) : null}
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
            const busy = pendingMarkCells.has(index);
            return (
              <button
                key={index}
                type="button"
                data-test-id={`bingo-cell-${index}`}
                disabled={busy}
                onClick={() => void toggleCell(index)}
                className={`min-h-[100px] touch-manipulation rounded-2xl border-2 px-2 py-3 text-left text-sm font-bold leading-snug transition-all active:scale-[0.98] sm:min-h-[120px] sm:text-base ${
                  isOn
                    ? "border-[#0e666a] bg-[#a6eff3]/50 text-[#005b5f] shadow-inner"
                    : "border-[#e5dcc9] bg-[#fef6e7]/90 text-[#322e25] hover:border-[#a33700]/40"
                } disabled:opacity-60`}
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
            {newLineKeys.length === 0 && allMarked && fullClaimed
              ? "You’ve banked every line and the full card."
              : newLineKeys.length === 0 && hasCompletedLine
                ? "Those lines are already banked — keep listening for another."
                : "Mark tiles when the host’s current song matches — then bank rows, columns, or a full card."}
          </p>
        ) : null}
      </div>
    </div>
  );
}
