import { PICK_SLOT_DEFS } from "@/lib/constants";
import { calculateEffectiveScore, formatScoreToPar } from "@/lib/sports/golf/espn";
import { getSportConfig } from "@/lib/sports/registry";
import { DEFAULT_GOLF_TIEBREAKERS, applyGolfTiebreakers } from "@/lib/tiebreaker";
import type { LeaderboardEntry, Party, Picks, PlayerScore } from "@/types";

/**
 * Pass through round scores when available.
 * ESPN linescore displayValues are already relative to par (e.g. "+6", "-2", "E").
 */
function buildRoundScoresToPar(roundScores: string[] | undefined): string[] | undefined {
  if (!roundScores || roundScores.length === 0) return undefined;
  return roundScores;
}

/**
 * A per-round linescore is "real" once ESPN has posted an actual value. ESPN
 * keeps a placeholder ("-") for rounds not yet played, so anything blank or "-"
 * means that round has not produced a score yet.
 */
function isRealRoundScore(value: string | undefined): boolean {
  return value != null && value !== "-" && value.trim() !== "";
}

/**
 * Whether a player has *finished* at least `roundNum` full rounds. ESPN posts a
 * running value for the round in progress, so a player mid-way through the cut
 * round would have a real value for it while still being "playing". Only treat
 * the round as complete once the player has moved past it (a later round has a
 * real score) or their current round is finished.
 */
function hasCompletedRound(score: PlayerScore, roundNum: number): boolean {
  const completed = (score.roundScores ?? []).filter(isRealRoundScore).length;
  if (completed > roundNum) return true;
  if (completed === roundNum) return score.status === "finished";
  return false;
}

/**
 * Whether the cut is actually *final*, i.e. the cut round is complete for the
 * whole field and ESPN has applied the cut.
 *
 * ESPN publishes a *projected* `cutScore` (and can flag the odd early
 * `STATUS_CUT` for a withdrawal) while the cut round is still being played, so
 * "at least one player is cut" on its own flips scoring on too early, against a
 * cut line that is still moving. Require every remaining player to have finished
 * the cut round, plus at least one genuine cut, before treating the cut as live.
 */
export function isCutInEffect(scores: PlayerScore[], cutRound?: number | null): boolean {
  const cutRoundNum = cutRound ?? 0;
  if (cutRoundNum <= 0 || scores.length === 0) return false;

  const cutRoundComplete = scores.every(
    (s) =>
      s.status === "cut" ||
      s.status === "wd" ||
      s.status === "dq" ||
      hasCompletedRound(s, cutRoundNum),
  );

  return cutRoundComplete && scores.some((s) => s.status === "cut");
}

/**
 * Normalize a player name for matching: lowercase, strip diacritics, and
 * collapse whitespace. Ensures picks stored as "Ludvig Aberg" match ESPN's
 * "Ludvig Åberg" (and similar accented names) when IDs don't line up.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildLeaderboardEntries(
  party: Party,
  allPicks: Record<string, Picks>,
  usersInfo: Record<string, { displayName: string; photoURL?: string }>,
  scores: PlayerScore[],
  cutLine?: number | null,
  cutRound?: number | null,
): LeaderboardEntry[] {
  const sport = getSportConfig(party.sportType);
  const scoreByIdMap = new Map<string, PlayerScore>();
  const scoreByNameMap = new Map<string, PlayerScore>();

  // The cut is only in effect once ESPN has actually cut the field AND the cut
  // round is complete. ESPN publishes a projected cutScore during R1/R2 and can
  // flag an early withdrawal as STATUS_CUT, so we require the whole field to
  // have finished the cut round before capping made-cut players. See ADR-042.
  const cutIsActive = isCutInEffect(scores, cutRound);

  scores.forEach((score) => {
    scoreByIdMap.set(score.playerId, score);
    scoreByNameMap.set(normalizeName(score.playerName), score);
  });

  const findScore = (playerId: string, playerName: string): PlayerScore | undefined => {
    return scoreByIdMap.get(playerId) || scoreByNameMap.get(normalizeName(playerName));
  };

  const entries = party.memberUids.map((uid) => {
    const picks = allPicks[uid];
    const userInfo = usersInfo[uid] || { displayName: "Unknown" };

    let totalScore = 0;
    const resolvedPicks = PICK_SLOT_DEFS.map(({ key, label }) => {
      const pick = picks?.[key];

      if (!pick?.playerId) {
        return {
          group: label,
          playerId: "",
          playerName: "Not picked",
          scoreToPar: 0,
          displayScore: "-",
          status: "playing" as const,
        };
      }

      const score = findScore(pick.playerId, pick.playerName || "");
      if (!score) {
        return {
          group: label,
          playerId: pick.playerId,
          playerName: pick.playerName || "Unknown",
          scoreToPar: 0,
          displayScore: sport.pendingScoreDisplay,
          status: "playing" as const,
        };
      }

      // Golf uses effective score calculation (cut/cap/penalty logic)
      if (sport.hasCutMechanic) {
        const { effectiveScore, penalty, wasCapped } = calculateEffectiveScore(score, cutLine, cutIsActive);
        totalScore += effectiveScore;

        const displayParts = [formatScoreToPar(effectiveScore)];
        if (penalty > 0) displayParts.push(`(+${penalty})`);

        const roundScoresToPar = buildRoundScoresToPar(score.roundScores);

        return {
          group: label,
          playerId: pick.playerId,
          playerName: score.playerName,
          scoreToPar: effectiveScore,
          displayScore: displayParts.join(" "),
          status: score.status,
          headshot: score.headshot,
          displayThru: score.displayThru,
          ...(wasCapped && { actualDisplayScore: formatScoreToPar(score.scoreToPar) }),
          ...(roundScoresToPar && { roundScoresToPar }),
          ...(score.position && { position: score.position }),
        };
      }

      // Generic scoring: use raw scoreToPar from the score data
      totalScore += score.scoreToPar;
      const roundScoresToPar = buildRoundScoresToPar(score.roundScores);
      return {
        group: label,
        playerId: pick.playerId,
        playerName: score.playerName,
        scoreToPar: score.scoreToPar,
        displayScore: sport.formatScore(score.scoreToPar),
        status: score.status,
        headshot: score.headshot,
        ...(roundScoresToPar && { roundScoresToPar }),
        ...(score.position && { position: score.position }),
      };
    });

    return {
      userName: userInfo.displayName,
      userPhotoURL: userInfo.photoURL,
      uid,
      picks: resolvedPicks,
      totalScore,
      displayTotal: sport.formatTotal(totalScore),
    };
  });

  entries.sort((a, b) =>
    sport.sortDirection === "asc"
      ? a.totalScore - b.totalScore
      : b.totalScore - a.totalScore
  );

  // Apply golf tiebreakers when sorting ascending (golf)
  if (sport.sortDirection === "asc") {
    const rules = party.tiebreakerRules || DEFAULT_GOLF_TIEBREAKERS;
    return applyGolfTiebreakers(entries, rules);
  }

  return entries;
}
