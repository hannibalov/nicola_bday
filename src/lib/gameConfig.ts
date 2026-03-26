import type { GameConfig } from "@/types";

/** Lobby pre-game countdown is always 60s ({@link lobbySchedule}); this field is legacy. */
export const GAMES: GameConfig[] = [
  {
    id: "game-trivia",
    name: "Team trivia",
    type: "team",
    countdownSeconds: 60,
  },
  {
    id: "game-bingo",
    name: "Music bingo",
    type: "individual",
    countdownSeconds: 60,
  },
  {
    id: "game-quotes",
    name: "Who said it",
    type: "team",
    countdownSeconds: 60,
  },
];
