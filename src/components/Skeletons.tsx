/** Reusable skeleton building blocks for loading states. */

export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />;
}

/** Skeleton for the party leaderboard page. */
export function PartyPageSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <SkeletonLine className="h-8 w-48 mb-2" />
        <SkeletonLine className="h-4 w-64" />
      </div>

      {/* Status pills */}
      <div className="mb-6 flex gap-2">
        <SkeletonLine className="h-9 w-36 rounded-full" />
        <SkeletonLine className="h-9 w-44 rounded-full" />
      </div>

      {/* Leaderboard cards */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="mb-4 rounded-xl border-2 border-gray-200 bg-white p-4">
          <div className="flex items-center gap-3 mb-3">
            <SkeletonLine className="h-7 w-7 rounded-full" />
            <SkeletonLine className="h-5 w-32" />
            <div className="ml-auto">
              <SkeletonLine className="h-6 w-10" />
            </div>
          </div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map((j) => (
              <div key={j} className="flex items-center gap-2">
                <SkeletonLine className="h-4 w-6" />
                <SkeletonLine className="h-4 w-28 flex-1" />
                <SkeletonLine className="h-4 w-10" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for the dashboard page. */
export function DashboardSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <SkeletonLine className="h-8 w-40 mb-6" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="mb-4 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <SkeletonLine className="h-5 w-48 mb-2" />
              <SkeletonLine className="h-4 w-32" />
            </div>
            <SkeletonLine className="h-9 w-20 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
