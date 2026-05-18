import { PICK_SLOT_DEFS } from "@/lib/constants";
import { calculateEffectiveScore, formatScoreToPar } from "@/lib/espn";
import type { LeaderboardEntry, Party, Picks, PlayerScore } from "@/types";

/**
 * Pass through round scores when available.
 * ESPN linescore displayValues are already relative to par (e.g. "+6", "-2", "E").
 */
function buildRoundScoresToPar(roundScores: string[] | undefined): string[] | undefined {
  if (!roundScores || roundScores.length === 0) return undefined;
  return roundScores;
}

export function buildLeaderboardEntries(
  party: Party,
  allPicks: Record<string, Picks>,
  usersInfo: Record<string, { displayName: string; photoURL?: string }>,
  scores: PlayerScore[],
  cutLine?: number | null,
): LeaderboardEntry[] {
  const scoreByIdMap = new Map<string, PlayerScore>();
  const scoreByNameMap = new Map<string, PlayerScore>();

  scores.forEach((score) => {
    scoreByIdMap.set(score.playerId, score);
    scoreByNameMap.set(score.playerName.toLowerCase(), score);
  });

  const findScore = (playerId: string, playerName: string): PlayerScore | undefined => {
    return scoreByIdMap.get(playerId) || scoreByNameMap.get(playerName.toLowerCase());
  };

  const entries = party.memberUids.map((uid) => {
    const picks = allPicks[uid];
    const userInfo = usersInfo[uid] || { displayName: "Unknown" };

    let totalScore = 0;
    const resolvedPicks = picks
      ? PICK_SLOT_DEFS.map(({ key, label }) => {
          const pick = picks[key];

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
              displayScore: "-",
              status: "playing" as const,
            };
          }

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
          };
        })
      : [];

    return {
      userName: userInfo.displayName,
      userPhotoURL: userInfo.photoURL,
      uid,
      picks: resolvedPicks,
      totalScore,
      displayTotal: formatScoreToPar(totalScore),
    };
  });

  entries.sort((a, b) => a.totalScore - b.totalScore);
  return entries;
}
