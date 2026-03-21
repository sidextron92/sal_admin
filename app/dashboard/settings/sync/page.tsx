"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ShoppingBag,
  CalendarClock,
  Loader2,
  Truck,
  Package,
} from "lucide-react";

interface SyncLog {
  id: number;
  synced_at: string;
  orders_upserted: number;
  items_upserted: number;
  status: "success" | "error";
  error_message: string | null;
  duration_ms: number;
  platform: string | null;
  type: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

const TABS = ["Data Sync", "Scheduled Jobs"] as const;
type Tab = (typeof TABS)[number];

export default function SyncPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Data Sync");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    orders?: number;
    items?: number;
    error?: string;
  } | null>(null);

  // Products sync state
  const [prodSyncing, setProdSyncing] = useState(false);
  const [prodSyncResult, setProdSyncResult] = useState<{
    success: boolean;
    products?: number;
    variants?: number;
    error?: string;
  } | null>(null);

  // Shiprocket sync state
  const [srSyncing, setSrSyncing] = useState(false);
  const [srSyncResult, setSrSyncResult] = useState<{
    success: boolean;
    fetched?: number;
    updated?: number;
    error?: string;
  } | null>(null);

  const [allLogs, setAllLogs] = useState<SyncLog[]>([]);
  const [lastShopifySync, setLastShopifySync] = useState<SyncLog | null>(null);
  const [lastSrSync, setLastSrSync] = useState<SyncLog | null>(null);
  const [lastProdSync, setLastProdSync] = useState<SyncLog | null>(null);

  const fetchLogs = useCallback(async () => {
    const [shopifyRes, srRes, prodRes, allRes] = await Promise.all([
      fetch("/api/sync/shopify?platform=shopify&type=orders"),
      fetch("/api/sync/shopify?platform=shiprocket&type=orders"),
      fetch("/api/sync/shopify?platform=shopify&type=inventory"),
      fetch("/api/sync/shopify"),
    ]);
    const [shopifyData, srData, prodData, allData] = await Promise.all([
      shopifyRes.json(),
      srRes.json(),
      prodRes.json(),
      allRes.json(),
    ]);
    if (shopifyData.logs) setLastShopifySync(shopifyData.logs[0] ?? null);
    if (srData.logs)      setLastSrSync(srData.logs[0] ?? null);
    if (prodData.logs)    setLastProdSync(prodData.logs[0] ?? null);
    if (allData.logs)     setAllLogs(allData.logs);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync/shopify", { method: "POST" });
      const data = await res.json();
      setSyncResult(data);
      await fetchLogs();
    } catch {
      setSyncResult({ success: false, error: "Network error" });
    } finally {
      setSyncing(false);
    }
  };

  const handleProdSync = async () => {
    setProdSyncing(true);
    setProdSyncResult(null);
    try {
      const res = await fetch("/api/sync/products", { method: "POST" });
      const data = await res.json();
      setProdSyncResult(data);
      await fetchLogs();
    } catch {
      setProdSyncResult({ success: false, error: "Network error" });
    } finally {
      setProdSyncing(false);
    }
  };

  const handleSrSync = async () => {
    setSrSyncing(true);
    setSrSyncResult(null);
    try {
      const res = await fetch("/api/sync/shiprocket", { method: "POST" });
      const data = await res.json();
      setSrSyncResult(data);
      await fetchLogs();
    } catch {
      setSrSyncResult({ success: false, error: "Network error" });
    } finally {
      setSrSyncing(false);
    }
  };

  const lastSync = lastShopifySync;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1
          className="text-xl font-semibold"
          style={{ color: "#525252", fontFamily: "var(--font-poppins), sans-serif" }}
        >
          Sync
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "#8a8a8a" }}>
          Manage integrations, sync jobs, and platform configuration.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: "#f0eae6" }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-150"
            style={
              activeTab === tab
                ? {
                    backgroundColor: "#ffffff",
                    color: "#d57282",
                    boxShadow: "0 1px 4px rgba(213,114,130,0.12)",
                  }
                : { color: "#8a8a8a" }
            }
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── DATA SYNC TAB ── */}
      {activeTab === "Data Sync" && (
        <div className="space-y-4">
          {/* Shopify Orders sync card */}
          <div
            className="rounded-2xl p-5"
            style={{
              backgroundColor: "#ffffff",
              boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
              border: "1px solid #E2E2E2",
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "#f9e8eb" }}
                >
                  <ShoppingBag size={18} style={{ color: "#d57282" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#525252" }}>
                    Shopify Orders
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#8a8a8a" }}>
                    Orders + line items · Latest 250
                  </p>
                </div>
              </div>

              {lastSync && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0"
                  style={
                    lastSync.status === "success"
                      ? { backgroundColor: "#f0faf4", color: "#27a559" }
                      : { backgroundColor: "#fff0f0", color: "#e05252" }
                  }
                >
                  {lastSync.status === "success" ? (
                    <CheckCircle2 size={12} />
                  ) : (
                    <XCircle size={12} />
                  )}
                  {lastSync.status === "success" ? "Synced" : "Failed"}
                </div>
              )}
            </div>

            {lastSync && (
              <div
                className="flex gap-4 mt-4 pt-4 text-xs"
                style={{ borderTop: "1px solid #f0eae6", color: "#8a8a8a" }}
              >
                <div className="flex items-center gap-1.5">
                  <Clock size={12} />
                  <span>Last sync: {formatDate(lastSync.synced_at)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShoppingBag size={12} />
                  <span>{lastSync.orders_upserted} orders · {lastSync.items_upserted} items</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <RefreshCw size={12} />
                  <span>{formatDuration(lastSync.duration_ms)}</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-150 disabled:opacity-60"
                style={{
                  backgroundColor: "#d57282",
                  color: "#ffffff",
                  boxShadow: "0 4px 14px rgba(213,114,130,0.28)",
                }}
              >
                {syncing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                {syncing ? "Syncing…" : "Sync Now"}
              </button>

              {syncResult && !syncing && (
                <span
                  className="text-xs font-medium flex items-center gap-1.5"
                  style={{ color: syncResult.success ? "#27a559" : "#e05252" }}
                >
                  {syncResult.success ? (
                    <>
                      <CheckCircle2 size={13} />
                      {syncResult.orders} orders · {syncResult.items} items synced
                    </>
                  ) : (
                    <>
                      <XCircle size={13} />
                      {syncResult.error}
                    </>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Shiprocket sync card */}
          <div
            className="rounded-2xl p-5"
            style={{
              backgroundColor: "#ffffff",
              boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
              border: "1px solid #E2E2E2",
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "#f9e8eb" }}
                >
                  <Truck size={18} style={{ color: "#d57282" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#525252" }}>
                    Shiprocket
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#8a8a8a" }}>
                    Customer details · AWB · Shipment status
                  </p>
                </div>
              </div>
              {lastSrSync && !srSyncResult && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0"
                  style={
                    lastSrSync.status === "success"
                      ? { backgroundColor: "#f0faf4", color: "#27a559" }
                      : { backgroundColor: "#fff0f0", color: "#e05252" }
                  }
                >
                  {lastSrSync.status === "success" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  {lastSrSync.status === "success" ? "Synced" : "Failed"}
                </div>
              )}
              {srSyncResult && !srSyncing && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0"
                  style={
                    srSyncResult.success
                      ? { backgroundColor: "#f0faf4", color: "#27a559" }
                      : { backgroundColor: "#fff0f0", color: "#e05252" }
                  }
                >
                  {srSyncResult.success ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  {srSyncResult.success ? "Synced" : "Failed"}
                </div>
              )}
            </div>

            {lastSrSync && (
              <div
                className="flex gap-4 mt-4 pt-4 text-xs"
                style={{ borderTop: "1px solid #f0eae6", color: "#8a8a8a" }}
              >
                <div className="flex items-center gap-1.5">
                  <Clock size={12} />
                  <span>Last sync: {formatDate(lastSrSync.synced_at)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Truck size={12} />
                  <span>{lastSrSync.orders_upserted} orders updated</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <RefreshCw size={12} />
                  <span>{formatDuration(lastSrSync.duration_ms)}</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleSrSync}
                disabled={srSyncing}
                className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-150 disabled:opacity-60"
                style={{
                  backgroundColor: "#d57282",
                  color: "#ffffff",
                  boxShadow: "0 4px 14px rgba(213,114,130,0.28)",
                }}
              >
                {srSyncing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                {srSyncing ? "Syncing…" : "Sync Now"}
              </button>

              {srSyncResult && !srSyncing && (
                <span
                  className="text-xs font-medium flex items-center gap-1.5"
                  style={{ color: srSyncResult.success ? "#27a559" : "#e05252" }}
                >
                  {srSyncResult.success ? (
                    <>
                      <CheckCircle2 size={13} />
                      {srSyncResult.updated} orders updated
                    </>
                  ) : (
                    <>
                      <XCircle size={13} />
                      {srSyncResult.error}
                    </>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Products sync card */}
          <div
            className="rounded-2xl p-5"
            style={{
              backgroundColor: "#ffffff",
              boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
              border: "1px solid #E2E2E2",
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "#f9e8eb" }}
                >
                  <Package size={18} style={{ color: "#d57282" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#525252" }}>
                    Products &amp; Inventory
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#8a8a8a" }}>
                    Full catalog · Variants · Stock levels
                  </p>
                </div>
              </div>
              {lastProdSync && !prodSyncResult && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0"
                  style={
                    lastProdSync.status === "success"
                      ? { backgroundColor: "#f0faf4", color: "#27a559" }
                      : { backgroundColor: "#fff0f0", color: "#e05252" }
                  }
                >
                  {lastProdSync.status === "success" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  {lastProdSync.status === "success" ? "Synced" : "Failed"}
                </div>
              )}
              {prodSyncResult && !prodSyncing && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0"
                  style={
                    prodSyncResult.success
                      ? { backgroundColor: "#f0faf4", color: "#27a559" }
                      : { backgroundColor: "#fff0f0", color: "#e05252" }
                  }
                >
                  {prodSyncResult.success ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                  {prodSyncResult.success ? "Synced" : "Failed"}
                </div>
              )}
            </div>

            {lastProdSync && (
              <div
                className="flex gap-4 mt-4 pt-4 text-xs"
                style={{ borderTop: "1px solid #f0eae6", color: "#8a8a8a" }}
              >
                <div className="flex items-center gap-1.5">
                  <Clock size={12} />
                  <span>Last sync: {formatDate(lastProdSync.synced_at)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Package size={12} />
                  <span>{lastProdSync.orders_upserted} products · {lastProdSync.items_upserted} variants</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <RefreshCw size={12} />
                  <span>{formatDuration(lastProdSync.duration_ms)}</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleProdSync}
                disabled={prodSyncing}
                className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-150 disabled:opacity-60"
                style={{
                  backgroundColor: "#d57282",
                  color: "#ffffff",
                  boxShadow: "0 4px 14px rgba(213,114,130,0.28)",
                }}
              >
                {prodSyncing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                {prodSyncing ? "Syncing…" : "Sync Now"}
              </button>

              {prodSyncResult && !prodSyncing && (
                <span
                  className="text-xs font-medium flex items-center gap-1.5"
                  style={{ color: prodSyncResult.success ? "#27a559" : "#e05252" }}
                >
                  {prodSyncResult.success ? (
                    <>
                      <CheckCircle2 size={13} />
                      {prodSyncResult.products} products · {prodSyncResult.variants} variants synced
                    </>
                  ) : (
                    <>
                      <XCircle size={13} />
                      {prodSyncResult.error}
                    </>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Sync history */}
          {allLogs.length > 0 && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                backgroundColor: "#ffffff",
                boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
                border: "1px solid #E2E2E2",
              }}
            >
              <div
                className="px-5 py-3.5"
                style={{ borderBottom: "1px solid #f0eae6" }}
              >
                <p className="text-sm font-semibold" style={{ color: "#525252" }}>
                  Sync History
                </p>
              </div>
              <div
                className="grid text-xs font-semibold uppercase tracking-wide px-5 py-2"
                style={{
                  gridTemplateColumns: "100px 90px 1fr 80px 60px",
                  borderBottom: "1px solid #f0eae6",
                  color: "#8a8a8a",
                }}
              >
                <span>Platform</span>
                <span>Type</span>
                <span>Time</span>
                <span>Records</span>
                <span>Duration</span>
              </div>
              <div className="divide-y" style={{ borderColor: "#f0eae6" }}>
                {allLogs.map((log) => (
                  <div
                    key={log.id}
                    className="grid items-center px-5 py-3 text-xs"
                    style={{
                      gridTemplateColumns: "100px 90px 1fr 80px 60px",
                      color: "#525252",
                    }}
                  >
                    <span>
                      <span
                        className="px-2 py-0.5 rounded-full font-medium"
                        style={
                          log.platform === "shopify"
                            ? { backgroundColor: "#f0faf4", color: "#27a559" }
                            : { backgroundColor: "#f9e8eb", color: "#d57282" }
                        }
                      >
                        {log.platform ?? "—"}
                      </span>
                    </span>
                    <span style={{ color: "#8a8a8a" }}>{log.type ?? "—"}</span>
                    <div className="flex items-center gap-1.5">
                      {log.status === "success" ? (
                        <CheckCircle2 size={12} style={{ color: "#27a559" }} />
                      ) : (
                        <XCircle size={12} style={{ color: "#e05252" }} />
                      )}
                      <span style={{ color: "#8a8a8a" }}>{formatDate(log.synced_at)}</span>
                      {log.status === "error" && log.error_message && (
                        <span style={{ color: "#e05252" }}>· {log.error_message}</span>
                      )}
                    </div>
                    <span style={{ color: "#8a8a8a" }}>
                      {log.status === "success"
                        ? log.type === "orders"
                          ? `${log.orders_upserted ?? 0}`
                          : `${log.orders_upserted ?? 0} / ${log.items_upserted ?? 0}`
                        : "—"}
                    </span>
                    <span className="font-medium tabular-nums" style={{ color: "#b8a0a0" }}>
                      {formatDuration(log.duration_ms)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SCHEDULED JOBS TAB ── */}
      {activeTab === "Scheduled Jobs" && (
        <div className="space-y-4">
          {/* Info banner */}
          <div
            className="rounded-2xl px-5 py-4 flex items-start gap-3"
            style={{ backgroundColor: "#f9e8eb", border: "1px solid #f0d0d6" }}
          >
            <CalendarClock size={16} style={{ color: "#d57282", marginTop: 1, flexShrink: 0 }} />
            <div>
              <p className="text-xs font-semibold" style={{ color: "#d57282" }}>
                Powered by GitHub Actions
              </p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "#b86070" }}>
                Syncs run automatically via the workflow at{" "}
                <code className="font-mono bg-white/60 px-1 rounded">.github/workflows/sync.yml</code>.
                Add <code className="font-mono bg-white/60 px-1 rounded">APP_URL</code> and{" "}
                <code className="font-mono bg-white/60 px-1 rounded">CRON_SECRET</code> to your repo
                secrets to activate.
              </p>
            </div>
          </div>

          {/* Job cards */}
          {[
            {
              icon: <ShoppingBag size={18} style={{ color: "#d57282" }} />,
              name: "Shopify Orders",
              description: "Orders + line items · Latest 250",
              endpoint: "/api/cron/sync?type=shopify-orders",
            },
            {
              icon: <Package size={18} style={{ color: "#d57282" }} />,
              name: "Shopify Products",
              description: "Full catalog · Variants · Stock levels",
              endpoint: "/api/cron/sync?type=shopify-products",
            },
            {
              icon: <Truck size={18} style={{ color: "#d57282" }} />,
              name: "Shiprocket",
              description: "Customer details · AWB · Shipment status",
              endpoint: "/api/cron/sync?type=shiprocket",
            },
          ].map((job) => (
            <div
              key={job.name}
              className="rounded-2xl p-5"
              style={{
                backgroundColor: "#ffffff",
                boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
                border: "1px solid #E2E2E2",
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "#f9e8eb" }}
                >
                  {job.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#525252" }}>
                    {job.name}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#8a8a8a" }}>
                    {job.description}
                  </p>
                </div>
                <div
                  className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0"
                  style={{ backgroundColor: "#f0faf4", color: "#27a559" }}
                >
                  <CheckCircle2 size={11} />
                  Active
                </div>
              </div>

              <div
                className="rounded-xl p-4 space-y-3"
                style={{ backgroundColor: "#faf7f5", border: "1px solid #f0eae6" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium" style={{ color: "#8a8a8a" }}>
                    Peak hours
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "#f9e8eb", color: "#d57282" }}
                    >
                      Every 2 hours
                    </span>
                    <span className="text-xs" style={{ color: "#525252" }}>
                      9 AM – 7 PM IST
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium" style={{ color: "#8a8a8a" }}>
                    Off-peak hours
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "#f0eae6", color: "#8a8a8a" }}
                    >
                      Every 4 hours
                    </span>
                    <span className="text-xs" style={{ color: "#525252" }}>
                      7 PM – 9 AM IST
                    </span>
                  </div>
                </div>
                <div
                  className="pt-3 flex items-center justify-between"
                  style={{ borderTop: "1px solid #f0eae6" }}
                >
                  <span className="text-xs font-medium" style={{ color: "#8a8a8a" }}>
                    Runs per day
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "#525252" }}>
                    9 times · at :30 past 9, 11 AM · 1, 3, 5, 7 PM · 11 PM · 3, 7 AM IST
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium" style={{ color: "#8a8a8a" }}>
                    Endpoint
                  </span>
                  <code
                    className="text-xs font-mono px-2 py-0.5 rounded"
                    style={{ backgroundColor: "#ffffff", color: "#525252", border: "1px solid #E2E2E2" }}
                  >
                    POST {job.endpoint}
                  </code>
                </div>
              </div>
            </div>
          ))}

          {/* Setup checklist */}
          <div
            className="rounded-2xl p-5"
            style={{
              backgroundColor: "#ffffff",
              boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
              border: "1px solid #E2E2E2",
            }}
          >
            <p className="text-sm font-semibold mb-3" style={{ color: "#525252" }}>
              Setup Checklist
            </p>
            <div className="space-y-2.5">
              {[
                {
                  step: "Add CRON_SECRET to Vercel env vars",
                  detail: "Any random string — used to authenticate cron requests",
                },
                {
                  step: "Add APP_URL + CRON_SECRET to GitHub repo secrets",
                  detail: "Repo → Settings → Secrets and variables → Actions",
                },
                {
                  step: "Push .github/workflows/sync.yml to main branch",
                  detail: "GitHub Actions picks it up automatically",
                },
                {
                  step: "Verify first run",
                  detail: "Repo → Actions → Scheduled Sync — or trigger manually via workflow_dispatch",
                },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-semibold"
                    style={{ backgroundColor: "#f9e8eb", color: "#d57282" }}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: "#525252" }}>
                      {item.step}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "#8a8a8a" }}>
                      {item.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
