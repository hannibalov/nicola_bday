import { Suspense } from "react";
import { Be_Vietnam_Pro, Epilogue } from "next/font/google";
import AdminPanel from "@/components/admin/AdminPanel";
import MobileLayout from "@/components/layout/MobileLayout";

const headline = Epilogue({
  subsets: ["latin"],
  weight: ["800", "900"],
  variable: "--font-admin-headline",
});

const body = Be_Vietnam_Pro({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-admin-body",
});

export default function AdminPage() {
  return (
    <MobileLayout>
      <div
        className={`${headline.variable} ${body.variable} relative -mx-4 -my-6 min-h-[calc(100dvh-3rem)] overflow-x-hidden bg-[#fef6e7] px-4 py-8 text-[#322e25]`}
        style={{ fontFamily: "var(--font-admin-body), ui-sans-serif, system-ui" }}
      >
        <div
          className="pointer-events-none fixed -top-24 -left-24 h-96 w-96 rounded-full bg-[#ff7943]/20 blur-[100px]"
          aria-hidden
        />
        <div
          className="pointer-events-none fixed top-1/2 -right-48 h-[28rem] w-[28rem] rounded-full bg-[#a6eff3]/30 blur-[120px]"
          aria-hidden
        />

        <div className="relative z-0 mx-auto w-full max-w-md pb-16 pt-4">
          <header className="mb-10 text-center">
            <p className="mb-6 inline-block rounded-full bg-[#0e666a]/12 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-[#0e666a]">
              Nicola&apos;s bash
            </p>
            <h1
              className="mb-4 text-4xl font-black uppercase leading-[0.9] tracking-tighter text-[#a33700] sm:text-5xl"
              style={{ fontFamily: "var(--font-admin-headline), ui-sans-serif, system-ui" }}
            >
              Host
              <br />
              <span
                className="text-transparent"
                style={{ WebkitTextStroke: "2px #a33700" }}
              >
                control
              </span>
            </h1>
            <p className="mx-auto max-w-sm text-base font-medium leading-relaxed text-[#605b50]">
              Advance the party, watch check-ins, and reset for rehearsal — same vibe as guest
              check-in, fewer glitter emergencies.
            </p>
          </header>

          <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-white p-8 shadow-[0_40px_100px_-20px_rgba(163,55,0,0.12)] sm:p-10">
            <div
              className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-[#a6eff3]/40"
              aria-hidden
            />
            <Suspense fallback={<p className="text-center text-sm font-medium text-[#605b50]">Loading…</p>}>
              <AdminPanel />
            </Suspense>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
