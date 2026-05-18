import { NextRequest, NextResponse } from "next/server";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/golf";

/** Server-side cache shared across all requests within this serverless instance. */
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 60_000; // 60 seconds

export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  const cacheKey = `leaderboard:${eventId}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
    });
  }

  try {
    const res = await fetch(`${ESPN_BASE}/leaderboard?event=${eventId}`);
    if (!res.ok) {
      return NextResponse.json({ error: `ESPN API error: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    const event = data.events?.[0];
    if (!event) {
      return NextResponse.json({ scores: [], cutLine: null, cutRound: null, coursePar: null });
    }

    const competition = event.competitions?.[0];
    if (!competition) {
      return NextResponse.json({ scores: [], cutLine: null, cutRound: null, coursePar: null });
    }

    const competitors = competition.competitors || [];
    const scores = competitors.map((comp: Record<string, unknown>) => {
      const athlete = comp.athlete as Record<string, unknown>;
      const status = comp.status as Record<string, unknown>;
      const statusType = status.type as Record<string, string>;
      const score = comp.score as Record<string, string>;
      const statistics = (comp.statistics || []) as { name: string; value?: number }[];
      const linescores = comp.linescores as { displayValue: string; period: number }[] | undefined;
      const position = status.position as { displayName: string } | undefined;
      const headshot = athlete.headshot as { href: string } | undefined;

      const statusName = statusType.name;
      let playerStatus: string = "playing";
      if (statusName === "STATUS_FINISH") playerStatus = "finished";
      else if (statusName === "STATUS_CUT") playerStatus = "cut";
      else if (statusName === "STATUS_WD") playerStatus = "wd";
      else if (statusName === "STATUS_DQ") playerStatus = "dq";

      const scoreToParStat = statistics.find((s) => s.name === "scoreToPar");
      const scoreToPar = scoreToParStat?.value ?? 0;

      return {
        playerId: (athlete.id as string),
        playerName: (athlete.displayName as string),
        scoreToPar,
        displayScore: score.displayValue,
        status: playerStatus,
        position: position?.displayName,
        roundScores: linescores?.map((ls) => ls.displayValue),
        headshot: headshot?.href,
        thru: (status.thru as number | undefined),
        displayThru: (status.displayThru as string | undefined),
      };
    });

    const tournament = event.tournament || {};
    const result = {
      scores,
      cutLine: tournament.cutScore ?? null,
      cutRound: tournament.cutRound ?? null,
      coursePar: event.courses?.[0]?.shotsToPar ?? null,
    };

    cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 502 });
  }
}
