import { NextRequest, NextResponse } from "next/server";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/golf";

/** Server-side cache shared across all requests within this serverless instance. */
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 60_000; // 60 seconds

interface ESPNCompetitor {
  status: {
    type: { name: string; state: string };
    thru?: number;
    displayThru?: string;
  };
  linescores?: { displayValue: string; period: number; teeTime?: string }[];
}

export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  const cacheKey = `round:${eventId}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
    });
  }

  try {
    const res = await fetch(`${ESPN_BASE}/leaderboard?event=${eventId}`);
    if (!res.ok) {
      return NextResponse.json(null);
    }

    const data = await res.json();
    const event = data.events?.[0];
    if (!event) {
      return NextResponse.json(null);
    }

    const competitors: ESPNCompetitor[] = event.competitions?.[0]?.competitors || [];
    if (competitors.length === 0) {
      return NextResponse.json(null);
    }

    let maxPeriod = 0;
    let totalRounds = 4;

    for (const comp of competitors) {
      if (!comp.linescores) continue;
      for (const ls of comp.linescores) {
        const hasScore = ls.displayValue && ls.displayValue !== "-" && ls.displayValue.trim() !== "";
        if (hasScore && ls.period > maxPeriod) maxPeriod = ls.period;
        if (ls.period > totalRounds) totalRounds = ls.period;
      }
    }

    if (maxPeriod === 0) {
      return NextResponse.json(null);
    }

    const ACTIVE_PLAY_STATUSES = new Set(["STATUS_IN_PROGRESS", "STATUS_PLAY", "STATUS_ACTIVE"]);
    const isCurrentRoundInProgress = competitors.some((comp) => {
      const statusName = comp.status?.type?.name;
      return statusName != null && ACTIVE_PLAY_STATUSES.has(statusName);
    });

    const displayRound = isCurrentRoundInProgress
      ? maxPeriod
      : Math.min(maxPeriod + 1, totalRounds);

    const teeTimeRound = isCurrentRoundInProgress ? maxPeriod : maxPeriod + 1;

    let nextRoundTeeTime: string | null = null;
    if (teeTimeRound <= totalRounds) {
      const teeTimes: string[] = [];
      for (const comp of competitors) {
        if (!comp.linescores) continue;
        const ls = comp.linescores.find((l) => l.period === teeTimeRound);
        if (ls?.teeTime && !isNaN(Date.parse(ls.teeTime))) {
          teeTimes.push(ls.teeTime);
        }
      }
      teeTimes.sort();
      nextRoundTeeTime = teeTimes[0] ?? null;
    }

    const result = { currentRound: maxPeriod, displayRound, totalRounds, nextRoundTeeTime };
    cache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
    });
  } catch {
    return NextResponse.json(null);
  }
}
