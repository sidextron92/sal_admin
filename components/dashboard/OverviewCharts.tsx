"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface ChartDay {
  day: string;
  order_count: number;
  gmv: number;
}

function formatCurrency(value: number) {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${value}`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const { gmv, order_count } = payload[0].payload;
  return (
    <div
      className="rounded-xl px-3 py-2.5 text-xs"
      style={{
        border: "1px solid #E2E2E2",
        backgroundColor: "#fff",
        color: "#525252",
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        minWidth: 120,
      }}
    >
      <p className="font-semibold mb-1" style={{ color: "#525252" }}>{label}</p>
      <p style={{ color: "#d57282" }}>
        {formatCurrency(gmv)}
      </p>
      <p style={{ color: "#8a8a8a" }}>{order_count} orders</p>
    </div>
  );
}

interface OverviewChartsProps {
  chartData: ChartDay[];
}

export default function OverviewCharts({ chartData }: OverviewChartsProps) {
  return (
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
        <BarChart data={chartData} barSize={28}>
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
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f9e8eb" }} />
          <Bar dataKey="gmv" fill="#d57282" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
