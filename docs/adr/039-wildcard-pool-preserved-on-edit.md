# ADR 039: Preserve the Wildcard Pool When Editing Player Groups

## Status
Accepted

## Date
2026-07-14

## Author
Shane Creedon

## Context
On the party-creation page, the `GroupEditor` lets a creator move players between the four groups (A/B/C/D) and a Wildcard Pool. When the creator first opened the editor the pool was fully populated, but after clicking "Confirm Groups" and then re-opening via "Edit", the Wildcard Pool showed **(0)**. Well-known players who sit outside the top groups (for example wildcard-tier golfers) appeared to vanish.

The cause was twofold:

1. `GroupEditor`'s "Confirm Groups" button called `onSave(editGroups)`, passing back only the A/B/C/D groups and discarding the wildcard pool it was tracking internally.
2. The golf create page then rendered the editor with `wildcards={customGroups ? [] : defaultWildcards}`. Once `customGroups` was set (after the first confirm), the pool was hard-coded to `[]` on every re-edit.

The final persisted party was still correct because golf recomputes wildcards on submit as "field minus grouped", so this was a display / re-edit bug rather than data loss, but it was confusing and made the editor look broken.

## What This ADR Covers

- `GroupEditor.onSave` now returns `(groups, wildcards)` so the wildcard pool survives a confirm
- Golf create page stores `customWildcards` and feeds it back on re-edit (`customWildcards ?? defaultWildcards`), so the pool persists across edit/confirm cycles
- `customWildcards` is reset alongside `customGroups` when the selected tournament changes
- Football is unaffected: its editor always renders the full ranked pool from `rankingsToGroupItems()`, and its fewer-parameter `handleGroupsSave` stays assignable to the widened `onSave` type

## Decisions

### D1: Return the pool from the editor instead of recomputing in the parent
The editor already owns the authoritative pool state, so the simplest correct fix is to hand it back on save. The parent no longer has to guess the pool from `customGroups`.

### D2: Keep golf's submit-time recompute as-is
On submit, golf still computes wildcards from the frozen field snapshot minus grouped ids. That is robust against any drift and already produced correct data, so it is left unchanged. The new `customWildcards` state is used for the editor display, not to replace the snapshot logic.

### D3: Leave football alone
Football's editor invocation always uses the full ranked pool for display and recomputes wildcards from `customGroups` on submit, so it never exhibited the empty-pool bug. Changing it would risk logo-loss on re-edit (custom groups store `PickItem` without logos), which is out of scope here.

## Files Changed

| File | Change |
|------|--------|
| `src/components/GroupEditor.tsx` | `onSave` signature widened to `(groups, wildcards)`; Confirm button passes `pool` |
| `src/app/party/create/page.tsx` | Golf: added `customWildcards` state, preserved it in `handleGroupsSave`, fed it back to the editor, and reset it on tournament change |

## Related

- ADR 016: Custom group assignment
- ADR 015: Field-filtered groups
- ADR 007: OWGR dynamic groups
- ADR 036: Rankings field diacritic match (accented player names)
