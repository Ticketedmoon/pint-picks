import { describe, it, expect } from "vitest";
import { buildLeaderboardEntries, isCutInEffect } from "@/lib/leaderboard";
import type { Party, Picks, PlayerScore } from "@/types";
import { mockParty, completePicks } from "./helpers";

function makeScore(overrides: Partial<PlayerScore> = {}): PlayerScore {
  return {
    playerId: "p1",
    playerName: "Player One",
    scoreToPar: -2,
    displayScore: "-2",
    status: "playing",
    ...overrides,
  };
}

const party: Party = {
  ...mockParty,
  memberUids: ["uid1", "uid2"],
};

const usersInfo: Record<string, { displayName: string; photoURL?: string }> = {
  uid1: { displayName: "Alice" },
  uid2: { displayName: "Bob", photoURL: "https://photo.url" },
};

describe("buildLeaderboardEntries", () => {
  it("builds entries for all party members", () => {
    const allPicks: Record<string, Picks> = {
      uid1: completePicks,
      uid2: completePicks,
    };
    const scores = [
      makeScore({ playerId: "a1", playerName: "Player A", scoreToPar: -3 }),
      makeScore({ playerId: "b1", playerName: "Player B", scoreToPar: 0 }),
      makeScore({ playerId: "c1", playerName: "Player C", scoreToPar: 1 }),
      makeScore({ playerId: "d1", playerName: "Player D", scoreToPar: 2 }),
      makeScore({ playerId: "w1", playerName: "Wildcard 1", scoreToPar: -1 }),
      makeScore({ playerId: "w2", playerName: "Wildcard 2", scoreToPar: 0 }),
    ];

    const entries = buildLeaderboardEntries(party, allPicks, usersInfo, scores);

    expect(entries).toHaveLength(2);
    expect(entries[0].userName).toBe("Alice");
    expect(entries[0].picks).toHaveLength(6);
  });

  it("sorts entries by total score (lowest first)", () => {
    const allPicks: Record<string, Picks> = {
      uid1: completePicks,
      uid2: completePicks,
    };
    const scoresUid1 = [
      makeScore({ playerId: "a1", playerName: "Player A", scoreToPar: 5 }),
      makeScore({ playerId: "b1", playerName: "Player B", scoreToPar: 5 }),
      makeScore({ playerId: "c1", playerName: "Player C", scoreToPar: 5 }),
      makeScore({ playerId: "d1", playerName: "Player D", scoreToPar: 5 }),
      makeScore({ playerId: "w1", playerName: "Wildcard 1", scoreToPar: 5 }),
      makeScore({ playerId: "w2", playerName: "Wildcard 2", scoreToPar: 5 }),
    ];

    const entries = buildLeaderboardEntries(party, allPicks, usersInfo, scoresUid1);

    // Both have same picks/scores so order is stable
    expect(entries[0].totalScore).toBeLessThanOrEqual(entries[1].totalScore);
  });

  it("handles member with no picks", () => {
    const allPicks: Record<string, Picks> = {};
    const scores: PlayerScore[] = [];

    const entries = buildLeaderboardEntries(party, allPicks, usersInfo, scores);

    expect(entries).toHaveLength(2);
    // Always produces 6 "Not picked" entries even when user has no picks document
    expect(entries[0].picks).toHaveLength(6);
    expect(entries[0].picks.every((p) => p.playerName === "Not picked")).toBe(true);
    expect(entries[0].totalScore).toBe(0);
  });

  it("handles unknown user info gracefully", () => {
    const allPicks: Record<string, Picks> = {};
    const entries = buildLeaderboardEntries(party, allPicks, {}, []);

    expect(entries[0].userName).toBe("Unknown");
  });

  it("shows 'Not picked' for null pick slots", () => {
    const partialPicks: Picks = {
      groupA: { playerId: "a1", playerName: "Player A" },
      groupB: null,
      groupC: null,
      groupD: null,
      wildcard1: null,
      wildcard2: null,
    };
    const allPicks: Record<string, Picks> = { uid1: partialPicks };
    const scores = [makeScore({ playerId: "a1", playerName: "Player A", scoreToPar: -1 })];

    const entries = buildLeaderboardEntries(party, allPicks, usersInfo, scores);
    const uid1Entry = entries.find((e) => e.uid === "uid1")!;

    expect(uid1Entry.picks[0].playerName).toBe("Player A");
    expect(uid1Entry.picks[1].playerName).toBe("Not picked");
  });

  it("matches scores by player name when ID doesn't match", () => {
    const picks: Picks = {
      groupA: { playerId: "wrong-id", playerName: "Player A" },
      groupB: null,
      groupC: null,
      groupD: null,
      wildcard1: null,
      wildcard2: null,
    };
    const allPicks: Record<string, Picks> = { uid1: picks };
    const scores = [makeScore({ playerId: "correct-id", playerName: "Player A", scoreToPar: -5 })];

    const entries = buildLeaderboardEntries(party, allPicks, usersInfo, scores);
    const uid1Entry = entries.find((e) => e.uid === "uid1")!;

    expect(uid1Entry.picks[0].playerName).toBe("Player A");
    expect(uid1Entry.picks[0].scoreToPar).toBe(-5);
  });

  it("applies cutLine-based penalty to cut player scores", () => {
    const picks: Picks = {
      groupA: { playerId: "a1", playerName: "Player A" },
      groupB: null,
      groupC: null,
      groupD: null,
      wildcard1: null,
      wildcard2: null,
    };
    const allPicks: Record<string, Picks> = { uid1: picks };
    const scores = [makeScore({ playerId: "a1", playerName: "Player A", scoreToPar: 7, status: "cut" })];

    const entries = buildLeaderboardEntries(party, allPicks, usersInfo, scores, 4);
    const uid1Entry = entries.find((e) => e.uid === "uid1")!;

    // cutLine 4 + 1 = 5 (capped), not 7 + 1 = 8
    expect(uid1Entry.picks[0].scoreToPar).toBe(5);
    expect(uid1Entry.picks[0].displayScore).toBe("+5");
  });

  it("falls back to +1 penalty for cut player when no cutLine provided", () => {
    const picks: Picks = {
      groupA: { playerId: "a1", playerName: "Player A" },
      groupB: null,
      groupC: null,
      groupD: null,
      wildcard1: null,
      wildcard2: null,
    };
    const allPicks: Record<string, Picks> = { uid1: picks };
    const scores = [makeScore({ playerId: "a1", playerName: "Player A", scoreToPar: 3, status: "cut" })];

    const entries = buildLeaderboardEntries(party, allPicks, usersInfo, scores);
    const uid1Entry = entries.find((e) => e.uid === "uid1")!;

    // No cutLine, so fallback: 3 + 1 = 4
    expect(uid1Entry.picks[0].scoreToPar).toBe(4);
    expect(uid1Entry.picks[0].displayScore).toBe("+4 (+1)");
  });

  it("returns dash score when player not found in leaderboard", () => {
    const picks: Picks = {
      groupA: { playerId: "missing-id", playerName: "Missing Player" },
      groupB: null,
      groupC: null,
      groupD: null,
      wildcard1: null,
      wildcard2: null,
    };
    const allPicks: Record<string, Picks> = { uid1: picks };
    // No matching score in the leaderboard
    const scores = [makeScore({ playerId: "other-id", playerName: "Other Player" })];

    const entries = buildLeaderboardEntries(party, allPicks, usersInfo, scores);
    const uid1Entry = entries.find((e) => e.uid === "uid1")!;

    expect(uid1Entry.picks[0].playerName).toBe("Missing Player");
    expect(uid1Entry.picks[0].displayScore).toBe("-");
    expect(uid1Entry.picks[0].scoreToPar).toBe(0);
  });

  it("caps made-cut player at cutLine and shows actualDisplayScore", () => {
    const picks: Picks = {
      groupA: { playerId: "a1", playerName: "Player A" },
      groupB: null,
      groupC: null,
      groupD: null,
      wildcard1: null,
      wildcard2: null,
    };
    const allPicks: Record<string, Picks> = { uid1: picks };
    // Cut round (2) is complete: the made-cut player has finished both rounds
    // and at least one player is cut, so the cut is in effect.
    const scores = [
      makeScore({ playerId: "a1", playerName: "Player A", scoreToPar: 8, status: "finished", roundScores: ["+4", "+4"] }),
      makeScore({ playerId: "z1", playerName: "Cut Player", scoreToPar: 10, status: "cut" }),
    ];

    const entries = buildLeaderboardEntries(party, allPicks, usersInfo, scores, 4, 2);
    const uid1Entry = entries.find((e) => e.uid === "uid1")!;

    // Capped at cutLine (4), not actual score (8)
    expect(uid1Entry.picks[0].scoreToPar).toBe(4);
    expect(uid1Entry.picks[0].displayScore).toBe("+4");
    expect(uid1Entry.picks[0].actualDisplayScore).toBe("+8");
  });

  it("does not cap made-cut player while the cut round is still being played", () => {
    const picks: Picks = {
      groupA: { playerId: "a1", playerName: "Player A" },
      groupB: null,
      groupC: null,
      groupD: null,
      wildcard1: null,
      wildcard2: null,
    };
    const allPicks: Record<string, Picks> = { uid1: picks };
    // The cut round (2) is NOT complete: Player A has only finished R1 and is
    // still playing R2. ESPN has flagged one early withdrawal as "cut" and is
    // publishing a projected cut line, but the cut is not final yet.
    const scores = [
      makeScore({ playerId: "a1", playerName: "Player A", scoreToPar: 8, status: "playing", roundScores: ["+4", "+4"] }),
      makeScore({ playerId: "z1", playerName: "Early WD", scoreToPar: 10, status: "cut", roundScores: ["+5", "-"] }),
    ];

    const entries = buildLeaderboardEntries(party, allPicks, usersInfo, scores, 4, 2);
    const uid1Entry = entries.find((e) => e.uid === "uid1")!;

    // Not capped - the projected cut line must not apply mid cut-round.
    expect(uid1Entry.picks[0].scoreToPar).toBe(8);
    expect(uid1Entry.picks[0].displayScore).toBe("+8");
    expect(uid1Entry.picks[0].actualDisplayScore).toBeUndefined();
  });

  it("does not cap made-cut player before the cut is in effect (no cut players in field)", () => {
    const picks: Picks = {
      groupA: { playerId: "a1", playerName: "Player A" },
      groupB: null,
      groupC: null,
      groupD: null,
      wildcard1: null,
      wildcard2: null,
    };
    const allPicks: Record<string, Picks> = { uid1: picks };
    // R1/R2: ESPN publishes a projected cutScore but nobody is cut yet.
    const scores = [makeScore({ playerId: "a1", playerName: "Player A", scoreToPar: 8, status: "playing" })];

    const entries = buildLeaderboardEntries(party, allPicks, usersInfo, scores, 4);
    const uid1Entry = entries.find((e) => e.uid === "uid1")!;

    // Not capped - real +8 stands, no CAP badge (actualDisplayScore unset)
    expect(uid1Entry.picks[0].scoreToPar).toBe(8);
    expect(uid1Entry.picks[0].displayScore).toBe("+8");
    expect(uid1Entry.picks[0].actualDisplayScore).toBeUndefined();
  });

  it("does not set actualDisplayScore when player is below cutLine", () => {
    const picks: Picks = {
      groupA: { playerId: "a1", playerName: "Player A" },
      groupB: null,
      groupC: null,
      groupD: null,
      wildcard1: null,
      wildcard2: null,
    };
    const allPicks: Record<string, Picks> = { uid1: picks };
    const scores = [makeScore({ playerId: "a1", playerName: "Player A", scoreToPar: 2, status: "finished" })];

    const entries = buildLeaderboardEntries(party, allPicks, usersInfo, scores, 4);
    const uid1Entry = entries.find((e) => e.uid === "uid1")!;

    expect(uid1Entry.picks[0].scoreToPar).toBe(2);
    expect(uid1Entry.picks[0].actualDisplayScore).toBeUndefined();
  });

  it("includes roundScoresToPar when roundScores are available", () => {
    const picks: Picks = {
      groupA: { playerId: "a1", playerName: "Player A" },
      groupB: null,
      groupC: null,
      groupD: null,
      wildcard1: null,
      wildcard2: null,
    };
    const allPicks: Record<string, Picks> = { uid1: picks };
    const scores = [makeScore({
      playerId: "a1",
      playerName: "Player A",
      scoreToPar: -5,
      status: "finished",
      roundScores: ["-3", "-2", "E", "+1"],
    })];

    const entries = buildLeaderboardEntries(party, allPicks, usersInfo, scores);
    const uid1Entry = entries.find((e) => e.uid === "uid1")!;

    expect(uid1Entry.picks[0].roundScoresToPar).toEqual(["-3", "-2", "E", "+1"]);
  });

  it("omits roundScoresToPar when roundScores are absent", () => {
    const picks: Picks = {
      groupA: { playerId: "a1", playerName: "Player A" },
      groupB: null,
      groupC: null,
      groupD: null,
      wildcard1: null,
      wildcard2: null,
    };
    const allPicks: Record<string, Picks> = { uid1: picks };
    const scores = [makeScore({
      playerId: "a1",
      playerName: "Player A",
      scoreToPar: -2,
      status: "playing",
    })];

    const entries = buildLeaderboardEntries(party, allPicks, usersInfo, scores);
    const uid1Entry = entries.find((e) => e.uid === "uid1")!;

    expect(uid1Entry.picks[0].roundScoresToPar).toBeUndefined();
  });

  it("matches a pick to a score when only diacritics differ (Aberg vs Åberg)", () => {
    const picks: Picks = {
      groupA: { playerId: "stale-id", playerName: "Ludvig Aberg" },
      groupB: null,
      groupC: null,
      groupD: null,
      wildcard1: null,
      wildcard2: null,
    };
    const allPicks: Record<string, Picks> = { uid1: picks };
    const scores = [makeScore({
      playerId: "espn-42",
      playerName: "Ludvig Åberg",
      scoreToPar: -4,
      status: "playing",
    })];

    const entries = buildLeaderboardEntries(party, allPicks, usersInfo, scores);
    const uid1Entry = entries.find((e) => e.uid === "uid1")!;

    expect(uid1Entry.picks[0].playerName).toBe("Ludvig Åberg");
    expect(uid1Entry.picks[0].scoreToPar).toBe(-4);
    expect(uid1Entry.picks[0].displayScore).not.toBe("-");
  });

  it("still falls back to pending display when a pick truly has no matching score", () => {
    const picks: Picks = {
      groupA: { playerId: "nobody", playerName: "Ghost Player" },
      groupB: null,
      groupC: null,
      groupD: null,
      wildcard1: null,
      wildcard2: null,
    };
    const allPicks: Record<string, Picks> = { uid1: picks };
    const scores = [makeScore({ playerId: "a1", playerName: "Player A" })];

    const entries = buildLeaderboardEntries(party, allPicks, usersInfo, scores);
    const uid1Entry = entries.find((e) => e.uid === "uid1")!;

    expect(uid1Entry.picks[0].displayScore).toBe("-");
  });
});

