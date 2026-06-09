import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { fetchFootballTeams } from "@/lib/sports/football/espn";
import { FOOTBALL_LEAGUES, getLeagueRankings } from "@/lib/sports/football/leagues";
import { GROUP_SIZE } from "@/lib/constants";
import type { FootballTeam } from "@/lib/sports/football/types";

/** Cache per league */
const cacheMap = new Map<string, { data: unknown; fetchedAt: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

export async function GET(request: NextRequest) {
  const start = Date.now();
  const route = "/api/football/rankings";
  const league = request.nextUrl.searchParams.get("league") || "fifa.world";

  if (!FOOTBALL_LEAGUES[league]) {
    logger.warn({ route, method: "GET", status: 400, durationMs: Date.now() - start, league });
    return NextResponse.json({ error: "Invalid league slug" }, { status: 400 });
  }

  // Return cache if fresh
  const cached = cacheMap.get(league);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    logger.info({ route, method: "GET", status: 200, durationMs: Date.now() - start, cache: "hit", league });
    return NextResponse.json(cached.data);
  }

  try {
    const teams = await fetchFootballTeams(league);
    const rankings = getLeagueRankings(league);

    // Sort teams by ranking (lower rank = better)
    const rankedTeams = teams
      .map((t) => ({ ...t, ranking: rankings[t.id] ?? 999 }))
      .sort((a, b) => a.ranking - b.ranking);

    const result = {
      groups: {
        A: rankedTeams.slice(0, GROUP_SIZE),
        B: rankedTeams.slice(GROUP_SIZE, GROUP_SIZE * 2),
        C: rankedTeams.slice(GROUP_SIZE * 2, GROUP_SIZE * 3),
        D: rankedTeams.slice(GROUP_SIZE * 3, GROUP_SIZE * 4),
      },
      wildcards: rankedTeams.slice(GROUP_SIZE * 4),
      league,
      fetchedAt: new Date().toISOString(),
    };

    cacheMap.set(league, { data: result, fetchedAt: Date.now() });
    logger.info({ route, method: "GET", status: 200, durationMs: Date.now() - start, cache: "miss", league, teams: rankedTeams.length });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error({ route, method: "GET", status: 500, durationMs: Date.now() - start, error: message });
    return NextResponse.json({ error: "Failed to fetch football rankings" }, { status: 500 });
  }
}
