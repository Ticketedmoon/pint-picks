import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Firebase SDK ───
const mockSetDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockWriteBatch = vi.fn();
const mockDoc = vi.fn((...args: unknown[]) => args.join("/"));
const mockCollection = vi.fn((...args: unknown[]) => args.join("/"));
const mockQuery = vi.fn((...args: unknown[]) => args);
const mockWhere = vi.fn((...args: unknown[]) => args);
const mockArrayUnion = vi.fn((val: unknown) => ({ _arrayUnion: val }));
const mockArrayRemove = vi.fn((val: unknown) => ({ _arrayRemove: val }));

const batchOps = { set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit: vi.fn() };

vi.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  arrayUnion: (val: unknown) => mockArrayUnion(val),
  arrayRemove: (val: unknown) => mockArrayRemove(val),
  Timestamp: { now: () => ({ seconds: Date.now() / 1000, nanoseconds: 0 }) },
  writeBatch: () => {
    mockWriteBatch();
    return batchOps;
  },
}));

vi.mock("@/lib/firebase", () => ({
  getFirebaseDb: () => "mock-db",
}));

import {
  createParty,
  getParty,
  getPartiesForUser,
  getAllParties,
  joinPartyByCode,
  leaveParty,
  updatePartyStatus,
  updatePartyName,
  updatePartyInvalidPicks,
  clearPartyInvalidPicks,
  updatePartyLastNotified,
  getUserEmail,
  deleteParty,
  hasIncompleteOrNoPicks,
  savePicks,
  getPicks,
  getAllPicksForParty,
  createPickUnlock,
  getPickUnlock,
  invalidatePreviousUnlocks,
  savePicksWithUnlock,
  addInvites,
  getUserDisplayName,
  getUsersInfo,
} from "@/lib/firestore";
import type { Picks } from "@/types";

beforeEach(() => {
  vi.clearAllMocks();
  batchOps.set.mockClear();
  batchOps.update.mockClear();
  batchOps.delete.mockClear();
  batchOps.commit.mockClear();
});

// ─── Helper ───
function mockSnap(exists: boolean, data: Record<string, unknown> = {}, id = "doc1") {
  return { exists: () => exists, data: () => data, id, ref: `ref-${id}` };
}

function mockQuerySnap(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    empty: docs.length === 0,
    docs: docs.map((d) => ({
      id: d.id,
      data: () => d.data,
      ref: `ref-${d.id}`,
    })),
  };
}

// ─── createParty ───
describe("createParty", () => {
  it("creates a party with valid inputs", async () => {
    mockSetDoc.mockResolvedValue(undefined);
    const party = await createParty("My Party", "user1", "t1", "Masters", "2025-04-10");
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(party.name).toBe("My Party");
    expect(party.createdBy).toBe("user1");
    expect(party.status).toBe("picking");
    expect(party.memberUids).toEqual(["user1"]);
    expect(party.inviteCode).toHaveLength(6);
    expect(party.sportType).toBe("golf");
  });

  it("trims the party name", async () => {
    mockSetDoc.mockResolvedValue(undefined);
    const party = await createParty("  Padded Name  ", "u1", "t1", "T", "2025-01-01");
    expect(party.name).toBe("Padded Name");
  });

  it("rejects empty name", async () => {
    await expect(createParty("", "u1", "t1", "T", "2025-01-01")).rejects.toThrow("Party name must be 1-60 characters");
  });

  it("rejects name over 60 chars", async () => {
    const longName = "x".repeat(61);
    await expect(createParty(longName, "u1", "t1", "T", "2025-01-01")).rejects.toThrow("Party name must be 1-60 characters");
  });

  it("rejects missing createdBy", async () => {
    await expect(createParty("Name", "", "t1", "T", "2025-01-01")).rejects.toThrow("Missing createdBy");
  });

  it("rejects missing tournamentId", async () => {
    await expect(createParty("Name", "u1", "", "T", "2025-01-01")).rejects.toThrow("Missing tournamentId");
  });

  it("rejects negative buy-in", async () => {
    await expect(createParty("Name", "u1", "t1", "T", "2025-01-01", -5)).rejects.toThrow("Buy-in must be between 0 and 10,000");
  });

  it("rejects buy-in over 10000", async () => {
    await expect(createParty("Name", "u1", "t1", "T", "2025-01-01", 20000)).rejects.toThrow("Buy-in must be between 0 and 10,000");
  });

  it("includes optional fields when provided", async () => {
    mockSetDoc.mockResolvedValue(undefined);
    const party = await createParty(
      "Football Party", "u1", "t1", "Euros", "2025-06-01",
      20, "GBP", true, true, undefined, undefined,
      "football", "eng.1",
      { first: 50, second: 30, third: 20 },
      [{ id: "furthest_team", label: "Furthest team", description: "" }]
    );
    expect(party.sportType).toBe("football");
    expect(party.leagueSlug).toBe("eng.1");
    expect(party.payoutSplit).toEqual({ first: 50, second: 30, third: 20 });
    expect(party.tiebreakerRules).toHaveLength(1);
  });
});

