import { describe, it, expect } from "vitest";
import { FOOTBALL_LEAGUES, FOOTBALL_LEAGUE_SLUGS, getLeagueRankings, FIFA_WC_TEAM_RANKINGS, PL_TEAM_RANKINGS, CL_TEAM_RANKINGS } from "@/lib/sports/football/leagues";

describe("FOOTBALL_LEAGUES", () => {
  it("has all 3 configured leagues", () => {
    expect(Object.keys(FOOTBALL_LEAGUES)).toHaveLength(3);
    expect(FOOTBALL_LEAGUES["fifa.world"]).toBeDefined();
    expect(FOOTBALL_LEAGUES["eng.1"]).toBeDefined();
    expect(FOOTBALL_LEAGUES["uefa.champions"]).toBeDefined();
  });

  it("each league has required fields", () => {
    for (const config of Object.values(FOOTBALL_LEAGUES)) {
      expect(config.slug).toBeTruthy();
      expect(config.name).toBeTruthy();
      expect(config.shortName).toBeTruthy();
      expect(["tournament", "league"]).toContain(config.type);
      expect(config.espnId).toBeTruthy();
    }
  });
});

describe("FOOTBALL_LEAGUE_SLUGS", () => {
  it("contains all league slugs", () => {
    expect(FOOTBALL_LEAGUE_SLUGS).toContain("fifa.world");
    expect(FOOTBALL_LEAGUE_SLUGS).toContain("eng.1");
    expect(FOOTBALL_LEAGUE_SLUGS).toContain("uefa.champions");
  });
});

describe("getLeagueRankings", () => {
  it("returns FIFA WC rankings for fifa.world", () => {
    const rankings = getLeagueRankings("fifa.world");
    expect(rankings).toBe(FIFA_WC_TEAM_RANKINGS);
    expect(Object.keys(rankings).length).toBe(48);
  });

  it("returns PL rankings for eng.1", () => {
    const rankings = getLeagueRankings("eng.1");
    expect(rankings).toBe(PL_TEAM_RANKINGS);
    expect(Object.keys(rankings).length).toBe(20);
  });

  it("returns CL rankings for uefa.champions", () => {
    const rankings = getLeagueRankings("uefa.champions");
    expect(rankings).toBe(CL_TEAM_RANKINGS);
    expect(Object.keys(rankings).length).toBeGreaterThan(0);
  });

  it("returns empty object for unknown league", () => {
    const rankings = getLeagueRankings("unknown.league");
    expect(rankings).toEqual({});
  });
});

describe("FIFA_WC_TEAM_RANKINGS", () => {
  it("has Argentina ranked first", () => {
    expect(FIFA_WC_TEAM_RANKINGS["202"]).toBe(1);
  });

  it("has 48 teams", () => {
    expect(Object.keys(FIFA_WC_TEAM_RANKINGS)).toHaveLength(48);
  });

  it("all rankings are unique", () => {
    const values = Object.values(FIFA_WC_TEAM_RANKINGS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
