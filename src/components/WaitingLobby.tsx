import GuestPlayShell from "./GuestPlayShell";

interface WaitingLobbyProps {
  title?: string;
  subtitle?: string;
}

export default function WaitingLobby({
  title = "Waiting for host",
  subtitle = "The host will start the next part when everyone is ready.",
}: WaitingLobbyProps) {
  const fontHeadline =
    "var(--font-guest-shell-headline), ui-sans-serif, system-ui";

  return (
    <GuestPlayShell statusLabel="Standing by">
      <div
        data-test-id="waiting-lobby"
        className="flex flex-col items-center pt-2 pb-8"
      >
        <section className="w-full max-w-lg">
          <div className="rounded-[2rem] bg-gradient-to-br from-[#ff9e5e] via-[#e67e22] to-[#a33700] p-1 shadow-xl shadow-orange-500/20">
            <div className="rounded-[1.85rem] bg-white/15 px-6 py-10 text-center backdrop-blur-md">
              <p
                className="mb-2 text-[10px] font-bold uppercase tracking-[0.4em] text-white/90"
                style={{ fontFamily: fontHeadline }}
              >
                Next session
              </p>
              <h2
                className="text-2xl font-black uppercase italic leading-tight tracking-tighter text-white sm:text-3xl [text-shadow:0_0_15px_rgba(230,126,34,0.45)]"
                style={{ fontFamily: fontHeadline }}
              >
                {title}
              </h2>
              <p className="mt-4 text-sm font-medium leading-relaxed text-white/85">
                {subtitle}
              </p>
            </div>
          </div>
        </section>
      </div>
    </GuestPlayShell>
  );
}
