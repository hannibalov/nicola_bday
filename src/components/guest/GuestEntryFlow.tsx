"use client";

import {
  startTransition,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Be_Vietnam_Pro, Epilogue } from "next/font/google";
import NicknameForm from "./NicknameForm";
import PartyProtocolScreen from "./PartyProtocolScreen";
import {
  hasCompletedPartyProtocol,
  markPartyProtocolComplete,
} from "@/lib/clientStorage";
import { isProtocolGateBypassed } from "@/lib/partyProtocolGate";

const headline = Epilogue({
  subsets: ["latin"],
  weight: ["800", "900"],
  variable: "--font-checkin-headline",
});

const body = Be_Vietnam_Pro({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-checkin-body",
});

export default function GuestEntryFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showCheckIn, setShowCheckIn] = useState(false);
  const bypass = isProtocolGateBypassed(
    process.env.NEXT_PUBLIC_NICOLA_PROTOCOL_TEST,
    searchParams.get("protocolTest")
  );

  useLayoutEffect(() => {
    startTransition(() => {
      setShowCheckIn(hasCompletedPartyProtocol());
    });
  }, []);

  useEffect(() => {
    if (!showCheckIn) return;
    router.prefetch("/play");
  }, [showCheckIn, router]);

  if (!showCheckIn) {
    return (
      <PartyProtocolScreen
        phase="pre_check_in"
        gateBypass={bypass}
        onCompleted={() => {
          markPartyProtocolComplete();
          setShowCheckIn(true);
        }}
      />
    );
  }

  return (
    <div
      className={`${headline.variable} ${body.variable} relative -mx-4 -my-6 min-h-[calc(100dvh-3rem)] overflow-x-hidden bg-[#fef6e7] px-4 py-8 text-[#322e25]`}
      style={{
        fontFamily: "var(--font-checkin-body), ui-sans-serif, system-ui",
      }}
    >
      <div
        className="pointer-events-none fixed -top-24 -left-24 h-96 w-96 rounded-full bg-[#ff7943]/20 blur-[100px]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed top-1/2 -right-48 h-[28rem] w-[28rem] rounded-full bg-[#a6eff3]/30 blur-[120px]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed -bottom-32 left-1/2 h-64 w-full max-w-md -translate-x-1/2 bg-[#ff8faa]/10 blur-[80px]"
        aria-hidden
      />
      <div
        className="relative z-0 min-h-[min(100dvh,52rem)] bg-[length:40px_40px] [background-image:linear-gradient(to_right,rgba(163,55,0,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(163,55,0,0.05)_1px,transparent_1px)] pb-16 pt-4"
      >
        <header className="mb-10 text-center">
          <p className="mb-6 inline-block rounded-full bg-[#b50552]/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-[#b50552]">
            Nicola’s bash
          </p>
          <h1
            className="mb-6 text-5xl font-black uppercase leading-[0.88] tracking-tighter text-[#a33700] sm:text-6xl"
            style={{
              fontFamily: "var(--font-checkin-headline), ui-sans-serif",
            }}
          >
            Guest
            <br />
            <span
              className="text-transparent"
              style={{ WebkitTextStroke: "2px #a33700" }}
            >
              check-in
            </span>
          </h1>
          <p className="mx-auto max-w-sm text-base font-medium leading-relaxed text-[#605b50] sm:text-lg">
            Grab a ridiculous nickname — you’re on the list after the party
            protocol, so you’re almost in.
          </p>
        </header>

        <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-white p-8 shadow-[0_40px_100px_-20px_rgba(163,55,0,0.12)] sm:p-10">
          <div
            className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-[#a6eff3]/40"
            aria-hidden
          />
          <NicknameForm />
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3 px-1">
          <div className="flex items-center gap-2 rounded-full border border-[#b3ac9f]/15 bg-[#eae2d0] px-4 py-2">
            <span
              className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#b02500]"
              aria-hidden
            />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#322e25]">
              Live party session
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-[#0e666a] px-4 py-2 text-[#c8fcff]">
            <span aria-hidden>✶</span>
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Team games ahead
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
