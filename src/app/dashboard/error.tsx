"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-lg">
        <span className="text-4xl">📋</span>
        <h2 className="mt-3 text-lg font-bold text-gray-900">Failed to load dashboard</h2>
        <p className="mt-2 text-sm text-gray-500">
          {error.message || "Something went wrong loading your parties."}
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
