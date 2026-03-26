/**
 * @jest-environment jsdom
 */
import {
  KEYS,
  STORAGE_PREFIX,
  getLastKnownStep,
  getBingoLocal,
  setBingoLocal,
  persistPlayerProfile,
  setLastKnownStep,
  getLocalJson,
  setLocalJson,
  getPersistedPlayerId,
  getPersistedNickname,
  markPartyProtocolComplete,
  hasCompletedPartyProtocol,
  getTriviaAnswersLocal,
  setTriviaAnswersLocal,
  clearGuestRegistrationForRejoin,
} from "./clientStorage";

describe("clientStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = "playerId=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("uses consistent prefix", () => {
    expect(STORAGE_PREFIX).toBe("nicola-bday:");
    expect(KEYS.playerId.startsWith(STORAGE_PREFIX)).toBe(true);
  });

  it("setLocalJson and getLocalJson round-trip", () => {
    setLocalJson("k", { a: 1 });
    expect(getLocalJson<{ a: number }>("k")).toEqual({ a: 1 });
  });

  it("setBingoLocal and getBingoLocal round-trip", () => {
    setBingoLocal({
      playerId: "p1",
      seed: 42,
      titles: ["a", "b", "c", "d", "e", "f"],
      marked: [true, false, false, false, false, false],
    });
    expect(getBingoLocal()).toEqual(
      expect.objectContaining({
        playerId: "p1",
        marked: expect.arrayContaining([true]),
      })
    );
    expect(window.localStorage.getItem(KEYS.bingo)).toContain("p1");
  });

  it("persistPlayerProfile stores id and nickname as plain strings", () => {
    persistPlayerProfile({ playerId: "p1", nickname: "Ninja" });
    expect(window.localStorage.getItem(KEYS.playerId)).toBe("p1");
    expect(window.localStorage.getItem(KEYS.nickname)).toBe("Ninja");
    expect(getPersistedNickname()).toBe("Ninja");
  });

  it("getPersistedNickname returns null when unset", () => {
    expect(getPersistedNickname()).toBeNull();
  });

  it("setLastKnownStep stores step and revision", () => {
    setLastKnownStep("lobby_trivia", 3);
    expect(getLastKnownStep()).toEqual(
      expect.objectContaining({ step: "lobby_trivia", revision: 3 })
    );
  });

  it("getPersistedPlayerId prefers localStorage over cookie", () => {
    window.localStorage.setItem(KEYS.playerId, "from-ls");
    document.cookie = "playerId=from-cookie";
    expect(getPersistedPlayerId()).toBe("from-ls");
  });

  it("getPersistedPlayerId reads cookie when localStorage empty", () => {
    document.cookie = "playerId=cookie-player";
    expect(getPersistedPlayerId()).toBe("cookie-player");
  });

  it("markPartyProtocolComplete and hasCompletedPartyProtocol round-trip", () => {
    expect(hasCompletedPartyProtocol()).toBe(false);
    markPartyProtocolComplete();
    expect(window.localStorage.getItem(KEYS.partyProtocolComplete)).toBe("1");
    expect(hasCompletedPartyProtocol()).toBe(true);
  });

  it("setTriviaAnswersLocal and getTriviaAnswersLocal round-trip", () => {
    setTriviaAnswersLocal({ t1: 0, t2: 3 });
    expect(getTriviaAnswersLocal()).toEqual({ t1: 0, t2: 3 });
    expect(window.localStorage.getItem(KEYS.triviaAnswers)).toContain("t1");
  });

  it("clearGuestRegistrationForRejoin removes identity and game keys", () => {
    persistPlayerProfile({ playerId: "p1", nickname: "N" });
    markPartyProtocolComplete();
    setLastKnownStep("game_trivia", 1);
    setTriviaAnswersLocal({ q: 0 });
    setBingoLocal({
      playerId: "p1",
      seed: 1,
      titles: ["a", "b", "c", "d", "e", "f"],
      marked: [false, false, false, false, false, false],
    });
    window.localStorage.setItem(KEYS.quoteVotes, "{}");

    clearGuestRegistrationForRejoin();

    expect(window.localStorage.getItem(KEYS.playerId)).toBeNull();
    expect(window.localStorage.getItem(KEYS.nickname)).toBeNull();
    expect(window.localStorage.getItem(KEYS.partyProtocolComplete)).toBeNull();
    expect(getLastKnownStep()).toBeNull();
    expect(getTriviaAnswersLocal()).toBeNull();
    expect(getBingoLocal()).toBeNull();
    expect(window.localStorage.getItem(KEYS.quoteVotes)).toBeNull();
  });

  it("markPartyProtocolComplete does not throw when setItem fails", () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("quota");
    };
    expect(() => markPartyProtocolComplete()).not.toThrow();
    Storage.prototype.setItem = orig;
  });
});
