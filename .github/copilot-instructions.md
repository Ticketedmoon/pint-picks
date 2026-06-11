# Copilot Instructions for PintPicks

## Firestore

- **Client SDK only**: This app uses `firebase/firestore` (client SDK) everywhere, including in API routes. There is no Firebase Admin SDK.
- **Server-side gRPC is unreliable**: The client SDK uses gRPC on Node.js (API routes, serverless), which drops connections. Prefer client-side Firestore calls (browser WebSocket) over server-side API routes when possible.
- **Security boundary is Firestore rules + atomic writes**, not server-side API validation. If Firestore rules enforce access control and batch writes ensure atomicity, client-side operations are safe.
- **Rules must be deployed separately**: Code changes to `firestore.rules` require `npx firebase deploy --only firestore:rules` in addition to pushing code. Always deploy rules before pushing code that depends on them.
- **Subcollection cleanup**: When deleting parent documents (e.g., parties), all subcollections (picks, invites, pickUnlocks) must be deleted first. Firestore does not cascade deletes.
- **Always surface error details**: API route catch blocks should return `{ error: "...", detail: message }` so the client can display actionable errors, not generic "something failed" messages.

## Git & Deployment Workflow

- **Respect explicit push instructions**: When the user says "commit but don't push" or "don't push", obey exactly. Only push when explicitly told to.
- **Let the user test locally first**: After making changes, confirm the dev server is running and let the user verify before committing. Don't rush to commit.
- **Vercel auto-deploys on push to main**: Every push triggers a production deployment. Be deliberate about what gets pushed.
- **Firestore rules deploy independently**: Push code and deploy rules as separate steps. Rules go live immediately via Firebase CLI; code goes live after Vercel build (~2 min).

## ADRs

- **Update ADRs after every feature or significant change**, not in batches.
- When a feature supersedes a previous ADR, update the old ADR's status to "Superseded by [ADR-XXX]".
- Include a "Files Changed" table and "Related" links section in every ADR.

## Destructive Actions

- **Typed confirmation for destructive actions on active data**: Deleting parties, removing members, or other irreversible actions on locked/complete parties require the user to type "DELETE" before the button enables.
- **Simple confirmation is fine for pre-tournament data**: When the party is still in "picking" status, a two-click confirm is sufficient.

## Feature Development Pattern

1. Implement the feature
2. Run `npm run build` to verify compilation
3. Run `npm run test:coverage` to verify tests pass and coverage holds
4. Start dev server (`npm run dev`) for user to test locally
5. Wait for user approval before committing
6. Write/update ADR
7. Commit (with or without push, per user instruction)
