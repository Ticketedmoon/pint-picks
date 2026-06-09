"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const handleUnsubscribe = async () => {
    if (!uid) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid }),
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  };

  if (!uid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-xl bg-white p-6 text-center shadow-lg">
          <span className="text-4xl">⚠️</span>
          <h1 className="mt-3 text-lg font-bold text-gray-900">Invalid link</h1>
          <p className="mt-2 text-sm text-gray-500">This unsubscribe link is missing required information.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 text-center shadow-lg">
        <span className="text-4xl">📧</span>
        {status === "done" ? (
          <>
            <h1 className="mt-3 text-lg font-bold text-gray-900">Unsubscribed</h1>
            <p className="mt-2 text-sm text-gray-500">
              You won't receive any more marketing emails from PintPicks.
              You'll still get emails for party invites and pick unlocks.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-3 text-lg font-bold text-gray-900">Unsubscribe from emails</h1>
            <p className="mt-2 text-sm text-gray-500">
              Click below to stop receiving tournament reminder emails from PintPicks.
              You'll still get essential emails (party invites, pick unlocks).
            </p>
            <button
              onClick={handleUnsubscribe}
              disabled={status === "loading"}
              className="mt-4 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {status === "loading" ? "Unsubscribing..." : "Unsubscribe"}
            </button>
            {status === "error" && (
              <p className="mt-2 text-sm text-red-600">Something went wrong. Please try again.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="animate-pulse text-gray-400">Loading...</div></div>}>
      <UnsubscribeContent />
    </Suspense>
  );
}
