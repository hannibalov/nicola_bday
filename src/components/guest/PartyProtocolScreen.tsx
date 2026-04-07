"use client";

import Image from "next/image";
import { Be_Vietnam_Pro, Epilogue } from "next/font/google";
import { useEffect, useState } from "react";
import PrimaryActionButton from "@/components/game/PrimaryActionButton";
import { markPartyProtocolComplete } from "@/lib/clientStorage";
import {
  countdownToPartyEventParts,
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
}

export default function PartyProtocolScreen({
  onCompleted,
  phase,
}: PartyProtocolScreenProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const { days, hours, minutes } = countdownToPartyEventParts(nowMs);

  function handleContinue() {
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

      <header className="relative z-10 mb-6" aria-labelledby="party-welcome-heading">
        <section className="relative py-6 sm:py-8">
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
                  official page
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
      </header>

      <div className="relative z-10 mb-6 space-y-3">
        <h2
          className="text-4xl font-black uppercase italic leading-[0.9] tracking-tighter text-[#322e25] sm:text-5xl"
          style={{ fontFamily: fontHeadline }}
        >
          Venue
          <br />
          <span className="text-[#ff7943]">&amp; logistics</span>
        </h2>
      </div>

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
          Until kickoff · Sat 11 Apr 2026, 8:00 PM (Barcelona)
          <time dateTime={PARTY_EVENT_START_ISO} className="sr-only">
            2026-04-11T20:00:00+02:00
          </time>
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
              <strong className="text-[#322e25]">Carrer de la Diputació, 215 </strong> in
              Barcelona. Tap for directions.
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

      <div className="relative z-10 mt-8 mb-6 space-y-3">
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
          <div className="space-y-4 p-7">
            <p className="text-xs font-bold uppercase tracking-widest text-[#0e666a]">
              Theme
            </p>
            <h2
              className="text-2xl font-bold uppercase italic text-[#322e25] sm:text-3xl"
              style={{ fontFamily: fontHeadline }}
            >
              Vice &amp; Vices
            </h2>
            <blockquote className="border-l-4 border-[#b50552]/45 pl-4 text-base font-medium italic leading-relaxed text-[#322e25]">
              &ldquo;Reality doesn&apos;t impress me. I believe in intoxication,
              in ecstasy, and when ordinary life shackles me, I escape, one way
              or another.&rdquo;
              <footer className="mt-3 text-sm font-bold not-italic text-[#605b50]">
                — Anaïs Nin
              </footer>
            </blockquote>
            <p className="text-base font-medium leading-relaxed text-[#605b50]">
              What&apos;s your reality avoiding indulgence? Dress as your
              vice….
            </p>
            <ul className="space-y-2.5 text-sm font-medium leading-snug text-[#605b50]">
              <li>
                <strong className="text-[#322e25]">Lust</strong> — leather,
                lace, sexy
              </li>
              <li>
                <strong className="text-[#322e25]">Greed</strong> — gold chains,
                cash aesthetic
              </li>
              <li>
                <strong className="text-[#322e25]">Gluttony</strong> — excess
                &amp; indulgence
              </li>
              <li>
                <strong className="text-[#322e25]">Pride</strong> — over-the-top
                glam
              </li>
              <li>
                <strong className="text-[#322e25]">Sloth</strong> — tracksuit,
                onesie, PJs
              </li>
              <li>
                <strong className="text-[#322e25]">Envy</strong> — sneaky,
                paranoid
              </li>
              <li>
                <strong className="text-[#322e25]">Wrath</strong> — stern,
                black, angry
              </li>
            </ul>
            <p className="text-xs font-semibold leading-relaxed text-[#605b50]/90">
              The theme is a bit of dress-up fun — if it stresses you out, skip
              it!
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
              <span>Charge your phone — you&apos;ll need it for the games!</span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden>✓</span>
              <span>In team rounds, huddle fast when you see teammate names.</span>
            </li>
            <li className="flex gap-3 opacity-80">
              <span aria-hidden>✗</span>
              <span>No need for real names — we already love your alias.</span>
            </li>
          </ul>
        </section>
      </div>

      <section className="relative z-10 mt-12 space-y-5 text-center">
        <PrimaryActionButton
          type="button"
          variant="gradient"
          onClick={handleContinue}
          data-test-id="party-protocol-continue"
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
