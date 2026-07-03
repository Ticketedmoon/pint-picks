// TypeScript types for Football (Soccer) support

export interface FootballTeam {
  id: string;
  displayName: string;
  shortDisplayName: string;
  abbreviation: string;
  logo: string;
  /** For national teams, this doubles as the country name */
  location: string;
  color?: string;
  alternateColor?: string;
  /** FIFA world ranking or league standing position */
  ranking?: number;
}

export interface FootballMatch {
  id: string;
  date: string;
  name: string;
  shortName: string;
  /** "pre" | "in" | "post" */
  status: "pre" | "in" | "post";
  statusDetail: string;
  homeTeam: FootballMatchTeam;
  awayTeam: FootballMatchTeam;
  /** e.g. "Group A", "Round of 16", "Final" (from ESPN competition notes, often empty) */
  stage?: string;
  /** ESPN season slug identifying the round, e.g. "group-stage", "round-of-32", "quarterfinals". Reliable knockout indicator. */
  round?: string;
  venue?: string;
}

export interface FootballMatchTeam {
  id: string;
  displayName: string;
  abbreviation: string;
  logo: string;
  score: number;
  winner: boolean;
  /** e.g. "0-0-0" (W-D-L) */
  record?: string;
}

export interface FootballTeamScore {
  teamId: string;
  teamName: string;
  abbreviation: string;
  logo: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  /** Accumulated points: W=3, D=1, L=0 */
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  /** Whether the team has been eliminated from the tournament */
  eliminated: boolean;
}

export interface FootballStandingsGroup {
  id: string;
  name: string;
  abbreviation: string;
  entries: FootballTeamScore[];
}

export interface FootballLeaderboardResult {
  teamScores: FootballTeamScore[];
  groups: FootballStandingsGroup[];
}

export interface FootballLeague {
  slug: string;
  name: string;
  shortName: string;
  logo: string;
  /** "tournament" = has knockout stage (WC, CL), "league" = round-robin season (PL) */
  type: "tournament" | "league";
  /** ESPN season year */
  seasonYear: number;
  seasonDisplayName: string;
  startDate: string;
  endDate: string;
  status: "pre" | "in" | "post";
}

export interface FootballLeaderboardEntry {
  userName: string;
  userPhotoURL?: string;
  uid: string;
  picks: {
    group: string;
    teamId: string;
    teamName: string;
    abbreviation: string;
    logo: string;
    points: number;
    matchesPlayed: number;
    wins: number;
    draws: number;
    losses: number;
    eliminated: boolean;
    goalsFor: number;
    goalsAgainst: number;
  }[];
  totalPoints: number;
}
