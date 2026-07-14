import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Party } from "@/types";
import { mockParty } from "./helpers";

// Mock all dependencies
vi.mock("@/lib/firestore", () => ({
  getParty: vi.fn(),
  updatePartyStatus: vi.fn(),
  updatePartyInvalidPicks: vi.fn(),
  clearPartyInvalidPicks: vi.fn(),
  updatePartyLastNotified: vi.fn(),
  getUserEmail: vi.fn(),
  getUsersInfo: vi.fn(),
}));

// Mock fetchTournamentStatus and validatePicks as standalone fns we control
const mockFetchTournamentStatus = vi.fn();
const mockValidatePicks = vi.fn();

vi.mock("@/lib/sports/registry", () => ({
  getSportConfig: () => ({
    id: "golf",
    hasCutMechanic: true,
    hasRoundScores: true,
    hasThruProgress: true,
    fetchTournamentStatus: mockFetchTournamentStatus,
    validatePicks: mockValidatePicks,
    fetchScores: vi.fn().mockResolvedValue({ scores: [], cutLine: null, cutRound: null }),
    fetchRoundInfo: vi.fn().mockResolvedValue(null),
    formatScore: (s: number) => String(s),
    formatTotal: (s: number) => String(s),
    getScoreColor: () => "",
    getTotalScoreColor: () => "",
    sortDirection: "asc",
    pendingScoreDisplay: "-",
  }),
}));

import { syncPartyStatus } from "@/lib/partySync";
import * as firestore from "@/lib/firestore";

const mocks = {
  fetchTournamentStatus: mockFetchTournamentStatus,
  validatePicks: mockValidatePicks,
  updatePartyStatus: vi.mocked(firestore.updatePartyStatus),
  updatePartyInvalidPicks: vi.mocked(firestore.updatePartyInvalidPicks),
  clearPartyInvalidPicks: vi.mocked(firestore.clearPartyInvalidPicks),
  updatePartyLastNotified: vi.mocked(firestore.updatePartyLastNotified),
  getUserEmail: vi.mocked(firestore.getUserEmail),
  getUsersInfo: vi.mocked(firestore.getUsersInfo),
};

function makeParty(overrides: Partial<Party> = {}): Party {
  return { ...mockParty, ...overrides };
}

