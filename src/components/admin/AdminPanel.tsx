"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { GuestStep, SessionState } from "@/types";
import { gameSlotFromGuestStep, getNextGuestStep } from "@/types";
import { guestStepLabel, nextGuestStepLabel } from "@/lib/guestStepLabels";
import { createAdaptivePoller } from "@/lib/adaptivePolling";
import {
  shouldAdminPanelUseEventSource,
  parseSsePayload,
} from "@/lib/sessionSyncTransport";
import PrimaryActionButton from "@/components/game/PrimaryActionButton";

function adminFetchHeaders(key: string): HeadersInit {
  return {
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "x-admin-key": key.trim(),
  };
}

const inputClassName =
  "w-full rounded-sm border-0 bg-[#eae2d0] px-6 py-5 text-xl font-bold text-[#322e25] outline-none transition-all placeholder:text-[#b3ac9f] focus:ring-2 focus:ring-[#a33700]/20 disabled:opacity-60";

export default function AdminPanel() {
  const searchParams = useSearchParams();
  const keyFromUrl = searchParams.get("key");
  const [state, setState] = useState<SessionState | null>(null);
  const [draftKey, setDraftKey] = useState(keyFromUrl ?? "");
  const [committedKey, setCommittedKey] = useState(() => keyFromUrl?.trim() ?? "");
  const [authError, setAuthError] = useState(false);
  const [actionError, setActionError] = useState("");
  const [loadingAdvance, setLoadingAdvance] = useState(false);
  const [loadingBingoSong, setLoadingBingoSong] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);
  const [justAdvanced, setJustAdvanced] = useState(false);

  /**
   * Track the last revision received from admin state so SSE messages with the
   * same revision do not trigger unnecessary re-fetches.
   */
  const lastKnownRevision = useRef<number>(-1);
  const lastKnownStep = useRef<string>("");


  useEffect(() => {
    if (keyFromUrl) {
      setDraftKey(keyFromUrl);
      setCommittedKey(keyFromUrl.trim());
    }
  }, [keyFromUrl]);

  const fetchState = useCallback(() => {
    if (!committedKey.trim()) return;
    fetch("/api/admin/state", {
      cache: "no-store",
      headers: adminFetchHeaders(committedKey),
    })
      .then((res) => {
        if (res.status === 401) {
          setAuthError(true);
          setState(null);
          setCommittedKey("");
          return null;
        }
        if (!res.ok) throw new Error("Failed");
        setAuthError(false);
        return res.json();
      })
      .then((data: SessionState | null) => {
        if (data) {
          lastKnownRevision.current = data.revision;
          lastKnownStep.current = data.guestStep;
          setState(data);
          setAuthError(false);
        }

      })
      .catch(() => setState(null));
  }, [committedKey]);

  useEffect(() => {
    if (!committedKey.trim()) return;
    fetchState();
    let es: EventSource | null = null;
    let poller: ReturnType<typeof createAdaptivePoller> | null = null;
    const useSse = shouldAdminPanelUseEventSource();

    if (!useSse) {
      poller = createAdaptivePoller(fetchState, 4000, 30000);
      poller.start();
    } else {
      try {
        es = new EventSource("/api/events");
        es.onmessage = (ev: MessageEvent) => {
          const payload = parseSsePayload(ev.data as string);
          if (!payload) return;

          // Optimization: update basic counters immediately from SSE without a fetch roundtrip.
          setState((prev) => {
            if (!prev) return null;
            // Only update if something actually changed to avoid redundant React renders.
            if (
              prev.players.length === payload.playerCount &&
              prev.revision === payload.revision &&
              prev.guestStep === payload.guestStep
            ) {
              return prev;
            }
            return {
              ...prev,
              revision: payload.revision,
              guestStep: payload.guestStep,
              // We don't have the full player list here, just the count.
              // To avoid a UI mismatch, we create a placeholder array if needed.
              // This ensures the counter displays the live number instantly.
              players:
                prev.players.length === payload.playerCount
                  ? prev.players
                  : Array.from({ length: payload.playerCount }, (_, i) => ({
                      id: `sse-${i}`,
                      nickname: prev.players[i]?.nickname ?? "Connecting…",
                    })),
            };
          });

          // Only fetch full drill-down state if revision or step changed.
          // Player count changes don't require full re-fetch of nicknames immediately.
          if (
            payload.revision > lastKnownRevision.current ||
            payload.guestStep !== lastKnownStep.current
          ) {
            fetchState();
          }
        };

        es.onerror = () => {
          es?.close();
          es = null;
          // Fall back to adaptive polling; do NOT try to reopen SSE to avoid loops.
          if (poller == null) {
            poller = createAdaptivePoller(fetchState, 4000, 30000);
            poller.start();
          }
        };
      } catch {
        poller = createAdaptivePoller(fetchState, 4000, 30000);
        poller.start();
      }
    }
    return () => {
      es?.close();
      poller?.stop();
    };
  }, [committedKey, fetchState]);

  function handleCommitKey(e?: React.FormEvent) {
    e?.preventDefault();
    const next = draftKey.trim();
    if (!next) return;
    setAuthError(false);
    setCommittedKey(next);
  }

  async function handleStartNext() {
    setActionError("");
    setJustAdvanced(false);
    setLoadingAdvance(true);
    try {
      const res = await fetch("/api/admin/start-next", {
        method: "POST",
        headers: adminFetchHeaders(committedKey),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError((data as { error?: string }).error ?? "Failed to advance");
        return;
      }
      setJustAdvanced(true);
      setTimeout(() => setJustAdvanced(false), 1500);
      fetchState();
    } catch {
      setActionError("Network error");
    } finally {
      setLoadingAdvance(false);
    }
  }

  async function handleBingoAdvanceSong() {
    if (!committedKey.trim()) return;
    setActionError("");
    setLoadingBingoSong(true);
    try {
      const res = await fetch("/api/admin/bingo-advance-song", {
        method: "POST",
        headers: adminFetchHeaders(committedKey),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError((data as { error?: string }).error ?? "Could not advance song");
        return;
      }
      fetchState();
    } catch {
      setActionError("Network error");
    } finally {
      setLoadingBingoSong(false);
    }
  }

  async function handleReset() {
    if (
      !window.confirm(
        "Reset the entire session? All guest registrations and scores will be cleared."
      )
    ) {
      return;
    }
    setActionError("");
    setLoadingReset(true);
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: adminFetchHeaders(committedKey),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError((data as { error?: string }).error ?? "Reset failed");
        return;
      }
      fetchState();
    } catch {
      setActionError("Network error");
    } finally {
      setLoadingReset(false);
    }
  }

  if (!committedKey.trim()) {
    return (
      <form
        onSubmit={handleCommitKey}
        className="relative z-10 flex flex-col gap-8"
        noValidate
      >
        {authError && (
          <p className="text-center text-sm font-medium text-[#b02500]" role="alert">
            Invalid admin key. Adjust the key or URL and try again.
          </p>
        )}
        <div>
          <label
            htmlFor="admin-key"
            className="mb-4 block text-left text-xs font-bold uppercase tracking-[0.2em] text-[#605b50]"
          >
            Admin key
          </label>
          <p className="mb-4 text-left text-sm font-medium text-[#322e25]/80">
            Paste your host key once, then continue. Live session traffic only starts after you
            confirm — typing in the field won&apos;t hammer the server.
          </p>
          <div className="group relative">
            <input
              id="admin-key"
              type="password"
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              placeholder="Enter key"
              className={inputClassName}
              autoComplete="off"
              data-test-id="admin-key-input"
            />
            <div
              className="pointer-events-none absolute inset-0 rounded-sm border-2 border-[#a33700] opacity-0 transition-opacity group-focus-within:opacity-[0.12]"
              aria-hidden
            />
          </div>
        </div>
        <p className="text-center text-xs font-medium leading-relaxed text-[#605b50]">
          Tip: open with{" "}
          <code className="rounded bg-[#eae2d0] px-1.5 py-0.5 font-mono text-[0.7rem] text-[#322e25]">
            ?key=…
          </code>{" "}
          or use the <span className="font-bold text-[#322e25]">x-admin-key</span> header from
          scripts if you avoid query strings in production.
        </p>
        <PrimaryActionButton
          type="submit"
          disabled={!draftKey.trim()}
          data-test-id="admin-continue"
        >
          Continue
          <span className="text-2xl leading-none" aria-hidden>
            →
          </span>
        </PrimaryActionButton>
      </form>
    );
  }

  if (!state) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <span
          className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-[#a33700]"
          aria-hidden
        />
        <p className="text-sm font-medium text-[#605b50]">Syncing session…</p>
      </div>
    );
  }

  const activeSlot = gameSlotFromGuestStep(state.guestStep);
  const LOBBY_WITH_SCHEDULE_STEP = new Set<GuestStep>([
    "lobby_trivia",
    "lobby_bingo",
    "lobby_quotes",
  ]);
  const schedulePending =
    LOBBY_WITH_SCHEDULE_STEP.has(state.guestStep) &&
    state.scheduledGameStartsAtEpochMs != null;
  const canAdvance =
    getNextGuestStep(state.guestStep) != null && !schedulePending;
  const nextLabel = nextGuestStepLabel(state.guestStep);
  const currentLabel = guestStepLabel(state.guestStep);

  const startNextLabel =
    !canAdvance && schedulePending
      ? "Countdown running — game opens automatically"
      : LOBBY_WITH_SCHEDULE_STEP.has(state.guestStep) &&
          state.scheduledGameStartsAtEpochMs == null
        ? "Start lobby countdown (60s)"
        : canAdvance && nextLabel
          ? `Advance → ${nextLabel}`
          : "Party complete";

  return (
    <div className="flex flex-col gap-8 text-[#322e25]">
      <header className="space-y-2 border-b border-[#b3ac9f]/25 pb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#0e666a]">
          Host · live control
        </p>
        <p className="text-sm font-medium text-[#605b50]">
          Event stream with automatic fallback polling (~2s) if the connection drops.
        </p>
      </header>

      <section
        className="rounded-2xl border border-[#b3ac9f]/20 bg-gradient-to-br from-[#eae2d0]/80 to-[#fef6e7] px-5 py-6 text-center shadow-[0_20px_50px_-24px_rgba(163,55,0,0.2)]"
        aria-label="Connected players"
      >
        <p
          data-test-id="admin-player-count"
          className="text-5xl font-black tabular-nums text-[#a33700]"
        >
          {state.players.length}
        </p>
        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-[#605b50]">
          {state.players.length === 1 ? "player connected" : "players connected"}
        </p>
      </section>

      <section className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#605b50]">
          Current step
        </p>
        <p className="text-lg font-bold leading-snug text-[#322e25]">{currentLabel}</p>
        <p className="text-xs font-medium text-[#605b50]">
          Revision {state.revision}
          {activeSlot != null
            ? ` · Game slot ${activeSlot + 1} / ${state.games.length}`
            : ""}
        </p>
      </section>

      {state.guestStep === "game_bingo" && state.bingoSongOrder.length > 0 ? (
        <section
          data-test-id="admin-bingo-deck"
          className="space-y-3 rounded-2xl border border-[#0e666a]/30 bg-[#e8f8f9] p-4"
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0e666a]">
            Now playing · music bingo
          </p>
          <p className="text-lg font-bold leading-snug text-[#322e25]">
            {state.bingoSongOrder[state.bingoCurrentSongIndex] ?? "—"}
          </p>
          <p className="text-xs font-medium text-[#605b50]">
            Track {state.bingoCurrentSongIndex + 1} / {state.bingoSongOrder.length} · guests
            only tap when this title is what&apos;s in the room
          </p>
          {state.bingoRoundEndsAtEpochMs != null ? (
            <p className="text-xs font-medium text-[#605b50]">
              Round ends automatically at{" "}
              {new Date(state.bingoRoundEndsAtEpochMs).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              (15 min), then scores lock for the leaderboard.
            </p>
          ) : null}
          <PrimaryActionButton
            type="button"
            onClick={() => void handleBingoAdvanceSong()}
            disabled={
              loadingBingoSong ||
              state.bingoCurrentSongIndex >= state.bingoSongOrder.length - 1
            }
            data-test-id="admin-bingo-advance-song"
            variant="gradient"
          >
            {loadingBingoSong
              ? "…"
              : state.bingoCurrentSongIndex >= state.bingoSongOrder.length - 1
                ? "Last song — at end of list"
                : "Advance to next song →"}
          </PrimaryActionButton>
        </section>
      ) : null}

      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#605b50]">
          Nicknames
        </p>
        <ul className="list-inside list-disc space-y-0.5 text-sm font-medium text-[#322e25]/90">
          {state.players.length === 0 ? (
            <li className="list-none text-[#605b50]">No one has checked in yet.</li>
          ) : (
            state.players.map((p) => <li key={p.id}>{p.nickname}</li>)
          )}
        </ul>
      </section>

      {state.teams.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#605b50]">
            Teams (server)
          </p>
          <ul className="space-y-2 text-sm">
            {state.teams.map((t) => (
              <li key={t.id}>
                <span className="font-bold text-[#322e25]">{t.name}:</span>{" "}
                <span className="font-medium text-[#605b50]">
                  {t.playerIds
                    .map((id) => state.players.find((p) => p.id === id)?.nickname ?? "?")
                    .join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {actionError && (
        <p className="text-center text-sm font-medium text-[#b02500]" role="alert">
          {actionError}
        </p>
      )}
      {justAdvanced && (
        <p className="text-center text-sm font-bold text-[#0e666a]">
          Guests should update within a second.
        </p>
      )}

      <div className="flex flex-col gap-3 pt-2">
        <PrimaryActionButton
          type="button"
          onClick={handleStartNext}
          disabled={loadingAdvance || !canAdvance}
          aria-busy={loadingAdvance}
          data-test-id="admin-start-next"
        >
          {loadingAdvance ? "Advancing…" : startNextLabel}
        </PrimaryActionButton>

        <button
          type="button"
          onClick={handleReset}
          disabled={loadingReset}
          aria-busy={loadingReset}
          data-test-id="admin-reset-session"
          className="w-full rounded-full border-2 border-[#b02500]/35 bg-transparent py-4 text-sm font-bold uppercase tracking-wide text-[#b02500] transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {loadingReset ? "Resetting…" : "Reset session (rehearsal)"}
        </button>
      </div>
    </div>
  );
}
