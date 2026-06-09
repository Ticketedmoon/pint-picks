# ADR-027: Structured Logging and Observability

## Status
Accepted

## Date
2026-05-18

## Context
The API routes had only bare `console.error` calls in catch blocks with no structured
context, no request timing, no success logging, and no cache hit/miss tracking. The new
ESPN proxy routes (`/api/espn/leaderboard`, `/api/espn/round`) had no logging at all.

This made it difficult to diagnose slow requests, understand traffic patterns, or
identify whether the server-side cache was effective.

## Decision

### Current approach: Structured JSON logger
A lightweight, zero-dependency logger (`src/lib/logger.ts`) outputs structured JSON
to `console.log`/`console.error`. Vercel's log viewer picks these up natively.

Each log entry includes:
- `level`: info, warn, or error
- `ts`: ISO timestamp
- `route`: the API route path
- `method`: HTTP method
- `status`: response status code
- `durationMs`: request duration in milliseconds
- `cache`: "hit" or "miss" (for cached routes)
- `error`: error message (for failures)
- Additional context: `eventId`, `partyId`, `sent`/`failed` counts, etc.

A `withTiming` helper is also exported for wrapping async operations.

### Where to view logs
- **Vercel Dashboard**: Go to your project → Logs tab (https://vercel.com/<team>/<project>/logs)
- **Vercel CLI**: `vercel logs <deployment-url>` for real-time tailing
- Logs are retained for 1 hour on Hobby plan, 3 days on Pro

### All API routes instrumented
- `/api/espn/leaderboard` - cache hit/miss, ESPN fetch timing, player count
- `/api/espn/round` - cache hit/miss, round number
- `/api/rankings` - cache hit/miss, OWGR fetch timing, player count
- `/api/invite` - email send counts, duration
- `/api/send-pick-unlock` - party/user context, duration
- `/api/notify-invalid-picks` - notification counts, duration
- `/api/submit-unlocked-picks` - party/user context, duration

## Future: OpenTelemetry upgrade path
For production-grade observability with distributed tracing, the recommended upgrade is:

1. Install `@vercel/otel` and `@opentelemetry/api`
2. Create `src/instrumentation.ts` with `registerOTel('pintpicks')`
3. All API routes and fetch calls are automatically traced with spans
4. Custom spans can be added for business-critical operations

Benefits over the current approach:
- Distributed tracing across request boundaries
- Automatic span hierarchy (parent/child relationships)
- Trace waterfall visualization
- Context propagation via `traceparent` headers

Requirements:
- Vercel Pro plan ($20/mo) for built-in trace viewer, OR
- External trace drain to Axiom (free tier), Datadog, or Honeycomb

## Consequences

### Positive
- Every API request is now logged with timing and context
- Cache effectiveness is visible (hit/miss ratio)
- Slow ESPN responses are identifiable
- Zero additional dependencies

### Negative
- Structured JSON logs are less human-readable than plain text in local dev
- Log retention on Vercel Hobby plan is limited to 1 hour

