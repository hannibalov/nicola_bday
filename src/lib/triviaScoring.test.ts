import type { Team } from "@/types";
import {
  TRIVIA_POINTS_PER_CORRECT,
  computeTriviaScoresFromVotes,
  isValidTriviaOptionIndex,
  normalizeTriviaVotesForPlayer,
} from "./triviaScoring";

describe("computeTriviaScoresFromVotes", () => {
  const teams: Team[] = [
    { id: "team-1", name: "Team 1", playerIds: ["a", "b"] },
    { id: "team-2", name: "Team 2", playerIds: ["c"] },
  ];
  const playerIds = ["a", "b", "c"];

  const questions: { id: string; correctIndex: number }[] = [
    { id: "q1", correctIndex: 0 },
    { id: "q2", correctIndex: 1 },
  ];

  it("starts everyone at 0", () => {
    const scores = computeTriviaScoresFromVotes(
      playerIds,
      teams,
      {},
      questions
    );
    expect(scores).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("adds 50 per correct team answer per question to every teammate", () => {
    const votes = {
      a: { q1: 0, q2: 1 },
      b: { q1: 0, q2: 1 },
      c: { q1: 0, q2: 0 },
    };
    const scores = computeTriviaScoresFromVotes(
      playerIds,
      teams,
      votes,
      questions
    );
    expect(scores.a).toBe(100);
    expect(scores.b).toBe(100);
    expect(scores.c).toBe(50);
  });

  it("uses plurality within team; wrong majority yields 0 for that question", () => {
    const votes = {
      a: { q1: 1 },
      b: { q1: 1 },
      c: { q1: 0 },
    };
    const scores = computeTriviaScoresFromVotes(
      playerIds,
      teams,
      votes,
      [{ id: "q1", correctIndex: 0 }]
    );
    expect(scores.a).toBe(0);
    expect(scores.b).toBe(0);
    expect(scores.c).toBe(50);
  });

  it("on tie uses lower option index (see majorityVote) to resolve team choice", () => {
    const votes = {
      a: { q1: 0 },
      b: { q1: 1 },
    };
    const scores = computeTriviaScoresFromVotes(
      ["a", "b"],
      [{ id: "t1", name: "T1", playerIds: ["a", "b"] }],
      votes,
      [{ id: "q1", correctIndex: 0 }]
    );
    expect(scores.a).toBe(50);
    expect(scores.b).toBe(50);
  });

  it("ignores invalid option indices when collecting votes", () => {
    const votes = { a: { q1: 99 }, b: { q1: 0 } };
    const scores = computeTriviaScoresFromVotes(
      ["a", "b"],
      [{ id: "t1", name: "T1", playerIds: ["a", "b"] }],
      votes,
      [{ id: "q1", correctIndex: 0 }]
    );
    expect(scores.a).toBe(50);
    expect(scores.b).toBe(50);
  });
});

describe("TRIVIA_POINTS_PER_CORRECT", () => {
  it("matches product spec", () => {
    expect(TRIVIA_POINTS_PER_CORRECT).toBe(50);
  });
});

describe("isValidTriviaOptionIndex", () => {
  it("accepts 0–3", () => {
    expect(isValidTriviaOptionIndex(0)).toBe(true);
    expect(isValidTriviaOptionIndex(3)).toBe(true);
  });

  it("rejects other values", () => {
    expect(isValidTriviaOptionIndex(-1)).toBe(false);
    expect(isValidTriviaOptionIndex(4)).toBe(false);
    expect(isValidTriviaOptionIndex(1.5)).toBe(false);
  });
});

describe("normalizeTriviaVotesForPlayer", () => {
  it("drops entries with invalid option indices", () => {
    expect(
      normalizeTriviaVotesForPlayer({ q1: 0, q2: 9, q3: 2 })
    ).toEqual({ q1: 0, q3: 2 });
  });
});
