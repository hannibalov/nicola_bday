"use client";

import { Be_Vietnam_Pro, Epilogue } from "next/font/google";

const headline = Epilogue({
  subsets: ["latin"],
  weight: ["800", "900"],
  variable: "--font-guest-shell-headline",
});

const body = Be_Vietnam_Pro({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-guest-shell-body",
});

export type GuestPlayShellProps = {
  children: React.ReactNode;
  /** Short uppercase status next to the pulse (e.g. syncing, standing by). */
  statusLabel: string;
};

/**
 * Shared guest play chrome: warm backdrop, noise, glass header — used with
 * {@link LobbyScreen} and the rest of the guest play flow.
 */
export default function GuestPlayShell({
  children,
  statusLabel,
}: GuestPlayShellProps) {
  const fontBody = "var(--font-guest-shell-body), ui-sans-serif, system-ui";
  const fontHeadline = "var(--font-guest-shell-headline), ui-sans-serif, system-ui";

  return (
    <div
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

      <header className="relative z-10 mb-6 flex items-center justify-between gap-3 rounded-2xl border border-orange-100 bg-white/70 px-4 py-3 shadow-sm shadow-orange-500/5 backdrop-blur-xl">
        <div>
          <h1
            className="text-xl font-black uppercase italic tracking-tighter text-[#e67e22]"
            style={{ fontFamily: fontHeadline }}
          >
            Vice & Vices
          </h1>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#22c55e] animate-pulse"
              aria-hidden
            />
            <p
              className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#0e666a]"
              style={{ fontFamily: fontHeadline }}
            >
              {statusLabel}
            </p>
          </div>
        </div>
      </header>

      <div className="relative z-10">{children}</div>
    </div>
  );
}
