import type { TiebreakerRule, TiebreakerRuleId, LeaderboardEntry } from "@/types";
import type { FootballLeaderboardEntry } from "@/lib/sports/football/types";

// ─── Football tiebreakers ───

/**
 * All available football tiebreaker rules.
 * Each rule defines how to compare two entries when their primary scores are equal.
 */
export const FOOTBALL_TIEBREAKER_OPTIONS: TiebreakerRule[] = [
  {
    id: "furthest_team",
    label: "Furthest team in competition",
    description: "The person whose picked teams survived the longest (fewest eliminated) wins the tie",
  },
  {
    id: "goals_scored",
    label: "Most goals scored (combined)",
    description: "Total goals scored across all picked teams",
  },
  {
    id: "least_goals_conceded",
    label: "Least goals conceded (combined)",
    description: "Fewest goals conceded across all picked teams",
  },
  {
    id: "goal_difference",
    label: "Best goal difference (combined)",
    description: "Highest combined goal difference across all picked teams",
  },
  {
    id: "most_wins",
    label: "Most wins (combined)",
    description: "Highest combined win count across all picked teams",
  },
];

/** Default football tiebreaker order when a party has no custom rules set */
export const DEFAULT_FOOTBALL_TIEBREAKERS: TiebreakerRule[] = [
  FOOTBALL_TIEBREAKER_OPTIONS[0], // furthest_team
  FOOTBALL_TIEBREAKER_OPTIONS[1], // goals_scored
  FOOTBALL_TIEBREAKER_OPTIONS[2], // least_goals_conceded
];

// ─── Golf tiebreakers ───

export const GOLF_TIEBREAKER_OPTIONS: TiebreakerRule[] = [
  {
    id: "best_finishing_position",
    label: "Best finishing golfer",
    description: "The person with a golfer closest to winning (lowest finishing position)",
  },
  {
    id: "most_cuts_made",
    label: "Most golfers made the cut",
    description: "The person with the most golfers who made the cut wins the tie",
  },
  {
    id: "lowest_single_round",
    label: "Lowest single round",
    description: "The person whose golfer posted the lowest individual round score",
  },
  {
    id: "fewest_bogeys",
    label: "Fewest penalties (WD/DQ/cut)",
    description: "The person with the fewest golfers who were cut, withdrew, or disqualified",
  },
];

/** Default golf tiebreaker order when a party has no custom rules set */
export const DEFAULT_GOLF_TIEBREAKERS: TiebreakerRule[] = [
  GOLF_TIEBREAKER_OPTIONS[0], // best_finishing_position
  GOLF_TIEBREAKER_OPTIONS[1], // most_cuts_made
  GOLF_TIEBREAKER_OPTIONS[2], // lowest_single_round
];

// ─── Football stats and comparison ───

type FootballPickStats = {
  activeTeams: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  wins: number;
};

function getFootballPickStats(entry: FootballLeaderboardEntry): FootballPickStats {
  let activeTeams = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let wins = 0;

  for (const pick of entry.picks) {
    if (!pick.teamId) continue;
    if (!pick.eliminated) activeTeams++;
    goalsFor += pick.goalsFor;
    goalsAgainst += pick.goalsAgainst;
    wins += pick.wins;
  }

  return { activeTeams, goalsFor, goalsAgainst, goalDifference: goalsFor - goalsAgainst, wins };
}

function compareFootballByRule(
  a: FootballPickStats,
  b: FootballPickStats,
  ruleId: TiebreakerRuleId,
): number {
  switch (ruleId) {
    case "furthest_team":
      return b.activeTeams - a.activeTeams;
    case "goals_scored":
      return b.goalsFor - a.goalsFor;
    case "least_goals_conceded":
      return a.goalsAgainst - b.goalsAgainst;
    case "goal_difference":
      return b.goalDifference - a.goalDifference;
    case "most_wins":
      return b.wins - a.wins;
    default:
      return 0;
  }
}

/**
 * Apply tiebreaker rules to football leaderboard entries.
 * Entries should already be sorted by totalPoints descending.
 */
