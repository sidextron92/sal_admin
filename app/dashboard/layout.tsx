"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard/overview": "Overview",
  "/dashboard/orders": "My Orders",
  "/dashboard/shipping": "Shipping",
  "/dashboard/inventory": "Inventory",
  "/dashboard/ads": "Ads",
  "/dashboard/reconciliation": "Reconciliation",
  "/dashboard/settings": "Settings",
  "/dashboard/settings/": "Settings",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const title = PAGE_TITLES[pathname] ?? "Control Centre";

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#fffbf6" }}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          title={title}
          onMobileMenuOpen={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
