import { describe, it, expect } from "vitest";
import {
  applyFootballTiebreakers,
  applyGolfTiebreakers,
  DEFAULT_FOOTBALL_TIEBREAKERS,
  DEFAULT_GOLF_TIEBREAKERS,
  FOOTBALL_TIEBREAKER_OPTIONS,
  GOLF_TIEBREAKER_OPTIONS,
} from "@/lib/tiebreaker";
import type { FootballLeaderboardEntry } from "@/lib/sports/football/types";
import type { LeaderboardEntry, TiebreakerRule } from "@/types";

// ─── Helpers ───

function makeFootballEntry(
  uid: string,
  totalPoints: number,
  picks: Partial<FootballLeaderboardEntry["picks"][0]>[] = [],
): FootballLeaderboardEntry {
  return {
    uid,
    userName: uid,
    totalPoints,
    picks: picks.map((p) => ({
      group: "A",
      teamId: p.teamId ?? "t1",
      teamName: p.teamName || "Team",
      abbreviation: p.abbreviation || "TM",
      logo: "",
      points: p.points || 0,
      matchesPlayed: p.matchesPlayed || 0,
      wins: p.wins || 0,
      draws: p.draws || 0,
      losses: p.losses || 0,
      eliminated: p.eliminated || false,
      goalsFor: p.goalsFor || 0,
      goalsAgainst: p.goalsAgainst || 0,
    })),
  };
}

function makeGolfEntry(
  uid: string,
  totalScore: number,
  picks: Partial<LeaderboardEntry["picks"][0]>[] = [],
): LeaderboardEntry {
  return {
    uid,
    userName: uid,
    totalScore,
    displayTotal: `${totalScore}`,
    picks: picks.map((p) => ({
      group: p.group || "A",
      playerId: p.playerId ?? "p1",
      playerName: p.playerName || "Player",
      scoreToPar: p.scoreToPar || 0,
      displayScore: p.displayScore || "E",
      status: p.status || "finished",
      ...(p.position && { position: p.position }),
      ...(p.roundScoresToPar && { roundScoresToPar: p.roundScoresToPar }),
    })),
  };
}

// ─── Constants tests ───

describe("tiebreaker constants", () => {
  it("exports 5 football tiebreaker options", () => {
    expect(FOOTBALL_TIEBREAKER_OPTIONS).toHaveLength(5);
  });

  it("exports 4 golf tiebreaker options", () => {
    expect(GOLF_TIEBREAKER_OPTIONS).toHaveLength(4);
  });

  it("default football tiebreakers are a subset of options", () => {
    for (const rule of DEFAULT_FOOTBALL_TIEBREAKERS) {
      expect(FOOTBALL_TIEBREAKER_OPTIONS.some((o) => o.id === rule.id)).toBe(true);
    }
  });

  it("default golf tiebreakers are a subset of options", () => {
    for (const rule of DEFAULT_GOLF_TIEBREAKERS) {
      expect(GOLF_TIEBREAKER_OPTIONS.some((o) => o.id === rule.id)).toBe(true);
    }
  });
});

// ─── Football tiebreaker tests ───

