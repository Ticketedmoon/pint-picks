# ADR-028: Firestore Security Rules

## Status
Accepted

## Date
2026-05-18

## Context
The app was running with default test-mode Firestore rules that allow anyone with the
Firebase config to read and write all data. Since the Firebase config is embedded in
the client-side JavaScript bundle (via NEXT_PUBLIC_* env vars), this means any user
could view all emails, modify other users' picks, or delete parties using the browser
console or a simple script.

The test-mode rules were set to expire on 2026-06-11, after which all client requests
would be denied entirely.

## Decision

### Rule structure
Security rules are defined in `firestore.rules` at the repo root. They follow the
principle of least privilege:

| Collection | Read | Write | Delete |
|-----------|------|-------|--------|
| `users/{uid}` | Any authenticated user | Own profile only | Never |
| `parties/{partyId}` | Any authenticated user | Creator: any field. Members: leave only (remove self from memberUids). Non-members: join by code (add self to memberUids). | Creator only |
| `parties/{partyId}/picks/{uid}` | Own picks always. Others' picks only when party is locked/complete. | Own picks (while member) | Creator only |
| `parties/{partyId}/pickUnlocks/{token}` | Party members | Creator creates, members update | Creator only |
| `parties/{partyId}/invites/{email}` | Party members | Creator only | Creator only |
| `analytics_general/{uid}` | Admin only | Any authenticated user | Never |
| `analytics_tournament/{docId}` | Admin only | Any authenticated user | Never |
| `major_notifications/{eventId}` | Authenticated | Create only | Never |

### Helper functions
- `isSignedIn()`: checks `request.auth != null`
- `isOwner(uid)`: checks `request.auth.uid == uid`
- `isPartyMember(partyId)`: checks uid is in the party's `memberUids` array
- `isPartyCreator(partyId)`: checks uid matches the party's `createdBy` field

### How to deploy
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Deploy rules: `firebase deploy --only firestore:rules`

Or copy the contents of `firestore.rules` into the Firebase Console > Firestore > Rules
editor and click Publish.

### Analytics admin access
The analytics dashboard access control is enforced in application code
(`NEXT_PUBLIC_ANALYTICS_ADMIN_EMAIL` check) rather than Firestore rules. The rules
allow any authenticated user to read analytics, which is acceptable since the data
contains only aggregated page views and anonymised usage patterns.

## Consequences

### Positive
- Data is protected from unauthorized access
- Users can only modify their own picks
- Only party creators can delete parties or send invites
- Analytics events are append-only (no tampering)

### Negative
- `isPartyMember` and `isPartyCreator` helpers use `get()` calls which count toward
  Firestore read quotas (one extra read per write operation that checks membership)
- Rules must be updated if the data model changes
