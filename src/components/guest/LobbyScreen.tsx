"use client";

import { useEffect, useRef, useState } from "react";
import { Be_Vietnam_Pro, Epilogue } from "next/font/google";
import type { LobbyTeamRoster } from "@/types";
import {
  LOBBY_COUNTDOWN_SECONDS,
  LOBBY_GO_PHASE_MS,
} from "@/lib/lobbySchedule";
import { getQuoteQuestions } from "@/lib/quoteContent";

const QUOTE_ROUND_COUNT = getQuoteQuestions().length;

const headline = Epilogue({
  subsets: ["latin"],
  weight: ["800", "900"],
  variable: "--font-lobby-headline",
});

const body = Be_Vietnam_Pro({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-lobby-body",
});

export type LobbyScreenProps = {
  variant: "trivia" | "music_bingo" | "identify_quote";
  teams?: LobbyTeamRoster[];
  playerCount?: number;
  /** Server-chosen instant when the game step opens; guests derive the 60s + Go! locally. */
  scheduledGameStartsAtEpochMs: number | null;
  /** Called once when local clock reaches game start; parent should refetch `/api/state`. */
  onScheduleBoundary?: () => void;
};

type CountdownPhase =
  | { kind: "idle" }
  | { kind: "buffer" }
  | { kind: "count"; seconds: number }
  | { kind: "go" }
  | { kind: "boundary" };

function getCountdownPhase(
  scheduledMs: number | null,
  nowMs: number
): CountdownPhase {
  if (scheduledMs == null) return { kind: "idle" };
  const gameStart = scheduledMs;
  const goStart = gameStart - LOBBY_GO_PHASE_MS;
  const countdownEnd = goStart;
  const countdownStart = countdownEnd - LOBBY_COUNTDOWN_SECONDS * 1000;

  if (nowMs < countdownStart) return { kind: "buffer" };
  if (nowMs < goStart) {
    const seconds = Math.max(
      1,
      Math.min(
        LOBBY_COUNTDOWN_SECONDS,
        Math.ceil((goStart - nowMs) / 1000)
      )
    );
    return { kind: "count", seconds };
  }
  if (nowMs < gameStart) return { kind: "go" };
  return { kind: "boundary" };
}

