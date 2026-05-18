"use client";

export default function PartyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-lg">
        <span className="text-4xl">🏌️</span>
        <h2 className="mt-3 text-lg font-bold text-gray-900">Failed to load party</h2>
        <p className="mt-2 text-sm text-gray-500">
          {error.message || "We couldn't load this party. It may have been deleted or you may not have access."}
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
