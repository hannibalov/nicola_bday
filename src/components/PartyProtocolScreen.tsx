"use client";

import Image from "next/image";
import { Be_Vietnam_Pro, Epilogue } from "next/font/google";
import { useEffect, useState } from "react";
import PrimaryActionButton from "@/components/game/PrimaryActionButton";
import { markPartyProtocolComplete } from "@/lib/clientStorage";
import {
  countdownToPartyEventParts,
  isProtocolContinueUnlocked,
  PARTY_EVENT_START_ISO,
  PARTY_MAPS_URL,
} from "@/lib/partyProtocolGate";

const headline = Epilogue({
  subsets: ["latin"],
  weight: ["800", "900"],
  variable: "--font-protocol-headline",
});

const body = Be_Vietnam_Pro({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-protocol-body",
});

export type PartyProtocolPhase = "pre_check_in" | "post_check_in";

export interface PartyProtocolScreenProps {
  onCompleted: () => void;
  phase: PartyProtocolPhase;
  /** When true, advance is allowed regardless of calendar (query param / env). */
  gateBypass: boolean;
}

export default function PartyProtocolScreen({
  onCompleted,
  phase,
  gateBypass,
}: PartyProtocolScreenProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const continueUnlocked =
    gateBypass || isProtocolContinueUnlocked(nowMs);
  const { days, hours, minutes } = countdownToPartyEventParts(nowMs);

  function handleContinue() {
    if (!continueUnlocked) return;
    markPartyProtocolComplete();
    onCompleted();
  }

  const fontBody = "var(--font-protocol-body), ui-sans-serif, system-ui";
  const fontHeadline = "var(--font-protocol-headline), ui-sans-serif, system-ui";

  const preCheckIn = phase === "pre_check_in";

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
        className="pointer-events-none absolute top-20 -right-10 h-64 w-64 rounded-full bg-[#b50552]/10 blur-3xl"
        aria-hidden
      />

      <header className="relative z-10 mb-10">
        <section
          className="relative overflow-hidden rounded-2xl border border-[#322e25]/10 bg-gradient-to-br from-white/90 to-[#f8f0e0]/90 px-6 py-8 shadow-sm sm:px-8 sm:py-10"
          aria-labelledby="party-welcome-heading"
        >
          <p
            className="mb-4 inline-block rounded-full bg-[#b50552]/12 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-[#b50552]"
            style={{ fontFamily: fontHeadline }}
          >
            Nicola&apos;s bash · Saturday 11 April · Barcelona
          </p>
          <h1
            id="party-welcome-heading"
            className="text-4xl font-black uppercase italic leading-[0.95] tracking-tighter text-[#322e25] sm:text-5xl"
            style={{ fontFamily: fontHeadline }}
          >
            Welcome to Nicola&apos;s
            <br />
            <span className="text-[#ff7943]">birthday bash</span>
          </h1>
          <p className="mt-4 text-lg font-bold leading-snug text-[#322e25] sm:text-xl">
            {preCheckIn
              ? "This site is your companion for the party."
              : "You're checked in — quick recap below."}
          </p>
          {preCheckIn ? (
            <>
              <p className="mt-5 max-w-xl text-base font-medium leading-relaxed text-[#605b50]">
                You&apos;re on the{" "}
                <strong className="font-semibold text-[#322e25]">
                  official games page
                </strong>{" "}
                for Nicola&apos;s celebration: team trivia, music bingo, live
                scores, and prompts that stay in sync when the host moves the
                night forward.
              </p>
              <p className="mt-4 max-w-xl text-sm font-medium leading-relaxed text-[#605b50]">
                Nothing to install — keep your browser tab open. Scroll on for
                where we&apos;re meeting, the countdown to doors, then the
                party protocol (how we play together).
              </p>
            </>
          ) : (
            <p className="mt-5 max-w-xl text-base font-medium leading-relaxed text-[#605b50]">
              Venue, countdown, and the party protocol are below. After you tap
              continue you&apos;ll wait in the lobby until the host opens game
              one.
            </p>
          )}
        </section>

        <p
          className="mt-8 text-xs font-bold uppercase tracking-[0.3em] text-[#a33700]"
          style={{ fontFamily: fontHeadline }}
        >
          Next · logistics &amp; how we play
        </p>
      </header>

      <div className="relative z-10 mb-8 grid grid-cols-3 gap-2 rounded-2xl bg-[#322e25] px-4 py-5 text-center text-[#fef6e7]">
        <div>
          <p
            className="text-3xl font-black tabular-nums sm:text-4xl"
            style={{ fontFamily: fontHeadline }}
            data-test-id="protocol-countdown-days"
          >
            {days}
          </p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-[#fef6e7]/70">
            days
          </p>
        </div>
        <div>
          <p
            className="text-3xl font-black tabular-nums sm:text-4xl"
            style={{ fontFamily: fontHeadline }}
            data-test-id="protocol-countdown-hours"
          >
            {hours}
          </p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-[#fef6e7]/70">
            hours
          </p>
        </div>
        <div>
          <p
            className="text-3xl font-black tabular-nums sm:text-4xl"
            style={{ fontFamily: fontHeadline }}
            data-test-id="protocol-countdown-minutes"
          >
            {minutes}
          </p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-[#fef6e7]/70">
            minutes
          </p>
        </div>
        <p className="col-span-3 mt-2 text-[10px] font-medium leading-snug text-[#fef6e7]/85">
          Until kickoff · Sat 11 Apr 2026, 8:00 PM (Barcelona) ·{" "}
          <time dateTime={PARTY_EVENT_START_ISO} className="sr-only">
            2026-04-11T20:00:00+02:00
          </time>
          doors open with the host from 8pm
        </p>
      </div>

      <div className="relative z-10 grid grid-cols-1 gap-5">
        <section className="overflow-hidden rounded-xl bg-[#eae2d0]">
          <div className="relative aspect-[16/10] w-full bg-[#d8d0c4]">
            <Image
              src="/images/venue.png"
              alt="Miles — cocktails, music, and billiards in Barcelona"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 28rem"
              priority
            />
          </div>
          <div className="space-y-4 p-7">
            <p className="text-xs font-bold uppercase tracking-widest text-[#0e666a]">
              Date & place
            </p>
            <h2
              className="text-2xl font-bold uppercase italic text-[#322e25] sm:text-3xl"
              style={{ fontFamily: fontHeadline }}
            >
              Saturday 11 April · 8:00 PM
            </h2>
            <p className="text-base font-medium leading-relaxed text-[#605b50]">
              We’re meeting at{" "}
              <strong className="text-[#322e25]">Miles</strong> on{" "}
              <strong className="text-[#322e25]">Carrer de Rocafort</strong> in
              Barcelona. Tap for walking directions.
            </p>
            <a
              href={PARTY_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#a33700] underline decoration-[#a33700]/35 underline-offset-4"
              data-test-id="party-maps-link"
            >
              Open in Google Maps
              <span aria-hidden>↗</span>
            </a>
          </div>
        </section>
      </div>

      <div className="relative z-10 mt-2 mb-6 space-y-3">
        <div className="flex items-center gap-4">
          <div className="h-0.5 w-12 bg-[#b50552]" aria-hidden />
          <p className="text-xs font-bold uppercase tracking-widest text-[#605b50]">
            How tonight works
          </p>
        </div>
        <h2
          className="text-4xl font-black uppercase italic leading-[0.9] tracking-tighter text-[#322e25] sm:text-5xl"
          style={{ fontFamily: fontHeadline }}
        >
          Party
          <br />
          <span className="text-[#ff7943]">protocol</span>
        </h2>
        <p className="max-w-xl text-sm font-medium text-[#605b50]">
          Ground rules and tips — after this block you&apos;ll be ready to check
          in or join the waiting room.
        </p>
      </div>

      <div className="relative z-10 grid grid-cols-1 gap-5">
        <section className="flex flex-col justify-between rounded-xl bg-[#f8f0e0] p-7">
          <div>
            <span className="mb-5 block text-4xl text-[#a33700]" aria-hidden>
              📱
            </span>
            <h2
              className="text-2xl font-black uppercase text-[#322e25] sm:text-3xl"
              style={{ fontFamily: fontHeadline }}
            >
              One phone,
              <br />
              one nickname
            </h2>
          </div>
          <p className="mt-6 text-sm font-medium leading-relaxed text-[#605b50]">
            Stay close to this tab if you can — this is how we show questions,
            bingo, and scores. The host drives the evening; your screen updates
            when they advance.
          </p>
        </section>

        <section className="overflow-hidden rounded-xl bg-[#eae2d0]">
          <div className="h-36 bg-gradient-to-br from-[#a33700]/25 via-[#ff7943]/20 to-[#a6eff3]/30" />
          <div className="space-y-3 p-7">
            <p className="text-xs font-bold uppercase tracking-widest text-[#0e666a]">
              The vibe
            </p>
            <h2
              className="text-2xl font-bold uppercase italic text-[#322e25] sm:text-3xl"
              style={{ fontFamily: fontHeadline }}
            >
              Nicola’s bash · ’70s & disco energy
            </h2>
            <p className="text-base font-medium leading-relaxed text-[#605b50]">
              Think bold colours, silly teams, and loud music between rounds.
              Team games use <strong className="text-[#322e25]">majority</strong>{" "}
              on phones — you’ll match answers with teammates after a short
              countdown so you know who’s with you.
            </p>
          </div>
        </section>

        <section className="rounded-xl bg-gradient-to-br from-[#b50552] to-[#a00047] p-8 text-[#ffeff0]">
          <span className="mb-4 block text-4xl" aria-hidden>
            ✦
          </span>
          <h2
            className="mb-4 text-2xl font-bold uppercase sm:text-3xl"
            style={{ fontFamily: fontHeadline }}
          >
            Quick tips
          </h2>
          <ul className="space-y-3 text-sm font-medium">
            <li className="flex gap-3">
              <span aria-hidden>✓</span>
              <span>Charge your phone — it’s your buzzer all night.</span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden>✓</span>
              <span>In team rounds, huddle fast when you see teammate names.</span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden>✓</span>
              <span>Bingo is on your honour; have fun calling lines.</span>
            </li>
            <li className="flex gap-3 opacity-80">
              <span aria-hidden>✗</span>
              <span>No need for real names — we already love your alias.</span>
            </li>
          </ul>
        </section>
      </div>

      <section className="relative z-10 mt-12 space-y-5 text-center">
        {!continueUnlocked && (
          <p
            className="text-xs font-bold uppercase tracking-wide text-[#a33700]"
            data-test-id="protocol-locked-hint"
          >
            You’ll be able to continue from 11 Apr 2026, 12:01 AM (Barcelona).
          </p>
        )}
        {gateBypass && (
          <p
            className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0e666a]"
            data-test-id="protocol-bypass-active"
          >
            Test mode · date lock bypassed
          </p>
        )}
        <PrimaryActionButton
          type="button"
          variant="gradient"
          onClick={handleContinue}
          disabled={!continueUnlocked}
          data-test-id="party-protocol-continue"
          aria-disabled={!continueUnlocked}
        >
          <span className="text-2xl font-black uppercase italic tracking-tighter">
            Let&apos;s party
          </span>
          <span className="text-2xl leading-none" aria-hidden>
            →
          </span>
        </PrimaryActionButton>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#605b50]">
          {preCheckIn
            ? "Tap continue, then choose your nickname"
            : "Tap continue to join the waiting room for game one"}
        </p>
      </section>
    </div>
  );
}
