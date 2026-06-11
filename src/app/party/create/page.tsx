"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { createParty, addInvites } from "@/lib/firestore";
import { fetchCurrentTournaments, fetchDynamicGroups } from "@/lib/sports/golf/espn";
import { calculatePayouts, PAYOUT_PRESETS, type PayoutPresetKey } from "@/lib/payouts";
import { FOOTBALL_LEAGUES } from "@/lib/sports/football/leagues";
import type { Tournament, Party, Player, SportType } from "@/types";
import type { TiebreakerRule } from "@/types";
import { FOOTBALL_TIEBREAKER_OPTIONS, DEFAULT_FOOTBALL_TIEBREAKERS, GOLF_TIEBREAKER_OPTIONS, DEFAULT_GOLF_TIEBREAKERS } from "@/lib/tiebreaker";
import Link from "next/link";

const GroupEditor = dynamic(() => import("@/components/GroupEditor").then(m => ({ default: m.GroupEditor })), { ssr: false });

/* ---------- Football helpers ---------- */

interface FootballRankingTeam {
  id: string;
  displayName: string;
  shortDisplayName: string;
  abbreviation: string;
  logo: string;
  ranking: number;
}

interface FootballRankingsResponse {
  league: string;
  groups: Record<string, FootballRankingTeam[]>;
  wildcards: FootballRankingTeam[];
}

async function fetchFootballRankings(slug: string): Promise<FootballRankingsResponse> {
  const res = await fetch(`/api/football/rankings?league=${slug}`);
  if (!res.ok) throw new Error("Failed to fetch football rankings");
  return res.json();
}

/** Minimal pick item: all we need for Firestore groups */
type PickItem = { id: string; displayName: string };

/** Shared shape for the create callback across sports */
interface CreatePartyData {
  name: string;
  tournamentId: string;
  tournamentName: string;
  tournamentStartDate: string;
  buyIn: number;
  secondPlacePayout: boolean;
  thirdPlacePayout: boolean;
  payoutSplit?: { first: number; second: number; third: number };
  emails: string;
  customGroups: Record<string, PickItem[]> | null;
  wildcards?: PickItem[];
  leagueSlug?: string;
  tiebreakerRules?: import("@/types").TiebreakerRule[];
}

/* ========== Golf-specific content ========== */