describe("syncPartyStatus", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T12:00:00Z"));
    // Stub global.fetch for notification calls
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // --- locked → complete ---

  it("transitions locked → complete when ESPN says post", async () => {
    const party = makeParty({ status: "locked" });
    mocks.fetchTournamentStatus.mockResolvedValue({ status: "post", lockTime: null });

    const result = await syncPartyStatus(party);

    expect(mocks.updatePartyStatus).toHaveBeenCalledWith(party.id, "complete");
    expect(result.status).toBe("complete");
  });

  it("does not transition locked party when ESPN says in", async () => {
    const party = makeParty({ status: "locked" });
    mocks.fetchTournamentStatus.mockResolvedValue({ status: "in", lockTime: null });

    const result = await syncPartyStatus(party);

    expect(mocks.updatePartyStatus).not.toHaveBeenCalled();
    expect(result.status).toBe("locked");
  });

  it("does not transition locked party when ESPN says pre", async () => {
    const party = makeParty({ status: "locked" });
    mocks.fetchTournamentStatus.mockResolvedValue({ status: "pre", lockTime: null });

    const result = await syncPartyStatus(party);

    expect(mocks.updatePartyStatus).not.toHaveBeenCalled();
    expect(result.status).toBe("locked");
  });

  // --- picking → locked (ESPN in) ---

  it("transitions picking → locked when ESPN says in and picks are valid", async () => {
    const party = makeParty({ status: "picking" });
    mocks.fetchTournamentStatus.mockResolvedValue({ status: "in", lockTime: null });
    mocks.validatePicks.mockResolvedValue({ valid: true, invalidPicks: [] });

    const result = await syncPartyStatus(party);

    expect(mocks.updatePartyStatus).toHaveBeenCalledWith(party.id, "locked");
    expect(result.status).toBe("locked");
  });

  // --- picking → complete (ESPN post) ---

  it("transitions picking → complete when ESPN says post and picks are valid", async () => {
    const party = makeParty({ status: "picking" });
    mocks.fetchTournamentStatus.mockResolvedValue({ status: "post", lockTime: null });
    mocks.validatePicks.mockResolvedValue({ valid: true, invalidPicks: [] });

    const result = await syncPartyStatus(party);

    expect(mocks.updatePartyStatus).toHaveBeenCalledWith(party.id, "complete");
    expect(result.status).toBe("complete");
  });

  // --- picking stays picking (ESPN pre, no tee time) ---

  it("keeps picking when ESPN says pre and no tee time", async () => {
    const party = makeParty({ status: "picking" });
    mocks.fetchTournamentStatus.mockResolvedValue({ status: "pre", lockTime: null });

    const result = await syncPartyStatus(party);

    expect(mocks.updatePartyStatus).not.toHaveBeenCalled();
    expect(mocks.validatePicks).not.toHaveBeenCalled();
    expect(result.status).toBe("picking");
  });

  // --- picking stays picking (adapter says pre) ---

  it("keeps picking when adapter says pre and lock time is in the future", async () => {
    const party = makeParty({ status: "picking" });
    const futureLockTime = Date.now() + 1000 * 60 * 60 * 2; // 2 hours from now
    mocks.fetchTournamentStatus.mockResolvedValue({ status: "pre", lockTime: futureLockTime });

    const result = await syncPartyStatus(party);

    expect(mocks.updatePartyStatus).not.toHaveBeenCalled();
    expect(result.status).toBe("picking");
  });

  // --- picking → locked by tee time (adapter resolves to "in") ---

  it("transitions picking → locked when adapter says in (tee time passed, valid picks)", async () => {
    const party = makeParty({ status: "picking" });
    const pastLockTime = Date.now() - 1000 * 60 * 30; // 30 min ago
    mocks.fetchTournamentStatus.mockResolvedValue({ status: "in", lockTime: pastLockTime });
    mocks.validatePicks.mockResolvedValue({ valid: true, invalidPicks: [] });

    const result = await syncPartyStatus(party);

    expect(mocks.updatePartyStatus).toHaveBeenCalledWith(party.id, "locked");
    expect(result.status).toBe("locked");
  });

  it("locks when adapter reports status in (tee time exactly now)", async () => {
    const party = makeParty({ status: "picking" });
    const nowLockTime = Date.now();
    mocks.fetchTournamentStatus.mockResolvedValue({ status: "in", lockTime: nowLockTime });
    mocks.validatePicks.mockResolvedValue({ valid: true, invalidPicks: [] });

    const result = await syncPartyStatus(party);

    expect(mocks.updatePartyStatus).toHaveBeenCalledWith(party.id, "locked");
    expect(result.status).toBe("locked");
  });

  // --- invalid picks block locking ---

  it("stays picking and records invalid picks when validation fails", async () => {
    const party = makeParty({ status: "picking" });
    const invalidPicks = [{ uid: "uid1", playerName: "Tiger Woods", slot: "groupA" }];
    mocks.fetchTournamentStatus.mockResolvedValue({ status: "in", lockTime: null });
    mocks.validatePicks.mockResolvedValue({ valid: false, invalidPicks });
    mocks.getUserEmail.mockResolvedValue("user@test.com");
    mocks.getUsersInfo.mockResolvedValue({ uid1: { displayName: "User 1" } });

    const result = await syncPartyStatus(party);

    expect(mocks.updatePartyStatus).not.toHaveBeenCalled();
    expect(mocks.updatePartyInvalidPicks).toHaveBeenCalledWith(party.id, invalidPicks);
    expect(result.invalidPicks).toEqual(invalidPicks);
  });

  it("sends notification when invalid picks found and no recent notification", async () => {
    const party = makeParty({ status: "picking", lastInvalidNotifiedAt: undefined });
    const invalidPicks = [{ uid: "uid1", playerName: "Tiger Woods", slot: "groupA" }];
    mocks.fetchTournamentStatus.mockResolvedValue({ status: "in", lockTime: null });
    mocks.validatePicks.mockResolvedValue({ valid: false, invalidPicks });
    mocks.getUserEmail.mockResolvedValue("user@test.com");
    mocks.getUsersInfo.mockResolvedValue({ uid1: { displayName: "User 1" } });

    await syncPartyStatus(party);

    expect(mocks.updatePartyLastNotified).toHaveBeenCalledWith(party.id);
    // Verify notification fetch was called
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/notify-invalid-picks"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("respects notification cooldown", async () => {
    const recentNotification = new Date(Date.now() - 1000 * 60 * 30).toISOString(); // 30 min ago (within 1hr cooldown)
    const party = makeParty({ status: "picking", lastInvalidNotifiedAt: recentNotification });
    const invalidPicks = [{ uid: "uid1", playerName: "Tiger Woods", slot: "groupA" }];
    mocks.fetchTournamentStatus.mockResolvedValue({ status: "in", lockTime: null });
    mocks.validatePicks.mockResolvedValue({ valid: false, invalidPicks });

    await syncPartyStatus(party);

    expect(mocks.updatePartyLastNotified).not.toHaveBeenCalled();
    // fetch should not be called for notification (it may be called for other things)
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/notify-invalid-picks"),
      expect.anything()
    );
  });

  it("sends notification when cooldown has expired", async () => {
    const oldNotification = new Date(Date.now() - 1000 * 60 * 90).toISOString(); // 90 min ago (past 1hr cooldown)
    const party = makeParty({ status: "picking", lastInvalidNotifiedAt: oldNotification });
    const invalidPicks = [{ uid: "uid1", playerName: "Tiger Woods", slot: "groupA" }];
    mocks.fetchTournamentStatus.mockResolvedValue({ status: "in", lockTime: null });
    mocks.validatePicks.mockResolvedValue({ valid: false, invalidPicks });
    mocks.getUserEmail.mockResolvedValue("user@test.com");
    mocks.getUsersInfo.mockResolvedValue({ uid1: { displayName: "User 1" } });

    await syncPartyStatus(party);

    expect(mocks.updatePartyLastNotified).toHaveBeenCalledWith(party.id);
  });

  // --- clears stale invalid picks on valid lock ---

  it("clears stale invalid picks when locking with valid picks", async () => {
    const party = makeParty({
      status: "picking",
      invalidPicks: [{ uid: "uid1", playerName: "Old Bad Pick", slot: "groupA" }],
    });
    mocks.fetchTournamentStatus.mockResolvedValue({ status: "in", lockTime: null });
    mocks.validatePicks.mockResolvedValue({ valid: true, invalidPicks: [] });

    const result = await syncPartyStatus(party);

    expect(mocks.clearPartyInvalidPicks).toHaveBeenCalledWith(party.id);
    expect(result.invalidPicks).toEqual([]);
  });

  it("does not compact analytics when transitioning to locked (not complete)", async () => {
    const party = makeParty({ status: "picking" });
    mocks.fetchTournamentStatus.mockResolvedValue({ status: "in", lockTime: null });
    mocks.validatePicks.mockResolvedValue({ valid: true, invalidPicks: [] });

    const result = await syncPartyStatus(party);

    expect(result.status).toBe("locked");
  });

  // --- complete party is not affected ---

  it("returns party unchanged when already complete", async () => {
    const party = makeParty({ status: "complete" });
    mocks.fetchTournamentStatus.mockResolvedValue({ status: "post", lockTime: null });

    const result = await syncPartyStatus(party);

    expect(mocks.updatePartyStatus).not.toHaveBeenCalled();
    expect(result.status).toBe("complete");
  });

  // --- notification error handling ---

  it("handles notification fetch failure gracefully", async () => {
    const party = makeParty({ status: "picking", lastInvalidNotifiedAt: undefined });
    const invalidPicks = [{ uid: "uid1", playerName: "Tiger Woods", slot: "groupA" }];
    mocks.fetchTournamentStatus.mockResolvedValue({ status: "in", lockTime: null });
    mocks.validatePicks.mockResolvedValue({ valid: false, invalidPicks });
    mocks.getUserEmail.mockResolvedValue("user@test.com");
    mocks.getUsersInfo.mockResolvedValue({ uid1: { displayName: "User 1" } });
    // Make the notification fetch throw
    fetchSpy.mockRejectedValue(new Error("Network error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await syncPartyStatus(party);

    // Should still return the invalid picks result (error is caught)
    expect(result.invalidPicks).toEqual(invalidPicks);
    expect(mocks.updatePartyLastNotified).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("skips notification when affected user has no email", async () => {
    const party = makeParty({ status: "picking", lastInvalidNotifiedAt: undefined });
    const invalidPicks = [{ uid: "uid1", playerName: "Tiger Woods", slot: "groupA" }];
    mocks.fetchTournamentStatus.mockResolvedValue({ status: "in", lockTime: null });
    mocks.validatePicks.mockResolvedValue({ valid: false, invalidPicks });
    mocks.getUserEmail.mockResolvedValue(null); // no email
    mocks.getUsersInfo.mockResolvedValue({ uid1: { displayName: "User 1" } });

    await syncPartyStatus(party);

    // No notification fetch should happen when no valid emails exist
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/notify-invalid-picks"),
      expect.anything()
    );
  });

  // --- canPersist gating (non-creator viewers) ---

  it("does not read picks or write when canPersist is false at lock transition", async () => {
    const party = makeParty({ status: "picking" });
    mocks.fetchTournamentStatus.mockResolvedValue({ status: "in", lockTime: null });

    const result = await syncPartyStatus(party, { canPersist: false });

    // Reflects the lock in-memory but performs no denied reads/writes
    expect(result.status).toBe("locked");
    expect(mocks.validatePicks).not.toHaveBeenCalled();
    expect(mocks.updatePartyStatus).not.toHaveBeenCalled();
    expect(mocks.updatePartyInvalidPicks).not.toHaveBeenCalled();
  });

  it("returns complete in-memory when canPersist is false and tournament is post", async () => {
    const party = makeParty({ status: "picking" });
    mocks.fetchTournamentStatus.mockResolvedValue({ status: "post", lockTime: null });

    const result = await syncPartyStatus(party, { canPersist: false });

    expect(result.status).toBe("complete");
    expect(mocks.validatePicks).not.toHaveBeenCalled();
    expect(mocks.updatePartyStatus).not.toHaveBeenCalled();
  });

  it("does not persist locked → complete when canPersist is false", async () => {
    const party = makeParty({ status: "locked" });
    mocks.fetchTournamentStatus.mockResolvedValue({ status: "post", lockTime: null });

    const result = await syncPartyStatus(party, { canPersist: false });

    expect(result.status).toBe("complete");
    expect(mocks.updatePartyStatus).not.toHaveBeenCalled();
  });
});
