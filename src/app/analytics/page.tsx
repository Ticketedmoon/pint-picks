"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import {
  buildPartyActivity,
  extractCounterMap,
  formatRelativeTime,
  type PartyActivity,
  type PartyRecord,
  type RawTournamentDoc,
} from "@/lib/partyAnalytics";

const CACHE_KEY = "analytics_party_cache";
const CACHE_TTL_MS = 5 * 60 * 1000;

function sportIcon(sport: string): string {
  if (sport === "football" || sport === "soccer") return "⚽";
  return "⛳";
}

function exactTime(iso: string): string {
  if (!iso) return "Never visited";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Never visited";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AnalyticsPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [parties, setParties] = useState<PartyActivity[] | null>(null);
  const [error, setError] = useState("");
  const [fetching, setFetching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchData = async (email: string, bypassCache = false) => {
    if (!bypassCache) {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL_MS) {
            setParties(data);
            return;
          }
        }
      } catch {
        // Ignore cache errors
      }
    }

    setFetching(true);
    setError("");

    const adminEmail = process.env.NEXT_PUBLIC_ANALYTICS_ADMIN_EMAIL;
    if (!adminEmail || email !== adminEmail) {
      setError("Access denied - your account is not authorized to view analytics.");
      setParties(null);
      setFetching(false);
      return;
    }

    try {
      const db = getFirebaseDb();
      const [tournamentSnap, usersSnap, partiesSnap] = await Promise.all([
        getDocs(collection(db, "analytics_tournament")),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "parties")),
      ]);

      const uidToName: Record<string, string> = {};
      const uidToEmail: Record<string, string> = {};
      for (const u of usersSnap.docs) {
        const d = u.data();
        uidToName[u.id] = (d.displayName as string) || (d.email as string) || u.id.slice(0, 8);
        if (d.email) uidToEmail[u.id] = d.email as string;
      }

      const docs: RawTournamentDoc[] = tournamentSnap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          uid: (data.uid as string) || d.id.split("_")[0] || "",
          email: (data.email as string) || null,
          totalViews: (data.totalViews as number) || 0,
          lastVisit: (data.lastVisit as string) || "",
          // usePageView stores per-page counts as literal dotted fields
          // ("pages._party_xyz") because setDoc-merge does not nest dotted keys.
          pages: extractCounterMap(data, "pages"),
        };
      });

      const partyRecords: PartyRecord[] = partiesSnap.docs.map((p) => {
        const d = p.data();
        return {
          id: p.id,
          name: (d.name as string) || "Unnamed Party",
          createdBy: (d.createdBy as string) || "",
          memberUids: (d.memberUids as string[]) || [],
          sportType: (d.sportType as string) || "golf",
          tournamentId: (d.tournamentId as string) || "",
          tournamentName: (d.tournamentName as string) || "",
        };
      });

      const result = buildPartyActivity(partyRecords, docs, uidToName, uidToEmail);
      setParties(result);

      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: result, timestamp: Date.now() }));
      } catch {
        // Storage full or unavailable - ignore
      }
    } catch (err) {
      console.error("Analytics fetch error:", err);
      setError("Failed to load analytics: " + String(err));
    }
    setFetching(false);
  };

  useEffect(() => {
    if (!loading && user?.email) {
      fetchData(user.email);
    }
  }, [user, loading]);

  const selected = useMemo(
    () => (selectedId ? parties?.find((p) => p.id === selectedId) ?? null : null),
    [selectedId, parties]
  );

  // Not signed in - show login
  if (!loading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-900 via-green-800 to-emerald-900 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl text-center">
          <div className="mb-4 text-5xl">📊</div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-600 mb-6">Sign in to view party analytics. Admin access only.</p>
          <button
            onClick={signInWithGoogle}
            className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  // Access denied
  if (error && !fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
          <div className="mb-4 text-5xl">🚫</div>
          <h1 className="mb-2 text-xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-sm text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-lg bg-green-700 px-6 py-2 text-sm font-medium text-white hover:bg-green-600 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Loading
  if (loading || (fetching && !parties)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!parties) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Party Analytics</h1>
            <p className="mt-1 text-sm text-gray-500">
              {selected ? "Leaderboard engagement per member" : "Pick a party to see who's watching the leaderboard"}
            </p>
          </div>
          <button
            onClick={() => user?.email && fetchData(user.email, true)}
            disabled={fetching}
            className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
          >
            {fetching ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>

        {!selected ? (
          /* ---------------- Party list ---------------- */
          parties.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
              <div className="mb-2 text-4xl">🏌️</div>
              <p className="text-sm text-gray-500">No parties yet.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {parties.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => setSelectedId(p.id)}
                    className="flex w-full items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:border-green-400 hover:shadow-md"
                  >
                    <div className="text-3xl">{sportIcon(p.sportType)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-gray-900">{p.name}</div>
                      <div className="truncate text-xs text-gray-500">
                        {p.tournamentName || "No tournament"} · by {p.creatorName}
                      </div>
                      <div className="mt-1 text-xs text-gray-400">
                        {p.activeCount}/{p.memberCount} active · last visit {formatRelativeTime(p.lastVisit)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xl font-bold text-green-700">{p.totalViews}</div>
                      <div className="text-[10px] uppercase tracking-wide text-gray-400">views</div>
                    </div>
                    <div className="shrink-0 text-gray-300">›</div>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          /* ---------------- Party detail ---------------- */
          <div>
            <button
              onClick={() => setSelectedId(null)}
              className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-green-700 hover:text-green-800"
            >
              ‹ All parties
            </button>

            <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="text-3xl">{sportIcon(selected.sportType)}</div>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-bold text-gray-900">{selected.name}</h2>
                  <p className="truncate text-xs text-gray-500">
                    {selected.tournamentName || "No tournament"} · by {selected.creatorName}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-gray-50 py-3">
                  <div className="text-lg font-bold text-gray-900">{selected.totalViews}</div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-400">Total views</div>
                </div>
                <div className="rounded-xl bg-gray-50 py-3">
                  <div className="text-lg font-bold text-gray-900">
                    {selected.activeCount}/{selected.memberCount}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-400">Active</div>
                </div>
                <div className="rounded-xl bg-gray-50 py-3">
                  <div className="text-lg font-bold text-gray-900">{formatRelativeTime(selected.lastVisit)}</div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-400">Last visit</div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="grid grid-cols-12 gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                <div className="col-span-6">Member</div>
                <div className="col-span-2 text-right">Views</div>
                <div className="col-span-4 text-right">Last visit</div>
              </div>
              <ul className="divide-y divide-gray-100">
                {selected.members.map((m, i) => (
                  <li key={m.uid} className="grid grid-cols-12 items-center gap-2 px-4 py-3">
                    <div className="col-span-6 flex min-w-0 items-center gap-3">
                      <span className="w-5 shrink-0 text-right text-xs font-medium text-gray-400">{i + 1}</span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-gray-900">{m.name}</div>
                        {m.email && <div className="truncate text-xs text-gray-400">{m.email}</div>}
                      </div>
                    </div>
                    <div className="col-span-2 text-right">
                      <span
                        className={`text-sm font-semibold ${m.views > 0 ? "text-green-700" : "text-gray-300"}`}
                      >
                        {m.views}
                      </span>
                    </div>
                    <div className="col-span-4 text-right" title={exactTime(m.lastVisit)}>
                      <span className={`text-xs ${m.lastVisit ? "text-gray-600" : "text-gray-300"}`}>
                        {formatRelativeTime(m.lastVisit)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-3 text-center text-[11px] text-gray-400">
              Views count how many times each member opened this party&apos;s leaderboard page.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
