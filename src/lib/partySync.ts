import { getParty, updatePartyStatus, updatePartyInvalidPicks, clearPartyInvalidPicks, updatePartyLastNotified, getUserEmail, getUsersInfo } from "@/lib/firestore";
import { getSportConfig } from "@/lib/sports/registry";
import type { Party } from "@/types";

const NOTIFICATION_COOLDOWN_MS = 1000 * 60 * 60; // 1 hour

/**
 * Check the live tournament status and auto-update the party
 * status in Firestore if needed. Uses the sport adapter for
 * sport-specific status checking and pick validation.
 *
 * Transitions:
 *   picking → locked   (when tournament starts)
 *   picking → complete (when tournament ends, if sport supports it)
 *   locked  → complete (when tournament ends)
 *
 * Firestore rules only allow the party creator to update the party document,
 * and only the creator (or the party once locked) can read all members' picks.
 * So persistence and pick validation are gated behind `canPersist`, which the
 * caller sets to true only for the creator. Non-creators still receive the
 * correct in-memory status but do not attempt denied reads/writes.
 *
 * Returns the updated party object.
 */
export async function syncPartyStatus(
  party: Party,
  options: { canPersist?: boolean; authToken?: string } = {},
): Promise<Party> {
  const { canPersist = true, authToken } = options;
  const sport = getSportConfig(party.sportType);
  const { status: tournamentStatus } = await sport.fetchTournamentStatus(party);

  // locked → complete transition (no validation needed, picks already locked)
  if (party.status === "locked" && tournamentStatus === "post") {
    if (canPersist) await updatePartyStatus(party.id, "complete");
    return { ...party, status: "complete" };
  }

  // picking → locked/complete transition
  if (party.status === "picking" && (tournamentStatus === "in" || tournamentStatus === "post")) {
    const newStatus = tournamentStatus === "post" ? "complete" : "locked";

    // Non-creators cannot read all members' picks (rules) nor write the party,
    // so skip validation and persistence but still reflect the lock in the UI.
    if (!canPersist) {
      return { ...party, status: newStatus };
    }

    const validation = await sport.validatePicks(party);

    if (validation.valid) {
      if (party.invalidPicks && party.invalidPicks.length > 0) {
        await clearPartyInvalidPicks(party.id);
      }
      await updatePartyStatus(party.id, newStatus);
      return { ...party, status: newStatus, invalidPicks: [] };
    }

    // Invalid picks found (golf-specific: field validation)
    await updatePartyInvalidPicks(party.id, validation.invalidPicks);

    const shouldNotify =
      !party.lastInvalidNotifiedAt ||
      Date.now() - new Date(party.lastInvalidNotifiedAt).getTime() > NOTIFICATION_COOLDOWN_MS;

    if (shouldNotify) {
      await notifyInvalidPickMembers(party, validation.invalidPicks, authToken);
      await updatePartyLastNotified(party.id);
    }

    return { ...party, invalidPicks: validation.invalidPicks };
  }

  return party;
}

/**
 * Send email notifications to members with invalid picks.
 */
async function notifyInvalidPickMembers(
  party: Party,
  invalidPicks: { uid: string; playerName: string; slot: string }[],
  authToken?: string,
): Promise<void> {
  // Group invalid picks by UID
  const byUid = new Map<string, string[]>();
  for (const pick of invalidPicks) {
    const existing = byUid.get(pick.uid) || [];
    existing.push(pick.playerName);
    byUid.set(pick.uid, existing);
  }

  // Fetch user info for affected UIDs
  const affectedUids = Array.from(byUid.keys());
  const usersInfo = await getUsersInfo(affectedUids);

  const invalidMembers: { email: string; displayName: string; invalidPlayers: string[] }[] = [];
  for (const uid of affectedUids) {
    const email = await getUserEmail(uid);
    if (!email) continue;
    const info = usersInfo[uid];
    invalidMembers.push({
      email,
      displayName: info?.displayName || "Player",
      invalidPlayers: byUid.get(uid) || [],
    });
  }

  if (invalidMembers.length === 0) return;

  // Fire-and-forget the email API call
  try {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    await fetch(`${baseUrl}/api/notify-invalid-picks`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        partyId: party.id,
        partyName: party.name,
        invalidMembers,
      }),
    });
  } catch (err) {
    console.error("Failed to send invalid picks notifications:", err);
  }
}
