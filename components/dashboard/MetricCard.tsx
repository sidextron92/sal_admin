"use client";

import { Info } from "lucide-react";
import { useState } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  subvalue?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  tooltip?: string;
  children?: React.ReactNode;
}

export default function MetricCard({
  label,
  value,
  subvalue,
  icon,
  trend,
  trendLabel,
  tooltip,
  children,
}: MetricCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const trendColor =
    trend === "up"
      ? "#22c55e"
      : trend === "down"
      ? "#ef4444"
      : "#8a8a8a";

  return (
    <div
      className="bg-white rounded-2xl p-5 flex flex-col gap-3 border transition-all duration-200 hover:-translate-y-px"
      style={{
        borderColor: "#E2E2E2",
        boxShadow: "0 2px 16px rgba(213, 114, 130, 0.07)",
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <p className="text-[0.8125rem] font-medium" style={{ color: "#8a8a8a" }}>
            {label}
          </p>
          {tooltip && (
            <div className="relative flex items-center">
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="flex items-center focus:outline-none"
                tabIndex={-1}
              >
                <Info size={12} style={{ color: "#b0a0a0" }} />
              </button>
              {showTooltip && (
                <div
                  className="absolute left-0 top-5 z-50 w-56 rounded-xl p-3 text-xs leading-relaxed shadow-lg"
                  style={{
                    backgroundColor: "#fff",
                    border: "1px solid #E2E2E2",
                    color: "#525252",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
                  }}
                >
                  {tooltip}
                </div>
              )}
            </div>
          )}
        </div>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{
            backgroundColor: "#f9e8eb",
            boxShadow: "inset 0 1px 2px rgba(213, 114, 130, 0.08)",
          }}
        >
          {icon}
        </div>
      </div>

      <div>
        <p className="text-2xl font-semibold tracking-tight" style={{ color: "#525252" }}>
          {value}
        </p>
        {subvalue && (
          <p className="text-sm font-medium mt-0.5" style={{ color: "#8a8a8a" }}>
            {subvalue}
          </p>
        )}
        {trendLabel && (
          <p className="text-xs mt-0.5 font-medium" style={{ color: trendColor }}>
            {trendLabel}
          </p>
        )}
      </div>

      {children}
    </div>
  );
}
