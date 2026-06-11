# ADR 031: Party Name Rename by Owner Before Tournament Start

## Status
Accepted

## Date
2026-06-11

## Author
Shane Creedon

## Context
Party owners had no way to fix a typo or change the party name after creation. The only option was to delete the party and recreate it, losing all members and picks. This was frustrating when a party was created early and the owner wanted to update the name closer to the tournament.

## What This ADR Covers

- Inline editable party name on the party detail page
- Only the party creator can rename, and only while status is "picking" (before tournament start)
- Pencil icon revealed on hover, keeping the UI clean for non-owners
- Keyboard support: Enter to save, Escape to cancel
- 60-character max length with whitespace trimming
- No-op when the name is unchanged (avoids unnecessary Firestore writes)

## Decisions

### D1: Inline editing over a modal or settings page

An inline edit (click pencil, type, confirm) was chosen over a separate "party settings" page or modal. Reasons:
- The party name is the only editable field currently, so a settings page would be overkill
- Inline editing gives immediate visual feedback: what you see is what you get
- If more editable fields are added later, a settings page can be introduced and the inline edit removed

### D2: Owner-only, picking-status-only guard

The rename button is only rendered when `user.uid === party.createdBy && party.status === "picking"`. This is a client-side guard. The Firestore security rules already restrict party updates to members (line 41-49 of `firestore.rules`), and the owner is always a member, so no rule changes were needed.

Once the tournament starts and the party transitions to "locked" or "complete", the name becomes immutable. This prevents confusion if someone renames a party mid-tournament.

### D3: Hover-reveal pencil icon

The edit icon uses `opacity-0 group-hover:opacity-100 focus:opacity-100` so it stays hidden until the user hovers over the title area. This keeps the UI clean for members who cannot edit, and avoids visual clutter for the owner on initial load. The `focus:opacity-100` ensures keyboard-only users can still discover the button.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/firestore.ts` | Added `updatePartyName(partyId, name)` function |
| `src/app/party/[partyId]/page.tsx` | Added `editingName`/`editedName`/`savingName` state, `handleRenameParty` handler, replaced static `<h1>` with inline-editable version for owner during picking status |
