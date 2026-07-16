# ADR 041: Made-Cut Cap Only Applies Once the Cut Is In Effect

## Status
Accepted

## Date
2026-07-16

## Author
Shane Creedon

## Context
ADR-024 introduced the "made-cut cap": a picked player who makes the cut but then plays poorly is scored no worse than the cut line, so a user is not over-penalised for a post-cut slump. The cap was applied in `calculateEffectiveScore` whenever a `cutLine` was present:

```ts
if (isMadeCut && cutLine != null && rawScore > cutLine) {
  return { effectiveScore: cutLine, penalty: 0, wasCapped: true };
}
```

The bug: `cutLine` comes from ESPN's `tournament.cutScore`, which ESPN publishes as a **projected** cut score from Round 1 onward, well before any cut happens (the cut is applied after R2). During The Open R1, Justin Rose at +3 was being capped to the projected line (+2) and shown with a `CAP` badge, even though nobody had been cut. The `✂️ Cut line` banner was already correctly gated on `currentRound >= cutRound`, but the scoring path was not, so the two disagreed.

## Decision

### D1: Gate the made-cut cap on the cut actually being in effect

`calculateEffectiveScore` gained a third parameter, `cutIsActive: boolean = true`. The made-cut cap now requires `cutIsActive` to be true. The default stays `true` so the function's existing contract (and direct unit tests) are unchanged; callers opt out by passing `false` before the cut.

The cut-status penalty branch (`status === "cut"` -> `cutLine + 1`) is left as-is: a player only carries `cut` status after ESPN applies the cut, so it is already naturally gated.

### D2: Derive "cut is in effect" from the field, not the round number

`buildLeaderboardEntries` computes:

```ts
const cutIsActive = scores.some((s) => s.status === "cut");
```

and passes it into `calculateEffectiveScore`. A player only carries `cut` status once ESPN applies the cut (after the cut round). Deriving the flag from the field this way keeps the logic self-contained in the leaderboard builder (which already receives the full field of scores) and avoids threading `currentRound` / `cutRound` state through the build path. It also matches the semantics of the existing cut-line banner: both flip on exactly when the cut is applied.

WD/DQ players carry `wd`/`dq` status, not `cut`, so they never falsely trigger `cutIsActive` during early rounds.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/sports/golf/espn.ts` | `calculateEffectiveScore` gained `cutIsActive` param; made-cut cap now requires it |
| `src/lib/leaderboard.ts` | Compute `cutIsActive` from `scores.some(status === "cut")` and pass it into `calculateEffectiveScore` |
| `src/__tests__/espn.test.ts` | Added cutIsActive true/false cases for the made-cut cap |
| `src/__tests__/leaderboard.test.ts` | Cap test now includes a cut player in the field; new pre-cut test asserts no cap |

## Known Limitations

- If a full field somehow had zero cut players after the cut (not realistic in a standard field), the cap would stay off. In practice a real tournament field always has players below the cut line once the cut is applied.

## Related

- ADR-024: Made-cut score cap (the behaviour this ADR gates)
- ADR-023: Cut player scored at cut line + 1
- ADR-005: WD/DQ flat +1 penalty
