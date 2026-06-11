"use client";

import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getPartiesForUser, getAllParties, deleteParty } from "@/lib/firestore";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardSkeleton } from "@/components/Skeletons";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Party, SportType } from "@/types";

const GOLF_RULES = {
  emoji: "⛳",
  howItWorks: "Pick 6 golfers from tiered groups based on world rankings. Your total score is the sum of all your golfers' scores relative to par. Lowest total wins.",
  tiers: [
    { label: "A", desc: "Top-ranked (world #1-6)" },
    { label: "B", desc: "Contenders (#7-12)" },
    { label: "C", desc: "Dark horses (#13-18)" },
    { label: "D", desc: "Underdogs (#19-24)" },
    { label: "W1 / W2", desc: "Wildcards (#25+)" },
  ],
  scoring: [
    { rule: "Score to par", detail: "Each golfer's cumulative score vs par across all rounds" },
    { rule: "Cut players", detail: "Scored at the cut line + 1" },
    { rule: "Made cut, drifted up", detail: "Capped at the cut line (you're not penalised for a bad weekend)" },
    { rule: "WD / DQ", detail: "Flat +1 stroke penalty on top of their last score" },
  ],
  tip: "Lower is better. A golfer at -8 is worth more than one at +2.",
};

const FOOTBALL_RULES = {
  emoji: "⚽",
  howItWorks: "Pick 6 teams from tiered groups based on FIFA rankings. Your total is the sum of match points earned by your teams. Highest total wins.",
  tiers: [
    { label: "A", desc: "Powerhouses (FIFA rank 1-6)" },
    { label: "B", desc: "Contenders (rank 7-12)" },
    { label: "C", desc: "Dark horses (rank 13-18)" },
    { label: "D", desc: "Underdogs (rank 19-24)" },
    { label: "W1 / W2", desc: "Wildcards (rank 25+)" },
  ],
  scoring: [
    { rule: "Win", detail: "3 points" },
    { rule: "Draw", detail: "1 point" },
    { rule: "Loss", detail: "0 points" },
    { rule: "Eliminated", detail: "No more points, but existing points still count" },
  ],
  tip: "Teams that go deep in the tournament rack up more matches and more points.",
};

