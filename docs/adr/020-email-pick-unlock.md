# ADR 020: Pick Unlock for Late Joiners

## Status

Superseded by [ADR-033](./033-remove-members-late-joiners.md)

## Context

When a tournament starts and the party transitions to "locked" status, members who haven't
submitted their picks are stuck - they can no longer access the picks page.

An earlier approach allowed the party owner to submit picks on behalf of members directly.
This raised trust and fairness concerns: the owner could manipulate another member's picks,
and there was no audit trail showing the member agreed to the selections.

## Decision

~~We replaced the "pick on behalf" approach with an **email-based unlock** system~~ (see update below):

### Original approach (email-based, now removed)

1. Owner clicks "Send unlock" button, which called a server-side API route to send an email via Resend
2. Email contained a time-limited unlock link
3. Member clicked the link and submitted picks
4. Picks were saved via a server-side API route that validated the token

### Current approach (client-side, ADR-033)

The email and server-side API routes were replaced with a fully client-side flow due to
Firestore client SDK gRPC connectivity issues on both localhost and Vercel serverless:

1. **Owner triggers**: When the party is locked, the owner sees a "🔓 Unlock picks" button
   next to members who haven't submitted picks.

2. **Link copied to clipboard**: Clicking the button generates a token client-side via the
   browser's Firestore connection (WebSocket, reliable), invalidates previous tokens, and
   copies the unlock URL to the clipboard. Owner shares it via WhatsApp, text, etc.

3. **Member submits their own picks**: The member clicks the link, sees a countdown timer,
   and submits their own selections. The owner cannot see or influence the picks.

4. **One-time use**: The unlock token is marked as used atomically when picks are saved
   (via a Firestore batch write). Previous unused tokens for the same member are invalidated
   when a new one is generated.

## Implementation Details

### Firestore Structure

Unlock tokens are stored at `parties/{partyId}/pickUnlocks/{token}`:

```typescript
interface PickUnlock {
  uid: string;           // member being granted access
  createdAt: string;     // ISO timestamp
  expiresAt: string;     // ISO timestamp (1 hour from creation)
  used: boolean;
  usedAt?: string;       // ISO timestamp when picks were saved
  createdBy: string;     // party owner UID
}
```

### Security

- Tokens are UUIDs (unguessable)
- Token is validated client-side on page load (UID match, expiry, single-use)
- `savePicksWithUnlock` atomically saves picks and marks token used in one batch write
- Token must match the authenticated user's UID
- Token expires after 1 hour and is single-use
- Previous tokens are invalidated when a new one is generated
- Firestore security rules restrict picks writes to members, pickUnlock creation to creator

### Firestore Rules

- Creator can delete picks and pickUnlocks (needed for party deletion and member removal)
- `allow delete: if isSignedIn() && isPartyCreator(partyId)` on both subcollections

## Consequences

- **Positive**: Owner controls access timing but cannot influence pick selections
- **Positive**: Full audit trail via Firestore unlock documents
- **Positive**: Member retains agency over their own picks
- **Positive**: No dependency on email delivery (Resend) or server-side Firestore gRPC
- **Positive**: Owner can share link via any channel (WhatsApp, text, in person, etc.)
- **Negative**: Owner must manually share the link (not automated)
