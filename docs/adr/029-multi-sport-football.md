# ADR-029: Multi-Sport Architecture and Football Support

**Status:** Accepted
**Date:** 2026-06-08
**Author:** Shane Creedon

## What This ADR Covers

- Rebranding from BirdieBets to PintPicks to support multiple sports
- Adding football (soccer) as a second sport alongside golf
- League-agnostic ESPN integration for football (World Cup, Premier League, Champions League)
- Tier-based team grouping system for football (analogous to OWGR groups for golf)
- Football scoring rules: Win=3, Draw=1, Loss=0, full tournament accumulation
- Sport selection flow and sport-aware party system
- Data model changes: `sportType` and `leagueSlug` on Party documents
- Backward compatibility for existing golf parties

## Summary

The app was originally built as a golf-only tournament pool tracker ("BirdieBets"). With the 2026 FIFA World Cup starting, we extended it to support football alongside golf, rebranding to "PintPicks" to reflect the multi-sport, pub-themed identity.

The key architectural insight is that ESPN uses an identical API pattern across all football leagues. The league slug is the only variable, making it trivial to add new leagues. We launched with three leagues (World Cup, Premier League, Champions League) and the system supports adding more with a single config entry.

The football pick system mirrors golf: users pick 6 teams from 4 ranked tiers (A-D) plus 2 wildcards. Rankings come from FIFA World Rankings (for WC), previous season standings (for PL), and UEFA coefficients (for CL).

## Decisions and Trade-offs

**D1: Rebrand to PintPicks**
We chose PintPicks over alternatives (PickParty, SweepStake, etc.) for its pub-themed appeal, alliterative catchiness, and sport-neutral identity. The green color theme was retained as it works across both sports and fits the pub vibe.

**D2: Tier-based grouping over actual tournament groups**
For the World Cup, we group teams by FIFA ranking into 4 tiers rather than using the actual WC groups (A-L). This creates more interesting picks because actual WC groups have uneven strength (some groups have a clear favourite, others don't). Tier-based grouping ensures every tier has genuine debate.

**D3: 6-pick structure (4 tiers + 2 wildcards)**
We kept the same pick structure as golf for consistency. Users pick one team from each tier (A-D) plus 2 wildcards from the remaining teams. This keeps the Party/Picks data model identical across sports.

**D4: Full tournament scoring**
Football scoring (W=3, D=1, L=0) accumulates through the entire tournament, including knockout rounds. Eliminated teams stop scoring but retain their existing points. This parallels golf where the tournament runs for the full duration.

**D5: League-agnostic ESPN integration**
Rather than building separate modules for each league, we built a single `espn-football.ts` module that accepts a league slug. All ESPN football endpoints follow the same pattern: `sports/soccer/{slug}/scoreboard`, `sports/soccer/{slug}/standings`, `sports/soccer/{slug}/teams`.

**D6: Static ranking tables**
For team tier assignment, we use static ranking tables embedded in code rather than fetching live rankings from external APIs. The team pools for each league are fixed for a season, and rankings change slowly. This avoids an additional API dependency and simplifies caching.

**D7: Sport type as optional field**
`sportType` and `leagueSlug` are optional fields on the Party document. Existing golf parties in Firestore don't have these fields and default to "golf". This maintains full backward compatibility with zero migration needed.

## What We Changed

### New Files
| File | Purpose |
|------|---------|
| `src/types/football.ts` | Football-specific types (FootballTeam, FootballMatch, FootballTeamScore, etc.) |
| `src/lib/espn-football.ts` | League-agnostic ESPN football API integration |
| `src/lib/football-leagues.ts` | League config + static ranking tables for WC, PL, CL |
| `src/lib/football-scoring.ts` | Football scoring logic and leaderboard builder |
| `src/app/sports/page.tsx` | Sport selection page (Golf vs Football) |
| `src/app/api/football/matches/route.ts` | ESPN matches proxy with caching |
| `src/app/api/football/standings/route.ts` | ESPN standings proxy with caching |
| `src/app/api/football/rankings/route.ts` | Tier-based team ranking endpoint |
| `src/app/api/football/leagues/route.ts` | Available leagues endpoint |
| `src/__tests__/espn-football.test.ts` | Football ESPN integration tests |
| `src/__tests__/football-scoring.test.ts` | Football scoring and leaderboard tests |
| `src/__tests__/football-leagues.test.ts` | League config and ranking tests |

### Modified Files
| File | Changes |
|------|---------|
| `src/types/index.ts` | Added `SportType`, `sportType`/`leagueSlug` on Party and Tournament |
| `src/app/layout.tsx` | Rebranded metadata to PintPicks |
| `src/components/Navbar.tsx` | Rebranded to PintPicks with pint emoji |
| `src/app/login/page.tsx` | Rebranded to PintPicks, redirects to /sports |
| `src/app/page.tsx` | Routes to /sports instead of /dashboard |
| `src/app/dashboard/page.tsx` | Sport-aware filtering, updated branding |
| `src/lib/firestore.ts` | createParty accepts sportType and leagueSlug |
| `package.json` | Renamed to pintpicks |

## ESPN API Reference

All football endpoints use the base: `site.api.espn.com/apis/site/v2/sports/soccer/{slug}/`

| League | Slug | Teams |
|--------|------|-------|
| FIFA World Cup 2026 | `fifa.world` | 48 national teams |
| Premier League | `eng.1` | 20 clubs |
| Champions League | `uefa.champions` | 36 clubs |

Key endpoints:
- `/scoreboard` - All matches with scores, status, teams
- `/teams` - All teams with logos, abbreviations
- `/standings` (via v2 API) - Group standings with W/D/L/Pts/GD

## Football Scoring Rules

| Outcome | Points |
|---------|--------|
| Win | 3 |
| Draw | 1 |
| Loss | 0 |

- Points accumulate through group stage AND knockout rounds
- Eliminated teams stop accumulating but retain existing points
- Penalty shootout wins count as wins (3 points)
- Scoring direction is reversed from golf: highest total wins

## Related

- ADR-004: Player Groups (golf tier system)
- ADR-005: Scoring System (golf scoring rules)
- ADR-007: OWGR Dynamic Groups (golf ranking-based grouping)
