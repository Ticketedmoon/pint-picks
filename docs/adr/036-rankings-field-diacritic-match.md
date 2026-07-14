# ADR 036: Diacritic-Insensitive Tournament Field Matching + OWGR Top 300

## Status
Accepted

## Date
2026-07-14

## Author
Shane Creedon

## Context
When creating a party, the player list comes from `/api/rankings`. That route pulls the OWGR rankings, then filters them down to only players who are in the tournament field (fetched from ESPN's leaderboard endpoint). Two issues limited the pickable list:

1. **Diacritic mismatch.** ESPN and OWGR spell accented names differently. For the 2026 Open Championship (event `401811957`), ESPN's field lists "Ludvig Åberg", "Joaquin Niemann" and "Sami Välimäki" with diacritics, while OWGR returns them as plain ASCII. The exact match `field.has(p.displayName.toLowerCase())` failed for every accented name, silently dropping those players. Notably Ludvig Åberg (a top-10 player) was missing.

2. **OWGR pulled only the top 200.** The field is 156 players, but many are outside the OWGR top 200. The list only intersected the field with the top 200, capping the pickable pool well below the field size.

## What This ADR Covers

- Added a `normalizeName` helper that strips diacritics (Unicode NFD + combining-mark removal) and lowercases
- Both the ESPN field set and the OWGR filter comparison now use normalized names
- Extended the OWGR fetch from `pageSize=200` to `pageSize=300`
- For the 2026 Open field, matched players went from 105 (exact, top 200) to 119 (normalized, top 300); Åberg, Niemann and Välimäki are recovered
- No change to grouping logic, caching, or the `fieldAvailable` fallback

## Decisions

### D1: Normalize with NFD decomposition rather than a lookup table

Names are normalized with `name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()`. NFD splits accented characters into a base letter plus a combining mark, and the regex strips the combining marks. This handles any diacritic generically (å, é, ü, ñ, etc.) without maintaining a hand-written character map that would inevitably miss cases.

### D2: Normalize both sides of the comparison

Both the field Set (built in `fetchTournamentField`) and the OWGR player names (in the filter) are normalized, so the match is symmetric regardless of which source carries the accent. If ESPN and OWGR ever swap which side is accented, matching still works.

### D3: Extend OWGR to top 300, not the full field

Rather than rebuilding the list from the ESPN field (which would pull in qualifiers, club pros and amateurs with no ranking, breaking the ranked grouping logic), the OWGR fetch was simply widened to the top 300. The API accepts `pageSize=300&pageNumber=1` in a single call and returns exactly 300 ranked players. This raises the ceiling on how many field players can appear while keeping every listed player OWGR-ranked and groupable.

### D4: Keep display names untouched

Only the comparison keys are normalized. The `displayName` shown to users still comes straight from OWGR, so accents that OWGR does include are preserved in the UI. Normalization is purely a matching concern.

## Files Changed

| File | Change |
|------|--------|
| `src/app/api/rankings/route.ts` | Added `normalizeName` helper; `fetchTournamentField` now stores normalized names; field filter uses `field.has(normalizeName(p.displayName))`; OWGR fetch widened to `pageSize=300` |

## Related

- ADR 005, 023, 024: scoring rules that also depend on ESPN field data
