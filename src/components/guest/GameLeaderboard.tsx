"use client";

import { Be_Vietnam_Pro, Epilogue } from "next/font/google";

const headline = Epilogue({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-lb-headline",
});

const body = Be_Vietnam_Pro({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-lb-body",
});

function initialFromName(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  return t[0]!.toUpperCase();
}

function formatPoints(n: number): string {
  return n.toLocaleString("en-GB");
}

export interface GameLeaderboardProps {
  gameName: string;
  entries: { name: string; score: number }[];
  type: "individual" | "team";
  /** Nickname (individual) or team name (team) — highlights matching row when set. */
  highlightName?: string | null;
}

export default function GameLeaderboard({
  gameName,
  entries,
  type,
  highlightName,
}: GameLeaderboardProps) {
  const fontBody = "var(--font-lb-body), ui-sans-serif, system-ui";
  const fontHeadline = "var(--font-lb-headline), ui-sans-serif, system-ui";
  const modeLabel = type === "individual" ? "Individual" : "Squad";

  return (
    <div
      data-test-id="game-mid-leaderboard"
      className={`${headline.variable} ${body.variable} relative -mx-4 -my-6 min-h-[calc(100dvh-3rem)] overflow-x-hidden bg-[#fef6e7] px-4 pb-16 pt-2 text-[#322e25]`}
      style={{ fontFamily: fontBody }}
    >
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.06] [background-image:radial-gradient(#a33700_0.8px,transparent_0.8px)] [background-size:14px_14px]"
        aria-hidden
      />

      <main className="relative z-10 mx-auto max-w-md pt-2">
        <section className="relative mb-8 mt-2 overflow-hidden rounded-xl bg-gradient-to-br from-[#a33700] to-[#b50552] p-8 text-[#ffefeb] shadow-2xl">
          <div
            className="pointer-events-none absolute -top-10 -right-10 h-48 w-48 rounded-full bg-[#a6eff3]/20 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-[#ff7943]/25 blur-3xl"
            aria-hidden
          />
          <div className="relative z-10 flex flex-col items-center text-center">
            <span
              className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em] opacity-90"
              style={{ fontFamily: fontHeadline }}
            >
              {gameName}
            </span>
            <h1
              className="text-4xl font-black uppercase italic leading-none tracking-tighter drop-shadow-sm sm:text-5xl"
              style={{ fontFamily: fontHeadline }}
            >
              Leaderboard
            </h1>
            <div className="mt-5 flex items-center gap-2 rounded-full border border-white/15 bg-black/10 px-4 py-1.5 backdrop-blur-md">
              <span className="text-xs" aria-hidden>
                ✦
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {modeLabel} · Round results
              </span>
            </div>
          </div>
        </section>

        <div
          className="mb-6 flex rounded-full border border-[#b3ac9f]/20 bg-[#eae2d0] p-1.5 shadow-inner"
          role="status"
          aria-label={`Display mode: ${modeLabel}`}
        >
          <div
            className={`flex-1 rounded-full py-2.5 text-center text-[10px] font-bold uppercase tracking-widest ${
              type === "individual"
                ? "bg-gradient-to-br from-[#a33700] to-[#ff7943] text-white shadow-md"
                : "text-[#605b50]"
            }`}
          >
            Individual
          </div>
          <div
            className={`flex-1 rounded-full py-2.5 text-center text-[10px] font-bold uppercase tracking-widest ${
              type === "team"
                ? "bg-gradient-to-br from-[#a33700] to-[#ff7943] text-white shadow-md"
                : "text-[#605b50]"
            }`}
          >
            Squad
          </div>
        </div>

        {entries.length === 0 ? (
          <p
            className="rounded-xl bg-[#f8f0e0] px-4 py-8 text-center text-sm text-[#605b50]"
            role="status"
          >
            No scores for this round yet.
          </p>
        ) : (
          <ul className="space-y-3" aria-label="Rankings">
            {entries.map((entry, i) => {
              const rank = i + 1;
              const isYou =
                !!highlightName &&
                highlightName.localeCompare(entry.name, undefined, {
                  sensitivity: "base",
                }) === 0;
              const isTop = rank === 1;
              const isPodium = rank <= 3;

              return (
                <li
                  key={`${entry.name}-${i}`}
                  className={[
                    "flex items-center rounded-xl p-4 transition-colors",
                    isTop
                      ? "border-l-4 border-[#a33700] bg-white shadow-[0_8px_30px_rgba(163,55,0,0.07)]"
                      : isPodium
                        ? "bg-[#f8f0e0]/80 hover:bg-[#f8f0e0]"
                        : "bg-[#f8f0e0]/40 opacity-90",
                    isYou ? "ring-2 ring-[#ff7943] ring-offset-2 ring-offset-[#fef6e7]" : "",
                  ].join(" ")}
                >
                  <div
                    className={`flex w-10 shrink-0 items-center justify-center font-black italic tabular-nums ${
                      isTop
                        ? "text-2xl text-[#a33700]"
                        : isPodium
                          ? "text-xl text-[#605b50]"
                          : "text-base font-bold text-[#7c766a]"
                    }`}
                    style={{ fontFamily: fontHeadline }}
                  >
                    {rank}
                  </div>
                  <div
                    className={`relative ml-2 flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#eae2d0] to-[#e5dcc9] font-bold text-[#322e25] shadow-sm ${
                      isTop ? "h-14 w-14 text-lg" : isPodium ? "h-12 w-12 text-base" : "h-10 w-10 text-sm"
                    }`}
                    aria-hidden
                  >
                    {initialFromName(entry.name)}
                    {isTop ? (
                      <span
                        className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#b50552] text-[10px] text-white shadow-md"
                        aria-label="Top spot"
                      >
                        ★
                      </span>
                    ) : null}
                  </div>
                  <div className="ml-3 min-w-0 flex-1">
                    {isYou ? (
                      <p className="mb-0.5 text-[9px] font-bold uppercase italic tracking-widest text-[#a33700]">
                        You
                      </p>
                    ) : null}
                    <p
                      className={`truncate font-bold tracking-tight text-[#322e25] ${
                        isTop ? "text-lg" : isPodium ? "text-base" : "text-sm font-medium"
                      }`}
                      style={{ fontFamily: fontHeadline }}
                    >
                      {entry.name}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`font-extrabold tabular-nums ${
                        isTop
                          ? "text-xl text-[#b50552]"
                          : isPodium
                            ? "text-lg text-[#0e666a]"
                            : "text-base font-bold text-[#605b50]"
                      }`}
                      style={{ fontFamily: fontHeadline }}
                    >
                      {formatPoints(entry.score)}
                    </p>
                    <p className="mt-0.5 text-[9px] uppercase tracking-tighter text-[#605b50]/70">
                      pts
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