describe("applyFootballTiebreakers", () => {
  it("returns entries unchanged when only one entry", () => {
    const entries = [makeFootballEntry("a", 10)];
    const result = applyFootballTiebreakers(entries, DEFAULT_FOOTBALL_TIEBREAKERS);
    expect(result).toHaveLength(1);
    expect(result[0].uid).toBe("a");
  });

  it("returns entries unchanged when no rules provided", () => {
    const entries = [makeFootballEntry("a", 10), makeFootballEntry("b", 10)];
    const result = applyFootballTiebreakers(entries, []);
    expect(result).toHaveLength(2);
  });

  it("preserves primary sort by totalPoints", () => {
    const entries = [
      makeFootballEntry("low", 5),
      makeFootballEntry("high", 15),
      makeFootballEntry("mid", 10),
    ];
    const result = applyFootballTiebreakers(entries, DEFAULT_FOOTBALL_TIEBREAKERS);
    expect(result.map((e) => e.uid)).toEqual(["high", "mid", "low"]);
  });

  it("breaks tie by furthest_team (more active teams wins)", () => {
    const rules: TiebreakerRule[] = [
      { id: "furthest_team", label: "", description: "" },
    ];
    const a = makeFootballEntry("a", 10, [
      { teamId: "t1", eliminated: false },
      { teamId: "t2", eliminated: true },
    ]);
    const b = makeFootballEntry("b", 10, [
      { teamId: "t1", eliminated: false },
      { teamId: "t2", eliminated: false },
    ]);
    const result = applyFootballTiebreakers([a, b], rules);
    expect(result[0].uid).toBe("b"); // b has 2 active, a has 1
  });

  it("breaks tie by goals_scored", () => {
    const rules: TiebreakerRule[] = [
      { id: "goals_scored", label: "", description: "" },
    ];
    const a = makeFootballEntry("a", 10, [
      { teamId: "t1", goalsFor: 5 },
      { teamId: "t2", goalsFor: 3 },
    ]);
    const b = makeFootballEntry("b", 10, [
      { teamId: "t1", goalsFor: 2 },
      { teamId: "t2", goalsFor: 4 },
    ]);
    const result = applyFootballTiebreakers([a, b], rules);
    expect(result[0].uid).toBe("a"); // a has 8 goals, b has 6
  });

  it("breaks tie by least_goals_conceded", () => {
    const rules: TiebreakerRule[] = [
      { id: "least_goals_conceded", label: "", description: "" },
    ];
    const a = makeFootballEntry("a", 10, [
      { teamId: "t1", goalsAgainst: 3 },
    ]);
    const b = makeFootballEntry("b", 10, [
      { teamId: "t1", goalsAgainst: 1 },
    ]);
    const result = applyFootballTiebreakers([a, b], rules);
    expect(result[0].uid).toBe("b"); // b conceded fewer
  });

  it("breaks tie by goal_difference", () => {
    const rules: TiebreakerRule[] = [
      { id: "goal_difference", label: "", description: "" },
    ];
    const a = makeFootballEntry("a", 10, [
      { teamId: "t1", goalsFor: 5, goalsAgainst: 3 }, // GD +2
    ]);
    const b = makeFootballEntry("b", 10, [
      { teamId: "t1", goalsFor: 8, goalsAgainst: 2 }, // GD +6
    ]);
    const result = applyFootballTiebreakers([a, b], rules);
    expect(result[0].uid).toBe("b");
  });

  it("breaks tie by most_wins", () => {
    const rules: TiebreakerRule[] = [
      { id: "most_wins", label: "", description: "" },
    ];
    const a = makeFootballEntry("a", 10, [
      { teamId: "t1", wins: 2 },
      { teamId: "t2", wins: 1 },
    ]);
    const b = makeFootballEntry("b", 10, [
      { teamId: "t1", wins: 1 },
      { teamId: "t2", wins: 1 },
    ]);
    const result = applyFootballTiebreakers([a, b], rules);
    expect(result[0].uid).toBe("a"); // a has 3 wins, b has 2
  });

  it("cascades through multiple rules when first is still tied", () => {
    const rules: TiebreakerRule[] = [
      { id: "furthest_team", label: "", description: "" },
      { id: "goals_scored", label: "", description: "" },
    ];
    // Both have 1 active team (tied on first rule)
    const a = makeFootballEntry("a", 10, [
      { teamId: "t1", eliminated: false, goalsFor: 3 },
    ]);
    const b = makeFootballEntry("b", 10, [
      { teamId: "t1", eliminated: false, goalsFor: 7 },
    ]);
    const result = applyFootballTiebreakers([a, b], rules);
    expect(result[0].uid).toBe("b"); // tied on furthest_team, b wins on goals
  });

  it("skips picks with empty teamId", () => {
    const rules: TiebreakerRule[] = [
      { id: "goals_scored", label: "", description: "" },
    ];
    const a = makeFootballEntry("a", 10, [
      { teamId: "", goalsFor: 99 }, // should be skipped
      { teamId: "t1", goalsFor: 2 },
    ]);
    const b = makeFootballEntry("b", 10, [
      { teamId: "t1", goalsFor: 5 },
    ]);
    const result = applyFootballTiebreakers([a, b], rules);
    expect(result[0].uid).toBe("b"); // a=2, b=5
  });

  it("handles unknown rule id gracefully (returns 0)", () => {
    const rules: TiebreakerRule[] = [
      { id: "nonexistent" as never, label: "", description: "" },
    ];
    const a = makeFootballEntry("a", 10);
    const b = makeFootballEntry("b", 10);
    // Should not throw, order is arbitrary but stable
    const result = applyFootballTiebreakers([a, b], rules);
    expect(result).toHaveLength(2);
  });
});