// ─── getParty ───
describe("getParty", () => {
  it("returns party when doc exists with valid data", async () => {
    mockGetDoc.mockResolvedValue(mockSnap(true, {
      createdBy: "u1", inviteCode: "ABC123", memberUids: ["u1"],
      name: "Test", status: "picking",
    }, "p1"));
    const party = await getParty("p1");
    expect(party).not.toBeNull();
    expect(party!.id).toBe("p1");
    expect(party!.createdBy).toBe("u1");
  });

  it("returns null when doc does not exist", async () => {
    mockGetDoc.mockResolvedValue(mockSnap(false));
    expect(await getParty("missing")).toBeNull();
  });

  it("returns null when critical fields are missing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockGetDoc.mockResolvedValue(mockSnap(true, { name: "Bad" }, "bad"));
    expect(await getParty("bad")).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ─── getPartiesForUser / getAllParties ───
describe("getPartiesForUser", () => {
  it("returns mapped parties", async () => {
    mockGetDocs.mockResolvedValue(mockQuerySnap([
      { id: "p1", data: { name: "Party 1", createdBy: "u1" } },
      { id: "p2", data: { name: "Party 2", createdBy: "u2" } },
    ]));
    const parties = await getPartiesForUser("u1");
    expect(parties).toHaveLength(2);
    expect(parties[0].id).toBe("p1");
  });
});

describe("getAllParties", () => {
  it("returns all parties", async () => {
    mockGetDocs.mockResolvedValue(mockQuerySnap([
      { id: "p1", data: { name: "A" } },
    ]));
    const parties = await getAllParties();
    expect(parties).toHaveLength(1);
  });
});

// ─── joinPartyByCode ───
describe("joinPartyByCode", () => {
  it("returns null when no party matches code", async () => {
    mockGetDocs.mockResolvedValue(mockQuerySnap([]));
    expect(await joinPartyByCode("BADCODE", "u1")).toBeNull();
  });

  it("returns party without update when already a member", async () => {
    mockGetDocs.mockResolvedValue(mockQuerySnap([
      { id: "p1", data: { name: "Test", memberUids: ["u1"], inviteCode: "ABC123" } },
    ]));
    const party = await joinPartyByCode("abc123", "u1");
    expect(party).not.toBeNull();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it("adds new member to party", async () => {
    mockGetDocs.mockResolvedValue(mockQuerySnap([
      { id: "p1", data: { name: "Test", memberUids: ["u1"], inviteCode: "ABC123" } },
    ]));
    mockUpdateDoc.mockResolvedValue(undefined);
    const party = await joinPartyByCode("ABC123", "u2");
    expect(party).not.toBeNull();
    expect(party!.memberUids).toContain("u2");
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
  });
});

// ─── leaveParty ───
describe("leaveParty", () => {
  it("deletes picks first then removes from memberUids", async () => {
    const callOrder: string[] = [];
    mockGetDoc.mockResolvedValue(mockSnap(true, {}));
    mockDeleteDoc.mockImplementation(async () => { callOrder.push("delete"); });
    mockUpdateDoc.mockImplementation(async () => { callOrder.push("update"); });

    await leaveParty("p1", "u1");
    expect(callOrder).toEqual(["delete", "update"]);
  });

  it("skips pick deletion when no picks exist", async () => {
    mockGetDoc.mockResolvedValue(mockSnap(false));
    mockUpdateDoc.mockResolvedValue(undefined);

    await leaveParty("p1", "u1");
    expect(mockDeleteDoc).not.toHaveBeenCalled();
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
  });
});

// ─── updatePartyStatus / updatePartyName ───
describe("update functions", () => {
  it("updatePartyStatus calls updateDoc", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await updatePartyStatus("p1", "locked");
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { status: "locked" });
  });

  it("updatePartyName calls updateDoc", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await updatePartyName("p1", "New Name");
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { name: "New Name" });
  });

  it("updatePartyInvalidPicks calls updateDoc", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await updatePartyInvalidPicks("p1", []);
    expect(mockUpdateDoc).toHaveBeenCalled();
  });

  it("clearPartyInvalidPicks resets fields", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await clearPartyInvalidPicks("p1");
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), {
      invalidPicks: [],
      lastInvalidNotifiedAt: null,
    });
  });

  it("updatePartyLastNotified sets timestamp", async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await updatePartyLastNotified("p1");
    expect(mockUpdateDoc).toHaveBeenCalled();
    const arg = mockUpdateDoc.mock.calls[0][1];
    expect(arg.lastInvalidNotifiedAt).toBeTruthy();
  });
});

