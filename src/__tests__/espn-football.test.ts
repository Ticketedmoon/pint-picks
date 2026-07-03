import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateTeamMatchPoints,
  isKnockoutStage,
  clearFootballCache,
} from "@/lib/sports/football/espn";
import type { FootballMatch } from "@/lib/sports/football/types";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  clearFootballCache();
  mockFetch.mockReset();
});

describe("calculateTeamMatchPoints", () => {
  const baseMatch: FootballMatch = {
    id: "1",
    date: "2026-06-12T19:00Z",
    name: "Team A vs Team B",
    shortName: "A vs B",
    status: "post",
    statusDetail: "Full Time",
    homeTeam: {
      id: "100",
      displayName: "Team A",
      abbreviation: "TA",
      logo: "",
      score: 2,
      winner: true,
    },
    awayTeam: {
      id: "200",
      displayName: "Team B",
      abbreviation: "TB",
      logo: "",
      score: 1,
      winner: false,
    },
  };

  it("awards 3 points for a win", () => {
    const result = calculateTeamMatchPoints("100", [baseMatch]);
    expect(result).toEqual({
      points: 3,
      wins: 1,
      draws: 0,
      losses: 0,
      matchesPlayed: 1,
      matchSummaries: [{ opponent: "Team B", opponentAbbr: "TB", result: "W", teamScore: 2, opponentScore: 1, stage: undefined }],
      eliminated: false,
    });
  });

  it("awards 0 points for a loss", () => {
    const result = calculateTeamMatchPoints("200", [baseMatch]);
    expect(result).toEqual({
      points: 0,
      wins: 0,
      draws: 0,
      losses: 1,
      matchesPlayed: 1,
      matchSummaries: [{ opponent: "Team A", opponentAbbr: "TA", result: "L", teamScore: 1, opponentScore: 2, stage: undefined }],
      eliminated: false,
    });
  });

  it("awards 1 point for a draw", () => {
    const drawMatch: FootballMatch = {
      ...baseMatch,
      homeTeam: { ...baseMatch.homeTeam, score: 1, winner: false },
      awayTeam: { ...baseMatch.awayTeam, score: 1, winner: false },
    };
    const result = calculateTeamMatchPoints("100", [drawMatch]);
    expect(result).toEqual({
      points: 1,
      wins: 0,
      draws: 1,
      losses: 0,
      matchesPlayed: 1,
      matchSummaries: [{ opponent: "Team B", opponentAbbr: "TB", result: "D", teamScore: 1, opponentScore: 1, stage: undefined }],
      eliminated: false,
    });
  });

  it("ignores matches that are not completed", () => {
    const preMatch: FootballMatch = { ...baseMatch, status: "pre" };
    const inMatch: FootballMatch = { ...baseMatch, id: "2", status: "in" };
    const result = calculateTeamMatchPoints("100", [preMatch, inMatch]);
    expect(result.matchesPlayed).toBe(0);
    expect(result.points).toBe(0);
  });

  it("ignores matches where the team is not involved", () => {
    const result = calculateTeamMatchPoints("999", [baseMatch]);
    expect(result.matchesPlayed).toBe(0);
    expect(result.points).toBe(0);
  });

  it("accumulates points across multiple matches", () => {
    const match2: FootballMatch = {
      ...baseMatch,
      id: "2",
      homeTeam: { ...baseMatch.homeTeam, id: "100", score: 0, winner: false },
      awayTeam: { ...baseMatch.awayTeam, id: "300", score: 0, winner: false },
    };
    const match3: FootballMatch = {
      ...baseMatch,
      id: "3",
      homeTeam: { ...baseMatch.homeTeam, id: "400", score: 3, winner: true },
      awayTeam: { ...baseMatch.awayTeam, id: "100", score: 0, winner: false },
    };

    // match1: win (3pts), match2: draw (1pt), match3: loss (0pts)
    const result = calculateTeamMatchPoints("100", [baseMatch, match2, match3]);
    expect(result.points).toBe(4);
    expect(result.wins).toBe(1);
    expect(result.draws).toBe(1);
    expect(result.losses).toBe(1);
    expect(result.matchesPlayed).toBe(3);
    expect(result.matchSummaries).toHaveLength(3);
    expect(result.matchSummaries[0].result).toBe("W");
    expect(result.matchSummaries[1].result).toBe("D");
    expect(result.matchSummaries[2].result).toBe("L");
  });

  it("handles away team wins correctly", () => {
    const awayWin: FootballMatch = {
      ...baseMatch,
      homeTeam: { ...baseMatch.homeTeam, score: 0, winner: false },
      awayTeam: { ...baseMatch.awayTeam, score: 2, winner: true },
    };
    const result = calculateTeamMatchPoints("200", [awayWin]);
    expect(result).toEqual({
      points: 3,
      wins: 1,
      draws: 0,
      losses: 0,
      matchesPlayed: 1,
      matchSummaries: [{ opponent: "Team A", opponentAbbr: "TA", result: "W", teamScore: 2, opponentScore: 0, stage: undefined }],
      eliminated: false,
    });
  });

  it("returns zero for empty matches array", () => {
    const result = calculateTeamMatchPoints("100", []);
    expect(result).toEqual({
      points: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      matchesPlayed: 0,
      matchSummaries: [],
      eliminated: false,
    });
  });
});

