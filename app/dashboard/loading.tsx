// Server Component — renders instantly on navigation
export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2.5">
          <div className="shimmer h-6 w-40" />
          <div className="shimmer h-4 w-28" />
        </div>
        <div className="shimmer h-9 w-32 rounded-[22px]" />
      </div>

      {/* Summary cards (3-up) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCardSkeleton />
        <SummaryCardSkeleton />
        <SummaryCardSkeleton />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="shimmer h-9 w-64 rounded-xl" />
        <div className="shimmer h-9 w-28 rounded-[22px]" />
        <div className="shimmer h-9 w-28 rounded-[22px]" />
        <div className="shimmer h-9 w-24 rounded-[22px]" />
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "#ffffff",
          boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
          border: "1px solid #E2E2E2",
        }}
      >
        {/* Table header */}
        <div
          className="flex items-center gap-4 px-5 py-3"
          style={{ borderBottom: "1px solid #F0EBE0" }}
        >
          <div className="shimmer h-3 w-7" />
          <div className="shimmer h-3 flex-1 max-w-[35%]" />
          <div className="shimmer h-3 w-[12%]" />
          <div className="shimmer h-3 w-[14%]" />
          <div className="shimmer h-3 w-[12%]" />
          <div className="shimmer h-3 w-9" />
        </div>

        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <TableRowSkeleton key={i} />
        ))}

        {/* Pagination bar */}
        <div
          className="flex items-center justify-between px-5 py-3.5"
          style={{ borderTop: "1px solid #F0EBE0" }}
        >
          <div className="shimmer h-3 w-32" />
          <div className="flex gap-2">
            <div className="shimmer h-8 w-20 rounded-lg" />
            <div className="shimmer h-8 w-20 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCardSkeleton() {
  return (
    <div
      className="rounded-2xl px-5 py-4 space-y-2.5"
      style={{
        backgroundColor: "#ffffff",
        boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
        border: "1px solid #E2E2E2",
      }}
    >
      <div className="shimmer h-3 w-24" />
      <div className="shimmer h-6 w-20" />
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <div className="shimmer-circle w-8 h-8" />
      <div className="shimmer h-3.5 flex-1 max-w-[35%]" />
      <div className="shimmer h-3.5 w-[12%]" />
      <div className="shimmer h-3.5 w-[14%]" />
      <div className="shimmer h-3.5 w-[12%]" />
      <div className="shimmer h-3.5 w-9" />
    </div>
  );
}
