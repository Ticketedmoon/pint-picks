import type {
  FootballTeam,
  FootballMatch,
  FootballTeamScore,
  FootballStandingsGroup,
  FootballLeague,
} from "@/lib/sports/football/types";
import { FOOTBALL_LEAGUES, type FootballLeagueConfig } from "@/lib/sports/football/leagues";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const ESPN_V2 = "https://site.api.espn.com/apis/v2/sports/soccer";

/** Simple in-memory cache with TTL for football ESPN API calls. */
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 180_000; // 3 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Clear the in-memory cache. Exported for use in tests. */
export function clearFootballCache(): void {
  cache.clear();
}

async function cachedFetch(url: string): Promise<Response> {
  const cached = getCached<unknown>(url);
  if (cached) {
    return new Response(JSON.stringify(cached), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  const res = await fetch(url);
  if (res.ok) {
    const data = await res.json();
    setCache(url, data);
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return res;
}

// --- ESPN Response Types (internal, not exported) ---

interface ESPNSoccerTeam {
  id: string;
  displayName: string;
  shortDisplayName: string;
  abbreviation: string;
  location: string;
  color?: string;
  alternateColor?: string;
  logo?: string;
  logos?: { href: string; rel: string[] }[];
}

interface ESPNSoccerCompetitor {
  id: string;
  type: string;
  order: number;
  homeAway: "home" | "away";
  winner: boolean;
  score: string;
  records?: { type: string; summary: string }[];
  team: ESPNSoccerTeam;
}

interface ESPNSoccerEvent {
  id: string;
  date: string;
  name: string;
  shortName: string;
  status: {
    type: {
      id: string;
      name: string;
      state: string;
      completed: boolean;
      description: string;
    };
  };
  competitions: {
    id: string;
    date: string;
    competitors: ESPNSoccerCompetitor[];
    venue?: { displayName: string };
    notes?: { text: string }[];
  }[];
}

interface ESPNStandingsEntry {
  team: ESPNSoccerTeam & {
    logos?: { href: string }[];
  };
  stats: { name: string; value: number; displayValue: string }[];
  note?: { description: string; rank: number };
}

interface ESPNStandingsGroup {
  id: string;
  name: string;
  abbreviation: string;
  standings: {
    entries: ESPNStandingsEntry[];
  };
}

// --- Public API ---

/**
 * Fetch all teams for a football league from ESPN.
 */
export async function fetchFootballTeams(leagueSlug: string): Promise<FootballTeam[]> {
  const res = await cachedFetch(`${ESPN_BASE}/${leagueSlug}/teams`);
  if (!res.ok) throw new Error(`ESPN teams API error: ${res.status}`);
  const data = await res.json();

  const teams: FootballTeam[] = [];
  const leagues = data.sports?.[0]?.leagues || [];
  for (const league of leagues) {
    for (const entry of league.teams || []) {
      const t = entry.team;
      teams.push({
        id: t.id,
        displayName: t.displayName,
        shortDisplayName: t.shortDisplayName,
        abbreviation: t.abbreviation,
        logo: t.logos?.[0]?.href || "",
        location: t.location,
        color: t.color,
        alternateColor: t.alternateColor,
      });
    }
  }

  return teams;
}

/**
 * Fetch all matches (scoreboard) for a football league.
 * For tournaments, this returns all matches. For leagues, it returns recent/upcoming.
 */
export async function fetchFootballMatches(
  leagueSlug: string,
  dateRange?: string,
): Promise<FootballMatch[]> {
  const url = dateRange
    ? `${ESPN_BASE}/${leagueSlug}/scoreboard?dates=${dateRange}`
    : `${ESPN_BASE}/${leagueSlug}/scoreboard`;

  const res = await cachedFetch(url);
  if (!res.ok) throw new Error(`ESPN scoreboard API error: ${res.status}`);
  const data = await res.json();

  return (data.events || []).map(mapEventToMatch);
}

function mapEventToMatch(event: ESPNSoccerEvent): FootballMatch {
  const comp = event.competitions?.[0];
  const home = comp?.competitors?.find((c) => c.homeAway === "home");
  const away = comp?.competitors?.find((c) => c.homeAway === "away");

  return {
    id: event.id,
    date: event.date,
    name: event.name,
    shortName: event.shortName,
    status: event.status.type.state as "pre" | "in" | "post",
    statusDetail: event.status.type.description,
    homeTeam: {
      id: home?.team.id || "",
      displayName: home?.team.displayName || "Unknown",
      abbreviation: home?.team.abbreviation || "???",
      logo: home?.team.logo || home?.team.logos?.[0]?.href || "",
      score: parseInt(home?.score || "0", 10),
      winner: home?.winner || false,
      record: home?.records?.find((r) => r.type === "total")?.summary,
    },
    awayTeam: {
      id: away?.team.id || "",
      displayName: away?.team.displayName || "Unknown",
      abbreviation: away?.team.abbreviation || "???",
      logo: away?.team.logo || away?.team.logos?.[0]?.href || "",
      score: parseInt(away?.score || "0", 10),
      winner: away?.winner || false,
      record: away?.records?.find((r) => r.type === "total")?.summary,
    },
    stage: comp?.notes?.[0]?.text,
    venue: comp?.venue?.displayName,
  };
}

/**
 * Fetch group standings for a football league/tournament.
 * Returns groups with team entries including W/D/L/Pts/GD.
 */
export async function fetchFootballStandings(
  leagueSlug: string,
): Promise<FootballStandingsGroup[]> {
  const res = await cachedFetch(`${ESPN_V2}/${leagueSlug}/standings`);
  if (!res.ok) throw new Error(`ESPN standings API error: ${res.status}`);
  const data = await res.json();

  const children: ESPNStandingsGroup[] = data.children || [];
  return children.map(mapStandingsGroup);
}

function mapStandingsGroup(group: ESPNStandingsGroup): FootballStandingsGroup {
  return {
    id: group.id,
    name: group.name,
    abbreviation: group.abbreviation,
    entries: (group.standings?.entries || []).map(mapStandingsEntry),
  };
}

function mapStandingsEntry(entry: ESPNStandingsEntry): FootballTeamScore {
  const getStat = (name: string): number => {
    const stat = entry.stats.find((s) => s.name === name);
    return stat?.value ?? 0;
  };

  const isEliminated = entry.note?.description?.toLowerCase().includes("eliminated") ?? false;

  return {
    teamId: entry.team.id,
    teamName: entry.team.displayName,
    abbreviation: entry.team.abbreviation || "",
    logo: entry.team.logos?.[0]?.href || "",
    matchesPlayed: getStat("gamesPlayed"),
    wins: getStat("wins"),
    draws: getStat("ties"),
    losses: getStat("losses"),
    points: getStat("points"),
    goalsFor: getStat("pointsFor"),
    goalsAgainst: getStat("pointsAgainst"),
    goalDifference: getStat("pointDifferential"),
    eliminated: isEliminated,
  };
}

export interface MatchSummary {
  opponent: string;
  opponentAbbr: string;
  result: "W" | "D" | "L";
  teamScore: number;
  opponentScore: number;
  stage?: string;
}

/**
 * Calculate a team's accumulated match points from completed matches.
 * Win = 3, Draw = 1, Loss = 0.
 * This is an alternative to standings when you need real-time scoring
 * from the scoreboard (e.g. during knockout rounds not reflected in group standings).
 */
export function calculateTeamMatchPoints(
  teamId: string,
  matches: FootballMatch[],
): { points: number; wins: number; draws: number; losses: number; matchesPlayed: number; matchSummaries: MatchSummary[] } {
  let points = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let matchesPlayed = 0;
  const matchSummaries: MatchSummary[] = [];

  for (const match of matches) {
    if (match.status !== "post") continue;

    const isHome = match.homeTeam.id === teamId;
    const isAway = match.awayTeam.id === teamId;
    if (!isHome && !isAway) continue;

    matchesPlayed++;

    const team = isHome ? match.homeTeam : match.awayTeam;
    const opponent = isHome ? match.awayTeam : match.homeTeam;

    let result: "W" | "D" | "L";
    if (team.winner) {
      wins++;
      points += 3;
      result = "W";
    } else if (opponent.winner) {
      losses++;
      result = "L";
    } else {
      draws++;
      points += 1;
      result = "D";
    }

    matchSummaries.push({
      opponent: opponent.displayName,
      opponentAbbr: opponent.abbreviation,
      result,
      teamScore: team.score,
      opponentScore: opponent.score,
      stage: match.stage,
    });
  }

  return { points, wins, draws, losses, matchesPlayed, matchSummaries };
}

/**
 * Fetch the current status of a single football league from ESPN season dates.
 * Returns "pre", "in", or "post".
 */
export async function fetchFootballLeagueStatus(leagueSlug: string): Promise<"pre" | "in" | "post"> {
  try {
    const res = await cachedFetch(`${ESPN_BASE}/${leagueSlug}/scoreboard`);
    if (!res.ok) return "in"; // default to "in" if we can't determine
    const data = await res.json();
    const league = data.leagues?.[0];
    if (!league) return "in";

    const season = league.season || {};
    return determineLeagueStatus(season.startDate, season.endDate);
  } catch {
    return "in";
  }
}

/**
 * Fetch available football leagues with their current status.
 */
export async function fetchFootballLeagues(): Promise<FootballLeague[]> {
  const configs = Object.values(FOOTBALL_LEAGUES);
  const results = await Promise.all(configs.map(fetchLeagueInfo));
  return results.filter((r): r is FootballLeague => r !== null);
}

async function fetchLeagueInfo(config: FootballLeagueConfig): Promise<FootballLeague | null> {
  try {
    const res = await cachedFetch(`${ESPN_BASE}/${config.slug}/scoreboard`);
    if (!res.ok) return null;
    const data = await res.json();
    const league = data.leagues?.[0];
    if (!league) return null;

    const season = league.season || {};
    const logos = league.logos || [];

    return {
      slug: config.slug,
      name: config.name,
      shortName: config.shortName,
      logo: logos[0]?.href || "",
      type: config.type,
      seasonYear: season.year || new Date().getFullYear(),
      seasonDisplayName: season.displayName || config.name,
      startDate: season.startDate || "",
      endDate: season.endDate || "",
      status: determineLeagueStatus(season.startDate, season.endDate),
    };
  } catch {
    return null;
  }
}

function determineLeagueStatus(startDate?: string, endDate?: string): "pre" | "in" | "post" {
  if (!startDate || !endDate) return "pre";
  const now = Date.now();
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (now < start) return "pre";
  if (now > end) return "post";
  return "in";
}