describe("isKnockoutStage", () => {
  it("returns true for knockout rounds", () => {
    expect(isKnockoutStage("Round of 16")).toBe(true);
    expect(isKnockoutStage("Round of 32")).toBe(true);
    expect(isKnockoutStage("Quarterfinals")).toBe(true);
    expect(isKnockoutStage("Semifinals")).toBe(true);
    expect(isKnockoutStage("Final")).toBe(true);
    expect(isKnockoutStage("3rd Place")).toBe(true);
  });

  it("returns true for ESPN season round slugs", () => {
    expect(isKnockoutStage("round-of-32")).toBe(true);
    expect(isKnockoutStage("round-of-16")).toBe(true);
    expect(isKnockoutStage("quarterfinals")).toBe(true);
    expect(isKnockoutStage("semifinals")).toBe(true);
    expect(isKnockoutStage("third-place")).toBe(true);
  });

  it("returns false for group/league stages and missing values", () => {
    expect(isKnockoutStage("Group A")).toBe(false);
    expect(isKnockoutStage("group-stage")).toBe(false);
    expect(isKnockoutStage("Matchday 5")).toBe(false);
    expect(isKnockoutStage(undefined)).toBe(false);
    expect(isKnockoutStage("")).toBe(false);
  });
});

describe("calculateTeamMatchPoints knockout elimination", () => {
  const knockoutLoss: FootballMatch = {
    id: "ko1",
    date: "2026-07-05T19:00Z",
    name: "Team A vs Team B",
    shortName: "A vs B",
    status: "post",
    statusDetail: "Full Time",
    stage: "Round of 16",
    homeTeam: { id: "100", displayName: "Team A", abbreviation: "TA", logo: "", score: 1, winner: false },
    awayTeam: { id: "200", displayName: "Team B", abbreviation: "TB", logo: "", score: 2, winner: true },
  };

  it("marks a team eliminated after a knockout loss", () => {
    const result = calculateTeamMatchPoints("100", [knockoutLoss]);
    expect(result.eliminated).toBe(true);
    expect(result.losses).toBe(1);
  });

  it("marks a team eliminated via the season round slug when notes are empty", () => {
    // Real ESPN data: knockout matches carry an empty notes text but a
    // season.slug like "round-of-32". Croatia lost to Portugal here.
    const realKnockoutLoss: FootballMatch = {
      ...knockoutLoss,
      stage: "",
      round: "round-of-32",
    };
    const result = calculateTeamMatchPoints("100", [realKnockoutLoss]);
    expect(result.eliminated).toBe(true);
  });

  it("does not eliminate the knockout winner", () => {
    const result = calculateTeamMatchPoints("200", [knockoutLoss]);
    expect(result.eliminated).toBe(false);
    expect(result.wins).toBe(1);
  });

  it("does not eliminate on a group-stage loss", () => {
    const groupLoss: FootballMatch = { ...knockoutLoss, stage: "Group A" };
    const result = calculateTeamMatchPoints("100", [groupLoss]);
    expect(result.eliminated).toBe(false);
  });
});

