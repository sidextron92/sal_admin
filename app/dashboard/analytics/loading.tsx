// Server Component — renders instantly on navigation
export default function AnalyticsLoading() {
  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2.5">
          <div className="shimmer h-6 w-40" />
          <div className="shimmer h-4 w-48" />
        </div>
        <div className="shimmer h-9 w-40 rounded-[22px]" />
      </div>

      {/* Date filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="shimmer h-9 w-36 rounded-xl" />
        <div className="shimmer h-9 w-36 rounded-xl" />
        <div className="shimmer h-9 w-24 rounded-[22px]" />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Location chart */}
        <ChartCardSkeleton titleWidth={120} />

        {/* Variant chart */}
        <ChartCardSkeleton titleWidth={140} />

        {/* Channel split + COD split */}
        <ChartCardSkeleton titleWidth={110} />
        <ChartCardSkeleton titleWidth={130} />
      </div>

      {/* RTO Rate big number */}
      <div
        className="rounded-2xl px-6 py-5 flex items-center justify-between"
        style={{
          backgroundColor: "#ffffff",
          boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
          border: "1px solid #E2E2E2",
        }}
      >
        <div className="space-y-2">
          <div className="shimmer h-3 w-24" />
          <div className="shimmer h-10 w-20" />
        </div>
        <div className="shimmer h-8 w-28 rounded-lg" />
      </div>
    </div>
  );
}

function ChartCardSkeleton({ titleWidth }: { titleWidth: number }) {
  return (
    <div
      className="rounded-2xl px-5 py-4 space-y-4"
      style={{
        backgroundColor: "#ffffff",
        boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
        border: "1px solid #E2E2E2",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="shimmer h-4" style={{ width: titleWidth }} />
        <div className="shimmer h-7 w-24 rounded-lg" />
      </div>
      <div className="shimmer h-64 w-full rounded-xl" />
      <div className="flex gap-2">
        <div className="shimmer h-6 w-20 rounded-full" />
        <div className="shimmer h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}
