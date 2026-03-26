import type { Team } from "@/types";
import { teamChoiceMatchesCorrect } from "./majorityVote";

/** Points each player on a team receives when the team’s majority answer is correct. */
export const TRIVIA_POINTS_PER_CORRECT = 50;

export function isValidTriviaOptionIndex(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n <= 3;
}

export function normalizeTriviaVotesForPlayer(
  raw: Record<string, number>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [questionId, idx] of Object.entries(raw)) {
    if (isValidTriviaOptionIndex(idx)) {
      out[questionId] = idx;
    }
  }
  return out;
}

/**
 * For each question and each team, resolves the team answer by plurality (tie → lower index).
 * If it matches `correctIndex`, every member gets {@link TRIVIA_POINTS_PER_CORRECT}.
 */
export function computeTriviaScoresFromVotes(
  playerIds: string[],
  teams: Team[],
  votesByPlayer: Record<string, Record<string, number>>,
  questions: { id: string; correctIndex: number }[]
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const id of playerIds) {
    scores[id] = 0;
  }

  for (const q of questions) {
    for (const team of teams) {
      const memberVotes: number[] = [];
      for (const pid of team.playerIds) {
        const idx = votesByPlayer[pid]?.[q.id];
        if (idx !== undefined && isValidTriviaOptionIndex(idx)) {
          memberVotes.push(idx);
        }
      }
      if (teamChoiceMatchesCorrect(memberVotes, q.correctIndex)) {
        for (const pid of team.playerIds) {
          scores[pid] = (scores[pid] ?? 0) + TRIVIA_POINTS_PER_CORRECT;
        }
      }
    }
  }

  return scores;
}