describe("fetchFootballTeams", () => {
  it("parses ESPN teams response correctly", async () => {
    const { fetchFootballTeams } = await import("@/lib/sports/football/espn");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sports: [{
          leagues: [{
            teams: [
              {
                team: {
                  id: "202",
                  displayName: "Argentina",
                  shortDisplayName: "Argentina",
                  abbreviation: "ARG",
                  location: "Argentina",
                  color: "74acdf",
                  logos: [{ href: "https://example.com/arg.png", rel: ["full", "default"] }],
                },
              },
              {
                team: {
                  id: "205",
                  displayName: "Brazil",
                  shortDisplayName: "Brazil",
                  abbreviation: "BRA",
                  location: "Brazil",
                  color: "fee000",
                  logos: [{ href: "https://example.com/bra.png", rel: ["full", "default"] }],
                },
              },
            ],
          }],
        }],
      }),
    });

    const teams = await fetchFootballTeams("fifa.world");
    expect(teams).toHaveLength(2);
    expect(teams[0]).toEqual({
      id: "202",
      displayName: "Argentina",
      shortDisplayName: "Argentina",
      abbreviation: "ARG",
      logo: "https://example.com/arg.png",
      location: "Argentina",
      color: "74acdf",
      alternateColor: undefined,
    });
  });

  it("throws on ESPN API error", async () => {
    const { fetchFootballTeams } = await import("@/lib/sports/football/espn");
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(fetchFootballTeams("fifa.world")).rejects.toThrow("ESPN teams API error: 500");
  });
});

describe("fetchFootballMatches", () => {
  it("parses ESPN scoreboard response correctly", async () => {
    const { fetchFootballMatches } = await import("@/lib/sports/football/espn");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        events: [{
          id: "760415",
          date: "2026-06-11T19:00Z",
          name: "South Africa at Mexico",
          shortName: "RSA @ MEX",
          status: { type: { id: "1", name: "STATUS_SCHEDULED", state: "pre", completed: false, description: "Scheduled" } },
          competitions: [{
            id: "760415",
            date: "2026-06-11T19:00Z",
            competitors: [
              {
                id: "203",
                type: "team",
                order: 0,
                homeAway: "home",
                winner: false,
                score: "0",
                team: { id: "203", displayName: "Mexico", shortDisplayName: "Mexico", abbreviation: "MEX", location: "Mexico", logo: "https://example.com/mex.png" },
              },
              {
                id: "467",
                type: "team",
                order: 1,
                homeAway: "away",
                winner: false,
                score: "0",
                team: { id: "467", displayName: "South Africa", shortDisplayName: "South Africa", abbreviation: "RSA", location: "South Africa", logo: "https://example.com/rsa.png" },
              },
            ],
            venue: { displayName: "Estadio Banorte" },
          }],
        }],
      }),
    });

    const matches = await fetchFootballMatches("fifa.world");
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe("760415");
    expect(matches[0].status).toBe("pre");
    expect(matches[0].homeTeam.displayName).toBe("Mexico");
    expect(matches[0].awayTeam.displayName).toBe("South Africa");
    expect(matches[0].venue).toBe("Estadio Banorte");
  });
});

describe("fetchFootballStandings", () => {
  it("parses ESPN standings response correctly", async () => {
    const { fetchFootballStandings } = await import("@/lib/sports/football/espn");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        children: [{
          id: "1",
          name: "Group A",
          abbreviation: "Group A",
          standings: {
            entries: [{
              team: {
                id: "203",
                displayName: "Mexico",
                abbreviation: "MEX",
                logos: [{ href: "https://example.com/mex.png" }],
              },
              stats: [
                { name: "gamesPlayed", value: 3 },
                { name: "wins", value: 2 },
                { name: "ties", value: 1 },
                { name: "losses", value: 0 },
                { name: "points", value: 7 },
                { name: "pointsFor", value: 5 },
                { name: "pointsAgainst", value: 2 },
                { name: "pointDifferential", value: 3 },
              ],
              note: { description: "Advance to Round of 32", rank: 1 },
            }],
          },
        }],
      }),
    });

    const standings = await fetchFootballStandings("fifa.world");
    expect(standings).toHaveLength(1);
    expect(standings[0].name).toBe("Group A");
    expect(standings[0].entries[0].teamName).toBe("Mexico");
    expect(standings[0].entries[0].points).toBe(7);
    expect(standings[0].entries[0].wins).toBe(2);
    expect(standings[0].entries[0].draws).toBe(1);
    expect(standings[0].entries[0].eliminated).toBe(false);
  });

  it("detects eliminated teams", async () => {
    const { fetchFootballStandings } = await import("@/lib/sports/football/espn");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        children: [{
          id: "1",
          name: "Group A",
          abbreviation: "Group A",
          standings: {
            entries: [{
              team: { id: "450", displayName: "Czechia", abbreviation: "CZE", logos: [] },
              stats: [
                { name: "gamesPlayed", value: 3 },
                { name: "wins", value: 0 },
                { name: "ties", value: 0 },
                { name: "losses", value: 3 },
                { name: "points", value: 0 },
                { name: "pointsFor", value: 0 },
                { name: "pointsAgainst", value: 5 },
                { name: "pointDifferential", value: -5 },
              ],
              note: { description: "Eliminated", rank: 4 },
            }],
          },
        }],
      }),
    });

    const standings = await fetchFootballStandings("fifa.world");
    expect(standings[0].entries[0].eliminated).toBe(true);
  });

  it("throws on ESPN API error", async () => {
    const { fetchFootballStandings } = await import("@/lib/sports/football/espn");
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(fetchFootballStandings("fifa.world")).rejects.toThrow("ESPN standings API error: 503");
  });

  it("handles empty children array", async () => {
    const { fetchFootballStandings } = await import("@/lib/sports/football/espn");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });
    const standings = await fetchFootballStandings("fifa.world");
    expect(standings).toHaveLength(0);
  });

  it("handles missing stats gracefully with defaults", async () => {
    const { fetchFootballStandings } = await import("@/lib/sports/football/espn");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        children: [{
          id: "1",
          name: "Group A",
          abbreviation: "Group A",
          standings: {
            entries: [{
              team: { id: "999", displayName: "Unknown", logos: [] },
              stats: [],
            }],
          },
        }],
      }),
    });
    const standings = await fetchFootballStandings("fifa.world");
    expect(standings[0].entries[0].points).toBe(0);
    expect(standings[0].entries[0].wins).toBe(0);
    expect(standings[0].entries[0].eliminated).toBe(false);
  });
});

