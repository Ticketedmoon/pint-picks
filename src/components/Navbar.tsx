"use client";

import { useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

const TAP_COUNT = 5;
const TAP_WINDOW_MS = 2000;

export function Navbar() {
  const { user, signOut, isAdmin, godMode, toggleGodMode } = useAuth();
  const tapTimestamps = useRef<number[]>([]);

  // Ctrl+Shift+G toggles god mode (admin only)
  useEffect(() => {
    if (!isAdmin) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "G") {
        e.preventDefault();
        toggleGodMode();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isAdmin, toggleGodMode]);

  // 5 taps on logo within 2s toggles god mode (mobile)
  const handleLogoTap = useCallback((e: React.MouseEvent) => {
    if (!isAdmin) return;
    const now = Date.now();
    tapTimestamps.current = tapTimestamps.current.filter((t) => now - t < TAP_WINDOW_MS);
    tapTimestamps.current.push(now);
    if (tapTimestamps.current.length >= TAP_COUNT) {
      e.preventDefault();
      tapTimestamps.current = [];
      toggleGodMode();
    }
  }, [isAdmin, toggleGodMode]);

  return (
    <nav className="bg-green-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between sm:h-16">
          <Link href="/sports" onClick={handleLogoTap} className="flex items-center gap-2 text-lg font-extrabold tracking-tight sm:text-xl" style={{ fontFamily: "var(--font-heading), system-ui, sans-serif" }}>
            <span>🍺</span>
            <span>PintPicks</span>
            {isAdmin && godMode && (
              <span className="ml-1 h-2 w-2 rounded-full bg-red-400 opacity-70" title="Active" />
            )}
          </Link>
          {user && (
            <div className="flex items-center gap-2 sm:gap-5">
              <span className="hidden text-xs text-green-200 sm:inline sm:text-sm">
                {user.displayName}
              </span>
              {user.photoURL && (
                <img
                  src={user.photoURL}
                  alt=""
                  className="h-8 w-8 rounded-full ring-2 ring-green-600"
                  referrerPolicy="no-referrer"
                />
              )}
              <button
                onClick={signOut}
                className="rounded-lg bg-green-700 px-3 py-2 text-xs transition-colors hover:bg-green-600 sm:px-4 sm:py-2 sm:text-sm"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
