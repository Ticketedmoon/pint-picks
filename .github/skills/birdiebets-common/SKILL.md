# BirdieBets Common Actions Skill

## When to Use

USE FOR: build, deploy, lint, commit, push, analyze bundle, firebase deploy, start dev, check status

## Commands Quick Reference

| Action | Command |
|---|---|
| Start dev server | `npm run dev` |
| Run tests | `npm test` |
| Run tests with coverage | `npm run test:coverage` |
| Production build | `npm run build` |
| Bundle analysis | `ANALYZE=true npm run build` (or `npm run analyze`) |
| Lint | `npm run lint` |
| Deploy Firestore rules | `npx firebase deploy --only firestore:rules` |
| Firebase login | `npx firebase login` |

## Pre-commit Checklist

1. `npm run test:coverage` - all tests pass, 90%+ coverage on `src/lib/`
2. `npm run build` - no type errors
3. `git add -A && git commit -m "message"` - include Co-authored-by trailer
4. `git push`

## Project Structure

```
src/
  app/                    # Next.js App Router pages
    api/                  # Server-side API routes
      espn/leaderboard/   # ESPN proxy (cached)
      espn/round/         # Current round proxy (cached)
      invite/             # Email invites
      notify-major/       # Major tournament reminders
      notify-invalid-picks/
      rankings/           # OWGR rankings proxy
      send-pick-unlock/   # Pick unlock emails
      submit-unlocked-picks/
    party/[partyId]/      # Party leaderboard page
    party/create/         # Create party page
    dashboard/            # User dashboard
    analytics/            # Admin analytics
    login/                # Login page
  components/             # Shared React components
    party/                # Party-specific components
    Skeletons.tsx         # Loading skeletons
    Navbar.tsx
    GroupEditor.tsx
  contexts/               # React context providers
  lib/                    # Core business logic (90%+ coverage required)
    espn.ts               # ESPN API, scoring, caching
    firestore.ts          # Firestore CRUD operations
    leaderboard.ts        # Leaderboard builder
    scoring.ts            # Score colors, status checks
    logger.ts             # Structured JSON logger
    emailTemplates.ts     # Email HTML builders
    partySync.ts          # Party status sync
    payouts.ts            # Payout calculations
    constants.ts          # App constants
  types/                  # TypeScript type definitions
  __tests__/              # Test files (mirrors src/lib/)
docs/
  adr/                    # Architecture Decision Records (001-028)
firestore.rules           # Firestore security rules
firebase.json             # Firebase CLI config
```

## Environment Variables

| Variable | Purpose | Where |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase client config | `.env.local` |
| `RESEND_API_KEY` | Email sending | `.env.local` |
| `NEXT_PUBLIC_ANALYTICS_ADMIN_EMAIL` | Analytics access | `.env.local` |
| `CRON_SECRET` | Protect cron endpoints | `.env.local` / Vercel |
| `ANALYZE` | Enable bundle analyzer | CLI only |

## Key Conventions

- Never use em dashes in any output
- Use structured JSON logging via `src/lib/logger.ts` in all API routes
- Dynamic imports for heavy components (`LeaderboardCards`, `LeaderboardTable`, `TournamentLeaderboardModal`, `GroupEditor`)
- ESPN data cached at two layers: server-side (60s) and browser (3 min)
- Firestore security rules in `firestore.rules`, deploy via Firebase CLI
- ADRs for all architectural decisions in `docs/adr/`
