// TypeScript types for the PintPicks multi-sport tracker

export type SportType = "golf" | "football";

export interface Player {
  id: string;
  displayName: string;
  shortName: string;
  lastName: string;
  headshot?: string;
  flagUrl?: string;
  country?: string;
  amateur: boolean;
}

export interface PlayerScore {
  playerId: string;
  playerName: string;
  /** Primary numeric score. Golf: relative to par. Football: total match points. */
  scoreToPar: number;
  displayScore: string;
  status: "playing" | "finished" | "cut" | "wd" | "dq" | "active" | "pre" | "eliminated";
  position?: string;
  roundScores?: string[];
  headshot?: string;
  flagUrl?: string;
  thru?: number;
  displayThru?: string;
}

export type PlayerGroup = "A" | "B" | "C" | "D";

export interface GroupedPlayers {
  A: Player[];
  B: Player[];
  C: Player[];
  D: Player[];
}

export interface PlayerPick {
  playerId: string;
  playerName: string;
}

export interface Picks {
  groupA: PlayerPick | null;
  groupB: PlayerPick | null;
  groupC: PlayerPick | null;
  groupD: PlayerPick | null;
  wildcard1: PlayerPick | null;
  wildcard2: PlayerPick | null;
  lockedAt?: string;
}

export interface PickUnlock {
  uid: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  usedAt?: string;
  createdBy: string;
}

export interface Party {
  id: string;
  name: string;
  createdBy: string;
  inviteCode: string;
  tournamentId: string;
  tournamentName: string;
  tournamentStartDate: string;
  createdAt: string;
  status: "picking" | "locked" | "complete";
  memberUids: string[];
  buyIn: number;
  currency: string;
  secondPlacePayout: boolean;
  thirdPlacePayout: boolean;
  /** Custom payout split percentages. If not set, defaults are used (65/35 or 55/30/15). */
  payoutSplit?: { first: number; second: number; third: number };
  /** Sport type for this party. Defaults to "golf" for backward compatibility. */
  sportType?: SportType;
  /** ESPN league slug for football parties (e.g. "fifa.world", "eng.1") */
  leagueSlug?: string;
  customGroups?: {
    A: { id: string; displayName: string }[];
    B: { id: string; displayName: string }[];
    C: { id: string; displayName: string }[];
    D: { id: string; displayName: string }[];
  };
  /** Frozen wildcard pool captured at party creation time */
  snapshotWildcards?: { id: string; displayName: string }[];
  /** Players picked by members that are not in the confirmed tournament field */
  invalidPicks?: { uid: string; playerName: string; slot: string }[];
  /** Timestamp of last email notification sent for invalid picks */
  lastInvalidNotifiedAt?: string;
  /** Ordered tiebreaker rules for resolving equal scores. If unset, sport defaults apply. */
  tiebreakerRules?: TiebreakerRule[];
}

export type TiebreakerRuleId =
  | "furthest_team"
  | "goals_scored"
  | "least_goals_conceded"
  | "goal_difference"
  | "most_wins"
  | "best_finishing_position"
  | "most_cuts_made"
  | "fewest_bogeys"
  | "lowest_single_round";

export interface TiebreakerRule {
  id: TiebreakerRuleId;
  label: string;
  description: string;
}

export interface PartyInvite {
  email: string;
  status: "pending" | "accepted";
  invitedBy: string;
}

export interface Tournament {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  courseName: string;
  purse?: string;
  status: "pre" | "in" | "post";
  isMajor: boolean;
  /** Sport type. Defaults to "golf" for backward compatibility. */
  sportType?: SportType;
  /** ESPN league slug for football tournaments */
  leagueSlug?: string;
}

export interface LeaderboardEntry {
  userName: string;
  userPhotoURL?: string;
  uid: string;
  picks: {
    group: string;
    playerId: string;
    playerName: string;
    scoreToPar: number;
    displayScore: string;
    status: "playing" | "finished" | "cut" | "wd" | "dq" | "active" | "pre" | "eliminated";
    headshot?: string;
    displayThru?: string;
    /** Shown when the score was capped at cut line (actual score before capping) */
    actualDisplayScore?: string;
    /** Per-round score relative to par, e.g. ["-2", "E", "+1", "-3"] */
    roundScoresToPar?: string[];
    /** Tournament finishing position, e.g. "T3", "1", "CUT" */
    position?: string;
  }[];
  totalScore: number;
  displayTotal: string;
}

export interface LeaderboardResult {
  scores: PlayerScore[];
  cutLine: number | null;
  /** 0 means no cut for this tournament, >0 is the round the cut happens after */
  cutRound: number | null;
  /** Course par per round (e.g. 72) */
  coursePar: number | null;
}

export interface ESPNEvent {
  id: string;
  name: string;
  date: string;
  endDate: string;
  status: {
    type: {
      state: string;
      completed: boolean;
    };
  };
  tournament: {
    displayName: string;
    major: boolean;
    cutScore?: number;
  };
  courses: {
    name: string;
    shotsToPar?: number;
  }[];
  competitions: ESPNCompetition[];
  purse?: number;
  displayPurse?: string;
}

export interface ESPNCompetition {
  competitors: ESPNCompetitor[];
}

export interface ESPNCompetitor {
  id: string;
  status: {
    type: {
      name: string;
      state: string;
    };
    position?: {
      displayName: string;
    };
    thru?: number;
    displayThru?: string;
  };
  score: {
    displayValue: string;
  };
  statistics: {
    name: string;
    value?: number;
    displayValue?: string;
  }[];
  linescores?: {
    displayValue: string;
    period: number;
    teeTime?: string;
  }[];
  athlete: {
    id: string;
    displayName: string;
    shortName: string;
    lastName: string;
    amateur: boolean;
    headshot?: {
      href: string;
    };
    flag?: {
      href: string;
      alt: string;
    };
  };
}
