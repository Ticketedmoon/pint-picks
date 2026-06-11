"use client";

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PartyPageSkeleton } from "@/components/Skeletons";
import { useAuth } from "@/contexts/AuthContext";

const LeaderboardCards = dynamic(() => import("@/components/party/LeaderboardCards").then(m => ({ default: m.LeaderboardCards })), { ssr: false });
const LeaderboardTable = dynamic(() => import("@/components/party/LeaderboardTable").then(m => ({ default: m.LeaderboardTable })), { ssr: false });
const TournamentLeaderboardModal = dynamic(() => import("@/components/party/TournamentLeaderboardModal").then(m => ({ default: m.TournamentLeaderboardModal })), { ssr: false });
import {
  AUTO_REFRESH_SECONDS,
  COPY_FEEDBACK_MS,
  COUNTDOWN_TICK_MS,
  EMAIL_BANNER_MS,
  INVITE_RESULT_MS,
} from "@/lib/constants";
import { formatScoreToPar } from "@/lib/sports/golf/espn";
import { addInvites, deleteParty, getAllPicksForParty, getParty, getUsersInfo, leaveParty, updatePartyName, hasIncompleteOrNoPicks, getPicks, invalidatePreviousUnlocks, createPickUnlock } from "@/lib/firestore";
import { buildLeaderboardEntries } from "@/lib/leaderboard";
import { calculatePayouts } from "@/lib/payouts";
import { syncPartyStatus } from "@/lib/partySync";
import { getSportConfig } from "@/lib/sports/registry";
import { usePageView } from "@/lib/usePageView";
import type { LeaderboardEntry, Party, PlayerScore } from "@/types";

