# BirdieBets Scoring Skill

## When to Use

USE FOR: scoring change, cut line, penalty, score calculation, effective score, scoring rule

## Repository Context

- **App:** BirdieBets - golf tournament betting tracker
- **Scoring logic:** `src/lib/espn.ts` (`calculateEffectiveScore`)
- **Scoring display:** `src/lib/scoring.ts` (colors, status checks)
- **Leaderboard:** `src/lib/leaderboard.ts` (`buildLeaderboardEntries`)
- **Tests:** `src/__tests__/espn.test.ts`, `src/__tests__/leaderboard.test.ts`
- **ADRs:** `docs/adr/005-scoring-system.md`, `023-cutline-scoring.md`, `024-made-cut-score-cap.md`

## Current Scoring Rules

| Status | Rule | ADR |
|---|---|---|
| Playing/Finished | Score at or below cut line: actual score. Above cut line: capped at cutLine | ADR-024 |
| Cut | cutLine + 1 (when cutLine available), else scoreToPar + 1 | ADR-023 |
| WD/DQ | scoreToPar + 1 | ADR-005 |

## Key Functions

```typescript
// src/lib/espn.ts
calculateEffectiveScore(playerScore, cutLine?)
  -> { effectiveScore, penalty, wasCapped }

formatScoreToPar(score)
  -> "E" | "+N" | "-N"

// src/lib/scoring.ts
isCutStatus(status)     -> boolean
getScoreColor(score, status?) -> tailwind class
getTotalScoreColor(total)     -> tailwind class

// src/lib/leaderboard.ts
buildLeaderboardEntries(party, allPicks, usersInfo, scores, cutLine?)
```

## Workflow

1. Update `calculateEffectiveScore` in `src/lib/espn.ts`
2. Update `buildLeaderboardEntries` in `src/lib/leaderboard.ts` if display changes
3. Update UI components if needed: `PickCell.tsx`, `LeaderboardTable.tsx`, `LeaderboardCards.tsx`
4. Update tests in `src/__tests__/espn.test.ts` and `src/__tests__/leaderboard.test.ts`
5. Run `npm run test:coverage` - 90% minimum, 100% preferred on `src/lib/`
6. Create ADR in `docs/adr/` for any scoring rule change
