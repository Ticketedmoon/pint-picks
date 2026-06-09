import type { SportConfig, TournamentStatus } from "./types";
import type { Party, PlayerScore } from "@/types";
import { FOOTBALL_LEAGUES } from "@/lib/sports/football/leagues";

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

  // Sync: uses ESPN season end date for "post", tournamentStartDate for lock
  async fetchTournamentStatus(party: Party): Promise<TournamentStatus> {
    const startTime = new Date(party.tournamentStartDate).getTime();
    const now = Date.now();

    if (now < startTime) {
      return { status: "pre", lockTime: startTime };
    }

    // Try to get the end date from ESPN for accurate "post" detection
    try {
      const leagueSlug = party.leagueSlug || "fifa.world";
      const { fetchFootballLeagueStatus } = await import("@/lib/sports/football/espn");
      const leagueStatus = await fetchFootballLeagueStatus(leagueSlug);
      if (leagueStatus === "post") {
        return { status: "post", lockTime: startTime };
      }
    } catch {
      // Fall back to config end date if ESPN call fails
      const leagueSlug = party.leagueSlug || "fifa.world";
      const config = FOOTBALL_LEAGUES[leagueSlug];
      if (config?.endDate) {
        const endTime = new Date(config.endDate).getTime();
        if (now > endTime) {
          return { status: "post", lockTime: startTime };
        }
      }
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
      const { fetchFootballMatches, calculateTeamMatchPoints } = await import("@/lib/sports/football/espn");

      // Fetch all matches for the tournament
      const matches = await fetchFootballMatches(leagueSlug);

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

        scores.push({
          playerId: teamId,
          playerName: teamName,
          scoreToPar: result.points,
          displayScore: formatPoints(result.points),
          status: result.matchesPlayed > 0 ? "active" : "pre",
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
