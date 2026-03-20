"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Truck,
  Package,
  BarChart2,
  FileText,
  Settings,
  Receipt,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  built: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/dashboard/overview", icon: LayoutDashboard, built: true },
  { label: "My Orders", href: "/dashboard/orders", icon: ShoppingBag, built: true },
  { label: "Shipping", href: "/dashboard/shipping", icon: Truck, built: false },
  { label: "Inventory", href: "/dashboard/inventory", icon: Package, built: true },
  { label: "Expenses", href: "/dashboard/expenses", icon: Receipt, built: true },
  { label: "Ads", href: "/dashboard/ads", icon: BarChart2, built: false },
  { label: "Reconciliation", href: "/dashboard/reconciliation", icon: FileText, built: false },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, built: true },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();

  const content = (
    <div
      className="flex flex-col h-full"
      style={{
        backgroundColor: "#faf7f5",
        borderRight: "1px solid #E2E2E2",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-between px-4 h-16 shrink-0"
        style={{ borderBottom: "1px solid #ede8e3" }}
      >
        {collapsed ? (
          <span
            style={{
              fontFamily: "var(--font-poppins), sans-serif",
              fontWeight: 300,
              fontSize: "1.375rem",
              letterSpacing: "0.15em",
              color: "#d57282",
              margin: "0 auto",
            }}
          >
            m
          </span>
        ) : (
          <span
            style={{
              fontFamily: "var(--font-poppins), sans-serif",
              fontWeight: 300,
              fontSize: "1.25rem",
              letterSpacing: "0.18em",
              color: "#d57282",
            }}
          >
            maeri
          </span>
        )}

        {/* Desktop collapse toggle */}
        <button
          onClick={onToggle}
          className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-[#f0e8e8]"
          style={{ color: "#b8a0a0" }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>

        {/* Mobile close */}
        <button
          onClick={onMobileClose}
          className="md:hidden flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-[#f0e8e8]"
          style={{ color: "#b8a0a0" }}
          aria-label="Close menu"
        >
          <X size={15} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          const linkContent = (
            <Link
              href={item.built ? item.href : "#"}
              onClick={!item.built ? (e) => e.preventDefault() : undefined}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                ${collapsed ? "justify-center" : ""}
                ${isActive ? "text-white" : "hover:bg-[#f0e8e8]"}
              `}
              style={{
                backgroundColor: isActive ? "#d57282" : undefined,
                color: isActive ? "#ffffff" : "#525252",
                boxShadow: isActive
                  ? "0 2px 10px rgba(213, 114, 130, 0.22)"
                  : undefined,
              }}
            >
              <Icon size={17} className="shrink-0" />
              {!collapsed && (
                <span className="flex-1 leading-none">{item.label}</span>
              )}
              {!collapsed && !item.built && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-4 font-medium"
                  style={{
                    backgroundColor: isActive ? "rgba(255,255,255,0.2)" : "#f9e8eb",
                    color: isActive ? "#ffffff" : "#d57282",
                    border: "none",
                  }}
                >
                  Soon
                </Badge>
              )}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger render={<div />}>
                  {linkContent}
                </TooltipTrigger>
                <TooltipContent side="right" className="flex items-center gap-2">
                  {item.label}
                  {!item.built && (
                    <span className="text-[10px] text-[#d57282] font-medium">
                      Soon
                    </span>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          }

          return <div key={item.href}>{linkContent}</div>;
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div
          className="px-4 py-3 text-[10px] shrink-0 tracking-wide"
          style={{ color: "#c4b0b0", borderTop: "1px solid #ede8e3" }}
        >
          Control Centre · v1.0
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col h-screen sticky top-0 shrink-0 transition-all duration-200"
        style={{ width: collapsed ? 64 : 240 }}
      >
        {content}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40 md:hidden"
            onClick={onMobileClose}
          />
          <aside
            className="fixed left-0 top-0 h-full z-50 md:hidden flex flex-col"
            style={{ width: 240 }}
          >
            {content}
          </aside>
        </>
      )}
    </>
  );
}
