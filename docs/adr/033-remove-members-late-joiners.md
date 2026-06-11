# ADR 033: Remove Members and Late Joiner Unlock Flow

## Status
Accepted

## Date
2026-06-11

## Author
Shane Creedon

## Context
After a tournament starts and the party locks, two situations needed handling:

1. **Members who missed the deadline**: Some members join a party but never submit their picks before the tournament starts. The party owner had no way to clean up these "dead weight" entries from the leaderboard.

2. **Late joiners**: Someone wants to join after the tournament has started (e.g., a friend who forgot). The owner needs a way to invite them and let them submit picks despite the party being locked.

The existing email-based unlock system (ADR-020) relied on Resend email delivery, which proved unreliable in local development due to the server-side Firestore client SDK using gRPC (which drops connections intermittently on Node.js).

## What This ADR Covers

- Party owners can remove members who haven't submitted picks after the party locks
- Confirmation modal before removal to prevent accidental clicks
- Late joiner invite flow with contextual guidance for the owner
- Client-side unlock link generation (replacing server-side email-based flow)
- Unlock link copied to clipboard for sharing via WhatsApp, text, etc.
- Security model unchanged: token validation still happens server-side on pick submission

## Decisions

### D1: Remove is restricted to no-pick members on locked parties

The "Remove" button only appears when all of these are true:
- The viewer is the party owner (`user.uid === party.createdBy`)
- The party is locked (`party.status === "locked"`)
- The target member has not submitted picks (`!hasSubmitted`)
- The target is not the owner themselves (`!isOwnRow`)

This prevents owners from removing members who already have picks in play.

### D2: Reuse `leaveParty` for removal

Rather than creating a new `removeMember` function, the existing `leaveParty(partyId, uid)` function is reused. It already handles removing the UID from `memberUids` and deleting their picks subcollection. The owner simply calls it on behalf of the target member.

### D3: Client-side unlock link generation instead of email

The original ADR-020 flow used a server-side API route (`/api/send-pick-unlock`) to generate a token and send an email via Resend. This failed locally because the server-side Firestore client SDK's gRPC connection is unreliable on Node.js.

The new flow:
1. Owner clicks "🔓 Unlock picks" next to a member without picks
2. Client-side code calls `invalidatePreviousUnlocks` + `createPickUnlock` directly via the browser's Firestore connection (WebSocket, reliable)
3. The unlock URL is copied to the clipboard
4. Owner shares the link via any channel (WhatsApp, text, email, etc.)

Security is unchanged because:
- `POST /api/submit-unlocked-picks` still validates the token server-side before saving picks
- Tokens are UUID-based (unguessable), user-bound, single-use, and expire after 1 hour
- The token's `uid` must match the authenticated user opening the link

### D4: Late joiner UX with contextual guidance

When the party is locked, the invite form shows an amber banner explaining the two-step flow:
1. Invite the person (they join via code/link as normal)
2. Use "🔓 Unlock picks" to generate a time-limited link for them to submit picks

This guides the owner through the process without requiring documentation.

## Files Changed

| File | Change |
|------|--------|
| `src/app/party/[partyId]/page.tsx` | Added `handleRemoveMember`, `confirmRemoveMember`, confirmation modal, late joiner banner, client-side `handleSendUnlock` replacing API call |
| `src/components/party/LeaderboardCards.tsx` | Added `onRemoveMember`/`removingMember` props, remove button, updated unlock button label |
| `src/components/party/LeaderboardTable.tsx` | Added `onRemoveMember`/`removingMember` props, remove button, updated unlock button label |
| `src/app/api/generate-pick-unlock/route.ts` | Created then removed (superseded by client-side approach) |
| `src/app/api/send-pick-unlock/route.ts` | Added detailed error logging (kept for backward compatibility) |

## Related

- [ADR-006: Party System](./006-party-system.md)
- [ADR-020: Email-Based Pick Unlock](./020-email-pick-unlock.md) (superseded for unlock generation, submit route still used)
