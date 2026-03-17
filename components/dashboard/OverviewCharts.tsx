"use client";

import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const ordersData = [
  { day: "Mon", orders: 32 },
  { day: "Tue", orders: 41 },
  { day: "Wed", orders: 28 },
  { day: "Thu", orders: 55 },
  { day: "Fri", orders: 63 },
  { day: "Sat", orders: 71 },
  { day: "Sun", orders: 47 },
];

const revenueData = [
  { day: "Mon", revenue: 84000 },
  { day: "Tue", revenue: 108500 },
  { day: "Wed", revenue: 73200 },
  { day: "Thu", revenue: 142000 },
  { day: "Fri", revenue: 165800 },
  { day: "Sat", revenue: 187500 },
  { day: "Sun", revenue: 124500 },
];

function formatCurrency(value: number) {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${value}`;
}

export default function OverviewCharts() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Orders Bar Chart */}
      <div
        className="bg-white rounded-2xl p-5 border"
        style={{ borderColor: "#E2E2E2", boxShadow: "0 2px 16px rgba(213, 114, 130, 0.07)" }}
      >
        <div className="flex items-center gap-2 mb-5">
          <div style={{ width: 3, height: 14, backgroundColor: "#d57282", borderRadius: 2, flexShrink: 0 }} />
          <p className="text-sm font-semibold" style={{ color: "#525252" }}>
            Orders · Last 7 Days
          </p>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={ordersData} barSize={28}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#F0F0F0"
            />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#8a8a8a" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#8a8a8a" }}
              width={30}
            />
            <Tooltip
              cursor={{ fill: "#f9e8eb" }}
              contentStyle={{
                border: "1px solid #E2E2E2",
                borderRadius: 12,
                fontSize: 12,
                color: "#525252",
              }}
              formatter={(val) => [val, "Orders"]}
            />
            <Bar dataKey="orders" fill="#d57282" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue Area Chart */}
      <div
        className="bg-white rounded-2xl p-5 border"
        style={{ borderColor: "#E2E2E2", boxShadow: "0 2px 16px rgba(213, 114, 130, 0.07)" }}
      >
        <div className="flex items-center gap-2 mb-5">
          <div style={{ width: 3, height: 14, backgroundColor: "#d57282", borderRadius: 2, flexShrink: 0 }} />
          <p className="text-sm font-semibold" style={{ color: "#525252" }}>
            Revenue · Last 7 Days
          </p>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={revenueData}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#d57282" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#d57282" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#F0F0F0"
            />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#8a8a8a" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#8a8a8a" }}
              tickFormatter={formatCurrency}
              width={42}
            />
            <Tooltip
              contentStyle={{
                border: "1px solid #E2E2E2",
                borderRadius: 12,
                fontSize: 12,
                color: "#525252",
              }}
              formatter={(val) => [typeof val === "number" ? formatCurrency(val) : val, "Revenue"]}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#d57282"
              strokeWidth={2}
              fill="url(#revenueGradient)"
              dot={false}
              activeDot={{ r: 5, fill: "#d57282" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
