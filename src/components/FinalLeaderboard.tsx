"use client";

import { Be_Vietnam_Pro, Epilogue } from "next/font/google";

const headline = Epilogue({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-fl-headline",
});

const body = Be_Vietnam_Pro({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fl-body",
});

function initialFromNickname(nick: string): string {
  const t = nick.trim();
  if (!t) return "?";
  return t[0]!.toUpperCase();
}

function formatPoints(n: number): string {
  return n.toLocaleString("en-GB");
}

export interface FinalLeaderboardProps {
  entries: { nickname: string; totalScore: number }[];
  highlightNickname?: string | null;
}

export default function FinalLeaderboard({
  entries,
  highlightNickname,
}: FinalLeaderboardProps) {
  const fontBody = "var(--font-fl-body), ui-sans-serif, system-ui";
  const fontHeadline = "var(--font-fl-headline), ui-sans-serif, system-ui";

  return (
    <div
      data-test-id="final-leaderboard"
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
              Nicola birthday
            </span>
            <h1
              className="text-4xl font-black uppercase italic leading-none tracking-tighter drop-shadow-sm sm:text-5xl"
              style={{ fontFamily: fontHeadline }}
            >
              Final leaderboard
            </h1>
            <div className="mt-5 flex items-center gap-2 rounded-full border border-white/15 bg-black/10 px-4 py-1.5 backdrop-blur-md">
              <span className="text-xs" aria-hidden>
                🏆
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest">
                Total standings
              </span>
            </div>
          </div>
        </section>

        {entries.length === 0 ? (
          <p
            className="rounded-xl bg-[#f8f0e0] px-4 py-8 text-center text-sm text-[#605b50]"
            role="status"
          >
            No final scores yet.
          </p>
        ) : (
          <ul className="space-y-3" aria-label="Final rankings">
            {entries.map((entry, i) => {
              const rank = i + 1;
              const isYou =
                !!highlightNickname &&
                highlightNickname.localeCompare(entry.nickname, undefined, {
                  sensitivity: "base",
                }) === 0;
              const isTop = rank === 1;
              const isPodium = rank <= 3;

              return (
                <li
                  key={`${entry.nickname}-${i}`}
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
                    {initialFromNickname(entry.nickname)}
                    {isTop ? (
                      <span
                        className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#b50552] text-[10px] text-white shadow-md"
                        aria-label="Champion"
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
                      {entry.nickname}
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
                      {formatPoints(entry.totalScore)}
                    </p>
                    <p className="mt-0.5 text-[9px] uppercase tracking-tighter text-[#605b50]/70">
                      total pts
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
