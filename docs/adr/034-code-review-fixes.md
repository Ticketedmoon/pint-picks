# ADR-034: Code Review Fixes and Security Hardening

## Status
Accepted

## Date
2026-06-11

## Author
User + Copilot

## What This ADR Covers

- 24 findings from a 4-model code review (Claude Sonnet 4.5, GPT-5.4, Claude Opus 4.7, Gemini 3.1 Pro)
- Firestore rules hardened: party updates restricted to creator, picks hidden during picking phase
- Dead API routes deleted (IDOR vulnerability), email routes now require Firebase Auth
- Token validation added to `savePicksWithUnlock` to prevent race conditions
- Multiple bug fixes: auth deadlock, dashboard skeleton, payout rounding, tiebreaker sport mismatch
- Creator self-unlock: party owner can now unlock picks for themselves after tournament starts
- Coverage: `firestore.ts` added to coverage with 50 tests (99% coverage, 388 total tests)

## Summary

A comprehensive 4-model code review identified 24 findings across security (P0), bugs (P1),
and quality improvements (P2). All were implemented in a single batch with tests covering
every change.

The most critical finding was that Firestore rules allowed any party member to update any
field on the party document, meaning a malicious member could change the party name, status,
buy-in amount, or even the creator field. This was fixed by restricting updates: only the
creator can modify party fields, members can only remove themselves from `memberUids`.

Two dead API routes (`send-pick-unlock` and `submit-unlocked-picks`) were deleted. These
had been superseded by client-side flows but still contained IDOR vulnerabilities via
client-provided `callerUid` parameters.

## Findings and Fixes

### P0: Critical Security

| ID | Finding | Fix |
|-----|---------|-----|
| 1 | Party update rules too permissive (any member could update any field) | Creator-only updates, members can only leave |
| 2 | Dead API routes with IDOR vulnerability | Deleted routes and tests |
| 3 | `savePicksWithUnlock` no token validation before batch write | Added full token validation (existence, UID match, used, expiry) |
| 4 | `getPendingInvitesForEmail` broken stub returning `[]` always | Deleted |
| 5 | `firestore.ts` excluded from test coverage | Removed from exclude, added 50 tests |

### P1: Bug Fixes

| ID | Finding | Fix |
|-----|---------|-----|
| 6 | Picks readable during picking phase (cheating) | Restricted reads to locked/complete parties |
| 7 | Email API routes unauthenticated | Added Firebase Auth token verification via `src/lib/auth.ts` |
| 8 | Auth context deadlocks if Firestore fails | Wrapped in try/catch, `setLoading(false)` always runs |
| 9 | Dashboard stuck in skeleton on fetch error | Added `.catch()` and `.finally()` |
| 10 | Invite shows false success on API error | Checks `emailRes.ok` before showing success |
| 11 | Tiebreaker `addRule()` uses wrong sport options | Changed from hardcoded `FOOTBALL_TIEBREAKER_OPTIONS` to `allOptions` |
| 12 | `getUsersInfo` N+1 sequential queries | Parallelised with `Promise.all` |
| 13 | `deleteParty` non-atomic (partial deletes on failure) | Uses `writeBatch` for atomic deletion |
| 14 | Payout rounding gives all remainder to 1st place | `Math.floor` with fair round-robin distribution |
| 15 | `most_cuts_made` counts pre-cut golfers as "made cut" | Only counts golfers with numeric finishing position |
| 16 | Cron secret fails open if `CRON_SECRET` env var missing | Returns 500 if not configured |

### P2: Quality

| ID | Finding | Fix |
|-----|---------|-----|
| 17 | `leaveParty` deletes picks after removing from memberUids (rules violation) | Reversed order: delete picks first |
| 18 | ESPN cache grows unbounded | Capped at 50 entries with eviction (both golf and football) |
| 19 | `createParty` no input validation | Added name length, buy-in range, required field checks |
| 20 | `getParty` uses bare `as Party` cast | Added runtime validation for critical fields |
| 21 | Dashboard delete button stuck in "Deleting..." on error | Reset state on catch, show alert |
| 22 | Auto-refresh overlaps with manual refresh | Skip auto-refresh when `refreshing` is true |

## What We Changed

### New files
- `src/lib/auth.ts`: Lightweight Firebase Auth token verification for API routes
- `src/__tests__/firestore.test.ts`: 50 tests covering all firestore functions

### Deleted files
- `src/app/api/send-pick-unlock/route.ts`: Dead route with IDOR
- `src/app/api/submit-unlocked-picks/route.ts`: Dead route with IDOR
- `src/__tests__/send-pick-unlock.test.ts`: Tests for deleted route
- `src/__tests__/submit-unlocked-picks.test.ts`: Tests for deleted route

### Modified files
- `firestore.rules`: Tightened party update, picks read, leave rules
- `src/lib/firestore.ts`: Token validation, input validation, batch delete, parallel fetch
- `src/lib/payouts.ts`: Fair rounding
- `src/lib/tiebreaker.ts`: Position-aware cuts_made
- `src/lib/partySync.ts`: Auth token threading
- `src/contexts/AuthContext.tsx`: Try/catch around Firestore sync
- `src/app/dashboard/page.tsx`: Error handling, delete reset, Suspense boundary
- `src/app/party/[partyId]/page.tsx`: Auth token, auto-refresh guard, self-unlock, cache-bust
- `src/app/party/create/page.tsx`: Auth token, tiebreaker sport fix
- `src/app/api/invite/route.ts`: Auth required
- `src/app/api/notify-invalid-picks/route.ts`: Auth required
- `src/app/api/notify-major/route.ts`: Cron secret fail-closed
- `src/lib/sports/golf/espn.ts`: Cache eviction
- `src/lib/sports/football/espn.ts`: Cache eviction
- `vitest.config.ts`: Removed firestore.ts from coverage exclude
- `src/components/party/LeaderboardCards.tsx`: Self-unlock button
- `src/components/party/LeaderboardTable.tsx`: Self-unlock button

## Decisions and Trade-offs

D1. **Lightweight auth over Firebase Admin SDK**: Created `src/lib/auth.ts` using Google's
    `getAccountInfo` REST endpoint rather than adding the `firebase-admin` npm package.
    Avoids a heavy dependency for a simple token verification use case.

D2. **Client-side token validation**: `savePicksWithUnlock` validates the token before the
    batch write. This is a read-then-write pattern (not a true transaction), but acceptable
    because the batch write atomically marks the token used, preventing double-use even in
    a race condition.

D3. **Floor-based payout rounding**: Switched from `Math.round` to `Math.floor` with
    round-robin remainder distribution. This avoids the scenario where rounding up on
    multiple places causes the pot to exceed the total.

D4. **Self-unlock navigates directly**: When the creator unlocks for themselves, the app
    navigates directly to the picks page instead of copying a link to clipboard.

D5. **Cache-bust on picks redirect**: After submitting picks, the redirect back to the party
    page includes a `?t=` timestamp param to force a fresh data fetch, ensuring the unlock
    button disappears immediately.

## Consequences

### Positive
- All critical security vulnerabilities patched
- 388 tests passing, 95% statement coverage, 91% branch coverage
- `firestore.ts` now has 99% coverage (was excluded entirely)
- Party creators can use the app even if they create parties after tournament starts

### Negative
- `src/lib/auth.ts` uses a Google REST endpoint that could change (low risk)
- Picks read restriction adds an extra Firestore `get()` call per read (rules quota impact)
