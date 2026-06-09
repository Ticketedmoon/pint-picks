"use client";

import { useEffect, useRef } from "react";
import { formatScoreToPar } from "@/lib/sports/golf/espn";
import { isCutStatus } from "@/lib/sports/golf/scoring";
import type { PlayerScore } from "@/types";

interface TournamentLeaderboardModalProps {
  scores: PlayerScore[];
  onClose: () => void;
}

export function TournamentLeaderboardModal({ scores, onClose }: TournamentLeaderboardModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus the close button on mount for keyboard users
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Sort by scoreToPar ascending, cut/wd/dq players at the bottom
  const sorted = [...scores].sort((a, b) => {
    const aCut = isCutStatus(a.status) ? 1 : 0;
    const bCut = isCutStatus(b.status) ? 1 : 0;
    if (aCut !== bCut) return aCut - bCut;
    return a.scoreToPar - b.scoreToPar;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Tournament Leaderboard" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div
        className="relative z-10 flex max-h-[85vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 sm:px-5">
          <h2 className="text-base font-bold text-gray-900 sm:text-lg">🏌️ Tournament Leaderboard</h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close leaderboard"
            className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable list */}
        <div className="overflow-y-auto px-2 py-2 sm:px-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-medium uppercase tracking-wider text-gray-400 sm:text-xs">
                <th className="px-2 py-1.5 text-left">Pos</th>
                <th className="px-2 py-1.5 text-left">Player</th>
                <th className="px-2 py-1.5 text-right">Score</th>
                <th className="px-2 py-1.5 text-right">Thru</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((player, idx) => {
                const cut = isCutStatus(player.status);
                const scoreNum = player.scoreToPar;
                const scoreColor = cut
                  ? "text-red-500"
                  : scoreNum < 0
                    ? "text-red-600"
                    : scoreNum > 0
                      ? "text-blue-600"
                      : "text-gray-500";
                const rowBg = cut ? "bg-red-50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50";

                return (
                  <tr key={player.playerId} className={`${rowBg} border-b border-gray-100`}>
                    <td className="whitespace-nowrap px-2 py-2 text-xs font-medium text-gray-500">
                      {player.position || idx + 1}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium sm:text-sm ${cut ? "text-red-700 line-through" : "text-gray-900"}`}>
                          {player.playerName}
                        </span>
                        {cut && (
                          <span className="rounded bg-red-600 px-1 py-0.5 text-[9px] font-bold text-white">
                            {player.status.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`whitespace-nowrap px-2 py-2 text-right text-sm font-bold ${scoreColor}`}>
                      {formatScoreToPar(scoreNum)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right text-xs text-gray-400">
                      {cut ? "-" : player.status === "finished" ? "F" : player.displayThru || "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
