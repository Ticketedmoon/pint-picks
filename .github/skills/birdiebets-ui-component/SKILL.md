# BirdieBets UI Component Skill

## When to Use

USE FOR: add component, UI change, leaderboard change, modal, button, card, table, pick cell, skeleton

## Repository Context

- **App:** BirdieBets - golf tournament betting tracker
- **Stack:** Next.js 16, React 19, Tailwind CSS 4
- **Components:** `src/components/`
- **Pages:** `src/app/` (all `"use client"`)
- **Writing style:** Never use em dashes.

## Key Source Locations

| Area | Location |
|---|---|
| Party leaderboard | `src/app/party/[partyId]/page.tsx` |
| Picks page | `src/app/party/[partyId]/picks/page.tsx` |
| Leaderboard cards (mobile) | `src/components/party/LeaderboardCards.tsx` |
| Leaderboard table (desktop) | `src/components/party/LeaderboardTable.tsx` |
| Pick cell (score display) | `src/components/party/PickCell.tsx` |
| Tournament modal | `src/components/party/TournamentLeaderboardModal.tsx` |
| Skeletons | `src/components/Skeletons.tsx` |
| Navbar | `src/components/Navbar.tsx` |
| Group editor | `src/components/GroupEditor.tsx` |
| Types | `src/types/index.ts` |

## Conventions

1. **Mobile-first**: design for mobile, then add `sm:` breakpoints for desktop
2. **Dynamic imports**: heavy components use `dynamic()` in page files:
   ```typescript
   const MyComponent = dynamic(() => import("@/components/MyComponent").then(m => ({ default: m.MyComponent })), { ssr: false });
   ```
3. **Color scheme**: green-800 headers, green-600 buttons, red for cuts, amber for caps, indigo for actions
4. **Modals**: use `role="dialog"`, `aria-modal="true"`, `aria-label`, auto-focus close button, Escape to close, body scroll lock
5. **Images**: use raw `<img>` for tiny external images (headshots, flags). Don't use `next/image` for these.
6. **Loading states**: use skeleton components from `src/components/Skeletons.tsx`, not spinners
7. **Badges**: rounded pills with colored backgrounds (CUT=red, CAP=amber, status=green)

## Workflow

1. If adding a type, update `src/types/index.ts`
2. Create/update component in `src/components/`
3. Import in page (use `dynamic()` for heavy components)
4. Test responsiveness on both mobile and desktop widths
5. Run `npm run test:coverage` after changes
