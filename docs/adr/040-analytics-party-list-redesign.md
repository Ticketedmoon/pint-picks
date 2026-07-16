# ADR 040: Analytics Page Redesign - Party List with Per-Member Leaderboard Activity

## Status
Accepted

## Date
2026-07-16

## Author
Shane Creedon

## Context
The `/analytics` dashboard (ADR-021, ADR-030) had grown into a dense, single-page admin view: aggregate view/click totals, browser and timezone breakdowns, a daily visits chart, system-health capacity gauges, tournament activity sections, and a per-party pill filter layered on top. It mixed two unrelated data models (the legacy per-event format and the newer aggregated format), leaned on a 10-minute `sessionStorage` cache that frequently served stale data missing newer fields, and was generally hard to reason about. In practice the page felt broken and the one question it should answer well, "who is actually checking the leaderboard for this party, and when did they last look?", was buried.

We wanted a clean rebuild focused on that single question.

## What This ADR Covers

- A brand-new two-level `/analytics` UI: a list of all parties, then a drill-in per party.
- Per-member leaderboard engagement: how many times each member opened the party's leaderboard page, plus their last-visit time.
- Extraction of the aggregation logic into a pure, unit-tested `src/lib/partyAnalytics.ts` module.
- Reuse of the existing `analytics_tournament` write path (no new tracking added).
- Removal of the browser/timezone/daily-chart/system-health sections.
- Admin gating and Google sign-in retained unchanged.

## Decisions

### D1: Two-level navigation (party list -> party detail)

The page now renders a simple list of parties. Each row shows the sport icon, party name, tournament, creator, an "active/total" member count, a "last visit" relative time, and total leaderboard views. Clicking a row opens a detail view with a per-member table (rank, name/email, views, last visit) and three summary tiles (total views, active members, last visit). A "‹ All parties" button returns to the list. This replaces the previous pill-filter-on-one-giant-page layout.

### D2: Derive per-party views from the `pages` map, not `totalViews`

`usePageView` writes to `analytics_tournament/{uid}_{tournamentId}` and increments `pages["_party_{partyId}"]` on every visit to `/party/{partyId}`. That per-page counter is party-specific, so it is the accurate source for "leaderboard views for this party". `totalViews` is per-tournament and would over-count when a user belongs to multiple parties on the same tournament.

`resolveViews` therefore prefers `pages["_party_{partyId}"]`. As a fallback for legacy docs that predate per-page tracking, it attributes `totalViews` **only** when the tournament has a single party (no attribution ambiguity); otherwise it returns 0.

### D3: `lastVisit` comes straight from the analytics doc

The `analytics_tournament` doc already stores `lastVisit` (ISO timestamp of the member's most recent visit for that tournament). We surface it directly, rendered as a relative time (`formatRelativeTime`) with the exact timestamp on hover via `title`.

### D4: Backfill every member with zeros

All `memberUids` are shown even with no analytics doc, backfilled to `{ views: 0, lastVisit: "" }`. This keeps the full roster visible and highlights members who have never opened the leaderboard, consistent with ADR-030 D2.

### D5: Pure, testable aggregation in `src/lib/partyAnalytics.ts`

All non-UI logic moved into `src/lib/partyAnalytics.ts` (`buildPartyActivity`, `buildMemberActivity`, `indexDocsById`, `countPartiesPerTournament`, `partyPageKey`, `formatRelativeTime`). The page component only fetches Firestore collections, maps them to plain records, and renders. This satisfies the repo convention that logic in `src/lib` carries >=90% test coverage; `partyAnalytics.ts` lands at ~99% statements / ~94% branches.

### D6: Shorter cache, no legacy-format handling

The cache TTL dropped from 10 minutes to 5, under a new key (`analytics_party_cache`) so old cached blobs are ignored. The legacy per-event analytics format is no longer parsed; only the aggregated `analytics_tournament` docs are read. Removed sections: browser/timezone breakdowns, daily visits chart, and the system-health/capacity gauges.

### D7: Read per-page counters from literal dotted field names

`usePageView` writes per-page counters with `setDoc(ref, { [`pages.${key}`]: increment(1) }, { merge: true })`. Unlike `updateDoc`, **`setDoc` with merge does not treat dotted string keys as field paths**, so these land as literal top-level fields named `"pages._party_xyz"` rather than nested under a `pages` map. `totalViews` and `lastVisit` are plain keys, so they always worked, which is why the old dashboard (and the first cut of this redesign) showed a populated last-visit time but **0 views**.

`extractCounterMap(data, "pages")` reconstructs the `pages` map by reading both the literal dotted fields and any real nested object, so reads work regardless of write format. The read path was fixed rather than the write path so existing historical data is recovered without a migration; a future write cleanup can nest via `FieldPath` and the reader already tolerates it.

### D8: Per-doc write debounce (fixes stale last-visit)

`usePageView` debounced writes with a single global `sessionStorage` key (`analytics_debounce_ts`). On a party page the hook fires first with `tournamentId` undefined (party still loading) and writes the *general* doc, tripping the global debounce; when the party then loads, the *tournament* doc write is suppressed. The net effect: a party's `analytics_tournament` doc rarely had its `totalViews` / `lastVisit` updated on recent visits, so the dashboard showed stale "last visit" times (e.g. 16h ago right after visiting).

The debounce key is now per destination doc (`analytics_debounce_ts_{docId}`), so the general and tournament writes no longer suppress each other. Rapid re-renders of the *same* doc are still coalesced within the 5s window. This is a write-path fix: it corrects new visits going forward and does not rewrite historical timestamps. (`src/lib/usePageView.ts` is excluded from coverage in `vitest.config.ts`, so no unit test was added.)

## Files Changed

| File | Change |
|------|--------|
| `src/lib/partyAnalytics.ts` | New pure module: types + `buildPartyActivity`, `buildMemberActivity`, `resolveViews`, `indexDocsById`, `countPartiesPerTournament`, `partyPageKey`, `extractCounterMap`, `formatRelativeTime` |
| `src/__tests__/partyAnalytics.test.ts` | New tests covering activity building, backfill, legacy fallback, sorting, rollups, and relative-time formatting |
| `src/app/analytics/page.tsx` | Full rewrite: party-list + party-detail UI; reads `analytics_tournament`, `users`, `parties`; delegates aggregation to `partyAnalytics`; reconstructs `pages` via `extractCounterMap` |
| `src/lib/usePageView.ts` | Debounce key made per-doc so general-doc writes no longer suppress tournament-doc writes (fixes stale `lastVisit`) |

## Known Limitations

- **Tracking coverage unchanged**: A member who never triggered `usePageView` (visited before analytics existed, blocked tracking, or only used direct links) still shows 0 views. This is a collection limitation, not a display bug.
- **Shared-tournament legacy docs**: For pre-per-page-tracking docs where one tournament backs multiple parties, legacy `totalViews` are not attributed to any party (shown as 0) to avoid double counting. Fresh visits populate the per-party counter correctly.

## Related

- ADR-021: Client-side analytics (original aggregated format and admin gating)
- ADR-030: Per-party filtering, member backfill, admin-only Firestore reads
