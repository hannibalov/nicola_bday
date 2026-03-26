"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { PublicState } from "@/types";
import {
  clearGuestRegistrationForRejoin,
  getPersistedNickname,
  hasCompletedPartyProtocol,
  setLastKnownStep,
} from "@/lib/clientStorage";
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

  useLayoutEffect(() => {
    startTransition(() => {
      setProtocolLocalComplete(hasCompletedPartyProtocol());
      setViewerNickname(getPersistedNickname());
    });
  }, []);

  const fetchState = useCallback(() => {
    fetch("/api/state", { credentials: "include" })
      .then((res) => res.json())
      .then((data: PublicState) => {
        if (data.playerKnownToSession === false) {
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
            router.replace("/");
          })();
          return;
        }
        setState(data);
        setLastKnownStep(data.guestStep, data.revision);
      })
      .catch(() => setState(null))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    fetchState();
    let poll: ReturnType<typeof setInterval> | null = null;
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/events");
      es.onmessage = () => {
        fetchState();
      };
      es.onerror = () => {
        es?.close();
        es = null;
        if (poll == null) {
          poll = setInterval(() => fetchState(), 2000);
        }
      };
    } catch {
      poll = setInterval(() => fetchState(), 2000);
    }
    return () => {
      es?.close();
      if (poll != null) clearInterval(poll);
    };
  }, [fetchState]);

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
        title="You’re almost there"
        subtitle="The host will open the trivia lobby when it’s time. Keep this tab handy."
      />
    );
  }

  if (state.guestStep === "lobby_trivia") {
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

  if (state.guestStep === "lobby_bingo") {
    return (
      <LobbyScreen
        variant="music_bingo"
        playerCount={state.playerCount}
        scheduledGameStartsAtEpochMs={state.scheduledGameStartsAtEpochMs}
        onScheduleBoundary={fetchState}
      />
    );
  }

  if (state.guestStep === "lobby_quotes") {
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
    const highlightName =
      state.currentGame.type === "team"
        ? (state.myTeam?.name ?? null)
        : viewerNickname;
    return (
      <GameLeaderboard
        gameName={state.currentGame.name}
        entries={state.leaderboard}
        type={state.currentGame.type}
        highlightName={highlightName}
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
