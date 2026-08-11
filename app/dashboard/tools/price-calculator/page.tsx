"use client";

import { useState, useCallback } from "react";
import { Calculator, RotateCcw, ArrowRightLeft, AlertTriangle, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ── Types ────────────────────────────────────────────────────────────────────

type Mode = "check" | "find";

interface Breakdown {
  costPrice: number;
  inputTaxAmount: number;
  shipping: number;
  packaging: number;
  paymentGatewayFee: number;
  checkoutFee: number;
  adCost: number;
  codBenefit: number;
  securityCost: number;
  totalCosts: number;
  sellingPrice: number;
  outputGstAmount: number;
  finalSp: number;
  profit: number;
  profitMarginPct: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatINR(n: number): string {
  if (!isFinite(n)) return "—";
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseNum(v: string): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function computeBreakdown(
  cost: number,
  inputTaxPct: number,
  shipping: number,
  packaging: number,
  pgPct: number,
  checkoutPct: number,
  roas: number,
  codBenefit: number,
  security: number,
  gstOutPct: number,
  sp: number
): Breakdown {
  const inputTaxAmount = round2(cost * (inputTaxPct / 100));
  const paymentGatewayFee = round2(sp * (pgPct / 100));
  const checkoutFee = round2(sp * (checkoutPct / 100));
  const adCost = round2(sp / roas);
  const outputGstAmount = round2(sp - sp / (1 + gstOutPct / 100));
  const finalSp = round2(sp / (1 + gstOutPct / 100));
  const totalCosts = round2(
    cost + inputTaxAmount + shipping + packaging + paymentGatewayFee + checkoutFee + adCost + security - codBenefit
  );
  const profit = round2(finalSp - totalCosts);
  const profitMarginPct = finalSp > 0 ? round2((profit / finalSp) * 100) : 0;

  return {
    costPrice: cost,
    inputTaxAmount,
    shipping,
    packaging,
    paymentGatewayFee,
    checkoutFee,
    adCost,
    codBenefit,
    securityCost: security,
    totalCosts,
    sellingPrice: sp,
    outputGstAmount,
    finalSp,
    profit,
    profitMarginPct,
  };
}

function computeRequiredSellingPrice(
  cost: number,
  inputTaxPct: number,
  shipping: number,
  packaging: number,
  pgPct: number,
  checkoutPct: number,
  roas: number,
  codBenefit: number,
  security: number,
  gstOutPct: number,
  targetMarginPct: number
): { sp: number | null; error: string | null } {
  const inputTaxAmount = cost * (inputTaxPct / 100);
  const fixedCosts = cost + inputTaxAmount + shipping + packaging + security - codBenefit;
  const pg = pgPct / 100;
  const co = checkoutPct / 100;
  const ad = 1 / roas;
  const gst = gstOutPct / 100;
  const margin = targetMarginPct / 100;

  const denominator = (1 - margin) / (1 + gst) - (pg + co + ad);

  if (denominator <= 0) {
    return { sp: null, error: "Target margin is impossible — variable costs exceed net revenue rate." };
  }

  const sp = round2(fixedCosts / denominator);
  return { sp, error: null };
}

// ── Input component ─────────────────────────────────────────────────────────

function NumInput({
  label,
  value,
  onChange,
  placeholder,
  suffix,
  min = 0,
  step = "0.01",
  sublabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: string;
  min?: number;
  step?: string;
  sublabel?: string;
}) {
  return (
    <div>
      <label
        className="flex items-center gap-1"
        style={{
          fontSize: 11,
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.065em",
          color: "#525252",
          marginBottom: 6,
        }}
      >
        <span>{label}</span>
        {sublabel && (
          <Tooltip>
            <TooltipTrigger render={<span />}>
              <Info size={12} className="cursor-help" style={{ color: "#8a8a8a" }} />
            </TooltipTrigger>
            <TooltipContent side="top" className="leading-relaxed">
              {sublabel}
            </TooltipContent>
          </Tooltip>
        )}
      </label>
      <div className="relative">
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full text-sm rounded-xl px-3 py-2.5 outline-none"
          style={{
            border: "1px solid #E2E2E2",
            color: "#525252",
            backgroundColor: "#ffffff",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "#FFC533";
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(255,197,51,0.12)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "#E2E2E2";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
        {suffix && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium pointer-events-none"
            style={{ color: "#b0a8a8" }}
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Result row ──────────────────────────────────────────────────────────────

function ResultRow({
  label,
  value,
  highlight = false,
  negative = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid #F0EBE0" }}>
      <span className="text-sm" style={{ color: "#8a8a8a" }}>
        {label}
      </span>
      <span
        className="text-sm font-semibold"
        style={{
          color: negative ? "#e05252" : highlight ? "#FFC533" : "#525252",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function SectionHeader({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div className={compact ? "pb-1" : "pt-2 pb-1"}>
      <span
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: "#b0a8a8" }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PriceCalculatorPage() {
  const [mode, setMode] = useState<Mode>("check");

  // Cost inputs
  const [costPrice, setCostPrice] = useState("");
  const [inputTaxPct, setInputTaxPct] = useState("5");
  const [shipping, setShipping] = useState("350");
  const [packaging, setPackaging] = useState("86");
  const [paymentGatewayPct, setPaymentGatewayPct] = useState("0.8");
  const [checkoutPct, setCheckoutPct] = useState("2");
  const [codBenefit, setCodBenefit] = useState("30");
  const [securityCost, setSecurityCost] = useState("50");
  const [roas, setRoas] = useState("2.5");
  const [outputGstPct, setOutputGstPct] = useState("5");

  // Mode-specific inputs
  const [sellingPrice, setSellingPrice] = useState("");
  const [targetProfitPct, setTargetProfitPct] = useState("");

  const reset = useCallback(() => {
    setCostPrice("");
    setInputTaxPct("5");
    setShipping("350");
    setPackaging("86");
    setPaymentGatewayPct("0.8");
    setCheckoutPct("2");
    setCodBenefit("30");
    setSecurityCost("50");
    setRoas("2.5");
    setOutputGstPct("5");
    setSellingPrice("");
    setTargetProfitPct("");
  }, []);

  // Parse shared inputs
  const cost = parseNum(costPrice);
  const taxIn = parseNum(inputTaxPct);
  const ship = parseNum(shipping);
  const pack = parseNum(packaging);
  const pgPct = parseNum(paymentGatewayPct);
  const coPct = parseNum(checkoutPct);
  const roasVal = parseNum(roas);
  const cod = parseNum(codBenefit);
  const sec = parseNum(securityCost);
  const gstOut = parseNum(outputGstPct);

  // Compute breakdowns
  let checkBreakdown: Breakdown | null = null;
  if (mode === "check" && cost > 0) {
    const sp = parseNum(sellingPrice);
    if (sp > 0 && roasVal > 0) {
      checkBreakdown = computeBreakdown(cost, taxIn, ship, pack, pgPct, coPct, roasVal, cod, sec, gstOut, sp);
    }
  }

  let findBreakdown: Breakdown | null = null;
  let findError: string | null = null;
  if (mode === "find" && cost > 0) {
    const target = parseNum(targetProfitPct);
    if (target > 0 && roasVal > 0) {
      const result = computeRequiredSellingPrice(cost, taxIn, ship, pack, pgPct, coPct, roasVal, cod, sec, gstOut, target);
      findError = result.error;
      if (result.sp && result.sp > 0) {
        findBreakdown = computeBreakdown(cost, taxIn, ship, pack, pgPct, coPct, roasVal, cod, sec, gstOut, result.sp);
      }
    }
  }

  const breakdown = mode === "check" ? checkBreakdown : findBreakdown;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1
            className="text-xl font-semibold"
            style={{ color: "#525252", fontFamily: "var(--font-poppins), sans-serif" }}
          >
            Price Calculator
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#8a8a8a" }}>
            Check profitability or find the right selling price for your target margin
          </p>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors hover:bg-[#f5f0ed]"
          style={{ color: "#8a8a8a", border: "1px solid #E2E2E2" }}
          title="Reset all fields"
        >
          <RotateCcw size={13} />
          Reset
        </button>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-1.5">
        <button
          onClick={() => setMode("check")}
          className="px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-100"
          style={
            mode === "check"
              ? { backgroundColor: "#FFC533", color: "#222222" }
              : { backgroundColor: "#ffffff", border: "1px solid #E2E2E2", color: "#525252" }
          }
        >
          Check Profit
        </button>
        <button
          onClick={() => setMode("find")}
          className="px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-100"
          style={
            mode === "find"
              ? { backgroundColor: "#FFC533", color: "#222222" }
              : { backgroundColor: "#ffffff", border: "1px solid #E2E2E2", color: "#525252" }
          }
        >
          Find Price
        </button>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Left: Inputs ── */}
        <div
          className="rounded-2xl p-6 space-y-4"
          style={{
            background: "#fff",
            border: "1px solid #E2E2E2",
            boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
          }}
        >
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 rounded-xl" style={{ backgroundColor: "#FFEDAB" }}>
              <Calculator size={14} style={{ color: "#FFC533" }} />
            </div>
            <h3 className="text-sm font-semibold" style={{ color: "#525252" }}>
              {mode === "check" ? "Enter your costs and selling price" : "Enter your costs and target margin"}
            </h3>
          </div>

          {/* Primary pricing inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-5" style={{ borderBottom: "1px solid #F0EBE0" }}>
            <NumInput
              label="Cost Price"
              value={costPrice}
              onChange={setCostPrice}
              placeholder="e.g. 2550"
            />
            {mode === "check" ? (
              <NumInput
                label="Selling Price (MRP incl. GST)"
                value={sellingPrice}
                onChange={setSellingPrice}
                placeholder="e.g. 5599"
              />
            ) : (
              <NumInput
                label="Target Profit Margin %"
                value={targetProfitPct}
                onChange={setTargetProfitPct}
                suffix="%"
                placeholder="e.g. 30"
                sublabel="Profit as % of net revenue (after GST)"
              />
            )}
          </div>

          {/* Tax */}
          <div className="space-y-3">
            <SectionHeader label="Tax & GST" compact />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumInput
                label="Input Tax / GST %"
                value={inputTaxPct}
                onChange={setInputTaxPct}
                suffix="%"
                sublabel="GST paid on procurement"
              />
              <NumInput
                label="Output GST %"
                value={outputGstPct}
                onChange={setOutputGstPct}
                suffix="%"
                sublabel="GST charged to customer"
              />
            </div>
          </div>

          {/* Fulfilment costs */}
          <div className="space-y-3">
            <SectionHeader label="Fulfilment Costs" compact />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <NumInput label="Shipping Cost" value={shipping} onChange={setShipping} placeholder="e.g. 350" />
              <NumInput label="Packaging Cost" value={packaging} onChange={setPackaging} placeholder="e.g. 86" />
              <NumInput label="Shipment Security" value={securityCost} onChange={setSecurityCost} placeholder="e.g. 50" />
            </div>
          </div>

          {/* Selling costs */}
          <div className="space-y-3">
            <SectionHeader label="Selling Costs" compact />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumInput
                label="Payment Gateway %"
                value={paymentGatewayPct}
                onChange={setPaymentGatewayPct}
                suffix="%"
                sublabel="Of selling price"
              />
              <NumInput
                label="Checkout Cost %"
                value={checkoutPct}
                onChange={setCheckoutPct}
                suffix="%"
                sublabel="Of selling price"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumInput
                label="ROAS"
                value={roas}
                onChange={setRoas}
                placeholder="e.g. 2.5"
                sublabel="Revenue / Ad spend"
              />
              <NumInput
                label="COD Benefit"
                value={codBenefit}
                onChange={setCodBenefit}
                placeholder="e.g. 30"
                sublabel="Positive = saves cost"
              />
            </div>
          </div>

          {/* Hint */}
          <div
            className="rounded-xl px-4 py-3 text-xs leading-relaxed"
            style={{ backgroundColor: "#FFF8ED", color: "#8a8a8a" }}
          >
            {mode === "check" ? (
              <>
                <strong style={{ color: "#525252" }}>How it works:</strong> Enter your landed cost and all per-order expenses. The calculator shows your true profit after accounting for GST, shipping, payment fees, ads (via ROAS), and all other costs.
              </>
            ) : (
              <>
                <strong style={{ color: "#525252" }}>How it works:</strong> Enter your costs and a target profit margin. The calculator works backwards from your margin goal to tell you the exact selling price (MRP) you need to hit.
              </>
            )}
          </div>
        </div>

        {/* ── Right: Breakdown ── */}
        <div
          className="rounded-2xl p-6 space-y-3"
          style={{
            background: "#fff",
            border: "1px solid #E2E2E2",
            boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
          }}
        >
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 rounded-xl" style={{ backgroundColor: "#FFEDAB" }}>
              <ArrowRightLeft size={14} style={{ color: "#FFC533" }} />
            </div>
            <h3 className="text-sm font-semibold" style={{ color: "#525252" }}>
              {mode === "check" ? "Profit Breakdown" : "Required Price Breakdown"}
            </h3>
          </div>

          {!breakdown ? (
            <div className="flex flex-col items-center justify-center py-14 gap-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#FFEDAB" }}>
                <Calculator size={18} style={{ color: "#FFC533" }} />
              </div>
              <p className="text-sm font-medium" style={{ color: "#525252" }}>
                {mode === "check" ? "Enter cost price and selling price" : "Enter cost price and target margin"}
              </p>
              <p className="text-xs" style={{ color: "#8a8a8a" }}>
                {mode === "check"
                  ? "To see your profit/loss breakdown"
                  : "To compute the required selling price"}
              </p>
            </div>
          ) : findError ? (
            <div className="flex flex-col items-center justify-center py-14 gap-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#fdecea" }}>
                <AlertTriangle size={18} style={{ color: "#e05252" }} />
              </div>
              <p className="text-sm font-medium" style={{ color: "#e05252" }}>
                {findError}
              </p>
              <p className="text-xs" style={{ color: "#8a8a8a" }}>
                Try lowering your target margin or reducing fixed costs.
              </p>
            </div>
          ) : (
            <>
              {/* Fixed Costs */}
              <SectionHeader label="Fixed Costs" />
              <ResultRow label="Cost Price" value={formatINR(breakdown.costPrice)} />
              <ResultRow label={`Input Tax (${taxIn}%)`} value={formatINR(breakdown.inputTaxAmount)} />
              <ResultRow label="Shipping" value={formatINR(breakdown.shipping)} />
              <ResultRow label="Packaging" value={formatINR(breakdown.packaging)} />
              <ResultRow label="Shipment Security" value={formatINR(breakdown.securityCost)} />

              {/* Variable Costs */}
              <SectionHeader label="Variable Costs (per order)" />
              <ResultRow label={`Payment Gateway (${pgPct}%)`} value={formatINR(breakdown.paymentGatewayFee)} />
              <ResultRow label={`Checkout (${coPct}%)`} value={formatINR(breakdown.checkoutFee)} />
              <ResultRow label={`Ad Cost (ROAS ${roasVal})`} value={formatINR(breakdown.adCost)} />
              <ResultRow
                label="COD Benefit"
                value={breakdown.codBenefit > 0 ? `- ${formatINR(breakdown.codBenefit)}` : formatINR(-breakdown.codBenefit)}
              />

              {/* Total Costs */}
              <div className="py-1">
                <div
                  className="flex items-center justify-between rounded-xl px-4 py-2.5"
                  style={{ backgroundColor: "#f5f0ed" }}
                >
                  <span className="text-sm font-semibold" style={{ color: "#525252" }}>
                    Total Costs
                  </span>
                  <span className="text-sm font-bold" style={{ color: "#525252" }}>
                    {formatINR(breakdown.totalCosts)}
                  </span>
                </div>
              </div>

              {/* Revenue */}
              <SectionHeader label="Revenue" />
              <ResultRow
                label="Selling Price (MRP)"
                value={formatINR(breakdown.sellingPrice)}
                highlight
              />
              <ResultRow label={`Output GST (${gstOut}%)`} value={formatINR(breakdown.outputGstAmount)} />
              <ResultRow label="Net Revenue (excl. GST)" value={formatINR(breakdown.finalSp)} />

              {/* Profit */}
              <div className="py-1">
                <div
                  className="flex items-center justify-between rounded-xl px-4 py-3"
                  style={{
                    backgroundColor: breakdown.profit >= 0 ? "#e8f5e9" : "#fdecea",
                  }}
                >
                  <span className="text-sm font-semibold" style={{ color: "#525252" }}>
                    Profit
                  </span>
                  <span
                    className="text-lg font-bold"
                    style={{ color: breakdown.profit >= 0 ? "#2e7d32" : "#e05252" }}
                  >
                    {breakdown.profit >= 0 ? "+" : ""}
                    {formatINR(breakdown.profit)}
                  </span>
                </div>
              </div>

              {/* Margin */}
              <div className="flex items-center justify-between py-1">
                <span className="text-sm" style={{ color: "#8a8a8a" }}>
                  Profit Margin
                </span>
                <span
                  className="text-sm font-bold"
                  style={{ color: breakdown.profitMarginPct >= 0 ? "#2e7d32" : "#e05252" }}
                >
                  {breakdown.profitMarginPct >= 0 ? "+" : ""}
                  {breakdown.profitMarginPct.toFixed(2)}%
                </span>
              </div>

              {/* Health badge */}
              <div className="pt-1">
                {breakdown.profitMarginPct >= 30 ? (
                  <span
                    className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}
                  >
                    Healthy margin
                  </span>
                ) : breakdown.profitMarginPct >= 15 ? (
                  <span
                    className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: "#fff3e0", color: "#d4600a" }}
                  >
                    Moderate margin
                  </span>
                ) : breakdown.profitMarginPct >= 0 ? (
                  <span
                    className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: "#fff8ed", color: "#d4600a" }}
                  >
                    Thin margin
                  </span>
                ) : (
                  <span
                    className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: "#fdecea", color: "#c62828" }}
                  >
                    Loss — review pricing
                  </span>
                )}
              </div>

              {/* Find mode extra note */}
              {mode === "find" && (
                <div
                  className="rounded-xl px-4 py-3 text-xs leading-relaxed mt-2"
                  style={{ backgroundColor: "#FFF8ED", color: "#8a8a8a" }}
                >
                  <strong style={{ color: "#525252" }}>Required Selling Price:</strong>{" "}
                  To hit a {parseNum(targetProfitPct)}% margin on net revenue, you need to price this product at{" "}
                  <strong style={{ color: "#FFC533" }}>{formatINR(breakdown.sellingPrice)}</strong>.
                  At this price, your total costs will be {formatINR(breakdown.totalCosts)} and your net revenue
                  (after {gstOut}% GST) will be {formatINR(breakdown.finalSp)}.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
