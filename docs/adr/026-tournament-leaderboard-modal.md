# ADR-026: Tournament Leaderboard Modal

## Status
Accepted

## Date
2026-05-18

## Context
Users wanted to see the full tournament leaderboard (all players, not just their picks)
without leaving the party page. This helps them track how the overall field is performing
and compare their picks against the broader competition.

The ESPN leaderboard data (`PlayerScore[]`) is already fetched on every refresh cycle
for scoring purposes, so no additional API call is needed.

## Decision

### Data flow
- The full `PlayerScore[]` array returned by `fetchLeaderboard()` is stored in component
  state (`tournamentScores`) alongside the existing leaderboard entries.
- No additional fetch is required; the data piggybacks on the existing refresh cycle
  and auto-refresh timer.

### UI treatment
- An indigo **"🏌️ Tournament Leaderboard"** pill button is shown in the round info
  chip bar (alongside the round number, tee-off time, and cut line chips).
- The pill is only visible when tournament scores are available (`scores.length > 0`).
- Clicking the pill opens a modal (`TournamentLeaderboardModal` component) with:
  - A scrollable table of all players sorted by score-to-par.
  - Columns: position, player name, score-to-par, and thru status.
  - Color-coded scores: red for under par, blue for over par, gray for even.
  - Cut/WD/DQ players are sorted to the bottom with status badges and strikethrough names.
  - No player headshots are loaded to keep the modal lightweight and fast.
- **Mobile:** modal slides up as a bottom sheet (max 85vh height).
- **Desktop:** modal is a centered card (max-width 32rem).
- Closes via: clicking the backdrop, pressing Escape, or the X button.
- Body scroll is locked while the modal is open.

## Consequences

### Positive
- Full tournament context is available without navigating away from the party page.
- Zero additional API calls; reuses existing data.
- Lightweight: no images loaded, simple table layout.

### Negative
- The leaderboard data is only as fresh as the last auto-refresh cycle (configurable
  interval, currently every 60 seconds).
- Large fields (150+ players) produce a long scrollable list, but this is mitigated
  by the fixed-height modal with overflow scrolling.
