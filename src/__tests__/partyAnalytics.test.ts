import { describe, it, expect } from "vitest";
import {
  partyPageKey,
  extractCounterMap,
  indexDocsById,
  countPartiesPerTournament,
  buildMemberActivity,
  buildPartyActivity,
  formatRelativeTime,
  type RawTournamentDoc,
  type PartyRecord,
} from "@/lib/partyAnalytics";

function doc(overrides: Partial<RawTournamentDoc>): RawTournamentDoc {
  return {
    id: "u1_t1",
    uid: "u1",
    email: null,
    totalViews: 0,
    lastVisit: "",
    pages: {},
    ...overrides,
  };
}

function party(overrides: Partial<PartyRecord>): PartyRecord {
  return {
    id: "p1",
    name: "Party One",
    createdBy: "u1",
    memberUids: ["u1", "u2"],
    sportType: "golf",
    tournamentId: "t1",
    tournamentName: "The Open",
    ...overrides,
  };
}

const uidToName = { u1: "Alice", u2: "Bob", u3: "Carol" };
const uidToEmail = { u1: "alice@x.com", u2: "bob@x.com" };

describe("partyPageKey", () => {
  it("maps a party id to its page-view key", () => {
    expect(partyPageKey("p1")).toBe("_party_p1");
  });
});

describe("extractCounterMap", () => {
  it("reads literal dotted field names (setDoc-merge format)", () => {
    const data = {
      totalViews: 9,
      "pages._party_p1": 5,
      "pages._party_p2": 3,
      "browsers.Chrome": 4,
    };
    expect(extractCounterMap(data, "pages")).toEqual({ _party_p1: 5, _party_p2: 3 });
    expect(extractCounterMap(data, "browsers")).toEqual({ Chrome: 4 });
  });

  it("reads a real nested object (updateDoc / FieldPath format)", () => {
    const data = { pages: { _party_p1: 2, _party_p2: 7 } };
    expect(extractCounterMap(data, "pages")).toEqual({ _party_p1: 2, _party_p2: 7 });
  });

  it("merges nested and literal representations", () => {
    const data = { pages: { _party_p1: 2 }, "pages._party_p2": 7 };
    expect(extractCounterMap(data, "pages")).toEqual({ _party_p1: 2, _party_p2: 7 });
  });

  it("ignores non-numeric values and arrays", () => {
    const data = { pages: ["nope"], "pages._party_p1": "x", "pages._party_p2": 4 };
    expect(extractCounterMap(data, "pages")).toEqual({ _party_p2: 4 });
  });

  it("returns an empty map when nothing matches", () => {
    expect(extractCounterMap({ totalViews: 3 }, "pages")).toEqual({});
  });
});

describe("indexDocsById", () => {
  it("indexes docs by id", () => {
    const docs = [doc({ id: "a" }), doc({ id: "b" })];
    const map = indexDocsById(docs);
    expect(Object.keys(map)).toEqual(["a", "b"]);
    expect(map.a.id).toBe("a");
  });
});

describe("countPartiesPerTournament", () => {
  it("counts parties per tournament and ignores blank tournamentIds", () => {
    const counts = countPartiesPerTournament([
      party({ id: "p1", tournamentId: "t1" }),
      party({ id: "p2", tournamentId: "t1" }),
      party({ id: "p3", tournamentId: "t2" }),
      party({ id: "p4", tournamentId: "" }),
    ]);
    expect(counts).toEqual({ t1: 2, t2: 1 });
  });
});

