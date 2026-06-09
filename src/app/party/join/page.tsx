"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { joinPartyByCode } from "@/lib/firestore";
import { Suspense } from "react";
import Link from "next/link";

function JoinPartyForm() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code") || "";

  const [code, setCode] = useState(codeFromUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !code.trim()) return;

    setLoading(true);
    setError("");

    try {
      const party = await joinPartyByCode(code.trim(), user.uid);
      if (!party) {
        setError("No party found with that invite code. Please check and try again.");
        setLoading(false);
        return;
      }
      router.push(`/party/${party.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join party");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/sports"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
        </svg>
        Back to sports
      </Link>
      <h1 className="mb-8 text-2xl font-bold text-gray-900 sm:mb-10 sm:text-3xl">Join a Party</h1>

      <form onSubmit={handleSubmit} className="w-full space-y-6 sm:space-y-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Invite Code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g., GF4K9X"
            className="w-full rounded-lg border border-gray-300 px-3 py-3 text-center font-mono text-xl tracking-[0.2em] text-gray-900 focus:border-transparent focus:ring-2 focus:ring-green-500 sm:px-4 sm:text-2xl sm:tracking-widest"
            maxLength={6}
            required
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || code.trim().length < 6}
          className="w-full bg-green-700 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Joining..." : "Join Party"}
        </button>
      </form>
    </div>
  );
}

export default function JoinPartyPage() {
  return (
    <ProtectedRoute>
      <Navbar />
      <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"></div></div>}>
        <JoinPartyForm />
      </Suspense>
    </ProtectedRoute>
  );
}
