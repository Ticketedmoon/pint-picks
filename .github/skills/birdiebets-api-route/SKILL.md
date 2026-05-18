# BirdieBets API Route Skill

## When to Use

USE FOR: create API route, add endpoint, server route, API handler, proxy endpoint

## Repository Context

- **App:** BirdieBets - golf tournament betting tracker
- **Stack:** Next.js 16 App Router, TypeScript, Firebase Firestore
- **API routes:** `src/app/api/`
- **Logger:** `src/lib/logger.ts` - structured JSON logger
- **Writing style:** Never use em dashes.

## Key Source Locations

| Area | Location |
|---|---|
| API routes | `src/app/api/` |
| Logger | `src/lib/logger.ts` |
| Firestore helpers | `src/lib/firestore.ts` |
| Email templates | `src/lib/emailTemplates.ts` |
| Resend client | `src/lib/resend.ts` |
| Types | `src/types/index.ts` |

## API Route Template

```typescript
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const start = Date.now();
  const route = "/api/{route-name}";
  try {
    const body = await request.json();

    // Validate input
    if (!body.requiredField) {
      logger.warn({ route, method: "POST", status: 400, error: "Missing requiredField" });
      return NextResponse.json({ error: "Missing requiredField" }, { status: 400 });
    }

    // Business logic here

    logger.info({ route, method: "POST", status: 200, durationMs: Date.now() - start });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ route, method: "POST", status: 500, durationMs: Date.now() - start, error: message });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
```

## Conventions

1. Always import and use `logger` from `@/lib/logger`
2. Log on every exit path: success, validation failure, error
3. Include `route`, `method`, `status`, `durationMs` in every log
4. Validate all input fields before processing
5. Use `Promise.allSettled` for batch operations (emails, etc.)
6. For cached routes: include `cache: "hit" | "miss"` in logs
7. For ESPN proxy routes: add `Cache-Control: public, s-maxage=60, stale-while-revalidate=30`
8. Run `npm run test:coverage` after changes - 90% minimum on `src/lib/`
