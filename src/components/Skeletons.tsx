/** Reusable skeleton building blocks for loading states. */

export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />;
}

/** Skeleton for the party leaderboard page. */
export function PartyPageSkeleton() {
  return (
    <div className="w-full px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
      {/* Header */}
      <div className="mb-6">
        <SkeletonLine className="h-8 w-48 sm:w-72 mb-2" />
        <SkeletonLine className="h-4 w-64 sm:w-96" />
      </div>

      {/* Status pills */}
      <div className="mb-6 flex flex-wrap gap-2">
        <SkeletonLine className="h-9 w-36 sm:w-44 rounded-full" />
        <SkeletonLine className="h-9 w-44 sm:w-52 rounded-full" />
        <SkeletonLine className="hidden sm:block h-9 w-48 rounded-full" />
      </div>

      {/* Desktop: table skeleton. Mobile: card skeleton */}
      <div className="hidden sm:block rounded-xl border border-gray-200 bg-white overflow-hidden">
        {/* Table header */}
        <div className="bg-green-800 px-4 py-3 flex gap-4">
          <SkeletonLine className="h-5 w-32 rounded bg-green-700" />
          {[1, 2, 3, 4, 5, 6].map((j) => (
            <SkeletonLine key={j} className="h-5 w-20 rounded bg-green-700 flex-1" />
          ))}
          <SkeletonLine className="h-5 w-16 rounded bg-green-700" />
        </div>
        {/* Table rows */}
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`px-4 py-4 flex items-center gap-4 border-b border-gray-100 ${i % 2 === 0 ? "bg-gray-50" : ""}`}>
            <div className="flex items-center gap-2 w-40">
              <SkeletonLine className="h-5 w-5 rounded" />
              <SkeletonLine className="h-6 w-6 rounded-full" />
              <SkeletonLine className="h-4 w-24" />
            </div>
            {[1, 2, 3, 4, 5, 6].map((j) => (
              <div key={j} className="flex-1 flex flex-col items-center gap-1">
                <SkeletonLine className="h-3 w-16" />
                <SkeletonLine className="h-4 w-8" />
              </div>
            ))}
            <SkeletonLine className="h-6 w-12" />
          </div>
        ))}
      </div>

      {/* Mobile: card skeleton */}
      <div className="sm:hidden space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border-2 border-gray-200 bg-white p-4">
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
    </div>
  );
}

/** Skeleton for the dashboard page. */
export function DashboardSkeleton() {
  return (
    <div className="w-full px-6 py-8 sm:px-12 sm:py-12 lg:px-20">
      <SkeletonLine className="h-8 w-40 sm:w-56 mb-6" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="mb-4 rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <SkeletonLine className="h-5 w-48 sm:w-72 mb-2" />
              <SkeletonLine className="h-4 w-32 sm:w-48" />
            </div>
            <SkeletonLine className="h-9 w-20 sm:w-24 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
