import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string;
  subtext?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
}

export default function MetricCard({
  label,
  value,
  subtext,
  icon: Icon,
  trend,
  trendLabel,
}: MetricCardProps) {
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
        <p className="text-[0.8125rem] font-medium" style={{ color: "#8a8a8a" }}>
          {label}
        </p>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{
            backgroundColor: "#f9e8eb",
            boxShadow: "inset 0 1px 2px rgba(213, 114, 130, 0.08)",
          }}
        >
          <Icon size={17} style={{ color: "#d57282" }} />
        </div>
      </div>

      <div>
        <p className="text-2xl font-semibold tracking-tight" style={{ color: "#525252" }}>
          {value}
        </p>
        {(subtext || trendLabel) && (
          <p className="text-xs mt-0.5 font-medium" style={{ color: trendColor }}>
            {trendLabel ?? subtext}
          </p>
        )}
      </div>
    </div>
  );
}
