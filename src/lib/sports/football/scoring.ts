import type { FootballTeamScore, FootballLeaderboardEntry } from "@/lib/sports/football/types";
import type { Party, Picks, TiebreakerRule } from "@/types";
import { PICK_SLOT_DEFS } from "@/lib/constants";
import { DEFAULT_FOOTBALL_TIEBREAKERS, applyFootballTiebreakers } from "@/lib/tiebreaker";

/**
 * Football scoring: Win = 3, Draw = 1, Loss = 0.
 * Points accumulate across all completed matches (group + knockout).
 * Eliminated teams stop accumulating, but their existing points count.
 */

/**
 * Format football points for display.
 */
export function formatFootballPoints(points: number): string {
  return `${points} pts`;
}

/**
 * Get the Tailwind text color class for a football score.
 */
export function getFootballScoreColor(points: number, eliminated: boolean): string {
  if (eliminated) return "text-red-700";
  if (points >= 9) return "text-green-600";
  if (points >= 6) return "text-blue-600";
  if (points >= 3) return "text-gray-600";
  return "text-gray-400";
}

/**
 * Build football leaderboard entries from party picks and team scores.
 * Analogous to golf's buildLeaderboardEntries.
 */
export function buildFootballLeaderboardEntries(
  party: Party,
  allPicks: Record<string, Picks>,
  usersInfo: Record<string, { displayName: string; photoURL?: string }>,
  teamScores: FootballTeamScore[],
): FootballLeaderboardEntry[] {
  const scoreByIdMap = new Map<string, FootballTeamScore>();
  teamScores.forEach((ts) => scoreByIdMap.set(ts.teamId, ts));

  const entries = party.memberUids.map((uid) => {
    const picks = allPicks[uid];
    const userInfo = usersInfo[uid] || { displayName: "Unknown" };

    let totalPoints = 0;
    const resolvedPicks = picks
      ? PICK_SLOT_DEFS.map(({ key, label }) => {
          const pick = picks[key];

          if (!pick?.playerId) {
            return {
              group: label,
              teamId: "",
              teamName: "Not picked",
              abbreviation: "",
              logo: "",
              points: 0,
              matchesPlayed: 0,
              wins: 0,
              draws: 0,
              losses: 0,
              eliminated: false,
              goalsFor: 0,
              goalsAgainst: 0,
            };
          }

          // For football, playerId stores the team ID
          const teamScore = scoreByIdMap.get(pick.playerId);
          if (!teamScore) {
            return {
              group: label,
              teamId: pick.playerId,
              teamName: pick.playerName || "Unknown",
              abbreviation: "",
              logo: "",
              points: 0,
              matchesPlayed: 0,
              wins: 0,
              draws: 0,
              losses: 0,
              eliminated: false,
              goalsFor: 0,
              goalsAgainst: 0,
            };
          }

          totalPoints += teamScore.points;

          return {
            group: label,
            teamId: teamScore.teamId,
            teamName: teamScore.teamName,
            abbreviation: teamScore.abbreviation,
            logo: teamScore.logo,
            points: teamScore.points,
            matchesPlayed: teamScore.matchesPlayed,
            wins: teamScore.wins,
            draws: teamScore.draws,
            losses: teamScore.losses,
            eliminated: teamScore.eliminated,
            goalsFor: teamScore.goalsFor,
            goalsAgainst: teamScore.goalsAgainst,
          };
        })
      : [];

    return {
      userName: userInfo.displayName,
      userPhotoURL: userInfo.photoURL,
      uid,
      picks: resolvedPicks,
      totalPoints,
    };
  });

  // Sort by total points descending, then apply tiebreakers for equal scores
  const rules = party.tiebreakerRules || DEFAULT_FOOTBALL_TIEBREAKERS;
  entries.sort((a, b) => b.totalPoints - a.totalPoints);
  return applyFootballTiebreakers(entries, rules);
}
