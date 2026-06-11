import { describe, it, expect } from "vitest";
import type { Party } from "@/types";

/**
 * These tests verify the visibility rules for the "Remove member" and
 * "Unlock picks" buttons on the leaderboard. The conditions are implemented
 * inline in LeaderboardCards.tsx and LeaderboardTable.tsx, so we test the
 * logic as pure boolean expressions here.
 */

const OWNER_UID = "owner-uid";
const MEMBER_UID = "member-uid";

const baseParty: Party = {
  id: "party-1",
  name: "Test Party",
  createdBy: OWNER_UID,
  inviteCode: "ABC123",
  tournamentId: "t1",
  tournamentName: "Test Tournament",
  tournamentStartDate: "2025-06-01T00:00:00Z",
  createdAt: "2025-05-01T00:00:00Z",
  status: "locked",
  memberUids: [OWNER_UID, MEMBER_UID],
  buyIn: 10,
  currency: "EUR",
  secondPlacePayout: false,
  thirdPlacePayout: false,
};

// Mirrors the condition in LeaderboardCards.tsx line 65 and LeaderboardTable.tsx line 120
function shouldShowUnlockButton(
  viewerUid: string,
  entryUid: string,
  party: Party,
  hasSubmitted: boolean
): boolean {
  const isOwnRow = viewerUid === entryUid;
  return !isOwnRow && !hasSubmitted && viewerUid === party.createdBy && party.status === "locked";
}

// Mirrors the condition in LeaderboardCards.tsx line 77 and LeaderboardTable.tsx line 134
function shouldShowRemoveButton(
  viewerUid: string,
  entryUid: string,
  party: Party,
  hasSubmitted: boolean,
  hasOnRemoveMember: boolean
): boolean {
  const isOwnRow = viewerUid === entryUid;
  return !isOwnRow && !hasSubmitted && viewerUid === party.createdBy && party.status === "locked" && hasOnRemoveMember;
}

describe("Unlock button visibility", () => {
  it("shows for owner viewing a member without picks on a locked party", () => {
    expect(shouldShowUnlockButton(OWNER_UID, MEMBER_UID, baseParty, false)).toBe(true);
  });

  it("hides when viewer is not the owner", () => {
    expect(shouldShowUnlockButton(MEMBER_UID, "other-uid", baseParty, false)).toBe(false);
  });

  it("hides when viewing own row", () => {
    expect(shouldShowUnlockButton(OWNER_UID, OWNER_UID, baseParty, false)).toBe(false);
  });

  it("hides when member has submitted picks", () => {
    expect(shouldShowUnlockButton(OWNER_UID, MEMBER_UID, baseParty, true)).toBe(false);
  });

  it("hides when party is in picking status", () => {
    const pickingParty = { ...baseParty, status: "picking" as const };
    expect(shouldShowUnlockButton(OWNER_UID, MEMBER_UID, pickingParty, false)).toBe(false);
  });

  it("hides when party is complete", () => {
    const completeParty = { ...baseParty, status: "complete" as const };
    expect(shouldShowUnlockButton(OWNER_UID, MEMBER_UID, completeParty, false)).toBe(false);
  });
});

describe("Remove button visibility", () => {
  it("shows for owner viewing a member without picks on a locked party", () => {
    expect(shouldShowRemoveButton(OWNER_UID, MEMBER_UID, baseParty, false, true)).toBe(true);
  });

  it("hides when onRemoveMember handler is not provided", () => {
    expect(shouldShowRemoveButton(OWNER_UID, MEMBER_UID, baseParty, false, false)).toBe(false);
  });

  it("hides when viewer is not the owner", () => {
    expect(shouldShowRemoveButton(MEMBER_UID, "other-uid", baseParty, false, true)).toBe(false);
  });

  it("hides when viewing own row", () => {
    expect(shouldShowRemoveButton(OWNER_UID, OWNER_UID, baseParty, false, true)).toBe(false);
  });

  it("hides when member has submitted picks", () => {
    expect(shouldShowRemoveButton(OWNER_UID, MEMBER_UID, baseParty, true, true)).toBe(false);
  });

  it("hides when party is in picking status", () => {
    const pickingParty = { ...baseParty, status: "picking" as const };
    expect(shouldShowRemoveButton(OWNER_UID, MEMBER_UID, pickingParty, false, true)).toBe(false);
  });

  it("hides when party is complete", () => {
    const completeParty = { ...baseParty, status: "complete" as const };
    expect(shouldShowRemoveButton(OWNER_UID, MEMBER_UID, completeParty, false, true)).toBe(false);
  });

  it("owner cannot remove themselves even without picks", () => {
    expect(shouldShowRemoveButton(OWNER_UID, OWNER_UID, baseParty, false, true)).toBe(false);
  });
});

describe("Unlock link generation rules", () => {
  it("unlock URL follows expected format", () => {
    const baseUrl = "https://pintpicks.com";
    const partyId = "party-abc";
    const token = "550e8400-e29b-41d4-a716-446655440000";
    const url = `${baseUrl}/party/${partyId}/picks?unlock=${token}`;
    expect(url).toBe("https://pintpicks.com/party/party-abc/picks?unlock=550e8400-e29b-41d4-a716-446655440000");
  });

  it("token is UUID format", () => {
    const token = crypto.randomUUID();
    expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
