import { ShoppingBag, IndianRupee, TrendingUp, Users } from "lucide-react";

const ICON_STYLE = { color: "#d57282" } as const;
import MetricCard from "@/components/dashboard/MetricCard";
import OverviewCharts from "@/components/dashboard/OverviewCharts";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatINR(value: number) {
  if (value >= 100000)
    return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000)
    return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${Math.round(value)}`;
}

function pctChange(curr: number, prev: number): { label: string; trend: "up" | "down" | "neutral" } {
  if (prev === 0) return { label: "No prev. data", trend: "neutral" };
  const pct = ((curr - prev) / prev) * 100;
  const sign = pct >= 0 ? "+" : "";
  const trend = pct > 0 ? "up" : pct < 0 ? "down" : "neutral";
  return { label: `${sign}${pct.toFixed(1)}% vs same period last month`, trend };
}

interface MetricsResponse {
  sales: {
    gmv: number;
    order_count: number;
    prev_gmv: number;
    prev_order_count: number;
  };
  revenue: {
    revenue: number;
    prev_revenue: number;
  };
  organic: {
    organic_orders: number;
    organic_gmv: number;
    inorganic_orders: number;
    inorganic_gmv: number;
  };
  repeat_rate: {
    total_customers: number;
    repeat_customers: number;
    repeat_rate: number;
  };
  aov_asp: {
    aov: number;
    asp: number;
    prev_aov: number;
    prev_asp: number;
  };
  chart: { day: string; order_count: number; gmv: number }[];
}

async function fetchMetrics(): Promise<MetricsResponse | null> {
  try {
    const [s, r, o, rr, aa, c] = await Promise.all([
      supabaseAdmin.rpc("overview_mtd_sales"),
      supabaseAdmin.rpc("overview_mtd_revenue"),
      supabaseAdmin.rpc("overview_mtd_organic"),
      supabaseAdmin.rpc("overview_mtd_repeat_rate"),
      supabaseAdmin.rpc("overview_mtd_aov_asp"),
      supabaseAdmin.rpc("overview_last7days_chart"),
    ]);
    if (s.error || r.error || o.error || rr.error || aa.error || c.error) return null;
    return {
      sales: s.data,
      revenue: r.data,
      organic: o.data,
      repeat_rate: rr.data,
      aov_asp: aa.data,
      chart: c.data ?? [],
    };
  } catch {
    return null;
  }
}

export default async function OverviewPage() {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const metrics = await fetchMetrics();

  // Card 1
  const salesGmv = metrics?.sales.gmv ?? 0;
  const salesOrders = metrics?.sales.order_count ?? 0;
  const salesChange = pctChange(salesGmv, metrics?.sales.prev_gmv ?? 0);

  // Card 2
  const revenue = metrics?.revenue.revenue ?? 0;
  const revenueChange = pctChange(revenue, metrics?.revenue.prev_revenue ?? 0);

  // Card 3
  const organicOrders = metrics?.organic.organic_orders ?? 0;
  const organicGmv = metrics?.organic.organic_gmv ?? 0;
  const inorganicOrders = metrics?.organic.inorganic_orders ?? 0;
  const inorganicGmv = metrics?.organic.inorganic_gmv ?? 0;

  // Card 4
  const repeatRate = metrics?.repeat_rate.repeat_rate ?? 0;
  const repeatCustomers = metrics?.repeat_rate.repeat_customers ?? 0;
  const totalCustomers = metrics?.repeat_rate.total_customers ?? 0;

  // Card AOV / ASP
  const aov = metrics?.aov_asp.aov ?? 0;
  const asp = metrics?.aov_asp.asp ?? 0;
  const aovChange = pctChange(aov, metrics?.aov_asp.prev_aov ?? 0);
  const aspChange = pctChange(asp, metrics?.aov_asp.prev_asp ?? 0);

  const chartData = metrics?.chart ?? [];

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
        {/* Card 1: MTD Sales */}
        <MetricCard
          label="MTD Sales"
          value={formatINR(salesGmv)}
          subvalue={`${salesOrders} orders`}
          icon={<ShoppingBag size={17} style={ICON_STYLE} />}
          trend={salesChange.trend}
          trendLabel={salesChange.label}
          tooltip="Month-to-date gross sales (non-cancelled orders). Order count shown below. Compared against the same number of days in the previous month."
        />

        {/* Card 2: MTD Revenue */}
        <MetricCard
          label="MTD Revenue"
          value={formatINR(revenue)}
          icon={<IndianRupee size={17} style={ICON_STYLE} />}
          trend={revenueChange.trend}
          trendLabel={revenueChange.label}
          tooltip="Revenue = Order Value − Cost of Goods Sold (sum of variant cost × quantity per line item). Cancelled orders excluded. Revenue equals Sales until costs are entered."
        />

        {/* Card 3: Organic vs Inorganic */}
        <MetricCard
          label="MTD Organic vs Inorganic"
          value={`${organicOrders} / ${inorganicOrders}`}
          icon={<TrendingUp size={17} style={ICON_STYLE} />}
          trend="neutral"
          tooltip="Inorganic: orders where first or last UTM campaign is non-empty. Organic: all other orders. Shows order count (organic / inorganic) and GMV split."
        >
          <div className="flex flex-col gap-1 mt-0.5">
            <div className="flex justify-between text-xs">
              <span style={{ color: "#8a8a8a" }}>Organic</span>
              <span className="font-medium" style={{ color: "#525252" }}>
                {formatINR(organicGmv)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: "#8a8a8a" }}>Inorganic</span>
              <span className="font-medium" style={{ color: "#525252" }}>
                {formatINR(inorganicGmv)}
              </span>
            </div>
          </div>
        </MetricCard>

        {/* Card 4: Repeat Rate */}
        <MetricCard
          label="MTD Repeat Rate"
          value={`${repeatRate}%`}
          subvalue={`${repeatCustomers} of ${totalCustomers} customers`}
          icon={<Users size={17} style={ICON_STYLE} />}
          trend={repeatRate >= 20 ? "up" : repeatRate >= 10 ? "neutral" : "down"}
          tooltip="Repeat Rate = customers who placed at least one order this month with a lifetime order index > 1, divided by all unique customers with MTD orders. Cancelled orders excluded."
        />
      </div>

      {/* Chart */}
      <OverviewCharts chartData={chartData} />

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
          {/* AOV — live */}
          <div>
            <p className="text-[0.7rem] font-medium tracking-wide uppercase" style={{ color: "#b0a0a0" }}>
              Avg Order Value
            </p>
            <p className="text-xl font-semibold mt-1" style={{ color: "#525252" }}>
              {formatINR(aov)}
            </p>
            <p
              className="text-[0.68rem] mt-0.5"
              style={{ color: aovChange.trend === "up" ? "#16a34a" : aovChange.trend === "down" ? "#dc2626" : "#8a8a8a" }}
            >
              {aovChange.label}
            </p>
          </div>

          {/* ASP — live */}
          <div>
            <p className="text-[0.7rem] font-medium tracking-wide uppercase" style={{ color: "#b0a0a0" }}>
              Avg Selling Price
            </p>
            <p className="text-xl font-semibold mt-1" style={{ color: "#525252" }}>
              {formatINR(asp)}
            </p>
            <p
              className="text-[0.68rem] mt-0.5"
              style={{ color: aspChange.trend === "up" ? "#16a34a" : aspChange.trend === "down" ? "#dc2626" : "#8a8a8a" }}
            >
              {aspChange.label}
            </p>
          </div>

          {/* Static placeholders */}
          {[
            { label: "NDR Cases", value: "—", note: "coming soon" },
            { label: "Low Stock SKUs", value: "—", note: "check inventory" },
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
                <span className="text-xs font-normal ml-1" style={{ color: "#8a8a8a" }}>
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