function PartyContent() {
  const { partyId } = useParams<{ partyId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, godMode } = useAuth();
  const [party, setParty] = useState<Party | null>(null);

  // Track page views under the tournament's analytics doc
  usePageView(party?.tournamentId);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [emailBanner, setEmailBanner] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(AUTO_REFRESH_SECONDS);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [tournamentCountdown, setTournamentCountdown] = useState("");
  const [lockTime, setLockTime] = useState<number | null>(null);
  const [mobileView, setMobileView] = useState<"cards" | "table">("cards");
  const [unlockSending, setUnlockSending] = useState<Record<string, boolean>>({});
  const [unlockResult, setUnlockResult] = useState<Record<string, string>>({});
  const [currentRound, setCurrentRound] = useState<{ currentRound: number; displayRound: number; totalRounds: number; nextRoundTeeTime: string | null } | null>(null);
  const [cutLine, setCutLine] = useState<number | null>(null);
  const [cutRound, setCutRound] = useState<number | null>(null);
  const [tournamentScores, setTournamentScores] = useState<PlayerScore[]>([]);
  const [showTournamentLeaderboard, setShowTournamentLeaderboard] = useState(false);
  const [showPickPrompt, setShowPickPrompt] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [removingMember, setRemovingMember] = useState<Record<string, boolean>>({});
  const [confirmRemoveUid, setConfirmRemoveUid] = useState<string | null>(null);

  // Show email send results from create flow
  useEffect(() => {
    const sent = searchParams.get("emailsSent");
    const failed = searchParams.get("emailsFailed");
    if (sent) {
      const failedCount = parseInt(failed || "0");
      if (failedCount > 0) {
        setEmailBanner(`📧 ${sent} invite(s) sent, ${failedCount} failed`);
      } else {
        setEmailBanner(`📧 ${sent} invite email(s) sent successfully!`);
      }
      setTimeout(() => setEmailBanner(null), EMAIL_BANNER_MS);
    }
  }, [searchParams]);

  const buildLeaderboard = async (partyData: Party) => {
    const sport = getSportConfig(partyData.sportType);
    const [allPicks, usersInfo] = await Promise.all([
      getAllPicksForParty(partyData.id),
      getUsersInfo(partyData.memberUids),
    ]);

    const { scores, cutLine: cl, cutRound: cr } = await sport.fetchScores(partyData);
    setCutLine(cl);
    setCutRound(cr);
    setTournamentScores(scores);
    return buildLeaderboardEntries(partyData, allPicks, usersInfo, scores, cl);
  };

  // Re-fetch when navigating back from picks (cache-bust via ?t= param)
  const refreshKey = searchParams.get("t");

  useEffect(() => {
    if (!partyId) return;
    setLoading(true);
    getParty(partyId)
      .then(async (p) => {
        if (!p) {
          setError("Party not found");
          setLoading(false);
          return;
        }
        // Auto-sync party status with live tournament status
        const synced = await syncPartyStatus(p);
        setParty(synced);
        const sport = getSportConfig(synced.sportType);
        const shouldFetchRound = sport.hasRoundScores && (synced.status === "locked" || synced.status === "complete");
        const [lb] = await Promise.all([
          buildLeaderboard(synced),
          shouldFetchRound
            ? sport.fetchRoundInfo(synced).then(setCurrentRound).catch(() => {})
            : Promise.resolve(),
        ]);
        setLeaderboard(lb);
        setLastRefreshed(new Date());
        setCountdown(AUTO_REFRESH_SECONDS);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [partyId, refreshKey]);

  const handleRefresh = async () => {
    if (!party || refreshing) return;
    setRefreshing(true);
    try {
      // Re-sync party status on every refresh
      const synced = await syncPartyStatus(party);
      setParty(synced);
      const sport = getSportConfig(synced.sportType);
      const shouldFetchRound = sport.hasRoundScores && (synced.status === "locked" || synced.status === "complete");
      const [lb] = await Promise.all([
        buildLeaderboard(synced),
        shouldFetchRound
          ? sport.fetchRoundInfo(synced).then(setCurrentRound).catch(() => {})
          : Promise.resolve(),
      ]);
      setLeaderboard(lb);
      setLastRefreshed(new Date());
      setCountdown(AUTO_REFRESH_SECONDS);
    } catch (err) {
      setError("Failed to refresh scores");
    }
    setRefreshing(false);
  };

  // Auto-refresh countdown timer
  useEffect(() => {
    if (!party || loading) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Only trigger refresh if not already in progress
          if (!refreshing) handleRefresh();
          return AUTO_REFRESH_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [party, loading, refreshing]);

  // First tee-off countdown - fetches actual tee time from ESPN, falls back to tournament start date
  useEffect(() => {
    if (!party || party.status !== "picking") return;

    let cancelled = false;

    const init = async () => {
      const sport = getSportConfig(party.sportType);
      const { lockTime: lt } = await sport.fetchTournamentStatus(party);
      if (cancelled) return;
      setLockTime(lt || new Date(party.tournamentStartDate).getTime());
    };

    init();
    return () => { cancelled = true; };
  }, [party?.tournamentId, party?.status]);

  useEffect(() => {
    if (!party || party.status !== "picking" || lockTime === null) return;

    const updateCountdown = () => {
      const diff = lockTime - Date.now();

      if (diff <= 0) {
        setTournamentCountdown("");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      const parts: string[] = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      parts.push(`${minutes}m`);
      setTournamentCountdown(parts.join(" "));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, COUNTDOWN_TICK_MS);
    return () => clearInterval(interval);
  }, [party?.status, lockTime]);

  const handleCopyInvite = () => {
    if (!party) return;
    const url = `${window.location.origin}/party/join?code=${party.inviteCode}`;
    navigator.clipboard.writeText(url).catch(() => {
      // Fallback: select the text in the input field if clipboard API fails
    });
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), COPY_FEEDBACK_MS);
  };

  const handleInviteMore = async () => {
    if (!party || !user || !inviteEmails.trim()) return;
    setInviteSending(true);
    setInviteResult(null);

    const emailList = inviteEmails
      .split(/[,\n]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    if (emailList.length === 0) {
      setInviteSending(false);
      return;
    }

    try {
      await addInvites(party.id, emailList, user.uid);

      // Send emails
      const idToken = await user.getIdToken();
      const emailRes = await fetch("/api/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          emails: emailList,
          partyName: party.name,
          inviteCode: party.inviteCode,
          invitedBy: user.displayName || user.email || "Someone",
        }),
      });
      const emailData = await emailRes.json();
      if (!emailRes.ok) {
        setInviteResult("Failed to send invites, but the invite code still works.");
      } else {
        setInviteResult(`✓ ${emailData.sent} invite(s) sent!`);
      }
      setInviteEmails("");
      setTimeout(() => {
        setInviteResult(null);
        setShowInviteForm(false);
      }, INVITE_RESULT_MS);
    } catch {
      setInviteResult("Failed to send invites - but invite code still works.");
    }
    setInviteSending(false);
  };

  const handleLeaveParty = async () => {
    if (!party || !partyId || !user) return;
    setLeaving(true);
    try {
      await leaveParty(partyId, user.uid);
      router.push(`/dashboard?sport=${party.sportType || "golf"}`);
    } catch {
      setError("Failed to leave party");
      setLeaving(false);
    }
  };

  const handleDeleteParty = async () => {
    if (!party || !partyId) return;
    setDeleting(true);
    try {
      await deleteParty(partyId);
      router.push(`/dashboard?sport=${party.sportType || "golf"}`);
    } catch {
      setError("Failed to delete party");
      setDeleting(false);
    }
  };

  const handleRenameParty = async () => {
    const trimmed = editedName.trim();
    if (!party || !partyId || !trimmed || trimmed === party.name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await updatePartyName(partyId, trimmed);
      setParty({ ...party, name: trimmed });
      setEditingName(false);
    } catch {
      setError("Failed to rename party");
    } finally {
      setSavingName(false);
    }
  };

  const handleRemoveMember = (targetUid: string) => {
    // Only allow removing members who haven't submitted picks, after the party is locked
    setConfirmRemoveUid(targetUid);
  };

  const confirmRemoveMember = async () => {
    if (!party || !partyId || !confirmRemoveUid) return;
    setRemovingMember((prev) => ({ ...prev, [confirmRemoveUid]: true }));
    try {
      await leaveParty(partyId, confirmRemoveUid);
      setParty({
        ...party,
        memberUids: party.memberUids.filter((uid) => uid !== confirmRemoveUid),
      });
      setLeaderboard((prev) => prev.filter((e) => e.uid !== confirmRemoveUid));
    } catch {
      setError("Failed to remove member");
    } finally {
      setRemovingMember((prev) => ({ ...prev, [confirmRemoveUid]: false }));
      setConfirmRemoveUid(null);
    }
  };

  // Show "make your picks" prompt on first visit when picks aren't done
  const userEntry = leaderboard.find((e) => e.uid === user?.uid);
  const userHasPicksForPrompt = userEntry?.picks.some((p) => p.playerId);
  useEffect(() => {
    if (!party || leaderboard.length === 0) return; // Wait for data to load
    if (party.status === "picking" && !userHasPicksForPrompt && !isGuestViewer) {
      const key = `pickPromptDismissed_${party.id}`;
      if (!sessionStorage.getItem(key)) {
        setShowPickPrompt(true);
      }
    } else {
      setShowPickPrompt(false);
    }
  }, [party?.id, party?.status, userHasPicksForPrompt, leaderboard.length]);

  // Escape key closes pick prompt modal
  useEffect(() => {
    if (!showPickPrompt) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowPickPrompt(false);
        if (party?.id) sessionStorage.setItem(`pickPromptDismissed_${party.id}`, "1");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showPickPrompt, party?.id]);

  if (loading) {
    return <PartyPageSkeleton />;
  }

  if (error || !party) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-red-600">{error || "Party not found"}</p>
      </div>
    );
  }

  const isMember = party.memberUids.includes(user?.uid || "");
  if (!isMember && !godMode) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <div className="bg-white rounded-xl shadow-md p-8 max-w-md mx-auto">
          <span className="text-5xl block mb-4">🔒</span>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Access Restricted</h2>
          <p className="text-gray-600 mb-6">
            You don&apos;t have access to view this party. Ask the party owner to invite you via email or share an invite link.
          </p>
          <Link
            href="/"
            className="inline-block bg-green-700 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-800 transition"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const userHasPicks = userHasPicksForPrompt;
  const isLocked = party.status !== "picking";
  const picksRevealed = isLocked;
  const isGuestViewer = godMode && !party.memberUids.includes(user?.uid || "");

  const dismissPickPrompt = () => {
    setShowPickPrompt(false);
    if (party?.id) {
      sessionStorage.setItem(`pickPromptDismissed_${party.id}`, "1");
    }
  };

  const sport = getSportConfig(party.sportType);

  const handleSendUnlock = async (targetUid: string) => {
    if (!user || !party) return;
    setUnlockSending((prev) => ({ ...prev, [targetUid]: true }));
    setUnlockResult((prev) => ({ ...prev, [targetUid]: "" }));
    try {
      // Validate the member has incomplete or no picks
      const targetPicks = await getPicks(party.id, targetUid);
      if (!hasIncompleteOrNoPicks(targetPicks)) {
        setUnlockResult((prev) => ({ ...prev, [targetUid]: "❌ This member already has complete picks" }));
        setUnlockSending((prev) => ({ ...prev, [targetUid]: false }));
        return;
      }

      // Invalidate previous tokens and generate a new one
      await invalidatePreviousUnlocks(party.id, targetUid);
      const token = crypto.randomUUID();
      await createPickUnlock(party.id, token, targetUid, user.uid);

      // Build the unlock URL
      const baseUrl = window.location.origin;
      const unlockUrl = `${baseUrl}/party/${party.id}/picks?unlock=${token}`;

      // Self-unlock: navigate directly. Other members: copy link to clipboard.
      if (targetUid === user.uid) {
        router.push(`/party/${party.id}/picks?unlock=${token}`);
        return;
      }
      await navigator.clipboard.writeText(unlockUrl);
      setUnlockResult((prev) => ({ ...prev, [targetUid]: "✅ Unlock link copied to clipboard! Share it with the member." }));
    } catch {
      setUnlockResult((prev) => ({ ...prev, [targetUid]: "❌ Failed to generate unlock link" }));
    }
    setUnlockSending((prev) => ({ ...prev, [targetUid]: false }));
  };

  return (
    <div className="w-full px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
      {/* Pick prompt modal */}
      {showPickPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true" aria-label="Make your picks">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
            <div className="text-4xl mb-3">{sport.emoji}</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Time to make your picks!</h2>
            <p className="text-sm text-gray-500 mb-1">
              {party.tournamentName} is coming up.
            </p>
            <p className="text-sm text-gray-500 mb-5">
              Choose your {sport.entityLabelPlural.toLowerCase()} before picks lock{lockTime ? ` on ${new Date(lockTime).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}.
            </p>
            <Link
              href={`/party/${party.id}/picks`}
              onClick={dismissPickPrompt}
              className="block w-full rounded-lg bg-green-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-600"
            >
              {sport.pickActionLabel}
            </Link>
            <button
              type="button"
              onClick={dismissPickPrompt}
              className="mt-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href={`/dashboard?sport=${party.sportType || "golf"}`}
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
            </svg>
            Back to dashboard
          </Link>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameParty();
                  if (e.key === "Escape") setEditingName(false);
                }}
                maxLength={60}
                autoFocus
                className="text-2xl font-bold text-gray-900 sm:text-3xl border-b-2 border-green-500 bg-transparent outline-none w-full max-w-md"
                disabled={savingName}
              />
              <button
                onClick={handleRenameParty}
                disabled={savingName}
                className="text-green-600 hover:text-green-800 transition-colors disabled:opacity-50"
                title="Save"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                onClick={() => setEditingName(false)}
                disabled={savingName}
                className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                title="Cancel"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
          ) : (
            <h1 className="break-words text-2xl font-bold text-gray-900 sm:text-3xl group">
              {party.name}
              {user?.uid === party.createdBy && party.status === "picking" && (
                <button
                  onClick={() => { setEditedName(party.name); setEditingName(true); }}
                  className="ml-2 inline-flex align-middle text-gray-300 hover:text-gray-500 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                  title="Rename party"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 sm:h-5 sm:w-5">
                    <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                    <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
                  </svg>
                </button>
              )}
            </h1>
          )}
          <p className="mt-1 break-words text-sm text-gray-500 sm:text-base">
            {party.tournamentName} • {party.memberUids.length} member
            {party.memberUids.length !== 1 ? "s" : ""}
          </p>
          {tournamentCountdown && party.status === "picking" && (
            <p className="mt-1 text-xs sm:text-sm font-medium text-amber-700">
              {sport.emoji} {sport.startEventLabel} in {tournamentCountdown} - picks lock at {sport.startEventLabel.toLowerCase()}
            </p>
          )}
          {!tournamentCountdown && party.status === "picking" && (
            <p className="mt-1 text-xs sm:text-sm font-medium text-blue-700">
              🔒 {sport.startEventLabel} is imminent - picks are about to lock
            </p>
          )}
          {party.buyIn > 0 && (() => {
            const payouts = calculatePayouts(party);
            return (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  💰 €{party.buyIn} buy-in
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-800">
                  🏆 1st: €{payouts.first}
                </span>
                {party.secondPlacePayout && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                    🥈 2nd: €{payouts.second}
                  </span>
                )}
                {party.thirdPlacePayout && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-700">
                    🥉 3rd: €{payouts.third}
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  Pot: €{payouts.totalPot}
                </span>
              </div>
            );
          })()}
          {party.sportType === "football" && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-gray-400">Tiebreakers:</span>
              {(party.tiebreakerRules && party.tiebreakerRules.length > 0
                ? party.tiebreakerRules
                : [
                    { id: "furthest_team", label: "Furthest team" },
                    { id: "goals_scored", label: "Goals scored" },
                    { id: "least_goals_conceded", label: "Least conceded" },
                  ]
              ).map((rule, i, arr) => (
                <span key={rule.id} className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <span className="font-medium">{i + 1}.</span> {rule.label}
                  {i < arr.length - 1 && <span className="text-gray-300 ml-0.5">→</span>}
                </span>
              ))}
            </div>
          )}
          {(!party.sportType || party.sportType === "golf") && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-gray-400">Tiebreakers:</span>
              {(party.tiebreakerRules && party.tiebreakerRules.length > 0
                ? party.tiebreakerRules
                : [
                    { id: "best_finishing_position", label: "Best finishing golfer" },
                    { id: "most_cuts_made", label: "Most cuts made" },
                    { id: "lowest_single_round", label: "Lowest single round" },
                  ]
              ).map((rule, i, arr) => (
                <span key={rule.id} className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <span className="font-medium">{i + 1}.</span> {rule.label}
                  {i < arr.length - 1 && <span className="text-gray-300 ml-0.5">→</span>}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
          {!isGuestViewer && (
            <button
              onClick={() => setShowInviteForm(!showInviteForm)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 sm:w-auto"
            >
              {showInviteForm ? "✕ Close" : party.status === "locked" && user?.uid === party.createdBy ? "➕ Add Late Joiner" : "➕ Invite More"}
            </button>
          )}
          {!isGuestViewer && !isLocked && !userHasPicks && (
            <Link
              href={`/party/${party.id}/picks`}
              className="w-full rounded-lg bg-green-700 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-green-600 sm:w-auto"
            >
              {sport.emoji} {sport.pickActionLabel}
            </Link>
          )}
          {!isGuestViewer && !isLocked && userHasPicks && (
            <Link
              href={`/party/${party.id}/picks`}
              className="w-full rounded-lg bg-yellow-600 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-yellow-500 sm:w-auto"
            >
              ✏️ Edit Picks
            </Link>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50 sm:w-auto"
          >
            {refreshing ? "Refreshing..." : `🔄 Refresh (${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, "0")})`}
          </button>
        </div>
      </div>

      {currentRound && sport.hasRoundScores && (party.status === "locked" || party.status === "complete") && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-5 py-2 text-sm sm:text-base font-semibold text-green-800 shadow-sm">
            ⛳ Round {currentRound.displayRound} of {currentRound.totalRounds}
          </span>
          {currentRound.nextRoundTeeTime && party.status === "locked" && new Date(currentRound.nextRoundTeeTime) > new Date() && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-4 py-2 text-xs sm:text-sm font-medium text-amber-800 shadow-sm">
              🕐 Tee-off: {new Date(currentRound.nextRoundTeeTime).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}{" "}
              {new Date(currentRound.nextRoundTeeTime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
            </span>
          )}
          {party.status === "locked" && (!currentRound.nextRoundTeeTime || new Date(currentRound.nextRoundTeeTime) <= new Date()) && (
            <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-xs sm:text-sm font-semibold text-red-700 shadow-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" style={{ animation: "pulse-dot 1.5s ease-in-out infinite" }} />
              </span>
              Round underway
            </span>
          )}
          {cutLine != null && cutRound != null && cutRound > 0 && currentRound.currentRound >= cutRound && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-4 py-2 text-xs sm:text-sm font-medium text-red-800 shadow-sm">
              ✂️ Cut line: {formatScoreToPar(cutLine)} (cut players score {formatScoreToPar(cutLine + 1)})
            </span>
          )}
          {cutRound === 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-4 py-2 text-xs sm:text-sm font-medium text-gray-600 shadow-sm">
              No cut this tournament
            </span>
          )}
          {tournamentScores.length > 0 && (
            <button
              onClick={() => setShowTournamentLeaderboard(true)}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-green-800 ring-2 ring-green-600 shadow-sm transition-all hover:bg-green-600 hover:text-white hover:shadow-md active:scale-95"
            >
              📊 View Leaderboard
            </button>
          )}
        </div>
      )}

      {showInviteForm && party && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">
            {party.status === "locked" ? "Add a late joiner" : "Invite more people"}
          </h3>

          {party.status === "locked" && user?.uid === party.createdBy && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <p className="font-medium mb-1">⏰ The tournament has started</p>
              <p>
                You can still invite someone to join late. Once they join using the link or code below,
                use the &quot;🔓 Unlock picks&quot; button next to their name on the leaderboard. This copies a link you can share with them so they can submit picks.
              </p>
            </div>
          )}

          {/* Shareable link - primary method */}
          <div className="mb-4 rounded-lg bg-gray-50 border border-gray-200 p-3">
            <p className="text-xs font-medium text-gray-500 mb-2">Share this link:</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                readOnly
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/party/join?code=${party.inviteCode}`}
                className="flex-1 min-w-0 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 font-mono"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={handleCopyInvite}
                className="shrink-0 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {inviteCopied ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Email invites - secondary method */}
          <p className="text-xs font-medium text-gray-500 mb-2">Or send email invites:</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <textarea
              value={inviteEmails}
              onChange={(e) => setInviteEmails(e.target.value)}
              placeholder="Enter email addresses, separated by commas or new lines"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              rows={2}
            />
            <button
              onClick={handleInviteMore}
              disabled={inviteSending || !inviteEmails.trim()}
              className="shrink-0 bg-green-700 hover:bg-green-600 text-white text-sm font-medium py-2 px-5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {inviteSending ? "Sending..." : "Send Invites"}
            </button>
          </div>
          {inviteResult && (
            <p className={`text-sm mt-2 ${inviteResult.startsWith("✓") ? "text-green-600" : "text-red-600"}`}>
              {inviteResult}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            💡 Tip: Sharing the link directly is the fastest way to invite people.
          </p>
        </div>
      )}

      {lastRefreshed && (
        <p className="text-xs text-gray-400 mb-4">
          Last updated: {lastRefreshed.toLocaleTimeString()} · Auto-refresh in {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
        </p>
      )}

      {emailBanner && (
        <div className="mb-6 flex flex-col gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 sm:flex-row sm:items-center sm:justify-between">
          <span className="break-words">{emailBanner}</span>
          <button onClick={() => setEmailBanner(null)} className="self-end text-green-600 transition-colors hover:text-green-800 sm:ml-4">✕</button>
        </div>
      )}

      {party.invalidPicks && party.invalidPicks.length > 0 && party.status === "picking" && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">⚠️ Tournament starting - some members have picks not in the confirmed field</p>
          <p className="mt-1 text-xs sm:text-sm text-amber-700">
            The game will lock automatically once all picks are valid. Affected members have been emailed.
          </p>
          <ul className="mt-2 space-y-1 text-xs sm:text-sm">
            {Array.from(new Set(party.invalidPicks.map((ip) => ip.uid))).map((uid) => {
              const memberPicks = party.invalidPicks!.filter((ip) => ip.uid === uid);
              const memberEntry = leaderboard.find((e) => e.uid === uid);
              const memberName = memberEntry?.userName || uid;
              return (
                <li key={uid}>
                  <strong>{memberName}</strong>: {memberPicks.map((ip) => ip.playerName).join(", ")}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {isLocked && party.status === "locked" && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg mb-6 text-sm">
          🔒 Picks are locked - the tournament is in progress.
        </div>
      )}

      {party.status === "complete" && leaderboard.length > 0 && party.buyIn > 0 && (() => {
        const payouts = calculatePayouts(party);
        const winner = leaderboard[0];
        const second = leaderboard[1];
        const third = leaderboard[2];
        return (
          <div className="mb-6 rounded-xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-yellow-50 p-5">
            <h2 className="text-lg font-bold text-emerald-900 mb-3">🏆 Tournament Complete!</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🥇</span>
                <div>
                  <span className="font-semibold text-gray-900">{winner.userName}</span>
                  <span className="text-gray-500 text-sm ml-2">({winner.displayTotal})</span>
                </div>
                <span className="ml-auto rounded-full bg-emerald-200 px-3 py-1 text-sm font-bold text-emerald-900">
                  Wins €{payouts.first}
                </span>
              </div>
              {party.secondPlacePayout && second && (
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🥈</span>
                  <div>
                    <span className="font-semibold text-gray-900">{second.userName}</span>
                    <span className="text-gray-500 text-sm ml-2">({second.displayTotal})</span>
                  </div>
                  <span className="ml-auto rounded-full bg-gray-200 px-3 py-1 text-sm font-bold text-gray-700">
                    Wins €{payouts.second}
                  </span>
                </div>
              )}
              {party.thirdPlacePayout && third && (
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🥉</span>
                  <div>
                    <span className="font-semibold text-gray-900">{third.userName}</span>
                    <span className="text-gray-500 text-sm ml-2">({third.displayTotal})</span>
                  </div>
                  <span className="ml-auto rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-orange-700">
                    Gets €{payouts.third} back
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {!picksRevealed && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg mb-6 text-sm">
          🙈 Picks are hidden until the tournament starts. You can only see your own selections.
        </div>
      )}

      {/* Leaderboard Table */}
      {leaderboard.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <p className="text-gray-500">No picks submitted yet. Share the invite code to get started!</p>
        </div>
      ) : (
        <>
        {/* Mobile view toggle */}
        <div className="flex justify-end mb-3 sm:hidden">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
            <button
              onClick={() => setMobileView("cards")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mobileView === "cards" ? "bg-green-700 text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setMobileView("table")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mobileView === "table" ? "bg-green-700 text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Table
            </button>
          </div>
        </div>

        {/* Mobile card layout */}
        <div className={`space-y-3 ${mobileView === "cards" ? "sm:hidden" : "hidden"}`}>
          <LeaderboardCards
            leaderboard={leaderboard}
            party={party}
            user={user}
            picksRevealed={picksRevealed}
            onSendUnlock={handleSendUnlock}
            unlockSending={unlockSending}
            unlockResult={unlockResult}
            onRemoveMember={user?.uid === party.createdBy && party.status === "locked" ? handleRemoveMember : undefined}
            removingMember={removingMember}
          />
        </div>

        {/* Desktop table (always on sm+, or on mobile when table view selected) */}
        <LeaderboardTable
          leaderboard={leaderboard}
          party={party}
          user={user}
          picksRevealed={picksRevealed}
          onSendUnlock={handleSendUnlock}
          unlockSending={unlockSending}
          unlockResult={unlockResult}
          mobileView={mobileView}
          onRemoveMember={user?.uid === party.createdBy && party.status === "locked" ? handleRemoveMember : undefined}
          removingMember={removingMember}
        />
        </>
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 sm:gap-x-6">
        {sport.hasCutMechanic && (
          <div className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-red-100 border border-red-400 rounded"></span>
            Missed Cut (+1 penalty)
          </div>
        )}
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-green-50 border border-green-300 rounded"></span>
          Your row
        </div>
        <div>{sport.winConditionLabel}</div>
      </div>

      {/* Leave / Delete Party actions */}
      {!isGuestViewer && (
      <div className="mt-12 border-t border-gray-200 pt-8 flex flex-col gap-4">
        {/* Leave Party - visible to non-creators, only during picking phase */}
        {user?.uid !== party.createdBy && party.status === "picking" && (
          <>
            {!showLeaveConfirm ? (
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className="text-sm text-orange-400 hover:text-orange-600 transition-colors self-start"
              >
                🚪 Leave this party
              </button>
            ) : (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                <p className="text-sm font-medium text-orange-800 mb-3">
                  Are you sure you want to leave? Your picks will be deleted and you&apos;ll need the invite code to rejoin.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleLeaveParty}
                    disabled={leaving}
                    className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {leaving ? "Leaving..." : "Yes, leave party"}
                  </button>
                  <button
                    onClick={() => setShowLeaveConfirm(false)}
                    className="bg-white border border-gray-300 text-gray-700 text-sm font-medium py-2 px-4 rounded-lg transition-colors hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Delete Party - only visible to creator */}
        {user?.uid === party.createdBy && (
          <>
            {!showDeleteConfirm ? (
              <button
                onClick={() => { setShowDeleteConfirm(true); setDeleteConfirmText(""); }}
                className="text-sm text-red-400 hover:text-red-600 transition-colors self-start"
              >
                🗑️ Delete this party
              </button>
            ) : (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-800 mb-2">
                  Are you sure? This will permanently delete the party, all picks, and all invites.
                </p>
                {party.status !== "picking" && (
                  <div className="mb-3">
                    <p className="text-xs text-red-600 mb-1.5">
                      This tournament is in progress. Type <span className="font-mono font-bold">DELETE</span> to confirm.
                    </p>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="Type DELETE"
                      className="w-full max-w-[200px] rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-900 placeholder:text-red-300 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                      autoFocus
                    />
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={handleDeleteParty}
                    disabled={deleting || (party.status !== "picking" && deleteConfirmText !== "DELETE")}
                    className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? "Deleting..." : "Yes, delete permanently"}
                  </button>
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                    className="bg-white border border-gray-300 text-gray-700 text-sm font-medium py-2 px-4 rounded-lg transition-colors hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      )}

      {confirmRemoveUid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true" aria-label="Confirm remove member">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-sm font-medium text-gray-800 mb-1">Remove this member?</p>
            <p className="text-xs text-gray-500 mb-4">
              {leaderboard.find((e) => e.uid === confirmRemoveUid)?.userName || "This member"} hasn&apos;t submitted picks. They&apos;ll be removed from the party and their picks (if any) will be deleted. They can rejoin with the invite code.
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmRemoveMember}
                disabled={removingMember[confirmRemoveUid]}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                {removingMember[confirmRemoveUid] ? "Removing..." : "Remove"}
              </button>
              <button
                onClick={() => setConfirmRemoveUid(null)}
                className="flex-1 bg-white border border-gray-300 text-gray-700 text-sm font-medium py-2 px-4 rounded-lg transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showTournamentLeaderboard && (
        <TournamentLeaderboardModal
          scores={tournamentScores}
          onClose={() => setShowTournamentLeaderboard(false)}
        />
      )}
    </div>
  );
}

export default function PartyPage() {
  return (
    <ProtectedRoute>
      <Navbar />
      <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"></div></div>}>
        <PartyContent />
      </Suspense>
    </ProtectedRoute>
  );
}
