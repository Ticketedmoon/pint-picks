# ADR-024: Cap Made-Cut Player Scores at Cut Line

## Status
Accepted

## Date
2026-05-18

## Context
ADR-023 introduced cut line scoring where cut players are scored at cutLine + 1. However,
a fairness gap remained: if a player makes the cut but then plays poorly in later rounds
(e.g., scoring +8 when the cut line was +4), the user who picked that player is penalised
for the poor weekend performance. This felt unfair because the player did make the cut,
and the user should not be punished more than someone whose player missed the cut entirely.

## Decision

### Made-cut players (status = `playing` or `finished`)
- When a `cutLine` is available and the player's score exceeds it, their effective score
  is capped at the **cutLine** (not cutLine + 1, which is reserved for cut players).
- If the player's score is at or below the cut line, no cap is applied.
- The cap only applies when the cut line is known (not null).

### Cut players
- Unchanged from ADR-023: scored at cutLine + 1.

### WD / DQ players
- Unchanged from ADR-005: flat +1 penalty on their actual score.

### Data flow
1. `calculateEffectiveScore()` now returns a `wasCapped` boolean alongside `effectiveScore`
   and `penalty`.
2. When a made-cut player is capped, `wasCapped` is `true`, `penalty` is `0`, and
   `effectiveScore` equals the cut line value.
3. `buildLeaderboardEntries()` uses `wasCapped` to populate an `actualDisplayScore` field
   on the pick, showing the player's real score before capping.

### UI treatment
- Capped picks show the effective (capped) score followed by the actual score in brackets,
  e.g., "+4 (+8)".
- An amber **CAP** badge is displayed next to capped picks (similar to the red CUT badge).
- In the table view, capped cells have an amber left border and light amber background.
- Hovering shows a tooltip: "Score capped at cut line (actual: +8)".

## Consequences

### Positive
- Users are never penalised for a player who slumps after making the cut.
- The worst score a made-cut player can contribute is the cut line, making it strictly
  better than having a cut player (cutLine + 1).
- Actual scores remain visible so users understand the cap was applied.

### Negative
- Adds slight complexity to the scoring model with a third scoring tier
  (under cap, at cap, cut penalty).

### Extends
- ADR-023 (cut line scoring). The made-cut cap is a natural extension of the cut line
  concept introduced there.
