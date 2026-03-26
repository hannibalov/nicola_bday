/**
 * @jest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import {
  effectiveTeamMcqSync,
  useTeamMcqRoundPhase,
} from "./useTeamMcqRoundPhase";
import type { TeamMcqPublicSync } from "@/types";

describe("effectiveTeamMcqSync", () => {
  it("advances question index after each full answer+reveal cycle", () => {
    const t0 = 1_000_000;
    const sync = {
      questionIndex: 0,
      roundStartedAtEpochMs: t0,
      totalQuestions: 5,
      answerMs: 10_000,
      revealMs: 3_000,
    };
    const cycle = 13_000;
    const afterOne = effectiveTeamMcqSync(sync, t0 + cycle);
    expect(afterOne.questionIndex).toBe(1);
    expect(afterOne.roundStartedAtEpochMs).toBe(t0 + cycle);

    const afterTwo = effectiveTeamMcqSync(sync, t0 + cycle * 2);
    expect(afterTwo.questionIndex).toBe(2);
    expect(afterTwo.roundStartedAtEpochMs).toBe(t0 + cycle * 2);
  });

  it("does not advance past the last question", () => {
    const t0 = 2_000_000;
    const sync = {
      questionIndex: 4,
      roundStartedAtEpochMs: t0,
      totalQuestions: 5,
      answerMs: 10_000,
      revealMs: 3_000,
    };
    const cycle = 13_000;
    const late = effectiveTeamMcqSync(sync, t0 + cycle * 3);
    expect(late.questionIndex).toBe(4);
    expect(late.roundStartedAtEpochMs).toBe(t0);
  });

  it("matches server advance when props still show an older questionIndex (stale sync)", () => {
    const t0 = 5_000_000;
    const sync: TeamMcqPublicSync = {
      questionIndex: 0,
      roundStartedAtEpochMs: t0,
      totalQuestions: 10,
      answerMs: 10_000,
      revealMs: 3_000,
    };
    const cycle = 13_000;
    const effective = effectiveTeamMcqSync(sync, t0 + cycle + 500);
    expect(effective.questionIndex).toBe(1);
    expect(effective.roundStartedAtEpochMs).toBe(t0 + cycle);
  });
});

describe("useTeamMcqRoundPhase", () => {
  const T0 = 8_000_000;
  const shortSync: TeamMcqPublicSync = {
    questionIndex: 0,
    roundStartedAtEpochMs: T0,
    totalQuestions: 10,
    answerMs: 400,
    revealMs: 200,
  };

  afterEach(() => {
    jest.useRealTimers();
  });

  it("moves activeSync to the next question after one cycle without new server props", () => {
    jest.useFakeTimers({ now: T0 });
    const { result } = renderHook(() => useTeamMcqRoundPhase(shortSync));
    expect(result.current.activeSync?.questionIndex).toBe(0);
    expect(result.current.phase).toBe("answering");

    act(() => {
      jest.setSystemTime(T0 + 650);
      jest.advanceTimersByTime(300);
    });

    expect(result.current.activeSync?.questionIndex).toBe(1);
    expect(result.current.activeSync?.roundStartedAtEpochMs).toBe(T0 + 600);
    expect(result.current.phase).toBe("answering");
  });

  it("enters awaiting_host after final question reveal ends", () => {
    const lastRound: TeamMcqPublicSync = {
      questionIndex: 9,
      roundStartedAtEpochMs: T0,
      totalQuestions: 10,
      answerMs: 400,
      revealMs: 200,
    };
    jest.useFakeTimers({ now: T0 });
    const { result } = renderHook(() => useTeamMcqRoundPhase(lastRound));
    expect(result.current.phase).toBe("answering");

    act(() => {
      jest.setSystemTime(T0 + 650);
      jest.advanceTimersByTime(300);
    });

    expect(result.current.phase).toBe("awaiting_host");
    expect(result.current.activeSync?.questionIndex).toBe(9);
  });
});
