"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { TrendingUp, AlertCircle, Info } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type Channel = "ALL" | "Shopify" | "Amazon" | "Offline";
type FilterMode = "month" | "custom";

interface PnLRevenue {
  gross_revenue: number;
  total_discounts: number;
  shipping_revenue: number;
  net_revenue: number;
  cogs: number;
  gross_profit: number;
  gross_margin_pct: number;
  order_count: number;
}

interface PnLExpenses {
  logistic: number;
  packaging: number;
  payment_gateway: number;
  cm2: number;
  cm2_margin_pct: number;
  marketing: number;
  cm3: number;
  cm3_margin_pct: number;
  employee: number;
  software: number;
  miscellaneous: number;
  ebitda: number;
  ebitda_margin_pct: number;
}

interface PnLRto {
  rto_count: number;
  rto_rate_pct: number;
}

interface TrendMonth {
  month_label: string;
  net_revenue: number;
  cm1: number;
  cm2: number;
  cm3: number;
  ebitda: number;
}

interface PnLResponse {
  revenue: PnLRevenue;
  expenses: PnLExpenses;
  rto: PnLRto;
  trend: TrendMonth[];
  meta: { date_from: string; date_to: string; channel: string; cogs_note: string };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatINR(n: number): string {
  if (Math.abs(n) >= 100000)
    return (n < 0 ? "-" : "") + "₹" + (Math.abs(n) / 100000).toFixed(2) + "L";
  if (Math.abs(n) >= 1000)
    return (n < 0 ? "-" : "") + "₹" + (Math.abs(n) / 1000).toFixed(1) + "K";
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatINRFull(n: number): string {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? "-₹" : "₹") + formatted;
}

function currentMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── Hero KPI Card ──────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  const valueColor =
    positive === undefined ? "#525252" : positive ? "#27a559" : "#e05252";