describe("fetchFootballMatches with dateRange", () => {
  it("appends dates to URL when dateRange provided", async () => {
    const { fetchFootballMatches } = await import("@/lib/sports/football/espn");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: [] }),
    });
    await fetchFootballMatches("fifa.world", "20260611-20260628");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("dates=20260611-20260628")
    );
  });

  it("throws on ESPN API error", async () => {
    const { fetchFootballMatches } = await import("@/lib/sports/football/espn");
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(fetchFootballMatches("fifa.world")).rejects.toThrow("ESPN scoreboard API error: 404");
  });
});

describe("fetchFootballLeagues", () => {
  it("returns leagues from ESPN", async () => {
    const { fetchFootballLeagues } = await import("@/lib/sports/football/espn");

    // Mock 3 calls (one per league)
    for (let i = 0; i < 3; i++) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          leagues: [{
            season: {
              year: 2026,
              startDate: "2026-06-11T00:00Z",
              endDate: "2026-07-19T00:00Z",
              displayName: "2026 FIFA World Cup",
            },
            logos: [{ href: "https://example.com/logo.png" }],
          }],
        }),
      });
    }

    const leagues = await fetchFootballLeagues();
    expect(leagues.length).toBeGreaterThan(0);
    expect(leagues[0].slug).toBeDefined();
    expect(leagues[0].name).toBeDefined();
  });

  it("handles ESPN API failure gracefully", async () => {
    const { fetchFootballLeagues } = await import("@/lib/sports/football/espn");

    for (let i = 0; i < 3; i++) {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    }

    const leagues = await fetchFootballLeagues();
    expect(leagues).toHaveLength(0);
  });

  it("filters out null results from failed fetches", async () => {
    const { fetchFootballLeagues } = await import("@/lib/sports/football/espn");

    // First succeeds, rest fail
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        leagues: [{
          season: { year: 2026, startDate: "2026-06-11T00:00Z", endDate: "2026-07-19T00:00Z", displayName: "WC" },
          logos: [],
        }],
      }),
    });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const leagues = await fetchFootballLeagues();
    expect(leagues).toHaveLength(1);
  });

  it("handles missing league data in response", async () => {
    const { fetchFootballLeagues } = await import("@/lib/sports/football/espn");

    for (let i = 0; i < 3; i++) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ leagues: [] }),
      });
    }

    const leagues = await fetchFootballLeagues();
    expect(leagues).toHaveLength(0);
  });
});

