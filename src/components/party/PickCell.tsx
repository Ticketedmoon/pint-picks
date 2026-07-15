"use client";

import { useState } from "react";
import { getSportConfig } from "@/lib/sports/registry";
import type { LeaderboardEntry, SportType } from "@/types";

type Pick = LeaderboardEntry["picks"][number];

interface PickCellProps {
  pick: Pick;
  label: string;
  variant: "card" | "table";
  sportType?: SportType;
}

/** Small inline pills showing per-round score relative to par (golf). */
function RoundScorePills({ rounds, totalRounds }: { rounds: string[]; totalRounds?: number }) {
  const slotCount = Math.max(totalRounds ?? rounds.length, rounds.length);
  const slots = Array.from({ length: slotCount }, (_, i) => rounds[i]);
  return (
    <div className="mt-1 flex items-center gap-1">
      {slots.map((score, i) => {
        const played = score !== undefined;
        const normalized = score === "E" ? 0 : parseInt(score ?? "", 10);
        const color = !played
          ? "bg-gray-50 text-gray-300 border border-dashed border-gray-200"
          : isNaN(normalized) || score === "-"
            ? "bg-gray-100 text-gray-400"
            : normalized < 0
              ? "bg-red-50 text-red-600"
              : normalized > 0
                ? "bg-blue-50 text-blue-600"
                : "bg-gray-100 text-gray-500";
        return (
          <span key={i} className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold sm:text-[10px] ${color}`}>
            <span className={`mr-0.5 text-[8px] font-normal sm:text-[9px] ${played ? "text-gray-400" : "text-gray-300"}`}>R{i + 1}</span>
            {played ? score : "–"}
          </span>
        );
      })}
    </div>
  );
}

/** Match result pills for football: "W vs ARG 2-0", "D vs BRA 1-1" */
function MatchResultPills({ matches }: { matches: string[] }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {matches.map((encoded, i) => {
        // Format: "W|OPP|2-0"
        const [result, opponent, scoreLine] = encoded.split("|");
        const color = result === "W"
          ? "bg-green-50 text-green-700"
          : result === "D"
            ? "bg-amber-50 text-amber-700"
            : "bg-red-50 text-red-700";
        return (
          <span key={i} className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-semibold sm:text-[10px] ${color}`}>
            <span className="font-bold">{result}</span>
            <span className="font-normal text-gray-500">vs</span>
            <span>{opponent || "?"}</span>
            <span className="font-normal text-gray-400">{scoreLine}</span>
          </span>
        );
      })}
    </div>
  );
}

