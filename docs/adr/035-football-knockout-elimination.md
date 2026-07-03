# ADR 035: Football Knockout / Elimination Detection

## Status
Accepted

## Date
2026-07-03

## Author
Shane Creedon

## Context
For football tournaments (e.g. the FIFA World Cup), picks kept showing teams as still "in" even after they were knocked out. Players wanted a clear visual signal on the picks display when one of their teams is out, highlighted in red, the same way golf shows a "CUT" player.

The challenge was reliably deducing elimination from the ESPN API. Three real-world quirks made a naive approach fail:

1. ESPN's per-match `notes[0].text` (the stage label) is empty for World Cup matches, so a text-based "is this a knockout match" check never fired. Croatia and Japan (knocked out in the Round of 32) were not flagged.
2. The reliable round indicator is the event's `season.slug` (`"group-stage"` vs `"round-of-32"`, `"quarterfinals"`, etc.), not the notes text.
3. The 2026 format advances the top 2 of each group plus the 8 best 3rd-placed teams. Non-qualifying 3rd-placed teams keep the standings note `"Best 8 advance"`, identical to the 3rd-placed teams that DID advance (e.g. Scotland vs Ghana). The standings note alone cannot distinguish them.

## What This ADR Covers

- Detecting knockout elimination from ESPN via the event `season.slug`, not the empty match notes
- Three complementary elimination signals: knockout loss, standings "Eliminated" note, and bracket miss
- A new `PlayerScore.status = "eliminated"` flowing through the generic leaderboard path
- Red strikethrough + "OUT" badge in `PickCell` for eliminated picks, mirroring golf's "CUT"
- No new API dependency: standings were already fetched; matches were already fetched

## Decisions

### D1: Use `season.slug` as the round indicator, not match notes

`mapEventToMatch` now sets `FootballMatch.round = event.season.slug`. `isKnockoutStage()` matches both ESPN slugs (`round-of-32`, `quarterfinals`) and human-readable text (`Round of 16`), so group/league stages return false. This is the single reliable knockout signal, verified against live ESPN data.

### D2: Three complementary elimination signals

A picked team is `eliminated` if ANY of:

1. **Knockout loss** (`calculateTeamMatchPoints.eliminated`): it lost a match whose round is a knockout round. Definitive and catches mid-knockout exits (Croatia, Japan).
2. **Standings "Eliminated" note**: ESPN marks clearly-out group teams (even mid-group, before knockouts start). Catches early group-bottom exits.
3. **Bracket miss**: the knockout stage is underway (a knockout match is in-progress or finished), the team has finished all its group games, and it appears in no knockout fixture. Catches non-qualifying 3rd-placed teams whose standings note is ambiguous (Scotland).

### D3: Bracket-miss rule is gated to avoid premature flagging

The bracket-miss rule only triggers once a real knockout match is `in`/`post`, and never fires for a team that still has a pending group game. This prevents false eliminations during the group stage even if ESPN pre-creates placeholder knockout fixtures.

### D4: Reuse the existing generic leaderboard path

The party picks display uses the generic `fetchScores` -> `buildLeaderboardEntries` path, and `PlayerScore.status` already supported `"eliminated"`. So the football adapter just sets the status; no leaderboard plumbing changes were needed. `PickCell` renders red strikethrough + an "OUT" badge, reusing the golf "CUT" styling in both card and table variants.

## Files Changed

| File | Change |
| --- | --- |
| `src/lib/sports/football/espn.ts` | Add `season.slug` mapping to `FootballMatch.round`; `isKnockoutStage()` helper (slug + text); `eliminated` on `calculateTeamMatchPoints` |
| `src/lib/sports/football/types.ts` | Add `round?` to `FootballMatch` |
| `src/lib/sports/football/index.ts` | Export `isKnockoutStage` |
| `src/lib/sports/football.ts` | Build knockout bracket set; combine knockout-loss + standings-note + bracket-miss into `status: "eliminated"` |
| `src/components/party/PickCell.tsx` | Red strikethrough + "OUT" badge for eliminated picks |
| `src/__tests__/espn-football.test.ts` | `isKnockoutStage` (slug + text) and knockout-elimination tests |
| `src/__tests__/sports.test.ts` | Knockout-loss, standings-note, bracket-miss, and bracket-member tests |

## Verification

Validated against live ESPN data (2026 World Cup, Round of 32): Scotland out (missed bracket), Ghana in (best-third qualifier), Croatia and Japan out (knockout loss), favourites still active. 402 tests pass, coverage above 90%, production build clean.

## Related

- ADR 029: Multi-sport football support
- ADR 032: Tiebreaker rules (football defaults)
