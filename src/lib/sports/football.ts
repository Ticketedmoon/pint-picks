import type { SportConfig, TournamentStatus } from "./types";
import type { Party, PlayerScore } from "@/types";
import { FOOTBALL_LEAGUES } from "@/lib/sports/football/leagues";
import type { FootballLeagueConfig } from "@/lib/sports/football/leagues";
import type { FootballMatch } from "@/lib/sports/football/types";

const CHUNK_DAYS = 7;

/** Format a Date as YYYYMMDD for ESPN's dates query param. */
function fmtEspnDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * Fetch all matches across the full tournament window, chunked into
 * CHUNK_DAYS-day windows so ESPN doesn't truncate large responses.
 * Results are deduplicated by match ID.
 */
async function fetchAllTournamentMatches(
  leagueSlug: string,
  leagueConfig: FootballLeagueConfig | undefined,
  fetcher: (slug: string, dateRange?: string) => Promise<FootballMatch[]>,
): Promise<FootballMatch[]> {
  if (!leagueConfig?.startDate) {
    // No config, fall back to a single undated request (today only)
    return fetcher(leagueSlug);
  }

  const start = new Date(leagueConfig.startDate);
  const end = leagueConfig.endDate ? new Date(leagueConfig.endDate) : new Date();

  // Build weekly chunks: [start, start+7), [start+7, start+14), ...
  const chunks: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setDate(chunkEnd.getDate() + CHUNK_DAYS - 1);
    const clampedEnd = chunkEnd > end ? end : chunkEnd;
    chunks.push(`${fmtEspnDate(cursor)}-${fmtEspnDate(clampedEnd)}`);
    cursor.setDate(cursor.getDate() + CHUNK_DAYS);
  }

  // Fetch all chunks in parallel
  const results = await Promise.all(
    chunks.map((range) => fetcher(leagueSlug, range)),
  );

  // Deduplicate by match ID
  const seen = new Set<string>();
  const allMatches: FootballMatch[] = [];
  for (const batch of results) {
    for (const match of batch) {
      if (!seen.has(match.id)) {
        seen.add(match.id);
        allMatches.push(match);
      }
    }
  }

  return allMatches;
}

/**
 * Football (soccer) sport adapter.
 *
 * Scoring: Win = 3 pts, Draw = 1 pt, Loss = 0 pts. Highest total wins.
 * No cut mechanic, no per-round breakdown, no "Thru" progress.
 * Sync: uses ESPN season dates for status, falls back to tournamentStartDate for locking.
 */

function formatPoints(points: number): string {
  return `${points} pts`;
}

function getFootballScoreColor(points: number): string {
  if (points >= 9) return "text-green-600";
  if (points >= 6) return "text-blue-600";
  if (points >= 3) return "text-gray-600";
  return "text-gray-400";
}

function getFootballTotalColor(total: number): string {
  if (total > 0) return "text-blue-600";
  return "text-gray-500";
}