// ─── getUserEmail ───
describe("getUserEmail", () => {
  it("returns email when user exists", async () => {
    mockGetDoc.mockResolvedValue(mockSnap(true, { email: "a@b.com" }));
    expect(await getUserEmail("u1")).toBe("a@b.com");
  });

  it("returns null when user has no email", async () => {
    mockGetDoc.mockResolvedValue(mockSnap(true, {}));
    expect(await getUserEmail("u1")).toBeNull();
  });

  it("returns null when user does not exist", async () => {
    mockGetDoc.mockResolvedValue(mockSnap(false));
    expect(await getUserEmail("u1")).toBeNull();
  });
});

// ─── deleteParty ───
describe("deleteParty", () => {
  it("deletes subcollections and party in a batch", async () => {
    mockGetDocs
      .mockResolvedValueOnce(mockQuerySnap([{ id: "pick1", data: {} }]))
      .mockResolvedValueOnce(mockQuerySnap([{ id: "inv1", data: {} }]))
      .mockResolvedValueOnce(mockQuerySnap([]));
    batchOps.commit.mockResolvedValue(undefined);

    await deleteParty("p1");
    expect(batchOps.delete).toHaveBeenCalledTimes(3); // 1 pick + 1 invite + party doc
    expect(batchOps.commit).toHaveBeenCalledTimes(1);
  });
});

// ─── hasIncompleteOrNoPicks ───
describe("hasIncompleteOrNoPicks", () => {
  const full: Picks = {
    groupA: { playerId: "1", playerName: "A" },
    groupB: { playerId: "2", playerName: "B" },
    groupC: { playerId: "3", playerName: "C" },
    groupD: { playerId: "4", playerName: "D" },
    wildcard1: { playerId: "5", playerName: "E" },
    wildcard2: { playerId: "6", playerName: "F" },
  };

  it("returns true for null", () => {
    expect(hasIncompleteOrNoPicks(null)).toBe(true);
  });

  it("returns false for complete picks", () => {
    expect(hasIncompleteOrNoPicks(full)).toBe(false);
  });

  it("returns true when a slot is missing", () => {
    expect(hasIncompleteOrNoPicks({ ...full, groupA: null })).toBe(true);
  });
});

// ─── savePicks / getPicks / getAllPicksForParty ───
describe("picks CRUD", () => {
  it("savePicks calls setDoc with lockedAt", async () => {
    mockSetDoc.mockResolvedValue(undefined);
    const picks = {
      groupA: { playerId: "1", playerName: "A" },
      groupB: null, groupC: null, groupD: null,
      wildcard1: null, wildcard2: null,
    } as Picks;
    await savePicks("p1", "u1", picks);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const saved = mockSetDoc.mock.calls[0][1];
    expect(saved.lockedAt).toBeTruthy();
  });

  it("getPicks returns null when not found", async () => {
    mockGetDoc.mockResolvedValue(mockSnap(false));
    expect(await getPicks("p1", "u1")).toBeNull();
  });

  it("getPicks returns data when found", async () => {
    mockGetDoc.mockResolvedValue(mockSnap(true, { groupA: { playerId: "1" } }));
    const picks = await getPicks("p1", "u1");
    expect(picks).not.toBeNull();
  });

  it("getAllPicksForParty returns keyed results", async () => {
    mockGetDocs.mockResolvedValue(mockQuerySnap([
      { id: "u1", data: { groupA: { playerId: "1" } } },
      { id: "u2", data: { groupA: { playerId: "2" } } },
    ]));
    const result = await getAllPicksForParty("p1");
    expect(Object.keys(result)).toEqual(["u1", "u2"]);
  });
});

// ─── createPickUnlock / getPickUnlock ───
describe("pick unlocks", () => {
  it("createPickUnlock creates a 1-hour token", async () => {
    mockSetDoc.mockResolvedValue(undefined);
    const unlock = await createPickUnlock("p1", "token123", "u1", "owner1");
    expect(unlock.uid).toBe("u1");
    expect(unlock.used).toBe(false);
    expect(unlock.createdBy).toBe("owner1");
    const expiryMs = new Date(unlock.expiresAt).getTime() - new Date(unlock.createdAt).getTime();
    expect(expiryMs).toBe(3600000); // 1 hour
  });

  it("getPickUnlock returns null when not found", async () => {
    mockGetDoc.mockResolvedValue(mockSnap(false));
    expect(await getPickUnlock("p1", "bad-token")).toBeNull();
  });
});

