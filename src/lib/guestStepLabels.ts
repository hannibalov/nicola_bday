import type { GuestStep } from "@/types";
import { getNextGuestStep } from "@/types";

const LABELS: Record<GuestStep, string> = {
  party_protocol: "Party protocol / theme",
  lobby_trivia: "Lobby — Team trivia",
  game_trivia: "Game — Team trivia",
  leaderboard_post_trivia: "Leaderboard — After trivia",
  lobby_bingo: "Lobby — Music bingo",
  game_bingo: "Game — Music bingo",
  leaderboard_post_bingo: "Leaderboard — After bingo",
  lobby_quotes: "Lobby — Who said it",
  game_quotes: "Game — Who said it",
  leaderboard_final: "Final leaderboard",
};

export function guestStepLabel(step: GuestStep): string {
  return LABELS[step];
}

export function nextGuestStepLabel(current: GuestStep): string | null {
  const next = getNextGuestStep(current);
  return next ? guestStepLabel(next) : null;
}
