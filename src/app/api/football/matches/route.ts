import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { fetchFootballMatches } from "@/lib/sports/football/espn";
import { FOOTBALL_LEAGUES } from "@/lib/sports/football/leagues";

export async function GET(request: NextRequest) {
  const start = Date.now();
  const route = "/api/football/matches";
  const league = request.nextUrl.searchParams.get("league") || "fifa.world";
  const dateRange = request.nextUrl.searchParams.get("dates") || undefined;

  if (!FOOTBALL_LEAGUES[league]) {
    logger.warn({ route, method: "GET", status: 400, durationMs: Date.now() - start, league });
    return NextResponse.json({ error: "Invalid league slug" }, { status: 400 });
  }

  try {
    const matches = await fetchFootballMatches(league, dateRange);
    logger.info({ route, method: "GET", status: 200, durationMs: Date.now() - start, league, matches: matches.length });
    return NextResponse.json({ matches }, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error({ route, method: "GET", status: 500, durationMs: Date.now() - start, error: message });
    return NextResponse.json({ error: "Failed to fetch matches" }, { status: 500 });
  }
}
