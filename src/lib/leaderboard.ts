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
): LeaderboardEntry[] {
  const sport = getSportConfig(party.sportType);
  const scoreByIdMap = new Map<string, PlayerScore>();
  const scoreByNameMap = new Map<string, PlayerScore>();

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
        const { effectiveScore, penalty, wasCapped } = calculateEffectiveScore(score, cutLine);
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