export function applyFootballTiebreakers(
  entries: FootballLeaderboardEntry[],
  rules: TiebreakerRule[],
): FootballLeaderboardEntry[] {
  if (entries.length <= 1 || rules.length === 0) return entries;

  const statsCache = new Map<string, FootballPickStats>();
  const getStats = (entry: FootballLeaderboardEntry): FootballPickStats => {
    let stats = statsCache.get(entry.uid);
    if (!stats) {
      stats = getFootballPickStats(entry);
      statsCache.set(entry.uid, stats);
    }
    return stats;
  };

  entries.sort((a, b) => {
    const pointsDiff = b.totalPoints - a.totalPoints;
    if (pointsDiff !== 0) return pointsDiff;

    const statsA = getStats(a);
    const statsB = getStats(b);
    for (const rule of rules) {
      const cmp = compareFootballByRule(statsA, statsB, rule.id);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });

  return entries;
}

// ─── Golf stats and comparison ───

type GolfPickStats = {
  bestPosition: number; // lowest numeric position (1 = winner), Infinity if none
  cutsMade: number;     // count of golfers who made the cut (not cut/wd/dq)
  penalties: number;    // count of cut + wd + dq golfers
  lowestRound: number;  // lowest single round score relative to par
};

/** Parse position string like "T3", "1", "CUT" into a numeric value for comparison */
function parsePosition(pos?: string): number {
  if (!pos) return Infinity;
  const cleaned = pos.replace(/^T/, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? Infinity : num;
}

/** Parse a round score string like "-2", "E", "+3" into a numeric value */
function parseRoundScore(round: string): number {
  if (round === "E") return 0;
  const num = parseInt(round, 10);
  return isNaN(num) ? Infinity : num;
}

function getGolfPickStats(entry: LeaderboardEntry): GolfPickStats {
  let bestPosition = Infinity;
  let cutsMade = 0;
  let penalties = 0;
  let lowestRound = Infinity;

  for (const pick of entry.picks) {
    if (!pick.playerId) continue;

    const pos = parsePosition(pick.position);
    if (pos < bestPosition) bestPosition = pos;

    if (pick.status === "cut" || pick.status === "wd" || pick.status === "dq") {
      penalties++;
    } else if (pos !== Infinity) {
      // Only count as "made cut" if they have a numeric finishing position
      cutsMade++;
    }

    if (pick.roundScoresToPar) {
      for (const round of pick.roundScoresToPar) {
        const score = parseRoundScore(round);
        if (score < lowestRound) lowestRound = score;
      }
    }
  }

  return { bestPosition, cutsMade, penalties, lowestRound };
}

function compareGolfByRule(
  a: GolfPickStats,
  b: GolfPickStats,
  ruleId: TiebreakerRuleId,
): number {
  switch (ruleId) {
    case "best_finishing_position":
      // Lower position = better (ascending)
      return a.bestPosition - b.bestPosition;
    case "most_cuts_made":
      // More cuts made = better (descending)
      return b.cutsMade - a.cutsMade;
    case "lowest_single_round":
      // Lower round score = better (ascending)
      return a.lowestRound - b.lowestRound;
    case "fewest_bogeys":
      // Fewer penalties = better (ascending)
      return a.penalties - b.penalties;
    default:
      return 0;
  }
}

/**
 * Apply tiebreaker rules to golf leaderboard entries.
 * Entries should already be sorted by totalScore ascending (lowest wins).
 */
export function applyGolfTiebreakers(
  entries: LeaderboardEntry[],
  rules: TiebreakerRule[],
): LeaderboardEntry[] {
  if (entries.length <= 1 || rules.length === 0) return entries;

  const statsCache = new Map<string, GolfPickStats>();
  const getStats = (entry: LeaderboardEntry): GolfPickStats => {
    let stats = statsCache.get(entry.uid);
    if (!stats) {
      stats = getGolfPickStats(entry);
      statsCache.set(entry.uid, stats);
    }
    return stats;
  };

  entries.sort((a, b) => {
    // Primary sort: totalScore ascending (lowest wins in golf)
    const scoreDiff = a.totalScore - b.totalScore;
    if (scoreDiff !== 0) return scoreDiff;

    const statsA = getStats(a);
    const statsB = getStats(b);
    for (const rule of rules) {
      const cmp = compareGolfByRule(statsA, statsB, rule.id);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });

  return entries;
}
