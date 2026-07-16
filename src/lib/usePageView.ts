"use client";

import { useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { doc, setDoc, increment } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

function parseBrowser(ua: string): string {
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("OPR/") || ua.includes("Opera/")) return "Opera";
  if (ua.includes("Chrome/") && ua.includes("Safari/")) return "Chrome";
  if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari";
  if (ua.includes("MSIE") || ua.includes("Trident/")) return "IE";
  return "Other";
}

/**
 * Derive the analytics document ID for this page view.
 * - Party pages (/party/{id}/...) use {uid}_{tournamentId} (set later via context)
 * - Everything else uses {uid}_general
 */
function getAnalyticsDocId(uid: string, pathname: string): string {
  // Tournament-specific analytics are handled by the party page context.
  // For now, all page views go to the general doc. The party page can
  // override this by passing tournamentId to trackPageView.
  return `${uid}_general`;
}

const DEBOUNCE_MS = 5_000;
const DEBOUNCE_PREFIX = "analytics_debounce_ts_";

/**
 * Aggregate analytics into a single Firestore document per user context.
 * Uses setDoc with merge + increment for atomic counter updates.
 * Fire-and-forget: failures are silently ignored.
 */
function trackPageView(uid: string, email: string | null, pathname: string, collectionName: string, docId: string) {
  try {
    // Debounce per destination doc, not globally. A single global key meant the
    // general-doc write that fires while a party page is still loading (before
    // tournamentId is known) would suppress the subsequent tournament-doc write,
    // leaving that doc's totalViews / lastVisit stale.
    const debounceKey = `${DEBOUNCE_PREFIX}${docId}`;
    const lastWrite = parseInt(sessionStorage.getItem(debounceKey) || "0", 10);
    if (Date.now() - lastWrite < DEBOUNCE_MS) return;

    const db = getFirebaseDb();
    const browser = parseBrowser(typeof navigator !== "undefined" ? navigator.userAgent : "");
    const today = new Date().toISOString().slice(0, 10);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";

    setDoc(doc(db, collectionName, docId), {
      uid,
      email: email || null,
      totalViews: increment(1),
      [`pages.${pathname.replace(/\//g, "_")}`]: increment(1),
      [`browsers.${browser}`]: increment(1),
      [`daily.${today}`]: increment(1),
      timezone,
      lastPage: pathname,
      lastVisit: new Date().toISOString(),
    }, { merge: true })
      .then(() => sessionStorage.setItem(debounceKey, String(Date.now())))
      .catch((err) => console.error("[Analytics] Write failed:", err));
  } catch {
    // Silently ignore
  }
}

/**
 * Hook that logs a page view on every route change.
 * General views go to analytics_general/{uid}.
 * Tournament views go to analytics_tournament/{uid}_{tournamentId}.
 */
export function usePageView(tournamentId?: string) {
  const pathname = usePathname();
  const { user } = useAuth();

  useEffect(() => {
    if (!pathname || !user?.uid) return;

    if (tournamentId) {
      trackPageView(user.uid, user.email, pathname, "analytics_tournament", `${user.uid}_${tournamentId}`);
    } else {
      trackPageView(user.uid, user.email, pathname, "analytics_general", user.uid);
    }
  }, [pathname, user?.uid, user?.email, tournamentId]);
}

/**
 * Hook that returns a trackClick function.
 * Increments click counter on the same aggregated analytics doc.
 */
export function useTrackClick(tournamentId?: string) {
  const pathname = usePathname();
  const { user } = useAuth();

  return useCallback(
    (action: string) => {
      if (!user?.uid) return;
      try {
        const db = getFirebaseDb();
        const collectionName = tournamentId ? "analytics_tournament" : "analytics_general";
        const docId = tournamentId ? `${user.uid}_${tournamentId}` : user.uid;

        setDoc(doc(db, collectionName, docId), {
          uid: user.uid,
          email: user.email || null,
          totalClicks: increment(1),
          [`actions.${action}`]: increment(1),
          lastAction: action,
          lastActionAt: new Date().toISOString(),
        }, { merge: true }).catch((err) => console.error("[Analytics] Click write failed:", err));
      } catch {
        // Silently ignore
      }
    },
    [pathname, user?.uid, user?.email, tournamentId]
  );
}