describe("mapEventToMatch edge cases", () => {
  it("handles missing competitors gracefully", async () => {
    const { fetchFootballMatches } = await import("@/lib/sports/football/espn");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        events: [{
          id: "1",
          date: "2026-06-11T19:00Z",
          name: "TBD",
          shortName: "TBD",
          status: { type: { id: "1", name: "STATUS_SCHEDULED", state: "pre", completed: false, description: "Scheduled" } },
          competitions: [{
            id: "1",
            date: "2026-06-11T19:00Z",
            competitors: [],
          }],
        }],
      }),
    });

    const matches = await fetchFootballMatches("fifa.world");
    expect(matches[0].homeTeam.displayName).toBe("Unknown");
    expect(matches[0].awayTeam.displayName).toBe("Unknown");
  });

  it("handles team without logo or logos array", async () => {
    const { fetchFootballMatches } = await import("@/lib/sports/football/espn");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        events: [{
          id: "1",
          date: "2026-06-11T19:00Z",
          name: "Test",
          shortName: "T",
          status: { type: { id: "1", name: "STATUS_SCHEDULED", state: "pre", completed: false, description: "Scheduled" } },
          competitions: [{
            id: "1",
            date: "2026-06-11T19:00Z",
            competitors: [
              {
                id: "100",
                type: "team",
                order: 0,
                homeAway: "home",
                winner: false,
                score: "0",
                team: { id: "100", displayName: "TeamA", abbreviation: "TA", location: "A" },
              },
              {
                id: "200",
                type: "team",
                order: 1,
                homeAway: "away",
                winner: false,
                score: "0",
                team: { id: "200", displayName: "TeamB", abbreviation: "TB", location: "B", logos: [{ href: "logo.png", rel: [] }] },
              },
            ],
          }],
        }],
      }),
    });

    const matches = await fetchFootballMatches("fifa.world");
    expect(matches[0].homeTeam.logo).toBe("");
    expect(matches[0].awayTeam.logo).toBe("logo.png");
  });
});

describe("caching", () => {
  it("returns cached data on second call", async () => {
    const { fetchFootballTeams } = await import("@/lib/sports/football/espn");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sports: [{ leagues: [{ teams: [{ team: { id: "1", displayName: "Team", shortDisplayName: "T", abbreviation: "T", location: "L", logos: [] } }] }] }],
      }),
    });

    const first = await fetchFootballTeams("test.league");
    const second = await fetchFootballTeams("test.league");

    expect(first).toEqual(second);
    // fetch should only be called once (second call uses cache)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("determineLeagueStatus via fetchFootballLeagues", () => {
  it("returns 'post' for a league that has already ended", async () => {
    const { fetchFootballLeagues } = await import("@/lib/sports/football/espn");

    // All three league calls return a league that ended in the past
    for (let i = 0; i < 3; i++) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          leagues: [{
            season: {
              year: 2020,
              startDate: "2020-01-01T00:00Z",
              endDate: "2020-06-01T00:00Z",
              displayName: "Past League",
            },
            logos: [],
          }],
        }),
      });
    }

    const leagues = await fetchFootballLeagues();
    expect(leagues.length).toBeGreaterThan(0);
    expect(leagues[0].status).toBe("post");
  });

  it("returns 'pre' for a league that has not started", async () => {
    const { fetchFootballLeagues } = await import("@/lib/sports/football/espn");

    for (let i = 0; i < 3; i++) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          leagues: [{
            season: {
              year: 2030,
              startDate: "2030-01-01T00:00Z",
              endDate: "2030-06-01T00:00Z",
              displayName: "Future League",
            },
            logos: [],
          }],
        }),
      });
    }

    const leagues = await fetchFootballLeagues();
    expect(leagues.length).toBeGreaterThan(0);
    expect(leagues[0].status).toBe("pre");
  });

  it("returns 'in' for a league currently in progress", async () => {
    const { fetchFootballLeagues } = await import("@/lib/sports/football/espn");

    const now = new Date();
    const pastDate = new Date(now.getTime() - 86400000).toISOString();
    const futureDate = new Date(now.getTime() + 86400000).toISOString();

    for (let i = 0; i < 3; i++) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          leagues: [{
            season: {
              year: now.getFullYear(),
              startDate: pastDate,
              endDate: futureDate,
              displayName: "Active League",
            },
            logos: [],
          }],
        }),
      });
    }

    const leagues = await fetchFootballLeagues();
    expect(leagues.length).toBeGreaterThan(0);
    expect(leagues[0].status).toBe("in");
  });

  it("returns 'pre' when season dates are missing", async () => {
    const { fetchFootballLeagues } = await import("@/lib/sports/football/espn");

    for (let i = 0; i < 3; i++) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          leagues: [{
            season: { year: 2026, displayName: "No Dates League" },
            logos: [],
          }],
        }),
      });
    }

    const leagues = await fetchFootballLeagues();
    expect(leagues.length).toBeGreaterThan(0);
    expect(leagues[0].status).toBe("pre");
  });
});
