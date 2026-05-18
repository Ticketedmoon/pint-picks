# BirdieBets Testing Skill

## When to Use

USE FOR: run tests, add test, fix test, test coverage, write tests, test failure

## Repository Context

- **App:** BirdieBets - golf tournament betting tracker
- **Test framework:** Vitest 3.x with `vi.mock()` for external dependencies
- **Test location:** `src/__tests__/`
- **Coverage config:** `vitest.config.ts` - 90% minimum on `src/lib/` modules
- **Writing style:** Never use em dashes.

## Commands

| Command | Purpose |
|---|---|
| `npm test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run build` | Production build (catches type errors) |

## Test File Map

| Test File | Tests For |
|---|---|
| `espn.test.ts` | ESPN API calls, `calculateEffectiveScore`, `formatScoreToPar`, `fetchLeaderboard`, `fetchCurrentRound` |
| `leaderboard.test.ts` | `buildLeaderboardEntries`, scoring display, cut/cap behavior |
| `scoring.test.ts` | `getScoreColor`, `isCutStatus`, `getTotalScoreColor` |
| `emailTemplates.test.ts` | All email builders, HTML escaping, XSS prevention |
| `partySync.test.ts` | Party status transitions, compaction triggers |
| `pickValidation.test.ts` | Pick validation against tournament field |
| `payouts.test.ts` | Payout calculations |
| `constants.test.ts` | Pick slot definitions |
| `playerGroups.test.ts` | Group assignment, group labels |
| `send-pick-unlock.test.ts` | Unlock email API route |
| `submit-unlocked-picks.test.ts` | Unlock picks submission API route |
| `hasIncompleteOrNoPicks.test.ts` | Pick completeness checks |

## Test Conventions

1. **Mock external deps** with `vi.mock()`:
   ```typescript
   vi.mock("@/lib/firestore", () => ({
     getParty: vi.fn(),
     savePicks: vi.fn(),
   }));
   ```

2. **Helper factories** for test data:
   ```typescript
   function makePlayerScore(overrides: Partial<PlayerScore> = {}): PlayerScore {
     return { playerId: "1", playerName: "Test", scoreToPar: 0, displayScore: "E", status: "playing", ...overrides };
   }
   ```

3. **Shared test helpers** in `src/__tests__/helpers.ts` (`mockParty`, `completePicks`)

4. **ESPN cache** must be cleared between tests:
   ```typescript
   import { clearEspnCache } from "@/lib/espn";
   beforeEach(() => { clearEspnCache(); });
   ```

5. **LeaderboardResult** mocks must include `coursePar: null`:
   ```typescript
   { scores: [], cutLine: null, cutRound: null, coursePar: null }
   ```

## Workflow

1. Run `npm run test:coverage` to see current state
2. Add/fix tests
3. Re-run coverage to verify thresholds (90% on `src/lib/`)
4. Run `npm run build` to catch type errors not caught by Vitest
