/**
 * Sport adapter interface. Each sport implements this to provide
 * sport-specific behavior for scoring, display, sync, and validation.
 *
 * To add a new sport: create a new file in src/lib/sports/ implementing
 * SportConfig, then register it in registry.ts. No other code changes needed.
 */

import type { Party, PlayerScore } from "@/types";

/** How tournament status is determined for lock/sync */
export interface TournamentStatus {
  status: "pre" | "in" | "post";
  lockTime: number | null; // epoch ms when picks should lock
}

/** Result of resolving a pick against live scores */
export interface ResolvedPickScore {
  scoreToPar: number;
  displayScore: string;
  status: PlayerScore["status"];
  headshot?: string;
  displayThru?: string;
  actualDisplayScore?: string;
  roundScoresToPar?: string[];
}

export interface SportConfig {
  /** Unique sport identifier, matches SportType */
  id: string;

  // --- Display ---
  emoji: string;
  /** What participants are called: "player", "team", "country", etc. */
  entityLabel: string;
  /** Plural form */
  entityLabelPlural: string;
  /** Label for group containers: "Group" for golf, "Tier" for football */
  groupLabel: string;
  /** Group sublabels: { A: "Elite (Rank 1-6)", B: "Contenders", ... } */
  groupSublabels: Record<string, string>;
  /** Label for the pick action button: "Pick Players", "Pick Teams" */
  pickActionLabel: string;
  /** What to call the start event: "First tee-off", "Kick-off" */
  startEventLabel: string;
  /** Ranking source description: "ranked by OWGR", "ranked by FIFA rankings" */
  rankingDescription: string;
  /** Legend text for the winning condition */
  winConditionLabel: string;
  /** Accent color class for UI theming */
  accentColor: string;

  // --- Scoring ---
  /** Format a raw score number for display: e.g. formatScoreToPar or "X pts" */
  formatScore: (score: number) => string;
  /** Format the total score for display */
  formatTotal: (total: number) => string;
  /** Get Tailwind color class for a pick score */
  getScoreColor: (score: number, status?: PlayerScore["status"]) => string;
  /** Get Tailwind color class for a total score */
  getTotalScoreColor: (total: number) => string;
  /** Sort direction: "asc" for lowest-wins (golf), "desc" for highest-wins (football) */
  sortDirection: "asc" | "desc";
  /** Default display score when no live data is available */
  pendingScoreDisplay: string;

  // --- Sport-specific display features ---
  /** Whether this sport has cut/WD/DQ mechanics */
  hasCutMechanic: boolean;
  /** Whether this sport has per-round score breakdown (golf rounds) */
  hasRoundScores: boolean;
  /** Whether this sport has per-match result breakdown (football matches) */
  hasMatchBreakdown: boolean;
  /** Whether this sport has "Thru X" hole progress */
  hasThruProgress: boolean;

  // --- Sync ---
  /** Fetch tournament status for lock/sync decisions */
  fetchTournamentStatus: (party: Party) => Promise<TournamentStatus>;
  /** Validate picks against the confirmed field (return empty array if no validation needed) */
  validatePicks: (party: Party) => Promise<{ valid: boolean; invalidPicks: { uid: string; playerName: string; slot: string }[] }>;
  /** Fetch live scores for leaderboard. Returns PlayerScore[] in the shared format. */
  fetchScores: (party: Party) => Promise<{ scores: PlayerScore[]; cutLine: number | null; cutRound: number | null }>;
  /** Whether to fetch round-by-round progress info */
  fetchRoundInfo: (party: Party) => Promise<{
    currentRound: number;
    displayRound: number;
    totalRounds: number;
    nextRoundTeeTime: string | null;
  } | null>;
}
