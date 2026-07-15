// Server Component — renders instantly on navigation
export default function OverviewLoading() {
  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="space-y-2.5">
        <div className="shimmer h-6 w-40" />
        <div className="shimmer h-4 w-56" />
      </div>

      {/* Metric cards (4-up) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      {/* Bottom stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MiniStatSkeleton />
        <MiniStatSkeleton />
        <MiniStatSkeleton />
      </div>
    </div>
  );
}

function MetricCardSkeleton() {
  return (
    <div
      className="rounded-2xl px-5 py-4 space-y-3"
      style={{
        backgroundColor: "#ffffff",
        boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
        border: "1px solid #E2E2E2",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="shimmer h-3 w-24" />
        <div className="shimmer-circle w-8 h-8" />
      </div>
      <div className="shimmer h-7 w-20" />
      <div className="shimmer h-3 w-28" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div
      className="rounded-2xl px-5 py-4 space-y-4"
      style={{
        backgroundColor: "#ffffff",
        boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
        border: "1px solid #E2E2E2",
      }}
    >
      <div className="shimmer h-4 w-32" />
      <div className="shimmer h-56 w-full rounded-xl" />
    </div>
  );
}

function MiniStatSkeleton() {
  return (
    <div
      className="rounded-2xl px-5 py-4 space-y-2"
      style={{
        backgroundColor: "#ffffff",
        boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
        border: "1px solid #E2E2E2",
      }}
    >
      <div className="shimmer h-3 w-28" />
      <div className="shimmer h-5 w-16" />
    </div>
  );
}