  return (
    <div
      className="rounded-2xl px-5 py-4"
      style={{
        backgroundColor: "#ffffff",
        boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
        border: "1px solid #E2E2E2",
      }}
    >
      <p
        className="text-xs font-medium uppercase tracking-wide mb-1"
        style={{ color: "#8a8a8a" }}
      >
        {label}
      </p>
      <p
        className="text-xl font-semibold"
        style={{ color: valueColor, fontFamily: "var(--font-poppins), sans-serif" }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-xs mt-0.5" style={{ color: "#8a8a8a" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ── P&L Waterfall Table ────────────────────────────────────────────────────

type RowKind = "item" | "result" | "divider" | "subitem";

interface TableRowConfig {
  kind: RowKind;
  label: string;
  tooltip?: string;
  getValue?: (d: PnLResponse) => number;
  getPct?: (d: PnLResponse) => number;
  negative?: boolean; // amount should be shown as negative (deduction)
}

const WATERFALL_ROWS: TableRowConfig[] = [
  {
    kind: "item",
    label: "Gross Revenue",
    tooltip: "Sum of original unit prices × quantity across all line items. Includes GST (not stripped).",
    getValue: (d) => d.revenue.gross_revenue,
  },
  {
    kind: "subitem",
    label: "− Discounts",
    tooltip: "Difference between original line totals and discounted line totals.",
    getValue: (d) => d.revenue.total_discounts,
    negative: true,
  },
  {
    kind: "subitem",
    label: "+ Shipping Revenue",
    tooltip: "Shipping charges collected from customers (total_price − subtotal_price per order).",
    getValue: (d) => d.revenue.shipping_revenue,
  },
  {
    kind: "divider",
    label: "",
  },
  {
    kind: "result",
    label: "Net Revenue",
    tooltip: "Gross Revenue − Discounts + Shipping Revenue = SUM(orders.total_price).",
    getValue: (d) => d.revenue.net_revenue,
    getPct: () => 100,
  },
  {
    kind: "subitem",
    label: "− COGS",
    tooltip:
      "Cost of goods sold: SUM(variant.cost × quantity). Uses current cost snapshot — not historical cost at time of sale.",
    getValue: (d) => d.revenue.cogs,
    negative: true,
  },
  {
    kind: "divider",
    label: "",
  },
  {
    kind: "result",
    label: "Gross Profit (CM1)",
    getValue: (d) => d.revenue.gross_profit,
    getPct: (d) => d.revenue.gross_margin_pct,
  },
  {
    kind: "subitem",
    label: "− Logistics",
    getValue: (d) => d.expenses.logistic,
    negative: true,
  },
  {
    kind: "subitem",
    label: "− Packaging",
    getValue: (d) => d.expenses.packaging,
    negative: true,
  },
  {
    kind: "subitem",
    label: "− Payment Gateway",
    getValue: (d) => d.expenses.payment_gateway,
    negative: true,
  },
  {
    kind: "divider",
    label: "",
  },
  {
    kind: "result",
    label: "CM2 (Fulfillment Contribution)",
    tooltip: "Gross Profit after logistics, packaging and payment gateway costs.",
    getValue: (d) => d.expenses.cm2,
    getPct: (d) => d.expenses.cm2_margin_pct,
  },
  {
    kind: "subitem",
    label: "− Marketing",
    getValue: (d) => d.expenses.marketing,
    negative: true,
  },
  {
    kind: "divider",
    label: "",
  },
  {
    kind: "result",
    label: "CM3 (Contribution Margin)",
    tooltip: "CM2 minus marketing spend. Measures true variable-cost profitability.",
    getValue: (d) => d.expenses.cm3,
    getPct: (d) => d.expenses.cm3_margin_pct,
  },
  {
    kind: "subitem",
    label: "− Employee",
    getValue: (d) => d.expenses.employee,
    negative: true,
  },
  {
    kind: "subitem",
    label: "− Software",
    getValue: (d) => d.expenses.software,
    negative: true,
  },
  {
    kind: "subitem",
    label: "− Miscellaneous",
    getValue: (d) => d.expenses.miscellaneous,
    negative: true,
  },
  {
    kind: "divider",
    label: "",
  },
  {
    kind: "result",
    label: "EBITDA",
    tooltip: "Earnings before interest, tax, depreciation & amortisation.",
    getValue: (d) => d.expenses.ebitda,
    getPct: (d) => d.expenses.ebitda_margin_pct,
  },
];

function PnLWaterfallTable({ data }: { data: PnLResponse }) {
  const netRev = data.revenue.net_revenue;

  return (
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
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid #f0eae6", backgroundColor: "#faf7f5" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#8a8a8a" }}>
          P&amp;L Statement
        </p>
        <div className="flex gap-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-right w-28" style={{ color: "#8a8a8a" }}>
            Amount
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-right w-16" style={{ color: "#8a8a8a" }}>
            % of Rev
          </p>
        </div>
      </div>

      {WATERFALL_ROWS.map((row, i) => {
        if (row.kind === "divider") {
          return (
            <div
              key={i}
              style={{ height: 1, backgroundColor: "#f0eae6", margin: "2px 0" }}
            />
          );
        }

        const amount = row.getValue ? row.getValue(data) : 0;
        const pct = row.getPct ? row.getPct(data) : netRev !== 0 ? Math.round((Math.abs(amount) / Math.abs(netRev)) * 1000) / 10 : 0;
        const displayAmount = row.negative ? -amount : amount;
        const isResult = row.kind === "result";
        const isPositive = amount >= 0;

        let amountColor = "#525252";
        if (isResult) {
          amountColor = isPositive ? "#27a559" : "#e05252";
        } else if (row.negative) {
          amountColor = "#525252";
        }

        const rowBg = isResult
          ? isPositive
            ? "rgba(39,165,89,0.05)"
            : "rgba(224,82,82,0.05)"
          : "transparent";

        const borderLeft = isResult
          ? `3px solid ${isPositive ? "#27a559" : "#e05252"}`
          : "3px solid transparent";

        return (
          <div
            key={i}
            className="flex items-center justify-between px-5 py-2.5"
            style={{
              backgroundColor: rowBg,
              borderLeft,
              borderBottom: "1px solid #f8f4f2",
            }}
          >
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              {row.kind === "subitem" && (
                <span className="w-3 shrink-0" />
              )}
              <span
                className="text-sm truncate"
                style={{
                  color: "#525252",
                  fontWeight: isResult ? 600 : 400,
                  fontFamily: "var(--font-poppins), sans-serif",
                }}
                title={row.tooltip}
              >
                {row.label}
              </span>
              {row.tooltip && (
                <span title={row.tooltip} style={{ display: "inline-flex", flexShrink: 0 }}>
                  <Info size={11} style={{ color: "#c0b8b8" }} />
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <span
                className="text-sm text-right w-28"
                style={{
                  color: amountColor,
                  fontWeight: isResult ? 600 : 400,
                }}
              >
                {formatINRFull(displayAmount)}
              </span>
              <span
                className="text-xs text-right w-16"
                style={{ color: "#8a8a8a" }}
              >
                {pct.toFixed(1)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── RTO Stats Card ─────────────────────────────────────────────────────────

function RtoStatsCard({ rto }: { rto: PnLRto }) {
  return (
    <div
      className="rounded-2xl px-5 py-4"
      style={{
        backgroundColor: "#ffffff",
        boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
        border: "1px solid #E2E2E2",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div style={{ width: 3, height: 14, backgroundColor: "#d57282", borderRadius: 2, flexShrink: 0 }} />
        <p className="text-sm font-semibold" style={{ color: "#525252" }}>
          RTO Stats
        </p>
      </div>

      <div className="flex gap-4">
        <div>
          <p className="text-xs" style={{ color: "#8a8a8a" }}>RTO Orders</p>
          <p className="text-lg font-semibold" style={{ color: "#525252" }}>
            {rto.rto_count}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: "#8a8a8a" }}>RTO Rate</p>
          <p className="text-lg font-semibold" style={{ color: rto.rto_rate_pct > 10 ? "#e05252" : "#525252" }}>
            {rto.rto_rate_pct.toFixed(1)}%
          </p>
        </div>
      </div>

      <div
        className="flex items-start gap-1.5 mt-3 px-3 py-2 rounded-xl"
        style={{ backgroundColor: "#f9f4f0" }}
      >
        <AlertCircle size={11} style={{ color: "#8a8a8a", marginTop: 2, flexShrink: 0 }} />
        <p className="text-xs leading-relaxed" style={{ color: "#8a8a8a" }}>
          RTO orders are not subtracted from revenue — shown for operational awareness only.
        </p>
      </div>
    </div>
  );
}

// ── Trend Chart ────────────────────────────────────────────────────────────

function formatChartINR(value: number) {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${value}`;
}

const PCT_SERIES = new Set(["CM1", "CM2", "CM3", "EBITDA"]);

function TrendTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const netRevEntry = payload.find((p) => p.name === "Net Revenue");
  const netRev = netRevEntry ? netRevEntry.value : 0;
  return (
    <div
      className="rounded-xl px-3 py-2.5 text-xs"
      style={{
        border: "1px solid #E2E2E2",
        backgroundColor: "#fff",
        color: "#525252",
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        minWidth: 160,
      }}
    >
      <p className="font-semibold mb-1.5" style={{ color: "#525252" }}>{label}</p>
      {payload.map((p) => {
        const pct = PCT_SERIES.has(p.name) && netRev !== 0
          ? ` (${((p.value / netRev) * 100).toFixed(1)}%)`
          : "";
        return (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: {formatChartINR(p.value)}<span style={{ color: "#8a8a8a" }}>{pct}</span>
          </p>
        );
      })}
    </div>
  );
}

const TREND_SERIES = [
  { key: "net_revenue", name: "Net Revenue", color: "#d57282" },
  { key: "cm1",         name: "CM1",         color: "#27a559" },
  { key: "cm2",         name: "CM2",         color: "#4a9fde" },
  { key: "cm3",         name: "CM3",         color: "#f0a64e" },
  { key: "ebitda",      name: "EBITDA",      color: "#7c6fde" },
];

function PnLTrendChart({ trend }: { trend: TrendMonth[] }) {
  if (!trend || trend.length === 0) {
    return (
      <div
        className="rounded-2xl p-5 flex items-center justify-center"
        style={{
          backgroundColor: "#ffffff",
          boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
          border: "1px solid #E2E2E2",
          minHeight: 280,
        }}
      >
        <p className="text-sm" style={{ color: "#8a8a8a" }}>No trend data yet.</p>
      </div>
    );
  }

  // Check if any value goes negative (need reference line)
  const hasNegative = trend.some(
    (r) => r.cm1 < 0 || r.cm2 < 0 || r.cm3 < 0 || r.ebitda < 0
  );

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        backgroundColor: "#ffffff",
        boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
        border: "1px solid #E2E2E2",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div style={{ width: 3, height: 14, backgroundColor: "#d57282", borderRadius: 2, flexShrink: 0 }} />
        <p className="text-sm font-semibold" style={{ color: "#525252" }}>
          Margin Trend · Last 12 Months
        </p>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={trend} barSize={6} barGap={1}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
          <XAxis
            dataKey="month_label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#8a8a8a" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#8a8a8a" }}
            tickFormatter={formatChartINR}
            width={48}
          />
          {hasNegative && (
            <ReferenceLine y={0} stroke="#c0b8b8" strokeWidth={1} />
          )}
          <Tooltip content={<TrendTooltip />} cursor={{ fill: "#f9e8eb", opacity: 0.3 }} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
          {TREND_SERIES.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              fill={s.color}
              radius={[3, 3, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Month/Year Picker (Safari-safe replacement for input[type=month]) ──────

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function MonthYearPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [selYear, selMonth] = value.split("-").map(Number);
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  const selectStyle: React.CSSProperties = {
    borderRadius: 12,
    border: "1px solid #E2E2E2",
    color: "#525252",
    backgroundColor: "#ffffff",
    fontSize: 14,
    padding: "8px 12px",
    outline: "none",
    cursor: "pointer",
    fontFamily: "var(--font-poppins), sans-serif",
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238a8a8a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
    paddingRight: 30,
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={selMonth}
        onChange={(e) => onChange(`${selYear}-${String(Number(e.target.value)).padStart(2, "0")}`)}
        style={selectStyle}
      >
        {MONTH_NAMES.map((name, i) => (
          <option key={i + 1} value={i + 1}>{name}</option>
        ))}
      </select>
      <select
        value={selYear}
        onChange={(e) => onChange(`${e.target.value}-${String(selMonth).padStart(2, "0")}`)}
        style={selectStyle}
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function PnLSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl h-24" style={{ backgroundColor: "#f0eae6" }} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-2xl h-96" style={{ backgroundColor: "#f0eae6" }} />
        <div className="space-y-5">
          <div className="rounded-2xl h-32" style={{ backgroundColor: "#f0eae6" }} />
          <div className="rounded-2xl h-56" style={{ backgroundColor: "#f0eae6" }} />
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function PnLPage() {
  const [filterMode, setFilterMode] = useState<FilterMode>("month");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [channel, setChannel] = useState<Channel>("ALL");

  const [data, setData] = useState<PnLResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (filterMode === "custom" && (!customFrom || !customTo)) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const params = new URLSearchParams({ channel });
    if (filterMode === "month") {
      params.set("month", selectedMonth);
    } else {
      params.set("date_from", customFrom);
      params.set("date_to", customTo);
    }

    setLoading(true);
    setError(null);

    fetch(`/api/pnl?${params}`, { signal: ctrl.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
        return d as PnLResponse;
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message ?? "Failed to load P&L data.");
          setLoading(false);
        }
      });

    return () => ctrl.abort();
  }, [filterMode, selectedMonth, customFrom, customTo, channel]);

  const CHANNELS: Channel[] = ["ALL", "Shopify", "Amazon", "Offline"];

  function pillStyle(active: boolean) {
    return active
      ? {
          backgroundColor: "#d57282",
          color: "#ffffff",
          border: "1px solid #d57282",
          boxShadow: "0 2px 8px rgba(213,114,130,0.28)",
        }
      : {
          backgroundColor: "#ffffff",
          color: "#525252",
          border: "1px solid #E2E2E2",
        };
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h1
          className="text-xl font-semibold"
          style={{ color: "#525252", fontFamily: "var(--font-poppins), sans-serif" }}
        >
          Profit &amp; Loss
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "#8a8a8a" }}>
          D2C contribution margin waterfall — CM1 → CM2 → CM3 → EBITDA
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Mode toggle */}
        <div
          className="flex rounded-xl overflow-hidden"
          style={{ border: "1px solid #E2E2E2", backgroundColor: "#ffffff" }}
        >
          {(["month", "custom"] as FilterMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setFilterMode(m)}
              className="px-4 py-2 text-sm font-medium transition-all"
              style={
                filterMode === m
                  ? { backgroundColor: "#d57282", color: "#ffffff" }
                  : { backgroundColor: "transparent", color: "#525252" }
              }
            >
              {m === "month" ? "Month" : "Custom Range"}
            </button>
          ))}
        </div>

        {/* Date selector */}
        {filterMode === "month" ? (
          <MonthYearPicker value={selectedMonth} onChange={setSelectedMonth} />
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-3 py-2 text-sm outline-none"
              style={{
                borderRadius: 12,
                border: "1px solid #E2E2E2",
                color: "#525252",
                backgroundColor: "#ffffff",
              }}
            />
            <span className="text-xs" style={{ color: "#8a8a8a" }}>to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-3 py-2 text-sm outline-none"
              style={{
                borderRadius: 12,
                border: "1px solid #E2E2E2",
                color: "#525252",
                backgroundColor: "#ffffff",
              }}
            />
          </div>
        )}

        {/* Channel filter */}
        <div className="flex items-center gap-1">
          {CHANNELS.map((c) => (
            <button
              key={c}
              onClick={() => setChannel(c)}
              className="px-3 py-1.5 text-xs font-medium transition-all"
              style={{ borderRadius: 22, ...pillStyle(channel === c) }}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Expenses global note */}
        {channel !== "ALL" && (
          <p className="text-xs w-full" style={{ color: "#8a8a8a" }}>
            <Info
              size={11}
              style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }}
            />
            Expenses are global and not filtered by channel.
          </p>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <PnLSkeleton />
      ) : error ? (
        <div
          className="rounded-2xl px-5 py-8 text-center"
          style={{ backgroundColor: "#fff5f5", border: "1px solid #fecaca" }}
        >
          <p className="text-sm" style={{ color: "#e05252" }}>{error}</p>
        </div>
      ) : data ? (
        <>
          {/* Hero KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Net Revenue"
              value={formatINR(data.revenue.net_revenue)}
              sub={`${data.revenue.order_count} orders`}
            />
            <KpiCard
              label="Gross Margin %"
              value={`${data.revenue.gross_margin_pct.toFixed(1)}%`}
              sub={formatINR(data.revenue.gross_profit) + " gross profit"}
              positive={data.revenue.gross_margin_pct >= 0}
            />
            <KpiCard
              label="CM3 %"
              value={`${data.expenses.cm3_margin_pct.toFixed(1)}%`}
              sub={formatINR(data.expenses.cm3) + " contribution"}
              positive={data.expenses.cm3_margin_pct >= 0}
            />
            <KpiCard
              label="EBITDA %"
              value={`${data.expenses.ebitda_margin_pct.toFixed(1)}%`}
              sub={formatINR(data.expenses.ebitda) + " EBITDA"}
              positive={data.expenses.ebitda_margin_pct >= 0}
            />
          </div>

          {/* Main layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Waterfall table */}
            <div className="lg:col-span-2">
              <PnLWaterfallTable data={data} />
            </div>

            {/* Right column */}
            <div className="space-y-5">
              <RtoStatsCard rto={data.rto} />
              <PnLTrendChart trend={data.trend} />
            </div>
          </div>

          {/* Footnote */}
          <div
            className="flex items-start gap-2 px-4 py-3 rounded-xl"
            style={{ backgroundColor: "#faf7f5", border: "1px solid #f0eae6" }}
          >
            <TrendingUp size={13} style={{ color: "#8a8a8a", marginTop: 1, flexShrink: 0 }} />
            <p className="text-xs leading-relaxed" style={{ color: "#8a8a8a" }}>
              <strong>COGS note:</strong> {data.meta.cogs_note}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
