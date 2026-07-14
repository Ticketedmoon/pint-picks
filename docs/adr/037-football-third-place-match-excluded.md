# ADR 037: Exclude the Third-Place Play-off from Football Scoring

## Status
Accepted

## Date
2026-07-14

## Author
Shane Creedon

## Context
In the FIFA World Cup (and other knockout tournaments) there is a third-place play-off after the semi-finals, contested by the two losing semi-finalists to decide 3rd vs 4th. This match is exhibition-only and should not affect a party's standings. Previously `calculateTeamMatchPoints` counted every completed knockout match, so the third-place match awarded the winner 3 points and inflated the tally of whoever picked that team.

ESPN labels the match with the season slug `3rd-place-match` (mapped to `match.round`); the per-competition notes text is empty.

## What This ADR Covers

- Added an `isThirdPlaceMatch` helper that detects the third-place play-off from ESPN slugs and human-readable notes (`3rd-place-match`, `3rd Place`, `Third Place Match`, `third-place`)
- `calculateTeamMatchPoints` now skips the third-place match entirely: no points, no W/D/L, no matches played, no match summary
- Other knockout matches (Round of 16/32, Quarterfinal, Semifinal, Final) are unaffected
- `isKnockoutStage` is unchanged; the loser of the third-place match is already eliminated via their semi-final loss

## Decisions

### D1: Skip the match rather than zero out its points

The match is skipped before any accounting in `calculateTeamMatchPoints`, so it contributes nothing to points, record, matches played, or the match-summary display. This matches the intent that the match "should not contribute at all", and keeps the leaderboard and per-team match list clean rather than showing a phantom fixture.

### D2: Detect via a dedicated helper, not by widening `isKnockoutStage`

`isThirdPlaceMatch` is separate from `isKnockoutStage` because the two answer different questions: knockout detection drives elimination and bracket-membership logic, while third-place detection drives points exclusion. Keeping them separate avoids accidentally changing elimination behaviour.

### D3: Match on both `round` and `stage`

ESPN populates the season slug (`match.round`) for World Cup fixtures but leaves the notes (`match.stage`) empty. Checking both mirrors the existing `isKnockoutMatch` pattern and stays robust if a future league carries the label in the notes instead.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/sports/football/espn.ts` | Added `isThirdPlaceMatch`; `calculateTeamMatchPoints` skips third-place matches |
| `src/__tests__/espn-football.test.ts` | Added `isThirdPlaceMatch` tests and third-place points-exclusion tests |

## Related

- ADR 035: Football knockout elimination
- ADR 029: Multi-sport football support
