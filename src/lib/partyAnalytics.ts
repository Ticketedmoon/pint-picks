/**
 * Pure helpers for the /analytics dashboard.
 *
 * Analytics are written by usePageView into `analytics_tournament/{uid}_{tournamentId}`
 * documents. Each visit to a party page (`/party/{partyId}`) increments:
 *   - totalViews
 *   - pages["_party_{partyId}"]   (party-specific view count)
 *   - lastVisit (ISO timestamp of the most recent visit for that tournament)
 *
 * These helpers turn those raw docs, the parties collection, and the users
 * collection into a simple "list of parties -> per-member leaderboard activity"
 * shape that the dashboard renders.
 */

/** A raw analytics_tournament document, reduced to the fields we care about. */
export interface RawTournamentDoc {
  /** Firestore doc id, formatted `{uid}_{tournamentId}`. */
  id: string;
  uid: string;
  email: string | null;
  totalViews: number;
  lastVisit: string;
  /** Map of `pathname.replace(/\//g, "_")` -> view count. */
  pages: Record<string, number>;
}

/** Minimal party shape needed to build activity. */
export interface PartyRecord {
  id: string;
  name: string;
  createdBy: string;
  memberUids: string[];
  sportType: string;
  tournamentId: string;
  tournamentName: string;
}

/** Per-member leaderboard activity within a single party. */
export interface MemberActivity {
  uid: string;
  name: string;
  email: string | null;
  /** Number of times this member opened the party's leaderboard page. */
  views: number;
  /** ISO timestamp of the member's most recent visit, or "" if never. */
  lastVisit: string;
}

/** A party plus a rollup of its members' leaderboard activity. */
export interface PartyActivity {
  id: string;
  name: string;
  creatorName: string;
  sportType: string;
  tournamentName: string;
  memberCount: number;
  /** Members with at least one recorded leaderboard view. */
  activeCount: number;
  /** Sum of all members' leaderboard views. */
  totalViews: number;
  /** Most recent lastVisit across all members, or "" if none. */
  lastVisit: string;
  members: MemberActivity[];
}

/** The page path a party leaderboard is served from. */
export function partyPageKey(partyId: string): string {
  return `_party_${partyId}`;
}

/**
 * Reconstruct a nested counter map (e.g. `pages`) from a Firestore doc that may
 * store it as a real nested object AND/OR as literal dotted field names.
 *
 * `usePageView` writes counters with `setDoc(..., { merge: true })` using keys
 * like `pages.${key}`. Unlike `updateDoc`, `setDoc` merge does NOT treat dotted
 * string keys as field paths, so those increments land as literal top-level
 * fields (e.g. "pages._party_abc") rather than nested under `pages`. This merges
 * both representations so reads work regardless of how the data was written.
 */
export function extractCounterMap(
  data: Record<string, unknown>,
  prefix: string
): Record<string, number> {
  const out: Record<string, number> = {};

  const nested = data[prefix];
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    for (const [k, v] of Object.entries(nested as Record<string, unknown>)) {
      if (typeof v === "number") out[k] = v;
    }
  }

  const dotted = `${prefix}.`;
  for (const [k, v] of Object.entries(data)) {
    if (k.startsWith(dotted) && typeof v === "number") {
      out[k.slice(dotted.length)] = v;
    }
  }

  return out;
}

/** Index raw analytics docs by their `{uid}_{tournamentId}` id for O(1) lookup. */
export function indexDocsById(docs: RawTournamentDoc[]): Record<string, RawTournamentDoc> {
  const map: Record<string, RawTournamentDoc> = {};
  for (const d of docs) map[d.id] = d;
  return map;
}

/** Count how many parties share each tournamentId. */
export function countPartiesPerTournament(parties: PartyRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of parties) {
    if (!p.tournamentId) continue;
    counts[p.tournamentId] = (counts[p.tournamentId] || 0) + 1;
  }
  return counts;
}

function resolveViews(
  doc: RawTournamentDoc | undefined,
  party: PartyRecord,
  partiesForTournament: number
): number {
  if (!doc) return 0;
  const specific = doc.pages?.[partyPageKey(party.id)];
  if (typeof specific === "number") return specific;
  // Legacy docs predate per-page tracking. Only attribute totalViews to the
  // party when it is the sole party for that tournament (no ambiguity).
  if (partiesForTournament <= 1) return doc.totalViews || 0;
  return 0;
}

/**
 * Build the per-member leaderboard activity for a single party.
 * Every member is included (backfilled with zeros) so inactive members are
 * still visible. Sorted by views desc, then most-recent visit desc, then name.
 */
export function buildMemberActivity(
  party: PartyRecord,
  docsById: Record<string, RawTournamentDoc>,
  uidToName: Record<string, string>,
  uidToEmail: Record<string, string>,
  partiesForTournament = 1
): MemberActivity[] {
  const members: MemberActivity[] = party.memberUids.map((uid) => {
    const doc = docsById[`${uid}_${party.tournamentId}`];
    const views = resolveViews(doc, party, partiesForTournament);
    return {
      uid,
      name: uidToName[uid] || uid.slice(0, 8),
      email: uidToEmail[uid] || doc?.email || null,
      views,
      lastVisit: doc?.lastVisit || "",
    };
  });

  members.sort((a, b) => {
    if (b.views !== a.views) return b.views - a.views;
    if (a.lastVisit !== b.lastVisit) return b.lastVisit.localeCompare(a.lastVisit);
    return a.name.localeCompare(b.name);
  });

  return members;
}

/**
 * Build the full list of parties with their member activity, sorted by most
 * recently active party first.
 */
export function buildPartyActivity(
  parties: PartyRecord[],
  docs: RawTournamentDoc[],
  uidToName: Record<string, string>,
  uidToEmail: Record<string, string>
): PartyActivity[] {
  const docsById = indexDocsById(docs);
  const partyCounts = countPartiesPerTournament(parties);

  const result: PartyActivity[] = parties.map((party) => {
    const members = buildMemberActivity(
      party,
      docsById,
      uidToName,
      uidToEmail,
      partyCounts[party.tournamentId] || 1
    );

    let totalViews = 0;
    let activeCount = 0;
    let lastVisit = "";
    for (const m of members) {
      totalViews += m.views;
      if (m.views > 0) activeCount += 1;
      if (m.lastVisit > lastVisit) lastVisit = m.lastVisit;
    }

    return {
      id: party.id,
      name: party.name,
      creatorName: uidToName[party.createdBy] || party.createdBy.slice(0, 8),
      sportType: party.sportType,
      tournamentName: party.tournamentName,
      memberCount: members.length,
      activeCount,
      totalViews,
      lastVisit,
      members,
    };
  });

  result.sort((a, b) => {
    if (a.lastVisit !== b.lastVisit) return b.lastVisit.localeCompare(a.lastVisit);
    return a.name.localeCompare(b.name);
  });

  return result;
}

/** Human-friendly relative time, e.g. "3h ago". Returns "Never" for empty. */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Never";
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
