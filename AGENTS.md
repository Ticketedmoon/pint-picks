<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Writing Style

- **Never use em dashes** in any output, comments, commit messages, or user-facing text. Use commas, colons, periods, or hyphens instead.
- Use casual, friendly language in PR comments.

## Testing & Coverage

- **Always run `npm run test:coverage` before committing** to ensure all tests pass and coverage thresholds are met.
- Coverage is enforced at **90% minimum** for lines, branches, functions, and statements on `src/lib/` modules (configured in `vitest.config.ts`).
- If you add new logic in `src/lib/`, add corresponding tests in `src/__tests__/` to maintain coverage.
- Tests use Vitest with `vi.mock()` for external dependencies (Firebase, ESPN API, etc.).
- Clear ESPN cache in tests: `import { clearEspnCache } from "@/lib/espn"` in `beforeEach`.
- `LeaderboardResult` mocks must include `coursePar: null`.

## API Routes

- All API routes must use structured logging via `src/lib/logger.ts`.
- Log every exit path: success, validation failure, and error.
- Include `route`, `method`, `status`, `durationMs` in every log entry.
- ESPN proxy routes at `/api/espn/*` use server-side caching with `Cache-Control` headers.

## Scoring Rules

- Cut players: scored at cutLine + 1 (ADR-023)
- Made-cut players: capped at cutLine if their score exceeds it (ADR-024)
- WD/DQ: flat +1 penalty (ADR-005)
- See `src/lib/espn.ts` `calculateEffectiveScore` for implementation.

## UI Conventions

- Mobile-first design with `sm:` breakpoints for desktop.
- Use dynamic imports for heavy components (modals, leaderboard tables).
- Use skeleton loading states from `src/components/Skeletons.tsx`, not spinners.
- Modals must have `role="dialog"`, `aria-modal`, `aria-label`, and Escape-to-close.

## Architecture

- ESPN data flows through server-side proxy routes (`/api/espn/*`) with shared edge caching.
- Browser-level ESPN cache (3 min TTL) in `src/lib/espn.ts` for pages not yet migrated.
- Firestore security rules in `firestore.rules`, deployed via `npx firebase deploy --only firestore:rules`.
- ADRs document all decisions in `docs/adr/` (currently 001-034).
- Uses `firebase/firestore` client SDK only (no Admin SDK). Server-side gRPC is unreliable; prefer client-side Firestore calls.

## Skills

Reusable skills are in `.github/skills/`:
- `birdiebets-common` - commands, project structure, env vars
- `birdiebets-testing` - test framework, conventions, file map
- `birdiebets-api-route` - API route template with logging
- `birdiebets-email-template` - email builder pattern
- `birdiebets-scoring` - scoring rules and functions (golf + football)
- `birdiebets-ui-component` - UI patterns and conventions
- `birdiebets-adr` - ADR template and workflow

> Note: Skill directory names still use the `birdiebets-` prefix for backward compatibility.
