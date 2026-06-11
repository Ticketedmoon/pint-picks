import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  arrayUnion,
  arrayRemove,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

// Helper to get db instance
const db = () => getFirebaseDb();
import type { Party, Picks, PartyInvite, PickUnlock } from "@/types";

// Generate a 6-character invite code
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/1/I to avoid confusion
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// --- Party CRUD ---

export async function createParty(
  name: string,
  createdBy: string,
  tournamentId: string,
  tournamentName: string,
  tournamentStartDate: string,
  buyIn: number = 10,
  currency: string = "EUR",
  secondPlacePayout: boolean = false,
  thirdPlacePayout: boolean = false,
  customGroups?: Party["customGroups"],
  snapshotWildcards?: Party["snapshotWildcards"],
  sportType?: Party["sportType"],
  leagueSlug?: Party["leagueSlug"],
  payoutSplit?: Party["payoutSplit"],
  tiebreakerRules?: Party["tiebreakerRules"],
): Promise<Party> {
  // Input validation
  const trimmedName = name.trim();
  if (!trimmedName || trimmedName.length > 60) {
    throw new Error("Party name must be 1-60 characters");
  }
  if (!createdBy) throw new Error("Missing createdBy");
  if (!tournamentId) throw new Error("Missing tournamentId");
  if (typeof buyIn !== "number" || buyIn < 0 || buyIn > 10000) {
    throw new Error("Buy-in must be between 0 and 10,000");
  }

  const partyRef = doc(collection(db(), "parties"));
  const party: Omit<Party, "id"> = {
    name: trimmedName,
    createdBy,
    inviteCode: generateInviteCode(),
    tournamentId,
    tournamentName,
    tournamentStartDate,
    createdAt: new Date().toISOString(),
    status: "picking",
    memberUids: [createdBy],
    buyIn,
    currency,
    secondPlacePayout,
    thirdPlacePayout,
    sportType: sportType || "golf",
    ...(leagueSlug ? { leagueSlug } : {}),
    ...(customGroups ? { customGroups } : {}),
    ...(snapshotWildcards ? { snapshotWildcards } : {}),
    ...(payoutSplit ? { payoutSplit } : {}),
    ...(tiebreakerRules ? { tiebreakerRules } : {}),
  };
  await setDoc(partyRef, party);
  return { id: partyRef.id, ...party };
}

export async function getParty(partyId: string): Promise<Party | null> {
  const snap = await getDoc(doc(db(), "parties", partyId));
  if (!snap.exists()) return null;
  const data = snap.data();
  // Runtime validation for critical fields
  if (!data.createdBy || !data.inviteCode || !Array.isArray(data.memberUids)) {
    console.warn("Party document missing required fields:", partyId);
    return null;
  }
  return { id: snap.id, ...data } as Party;
}