describe("buildMemberActivity", () => {
  it("uses the party-specific page count for views", () => {
    const docs = indexDocsById([
      doc({ id: "u1_t1", uid: "u1", totalViews: 99, pages: { _party_p1: 5 }, lastVisit: "2026-07-16T10:00:00Z" }),
    ]);
    const members = buildMemberActivity(party({}), docs, uidToName, uidToEmail);
    const alice = members.find((m) => m.uid === "u1")!;
    expect(alice.views).toBe(5);
    expect(alice.lastVisit).toBe("2026-07-16T10:00:00Z");
    expect(alice.name).toBe("Alice");
    expect(alice.email).toBe("alice@x.com");
  });

  it("backfills members with no analytics doc as zero", () => {
    const members = buildMemberActivity(party({}), {}, uidToName, uidToEmail);
    expect(members).toHaveLength(2);
    expect(members.every((m) => m.views === 0 && m.lastVisit === "")).toBe(true);
  });

  it("falls back to totalViews for legacy docs when tournament has a single party", () => {
    const docs = indexDocsById([
      doc({ id: "u1_t1", uid: "u1", totalViews: 7, pages: {}, lastVisit: "2026-07-16T09:00:00Z" }),
    ]);
    const members = buildMemberActivity(party({}), docs, uidToName, uidToEmail, 1);
    expect(members.find((m) => m.uid === "u1")!.views).toBe(7);
  });

  it("does not attribute legacy totalViews when tournament is shared by multiple parties", () => {
    const docs = indexDocsById([
      doc({ id: "u1_t1", uid: "u1", totalViews: 7, pages: {}, lastVisit: "2026-07-16T09:00:00Z" }),
    ]);
    const members = buildMemberActivity(party({}), docs, uidToName, uidToEmail, 2);
    expect(members.find((m) => m.uid === "u1")!.views).toBe(0);
  });

  it("falls back to doc email and truncated uid when maps are missing", () => {
    const docs = indexDocsById([
      doc({ id: "abcdef123456_t1", uid: "abcdef123456", email: "raw@x.com", pages: { _party_p1: 1 } }),
    ]);
    const members = buildMemberActivity(
      party({ memberUids: ["abcdef123456"] }),
      docs,
      {},
      {}
    );
    expect(members[0].name).toBe("abcdef12");
    expect(members[0].email).toBe("raw@x.com");
  });

  it("sorts by views desc, then last visit desc, then name", () => {
    const docs = indexDocsById([
      doc({ id: "u1_t1", uid: "u1", pages: { _party_p1: 2 }, lastVisit: "2026-07-16T08:00:00Z" }),
      doc({ id: "u2_t1", uid: "u2", pages: { _party_p1: 2 }, lastVisit: "2026-07-16T12:00:00Z" }),
      doc({ id: "u3_t1", uid: "u3", pages: { _party_p1: 5 }, lastVisit: "2026-07-16T01:00:00Z" }),
    ]);
    const members = buildMemberActivity(
      party({ memberUids: ["u1", "u2", "u3"] }),
      docs,
      uidToName,
      uidToEmail
    );
    expect(members.map((m) => m.uid)).toEqual(["u3", "u2", "u1"]);
  });
});

describe("buildPartyActivity", () => {
  it("rolls up totals and sorts parties by most recent activity", () => {
    const parties = [
      party({ id: "p1", name: "Alpha", tournamentId: "t1", memberUids: ["u1", "u2"] }),
      party({ id: "p2", name: "Beta", createdBy: "u3", tournamentId: "t2", memberUids: ["u3"] }),
    ];
    const docs: RawTournamentDoc[] = [
      doc({ id: "u1_t1", uid: "u1", pages: { _party_p1: 3 }, lastVisit: "2026-07-16T08:00:00Z" }),
      doc({ id: "u2_t1", uid: "u2", pages: { _party_p1: 0 }, lastVisit: "" }),
      doc({ id: "u3_t2", uid: "u3", pages: { _party_p2: 4 }, lastVisit: "2026-07-16T20:00:00Z" }),
    ];
    const result = buildPartyActivity(parties, docs, uidToName, uidToEmail);

    // Beta sorted first (more recent lastVisit)
    expect(result.map((p) => p.id)).toEqual(["p2", "p1"]);

    const alpha = result.find((p) => p.id === "p1")!;
    expect(alpha.totalViews).toBe(3);
    expect(alpha.activeCount).toBe(1);
    expect(alpha.memberCount).toBe(2);
    expect(alpha.creatorName).toBe("Alice");
    expect(alpha.lastVisit).toBe("2026-07-16T08:00:00Z");

    const beta = result.find((p) => p.id === "p2")!;
    expect(beta.totalViews).toBe(4);
    expect(beta.creatorName).toBe("Carol");
  });

  it("falls back to a truncated creator uid when name is unknown", () => {
    const result = buildPartyActivity(
      [party({ createdBy: "zzzzzzzzzzzz", memberUids: [] })],
      [],
      {},
      {}
    );
    expect(result[0].creatorName).toBe("zzzzzzzz");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-07-16T12:00:00Z").getTime();

  it("returns Never for empty or invalid input", () => {
    expect(formatRelativeTime("", now)).toBe("Never");
    expect(formatRelativeTime("not-a-date", now)).toBe("Never");
  });

  it("formats sub-minute as Just now", () => {
    expect(formatRelativeTime("2026-07-16T11:59:30Z", now)).toBe("Just now");
  });

  it("formats minutes, hours, days, months and years", () => {
    expect(formatRelativeTime("2026-07-16T11:30:00Z", now)).toBe("30m ago");
    expect(formatRelativeTime("2026-07-16T09:00:00Z", now)).toBe("3h ago");
    expect(formatRelativeTime("2026-07-14T12:00:00Z", now)).toBe("2d ago");
    expect(formatRelativeTime("2026-05-01T12:00:00Z", now)).toBe("2mo ago");
    expect(formatRelativeTime("2024-01-01T12:00:00Z", now)).toBe("2y ago");
  });
});
