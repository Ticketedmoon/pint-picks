import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { fetchFootballLeagues } from "@/lib/sports/football/espn";

export async function GET() {
  const start = Date.now();
  const route = "/api/football/leagues";

  try {
    const leagues = await fetchFootballLeagues();
    logger.info({ route, method: "GET", status: 200, durationMs: Date.now() - start, leagues: leagues.length });
    return NextResponse.json({ leagues }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error({ route, method: "GET", status: 500, durationMs: Date.now() - start, error: message });
    return NextResponse.json({ error: "Failed to fetch leagues" }, { status: 500 });
  }
}