// ─── invalidatePreviousUnlocks ───
describe("invalidatePreviousUnlocks", () => {
  it("skips commit when no unlocks exist", async () => {
    mockGetDocs.mockResolvedValue(mockQuerySnap([]));
    await invalidatePreviousUnlocks("p1", "u1");
    expect(batchOps.commit).not.toHaveBeenCalled();
  });

  it("marks existing unlocks as used", async () => {
    mockGetDocs.mockResolvedValue(mockQuerySnap([
      { id: "t1", data: { uid: "u1", used: false } },
    ]));
    batchOps.commit.mockResolvedValue(undefined);
    await invalidatePreviousUnlocks("p1", "u1");
    expect(batchOps.update).toHaveBeenCalledTimes(1);
    expect(batchOps.commit).toHaveBeenCalledTimes(1);
  });
});

// ─── savePicksWithUnlock ───
describe("savePicksWithUnlock", () => {
  const validPicks: Picks = {
    groupA: { playerId: "1", playerName: "A" },
    groupB: { playerId: "2", playerName: "B" },
    groupC: { playerId: "3", playerName: "C" },
    groupD: { playerId: "4", playerName: "D" },
    wildcard1: { playerId: "5", playerName: "E" },
    wildcard2: { playerId: "6", playerName: "F" },
  };

  it("rejects invalid token", async () => {
    mockGetDoc.mockResolvedValue(mockSnap(false));
    await expect(savePicksWithUnlock("p1", "u1", validPicks, "bad"))
      .rejects.toThrow("Invalid unlock token");
  });

  it("rejects token for wrong user", async () => {
    mockGetDoc.mockResolvedValue(mockSnap(true, {
      uid: "other-user", used: false, expiresAt: new Date(Date.now() + 60000).toISOString(),
    }));
    await expect(savePicksWithUnlock("p1", "u1", validPicks, "token1"))
      .rejects.toThrow("not for your account");
  });

  it("rejects already-used token", async () => {
    mockGetDoc.mockResolvedValue(mockSnap(true, {
      uid: "u1", used: true, expiresAt: new Date(Date.now() + 60000).toISOString(),
    }));
    await expect(savePicksWithUnlock("p1", "u1", validPicks, "token1"))
      .rejects.toThrow("already been used");
  });

  it("rejects expired token", async () => {
    mockGetDoc.mockResolvedValue(mockSnap(true, {
      uid: "u1", used: false, expiresAt: new Date(Date.now() - 60000).toISOString(),
    }));
    await expect(savePicksWithUnlock("p1", "u1", validPicks, "token1"))
      .rejects.toThrow("expired");
  });

  it("saves picks and marks token used for valid token", async () => {
    mockGetDoc.mockResolvedValue(mockSnap(true, {
      uid: "u1", used: false, expiresAt: new Date(Date.now() + 60000).toISOString(),
    }));
    batchOps.commit.mockResolvedValue(undefined);

    await savePicksWithUnlock("p1", "u1", validPicks, "token1");
    expect(batchOps.set).toHaveBeenCalledTimes(1);
    expect(batchOps.update).toHaveBeenCalledTimes(1);
    expect(batchOps.commit).toHaveBeenCalledTimes(1);
  });
});

// ─── addInvites ───
describe("addInvites", () => {
  it("normalises emails and stores them", async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await addInvites("p1", ["  A@B.COM  ", "c@d.com", ""], "u1");
    expect(mockSetDoc).toHaveBeenCalledTimes(2); // skips empty
    expect(mockSetDoc.mock.calls[0][1].email).toBe("a@b.com");
  });
});

// ─── getUserDisplayName ───
describe("getUserDisplayName", () => {
  it("returns display name", async () => {
    mockGetDoc.mockResolvedValue(mockSnap(true, { displayName: "Shane" }));
    expect(await getUserDisplayName("u1")).toBe("Shane");
  });

  it("returns Unknown for missing user", async () => {
    mockGetDoc.mockResolvedValue(mockSnap(false));
    expect(await getUserDisplayName("u1")).toBe("Unknown");
  });

  it("returns Unknown when displayName is empty", async () => {
    mockGetDoc.mockResolvedValue(mockSnap(true, { displayName: "" }));
    expect(await getUserDisplayName("u1")).toBe("Unknown");
  });
});

// ─── getUsersInfo ───
describe("getUsersInfo", () => {
  it("fetches all users in parallel", async () => {
    mockGetDoc
      .mockResolvedValueOnce(mockSnap(true, { displayName: "A", photoURL: "url1" }))
      .mockResolvedValueOnce(mockSnap(false));

    const result = await getUsersInfo(["u1", "u2"]);
    expect(result["u1"]).toEqual({ displayName: "A", photoURL: "url1" });
    expect(result["u2"]).toBeUndefined();
  });

  it("returns empty for empty input", async () => {
    const result = await getUsersInfo([]);
    expect(result).toEqual({});
  });
});
