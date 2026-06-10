# ADR 030: Analytics Per-Party Filtering and Dashboard Rules

## Status
Accepted

## Date
2026-06-10

## Author
Shane Creedon

## Context
The `/analytics` admin dashboard (ADR-021) showed aggregated totals across all parties and users. With multiple parties running simultaneously (e.g. a PGA Championship golf party and a FIFA World Cup football party with overlapping members), it was impossible to see engagement data scoped to a single party. The admin had no way to answer "how active are the members of this specific party?"

Additionally, the `/dashboard?sport=*` pages had no explanation of how the game works, leaving new users to figure out tiers, scoring, and pick slots on their own.

## What This ADR Covers

- Per-party filtering on the `/analytics` page via a pill selector
- Disambiguation of parties with duplicate names by showing the creator's display name
- Backfilling party members who have no analytics events (showing 0 views rather than hiding them)
- Resolving UIDs to emails/display names from the Firestore `users` collection
- Tournament activity scoped to the selected party's tournament (name-based matching)
- "How It Works" modal on `/dashboard` with sport-specific rules for golf and football
- Known limitation: analytics only captures users whose visits triggered the tracking hooks

## Decisions

### D1: Party selector as pill buttons, not a dropdown

A horizontal row of pill-style buttons ("All Parties", then one per party) was chosen over a `<select>` dropdown. Reasons:
- The typical number of parties is small (2-5), so pills fit comfortably
- Pill buttons give a clearer visual indication of which party is selected
- Each pill shows the member count as a quick reference

Duplicate party names are disambiguated by appending the creator's display name in parentheses. This only appears when a name collision exists.

### D2: Backfill party members with zero analytics

When a party is selected, all `memberUids` are shown in the user tables, even if they have no documents in `analytics_general` or `analytics_tournament`. Missing members are backfilled with `{ views: 0, clicks: 0, lastVisit: "" }`.

This was chosen over only showing users with data because:
- It surfaces the full party roster at a glance
- It highlights which members have never engaged with the app
- Before this change, inactive members were completely invisible

### D3: Tournament matching by name, not by ID

The party stores a `tournamentId` (e.g. an ESPN league ID like "606" for FIFA World Cup), but the analytics tournament docs derive their `tournamentId` from the Firestore document ID format (`{uid}_{tournamentId}`). These IDs don't always match across the two systems.

To avoid brittle ID coupling, the filter resolves the party's `tournamentName` against the `tournamentNames` map (built from all parties) to find the corresponding analytics `tournamentId`. This ensures the correct tournament section is shown and backfilled members land under the right heading.

### D4: UID resolution maps (uidToName, uidToEmail)

Two maps are built from the existing `usersSnap` (no additional Firestore reads):
- `uidToName`: `displayName || email || uid.slice(0, 8)` for chart labels and fallback display
- `uidToEmail`: actual email address for table cells and backfilled entries

These are stored on the `AnalyticsData` object and accessed with optional chaining (`?.`) to handle stale `sessionStorage` cache that predates the new fields.

### D5: "How It Works" modal on dashboard

A "How It Works" button was added alongside "Create Party" and "Join Party" on `/dashboard`. It opens a modal (not a collapsible section) containing:
- Overview paragraph explaining the core concept
- Pick tiers table (A/B/C/D/W1/W2 with ranking ranges)
- Scoring rules (sport-specific: score-to-par for golf, W3/D1/L0 for football)
- Pro tip callout

The modal follows existing conventions: `role="dialog"`, `aria-modal`, `aria-label`, Escape-to-close, click-outside-to-close.

Rules data is defined as constants (`GOLF_RULES`, `FOOTBALL_RULES`) at the top of the dashboard module, switching based on the `?sport=` query param.

## Files Changed

| File | Change |
|------|--------|
| `src/app/analytics/page.tsx` | Added `PartyInfo` interface, `selectedPartyId` state, party selector UI, filtered views for stats/charts/tables/tournament activity, `uidToName`/`uidToEmail` maps, member backfill logic |
| `src/app/dashboard/page.tsx` | Added `GOLF_RULES`/`FOOTBALL_RULES` constants, `rulesOpen` state, "How It Works" button and modal with tiers, scoring, and pro tip |
| `firestore.rules` | Added `isAdmin()` function, locked `analytics_general` and `analytics_tournament` reads to admin UID only |

## Known Limitations

- **Analytics gaps**: Party members who joined and picked but never triggered `usePageView`/`useTrackClick` will show 0 views. This is a data collection limitation, not a display bug. Possible causes: visited before analytics was implemented, blocked tracking, or only used direct links.
- **Browser/timezone breakdown not filtered**: The `byBrowser` and `byTimezone` charts still show global data when a party is filtered, because the aggregated analytics docs don't store per-user browser/timezone breakdowns.
- **Session cache staleness**: The 10-minute `sessionStorage` cache (from ADR-021) may serve stale data missing new fields like `uidToEmail`. The "Refresh" button bypasses this. All new field accesses use optional chaining as a guard.

## Server-Side Security

### D6: Firestore rules lock analytics reads to admin UID

Previously, `analytics_general` and `analytics_tournament` had `allow read: if isSignedIn()`, meaning any authenticated user could read all analytics data directly from Firestore. This is now locked down:

```
function isAdmin() {
  return request.auth.uid == 'O9xgSWINxiZQQFi142PE1JI2u5C3';
}

match /analytics_general/{uid} {
  allow read: if isSignedIn() && isAdmin();
}
match /analytics_tournament/{docId} {
  allow read: if isSignedIn() && isAdmin();
}
```

Writes remain open to all signed-in users (needed for the `usePageView`/`useTrackClick` hooks). This approach was chosen over an `admins` collection for simplicity. The UID can be swapped to a collection-based lookup later if multiple admins are needed.

**Deploy with:** `npx firebase deploy --only firestore:rules`
