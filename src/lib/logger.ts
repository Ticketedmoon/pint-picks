/**
 * Lightweight structured logger for API routes.
 *
 * Outputs JSON to console.log/console.error, which Vercel picks up natively.
 * View logs at: https://vercel.com/<your-team>/<your-project>/logs
 *
 * Each log entry includes: route, method, status, duration (ms), and optional
 * metadata (cache hit/miss, event IDs, error messages).
 *
 * NOTE: For production-grade observability, consider migrating to OpenTelemetry
 * via @vercel/otel. See docs/adr/027-observability.md for details.
 */

interface LogContext {
  route: string;
  method?: string;
  status?: number;
  durationMs?: number;
  cache?: "hit" | "miss";
  error?: string;
  [key: string]: unknown;
}

function formatEntry(level: "info" | "warn" | "error", ctx: LogContext) {
  return JSON.stringify({
    level,
    ts: new Date().toISOString(),
    ...ctx,
  });
}

export const logger = {
  info(ctx: LogContext) {
    console.log(formatEntry("info", ctx));
  },
  warn(ctx: LogContext) {
    console.warn(formatEntry("warn", ctx));
  },
  error(ctx: LogContext) {
    console.error(formatEntry("error", ctx));
  },
};

/**
 * Helper to time an async operation and log the result.
 * Usage:
 *   const result = await withTiming({ route: "/api/espn/leaderboard" }, async () => {
 *     return fetchFromESPN();
 *   });
 */
export async function withTiming<T>(
  ctx: Omit<LogContext, "durationMs" | "status">,
  fn: () => Promise<T & { status?: number }>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    logger.info({ ...ctx, status: 200, durationMs: Date.now() - start });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ ...ctx, status: 500, durationMs: Date.now() - start, error: message });
    throw err;
  }
}