export function PickCell({ pick, label, variant, sportType }: PickCellProps) {
  const sport = getSportConfig(sportType);
  const [expanded, setExpanded] = useState(false);

  const isCut = sport.hasCutMechanic && pick.status !== "playing" && pick.status !== "finished";
  const isEliminated = pick.status === "eliminated";
  const isCapped = sport.hasCutMechanic && !!pick.actualDisplayScore;
  const hasRounds = sport.hasRoundScores && pick.roundScoresToPar && pick.roundScoresToPar.length > 0;
  const hasMatches = sport.hasMatchBreakdown && pick.roundScoresToPar && pick.roundScoresToPar.length > 0;
  const isExpandable = hasRounds || hasMatches;
  const scoreColor = sport.getScoreColor(pick.scoreToPar, pick.status);
  const nameColor = isCut || isEliminated ? "text-red-700 line-through" : variant === "card" ? "text-gray-700" : "text-gray-600";

  const toggleExpand = isExpandable ? () => setExpanded((prev) => !prev) : undefined;

  if (variant === "card") {
    return (
      <div
        className={`${isExpandable ? "cursor-pointer" : ""}`}
        onClick={toggleExpand}
      >
        <div className="flex items-center gap-2">
          <span className="w-6 shrink-0 text-center text-[11px] font-bold text-gray-400">{label}</span>
          <span className={`min-w-0 flex-1 truncate text-sm ${nameColor}`}>{pick.playerName}</span>
          {sport.hasThruProgress && !isCut && pick.displayThru && pick.status === "playing" && (
            <span className="shrink-0 text-[10px] font-medium text-gray-400">Thru {pick.displayThru}</span>
          )}
          {!isCut && pick.status === "finished" && (
            <span className="shrink-0 text-[10px] font-medium text-green-600">F</span>
          )}
          <span className={`shrink-0 text-sm font-bold ${scoreColor}`}>{pick.displayScore}</span>
          {isCapped && (
            <span className="shrink-0 text-[10px] text-gray-400" title={`Actual score: ${pick.actualDisplayScore} (capped at cut line)`}>({pick.actualDisplayScore})</span>
          )}
          {isCapped && (
            <span className="shrink-0 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white" title="Score capped at cut line">CAP</span>
          )}
          {isCut && (
            <span className="shrink-0 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">CUT</span>
          )}
          {isEliminated && (
            <span className="shrink-0 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white" title="Knocked out of the tournament">OUT</span>
          )}
          {isExpandable && (
            <span className="shrink-0 text-[10px] text-gray-400">{expanded ? "▲" : "▼"}</span>
          )}
        </div>
        {expanded && pick.roundScoresToPar && (
          <div className="ml-8 pb-0.5">
            {hasMatches
              ? <MatchResultPills matches={pick.roundScoresToPar} />
              : <RoundScorePills rounds={pick.roundScoresToPar} totalRounds={sport.totalRounds} />}
          </div>
        )}
      </div>
    );
  }

  // Table variant: wider names for non-golf sports (team names are longer than player names)
  const nameWidth = sport.hasCutMechanic
    ? "max-w-[52px] sm:max-w-[100px] text-[10px] sm:text-xs"
    : "max-w-[72px] sm:max-w-[120px] text-[11px] sm:text-sm font-medium";

  return (
    <div
      className={`flex flex-col items-center gap-0.5 ${isExpandable ? "cursor-pointer" : ""}`}
      onClick={toggleExpand}
    >
      <span className={`${nameWidth} truncate ${nameColor}`}>{pick.playerName}</span>
      <span className="flex items-center gap-0.5">
        <span className={`text-xs font-bold sm:text-sm ${scoreColor}`}>{pick.displayScore}</span>
        {isExpandable && (
          <span className="text-[9px] text-gray-400 sm:text-[10px]">{expanded ? "▲" : "▼"}</span>
        )}
      </span>
      {isCapped && (
        <>
          <span className="text-[9px] text-gray-400 sm:text-[10px]" title={`Actual score: ${pick.actualDisplayScore} (capped at cut line)`}>({pick.actualDisplayScore})</span>
          <span className="rounded bg-amber-500 px-1 py-0.5 text-[9px] font-bold text-white sm:px-1.5 sm:text-[10px]" title="Score capped at cut line">CAP</span>
        </>
      )}
      {sport.hasThruProgress && !isCut && !isCapped && pick.displayThru && pick.status === "playing" && (
        <span className="hidden text-[10px] font-medium text-gray-400 sm:inline">Thru {pick.displayThru}</span>
      )}
      {!isCut && !isCapped && pick.status === "finished" && (
        <span className="hidden text-[10px] font-medium text-green-600 sm:inline">F</span>
      )}
      {isCut && (
        <span className="rounded bg-red-600 px-1 py-0.5 text-[9px] font-bold text-white sm:px-1.5 sm:text-[10px]">CUT</span>
      )}
      {isEliminated && (
        <span className="rounded bg-red-600 px-1 py-0.5 text-[9px] font-bold text-white sm:px-1.5 sm:text-[10px]" title="Knocked out of the tournament">OUT</span>
      )}
      {expanded && pick.roundScoresToPar && (
        hasMatches
          ? <MatchResultPills matches={pick.roundScoresToPar} />
          : <RoundScorePills rounds={pick.roundScoresToPar} totalRounds={sport.totalRounds} />
      )}
      <span className="sr-only">{label}</span>
    </div>
  );
}
