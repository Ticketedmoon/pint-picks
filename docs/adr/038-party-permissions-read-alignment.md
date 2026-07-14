# ADR 038: Align Party Client Reads with Tightened Picks Rules (Create / View / Delete Permissions)

## Status
Accepted

## Date
2026-07-14

## Author
Shane Creedon

## Context
Users started hitting "Missing or insufficient permissions" when viewing a party, creating a party, and deleting a party while the party was still in `picking` status. This affected everyone, including the party creator, and reproduced on a freshly signed-in account, so it was a Firestore rules problem, not a stale auth token.

The root cause was commit `e2de8eb`, which tightened the picks-read rule (anti-cheat) so that non-owners can only read another member's picks once the party is `locked` or `complete`. The client code, however, still performed **unconstrained list reads** over the picks subcollection:

- The party page called `getAllPicksForParty` (`getDocs` over the whole `picks` subcollection) to build the leaderboard.
- `deleteParty` listed the `picks` subcollection to delete each doc.

Firestore denies an unconstrained collection `list` unless the rule allows **every** matched document. Because the tightened rule only allows a member's own pick (per-doc) or all picks when `locked`/`complete`, any unconstrained picks list fails during `picking` status. That single denial surfaced as the generic permissions error across view, create-then-view, and delete.

## What This ADR Covers

- Party page now fetches only the current user's own pick before lock, and all picks (with a fallback) once the party is `locked`/`complete`, so it never issues a denied list read during `picking`
- `syncPartyStatus` writes and validation are gated behind a new `canPersist` option so only the creator attempts the reads/writes that the rules restrict; non-creators compute status in memory only
- `deleteParty` deletes each member's pick **by UID** instead of listing the subcollection, so no denied list read is needed to tear a party down
- Added `isPartyCreator(partyId)` to the picks-read rule so the creator can read all picks for lock-time validation regardless of status
- All callers (`party/[partyId]/page.tsx`, `party/[partyId]/picks/page.tsx`, `dashboard/page.tsx`) updated to pass `canPersist` / `memberUids`

## Decisions

### D1: Read only what the rules allow, rather than loosening the rules
The anti-cheat guarantee (members cannot read each other's picks before lock) is intentional. Instead of relaxing it, the client now reads only the current user's pick pre-lock, so the app aligns with the rule rather than fighting it.

### D2: Gate persistence behind `canPersist` (creator-only)
Only the creator can write the party doc and (after the rule change) read all picks for validation. Non-creators still see live status transitions computed in memory, but skip the reads/writes the rules deny. `canPersist` defaults to `true` to preserve existing `syncPartyStatus` behaviour and test expectations.

### D3: Delete picks by known UID, not by listing
Every member's pick doc id is derivable from their UID (`memberUids`), so `deleteParty` deletes them directly. This avoids the denied `list` entirely and works against the **currently deployed** rules with no rules deploy required. Invites and pickUnlocks are still listed because those reads are permitted for the creator.

### D4: Add `isPartyCreator` to the picks-read rule
So the creator can perform lock-time validation (which needs all picks) even before the party is `locked`. This is the only change that requires a rules deploy, and it only matters once a tournament actually starts.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/firestore.ts` | `deleteParty(partyId, memberUids=[])` deletes picks by UID; lists/deletes invites + pickUnlocks; deletes party doc |
| `src/lib/partySync.ts` | `syncPartyStatus(party, options={canPersist=true, authToken})`; gates validation + writes behind `canPersist` |
| `src/app/party/[partyId]/page.tsx` | New `fetchVisiblePicks` (own pick pre-lock, all picks post-lock with fallback); both `syncPartyStatus` calls pass `canPersist`; `deleteParty` passes `memberUids` |
| `src/app/party/[partyId]/picks/page.tsx` | Both `syncPartyStatus` calls pass `canPersist` |
| `src/app/dashboard/page.tsx` | `handleDelete` looks up `memberUids` from state and passes to `deleteParty` |
| `firestore.rules` | Picks-read rule adds `|| isPartyCreator(partyId)` (needs separate deploy) |
| `src/__tests__/partySync.test.ts` | Added `canPersist=false` tests |
| `src/__tests__/firestore.test.ts` | Rewrote `deleteParty` tests (delete by UID) |

## Deployment Notes

- The party-page and `deleteParty` client fixes work against the **currently deployed** rules (they avoid the denied list) so they resolve the outage immediately on push.
- The `isPartyCreator` picks-read addition requires `npx firebase deploy --only firestore:rules`. It only affects lock-time validation, so it must be live before the Open Championship starts (2026-07-16).

## Known Limitations

Orphan pick docs from members removed while a party was `locked` are not in `memberUids` and so are not deleted by `deleteParty`. `leaveParty` already deletes a member's pick on leave, so normal flows are covered; member removal only happens post-lock. Accepted as low risk.

## Related

- Commit `e2de8eb`: tightened picks-read rule (anti-cheat)
- ADR 033: Remove members / late joiners
- ADR 018: Field validation gate
