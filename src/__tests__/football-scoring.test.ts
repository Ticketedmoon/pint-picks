import { describe, it, expect } from "vitest";
import {
  formatFootballPoints,
  getFootballScoreColor,
  buildFootballLeaderboardEntries,
} from "@/lib/sports/football/scoring";
import type { FootballTeamScore } from "@/lib/sports/football/types";
import type { Party, Picks } from "@/types";

describe("formatFootballPoints", () => {
  it("formats zero points", () => {
    expect(formatFootballPoints(0)).toBe("0 pts");
  });

  it("formats positive points", () => {
    expect(formatFootballPoints(9)).toBe("9 pts");
  });

  it("formats large point totals", () => {
    expect(formatFootballPoints(21)).toBe("21 pts");
  });
});

describe("getFootballScoreColor", () => {
  it("returns red for eliminated teams", () => {
    expect(getFootballScoreColor(9, true)).toBe("text-red-700");
  });

  it("returns green for high scorers (9+)", () => {
    expect(getFootballScoreColor(9, false)).toBe("text-green-600");
  });

  it("returns blue for mid scorers (6-8)", () => {
    expect(getFootballScoreColor(7, false)).toBe("text-blue-600");
  });

  it("returns gray for low scorers (3-5)", () => {
    expect(getFootballScoreColor(4, false)).toBe("text-gray-600");
  });

  it("returns light gray for very low scorers (0-2)", () => {
    expect(getFootballScoreColor(1, false)).toBe("text-gray-400");
  });
});

describe("buildFootballLeaderboardEntries", () => {
  const baseParty: Party = {
    id: "party-1",
    name: "Test Party",
    createdBy: "user-1",
    inviteCode: "ABC123",
    tournamentId: "wc-2026",
    tournamentName: "FIFA World Cup 2026",
    tournamentStartDate: "2026-06-11",
    createdAt: "2026-06-01",
    status: "locked",
    memberUids: ["user-1", "user-2"],
    buyIn: 10,
    currency: "EUR",
    secondPlacePayout: false,
    thirdPlacePayout: false,
    sportType: "football",
    leagueSlug: "fifa.world",
  };

  const teamScores: FootballTeamScore[] = [
    {
      teamId: "202",
      teamName: "Argentina",
      abbreviation: "ARG",
      logo: "arg.png",
      matchesPlayed: 3,
      wins: 3,
      draws: 0,
      losses: 0,
      points: 9,
      goalsFor: 7,
      goalsAgainst: 1,
      goalDifference: 6,
      eliminated: false,
    },
    {
      teamId: "205",
      teamName: "Brazil",
      abbreviation: "BRA",
      logo: "bra.png",
      matchesPlayed: 3,
      wins: 1,
      draws: 1,
      losses: 1,
      points: 4,
      goalsFor: 3,
      goalsAgainst: 3,
      goalDifference: 0,
      eliminated: false,
    },
    {
      teamId: "203",
      teamName: "Mexico",
      abbreviation: "MEX",
      logo: "mex.png",
      matchesPlayed: 3,
      wins: 2,
      draws: 0,
      losses: 1,
      points: 6,
      goalsFor: 4,
      goalsAgainst: 2,
      goalDifference: 2,
      eliminated: false,
    },
  ];

  const allPicks: Record<string, Picks> = {
    "user-1": {
      groupA: { playerId: "202", playerName: "Argentina" },
      groupB: { playerId: "205", playerName: "Brazil" },
      groupC: null,
      groupD: null,
      wildcard1: { playerId: "203", playerName: "Mexico" },
      wildcard2: null,
    },
    "user-2": {
      groupA: { playerId: "205", playerName: "Brazil" },
      groupB: { playerId: "203", playerName: "Mexico" },
      groupC: null,
      groupD: null,
      wildcard1: null,
      wildcard2: null,
    },
  };

  const usersInfo = {
    "user-1": { displayName: "Alice" },
    "user-2": { displayName: "Bob" },
  };

  it("builds leaderboard entries with correct totals", () => {
    const entries = buildFootballLeaderboardEntries(baseParty, allPicks, usersInfo, teamScores);
    expect(entries).toHaveLength(2);

    // user-1: Argentina (9) + Brazil (4) + Mexico (6) = 19
    // user-2: Brazil (4) + Mexico (6) = 10
    // Sorted by total points descending
    expect(entries[0].userName).toBe("Alice");
    expect(entries[0].totalPoints).toBe(19);
    expect(entries[1].userName).toBe("Bob");
    expect(entries[1].totalPoints).toBe(10);
  });

  it("sorts by highest points first", () => {
    const entries = buildFootballLeaderboardEntries(baseParty, allPicks, usersInfo, teamScores);
    expect(entries[0].totalPoints).toBeGreaterThanOrEqual(entries[1].totalPoints);
  });

  it("handles missing picks gracefully", () => {
    const entries = buildFootballLeaderboardEntries(baseParty, allPicks, usersInfo, teamScores);
    const alice = entries.find((e) => e.userName === "Alice")!;
    // groupC and groupD are null picks
    const unpicked = alice.picks.filter((p) => p.teamName === "Not picked");
    expect(unpicked).toHaveLength(3); // groupC, groupD, wildcard2
  });

  it("handles user with no picks at all", () => {
    const emptyPicks: Record<string, Picks> = {};
    const entries = buildFootballLeaderboardEntries(baseParty, emptyPicks, usersInfo, teamScores);
    expect(entries).toHaveLength(2);
    expect(entries[0].totalPoints).toBe(0);
    expect(entries[0].picks).toHaveLength(0);
  });

  it("handles unknown team IDs", () => {
    const picksWithUnknown: Record<string, Picks> = {
      "user-1": {
        groupA: { playerId: "999", playerName: "Nonexistent" },
        groupB: null,
        groupC: null,
        groupD: null,
        wildcard1: null,
        wildcard2: null,
      },
    };
    const singleParty = { ...baseParty, memberUids: ["user-1"] };
    const entries = buildFootballLeaderboardEntries(singleParty, picksWithUnknown, usersInfo, teamScores);
    expect(entries[0].totalPoints).toBe(0);
    expect(entries[0].picks[0].teamName).toBe("Nonexistent");
  });
});
