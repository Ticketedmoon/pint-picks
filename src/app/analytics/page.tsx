"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { collection, doc, getDocs, setDoc, increment } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

interface AnalyticsData {
  totalViews: number;
  totalClicks: number;
  uniqueUsers: number;
  byPage: Record<string, number>;
  byBrowser: Record<string, number>;
  byTimezone: Record<string, number>;
  dailyVisits: { date: string; label: string; count: number }[];
  byUser: Record<string, { email: string | null; views: number; clicks: number; lastVisit: string; pages: Record<string, number>; dailyDates: Record<string, number> }>;
  tournamentDocs: TournamentAnalytics[];
  tournamentNames: Record<string, string>;
  systemHealth: SystemHealth;
}

interface SystemHealth {
  userCount: number;
  partyCount: number;
  analyticsDocs: number;
  estimatedDailyReads: number;
  estimatedDailyWrites: number;
}

interface TournamentAnalytics {
  docId: string;
  uid: string;
  tournamentId: string;
  email: string | null;
  totalViews: number;
  totalClicks: number;
  pages: Record<string, number>;
  browsers: Record<string, number>;
  lastVisit: string;
}

function sortedEntries(obj: Record<string, number> | undefined | null): [string, number][] {
  if (!obj) return [];
  return Object.entries(obj).sort((a, b) => b[1] - a[1]);
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function BreakdownChart({ title, data, color = "bg-green-500" }: { title: string; data: [string, number][]; color?: string }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map(([, c]) => c), 1);
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>
      <div className="px-4 py-3 space-y-2">
        {data.slice(0, 10).map(([key, count]) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs text-gray-600 truncate max-w-[70%]">{key}</span>
              <span className="text-xs font-bold text-gray-900">{count}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${(count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DailyChart({ data }: { data: { date: string; label: string; count: number }[] | undefined }) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden mb-8">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">Daily Activity</h3>
        </div>
        <div className="px-4 py-8 text-center text-sm text-gray-400">
          No daily data yet. The chart will populate as users browse the site.
        </div>
      </div>
    );
  }
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden mb-8">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">Daily Activity</h3>
      </div>
      <div className="px-4 py-4">
        <div className="flex items-end gap-1" style={{ height: "160px" }}>
          {data.map((d) => {
            const heightPct = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
            return (
              <div key={d.date} className="group relative flex flex-1 flex-col items-center justify-end h-full">
                <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 whitespace-nowrap z-10">
                  {d.count} visit{d.count !== 1 ? "s" : ""}
                </div>
                <div
                  className="w-full min-h-[2px] rounded-t bg-green-600 transition-all group-hover:bg-green-500"
                  style={{ height: `${Math.max(heightPct, 1.5)}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex gap-1">
          {data.map((d, i) => {
            const showLabel = data.length <= 14 || i % Math.ceil(data.length / 10) === 0 || i === data.length - 1;
            return (
              <div key={d.date} className="flex-1 text-center">
                {showLabel && <span className="text-[9px] text-gray-400 sm:text-[10px]">{d.label}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CapacityGauge({ label, current, limit, unit, warningAt }: {
  label: string;
  current: number;
  limit: number;
  unit: string;
  warningAt?: number;
}) {
  const pct = Math.min((current / limit) * 100, 100);
  const threshold = warningAt ?? 0.7;
  const ratio = current / limit;
  const color = ratio >= 0.9 ? "bg-red-500" : ratio >= threshold ? "bg-amber-500" : "bg-green-500";
  const textColor = ratio >= 0.9 ? "text-red-700" : ratio >= threshold ? "text-amber-700" : "text-green-700";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className={`text-xs font-bold ${textColor}`}>
          {current.toLocaleString()} / {limit.toLocaleString()} {unit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {ratio >= 0.9 && (
        <p className="mt-1 text-[10px] font-medium text-red-600">⚠️ Approaching limit, consider upgrading</p>
      )}
      {ratio >= threshold && ratio < 0.9 && (
        <p className="mt-1 text-[10px] font-medium text-amber-600">Monitor closely</p>
      )}
    </div>
  );
}

/** Firestore free tier limits */
const LIMITS = {
  firestoreReadsPerDay: 50_000,
  firestoreWritesPerDay: 20_000,
  firestoreStorage: 1_073_741_824, // 1 GiB in bytes
  vercelInvocationsPerMonth: 100_000,
  vercelBandwidthGB: 100,
};

/**
 * Estimate daily Firestore reads based on user count and app behavior.
 * Per user visit:
 *   - Party page: ~8 reads (party + picks + users + leaderboard)
 *   - Auto-refresh: same 8 reads every 5 min for ~2 hours = ~24 refreshes = ~192 reads
 *   - Dashboard: ~3 reads
 *   - Analytics: ~3 reads (admin only)
 * Conservative estimate: ~200 reads per active user per day during a tournament.
 */
function estimateDailyReads(userCount: number, partyCount: number): number {
  const activeUsersPerDay = Math.ceil(userCount * 0.6);
  return activeUsersPerDay * 200 + partyCount * 10;
}

/**
 * Estimate daily Firestore writes.
 * Per user visit:
 *   - Analytics: 1 write (aggregated doc update)
 *   - Last visit: 1 write (debounced)
 *   - Picks save: 1 write (once per tournament)
 * Conservative estimate: ~5 writes per active user per day.
 */
function estimateDailyWrites(userCount: number): number {
  const activeUsersPerDay = Math.ceil(userCount * 0.6);
  return activeUsersPerDay * 5;
}

/**
 * Estimate monthly Vercel serverless invocations.
 * Only API route calls count (not client-side Firestore reads).
 * Per user per session: ~2 ESPN proxy calls per refresh, ~24 refreshes over 2 hours = ~48
 * Plus rankings, invite, notification routes (rare).
 * Conservative: ~50 invocations per active user per day.
 */
function estimateMonthlyVercelInvocations(userCount: number): number {
  const activeUsersPerDay = Math.ceil(userCount * 0.6);
  return activeUsersPerDay * 50 * 30;
}

export default function AnalyticsPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState("");
  const [fetching, setFetching] = useState(false);

  const fetchData = async (email: string, bypassCache = false) => {
    // Try sessionStorage cache first
    if (!bypassCache) {
      try {
        const cached = sessionStorage.getItem("analytics_cache");
        if (cached) {
          const { data: cachedData, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 10 * 60 * 1000) {
            setData(cachedData);
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
      setData(null);
      setFetching(false);
      return;
    }

    try {
      const db = getFirebaseDb();

      // Fetch analytics, last-visit, users, and parties counts in parallel
      const [generalSnap, tournamentSnap, usersSnap, partiesSnap] = await Promise.all([
        getDocs(collection(db, "analytics_general")),
        getDocs(collection(db, "analytics_tournament")),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "parties")),
      ]);

      const analyticsSnap = { docs: [...generalSnap.docs, ...tournamentSnap.docs], size: generalSnap.size + tournamentSnap.size };

      // Process aggregated analytics docs
      let totalViews = 0;
      let totalClicks = 0;
      const byPage: Record<string, number> = {};
      const byBrowser: Record<string, number> = {};
      const byTimezone: Record<string, number> = {};
      const dailyBuckets: Record<string, number> = {};
      const byUser: Record<string, { email: string | null; views: number; clicks: number; lastVisit: string; pages: Record<string, number>; dailyDates: Record<string, number> }> = {};
      const tournamentDocs: TournamentAnalytics[] = [];

      for (const d of analyticsSnap.docs) {
        const data = d.data();
        const docId = d.id;
        const isOldFormat = !!(data.timestamp && data.type);

        if (isOldFormat) {
          // Old format: one doc per page view event
          const uid = (data.uid as string) || "";
          const email = (data.email as string) || null;
          const page = (data.page as string) || "unknown";
          const browser = (data.browser as string) || "unknown";
          const type = (data.type as string) || "page_view";
          const ts = (data.timestamp as string) || "";

          totalViews += 1;
          byPage[page] = (byPage[page] || 0) + 1;
          byBrowser[browser] = (byBrowser[browser] || 0) + 1;

          if (uid) {
            if (!byUser[uid]) byUser[uid] = { email: null, views: 0, clicks: 0, lastVisit: "", pages: {}, dailyDates: {} };
            if (email) byUser[uid].email = email;
            if (type === "click") { byUser[uid].clicks++; totalClicks++; }
            else byUser[uid].views++;
            if (ts > byUser[uid].lastVisit) byUser[uid].lastVisit = ts;
            byUser[uid].pages[page] = (byUser[uid].pages[page] || 0) + 1;
            const date = ts.slice(0, 10);
            if (date) byUser[uid].dailyDates[date] = (byUser[uid].dailyDates[date] || 0) + 1;
          }
          continue;
        }

        // New aggregated format
        const uid = (data.uid as string) || "";
        const email = (data.email as string) || null;
        const views = (data.totalViews as number) || 0;
        const clicks = (data.totalClicks as number) || 0;
        const pages = (data.pages as Record<string, number>) || {};
        const browsers = (data.browsers as Record<string, number>) || {};
        const lastVisit = (data.lastVisit as string) || "";

        totalViews += views;
        totalClicks += clicks;

        // Merge page counts
        for (const [page, count] of Object.entries(pages)) {
          const pageName = page.replace(/_/g, "/");
          byPage[pageName] = (byPage[pageName] || 0) + count;
        }

        // Merge browser counts
        for (const [browser, count] of Object.entries(browsers)) {
          byBrowser[browser] = (byBrowser[browser] || 0) + count;
        }

        // Fallback: if no daily field, use lastVisit date to place total views
        if (lastVisit && views > 0) {
          // This is handled in the chart-building section below
        }

        // Track timezone
        const tz = (data.timezone as string);
        if (tz) {
          byTimezone[tz] = (byTimezone[tz] || 0) + 1;
        }

        // Merge per-user stats
        if (uid) {
          if (!byUser[uid]) byUser[uid] = { email: null, views: 0, clicks: 0, lastVisit: "", pages: {}, dailyDates: {} };
          if (email) byUser[uid].email = email;
          byUser[uid].views += views;
          byUser[uid].clicks += clicks;
          if (lastVisit > byUser[uid].lastVisit) byUser[uid].lastVisit = lastVisit;
          for (const [page, count] of Object.entries(pages)) {
            const pageName = page.replace(/_/g, "/");
            byUser[uid].pages[pageName] = (byUser[uid].pages[pageName] || 0) + count;
          }
          const daily = (data.daily as Record<string, number>) || {};
          for (const [date, count] of Object.entries(daily)) {
            byUser[uid].dailyDates[date] = (byUser[uid].dailyDates[date] || 0) + count;
          }
        }

        // Track tournament-specific docs (from analytics_tournament collection)
        const isTournamentDoc = tournamentSnap.docs.some((td) => td.id === docId);
        if (isTournamentDoc && docId.includes("_")) {
          const parts = docId.split("_");
          const tournamentId = parts.slice(1).join("_");
          if (!tournamentDocs.some((td) => td.docId === docId)) {
            tournamentDocs.push({
              docId,
              uid,
              tournamentId,
              email,
              totalViews: views,
              totalClicks: clicks,
              pages,
              browsers,
              lastVisit,
            });
          }
        }
      }

      const userCount = usersSnap.size;
      const partyCount = partiesSnap.size;

      // Populate daily chart
      for (const d of analyticsSnap.docs) {
        const data = d.data();
        const daily = (data.daily as Record<string, number>) || {};
        if (d === analyticsSnap.docs[0]) {
          console.log("[Analytics] first doc daily field:", JSON.stringify(daily), "type:", typeof daily);
        }
        for (const [date, count] of Object.entries(daily)) {
          if (typeof count === "number") {
            dailyBuckets[date] = (dailyBuckets[date] || 0) + count;
          }
        }
        // Old format: has timestamp per event
        if (data.timestamp && typeof data.timestamp === "string") {
          const date = (data.timestamp as string).slice(0, 10);
          if (date) {
            dailyBuckets[date] = (dailyBuckets[date] || 0) + 1;
          }
        }
      }

      // Build tournament name map from parties
      const tournamentNames = new Map<string, string>();
      for (const p of partiesSnap.docs) {
        const pData = p.data();
        const tid = pData.tournamentId as string;
        const tname = pData.tournamentName as string;
        if (tid && tname) tournamentNames.set(tid, tname);
      }

      // Build sorted daily visits for chart
      const dailyVisits = Object.entries(dailyBuckets)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => {
          const d = new Date(date + "T12:00:00");
          const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
          return { date, label, count };
        });

      const result: AnalyticsData = {
        totalViews,
        totalClicks,
        uniqueUsers: Object.keys(byUser).length,
        byPage,
        byBrowser,
        byTimezone,
        dailyVisits,
        byUser,
        tournamentDocs,
        tournamentNames: Object.fromEntries(tournamentNames),
        systemHealth: {
          userCount,
          partyCount,
          analyticsDocs: analyticsSnap.size,
          estimatedDailyReads: estimateDailyReads(userCount, partyCount),
          estimatedDailyWrites: estimateDailyWrites(userCount),
        },
      };

      setData(result);

      try {
        sessionStorage.setItem("analytics_cache", JSON.stringify({ data: result, timestamp: Date.now() }));
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

  // Not signed in - show login
  if (!loading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-900 via-green-800 to-emerald-900 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl text-center">
          <div className="mb-4 text-5xl">📊</div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-600 mb-6">Sign in to view site analytics. Admin access only.</p>
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
  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!data) return null;

  const userEntries = Object.entries(data.byUser).sort((a, b) => (b[1].views + b[1].clicks) - (a[1].views + a[1].clicks));

  // Group tournament docs by tournamentId
  const tournamentGroups = new Map<string, TournamentAnalytics[]>();
  for (const td of data.tournamentDocs) {
    const existing = tournamentGroups.get(td.tournamentId) || [];
    existing.push(td);
    tournamentGroups.set(td.tournamentId, existing);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">📊 Analytics</h1>
            <p className="text-sm text-gray-500 mt-1">Aggregated totals</p>
          </div>
          <button
            onClick={() => user?.email && fetchData(user.email, true)}
            disabled={fetching}
            className="text-xs font-medium text-green-700 hover:text-green-600 transition-colors disabled:text-gray-400"
          >
            {fetching ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8 sm:grid-cols-4">
          <StatCard label="Total Views" value={data.totalViews} />
          <StatCard label="Total Clicks" value={data.totalClicks} />
          <StatCard label="Unique Users" value={data.uniqueUsers} />
          <StatCard label="Analytics Docs" value={data.systemHealth.analyticsDocs} />
        </div>

        {/* Daily activity chart */}
        <DailyChart data={data.dailyVisits} />

        {/* Breakdowns - 3 charts per row */}
        <div className="grid gap-6 mb-8 sm:grid-cols-2 lg:grid-cols-3">
          <BreakdownChart title="By Page" data={sortedEntries(data.byPage)} color="bg-green-500" />
          <BreakdownChart
            title="By User"
            data={userEntries.map(([uid, info]) => [info.email || uid.slice(0, 12), info.views + info.clicks])}
            color="bg-amber-500"
          />
          <BreakdownChart title="By Browser" data={sortedEntries(data.byBrowser)} color="bg-blue-500" />
          <BreakdownChart title="By Timezone" data={sortedEntries(data.byTimezone)} color="bg-purple-500" />
          <BreakdownChart
            title="User Return Frequency (Days Active)"
            data={userEntries.map(([uid, info]) => {
              const dailyDays = Object.keys(info.dailyDates || {}).length;
              return [info.email || uid.slice(0, 12), dailyDays || (info.views > 0 ? 1 : 0)] as [string, number];
            }).filter(([, d]) => d > 0).sort((a, b) => (b[1] as number) - (a[1] as number))}
            color="bg-teal-500"
          />
        </div>

        {/* Tables grid - 2 per row */}
        <div className="grid gap-6 mb-8 sm:grid-cols-2">
        {/* Per-user breakdown */}
        {userEntries.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">By User</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-4 py-2 font-medium text-gray-500">Email</th>
                    <th className="px-4 py-2 font-medium text-gray-500 text-right">Views</th>
                    <th className="px-4 py-2 font-medium text-gray-500 text-right">Clicks</th>
                    <th className="px-4 py-2 font-medium text-gray-500 text-right">Last Visit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {userEntries.map(([uid, info]) => (
                    <tr key={uid}>
                      <td className="px-4 py-2.5 text-gray-700">{info.email || uid}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-900">{info.views}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-900">{info.clicks}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-500">
                        {info.lastVisit ? new Date(info.lastVisit).toLocaleString() : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* User x Page breakdown */}
        {userEntries.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">User x Page Breakdown</h3>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="text-left">
                    <th className="px-4 py-2 font-medium text-gray-500">User</th>
                    <th className="px-4 py-2 font-medium text-gray-500">Page</th>
                    <th className="px-4 py-2 font-medium text-gray-500 text-right">Views</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {userEntries.flatMap(([uid, info]) => {
                    const pages = info.pages || {};
                    return Object.entries(pages)
                      .filter(([, v]) => typeof v === "number")
                      .sort((a, b) => (b[1] as number) - (a[1] as number))
                      .map(([page, count], idx) => (
                        <tr key={`${uid}-${page}-${idx}`}>
                          <td className="px-4 py-2 text-gray-700 truncate max-w-[120px]">{info.email || uid.slice(0, 12)}</td>
                          <td className="px-4 py-2 text-gray-600 font-mono text-xs truncate max-w-[180px]">{page.startsWith("_") ? "/" + page.slice(1).replace(/_/g, "/") : page}</td>
                          <td className="px-4 py-2 text-right font-medium text-gray-900">{count as number}</td>
                        </tr>
                      ));
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </div>

        {/* Tournament activity */}
        {tournamentGroups.size > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden mb-8">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">🏆 Tournament Activity</h3>
              <p className="text-xs text-gray-500 mt-0.5">Per-tournament engagement breakdown</p>
            </div>
            {Array.from(tournamentGroups.entries()).map(([tournamentId, docs]) => {
              const tViews = docs.reduce((s, d) => s + d.totalViews, 0);
              const tClicks = docs.reduce((s, d) => s + d.totalClicks, 0);
              return (
                <div key={tournamentId} className="border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center justify-between bg-gray-50 px-4 py-2">
                    <span className="text-sm font-bold text-gray-900">
                      {data.tournamentNames?.[tournamentId] || "Unknown Tournament"}
                      <span className="ml-2 text-xs font-normal text-gray-400">#{tournamentId}</span>
                    </span>
                    <div className="flex gap-3 text-xs">
                      <span className="rounded-full bg-green-100 px-2.5 py-0.5 font-semibold text-green-800">{tViews} views</span>
                      <span className="rounded-full bg-blue-100 px-2.5 py-0.5 font-semibold text-blue-800">{tClicks} clicks</span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 font-semibold text-gray-600">{docs.length} users</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left">
                          <th className="px-4 py-1.5 text-xs font-medium text-gray-500">User</th>
                          <th className="px-4 py-1.5 text-xs font-medium text-gray-500 text-right">Views</th>
                          <th className="px-4 py-1.5 text-xs font-medium text-gray-500 text-right">Clicks</th>
                          <th className="px-4 py-1.5 text-xs font-medium text-gray-500 text-right">Last Visit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {docs.sort((a, b) => b.totalViews - a.totalViews).map((d) => (
                          <tr key={d.docId}>
                            <td className="px-4 py-2 text-gray-700">{d.email || d.uid.slice(0, 12)}</td>
                            <td className="px-4 py-2 text-right font-medium text-gray-900">{d.totalViews}</td>
                            <td className="px-4 py-2 text-right font-medium text-gray-900">{d.totalClicks}</td>
                            <td className="px-4 py-2 text-right text-xs text-gray-500">
                              {d.lastVisit ? new Date(d.lastVisit).toLocaleString() : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* System Health / Capacity */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden mb-8">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">🖥️ System Health &amp; Capacity</h3>
            <p className="text-xs text-gray-500 mt-0.5">Estimated usage vs free tier limits (Firestore + Vercel Hobby)</p>
          </div>
          <div className="p-4">
            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{data.systemHealth.userCount}</p>
                <p className="text-xs text-gray-500">Registered Users</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{data.systemHealth.partyCount}</p>
                <p className="text-xs text-gray-500">Parties</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{data.systemHealth.analyticsDocs}</p>
                <p className="text-xs text-gray-500">Analytics Docs</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{Math.ceil(data.systemHealth.userCount * 0.6)}</p>
                <p className="text-xs text-gray-500">Est. Active/Day</p>
              </div>
            </div>

            {/* Capacity gauges */}
            <div className="grid gap-3 sm:grid-cols-2">
              <CapacityGauge
                label="Firestore Reads/Day (estimated)"
                current={data.systemHealth.estimatedDailyReads}
                limit={LIMITS.firestoreReadsPerDay}
                unit="reads"
              />
              <CapacityGauge
                label="Firestore Writes/Day (estimated)"
                current={data.systemHealth.estimatedDailyWrites}
                limit={LIMITS.firestoreWritesPerDay}
                unit="writes"
              />
              <CapacityGauge
                label="Firestore Documents"
                current={data.systemHealth.analyticsDocs + data.systemHealth.userCount + data.systemHealth.partyCount * 10}
                limit={100_000}
                unit="docs"
                warningAt={0.5}
              />
              <CapacityGauge
                label="Vercel Invocations/Month (estimated)"
                current={estimateMonthlyVercelInvocations(data.systemHealth.userCount)}
                limit={LIMITS.vercelInvocationsPerMonth}
                unit="calls"
              />
            </div>

            {/* Scaling notes */}
            <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-3">
              <p className="text-xs font-semibold text-gray-700 mb-1">Capacity Notes</p>
              <ul className="text-xs text-gray-500 space-y-0.5 list-disc list-inside">
                <li><strong>~250 users:</strong> Firestore free tier reads may be exceeded during tournaments. Consider upgrading to Blaze plan.</li>
                <li><strong>~500 users:</strong> Vercel Hobby invocation limit (100K/month) could be hit. Consider Vercel Pro.</li>
                <li><strong>~1000 users:</strong> ESPN API may rate-limit. Server-side caching mitigates this, but monitor 502 errors in logs.</li>
                <li><strong>Current plan:</strong> Firestore Spark (free) + Vercel Hobby (free). Both support current usage comfortably.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Back link */}
        <div className="text-center">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
