"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SummaryPeriod {
  order_count: number;
  gmv: number;
  rto_count: number;
  rto_rate_pct: number;
  cod_count: number;
  prepaid_count: number;
}

interface LocationRow {
  location: string;
  order_count: number;
  gmv: number;
}

interface VariantRow {
  variant_label: string;
  qty_sold: number;
  gmv: number;
}

interface ChannelRow {
  channel: string;
  order_count: number;
  gmv: number;
}

interface AnalyticsData {
  summary: { current: SummaryPeriod; prev: SummaryPeriod };
  locations: { by_city: LocationRow[]; by_state: LocationRow[] };
  variants: { all: VariantRow[]; organic: VariantRow[]; inorganic: VariantRow[] };
  channel_split: ChannelRow[];
  meta: { date_from: string; date_to: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtINR(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n}`;
}

function formatDate(d: string) {
  const [y, m, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
}

const CHANNEL_COLORS: Record<string, string> = {
  Shopify: "#d57282",
  Amazon: "#f4a56e",
  Offline: "#8ec9b0",
  Unknown: "#c4b0b0",
};

const PAYMENT_COLORS: Record<string, string> = {
  COD: "#f4a56e",
  Prepaid: "#27a559",
};

// ─── Toggle Button Group ──────────────────────────────────────────────────────

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="flex rounded-lg overflow-hidden"
      style={{ border: "1px solid #E2E2E2", backgroundColor: "#fffbf6" }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="px-3 py-1 text-xs font-medium transition-colors"
          style={{
            backgroundColor: value === opt.value ? "#d57282" : "transparent",
            color: value === opt.value ? "#ffffff" : "#8a8a8a",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Card Shell ───────────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl p-5 ${className}`}
      style={{
        backgroundColor: "#ffffff",
        boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
        border: "1px solid #f0ebe6",
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold" style={{ color: "#525252" }}>
        {title}
      </h3>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ h = 200 }: { h?: number }) {
  return (
    <div
      className="animate-pulse rounded-xl"
      style={{ height: h, backgroundColor: "#f5ede9" }}
    />
  );
}

// ─── Horizontal Bar Chart ─────────────────────────────────────────────────────

function HBarChart({
  data,
  dataKey,
  labelKey,
  tickFmt,
}: {
  data: { [k: string]: string | number }[];
  dataKey: string;
  labelKey: string;
  tickFmt?: (v: number) => string;
}) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-xs" style={{ color: "#c4b0b0" }}>
        No data for this period
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => (b[dataKey] as number) - (a[dataKey] as number));

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, sorted.length * 32)}>
      <BarChart layout="vertical" data={sorted} margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: "#8a8a8a" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={tickFmt}
        />
        <YAxis
          type="category"
          dataKey={labelKey}
          width={140}
          tick={{ fontSize: 11, fill: "#525252" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 10,
            border: "1px solid #f0ebe6",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          }}
          formatter={(value) =>
            tickFmt ? [tickFmt(value as number), ""] : [value, ""]
          }
        />
        <Bar dataKey={dataKey} fill="#d57282" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Donut Chart ─────────────────────────────────────────────────────────────