export default function LobbyScreen({
  variant,
  teams = [],
  playerCount = 0,
  scheduledGameStartsAtEpochMs,
  onScheduleBoundary,
}: LobbyScreenProps) {
  const fontBody = "var(--font-lobby-body), ui-sans-serif, system-ui";
  const fontHeadline = "var(--font-lobby-headline), ui-sans-serif, system-ui";
  const showRoster = variant === "trivia" || variant === "identify_quote";
  const roster = showRoster ? teams : [];

  const [nowMs, setNowMs] = useState(() => Date.now());
  const firedBoundary = useRef(false);

  useEffect(() => {
    firedBoundary.current = false;
  }, [scheduledGameStartsAtEpochMs]);

  useEffect(() => {
    if (scheduledGameStartsAtEpochMs == null) return undefined;
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [scheduledGameStartsAtEpochMs]);

  const phase = getCountdownPhase(scheduledGameStartsAtEpochMs, nowMs);

  useEffect(() => {
    if (phase.kind !== "boundary" || !onScheduleBoundary) return;
    if (firedBoundary.current) return;
    firedBoundary.current = true;
    onScheduleBoundary();
  }, [phase.kind, onScheduleBoundary]);

  const title =
    variant === "trivia"
      ? "Team trivia"
      : variant === "identify_quote"
        ? "Who said it"
        : "Music bingo";
  const heroSubtitle =
    variant === "trivia" || variant === "identify_quote"
      ? "Lobby open · know your squad"
      : "Lobby open · your own card";

  const isCountdownLive =
    scheduledGameStartsAtEpochMs != null && phase.kind !== "idle";

  return (
    <div
      data-test-id={`lobby-screen-${variant}`}
      className={`${headline.variable} ${body.variable} relative -mx-4 -my-6 min-h-[calc(100dvh-3rem)] overflow-x-hidden bg-[#fef6e7] px-4 pb-28 pt-2 text-[#322e25]`}
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

      <header className="relative z-10 mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full bg-[#22c55e] animate-pulse"
              aria-hidden
            />
            <p
              className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#0e666a]"
              style={{ fontFamily: fontHeadline }}
            >
              {heroSubtitle}
            </p>
          </div>
          <h1
            className="text-4xl font-black uppercase italic leading-[0.95] tracking-tighter text-[#a33700] sm:text-5xl"
            style={{ fontFamily: fontHeadline }}
          >
            {title}
          </h1>
          <p className="mt-3 max-w-sm text-sm font-medium text-[#605b50]">
            {variant === "trivia"
              ? "Read how scoring works, find your team below. When the host starts the countdown, it runs here — no need to refresh."
              : variant === "identify_quote"
                ? `New teams for this round — find yours below. Majority rule matches trivia; ${QUOTE_ROUND_COUNT} quotes, 50 pts each.`
                : "Individual play — your card, your taps. Mark ’70s titles when you hear them; host runs the audio in the room."}
          </p>
        </div>
        {playerCount > 0 ? (
          <div
            className="shrink-0 rounded-full border border-orange-200 bg-white/80 px-4 py-2 text-center shadow-sm backdrop-blur-sm"
            style={{ fontFamily: fontHeadline }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#605b50]">
              Here
            </p>
            <p className="text-xl font-black text-[#a33700]">{playerCount}</p>
            <p className="text-[9px] font-bold uppercase text-[#605b50]">
              players
            </p>
          </div>
        ) : null}
      </header>

      {isCountdownLive ? (
        <section
          className="relative z-10 mb-8"
          aria-live="polite"
          data-test-id="lobby-embedded-countdown"
        >
          <div className="rounded-[2rem] bg-gradient-to-br from-[#0e666a] via-[#0a4f52] to-[#063a3d] p-1 shadow-xl shadow-teal-900/25">
            <div className="rounded-[1.85rem] bg-white/10 px-6 py-10 text-center backdrop-blur-md">
              <p
                className="mb-2 text-[10px] font-bold uppercase tracking-[0.4em] text-white/85"
                style={{ fontFamily: fontHeadline }}
              >
                Starting soon
              </p>
              {phase.kind === "buffer" ? (
                <p
                  className="text-lg font-bold uppercase tracking-wide text-white/95"
                  style={{ fontFamily: fontHeadline }}
                >
                  Syncing…
                </p>
              ) : phase.kind === "count" ? (
                <p
                  data-test-id="lobby-countdown-seconds"
                  className="text-6xl font-black tabular-nums text-white [text-shadow:0_0_24px_rgba(255,255,255,0.25)] sm:text-7xl"
                  style={{ fontFamily: fontHeadline }}
                >
                  {phase.seconds}
                </p>
              ) : phase.kind === "go" ? (
                <p
                  data-test-id="lobby-go-phase"
                  className="text-5xl font-black uppercase italic text-white sm:text-6xl"
                  style={{ fontFamily: fontHeadline }}
                >
                  Go!
                </p>
              ) : (
                <p
                  className="text-lg font-bold text-white/90"
                  style={{ fontFamily: fontHeadline }}
                >
                  Loading game…
                </p>
              )}

            </div>
          </div>
        </section>
      ) : null}

      <section className="relative z-10 mb-8">
        <div className="rounded-[2rem] bg-gradient-to-br from-[#ff9e5e] via-[#e67e22] to-[#a33700] p-1 shadow-xl shadow-orange-500/20">
          <div className="rounded-[1.85rem] bg-white/15 px-6 py-8 backdrop-blur-md">
            <p
              className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.4em] text-white/90"
              style={{ fontFamily: fontHeadline }}
            >
              Up next
            </p>
            <p
              className="text-center text-2xl font-black uppercase italic text-white sm:text-3xl"
              style={{ fontFamily: fontHeadline }}
            >
              {variant === "music_bingo"
                ? "’70s disco bingo"
                : variant === "identify_quote"
                  ? "Quote showdown"
                  : "Team trivia round"}
            </p>
            <p className="mt-3 text-center text-xs font-medium text-white/85">
              {variant === "trivia"
                ? "UK · Barcelona · 1970s threads — 20 questions, 50 pts each."
                : variant === "identify_quote"
                  ? `${QUOTE_ROUND_COUNT} quotes, four choices — majority locks the answer; 50 pts per correct team pick for everyone on the squad.`
                  : "2×3 card, 50 ’70s titles — host plays one track at a time; tap only when that song is on. 50 / 100 / 500 pts for column / row / full card; wrong tile −5."}
            </p>
          </div>
        </div>
      </section>

      {variant === "trivia" || variant === "identify_quote" ? (
        <section className="relative z-10 mb-8 rounded-2xl border border-orange-100 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
          <h2
            className="mb-3 text-xs font-bold uppercase tracking-widest text-[#a33700]"
            style={{ fontFamily: fontHeadline }}
          >
            Majority rule
          </h2>
          <p className="text-sm font-medium leading-relaxed text-[#605b50]">
            Your team’s answer is the option most phones in the team tap. Tie‑
            break uses the lowest option letter; if the team’s pick matches the
            correct answer, everyone on the team scores.
          </p>
        </section>
      ) : (
        <section className="relative z-10 mb-8 rounded-2xl border border-[#0e666a]/20 bg-[#f0fafb] p-6 shadow-sm">
          <h2
            className="mb-3 text-xs font-bold uppercase tracking-widest text-[#0e666a]"
            style={{ fontFamily: fontHeadline }}
          >
            Solo play
          </h2>
          <p className="text-sm font-medium leading-relaxed text-[#605b50]">
            No teams this round — it’s your card against the room. Mark songs
            you hear; call bingo on an honour line when you’re sure. Same vibe
            as the bingo rules screen: chill, loud, and a little chaotic.
          </p>
        </section>
      )}

      {showRoster ? (
        <section className="relative z-10 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2
              className="text-lg font-black uppercase tracking-tight text-[#a33700]"
              style={{ fontFamily: fontHeadline }}
            >
              Teams in lobby
            </h2>
          </div>
          {roster.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-orange-200 bg-white/60 px-4 py-6 text-center text-sm text-[#605b50]">
              No teams yet — waiting for everyone to be in the lobby.
            </p>
          ) : (
            <ul className="space-y-4">
              {roster.map((team) => (
                <li
                  key={team.name}
                  className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm"
                >
                  <h3
                    className="mb-3 text-sm font-black uppercase text-[#322e25]"
                    style={{ fontFamily: fontHeadline }}
                  >
                    {team.name}
                  </h3>
                  <ul className="flex flex-wrap gap-2">
                    {team.nicknames.map((n) => (
                      <li
                        key={`${team.name}-${n}`}
                        className="rounded-full bg-[#fef3e8] px-3 py-1.5 text-xs font-semibold text-[#322e25]"
                      >
                        {n}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