function GolfCreateContent({
  onSubmit,
  loading,
  error,
}: {
  onSubmit: (data: CreatePartyData) => void;
  loading: boolean;
  error: string;
}) {
  const [name, setName] = useState("");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [emails, setEmails] = useState("");
  const [buyIn, setBuyIn] = useState(10);
  const [secondPlacePayout, setSecondPlacePayout] = useState(false);
  const [thirdPlacePayout, setThirdPlacePayout] = useState(false);
  const [payoutPreset, setPayoutPreset] = useState<PayoutPresetKey>("winner-takes-more");
  const [payoutSplit, setPayoutSplit] = useState<{ first: number; second: number; third: number } | undefined>(undefined);
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [showGroupEditor, setShowGroupEditor] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [defaultGroups, setDefaultGroups] = useState<Record<string, Player[]>>({ A: [], B: [], C: [], D: [] });
  const [defaultWildcards, setDefaultWildcards] = useState<Player[]>([]);
  const [fieldAvailable, setFieldAvailable] = useState(false);
  const [checkingField, setCheckingField] = useState(false);
  const [customGroups, setCustomGroups] = useState<Record<string, Array<{ id: string; displayName: string }>> | null>(null);
  const [groupsConfirmed, setGroupsConfirmed] = useState(false);
  const [golfTiebreakerRules, setGolfTiebreakerRules] = useState<TiebreakerRule[]>([...DEFAULT_GOLF_TIEBREAKERS]);

  useEffect(() => {
    fetchCurrentTournaments()
      .then((t) => {
        setTournaments(t);
        const major = t.find((tour) => tour.isMajor);
        if (major) setSelectedTournament(major.id);
        else if (t.length > 0) setSelectedTournament(t[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingTournaments(false));
  }, []);

  useEffect(() => {
    if (!selectedTournament) return;
    setCheckingField(true);
    setFieldAvailable(false);
    setShowGroupEditor(false);
    setGroupsConfirmed(false);
    setCustomGroups(null);
    fetchDynamicGroups(selectedTournament)
      .then((data) => setFieldAvailable(data.fieldAvailable))
      .catch(() => setFieldAvailable(false))
      .finally(() => setCheckingField(false));
  }, [selectedTournament]);

  const handleLoadGroups = async () => {
    if (!selectedTournament) return;
    setLoadingGroups(true);
    try {
      const data = await fetchDynamicGroups(selectedTournament);
      setDefaultGroups({ A: data.groups.A, B: data.groups.B, C: data.groups.C, D: data.groups.D });
      setDefaultWildcards(data.wildcards);
      setFieldAvailable(data.fieldAvailable);
      setShowGroupEditor(true);
    } catch {}
    setLoadingGroups(false);
  };

  const handleGroupsSave = (groups: Record<string, import("@/components/GroupEditor").GroupItem[]>) => {
    setCustomGroups(groups);
    setGroupsConfirmed(true);
    setShowGroupEditor(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tournament = tournaments.find((t) => t.id === selectedTournament);
    if (!tournament) return;
    onSubmit({
      name: name.trim(),
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      tournamentStartDate: tournament.startDate,
      buyIn,
      secondPlacePayout,
      thirdPlacePayout,
      payoutSplit,
      emails,
      customGroups: customGroups
        ? Object.fromEntries(
            Object.entries(customGroups).map(([tier, players]) => [
              tier,
              players.map((p) => ({ id: p.id, displayName: p.displayName })),
            ])
          )
        : null,
      tiebreakerRules: golfTiebreakerRules,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6 sm:space-y-8">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Party Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., The Masters 2026 Crew"
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-green-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Tournament</label>
        {loadingTournaments ? (
          <div className="flex items-center gap-2 text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-green-600"></div>
            Loading tournaments...
          </div>
        ) : (
          <select
            value={selectedTournament}
            onChange={(e) => setSelectedTournament(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-green-500"
            required
          >
            {tournaments.some((t) => t.isMajor) && (
              <optgroup label="⭐ Majors">
                {tournaments.filter((t) => t.isMajor).map((t) => {
                  const date = new Date(t.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
                  return (
                    <option key={t.id} value={t.id}>
                      {t.name} - {date}{t.status === "in" ? " 🔴 LIVE" : ""}
                    </option>
                  );
                })}
              </optgroup>
            )}
            <optgroup label="Other Tournaments">
              {tournaments.filter((t) => !t.isMajor).map((t) => {
                const date = new Date(t.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
                return (
                  <option key={t.id} value={t.id}>
                    {t.name} - {date}{t.status === "in" ? " 🔴 LIVE" : ""}
                  </option>
                );
              })}
            </optgroup>
          </select>
        )}
        {checkingField && (
          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
            <span className="animate-spin inline-block h-3 w-3 border-t border-b border-green-600 rounded-full"></span>
            Checking if the tournament field has been announced...
          </p>
        )}
        {!checkingField && selectedTournament && !fieldAvailable && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⏳ The tournament field hasn&apos;t been confirmed on ESPN yet (usually 1-2 days before). You can still create the party. Groups will automatically filter to the confirmed field once it&apos;s published.
          </div>
        )}
        {!checkingField && selectedTournament && fieldAvailable && (
          <p className="text-xs text-green-600 mt-2">✅ Tournament field confirmed - ready to create!</p>
        )}
      </div>

      <BuyInSection buyIn={buyIn} setBuyIn={setBuyIn} secondPlacePayout={secondPlacePayout} setSecondPlacePayout={setSecondPlacePayout} thirdPlacePayout={thirdPlacePayout} setThirdPlacePayout={setThirdPlacePayout} payoutPreset={payoutPreset} setPayoutPreset={setPayoutPreset} payoutSplit={payoutSplit} setPayoutSplit={setPayoutSplit} />

      {/* Tiebreaker Rules */}
      <TiebreakerSection rules={golfTiebreakerRules} onChange={setGolfTiebreakerRules} sport="golf" />

      {/* Group Customisation */}
      <div>
        {!showGroupEditor && !groupsConfirmed && (
          <button
            type="button"
            onClick={handleLoadGroups}
            disabled={loadingGroups || !selectedTournament}
            className="w-full rounded-lg border-2 border-dashed border-gray-300 bg-white py-4 text-sm font-medium text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            {loadingGroups ? "Loading players..." : "⚙️ Customise Player Groups (optional)"}
          </button>
        )}
        {groupsConfirmed && !showGroupEditor && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-800">
                ✅ Custom groups set - {Object.values(customGroups!).reduce((s, g) => s + g.length, 0)} players in groups
              </span>
              <button type="button" onClick={handleLoadGroups} className="text-xs text-green-700 hover:text-green-900 underline">Edit</button>
            </div>
          </div>
        )}
        {showGroupEditor && (
          <GroupEditor
            groups={customGroups || defaultGroups}
            wildcards={customGroups ? [] : defaultWildcards}
            fieldAvailable={fieldAvailable}
            onSave={handleGroupsSave}
          />
        )}
      </div>

      <InviteSection emails={emails} setEmails={setEmails} />

      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <button
        type="submit"
        disabled={loading || !name.trim() || !selectedTournament}
        className="w-full bg-green-700 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Creating..." : "Create Party"}
      </button>
    </form>
  );
}

/* ========== Football-specific content ========== */

/** Convert an ISO date string to a datetime-local input value (YYYY-MM-DDTHH:MM) in local time */
function toDatetimeLocal(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function FootballCreateContent({
  onSubmit,
  loading,
  error,
}: {
  onSubmit: (data: CreatePartyData) => void;
  loading: boolean;
  error: string;
}) {
  const leagueEntries = Object.values(FOOTBALL_LEAGUES);
  const [selectedLeague, setSelectedLeague] = useState(leagueEntries[0]?.slug || "fifa.world");
  const [name, setName] = useState("");
  const [emails, setEmails] = useState("");
  const [buyIn, setBuyIn] = useState(10);
  const [secondPlacePayout, setSecondPlacePayout] = useState(false);
  const [thirdPlacePayout, setThirdPlacePayout] = useState(false);
  const [payoutPreset, setPayoutPreset] = useState<PayoutPresetKey>("winner-takes-more");
  const [payoutSplit, setPayoutSplit] = useState<{ first: number; second: number; third: number } | undefined>(undefined);
  const [rankings, setRankings] = useState<FootballRankingsResponse | null>(null);
  const [loadingRankings, setLoadingRankings] = useState(false);
  const [showGroupEditor, setShowGroupEditor] = useState(false);
  const [customGroups, setCustomGroups] = useState<Record<string, PickItem[]> | null>(null);
  const [groupsConfirmed, setGroupsConfirmed] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [tiebreakerRules, setTiebreakerRules] = useState<TiebreakerRule[]>([...DEFAULT_FOOTBALL_TIEBREAKERS]);

  const leagueConfig = FOOTBALL_LEAGUES[selectedLeague];
  const isCountry = leagueConfig?.teamType === "country";
  const entityLabel = isCountry ? "Country" : "Club";
  const entitiesLabel = isCountry ? "Countries" : "Clubs";
  const editorEntityType = isCountry ? "country" as const : "team" as const;

  // Auto-set a default name based on league
  useEffect(() => {
    const league = FOOTBALL_LEAGUES[selectedLeague];
    if (league && !name) {
      setName(`${league.shortName} Party`);
    }
  }, [selectedLeague]);

  // Fetch rankings when league changes
  useEffect(() => {
    setLoadingRankings(true);
    setRankings(null);
    setShowGroupEditor(false);
    setCustomGroups(null);
    setGroupsConfirmed(false);
    setCustomStartDate("");
    fetchFootballRankings(selectedLeague)
      .then(setRankings)
      .catch(() => {})
      .finally(() => setLoadingRankings(false));
  }, [selectedLeague]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const league = FOOTBALL_LEAGUES[selectedLeague];
    if (!league || !name.trim() || !rankings) return;

    // Use custom groups if user customised, otherwise default from rankings
    const finalGroups = customGroups
      ? customGroups
      : Object.fromEntries(
          Object.entries(rankings.groups).map(([tier, teams]) => [
            tier,
            teams.map((t) => ({ id: t.id, displayName: t.displayName })),
          ])
        );

    // Compute wildcards: teams not in any group
    let finalWildcards: PickItem[];
    if (customGroups) {
      const groupedIds = new Set(
        Object.values(customGroups).flatMap((g) => g.map((t) => t.id))
      );
      const allTeams = [
        ...Object.values(rankings.groups).flat(),
        ...rankings.wildcards,
      ];
      finalWildcards = allTeams
        .filter((t) => !groupedIds.has(t.id))
        .map((t) => ({ id: t.id, displayName: t.displayName }));
    } else {
      finalWildcards = rankings.wildcards.map((t) => ({ id: t.id, displayName: t.displayName }));
    }

    onSubmit({
      name: name.trim(),
      tournamentId: league.espnId,
      tournamentName: league.name,
      tournamentStartDate: customStartDate
        ? new Date(customStartDate).toISOString()
        : league.startDate,
      buyIn,
      secondPlacePayout,
      thirdPlacePayout,
      payoutSplit,
      emails,
      customGroups: finalGroups,
      wildcards: finalWildcards,
      leagueSlug: selectedLeague,
      tiebreakerRules,
    });
  };

  const handleGroupsSave = (groups: Record<string, import("@/components/GroupEditor").GroupItem[]>) => {
    setCustomGroups(
      Object.fromEntries(
        Object.entries(groups).map(([tier, items]) => [
          tier,
          items.map((t) => ({ id: t.id, displayName: t.displayName })),
        ])
      )
    );
    setGroupsConfirmed(true);
    setShowGroupEditor(false);
  };

  // Build GroupEditor-compatible items from rankings
  const rankingsToGroupItems = () => {
    if (!rankings) return { groups: { A: [], B: [], C: [], D: [] }, wildcards: [] };
    const toItems = (teams: FootballRankingTeam[]) =>
      teams.map((t) => ({ id: t.id, displayName: t.displayName, logo: t.logo }));
    return {
      groups: Object.fromEntries(
        Object.entries(rankings.groups).map(([tier, teams]) => [tier, toItems(teams)])
      ),
      wildcards: toItems(rankings.wildcards),
    };
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6 sm:space-y-8">
      {/* League picker */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">League / Competition</label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {leagueEntries.map((league) => (
            <button
              key={league.slug}
              type="button"
              onClick={() => { setSelectedLeague(league.slug); setName(""); }}
              className={`rounded-lg border-2 px-4 py-3 text-left transition-all ${
                selectedLeague === league.slug
                  ? "border-blue-600 bg-blue-50 ring-2 ring-blue-200"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="text-sm font-semibold text-gray-900">{league.shortName}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {league.type === "tournament" ? "Tournament" : "Season"} · {league.teamType === "country" ? "Countries" : "Clubs"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Party name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Party Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`e.g., ${FOOTBALL_LEAGUES[selectedLeague]?.shortName || "World Cup"} Lads`}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      {/* Team/Country groups preview + customise */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{entityLabel} Groups</label>
        {loadingRankings ? (
          <div className="flex items-center gap-2 text-gray-500 py-4">
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-600"></div>
            Loading {entitiesLabel.toLowerCase()}...
          </div>
        ) : rankings && showGroupEditor ? (
          <GroupEditor
            groups={rankingsToGroupItems().groups}
            wildcards={rankingsToGroupItems().wildcards}
            fieldAvailable={true}
            onSave={handleGroupsSave}
            entityType={editorEntityType}
          />
        ) : rankings ? (
          <div className="space-y-3">
            {groupsConfirmed && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-800">
                    ✅ Custom groups set - {Object.values(customGroups!).reduce((s, g) => s + g.length, 0)} {entitiesLabel.toLowerCase()} in tiers
                  </span>
                  <button type="button" onClick={() => setShowGroupEditor(true)} className="text-xs text-green-700 hover:text-green-900 underline">
                    Edit
                  </button>
                </div>
              </div>
            )}
            {!groupsConfirmed && (
              <>
                {(["A", "B", "C", "D"] as const).map((tier) => (
                  <div key={tier} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Tier {tier}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {rankings.groups[tier]?.map((team) => (
                        <div
                          key={team.id}
                          className="flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-200 px-3 py-1"
                        >
                          {team.logo && (
                            <img src={team.logo} alt="" className="h-4 w-4 object-contain" />
                          )}
                          <span className="text-xs font-medium text-gray-700">{team.shortDisplayName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {rankings.wildcards.length > 0 && (
                  <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Wildcards ({rankings.wildcards.length} {entitiesLabel.toLowerCase()})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {rankings.wildcards.map((team) => (
                        <div
                          key={team.id}
                          className="flex items-center gap-1.5 rounded-full bg-white border border-gray-200 px-3 py-1"
                        >
                          {team.logo && (
                            <img src={team.logo} alt="" className="h-4 w-4 object-contain" />
                          )}
                          <span className="text-xs text-gray-600">{team.shortDisplayName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-400">
                  {isCountry ? "Countries" : "Teams"} are ranked by {selectedLeague === "fifa.world" ? "FIFA World Rankings" : selectedLeague === "eng.1" ? "last season standings" : "UEFA coefficient"} and split into 4 tiers. Each member picks 1 {entityLabel.toLowerCase()} per tier + 2 wildcards.
                </p>
                <button
                  type="button"
                  onClick={() => setShowGroupEditor(true)}
                  className="w-full rounded-lg border-2 border-dashed border-gray-300 bg-white py-3 text-sm font-medium text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition-all"
                >
                  ⚙️ Customise {entityLabel} Groups
                </button>
              </>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Select a league to see {entitiesLabel.toLowerCase()} groups</p>
        )}
      </div>

      {/* Picks lock date */}
      {rankings && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Picks Lock Date</label>
          <p className="text-xs text-gray-400 mb-2">
            Picks lock at this time. Defaults to the official {leagueConfig?.type === "tournament" ? "tournament" : "season"} start.
          </p>
          <input
            type="datetime-local"
            value={customStartDate || toDatetimeLocal(leagueConfig?.startDate || "")}
            onChange={(e) => setCustomStartDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
          />
          {customStartDate && customStartDate !== toDatetimeLocal(leagueConfig?.startDate || "") && (
            <button
              type="button"
              onClick={() => setCustomStartDate("")}
              className="mt-1 text-xs text-blue-600 hover:text-blue-800 underline"
            >
              Reset to default ({new Date(leagueConfig?.startDate || "").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })})
            </button>
          )}
          {customStartDate && new Date(customStartDate) < new Date() && (
            <p className="mt-1 text-xs text-amber-600">
              ⚠️ This date is in the past. Picks will lock immediately when the party is created.
            </p>
          )}
        </div>
      )}

      <BuyInSection buyIn={buyIn} setBuyIn={setBuyIn} secondPlacePayout={secondPlacePayout} setSecondPlacePayout={setSecondPlacePayout} thirdPlacePayout={thirdPlacePayout} setThirdPlacePayout={setThirdPlacePayout} payoutPreset={payoutPreset} setPayoutPreset={setPayoutPreset} payoutSplit={payoutSplit} setPayoutSplit={setPayoutSplit} />

      {/* Tiebreaker Rules */}
      <TiebreakerSection rules={tiebreakerRules} onChange={setTiebreakerRules} sport="football" />

      <InviteSection emails={emails} setEmails={setEmails} />

      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <button
        type="submit"
        disabled={loading || !name.trim() || !rankings}
        className="w-full bg-blue-700 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Creating..." : "Create Party"}
      </button>
    </form>
  );
}

/* ========== Shared components ========== */

function TiebreakerSection({
  rules,
  onChange,
  sport = "football",
}: {
  rules: TiebreakerRule[];
  onChange: (rules: TiebreakerRule[]) => void;
  sport?: "golf" | "football";
}) {
  const allOptions = sport === "golf" ? GOLF_TIEBREAKER_OPTIONS : FOOTBALL_TIEBREAKER_OPTIONS;
  const availableToAdd = allOptions.filter(
    (opt) => !rules.some((r) => r.id === opt.id)
  );

  const moveRule = (index: number, direction: "up" | "down") => {
    const newRules = [...rules];
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newRules.length) return;
    [newRules[index], newRules[swapIdx]] = [newRules[swapIdx], newRules[index]];
    onChange(newRules);
  };

  const removeRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  const addRule = (id: string) => {
    const rule = allOptions.find((r) => r.id === id);
    if (rule) onChange([...rules, rule]);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Tiebreaker Rules</label>
      <p className="text-xs text-gray-400 mb-3">
        When players are tied on points, these rules are applied in order to break the tie.
      </p>

      {rules.length === 0 && (
        <p className="text-xs text-amber-600 mb-2">⚠️ No tiebreaker rules set. Ties will remain unbroken.</p>
      )}

      <div className="space-y-2 mb-3">
        {rules.map((rule, index) => (
          <div
            key={rule.id}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
          >
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-gray-800">{rule.label}</span>
              <span className="hidden sm:inline text-xs text-gray-400 ml-2">{rule.description}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => moveRule(index, "up")}
                disabled={index === 0}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
                title="Move up"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M11.78 9.78a.75.75 0 0 1-1.06 0L8 7.06 5.28 9.78a.75.75 0 0 1-1.06-1.06l3.25-3.25a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06Z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => moveRule(index, "down")}
                disabled={index === rules.length - 1}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
                title="Move down"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 0 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => removeRule(index)}
                className="p-1 text-red-300 hover:text-red-500 transition-colors"
                title="Remove"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {availableToAdd.length > 0 && (
        <select
          onChange={(e) => { addRule(e.target.value); e.target.value = ""; }}
          defaultValue=""
          className="w-full rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500 hover:border-gray-400 transition-colors"
        >
          <option value="" disabled>+ Add tiebreaker rule...</option>
          {availableToAdd.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      )}
    </div>
  );
}

function BuyInSection({
  buyIn, setBuyIn, secondPlacePayout, setSecondPlacePayout, thirdPlacePayout, setThirdPlacePayout,
  payoutPreset, setPayoutPreset, payoutSplit, setPayoutSplit,
}: {
  buyIn: number; setBuyIn: (v: number) => void;
  secondPlacePayout: boolean; setSecondPlacePayout: (v: boolean) => void;
  thirdPlacePayout: boolean; setThirdPlacePayout: (v: boolean) => void;
  payoutPreset: PayoutPresetKey; setPayoutPreset: (v: PayoutPresetKey) => void;
  payoutSplit: { first: number; second: number; third: number } | undefined;
  setPayoutSplit: (v: { first: number; second: number; third: number } | undefined) => void;
}) {
  const splitMode = thirdPlacePayout ? "3-way" : "2-way";
  const presets = PAYOUT_PRESETS[splitMode];

  const handlePresetChange = (key: PayoutPresetKey) => {
    setPayoutPreset(key);
    if (key === "custom") {
      const defaultSplit = thirdPlacePayout
        ? { first: 55, second: 30, third: 15 }
        : { first: 65, second: 35, third: 0 };
      setPayoutSplit(defaultSplit);
    } else {
      const preset = presets[key as keyof typeof presets];
      if (preset) {
        setPayoutSplit({ first: preset.first, second: preset.second, third: preset.third });
      } else {
        setPayoutSplit(undefined);
      }
    }
  };

  const handleCustomSplitChange = (field: "first" | "second" | "third", value: number) => {
    const current = payoutSplit || { first: 55, second: 30, third: 15 };
    setPayoutSplit({ ...current, [field]: value });
  };

  const customSplitTotal = payoutSplit ? payoutSplit.first + payoutSplit.second + payoutSplit.third : 100;
  const customSplitValid = customSplitTotal === 100;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Buy-in Amount</label>
        <div className="flex gap-3">
          {[10, 20, 30].map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => setBuyIn(amount)}
              className={`flex-1 py-3 rounded-lg border-2 text-center font-semibold transition-all ${
                buyIn === amount
                  ? "border-green-600 bg-green-50 text-green-800 ring-2 ring-green-200"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}
            >
              €{amount}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={secondPlacePayout}
          onChange={(e) => {
            setSecondPlacePayout(e.target.checked);
            if (!e.target.checked) {
              setThirdPlacePayout(false);
              setPayoutPreset("winner-takes-more");
              setPayoutSplit(undefined);
            }
          }}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
        />
        <div>
          <span className="text-sm font-medium text-gray-700">🥈 2nd place gets a payout</span>
        </div>
      </label>

      {secondPlacePayout && (
        <label className="flex items-start gap-3 cursor-pointer ml-7">
          <input
            type="checkbox"
            checked={thirdPlacePayout}
            onChange={(e) => {
              setThirdPlacePayout(e.target.checked);
              setPayoutPreset("winner-takes-more");
              setPayoutSplit(undefined);
            }}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <div>
            <span className="text-sm font-medium text-gray-700">🥉 3rd place gets a payout too</span>
          </div>
        </label>
      )}

      {secondPlacePayout && (
        <div className="ml-7 space-y-2">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Split</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(presets) as [string, { label: string; first: number; second: number; third: number }][]).map(
              ([key, preset]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handlePresetChange(key as PayoutPresetKey)}
                  className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all text-center ${
                    payoutPreset === key
                      ? "border-green-600 bg-green-50 text-green-800 ring-1 ring-green-200"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <span className="block">{preset.label}</span>
                  <span className="block text-[10px] text-gray-400 mt-0.5">{preset.first}/{preset.second}{thirdPlacePayout ? `/${preset.third}` : ""}%</span>
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => handlePresetChange("custom")}
              className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all text-center ${
                payoutPreset === "custom"
                  ? "border-green-600 bg-green-50 text-green-800 ring-1 ring-green-200"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              <span className="block">Custom</span>
              <span className="block text-[10px] text-gray-400 mt-0.5">Set your own</span>
            </button>
          </div>

          {payoutPreset === "custom" && (
            <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-600 w-8">1st</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={payoutSplit?.first ?? 55}
                  onChange={(e) => handleCustomSplitChange("first", parseInt(e.target.value) || 0)}
                  className="w-16 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
                />
                <span className="text-xs text-gray-400">%</span>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-600 w-8">2nd</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={payoutSplit?.second ?? 30}
                  onChange={(e) => handleCustomSplitChange("second", parseInt(e.target.value) || 0)}
                  className="w-16 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
                />
                <span className="text-xs text-gray-400">%</span>
              </div>
              {thirdPlacePayout && (
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-600 w-8">3rd</label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={payoutSplit?.third ?? 15}
                    onChange={(e) => handleCustomSplitChange("third", parseInt(e.target.value) || 0)}
                    className="w-16 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
                  />
                  <span className="text-xs text-gray-400">%</span>
                </div>
              )}
              {!customSplitValid && (
                <p className="text-xs text-red-500">
                  Percentages must add up to 100% (currently {customSplitTotal}%)
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {(() => {
        const preview = calculatePayouts({
          buyIn, currency: "EUR", secondPlacePayout, thirdPlacePayout, payoutSplit,
          memberUids: ["1","2","3","4","5","6","7","8","9","10"],
        } as Party);
        return (
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-xs text-gray-600">
            <p className="font-medium text-gray-700 mb-1">Payout preview (10 players):</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>🏆 1st: <strong className="text-emerald-700">€{preview.first}</strong></span>
              {secondPlacePayout && <span>🥈 2nd: <strong>€{preview.second}</strong></span>}
              {thirdPlacePayout && <span>🥉 3rd: <strong>€{preview.third}</strong></span>}
              <span className="text-gray-400">Pot: €{preview.totalPot}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function InviteSection({ emails, setEmails }: { emails: string; setEmails: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Invite Friends (optional)</label>
      <textarea
        value={emails}
        onChange={(e) => setEmails(e.target.value)}
        placeholder="Enter email addresses, separated by commas or new lines"
        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-green-500"
        rows={3}
      />
      <p className="mt-2 text-xs leading-5 text-gray-400 sm:text-sm">
        Separate emails with commas or new lines.
        Invitees will see the party when they sign in with the same email.
        You can also share the invite code after creation.
      </p>
    </div>
  );
}

/* ========== Main page component ========== */

function CreatePartyContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sport = (searchParams.get("sport") as SportType) || "golf";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isFootball = sport === "football";
  const sportEmoji = isFootball ? "⚽" : "⛳";
  const sportLabel = isFootball ? "Football" : "Golf";

  const handleCreate = async (data: CreatePartyData) => {
    if (!user) return;
    setLoading(true);
    setError("");

    try {
      // Build groups for Firestore
      let groupsForFirestore: Party["customGroups"] | undefined;
      let wildcardsForFirestore: Party["snapshotWildcards"] | undefined;

      if (isFootball && data.customGroups) {
        // Football: groups and wildcards come from rankings API
        groupsForFirestore = Object.fromEntries(
          Object.entries(data.customGroups).map(([tier, items]) => [
            tier,
            items.map((t) => ({ id: t.id, displayName: t.displayName })),
          ])
        ) as Party["customGroups"];
        wildcardsForFirestore = (data.wildcards || []).map((t) => ({
          id: t.id,
          displayName: t.displayName,
        }));
      } else if (!isFootball) {
        // Golf: fetch dynamic groups and snapshot them
        const dynamicData = await fetchDynamicGroups(data.tournamentId);
        const toSnapshot = (items: Array<{ id: string; displayName: string }>) =>
          items.map((p) => ({ id: p.id, displayName: p.displayName }));

        if (data.customGroups) {
          groupsForFirestore = {
            A: toSnapshot(data.customGroups.A || []),
            B: toSnapshot(data.customGroups.B || []),
            C: toSnapshot(data.customGroups.C || []),
            D: toSnapshot(data.customGroups.D || []),
          };

          const groupedIds = new Set(
            Object.values(groupsForFirestore).flatMap((g) => g.map((p) => p.id))
          );
          const allPlayers = [
            ...dynamicData.groups.A, ...dynamicData.groups.B,
            ...dynamicData.groups.C, ...dynamicData.groups.D,
            ...dynamicData.wildcards,
          ];
          wildcardsForFirestore = allPlayers
            .filter((p) => !groupedIds.has(p.id))
            .map((p) => ({ id: p.id, displayName: p.displayName }));
        } else {
          groupsForFirestore = {
            A: toSnapshot(dynamicData.groups.A),
            B: toSnapshot(dynamicData.groups.B),
            C: toSnapshot(dynamicData.groups.C),
            D: toSnapshot(dynamicData.groups.D),
          };
          wildcardsForFirestore = toSnapshot(dynamicData.wildcards);
        }
      }

      const party = await createParty(
        data.name,
        user.uid,
        data.tournamentId,
        data.tournamentName,
        data.tournamentStartDate,
        data.buyIn,
        "EUR",
        data.secondPlacePayout,
        data.thirdPlacePayout,
        groupsForFirestore,
        wildcardsForFirestore,
        isFootball ? "football" : "golf",
        data.leagueSlug,
        data.payoutSplit,
        data.tiebreakerRules,
      );

      // Handle email invites
      const emailList = data.emails
        .split(/[,\n]/)
        .map((e) => e.trim())
        .filter((e) => e.length > 0);

      if (emailList.length > 0) {
        await addInvites(party.id, emailList, user.uid);
        try {
          const idToken = await user.getIdToken();
          const emailRes = await fetch("/api/invite", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              emails: emailList,
              partyName: data.name,
              inviteCode: party.inviteCode,
              invitedBy: user.displayName || user.email || "Someone",
            }),
          });
          const emailData = await emailRes.json();
          if (emailData.sent > 0) {
            router.push(`/party/${party.id}?emailsSent=${emailData.sent}&emailsFailed=${emailData.failed || 0}`);
            return;
          }
        } catch {
          // Email sending failed but party was created
        }
      }

      router.push(`/party/${party.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create party");
      setLoading(false);
    }
  };

  return (
    <div className="w-full px-4 py-8 sm:px-8 sm:py-10 lg:px-12" style={{ maxWidth: "800px", margin: "0 auto" }}>
      <div className="mb-2">
        <Link href={`/dashboard?sport=${sport}`} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Back to {sportLabel} Parties
        </Link>
      </div>
      <h1 className="mb-8 text-2xl font-bold text-gray-900 sm:mb-10 sm:text-3xl">
        {sportEmoji} Create a {sportLabel} Party
      </h1>

      {isFootball ? (
        <FootballCreateContent onSubmit={handleCreate} loading={loading} error={error} />
      ) : (
        <GolfCreateContent onSubmit={handleCreate} loading={loading} error={error} />
      )}
    </div>
  );
}

export default function CreatePartyPage() {
  return (
    <ProtectedRoute>
      <Navbar />
      <CreatePartyContent />
    </ProtectedRoute>
  );
}