// ─── Golf tiebreaker tests ───

describe("applyGolfTiebreakers", () => {
  it("returns entries unchanged when only one entry", () => {
    const entries = [makeGolfEntry("a", -5)];
    const result = applyGolfTiebreakers(entries, DEFAULT_GOLF_TIEBREAKERS);
    expect(result).toHaveLength(1);
  });

  it("returns entries unchanged when no rules provided", () => {
    const entries = [makeGolfEntry("a", -5), makeGolfEntry("b", -5)];
    const result = applyGolfTiebreakers(entries, []);
    expect(result).toHaveLength(2);
  });

  it("preserves primary sort by totalScore ascending (lowest wins)", () => {
    const entries = [
      makeGolfEntry("high", 5),
      makeGolfEntry("low", -10),
      makeGolfEntry("mid", 0),
    ];
    const result = applyGolfTiebreakers(entries, DEFAULT_GOLF_TIEBREAKERS);
    expect(result.map((e) => e.uid)).toEqual(["low", "mid", "high"]);
  });

  it("breaks tie by best_finishing_position", () => {
    const rules: TiebreakerRule[] = [
      { id: "best_finishing_position", label: "", description: "" },
    ];
    const a = makeGolfEntry("a", -5, [
      { playerId: "p1", position: "T10" },
      { playerId: "p2", position: "T25" },
    ]);
    const b = makeGolfEntry("b", -5, [
      { playerId: "p1", position: "3" },
      { playerId: "p2", position: "T40" },
    ]);
    const result = applyGolfTiebreakers([a, b], rules);
    expect(result[0].uid).toBe("b"); // b has a golfer at position 3
  });

  it("parses T-prefixed positions correctly", () => {
    const rules: TiebreakerRule[] = [
      { id: "best_finishing_position", label: "", description: "" },
    ];
    const a = makeGolfEntry("a", -5, [{ playerId: "p1", position: "T2" }]);
    const b = makeGolfEntry("b", -5, [{ playerId: "p1", position: "T5" }]);
    const result = applyGolfTiebreakers([a, b], rules);
    expect(result[0].uid).toBe("a"); // T2 = 2 < T5 = 5
  });

  it("handles missing position (treated as Infinity)", () => {
    const rules: TiebreakerRule[] = [
      { id: "best_finishing_position", label: "", description: "" },
    ];
    const a = makeGolfEntry("a", -5, [{ playerId: "p1" }]); // no position
    const b = makeGolfEntry("b", -5, [{ playerId: "p1", position: "T20" }]);
    const result = applyGolfTiebreakers([a, b], rules);
    expect(result[0].uid).toBe("b");
  });

  it("handles non-numeric position like CUT (treated as Infinity)", () => {
    const rules: TiebreakerRule[] = [
      { id: "best_finishing_position", label: "", description: "" },
    ];
    const a = makeGolfEntry("a", -5, [{ playerId: "p1", position: "CUT" }]);
    const b = makeGolfEntry("b", -5, [{ playerId: "p1", position: "T15" }]);
    const result = applyGolfTiebreakers([a, b], rules);
    expect(result[0].uid).toBe("b");
  });

  it("breaks tie by most_cuts_made", () => {
    const rules: TiebreakerRule[] = [
      { id: "most_cuts_made", label: "", description: "" },
    ];
    const a = makeGolfEntry("a", 10, [
      { playerId: "p1", status: "finished", position: "T10" },
      { playerId: "p2", status: "cut" },
      { playerId: "p3", status: "finished", position: "T20" },
    ]);
    const b = makeGolfEntry("b", 10, [
      { playerId: "p1", status: "finished", position: "T5" },
      { playerId: "p2", status: "finished", position: "T15" },
      { playerId: "p3", status: "finished", position: "T25" },
    ]);
    const result = applyGolfTiebreakers([a, b], rules);
    expect(result[0].uid).toBe("b"); // b has 3 cuts made, a has 2
  });

  it("breaks tie by fewest_bogeys (wd/dq/cut penalties)", () => {
    const rules: TiebreakerRule[] = [
      { id: "fewest_bogeys", label: "", description: "" },
    ];
    const a = makeGolfEntry("a", 10, [
      { playerId: "p1", status: "wd" },
      { playerId: "p2", status: "dq" },
    ]);
    const b = makeGolfEntry("b", 10, [
      { playerId: "p1", status: "cut" },
      { playerId: "p2", status: "finished" },
    ]);
    const result = applyGolfTiebreakers([a, b], rules);
    expect(result[0].uid).toBe("b"); // b has 1 penalty, a has 2
  });

  it("breaks tie by lowest_single_round", () => {
    const rules: TiebreakerRule[] = [
      { id: "lowest_single_round", label: "", description: "" },
    ];
    const a = makeGolfEntry("a", -5, [
      { playerId: "p1", roundScoresToPar: ["-2", "+1", "E", "-1"] },
    ]);
    const b = makeGolfEntry("b", -5, [
      { playerId: "p1", roundScoresToPar: ["-4", "+3", "+1", "E"] },
    ]);
    const result = applyGolfTiebreakers([a, b], rules);
    expect(result[0].uid).toBe("b"); // b has a -4 round
  });

  it("handles E round score as 0", () => {
    const rules: TiebreakerRule[] = [
      { id: "lowest_single_round", label: "", description: "" },
    ];
    const a = makeGolfEntry("a", -5, [
      { playerId: "p1", roundScoresToPar: ["E"] },
    ]);
    const b = makeGolfEntry("b", -5, [
      { playerId: "p1", roundScoresToPar: ["+1"] },
    ]);
    const result = applyGolfTiebreakers([a, b], rules);
    expect(result[0].uid).toBe("a"); // E=0 < +1=1
  });

  it("cascades through multiple golf rules", () => {
    const rules: TiebreakerRule[] = [
      { id: "best_finishing_position", label: "", description: "" },
      { id: "lowest_single_round", label: "", description: "" },
    ];
    // Both have best position T10 (tied on first rule)
    const a = makeGolfEntry("a", -5, [
      { playerId: "p1", position: "T10", roundScoresToPar: ["-1", "E"] },
    ]);
    const b = makeGolfEntry("b", -5, [
      { playerId: "p1", position: "T10", roundScoresToPar: ["-3", "+2"] },
    ]);
    const result = applyGolfTiebreakers([a, b], rules);
    expect(result[0].uid).toBe("b"); // tied on position, b wins with -3 round
  });

  it("skips picks with empty playerId", () => {
    const rules: TiebreakerRule[] = [
      { id: "most_cuts_made", label: "", description: "" },
    ];
    const a = makeGolfEntry("a", -5, [
      { playerId: "", status: "finished", position: "T5" }, // should be skipped (no playerId)
      { playerId: "p1", status: "finished", position: "T10" },
    ]);
    const b = makeGolfEntry("b", -5, [
      { playerId: "p1", status: "finished", position: "T5" },
      { playerId: "p2", status: "finished", position: "T15" },
    ]);
    const result = applyGolfTiebreakers([a, b], rules);
    expect(result[0].uid).toBe("b"); // a=1 cut made (skipped empty), b=2
  });

  it("handles unknown golf rule id gracefully", () => {
    const rules: TiebreakerRule[] = [
      { id: "nonexistent" as never, label: "", description: "" },
    ];
    const a = makeGolfEntry("a", -5);
    const b = makeGolfEntry("b", -5);
    const result = applyGolfTiebreakers([a, b], rules);
    expect(result).toHaveLength(2);
  });

  it("handles picks with no roundScoresToPar for lowest_single_round", () => {
    const rules: TiebreakerRule[] = [
      { id: "lowest_single_round", label: "", description: "" },
    ];
    const a = makeGolfEntry("a", -5, [
      { playerId: "p1" }, // no round scores
    ]);
    const b = makeGolfEntry("b", -5, [
      { playerId: "p1", roundScoresToPar: ["-2"] },
    ]);
    const result = applyGolfTiebreakers([a, b], rules);
    expect(result[0].uid).toBe("b"); // a has Infinity, b has -2
  });
});