function DonutChart({
  data,
  colors,
  centerLabel,
  centerSub,
}: {
  data: { name: string; value: number }[];
  colors: Record<string, string>;
  centerLabel: string;
  centerSub: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: 180, height: 180 }}>
        <PieChart width={180} height={180}>
          <Pie
            data={data}
            cx={85}
            cy={85}
            innerRadius={55}
            outerRadius={80}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
            strokeWidth={2}
            stroke="#fffbf6"
          >
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={colors[entry.name] ?? "#c4b0b0"}
              />
            ))}
          </Pie>
        </PieChart>
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        >
          <span className="text-base font-semibold" style={{ color: "#525252" }}>
            {centerLabel}
          </span>
          <span className="text-[10px]" style={{ color: "#8a8a8a" }}>
            {centerSub}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 w-full">
        {data.map((entry) => {
          const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0.0";
          return (
            <div key={entry.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: colors[entry.name] ?? "#c4b0b0" }}
                />
                <span style={{ color: "#525252" }}>{entry.name}</span>
              </div>
              <span style={{ color: "#8a8a8a" }}>
                {entry.value.toLocaleString()} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── RTO Card ─────────────────────────────────────────────────────────────────

function RTOCard({ current, prev }: { current: SummaryPeriod; prev: SummaryPeriod }) {
  const delta = current.rto_rate_pct - prev.rto_rate_pct;
  const isWorse = delta > 0;
  const isImproved = delta < 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <span
          className="text-4xl font-bold tabular-nums"
          style={{ color: "#525252" }}
        >
          {current.rto_rate_pct.toFixed(1)}%
        </span>
        {delta !== 0 && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: isWorse ? "#fde8e8" : isImproved ? "#e6f9ee" : "#f0ebe6",
              color: isWorse ? "#d63535" : isImproved ? "#27a559" : "#8a8a8a",
            }}
          >
            {isWorse ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}pp
          </span>
        )}
      </div>
      <div className="text-xs" style={{ color: "#8a8a8a" }}>
        {current.rto_count} RTO orders of {current.order_count} total
      </div>
      <div className="text-xs" style={{ color: "#b0a0a0" }}>
        Prev period: {prev.rto_rate_pct.toFixed(1)}% ({prev.rto_count} of {prev.order_count})
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationMode, setLocationMode] = useState<"city" | "state">("city");
  const [variantSort, setVariantSort] = useState<"units" | "gmv">("units");
  const [variantSource, setVariantSource] = useState<"all" | "organic" | "inorganic">("all");

  useEffect(() => {
    setLoading(true);
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────

  const locationData = (
    data ? (locationMode === "city" ? data.locations.by_city : data.locations.by_state) : []
  ).filter((r) => r.location !== "Unknown");

  const rawVariants = data ? data.variants[variantSource] : [];
  const variantData = [...rawVariants]
    .filter((r) => r.variant_label !== "Unknown")
    .sort((a, b) =>
      variantSort === "units" ? b.qty_sold - a.qty_sold : b.gmv - a.gmv
    )
    .slice(0, 10);

  const channelDonutData = (data?.channel_split ?? []).map((r) => ({
    name: r.channel,
    value: r.order_count,
  }));

  const paymentDonutData = data
    ? [
        { name: "COD", value: data.summary.current.cod_count },
        { name: "Prepaid", value: data.summary.current.prepaid_count },
      ]
    : [];

  const paymentTotal = data
    ? data.summary.current.cod_count + data.summary.current.prepaid_count
    : 0;

  const channelTotal = channelDonutData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold" style={{ color: "#525252" }}>
          Analytics
        </h1>
        {data?.meta && (
          <p className="text-xs mt-0.5" style={{ color: "#8a8a8a" }}>
            {formatDate(data.meta.date_from)} – {formatDate(data.meta.date_to)} · Last 30 days
          </p>
        )}
      </div>

      {/* Row 1: Locations + Channel Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Locations */}
        <Card>
          <CardHeader
            title="Top 10 Locations"
            right={
              <ToggleGroup
                options={[
                  { label: "City", value: "city" },
                  { label: "State", value: "state" },
                ]}
                value={locationMode}
                onChange={setLocationMode}
              />
            }
          />
          {loading ? (
            <Skeleton h={240} />
          ) : (
            <HBarChart
              data={locationData.map((r) => ({
                location: r.location,
                orders: r.order_count,
              }))}
              dataKey="orders"
              labelKey="location"
            />
          )}
        </Card>

        {/* Channel Split */}
        <Card>
          <CardHeader title="Channel Split" />
          {loading ? (
            <Skeleton h={240} />
          ) : (
            <DonutChart
              data={channelDonutData}
              colors={CHANNEL_COLORS}
              centerLabel={channelTotal.toLocaleString()}
              centerSub="orders"
            />
          )}
        </Card>
      </div>

      {/* Row 2: Top Variants (full width) */}
      <Card>
        <CardHeader
          title="Top 10 Variants"
          right={
            <div className="flex items-center gap-2">
              <ToggleGroup
                options={[
                  { label: "By Units", value: "units" },
                  { label: "By GMV", value: "gmv" },
                ]}
                value={variantSort}
                onChange={setVariantSort}
              />
              <ToggleGroup
                options={[
                  { label: "All", value: "all" },
                  { label: "Organic", value: "organic" },
                  { label: "Inorganic", value: "inorganic" },
                ]}
                value={variantSource}
                onChange={setVariantSource}
              />
            </div>
          }
        />
        {loading ? (
          <Skeleton h={280} />
        ) : (
          <HBarChart
            data={variantData.map((r) => ({
              location: r.variant_label,
              value: variantSort === "units" ? r.qty_sold : r.gmv,
            }))}
            dataKey="value"
            labelKey="location"
            tickFmt={variantSort === "gmv" ? fmtINR : undefined}
          />
        )}
      </Card>

      {/* Row 3: RTO Rate + COD/Prepaid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* RTO Rate */}
        <Card>
          <CardHeader title="RTO Rate" />
          {loading ? (
            <Skeleton h={140} />
          ) : data ? (
            <RTOCard current={data.summary.current} prev={data.summary.prev} />
          ) : null}
        </Card>

        {/* COD vs Prepaid */}
        <Card>
          <CardHeader title="COD vs Prepaid" />
          {loading ? (
            <Skeleton h={240} />
          ) : (
            <DonutChart
              data={paymentDonutData}
              colors={PAYMENT_COLORS}
              centerLabel={paymentTotal.toLocaleString()}
              centerSub="orders"
            />
          )}
        </Card>
      </div>
    </div>
  );
}