export const footballConfig: SportConfig = {
  id: "football",

  // Display
  emoji: "⚽",
  entityLabel: "team",
  entityLabelPlural: "teams",
  groupLabel: "Tier",
  groupSublabels: {
    A: "Favourites",
    B: "Contenders",
    C: "Dark Horses",
    D: "Underdogs",
  },
  pickActionLabel: "Pick Teams",
  startEventLabel: "Kick-off",
  rankingDescription: "ranked by tournament seeding",
  winConditionLabel: "Highest total points wins 🏆",
  accentColor: "blue",

  // Scoring
  formatScore: formatPoints,
  formatTotal: formatPoints,
  getScoreColor: getFootballScoreColor,
  getTotalScoreColor: getFootballTotalColor,
  sortDirection: "desc",
  pendingScoreDisplay: "0 pts",

  // Football has none of these golf-specific features
  hasCutMechanic: false,
  hasRoundScores: false,
  hasMatchBreakdown: true,
  hasThruProgress: false,

  // Sync: uses the config end date as the authoritative "post" signal, with
  // ESPN's season status as a secondary check. tournamentStartDate drives the lock.
  async fetchTournamentStatus(party: Party): Promise<TournamentStatus> {
    const startTime = new Date(party.tournamentStartDate).getTime();
    const now = Date.now();

    if (now < startTime) {
      return { status: "pre", lockTime: startTime };
    }

    const leagueSlug = party.leagueSlug || "fifa.world";
    const config = FOOTBALL_LEAGUES[leagueSlug];

    // The config end date is the true tournament-final date and is the most
    // reliable "post" signal. ESPN's season window often extends far beyond the
    // final (e.g. the FIFA World Cup season endDate is Dec 31, months after the
    // July final), so a season-based check alone leaves parties stuck as "in"
    // long after the tournament is over. Trust the config end date first.
    if (config?.endDate) {
      const endTime = new Date(config.endDate).getTime();
      if (now > endTime) {
        return { status: "post", lockTime: startTime };
      }
    }

    // No config end date has passed yet: fall back to ESPN's season status for
    // leagues without a configured end date, or to catch an early finish.
    try {
      const { fetchFootballLeagueStatus } = await import("@/lib/sports/football/espn");
      const leagueStatus = await fetchFootballLeagueStatus(leagueSlug);
      if (leagueStatus === "post") {
        return { status: "post", lockTime: startTime };
      }
    } catch {
      // ESPN unavailable; the config end-date check above already handles "post".
    }

    return { status: "in", lockTime: startTime };
  },

  // Football doesn't validate picks against a live field
  async validatePicks() {
    return { valid: true, invalidPicks: [] };
  },

  // Fetch live scores from ESPN matches and standings
  async fetchScores(party: Party): Promise<{ scores: PlayerScore[]; cutLine: number | null; cutRound: number | null }> {
    try {
      const leagueSlug = party.leagueSlug || "fifa.world";
      const { fetchFootballMatches, calculateTeamMatchPoints, fetchFootballStandings, isKnockoutStage } = await import("@/lib/sports/football/espn");

      // ESPN's scoreboard without a date range only returns today's matches,
      // so we must request the full tournament window. For long tournaments
      // (e.g. 40-day World Cup), we chunk into 7-day windows to avoid ESPN
      // truncating large responses, then deduplicate by match ID.
      const leagueConfig = FOOTBALL_LEAGUES[leagueSlug];
      const matches = await fetchAllTournamentMatches(
        leagueSlug,
        leagueConfig,
        fetchFootballMatches,
      );

      const isKnockoutMatch = (m: FootballMatch): boolean =>
        isKnockoutStage(m.round) || isKnockoutStage(m.stage);

      // Bracket membership: once the knockout stage is underway, any team that
      // finished its group games but never appears in a knockout fixture has
      // been knocked out. This catches teams ESPN's standings note can't
      // distinguish, e.g. non-qualifying 3rd-placed teams whose note stays
      // "Best 8 advance" identical to the 3rd-placed teams that DID advance.
      const knockoutTeamIds = new Set<string>();
      let knockoutStarted = false;
      for (const m of matches) {
        if (!isKnockoutMatch(m)) continue;
        if (m.status === "in" || m.status === "post") knockoutStarted = true;
        if (m.homeTeam.id) knockoutTeamIds.add(m.homeTeam.id);
        if (m.awayTeam.id) knockoutTeamIds.add(m.awayTeam.id);
      }

      // Group-stage elimination: ESPN flags eliminated teams in the standings
      // note (e.g. bottom of a group after all matches played). Knockout-stage
      // elimination is derived from match results below. Standings are
      // best-effort: a failure here should not break live scoring.
      const eliminatedTeamIds = new Set<string>();
      try {
        const groups = await fetchFootballStandings(leagueSlug);
        for (const group of groups) {
          for (const entry of group.entries) {
            if (entry.eliminated) eliminatedTeamIds.add(entry.teamId);
          }
        }
      } catch {
        // Standings unavailable (e.g. league with no group phase); ignore.
      }

      // Build a set of all team IDs that were picked by any party member
      const allPickedTeamIds = new Set<string>();
      if (party.customGroups) {
        for (const group of Object.values(party.customGroups)) {
          for (const item of group) {
            allPickedTeamIds.add(item.id);
          }
        }
      }
      if (party.snapshotWildcards) {
        for (const wc of party.snapshotWildcards) {
          allPickedTeamIds.add(wc.id);
        }
      }

      // Calculate points for each team from completed matches
      const scores: PlayerScore[] = [];
      for (const teamId of allPickedTeamIds) {
        const result = calculateTeamMatchPoints(teamId, matches);
        // Find the team name from party data
        let teamName = teamId;
        if (party.customGroups) {
          for (const group of Object.values(party.customGroups)) {
            const found = group.find((t) => t.id === teamId);
            if (found) { teamName = found.displayName; break; }
          }
        }
        if (teamName === teamId && party.snapshotWildcards) {
          const found = party.snapshotWildcards.find((t) => t.id === teamId);
          if (found) teamName = found.displayName;
        }

        // Encode match summaries as roundScores for display in PickCell
        // Format: "W|OPP|2-0" or "D|OPP|1-1" or "L|OPP|0-3"
        const roundScores = result.matchSummaries.map(
          (m) => `${m.result}|${m.opponentAbbr}|${m.teamScore}-${m.opponentScore}`
        );

        // A team is knocked out if:
        //  - it lost a knockout match (result.eliminated), or
        //  - ESPN's group standings marked it eliminated, or
        //  - the knockout stage is underway, the team has finished all its
        //    group games, and it is not in the knockout bracket (missed out,
        //    e.g. a non-qualifying 3rd-placed team).
        const teamMatches = matches.filter(
          (m) => m.homeTeam.id === teamId || m.awayTeam.id === teamId,
        );
        const groupMatches = teamMatches.filter((m) => !isKnockoutMatch(m));
        const playedGroupGame = groupMatches.some((m) => m.status === "post");
        const hasPendingGroupGame = groupMatches.some((m) => m.status !== "post");
        const missedBracket =
          knockoutStarted &&
          playedGroupGame &&
          !hasPendingGroupGame &&
          !knockoutTeamIds.has(teamId);

        const eliminated =
          result.eliminated || eliminatedTeamIds.has(teamId) || missedBracket;
        const status: PlayerScore["status"] = eliminated
          ? "eliminated"
          : result.matchesPlayed > 0
            ? "active"
            : "pre";

        scores.push({
          playerId: teamId,
          playerName: teamName,
          scoreToPar: result.points,
          displayScore: formatPoints(result.points),
          status,
          roundScores: roundScores.length > 0 ? roundScores : undefined,
        });
      }

      return { scores, cutLine: null, cutRound: null };
    } catch {
      return { scores: [], cutLine: null, cutRound: null };
    }
  },

  // Football doesn't have round-by-round progress
  async fetchRoundInfo() {
    return null;
  },
};
