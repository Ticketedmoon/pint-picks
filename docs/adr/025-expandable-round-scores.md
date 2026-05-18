# ADR-025: Expandable Per-Round Scores

## Status
Accepted

## Date
2026-05-18

## Context
Users wanted to see how each of their picked players performed on a per-round basis
during the tournament, not just the aggregate score-to-par. This provides insight into
whether a player had a strong start and faded, or rallied on the weekend.

The ESPN API already provides per-round scores relative to par via the `linescores`
array on each competitor, with `displayValue` containing values like `"+6"`, `"-2"`,
or `"E"`.

## Decision

### Data source
- ESPN's `competitor.linescores[].displayValue` values are already relative to par.
  They are passed through directly as `roundScoresToPar` on each pick, with no
  conversion needed.
- The `PlayerScore.roundScores` field (which maps ESPN linescores) is threaded from
  `buildLeaderboardEntries()` to the `LeaderboardEntry` pick type as
  `roundScoresToPar?: string[]`.

### UI treatment
- Each player pick cell shows a small **▼** chevron when round data is available.
- Tapping the pick expands it to reveal color-coded pills for each round:
  `R1 +6` `R2 -2` `R3 E` `R4 -3`.
- Pill colors: red background for under par, blue for over par, gray for even.
- Tapping again collapses the row.
- **Card view (mobile):** chevron at the end of the row, round pills expand below
  the player name.
- **Table view (desktop):** chevron sits inline next to the score to avoid floating
  at the bottom of the cell.

### Why not always visible?
Showing round scores inline for all 6 picks per user would consume too much vertical
space, especially on mobile. The expandable approach keeps the default view clean while
making the data one tap away.

## Consequences

### Positive
- Users can drill into per-round performance without leaving the leaderboard.
- No additional API calls required; data is already fetched.
- Mobile-friendly: expand/collapse keeps the UI compact.

### Negative
- Round data is only available once the tournament is in progress (no data pre-tournament).
- ESPN's `displayValue` format is trusted as-is; if ESPN changes the format, the pills
  may display unexpected values.