describe("isCutInEffect", () => {
  it("returns false when there is no cut round (cutRound null or 0)", () => {
    const scores = [makeScore({ status: "cut" })];
    expect(isCutInEffect(scores, null)).toBe(false);
    expect(isCutInEffect(scores, 0)).toBe(false);
    expect(isCutInEffect(scores, undefined)).toBe(false);
  });

  it("returns false for an empty field", () => {
    expect(isCutInEffect([], 2)).toBe(false);
  });

  it("returns false when nobody is cut yet, even if the round is complete", () => {
    const scores = [
      makeScore({ playerId: "a", status: "finished", roundScores: ["+1", "+1"] }),
      makeScore({ playerId: "b", status: "finished", roundScores: ["-2", "-1"] }),
    ];
    expect(isCutInEffect(scores, 2)).toBe(false);
  });

  it("returns false while a player is still mid cut-round", () => {
    const scores = [
      // running R2 value but status still playing => not finished the round
      makeScore({ playerId: "a", status: "playing", roundScores: ["+1", "+2"] }),
      makeScore({ playerId: "z", status: "cut", roundScores: ["+6", "-"] }),
    ];
    expect(isCutInEffect(scores, 2)).toBe(false);
  });

  it("returns false while a player has not yet teed off the cut round", () => {
    const scores = [
      // R2 is a placeholder "-" => cut round not complete for this player
      makeScore({ playerId: "a", status: "playing", roundScores: ["+1", "-"] }),
      makeScore({ playerId: "z", status: "cut", roundScores: ["+6", "-"] }),
    ];
    expect(isCutInEffect(scores, 2)).toBe(false);
  });

  it("returns true once the cut round is complete for the whole field", () => {
    const scores = [
      makeScore({ playerId: "a", status: "finished", roundScores: ["+1", "+1"] }),
      // moved into R3 already
      makeScore({ playerId: "b", status: "playing", roundScores: ["-2", "-1", "E"] }),
      makeScore({ playerId: "z", status: "cut", roundScores: ["+6", "+6"] }),
    ];
    expect(isCutInEffect(scores, 2)).toBe(true);
  });

  it("ignores wd/dq players when checking cut-round completion", () => {
    const scores = [
      makeScore({ playerId: "a", status: "finished", roundScores: ["+1", "+1"] }),
      makeScore({ playerId: "w", status: "wd", roundScores: ["+3", "-"] }),
      makeScore({ playerId: "d", status: "dq", roundScores: ["+2", "-"] }),
      makeScore({ playerId: "z", status: "cut", roundScores: ["+6", "+6"] }),
    ];
    expect(isCutInEffect(scores, 2)).toBe(true);
  });
});

