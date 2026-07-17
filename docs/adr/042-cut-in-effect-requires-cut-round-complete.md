# ADR 042: Cut Is "In Effect" Only Once the Cut Round Is Complete

## Status
Accepted

## Date
2026-07-17

## Author
Shane Creedon

## Context
ADR-041 gated the made-cut cap (and the `✂️ Cut line` banner) on the cut being "in effect", deriving that from the field:

```ts
const cutIsActive = scores.some((s) => s.status === "cut");
```

The bug: during The Open R2 (still in progress), the live ESPN feed showed:

- `tournament.cutScore` moving in real time (`+1` earlier in the day, `0` an hour later) because R2 was not finished.
- 51 of 156 players not yet teed off in R2, 71 mid-round, only 33 finished.
- Exactly 1 player flagged `STATUS_CUT` (an early withdrawal that never played R2: `thru=0`, R2 linescore `"-"`).

That single early `STATUS_CUT` flipped `cutIsActive` true for the whole field, so made-cut players were capped at, and the banner displayed, a projected cut line that was still shifting. `some(status === "cut")` is too fragile: ESPN can assign `cut` status to a stray withdrawal well before the cut is actually applied.

## Decision

### D1: Require the cut round to be complete for the whole field
New exported helper `isCutInEffect(scores, cutRound)` in `src/lib/leaderboard.ts` returns true only when:

1. `cutRound` is a real cut round (`> 0`), and
2. every player has either been removed (`cut` / `wd` / `dq`) or has **finished** the cut round, and
3. at least one player carries `cut` status.

"Finished the cut round" is derived from `roundScores`: a player must have real (non-placeholder) scores for more rounds than the cut round, or exactly the cut round's worth **and** status `finished`. ESPN posts a running value for the in-progress round and a `"-"` placeholder for unplayed rounds, so a player mid-cut-round (status `playing`) or not yet teed off (`"-"`) does not count as complete.

### D2: Use the same signal for scoring and the banner
`buildLeaderboardEntries` now takes `cutRound` and computes `cutIsActive = isCutInEffect(scores, cutRound)`. The party page passes the `cutRound` it already fetches, and the `✂️ Cut line` banner now renders on `isCutInEffect(tournamentScores, cutRound)` instead of `currentRound >= cutRound`. Scoring cap and banner flip on together, exactly when the cut is final.

This supersedes ADR-041's D2 (`scores.some(status === "cut")`). ADR-041's D1 (the `cutIsActive` parameter on `calculateEffectiveScore`) is unchanged.

### D3: Show the projected cut line before the cut is final
While the cut is not yet in effect, the party header shows a distinct amber, dashed "🔮 Projected cut" chip (instead of the final red `✂️ Cut line` chip). It reads `Projected cut: <line> · moves until R<cutRound> ends` to make clear the value is ESPN's live projection and will keep changing until the cut round finishes. The cut round is tournament-specific (`cutRound` from ESPN), so the label adapts per event. The projected and final chips are mutually exclusive: `isCutInEffect` gates one on, the other off.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/leaderboard.ts` | Added `isCutInEffect`, `hasCompletedRound`, `isRealRoundScore`; `buildLeaderboardEntries` gained a `cutRound` param and uses `isCutInEffect` |
| `src/app/party/[partyId]/page.tsx` | Pass `cutRound` into `buildLeaderboardEntries`; final cut banner gated on `isCutInEffect`; added projected-cut chip shown while the cut is not yet final |
| `src/__tests__/leaderboard.test.ts` | Cap test now supplies `cutRound` + completed-round data; new mid-cut-round test; direct `isCutInEffect` branch tests |

## Known Limitations
- In the short window after R2 completes but before ESPN marks any player `cut`, the cap/banner stay off (they need at least one genuine cut). In practice ESPN applies the cut as R2 finalizes, so this is momentary.
- Relies on ESPN populating per-round `linescores`. If those are missing, `hasCompletedRound` returns false and the cut is treated as not-yet-final (fail safe: no premature capping).

## Related
- ADR-041: Made-cut cap requires cut in effect (the signal this ADR replaces)
- ADR-024: Made-cut score cap
- ADR-023: Cut player scored at cut line + 1
- ADR-005: WD/DQ flat +1 penalty
