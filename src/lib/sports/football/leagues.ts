/**
 * Football league configuration for ESPN API integration.
 * Each league uses the same ESPN API pattern, just with a different slug.
 *
 * To add a new league: add an entry here. No other code changes needed.
 */

export interface FootballLeagueConfig {
  slug: string;
  name: string;
  shortName: string;
  /** "tournament" = has knockout stage (WC, CL), "league" = round-robin season (PL) */
  type: "tournament" | "league";
  /** Whether participants are national teams or clubs */
  teamType: "country" | "club";
  /** ESPN league ID */
  espnId: string;
  /** ISO date string for when the tournament/season starts. Used for pick locking. */
  startDate: string;
  /** ISO date string for when the tournament/season ends. Used for "post" detection as fallback. */
  endDate?: string;
}

export const FOOTBALL_LEAGUES: Record<string, FootballLeagueConfig> = {
  "fifa.world": {
    slug: "fifa.world",
    name: "FIFA World Cup 2026",
    shortName: "World Cup",
    type: "tournament",
    teamType: "country",
    espnId: "606",
    startDate: "2026-06-11T19:00:00Z", // Opening match: Mexico vs South Africa, June 11 2026
    endDate: "2026-07-19T20:00:00Z", // World Cup Final: July 19 2026
  },
  "eng.1": {
    slug: "eng.1",
    name: "English Premier League",
    shortName: "Premier League",
    type: "league",
    teamType: "club",
    espnId: "700",
    startDate: "2026-08-15T11:30:00Z", // Approximate 2026/27 season start
  },
  "uefa.champions": {
    slug: "uefa.champions",
    name: "UEFA Champions League",
    shortName: "Champions League",
    type: "tournament",
    teamType: "club",
    espnId: "775",
    startDate: "2026-09-15T17:00:00Z", // Approximate 2026/27 group stage start
  },
};

export const FOOTBALL_LEAGUE_SLUGS = Object.keys(FOOTBALL_LEAGUES);

/**
 * FIFA World Ranking order for the 48 World Cup 2026 teams.
 * Used to create tier groups A-D + wildcards.
 * Source: FIFA Men's World Ranking (June 2026 snapshot).
 * ESPN team IDs are used as keys.
 */
export const FIFA_WC_TEAM_RANKINGS: Record<string, number> = {
  // Tier A: Powerhouses (rank 1-6)
  "202": 1,    // Argentina
  "478": 2,    // France
  "164": 3,    // Spain
  "448": 4,    // England
  "205": 5,    // Brazil
  "482": 6,    // Portugal

  // Tier B: Contenders (rank 7-12)
  "449": 7,    // Netherlands
  "459": 8,    // Belgium
  "481": 9,    // Germany
  "208": 10,   // Colombia
  "212": 11,   // Uruguay
  "477": 12,   // Croatia

  // Tier C: Dark Horses (rank 13-18)
  "627": 13,   // Japan
  "465": 14,   // Türkiye
  "474": 15,   // Austria
  "660": 16,   // USA
  "2869": 17,  // Morocco
  "654": 18,   // Senegal

  // Tier D: Underdogs (rank 19-24)
  "475": 19,   // Switzerland
  "451": 20,   // South Korea
  "209": 21,   // Ecuador
  "466": 22,   // Sweden
  "464": 23,   // Norway
  "469": 24,   // Iran

  // Wildcards (rank 25+)
  "203": 25,   // Mexico
  "206": 26,   // Canada
  "2620": 27,  // Egypt
  "210": 28,   // Paraguay
  "628": 29,   // Australia
  "580": 30,   // Scotland
  "659": 31,   // Tunisia
  "2597": 32,  // Cape Verde
  "655": 33,   // Saudi Arabia
  "624": 34,   // Algeria
  "2917": 35,  // Jordan
  "4789": 36,  // Ivory Coast
  "450": 37,   // Czechia
  "467": 38,   // South Africa
  "452": 39,   // Bosnia-Herzegovina
  "4398": 40,  // Qatar
  "2654": 41,  // Haiti
  "2666": 42,  // New Zealand
  "4375": 43,  // Iraq
  "11678": 44, // Curaçao
  "2850": 45,  // Congo DR
  "2570": 46,  // Uzbekistan
  "4469": 47,  // Ghana
  "2659": 48,  // Panama
};

/**
 * Premier League team rankings based on 2024-25 final standings.
 * ESPN team IDs mapped to finishing position.
 */
export const PL_TEAM_RANKINGS: Record<string, number> = {
  "359": 1,   // Arsenal
  "364": 2,   // Liverpool
  "405": 3,   // Nottingham Forest
  "382": 4,   // Manchester City
  "362": 5,   // Chelsea
  "360": 6,   // Aston Villa
  "361": 7,   // Brighton
  "363": 8,   // Bournemouth
  "367": 9,   // Manchester United
  "368": 10,  // Newcastle
  "395": 11,  // Fulham
  "365": 12,  // Tottenham
  "394": 13,  // Brentford
  "381": 14,  // West Ham
  "357": 15,  // Crystal Palace
  "349": 16,  // Everton
  "374": 17,  // Wolverhampton
  "340": 18,  // Ipswich Town
  "375": 19,  // Leicester City
  "398": 20,  // Southampton
};

/**
 * Champions League team rankings based on UEFA club coefficients 2025-26.
 * Top seeded teams by coefficient.
 */
export const CL_TEAM_RANKINGS: Record<string, number> = {
  "86": 1,    // Real Madrid
  "382": 2,   // Manchester City
  "157": 3,   // Bayern Munich
  "110": 4,   // Paris Saint-Germain
  "364": 5,   // Liverpool
  "128": 6,   // Inter Milan
  "83": 7,    // Barcelona
  "359": 8,   // Arsenal
  "114": 9,   // Juventus
  "131": 10,  // Atletico Madrid
  "124": 11,  // Borussia Dortmund
  "362": 12,  // Chelsea
  // Remaining teams as wildcards
};

/**
 * Get the ranking table for a given league.
 */
export function getLeagueRankings(slug: string): Record<string, number> {
  switch (slug) {
    case "fifa.world":
      return FIFA_WC_TEAM_RANKINGS;
    case "eng.1":
      return PL_TEAM_RANKINGS;
    case "uefa.champions":
      return CL_TEAM_RANKINGS;
    default:
      return {};
  }
}