export async function getPartiesForUser(uid: string): Promise<Party[]> {
  const q = query(collection(db(), "parties"), where("memberUids", "array-contains", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Party);
}

export async function getAllParties(): Promise<Party[]> {
  const snap = await getDocs(collection(db(), "parties"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Party);
}

export async function joinPartyByCode(code: string, uid: string): Promise<Party | null> {
  const q = query(collection(db(), "parties"), where("inviteCode", "==", code.toUpperCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const partyDoc = snap.docs[0];
  const party = { id: partyDoc.id, ...partyDoc.data() } as Party;

  if (party.memberUids.includes(uid)) return party; // already a member

  await updateDoc(doc(db(), "parties", partyDoc.id), {
    memberUids: arrayUnion(uid),
  });

  return { ...party, memberUids: [...party.memberUids, uid] };
}

export async function leaveParty(partyId: string, uid: string): Promise<void> {
  // Delete picks first (while user is still a member, for rules compliance)
  const picksRef = doc(db(), "parties", partyId, "picks", uid);
  const picksSnap = await getDoc(picksRef);
  if (picksSnap.exists()) {
    await deleteDoc(picksRef);
  }
  // Then remove from memberUids
  await updateDoc(doc(db(), "parties", partyId), {
    memberUids: arrayRemove(uid),
  });
}

export async function updatePartyStatus(
  partyId: string,
  status: Party["status"]
): Promise<void> {
  await updateDoc(doc(db(), "parties", partyId), { status });
}

export async function updatePartyName(
  partyId: string,
  name: string
): Promise<void> {
  await updateDoc(doc(db(), "parties", partyId), { name });
}

export async function updatePartyInvalidPicks(
  partyId: string,
  invalidPicks: Party["invalidPicks"]
): Promise<void> {
  await updateDoc(doc(db(), "parties", partyId), { invalidPicks });
}

export async function clearPartyInvalidPicks(partyId: string): Promise<void> {
  await updateDoc(doc(db(), "parties", partyId), {
    invalidPicks: [],
    lastInvalidNotifiedAt: null,
  });
}

export async function updatePartyLastNotified(partyId: string): Promise<void> {
  await updateDoc(doc(db(), "parties", partyId), {
    lastInvalidNotifiedAt: new Date().toISOString(),
  });
}

export async function getUserEmail(uid: string): Promise<string | null> {
  const snap = await getDoc(doc(db(), "users", uid));
  if (!snap.exists()) return null;
  return snap.data().email || null;
}

export async function deleteParty(partyId: string): Promise<void> {
  // Collect all subcollection docs, then delete everything in a batch
  const [picksSnap, invitesSnap, unlocksSnap] = await Promise.all([
    getDocs(collection(db(), "parties", partyId, "picks")),
    getDocs(collection(db(), "parties", partyId, "invites")),
    getDocs(collection(db(), "parties", partyId, "pickUnlocks")),
  ]);

  const batch = writeBatch(db());
  for (const d of picksSnap.docs) batch.delete(d.ref);
  for (const d of invitesSnap.docs) batch.delete(d.ref);
  for (const d of unlocksSnap.docs) batch.delete(d.ref);
  batch.delete(doc(db(), "parties", partyId));
  await batch.commit();
}

// --- Picks ---

export function hasIncompleteOrNoPicks(picks: Picks | null): boolean {
  if (!picks) return true;
  return !picks.groupA || !picks.groupB || !picks.groupC || !picks.groupD || !picks.wildcard1 || !picks.wildcard2;
}

export async function savePicks(partyId: string, uid: string, picks: Picks): Promise<void> {
  await setDoc(doc(db(), "parties", partyId, "picks", uid), {
    ...picks,
    lockedAt: picks.lockedAt || new Date().toISOString(),
  });
}

export async function getPicks(partyId: string, uid: string): Promise<Picks | null> {
  const snap = await getDoc(doc(db(), "parties", partyId, "picks", uid));
  if (!snap.exists()) return null;
  return snap.data() as Picks;
}

export async function getAllPicksForParty(
  partyId: string
): Promise<Record<string, Picks>> {
  const snap = await getDocs(collection(db(), "parties", partyId, "picks"));
  const result: Record<string, Picks> = {};
  snap.docs.forEach((d) => {
    result[d.id] = d.data() as Picks;
  });
  return result;
}

// --- Pick Unlocks ---

const PICK_UNLOCK_DURATION_MS = 1000 * 60 * 60; // 1 hour

export async function createPickUnlock(
  partyId: string,
  token: string,
  uid: string,
  createdBy: string
): Promise<PickUnlock> {
  const now = new Date();
  const unlock: PickUnlock = {
    uid,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + PICK_UNLOCK_DURATION_MS).toISOString(),
    used: false,
    createdBy,
  };
  await setDoc(doc(db(), "parties", partyId, "pickUnlocks", token), unlock);
  return unlock;
}

export async function getPickUnlock(partyId: string, token: string): Promise<PickUnlock | null> {
  const snap = await getDoc(doc(db(), "parties", partyId, "pickUnlocks", token));
  if (!snap.exists()) return null;
  return snap.data() as PickUnlock;
}

export async function invalidatePreviousUnlocks(partyId: string, uid: string): Promise<void> {
  const q = query(
    collection(db(), "parties", partyId, "pickUnlocks"),
    where("uid", "==", uid),
    where("used", "==", false)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db());
  snap.docs.forEach((d) => {
    batch.update(d.ref, { used: true, usedAt: new Date().toISOString() });
  });
  if (!snap.empty) await batch.commit();
}

export async function savePicksWithUnlock(
  partyId: string,
  uid: string,
  picks: Picks,
  unlockToken: string
): Promise<void> {
  // Validate token before writing to prevent race conditions / double-use
  const tokenDoc = await getDoc(doc(db(), "parties", partyId, "pickUnlocks", unlockToken));
  if (!tokenDoc.exists()) {
    throw new Error("Invalid unlock token");
  }
  const tokenData = tokenDoc.data() as PickUnlock;
  if (tokenData.uid !== uid) {
    throw new Error("This unlock token is not for your account");
  }
  if (tokenData.used) {
    throw new Error("This unlock link has already been used");
  }
  if (new Date(tokenData.expiresAt).getTime() < Date.now()) {
    throw new Error("This unlock link has expired");
  }

  const batch = writeBatch(db());
  batch.set(doc(db(), "parties", partyId, "picks", uid), {
    ...picks,
    lockedAt: picks.lockedAt || new Date().toISOString(),
  });
  batch.update(doc(db(), "parties", partyId, "pickUnlocks", unlockToken), {
    used: true,
    usedAt: new Date().toISOString(),
  });
  await batch.commit();
}

// --- Invites ---

export async function addInvites(partyId: string, emails: string[], invitedBy: string): Promise<void> {
  for (const email of emails) {
    const normalised = email.toLowerCase().trim();
    if (!normalised) continue;
    await setDoc(doc(db(), "parties", partyId, "invites", normalised), {
      email: normalised,
      status: "pending",
      invitedBy,
    } satisfies PartyInvite);
  }
}

// --- User Info ---

export async function getUserDisplayName(uid: string): Promise<string> {
  const snap = await getDoc(doc(db(), "users", uid));
  if (!snap.exists()) return "Unknown";
  return snap.data().displayName || "Unknown";
}

export async function getUsersInfo(
  uids: string[]
): Promise<Record<string, { displayName: string; photoURL?: string }>> {
  const result: Record<string, { displayName: string; photoURL?: string }> = {};
  // Fetch all user docs in parallel
  const snaps = await Promise.all(
    uids.map((uid) => getDoc(doc(db(), "users", uid)).then((snap) => ({ uid, snap })))
  );
  for (const { uid, snap } of snaps) {
    if (snap.exists()) {
      const data = snap.data();
      result[uid] = {
        displayName: data.displayName || "Unknown",
        photoURL: data.photoURL,
      };
    }
  }
  return result;
}
