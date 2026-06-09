import type { SportConfig, TournamentStatus } from "./types";
import type { Party, PlayerScore } from "@/types";
import { calculateEffectiveScore, formatScoreToPar, fetchFirstTeeTime } from "@/lib/sports/golf/espn";
import { GROUP_LABELS } from "@/lib/sports/golf/playerGroups";
import { isCutStatus, getScoreColor, getTotalScoreColor } from "@/lib/sports/golf/scoring";

/**
 * Golf sport adapter.
 *
 * Scoring: stroke play, lowest total wins.
 * Cut mechanic: cut players scored at cutLine + 1, made-cut players capped at cutLine.
 * WD/DQ: flat +1 penalty.
 * Sync: ESPN PGA golf API for tournament status.
 */
export const golfConfig: SportConfig = {
  id: "golf",

  // Display
  emoji: "⛳",
  entityLabel: "player",
  entityLabelPlural: "players",
  groupLabel: "Group",
  groupSublabels: Object.fromEntries(
    Object.entries(GROUP_LABELS).map(([k, v]) => {
      const match = v.match(/- (.+)/);
      return [k, match ? match[1] : v];
    })
  ),
  pickActionLabel: "Pick Players",
  startEventLabel: "First tee-off",
  rankingDescription: "ranked by OWGR",
  winConditionLabel: "Lowest total score wins 🏆",
  accentColor: "green",

  // Scoring
  formatScore: formatScoreToPar,
  formatTotal: formatScoreToPar,
  getScoreColor,
  getTotalScoreColor,
  sortDirection: "asc",
  pendingScoreDisplay: "-",

  // Golf-specific features
  hasCutMechanic: true,
  hasRoundScores: true,
  hasMatchBreakdown: false,
  hasThruProgress: true,

  // Sync
  async fetchTournamentStatus(party: Party): Promise<TournamentStatus> {
    const { fetchTournamentSnapshot } = await import("@/lib/sports/golf/espn");
    const { status: espnStatus, firstTeeTime } = await fetchTournamentSnapshot(party.tournamentId);

    let lockTime: number | null = null;
    if (firstTeeTime) {
      lockTime = Date.parse(firstTeeTime);
    } else if (party.tournamentStartDate) {
      lockTime = new Date(party.tournamentStartDate).getTime();
    }

    // Golf can also lock by tee time: if ESPN says "pre" but we're past the first tee,
    // treat it as "in" so partySync transitions the party.
    let status = espnStatus;
    if (espnStatus === "pre" && lockTime && Date.now() >= lockTime) {
      status = "in";
    }

    return { status, lockTime };
  },

  async validatePicks(party: Party) {
    const { validatePartyPicksForGolf } = await import("@/lib/sports/golf/pickValidation");
    return validatePartyPicksForGolf(party);
  },

  async fetchScores(party: Party) {
    const res = await fetch(`/api/espn/leaderboard?eventId=${party.tournamentId}`);
    if (!res.ok) return { scores: [], cutLine: null, cutRound: null };
    const data = await res.json();
    return {
      scores: data.scores as PlayerScore[],
      cutLine: data.cutLine ?? null,
      cutRound: data.cutRound ?? null,
    };
  },

  async fetchRoundInfo(party: Party) {
    const res = await fetch(`/api/espn/round?eventId=${party.tournamentId}`);
    if (!res.ok) return null;
    return res.json();
  },
};
