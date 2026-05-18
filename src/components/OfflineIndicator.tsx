"use client";

import { useEffect, useState } from "react";

/**
 * Shows a toast banner when the browser goes offline during a tournament.
 * Auto-dismisses when connection is restored.
 */
export function OfflineIndicator() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const handleOffline = () => setOffline(true);
    const handleOnline = () => setOffline(false);

    // Check initial state
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOffline(true);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-lg">
      📡 You're offline. Scores will update when you reconnect.
    </div>
  );
}
