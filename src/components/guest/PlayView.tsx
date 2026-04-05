"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { PublicState } from "@/types";
import {
  clearGuestRegistrationForRejoin,
  getGuestNicknameForClient,
  hasCompletedPartyProtocol,
  setLastKnownStep,
} from "@/lib/clientStorage";
import { guestFetch } from "@/lib/guestFetch";
import { createAdaptivePoller } from "@/lib/adaptivePolling";
import GuestPlayShell from "@/components/layout/GuestPlayShell";
import WaitingLobby from "./WaitingLobby";
import MusicBingoScreen from "./MusicBingoScreen";
import TriviaGameScreen from "./TriviaGameScreen";
import IdentifyQuoteGameScreen from "./IdentifyQuoteGameScreen";
import GameLeaderboard from "./GameLeaderboard";
import FinalLeaderboard from "./FinalLeaderboard";
import PartyProtocolScreen from "./PartyProtocolScreen";
import LobbyScreen from "./LobbyScreen";
import { isProtocolGateBypassed } from "@/lib/partyProtocolGate";
import { buildProtocolTestPreserveQuery } from "@/lib/protocolTestMode";
import {
  shouldGuestPlayViewUseWebSocket,
  parseWebSocketPayload,
} from "@/lib/sessionSyncTransport";
import { sortLeaderboardEntries } from "@/lib/leaderboardSort";
import { buildTeamLeaderboardEntries } from "@/lib/store";

