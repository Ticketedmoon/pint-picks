// Football sport module barrel export
export {
  FOOTBALL_LEAGUES,
  FOOTBALL_LEAGUE_SLUGS,
  FIFA_WC_TEAM_RANKINGS,
  PL_TEAM_RANKINGS,
  CL_TEAM_RANKINGS,
  getLeagueRankings,
} from "./leagues";
export type { FootballLeagueConfig } from "./leagues";

export {
  fetchFootballTeams,
  fetchFootballMatches,
  fetchFootballStandings,
  fetchFootballLeagues,
  fetchFootballLeagueStatus,
  calculateTeamMatchPoints,
  isKnockoutStage,
  clearFootballCache,
} from "./espn";
export type { MatchSummary } from "./espn";

export {
  formatFootballPoints,
  getFootballScoreColor,
  buildFootballLeaderboardEntries,
} from "./scoring";

export type {
  FootballTeam,
  FootballMatch,
  FootballMatchTeam,
  FootballTeamScore,
  FootballStandingsGroup,
  FootballLeaderboardResult,
  FootballLeague,
  FootballLeaderboardEntry,
} from "./types";
