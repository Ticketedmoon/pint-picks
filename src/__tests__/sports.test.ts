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
  fetchFootballStandings: vi.fn(),
  calculateTeamMatchPoints: vi.fn(),
  isKnockoutStage: vi.fn((s?: string) =>
    !!s && /round[\s-]?of|quarter|semi|\bfinal\b|3rd|third[\s-]?place|play-?off|knockout/i.test(s),
  ),
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
  beforeEach(async () => {
    const { fetchFootballStandings } = await import("@/lib/sports/football/espn");
    vi.mocked(fetchFootballStandings).mockResolvedValue([]);
  });

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

  it("fetchTournamentStatus returns in when tournament is ongoing", async () => {
    const { fetchFootballLeagueStatus } = await import("@/lib/sports/football/espn");
    vi.mocked(fetchFootballLeagueStatus).mockResolvedValue("in");

    const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
    // Use a league with no configured endDate so ESPN's status decides.
    const party = { ...mockParty, sportType: "football" as const, tournamentStartDate: pastDate, leagueSlug: "unknown.league" };
    const result = await footballConfig.fetchTournamentStatus(party);

    expect(result.status).toBe("in");
  });

  it("fetchTournamentStatus returns post when ESPN says post", async () => {
    const { fetchFootballLeagueStatus } = await import("@/lib/sports/football/espn");
    vi.mocked(fetchFootballLeagueStatus).mockResolvedValue("post");

    const pastDate = new Date(Date.now() - 86400000).toISOString();
    // No configured endDate, so ESPN's "post" status drives the transition.
    const party = { ...mockParty, sportType: "football" as const, tournamentStartDate: pastDate, leagueSlug: "unknown.league" };
    const result = await footballConfig.fetchTournamentStatus(party);

    expect(result.status).toBe("post");
  });

  it("fetchTournamentStatus returns post when config endDate has passed even if ESPN reports in", async () => {
    const { fetchFootballLeagueStatus } = await import("@/lib/sports/football/espn");
    // ESPN's season window extends past the final (e.g. WC season ends Dec 31),
    // so it can still report "in" after the tournament is actually over.
    vi.mocked(fetchFootballLeagueStatus).mockResolvedValue("in");

    // World Cup config endDate is 2026-07-19; start it just after that so we are
    // unambiguously past the final regardless of the real current date.
    const party = {
      ...mockParty,
      sportType: "football" as const,
      tournamentStartDate: "2026-07-20T00:00:00Z",
      leagueSlug: "fifa.world",
    };
    // Clear any prior call history so the not-called assertion is reliable.
    vi.mocked(fetchFootballLeagueStatus).mockClear();
    const result = await footballConfig.fetchTournamentStatus(party);

    expect(result.status).toBe("post");
    // ESPN should not even be consulted once the config end date has passed.
    expect(fetchFootballLeagueStatus).not.toHaveBeenCalled();
  });

  it("fetchTournamentStatus returns in on ESPN error when no config endDate has passed", async () => {
    const { fetchFootballLeagueStatus } = await import("@/lib/sports/football/espn");
    vi.mocked(fetchFootballLeagueStatus).mockRejectedValue(new Error("API error"));

    const pastDate = new Date(Date.now() - 86400000).toISOString();
    // Unknown league has no config endDate, and ESPN throws, so we default to "in".
    const party = { ...mockParty, sportType: "football" as const, tournamentStartDate: pastDate, leagueSlug: "unknown.league" };
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
      eliminated: false,
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

  it("fetchScores marks teams eliminated after a knockout loss", async () => {
    const { fetchFootballMatches, calculateTeamMatchPoints } = await import("@/lib/sports/football/espn");
    vi.mocked(fetchFootballMatches).mockResolvedValue([]);
    vi.mocked(calculateTeamMatchPoints).mockReturnValue({
      points: 6, matchesPlayed: 4, wins: 2, draws: 0, losses: 1,
      eliminated: true,
      matchSummaries: [
        { opponent: "Spain", opponentAbbr: "ESP", result: "L", teamScore: 0, opponentScore: 1, stage: "Round of 16" },
      ],
    });

    const party = {
      ...mockParty,
      sportType: "football" as const,
      customGroups: { A: [{ id: "202", displayName: "Argentina" }], B: [], C: [], D: [] },
    };
    const result = await footballConfig.fetchScores(party);

    expect(result.scores[0].status).toBe("eliminated");
  });

  it("fetchScores marks teams eliminated from group standings note", async () => {
    const { fetchFootballMatches, calculateTeamMatchPoints, fetchFootballStandings } = await import("@/lib/sports/football/espn");
    vi.mocked(fetchFootballMatches).mockResolvedValue([]);
    vi.mocked(calculateTeamMatchPoints).mockReturnValue({
      points: 1, matchesPlayed: 3, wins: 0, draws: 1, losses: 2,
      eliminated: false,
      matchSummaries: [],
    });
    vi.mocked(fetchFootballStandings).mockResolvedValue([
      {
        id: "1", name: "Group A", abbreviation: "A",
        entries: [{
          teamId: "202", teamName: "Argentina", abbreviation: "ARG", logo: "",
          matchesPlayed: 3, wins: 0, draws: 1, losses: 2, points: 1,
          goalsFor: 1, goalsAgainst: 6, goalDifference: -5, eliminated: true,
        }],
      },
    ]);

    const party = {
      ...mockParty,
      sportType: "football" as const,
      customGroups: { A: [{ id: "202", displayName: "Argentina" }], B: [], C: [], D: [] },
    };
    const result = await footballConfig.fetchScores(party);

    expect(result.scores[0].status).toBe("eliminated");
  });

  it("fetchScores marks a team eliminated when knockouts start and it missed the bracket", async () => {
    const { fetchFootballMatches, calculateTeamMatchPoints } = await import("@/lib/sports/football/espn");
    const mkTeam = (id: string, abbr: string, score = 0, winner = false) => ({
      id, displayName: abbr, abbreviation: abbr, logo: "", score, winner,
    });
    const mkMatch = (id: string, round: string, status: "pre" | "in" | "post", home: ReturnType<typeof mkTeam>, away: ReturnType<typeof mkTeam>) => ({
      id, date: "2026-06-20T19:00Z", name: `${home.abbreviation} vs ${away.abbreviation}`,
      shortName: `${home.abbreviation} v ${away.abbreviation}`, status, statusDetail: "FT", round,
      homeTeam: home, awayTeam: away,
    });
    // Team 202 finished all 3 group games but is not in any knockout fixture,
    // while a round-of-32 match between other teams has already been played.
    vi.mocked(fetchFootballMatches).mockResolvedValue([
      mkMatch("g1", "group-stage", "post", mkTeam("202", "SCO"), mkTeam("500", "X")),
      mkMatch("g2", "group-stage", "post", mkTeam("501", "Y"), mkTeam("202", "SCO")),
      mkMatch("g3", "group-stage", "post", mkTeam("202", "SCO"), mkTeam("502", "Z")),
      mkMatch("k1", "round-of-32", "post", mkTeam("300", "A", 2, true), mkTeam("400", "B", 1)),
    ]);
    vi.mocked(calculateTeamMatchPoints).mockReturnValue({
      points: 3, matchesPlayed: 3, wins: 1, draws: 0, losses: 2, eliminated: false, matchSummaries: [],
    });

    const party = {
      ...mockParty,
      sportType: "football" as const,
      customGroups: { A: [{ id: "202", displayName: "Scotland" }], B: [], C: [], D: [] },
    };
    const result = await footballConfig.fetchScores(party);

    expect(result.scores[0].status).toBe("eliminated");
  });

  it("fetchScores keeps a team active if it is in the knockout bracket", async () => {
    const { fetchFootballMatches, calculateTeamMatchPoints } = await import("@/lib/sports/football/espn");
    const mkTeam = (id: string, abbr: string) => ({ id, displayName: abbr, abbreviation: abbr, logo: "", score: 0, winner: false });
    const mkMatch = (id: string, round: string, status: "pre" | "in" | "post", homeId: string, awayId: string) => ({
      id, date: "2026-06-20T19:00Z", name: "m", shortName: "m", status, statusDetail: "FT", round,
      homeTeam: mkTeam(homeId, "H"), awayTeam: mkTeam(awayId, "A"),
    });
    // Team 202 finished its group and appears in an upcoming round-of-32 fixture.
    vi.mocked(fetchFootballMatches).mockResolvedValue([
      mkMatch("g1", "group-stage", "post", "202", "500"),
      mkMatch("k-other", "round-of-32", "post", "300", "400"),
      mkMatch("k-team", "round-of-32", "pre", "202", "600"),
    ]);
    vi.mocked(calculateTeamMatchPoints).mockReturnValue({
      points: 6, matchesPlayed: 3, wins: 2, draws: 0, losses: 1, eliminated: false, matchSummaries: [],
    });

    const party = {
      ...mockParty,
      sportType: "football" as const,
      customGroups: { A: [{ id: "202", displayName: "Scotland" }], B: [], C: [], D: [] },
    };
    const result = await footballConfig.fetchScores(party);

    expect(result.scores[0].status).toBe("active");
  });

  it("fetchScores uses wildcard name when team not in groups", async () => {
    const { fetchFootballMatches, calculateTeamMatchPoints } = await import("@/lib/sports/football/espn");
    vi.mocked(fetchFootballMatches).mockResolvedValue([]);
    vi.mocked(calculateTeamMatchPoints).mockReturnValue({
      points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, eliminated: false, matchSummaries: [],
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
      points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, eliminated: false, matchSummaries: [],
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
      points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, eliminated: false, matchSummaries: [],
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
