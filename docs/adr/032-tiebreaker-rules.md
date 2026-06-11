# ADR 032: Tiebreaker Rules for Leaderboard Ranking

## Status
Accepted

## Date
2026-06-11

## Author
Shane Creedon

## Context
When two or more party members had the same total score, their leaderboard positions were effectively random (based on array insertion order). For a game with real money buy-ins, this was unacceptable since payouts depend on final position. There was no mechanism to break ties, leaving disputes unresolvable.

## What This ADR Covers

- Configurable tiebreaker rules stored per-party as an ordered list
- Sport-specific defaults: golf parties and football parties each get sensible out-of-the-box rules
- Tiebreaker configuration UI on the party creation page for both golf and football
- Reorderable, removable, and addable rules via a drag-style UI (up/down arrows + add dropdown)
- Tiebreaker display on the party detail page showing the active rule chain
- Backward compatibility: existing parties with no `tiebreakerRules` field use the sport defaults

## Decisions

### D1: Ordered rule list, not a single "tiebreaker mode"

Tiebreakers are stored as an ordered array of `TiebreakerRule` objects, not a single enum. This allows cascading: if rule 1 doesn't break the tie, rule 2 is tried, then rule 3, etc. This mirrors how real tournaments handle ties (e.g. FIFA uses goal difference, then goals scored, then head-to-head).

### D2: Sport-specific rule catalogs

**Football defaults** (in order):
1. Furthest team in competition (fewest eliminated teams)
2. Most goals scored (combined across all picks)
3. Least goals conceded (combined across all picks)

Additional options: Best goal difference, Most wins.

**Golf defaults** (in order):
1. Best finishing golfer (lowest tournament position among picked players)
2. Most golfers made the cut (fewest cut/WD/DQ penalties)
3. Lowest single round (best individual round score among picked players)

Additional option: Fewest penalties (WD/DQ/cut count).

### D3: Tiebreaker data carried through leaderboard entries

To compute tiebreakers, the leaderboard builders needed to carry additional data through to the entries:
- **Football**: `goalsFor` and `goalsAgainst` added to `FootballLeaderboardEntry.picks`
- **Golf**: `position` added to `LeaderboardEntry.picks` (passed through from `PlayerScore.position`)

This avoids a second data fetch at tiebreaker time.

### D4: Defaults applied at sort time, not at party creation

If `party.tiebreakerRules` is undefined or missing (existing parties), the sort functions fall back to the sport's default rules. This means existing parties benefit from tiebreakers immediately without a data migration.

### D5: Tiebreaker UI as a shared component

`TiebreakerSection` is a shared component used by both `GolfCreateContent` and `FootballCreateContent`, accepting a `sport` prop to determine the available options catalog. Rules can be reordered (up/down arrows), removed (X button), and new ones added from a dropdown. Defaults are pre-populated.

## Files Changed

| File | Change |
|------|--------|
| `src/types/index.ts` | Added `TiebreakerRuleId` union type (9 values), `TiebreakerRule` interface, `tiebreakerRules` optional field on `Party`, `position` field on `LeaderboardEntry.picks` |
| `src/lib/tiebreaker.ts` | New module: rule catalogs, defaults, stats extraction, comparison functions, and `applyFootballTiebreakers` / `applyGolfTiebreakers` entry points |
| `src/lib/leaderboard.ts` | Passes `position` through to picks, applies golf tiebreakers after primary sort |
| `src/lib/sports/football/types.ts` | Added `goalsFor`, `goalsAgainst` to `FootballLeaderboardEntry.picks` |
| `src/lib/sports/football/scoring.ts` | Passes `goalsFor`/`goalsAgainst` through to picks, applies football tiebreakers after primary sort |
| `src/lib/firestore.ts` | `createParty` accepts optional `tiebreakerRules` parameter |
| `src/app/party/create/page.tsx` | Added `TiebreakerSection` shared component, wired into both golf and football create forms, passed through `CreatePartyData` |
| `src/app/party/[partyId]/page.tsx` | Displays active tiebreaker rules for both sports in the party header |
| `src/__tests__/tiebreaker.test.ts` | 30 tests covering all football and golf tiebreaker rules, cascading, edge cases, and defaults |
| `docs/adr/031-party-name-rename.md` | New ADR for the rename feature (shipped same session) |