export default function PlayView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<PublicState | null>(null);
  const [loading, setLoading] = useState(true);
  const [protocolLocalComplete, setProtocolLocalComplete] = useState(false);
  const [viewerNickname, setViewerNickname] = useState<string | null>(null);
  const protocolGateBypass = isProtocolGateBypassed(
    process.env.NEXT_PUBLIC_NICOLA_PROTOCOL_TEST,
    searchParams.get("protocolTest")
  );

  /**
   * Track the last revision we received from the server to avoid redundant
   * re-fetches when an SSE message carries the same revision we already have.
   */
  const lastKnownRevision = useRef<number>(-1);
  const lastKnownStep = useRef<string>("");


  useLayoutEffect(() => {
    startTransition(() => {
      setProtocolLocalComplete(hasCompletedPartyProtocol());
      setViewerNickname(getGuestNicknameForClient(searchParams));
    });
  }, [searchParams]);

  /**
   * Resilience: if the server restarts, players are unknown until they re-register.
   * To avoid booting everyone on a brief cold start or transient glitch, we only
   * redirect after 2 consecutive 'unknown' responses.
   */
  const unknownSessionAttempts = useRef<number>(0);

  const handleIncomingState = useCallback(
    (data: PublicState | null) => {
      if (!data) {
        setState(null);
        return;
      }

      if (data.playerKnownToSession === false) {
        unknownSessionAttempts.current += 1;
        if (unknownSessionAttempts.current >= 2) {
          void (async () => {
            try {
              await fetch("/api/session/clear-player-cookie", {
                method: "POST",
                credentials: "include",
              });
            } catch {
              /* still drop local state and send guest to check-in */
            }
            clearGuestRegistrationForRejoin();
            const q = buildProtocolTestPreserveQuery(searchParams);
            router.replace(q ? `/?${q}` : "/");
          })();
        }
        return;
      }

      unknownSessionAttempts.current = 0;
      lastKnownRevision.current = data.revision;
      lastKnownStep.current = data.guestStep;
      setState(data);
      setLastKnownStep(data.guestStep, data.revision);
    },
    [router, searchParams],
  );

  const fetchState = useCallback(() => {
    guestFetch("/api/state", searchParams, { credentials: "include" })
      .then((res) => res.json())
      .then((data: PublicState) => {
        handleIncomingState(data);
      })
      .catch(() => setState(null))
      .finally(() => setLoading(false));
  }, [handleIncomingState, searchParams]);

  useEffect(() => {
    fetchState();
    let poller: ReturnType<typeof createAdaptivePoller> | null = null;
    let ws: WebSocket | null = null;
    let es: EventSource | null = null;
    let wsOpenTimeout: number | null = null;
    const useWebSocket = shouldGuestPlayViewUseWebSocket(searchParams);

    const startPolling = () => {
      if (poller == null) {
        poller = createAdaptivePoller(fetchState, 4000, 30000);
        poller.start();
      }
    };

    const startEventSource = () => {
      if (process.env.NEXT_PUBLIC_NICOLA_DISABLE_SSE === "1") {
        startPolling();
        return;
      }

      if (typeof EventSource === "undefined") {
        startPolling();
        return;
      }

      es = new EventSource("/api/events");
      es.onmessage = (ev: MessageEvent) => {
        const payload = parseWebSocketPayload(ev.data as string);
        if (!payload) return;

        if (payload.fullState) {
          handleIncomingState(payload.fullState);
          return;
        }

        setState((prev) => {
          if (!prev) return null;
          if (
            prev.playerCount === payload.playerCount &&
            prev.revision === payload.revision &&
            prev.guestStep === payload.guestStep
          ) {
            return prev;
          }
          return {
            ...prev,
            playerCount: payload.playerCount,
            revision: payload.revision,
            guestStep: payload.guestStep,
          };
        });

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
        startPolling();
      };
    };

    if (!useWebSocket) {
      startPolling();
    } else {
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/api/events`;
        ws = new WebSocket(wsUrl);

        wsOpenTimeout = window.setTimeout(() => {
          if (ws) {
            ws.close();
            ws = null;
            startEventSource();
          }
        }, 2000);

        ws.onopen = () => {
          if (wsOpenTimeout != null) {
            window.clearTimeout(wsOpenTimeout);
            wsOpenTimeout = null;
          }
        };

        ws.onmessage = (ev: MessageEvent) => {
          const payload = parseWebSocketPayload(ev.data as string);
          if (!payload) return;

          if (payload.fullState) {
            handleIncomingState(payload.fullState);
            return;
          }

          setState((prev) => {
            if (!prev) return null;
            if (
              prev.playerCount === payload.playerCount &&
              prev.revision === payload.revision &&
              prev.guestStep === payload.guestStep
            ) {
              return prev;
            }
            return {
              ...prev,
              playerCount: payload.playerCount,
              revision: payload.revision,
              guestStep: payload.guestStep,
            };
          });

          if (
            payload.revision > lastKnownRevision.current ||
            payload.guestStep !== lastKnownStep.current
          ) {
            fetchState();
          }
        };

        const fallbackToSse = () => {
          if (wsOpenTimeout != null) {
            window.clearTimeout(wsOpenTimeout);
            wsOpenTimeout = null;
          }
          ws?.close();
          ws = null;
          startEventSource();
        };

        ws.onerror = fallbackToSse;
        ws.onclose = () => {
          if (wsOpenTimeout != null) {
            window.clearTimeout(wsOpenTimeout);
            wsOpenTimeout = null;
          }
          if (ws) {
            ws = null;
            startEventSource();
          }
        };
      } catch {
        startEventSource();
      }
    }
    return () => {
      if (wsOpenTimeout != null) {
        window.clearTimeout(wsOpenTimeout);
      }
      ws?.close();
      es?.close();
      poller?.stop();
    };
  }, [fetchState, searchParams]);

  if (loading || !state) {
    const fontHeadline =
      "var(--font-guest-shell-headline), ui-sans-serif, system-ui";
    return (
      <GuestPlayShell statusLabel="Syncing session">
        <div className="flex min-h-[45vh] flex-col items-center justify-center px-2">
          <div className="w-full max-w-sm">
            <div className="rounded-[2rem] bg-gradient-to-br from-[#ff9e5e] via-[#e67e22] to-[#a33700] p-1 shadow-xl shadow-orange-500/20">
              <div className="rounded-[1.85rem] bg-white/15 px-8 py-12 text-center backdrop-blur-md">
                <p
                  className="mb-3 text-[10px] font-bold uppercase tracking-[0.4em] text-white/90"
                  style={{ fontFamily: fontHeadline }}
                >
                  Party link
                </p>
                <p
                  className="text-lg uppercase italic tracking-tight text-white [text-shadow:0_0_15px_rgba(230,126,34,0.45)]"
                  style={{ fontFamily: fontHeadline }}
                >
                  Loading…
                </p>
              </div>
            </div>
          </div>
        </div>
      </GuestPlayShell>
    );
  }

  if (state.guestStep === "party_protocol") {
    if (!protocolLocalComplete) {
      return (
        <PartyProtocolScreen
          phase="post_check_in"
          gateBypass={protocolGateBypass}
          onCompleted={() => setProtocolLocalComplete(true)}
        />
      );
    }
    return (
      <WaitingLobby
        title="You're almost there"
        subtitle="The host will open the trivia lobby when it's time. Keep this tab handy."
      />
    );
  }

  if (state.guestStep === "lobby_trivia" || state.guestStep === "countdown_trivia") {
    return (
      <LobbyScreen
        variant="trivia"
        teams={state.lobbyTeams}
        playerCount={state.playerCount}
        scheduledGameStartsAtEpochMs={state.scheduledGameStartsAtEpochMs}
        onScheduleBoundary={fetchState}
      />
    );
  }

  if (state.guestStep === "lobby_bingo" || state.guestStep === "countdown_bingo") {
    return (
      <LobbyScreen
        variant="music_bingo"
        playerCount={state.playerCount}
        scheduledGameStartsAtEpochMs={state.scheduledGameStartsAtEpochMs}
        onScheduleBoundary={fetchState}
      />
    );
  }

  if (state.guestStep === "lobby_quotes" || state.guestStep === "countdown_quotes") {
    return (
      <LobbyScreen
        variant="identify_quote"
        teams={state.lobbyTeams}
        playerCount={state.playerCount}
        scheduledGameStartsAtEpochMs={state.scheduledGameStartsAtEpochMs}
        onScheduleBoundary={fetchState}
      />
    );
  }

  if (state.guestStep === "game_bingo") {
    if (!state.currentGame) {
      return <WaitingLobby />;
    }
    return (
      <MusicBingoScreen
        serverClaimedLineKeys={state.myBingoClaimedLineKeys}
        myBingoScore={state.myBingoScore}
        bingoRoundEndsAtEpochMs={state.bingoRoundEndsAtEpochMs}
        myBingoMarkedCells={state.myBingoMarkedCells}
      />
    );
  }

  if (state.guestStep === "game_quotes") {
    if (!state.currentGame) {
      return <WaitingLobby />;
    }
    return (
      <IdentifyQuoteGameScreen
        teamMcqSync={state.teamMcqSync}
        serverQuoteVotes={state.myQuoteVotes}
      />
    );
  }

  if (state.guestStep === "game_trivia") {
    if (!state.currentGame) {
      return <WaitingLobby />;
    }
    return (
      <TriviaGameScreen
        teamMcqSync={state.teamMcqSync}
        serverMyVotes={state.myTriviaVotes}
      />
    );
  }

  if (
    state.guestStep === "leaderboard_post_trivia" ||
    state.guestStep === "leaderboard_post_bingo"
  ) {
    if (!state.currentGame) {
      return <WaitingLobby />;
    }
    const scores = state.gameScores[state.currentGame.id] ?? {};
    const individualEntries = sortLeaderboardEntries(
      state.players.map((p) => ({
        name: p.nickname,
        score: scores[p.id] ?? 0,
      }))
    );
    const teamEntries =
      state.currentGame.type === "team"
        ? buildTeamLeaderboardEntries(state.teams, scores)
        : [];
    return (
      <GameLeaderboard
        gameName={state.currentGame.name}
        individualEntries={individualEntries}
        teamEntries={teamEntries}
        initialType={state.currentGame.type}
        highlightIndividualName={viewerNickname}
        highlightTeamName={state.myTeam?.name ?? null}
      />
    );
  }

  if (state.guestStep === "leaderboard_final") {
    return (
      <FinalLeaderboard
        entries={state.finalLeaderboard}
        highlightNickname={viewerNickname}
      />
    );
  }

  return <WaitingLobby />;
}
