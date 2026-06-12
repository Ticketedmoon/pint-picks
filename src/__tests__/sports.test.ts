import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Party } from "@/types";
import { mockParty } from "./helpers";

// Mock ESPN and pickValidation since golf adapter imports them
vi.mock("@/lib/sports/golf/espn", () => ({
  calculateEffectiveScore: vi.fn(),
  formatScoreToPar: (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`),
  fetchFirstTeeTime: vi.fn(),
  fetchTournamentSnapshot: vi.fn(),
  fetchLeaderboard: vi.fn(),
}));

vi.mock("@/lib/sports/golf/pickValidation", () => ({
  validatePartyPicksForGolf: vi.fn(),
  validatePartyPicks: vi.fn(),
}));

vi.mock("@/lib/sports/golf/scoring", () => ({
  isCutStatus: vi.fn((s: string) => s === "cut" || s === "wd" || s === "dq"),
  getScoreColor: vi.fn(() => "text-green-600"),
  getTotalScoreColor: vi.fn(() => "text-green-700"),
}));

vi.mock("@/lib/sports/golf/playerGroups", () => ({
  GROUP_LABELS: { A: "Group A - Elite", B: "Group B - Contenders", C: "Group C - Mid", D: "Group D - Field" },
}));

vi.mock("@/lib/sports/football/espn", () => ({
  fetchFootballLeagueStatus: vi.fn(),
  fetchFootballMatches: vi.fn(),
  calculateTeamMatchPoints: vi.fn(),
}));

import { getSportConfig, getAllSportConfigs } from "@/lib/sports/registry";
import { golfConfig } from "@/lib/sports/golf";
import { footballConfig } from "@/lib/sports/football";

// Mock fetch for golf adapter (fetchScores uses fetch)
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("SportConfig registry", () => {
  it("returns golf config by default (no sportType)", () => {
    const config = getSportConfig();
    expect(config.id).toBe("golf");
  });

  it("returns golf config for 'golf'", () => {
    const config = getSportConfig("golf");
    expect(config.id).toBe("golf");
  });

  it("returns football config for 'football'", () => {
    const config = getSportConfig("football");
    expect(config.id).toBe("football");
  });

  it("falls back to golf for unknown sport type", () => {
    const config = getSportConfig("cricket" as never);
    expect(config.id).toBe("golf");
  });

  it("getAllSportConfigs returns both configs", () => {
    const all = getAllSportConfigs();
    expect(all.length).toBe(2);
    expect(all.map(c => c.id)).toContain("golf");
    expect(all.map(c => c.id)).toContain("football");
  });
});

describe("golfConfig", () => {
  it("has correct display properties", () => {
    expect(golfConfig.emoji).toBe("⛳");
    expect(golfConfig.entityLabel).toBe("player");
    expect(golfConfig.entityLabelPlural).toBe("players");
    expect(golfConfig.groupLabel).toBe("Group");
    expect(golfConfig.pickActionLabel).toBe("Pick Players");
    expect(golfConfig.startEventLabel).toBe("First tee-off");
    expect(golfConfig.sortDirection).toBe("asc");
    expect(golfConfig.pendingScoreDisplay).toBe("-");
  });

  it("has golf-specific features enabled", () => {
    expect(golfConfig.hasCutMechanic).toBe(true);
    expect(golfConfig.hasRoundScores).toBe(true);
    expect(golfConfig.hasMatchBreakdown).toBe(false);
    expect(golfConfig.hasThruProgress).toBe(true);
  });

  it("formats scores as score to par", () => {
    expect(golfConfig.formatScore(-3)).toBe("-3");
    expect(golfConfig.formatScore(0)).toBe("E");
    expect(golfConfig.formatScore(5)).toBe("+5");
  });

  it("formats totals the same as scores", () => {
    expect(golfConfig.formatTotal(-7)).toBe("-7");
    expect(golfConfig.formatTotal(0)).toBe("E");
  });

  it("has groupSublabels for A-D", () => {
    expect(golfConfig.groupSublabels).toHaveProperty("A");
    expect(golfConfig.groupSublabels).toHaveProperty("B");
    expect(golfConfig.groupSublabels).toHaveProperty("C");
    expect(golfConfig.groupSublabels).toHaveProperty("D");
  });

  it("fetchTournamentStatus calls ESPN and returns status", async () => {
    const { fetchTournamentSnapshot } = await import("@/lib/sports/golf/espn");
    vi.mocked(fetchTournamentSnapshot).mockResolvedValue({ status: "in", firstTeeTime: "2025-06-01T10:00:00Z" });

    const party = { ...mockParty, tournamentId: "401580340" };
    const result = await golfConfig.fetchTournamentStatus(party);

    expect(result.status).toBe("in");
    expect(result.lockTime).toBe(Date.parse("2025-06-01T10:00:00Z"));
  });

  it("fetchTournamentStatus converts pre+past-tee to in", async () => {
    const { fetchTournamentSnapshot } = await import("@/lib/sports/golf/espn");
    const pastTee = new Date(Date.now() - 3600000).toISOString();
    vi.mocked(fetchTournamentSnapshot).mockResolvedValue({ status: "pre", firstTeeTime: pastTee });

    const party = { ...mockParty, tournamentId: "401580340" };
    const result = await golfConfig.fetchTournamentStatus(party);

    expect(result.status).toBe("in");
  });

  it("validatePicks delegates to validatePartyPicksForGolf", async () => {
    const { validatePartyPicksForGolf } = await import("@/lib/sports/golf/pickValidation");
    vi.mocked(validatePartyPicksForGolf).mockResolvedValue({ valid: true, invalidPicks: [] });

    const result = await golfConfig.validatePicks(mockParty);
    expect(result.valid).toBe(true);
    expect(validatePartyPicksForGolf).toHaveBeenCalledWith(mockParty);
  });

  it("fetchScores returns parsed leaderboard data", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        scores: [{ playerId: "1", playerName: "Tiger", scoreToPar: -5, displayScore: "-5", status: "playing" }],
        cutLine: 3,
        cutRound: 2,
      }),
    });
    const result = await golfConfig.fetchScores(mockParty);
    expect(result.scores.length).toBe(1);
    expect(result.cutLine).toBe(3);
  });

  it("fetchScores returns empty on API error", async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const result = await golfConfig.fetchScores(mockParty);
    expect(result.scores).toEqual([]);
  });

  it("fetchRoundInfo returns round data", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ currentRound: 2, displayRound: 2, totalRounds: 4, nextRoundTeeTime: null }),
    });
    const result = await golfConfig.fetchRoundInfo(mockParty);
    expect(result?.currentRound).toBe(2);
  });

  it("fetchRoundInfo returns null on error", async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const result = await golfConfig.fetchRoundInfo(mockParty);
    expect(result).toBeNull();
  });
});

describe("footballConfig", () => {
  it("has correct display properties", () => {
    expect(footballConfig.emoji).toBe("⚽");
    expect(footballConfig.entityLabel).toBe("team");
    expect(footballConfig.entityLabelPlural).toBe("teams");
    expect(footballConfig.groupLabel).toBe("Tier");
    expect(footballConfig.pickActionLabel).toBe("Pick Teams");
    expect(footballConfig.startEventLabel).toBe("Kick-off");
    expect(footballConfig.sortDirection).toBe("desc");
    expect(footballConfig.pendingScoreDisplay).toBe("0 pts");
  });

  it("has golf-specific features disabled", () => {
    expect(footballConfig.hasCutMechanic).toBe(false);
    expect(footballConfig.hasRoundScores).toBe(false);
    expect(footballConfig.hasMatchBreakdown).toBe(true);
    expect(footballConfig.hasThruProgress).toBe(false);
  });

  it("formats scores as points", () => {
    expect(footballConfig.formatScore(0)).toBe("0 pts");
    expect(footballConfig.formatScore(3)).toBe("3 pts");
    expect(footballConfig.formatScore(12)).toBe("12 pts");
  });

  it("formats totals as points", () => {
    expect(footballConfig.formatTotal(9)).toBe("9 pts");
    expect(footballConfig.formatTotal(0)).toBe("0 pts");
  });

  it("getScoreColor returns green for high points", () => {
    expect(footballConfig.getScoreColor(9)).toBe("text-green-600");
    expect(footballConfig.getScoreColor(6)).toBe("text-blue-600");
    expect(footballConfig.getScoreColor(3)).toBe("text-gray-600");
    expect(footballConfig.getScoreColor(0)).toBe("text-gray-400");
  });

  it("getTotalScoreColor returns blue for positive, gray for zero", () => {
    expect(footballConfig.getTotalScoreColor(5)).toBe("text-blue-600");
    expect(footballConfig.getTotalScoreColor(0)).toBe("text-gray-500");
  });

  it("has groupSublabels for A-D", () => {
    expect(footballConfig.groupSublabels.A).toBe("Favourites");
    expect(footballConfig.groupSublabels.B).toBe("Contenders");
    expect(footballConfig.groupSublabels.C).toBe("Dark Horses");
    expect(footballConfig.groupSublabels.D).toBe("Underdogs");
  });

  it("fetchTournamentStatus returns pre before start date", async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString(); // 1 day from now
    const party = { ...mockParty, sportType: "football" as const, tournamentStartDate: futureDate };
    const result = await footballConfig.fetchTournamentStatus(party);

    expect(result.status).toBe("pre");
    expect(result.lockTime).toBe(new Date(futureDate).getTime());
  });

  it("fetchTournamentStatus returns in after start date", async () => {
    const { fetchFootballLeagueStatus } = await import("@/lib/sports/football/espn");
    vi.mocked(fetchFootballLeagueStatus).mockResolvedValue("in");

    const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
    const party = { ...mockParty, sportType: "football" as const, tournamentStartDate: pastDate };
    const result = await footballConfig.fetchTournamentStatus(party);

    expect(result.status).toBe("in");
  });

  it("fetchTournamentStatus returns post when ESPN says post", async () => {
    const { fetchFootballLeagueStatus } = await import("@/lib/sports/football/espn");
    vi.mocked(fetchFootballLeagueStatus).mockResolvedValue("post");

    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const party = { ...mockParty, sportType: "football" as const, tournamentStartDate: pastDate, leagueSlug: "fifa.world" };
    const result = await footballConfig.fetchTournamentStatus(party);

    expect(result.status).toBe("post");
  });

  it("fetchTournamentStatus falls back to config endDate on ESPN error", async () => {
    const { fetchFootballLeagueStatus } = await import("@/lib/sports/football/espn");
    vi.mocked(fetchFootballLeagueStatus).mockRejectedValue(new Error("API error"));

    // Use a past start date so we get past the "pre" check, and the config endDate is in the past
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const party = { ...mockParty, sportType: "football" as const, tournamentStartDate: pastDate, leagueSlug: "fifa.world" };
    // World Cup endDate is 2026-07-19, which is in the future, so this should return "in"
    const result = await footballConfig.fetchTournamentStatus(party);

    expect(result.status).toBe("in");
  });

  it("validatePicks always returns valid", async () => {
    const result = await footballConfig.validatePicks(mockParty);
    expect(result.valid).toBe(true);
    expect(result.invalidPicks).toEqual([]);
  });

  it("fetchScores returns empty when no custom groups or wildcards", async () => {
    const { fetchFootballMatches } = await import("@/lib/sports/football/espn");
    vi.mocked(fetchFootballMatches).mockResolvedValue([]);

    const party = { ...mockParty, sportType: "football" as const };
    const result = await footballConfig.fetchScores(party);
    expect(result.scores).toEqual([]);
    expect(result.cutLine).toBeNull();
  });

  it("fetchScores calculates team scores from matches", async () => {
    const { fetchFootballMatches, calculateTeamMatchPoints } = await import("@/lib/sports/football/espn");
    vi.mocked(fetchFootballMatches).mockResolvedValue([]);
    vi.mocked(calculateTeamMatchPoints).mockReturnValue({
      points: 6, matchesPlayed: 2, wins: 2, draws: 0, losses: 0,
      matchSummaries: [
        { opponent: "Brazil", opponentAbbr: "BRA", result: "W", teamScore: 2, opponentScore: 0 },
        { opponent: "Germany", opponentAbbr: "GER", result: "W", teamScore: 1, opponentScore: 0 },
      ],
    });

    const party = {
      ...mockParty,
      sportType: "football" as const,
      customGroups: {
        A: [{ id: "202", displayName: "Argentina" }],
        B: [{ id: "478", displayName: "France" }],
        C: [],
        D: [],
      },
      snapshotWildcards: [{ id: "203", displayName: "Mexico" }],
    };
    const result = await footballConfig.fetchScores(party);

    expect(result.scores.length).toBe(3);
    expect(result.scores[0].playerName).toBe("Argentina");
    expect(result.scores[0].scoreToPar).toBe(6);
    expect(result.scores[0].displayScore).toBe("6 pts");
    expect(result.scores[0].status).toBe("active");
    expect(result.scores[0].roundScores).toEqual(["W|BRA|2-0", "W|GER|1-0"]);
  });

  it("fetchScores uses wildcard name when team not in groups", async () => {
    const { fetchFootballMatches, calculateTeamMatchPoints } = await import("@/lib/sports/football/espn");
    vi.mocked(fetchFootballMatches).mockResolvedValue([]);
    vi.mocked(calculateTeamMatchPoints).mockReturnValue({
      points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, matchSummaries: [],
    });

    const party = {
      ...mockParty,
      sportType: "football" as const,
      customGroups: { A: [], B: [], C: [], D: [] },
      snapshotWildcards: [{ id: "203", displayName: "Mexico" }],
    };
    const result = await footballConfig.fetchScores(party);

    expect(result.scores.length).toBe(1);
    expect(result.scores[0].playerName).toBe("Mexico");
    expect(result.scores[0].status).toBe("pre");
  });

  it("fetchScores catches errors and returns empty", async () => {
    const { fetchFootballMatches } = await import("@/lib/sports/football/espn");
    vi.mocked(fetchFootballMatches).mockRejectedValue(new Error("network"));

    const party = {
      ...mockParty,
      sportType: "football" as const,
      customGroups: { A: [{ id: "202", displayName: "Argentina" }], B: [], C: [], D: [] },
    };
    const result = await footballConfig.fetchScores(party);
    expect(result.scores).toEqual([]);
  });

  it("fetchScores fetches matches in weekly chunks across full tournament window", async () => {
    const { fetchFootballMatches, calculateTeamMatchPoints } = await import("@/lib/sports/football/espn");
    vi.mocked(fetchFootballMatches).mockResolvedValue([]);
    vi.mocked(calculateTeamMatchPoints).mockReturnValue({
      points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, matchSummaries: [],
    });

    const party = {
      ...mockParty,
      sportType: "football" as const,
      leagueSlug: "fifa.world",
      customGroups: { A: [{ id: "202", displayName: "Argentina" }], B: [], C: [], D: [] },
    };
    await footballConfig.fetchScores(party);

    // fifa.world runs 2026-06-11 to 2026-07-19 (39 days), so we expect 6 weekly chunks
    const calls = vi.mocked(fetchFootballMatches).mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(6);
    // Every call should include a date range param (YYYYMMDD-YYYYMMDD)
    for (const call of calls) {
      expect(call[1]).toMatch(/^\d{8}-\d{8}$/);
    }
    // First chunk should start on tournament start date
    expect(calls[0][1]).toMatch(/^20260611-/);
    // Last chunk should end on or before tournament end date
    const lastRange = calls[calls.length - 1][1] as string;
    const lastEnd = lastRange.split("-")[1];
    expect(parseInt(lastEnd)).toBeLessThanOrEqual(20260719);
  });

  it("fetchScores deduplicates matches returned by multiple chunks", async () => {
    const { fetchFootballMatches, calculateTeamMatchPoints } = await import("@/lib/sports/football/espn");

    const sharedMatch = {
      id: "match-1", date: "2026-06-12", name: "ARG vs BRA", shortName: "ARG vs BRA",
      status: "post" as const, statusDetail: "FT",
      homeTeam: { id: "202", displayName: "Argentina", abbreviation: "ARG", logo: "", score: 2, winner: true },
      awayTeam: { id: "205", displayName: "Brazil", abbreviation: "BRA", logo: "", score: 0, winner: false },
    };
    // Return the same match from multiple chunks to simulate overlap
    vi.mocked(fetchFootballMatches).mockResolvedValue([sharedMatch]);
    vi.mocked(calculateTeamMatchPoints).mockReturnValue({
      points: 3, matchesPlayed: 1, wins: 1, draws: 0, losses: 0,
      matchSummaries: [{ opponent: "Brazil", opponentAbbr: "BRA", result: "W", teamScore: 2, opponentScore: 0 }],
    });

    const party = {
      ...mockParty,
      sportType: "football" as const,
      leagueSlug: "fifa.world",
      customGroups: { A: [{ id: "202", displayName: "Argentina" }], B: [], C: [], D: [] },
    };
    const result = await footballConfig.fetchScores(party);

    // calculateTeamMatchPoints should be called with a deduplicated array
    // (even though the same match was returned by 6 chunks, it should appear only once)
    const matchesArg = vi.mocked(calculateTeamMatchPoints).mock.calls[0][1];
    const matchIds = matchesArg.map((m: { id: string }) => m.id);
    const uniqueIds = new Set(matchIds);
    expect(uniqueIds.size).toBe(matchIds.length);
    // Score should reflect the single match, not duplicated
    expect(result.scores[0].scoreToPar).toBe(3);
  });

  it("fetchScores falls back to undated request when league has no config", async () => {
    const { fetchFootballMatches, calculateTeamMatchPoints } = await import("@/lib/sports/football/espn");
    vi.mocked(fetchFootballMatches).mockReset();
    vi.mocked(fetchFootballMatches).mockResolvedValue([]);
    vi.mocked(calculateTeamMatchPoints).mockReturnValue({
      points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, matchSummaries: [],
    });

    const party = {
      ...mockParty,
      sportType: "football" as const,
      leagueSlug: "unknown.league",
      customGroups: { A: [{ id: "202", displayName: "Argentina" }], B: [], C: [], D: [] },
    };
    await footballConfig.fetchScores(party);

    // Should make a single call without a date range
    const calls = vi.mocked(fetchFootballMatches).mock.calls;
    expect(calls.length).toBe(1);
    expect(calls[0][1]).toBeUndefined();
  });

  it("fetchRoundInfo returns null", async () => {
    const result = await footballConfig.fetchRoundInfo(mockParty);
    expect(result).toBeNull();
  });
});
