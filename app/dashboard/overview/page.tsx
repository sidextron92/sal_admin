import { ShoppingBag, IndianRupee, Truck, AlertTriangle } from "lucide-react";
import MetricCard from "@/components/dashboard/MetricCard";
import OverviewCharts from "@/components/dashboard/OverviewCharts";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function OverviewPage() {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "#525252" }}>
            {getGreeting()}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <div
              style={{
                width: 22,
                height: 2,
                backgroundColor: "#d57282",
                borderRadius: 1,
                opacity: 0.7,
                flexShrink: 0,
              }}
            />
            <p className="text-sm" style={{ color: "#8a8a8a" }}>
              {today}
            </p>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Today's Orders"
          value="47"
          icon={ShoppingBag}
          trend="up"
          trendLabel="+12% vs yesterday"
        />
        <MetricCard
          label="Revenue (Today)"
          value="₹1,24,500"
          icon={IndianRupee}
          trend="up"
          trendLabel="+8% vs yesterday"
        />
        <MetricCard
          label="Pending Shipments"
          value="12"
          icon={Truck}
          trend="neutral"
          trendLabel="Awaiting pickup"
        />
        <MetricCard
          label="RTO Rate (MTD)"
          value="8.2%"
          icon={AlertTriangle}
          trend="down"
          trendLabel="↓ 1.4% vs last month"
        />
      </div>

      {/* Charts */}
      <OverviewCharts />

      {/* Quick status row */}
      <div
        className="bg-white rounded-2xl p-5 border"
        style={{
          borderColor: "#E2E2E2",
          boxShadow: "0 2px 16px rgba(213, 114, 130, 0.07)",
        }}
      >
        <div className="flex items-center gap-2 mb-5">
          <div
            style={{
              width: 3,
              height: 14,
              backgroundColor: "#d57282",
              borderRadius: 2,
              flexShrink: 0,
            }}
          />
          <p className="text-sm font-semibold" style={{ color: "#525252" }}>
            Quick Status
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {[
            { label: "Shopify Orders", value: "31", note: "today" },
            { label: "Amazon Orders", value: "16", note: "today" },
            { label: "NDR Cases", value: "4", note: "active" },
            { label: "Low Stock SKUs", value: "3", note: "below threshold" },
          ].map((item) => (
            <div key={item.label}>
              <p
                className="text-[0.7rem] font-medium tracking-wide uppercase"
                style={{ color: "#b0a0a0" }}
              >
                {item.label}
              </p>
              <p className="text-xl font-semibold mt-1" style={{ color: "#525252" }}>
                {item.value}
                <span
                  className="text-xs font-normal ml-1"
                  style={{ color: "#8a8a8a" }}
                >
                  {item.note}
                </span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