function statusBadge(status: Party["status"]) {
  const styles = {
    picking: "bg-yellow-100 text-yellow-800",
    locked: "bg-blue-100 text-blue-800",
    complete: "bg-green-100 text-green-800",
  };
  const labels = {
    picking: "Picking Players",
    locked: "Tournament Live",
    complete: "Complete",
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function PartyCard({
  party,
  isCreator,
  isGuestView,
  onDelete,
}: {
  party: Party;
  isCreator: boolean;
  isGuestView?: boolean;
  onDelete: (partyId: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const needsTypedConfirm = party.status !== "picking";

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      setDeleteConfirmText("");
      return;
    }
    if (needsTypedConfirm && deleteConfirmText !== "DELETE") return;
    setDeleting(true);
    try {
      await onDelete(party.id);
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
      setDeleteConfirmText("");
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(false);
    setDeleteConfirmText("");
  };

  return (
    <div className={`group relative rounded-xl border bg-white transition-all hover:shadow-md ${isGuestView ? "border-dashed border-gray-300 opacity-80" : "border-gray-200 hover:border-gray-300"}`}>
      <Link
        href={`/party/${party.id}`}
        className="block px-5 py-4 sm:px-6 sm:py-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
              <h3 className="text-base font-semibold text-gray-900 truncate">{party.name}</h3>
              {statusBadge(party.status)}
              {party.buyIn > 0 && (
                <span className="text-xs text-gray-400">€{party.buyIn} buy-in</span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {party.tournamentName} &middot; {party.memberUids.length} member
              {party.memberUids.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-3 self-end sm:self-auto">
            {isCreator && (
              confirmDelete ? (
                <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
                  {needsTypedConfirm ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        onClick={(e) => e.preventDefault()}
                        placeholder="Type DELETE"
                        className="w-24 rounded-md border border-red-300 px-2 py-1 text-xs text-red-900 placeholder:text-red-300 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                        autoFocus
                      />
                      <button
                        onClick={handleDelete}
                        disabled={deleting || deleteConfirmText !== "DELETE"}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deleting ? "..." : "Delete"}
                      </button>
                      <button
                        onClick={handleCancelDelete}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {deleting ? "..." : "Confirm"}
                      </button>
                      <button
                        onClick={handleCancelDelete}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleDelete}
                  className="rounded-lg p-2.5 text-gray-300 transition-all hover:bg-red-50 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100"
                  title="Delete party"
                >
                  🗑️
                </button>
              )
            )}
            <span className="text-lg text-gray-300 transition-colors group-hover:text-gray-500">→</span>
          </div>
        </div>
      </Link>
    </div>
  );
}

function DashboardContent() {
  const { user, godMode } = useAuth();
  const searchParams = useSearchParams();
  const sport = (searchParams.get("sport") as SportType) || "golf";
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);

  const sportLabel = sport === "golf" ? "Golf" : "Football";
  const sportEmoji = sport === "golf" ? "⛳" : "⚽";

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setParties([]);
    const fetcher = godMode ? getAllParties() : getPartiesForUser(user.uid);
    fetcher.then((p) => {
      const filtered = p.filter((party) => (party.sportType || "golf") === sport);
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setParties(filtered);
    }).catch(() => {
      // Fetch failed, show empty state rather than infinite skeleton
      setParties([]);
    }).finally(() => {
      setLoading(false);
    });
  }, [user, sport, godMode]);

  const handleDelete = async (partyId: string) => {
    try {
      await deleteParty(partyId);
      setParties((prev) => prev.filter((p) => p.id !== partyId));
    } catch {
      alert("Failed to delete party. Please try again.");
    }
  };

  const rules = sport === "golf" ? GOLF_RULES : FOOTBALL_RULES;
  const [rulesOpen, setRulesOpen] = useState(false);

  useEffect(() => {
    if (!rulesOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setRulesOpen(false); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [rulesOpen]);

  const activeParties = parties.filter((p) => p.status === "picking" || p.status === "locked");
  const pastParties = parties.filter((p) => p.status === "complete");

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="w-full px-6 py-8 sm:px-12 sm:py-12 lg:px-20">
      {/* Welcome header */}
      <div className="mb-8 sm:mb-12">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/sports" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Sports</Link>
          <span className="text-gray-300">·</span>
          <p className="text-sm font-medium text-green-700">Welcome back{user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}</p>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-800 sm:text-3xl">{sportEmoji} {sportLabel} Parties</h1>
      </div>

      {/* Action buttons */}
      <div className="mb-10 flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/party/create?sport=${sport}`}
          className="w-full rounded-lg bg-green-700 px-5 py-2.5 text-center font-medium text-white shadow-sm transition-colors hover:bg-green-600 sm:w-auto"
        >
          + Create Party
        </Link>
        <Link
          href="/party/join"
          className="w-full rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-center font-medium text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50 sm:w-auto"
        >
          Join Party
        </Link>
        <button
          onClick={() => setRulesOpen(true)}
          className="w-full rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-center font-medium text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50 sm:w-auto"
        >
          How It Works
        </button>
      </div>

      {rulesOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setRulesOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="How it works"
        >
          <div
            className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4 rounded-t-2xl">
              <div className="flex items-center">
                <h2 className="text-base font-bold text-gray-900">How It Works</h2>
              </div>
              <button
                onClick={() => setRulesOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="px-5 pb-6 pt-4 space-y-5">
              {/* Overview */}
              <p className="text-sm text-gray-600 leading-relaxed">{rules.howItWorks}</p>

              {/* Pick tiers */}
              <div className="rounded-lg bg-gray-50 p-4">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Pick Tiers</h4>
                <div className="space-y-2">
                  {rules.tiers.map((tier) => (
                    <div key={tier.label} className="flex items-start gap-2.5">
                      <span className="inline-flex items-center justify-center rounded-md bg-white border border-gray-200 px-2 py-0.5 text-xs font-bold text-gray-700 min-w-[40px] text-center shadow-sm">
                        {tier.label}
                      </span>
                      <span className="text-sm text-gray-600">{tier.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scoring */}
              <div className="rounded-lg bg-gray-50 p-4">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Scoring</h4>
                <div className="space-y-2.5">
                  {rules.scoring.map((item) => (
                    <div key={item.rule} className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2.5">
                      <span className="text-xs font-bold text-gray-700">
                        {item.rule}
                      </span>
                      <span className="text-sm text-gray-600">{item.detail}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pro tip */}
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
                <span className="text-sm">💡</span>
                <p className="text-sm text-amber-800">{rules.tip}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {parties.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-16 text-center sm:py-20">
          <div className="text-6xl mb-5">🍺</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No parties yet</h2>
          <p className="text-gray-500 mb-8 max-w-sm mx-auto leading-relaxed">
            Create a party to start picking your players or teams, or join one with an invite code.
          </p>
          <Link
            href={`/party/create?sport=${sport}`}
            className="inline-block bg-green-700 hover:bg-green-600 text-white font-medium py-2.5 px-6 rounded-lg transition-colors shadow-sm"
          >
            Create Your First Party
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Active / Ongoing */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              🟢 Active &amp; Upcoming
            </h2>
            {activeParties.length === 0 ? (
              <p className="text-sm text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl px-6 py-8 text-center">
                No active parties - create one for the next tournament!
              </p>
            ) : (
              <div className="space-y-3">
                {activeParties.map((party) => (
                  <PartyCard
                    key={party.id}
                    party={party}
                    isCreator={party.createdBy === user?.uid}
                    isGuestView={godMode && !party.memberUids.includes(user?.uid || "")}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Past / Completed */}
          {pastParties.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                📋 Past Tournaments
              </h2>
              <div className="space-y-3">
                {pastParties.map((party) => (
                  <PartyCard
                    key={party.id}
                    party={party}
                    isCreator={party.createdBy === user?.uid}
                    isGuestView={godMode && !party.memberUids.includes(user?.uid || "")}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Navbar />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </ProtectedRoute>
  );
}
