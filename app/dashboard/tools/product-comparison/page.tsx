"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  GitCompare,
  Loader2,
  X,
  RefreshCw,
  CheckSquare,
  Square,
  CheckCircle2,
  XCircle,
  Clock,
  Wifi,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface CompetitionBrand {
  id: number;
  company_name: string;
  shop_url: string;
  created_at: string;
  updated_at: string;
  products_count: number;
  last_synced: string | null;
}

type BrandScrapeStatus =
  | { state: "idle" }
  | { state: "pending" }
  | { state: "fetching"; page: number; total: number }
  | { state: "processing"; count: number }
  | { state: "done"; count: number }
  | { state: "error"; message: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normaliseUrl(url: string) {
  return url.startsWith("http") ? url : "https://" + url;
}

// ── Brand Modal (Add / Edit) ─────────────────────────────────────────────────

interface BrandModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { company_name: string; shop_url: string }) => Promise<void>;
  initial?: CompetitionBrand | null;
}

function BrandModal({ open, onClose, onSave, initial }: BrandModalProps) {
  const [companyName, setCompanyName] = useState("");
  const [shopUrl, setShopUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const mode = initial ? "edit" : "add";

  useEffect(() => {
    if (open) {
      setCompanyName(initial?.company_name ?? "");
      setShopUrl(initial?.shop_url ?? "");
      setError("");
    }
  }, [open, initial]);

  const handleSave = async () => {
    if (!companyName.trim()) { setError("Company name is required."); return; }
    if (!shopUrl.trim()) { setError("Shop URL is required."); return; }
    setSaving(true);
    try {
      await onSave({ company_name: companyName.trim(), shop_url: shopUrl.trim() });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const inputClass = "w-full text-sm rounded-xl px-3 py-2.5 outline-none placeholder:text-[#c0b8b8]";
  const inputStyle = { border: "1px solid #E2E2E2", color: "#525252", backgroundColor: "#ffffff" };
  const labelClass = "block text-xs font-medium mb-1.5";
  const labelStyle = { color: "#525252" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: "#ffffff", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0" style={{ borderBottom: "1px solid #f0eae6" }}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl" style={{ backgroundColor: "#f9e8eb" }}>
              <GitCompare size={14} style={{ color: "#d57282" }} />
            </div>
            <h3 className="text-sm font-semibold" style={{ color: "#525252" }}>
              {mode === "add" ? "Add Competitor Brand" : "Edit Brand"}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#f5f0ed]">
            <X size={16} style={{ color: "#8a8a8a" }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={labelClass} style={labelStyle}>Company Name <span style={{ color: "#e05252" }}>*</span></label>
            <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. The Sleep Company" className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Shop URL <span style={{ color: "#e05252" }}>*</span></label>
            <input type="text" value={shopUrl} onChange={(e) => setShopUrl(e.target.value)} placeholder="e.g. https://thesleepcompany.in" className={inputClass} style={inputStyle} />
          </div>
          {error && <p className="text-xs" style={{ color: "#e05252" }}>{error}</p>}
        </div>

        <div className="flex gap-2 px-6 py-4 shrink-0" style={{ borderTop: "1px solid #f0eae6" }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ border: "1px solid #E2E2E2", color: "#525252", backgroundColor: "#ffffff" }}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={saving ? { backgroundColor: "#f0e8ea", color: "#c0a0a8", cursor: "not-allowed" } : { backgroundColor: "#d57282", color: "#ffffff", boxShadow: "0 4px 14px rgba(213,114,130,0.28)" }}
          >
            {saving ? "Saving…" : mode === "add" ? "Add Brand" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Scrape Progress Modal ─────────────────────────────────────────────────────

interface ScrapeProgressModalProps {
  open: boolean;
  brands: CompetitionBrand[];
  statuses: Record<number, BrandScrapeStatus>;
  onClose: () => void;
}

function statusLabel(s: BrandScrapeStatus): string {
  switch (s.state) {
    case "idle":       return "Waiting…";
    case "pending":    return "Starting…";
    case "fetching":   return `Fetching page ${s.page} · ${s.total} products so far`;
    case "processing": return `Processing ${s.count} variants…`;
    case "done":       return `Done · ${s.count} variants saved`;
    case "error":      return `Error: ${s.message}`;
  }
}

function StatusIcon({ s }: { s: BrandScrapeStatus }) {
  if (s.state === "done")  return <CheckCircle2 size={16} style={{ color: "#4caf7d" }} />;
  if (s.state === "error") return <XCircle size={16} style={{ color: "#e05252" }} />;
  if (s.state === "idle")  return <Clock size={16} style={{ color: "#c0b8b8" }} />;
  return <Loader2 size={16} className="animate-spin" style={{ color: "#d57282" }} />;
}

function ScrapeProgressModal({ open, brands, statuses, onClose }: ScrapeProgressModalProps) {
  const allSettled = brands.every((b) => {
    const s = statuses[b.id];
    return s?.state === "done" || s?.state === "error";
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: "#ffffff", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0" style={{ borderBottom: "1px solid #f0eae6" }}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl" style={{ backgroundColor: "#f9e8eb" }}>
              <Wifi size={14} style={{ color: "#d57282" }} />
            </div>
            <h3 className="text-sm font-semibold" style={{ color: "#525252" }}>Scraping Product Data</h3>
          </div>
          {!allSettled && (
            <p className="text-xs" style={{ color: "#8a8a8a" }}>Running in parallel…</p>
          )}
        </div>

        {/* Brand rows */}
        <div className="px-6 py-4 space-y-3 max-h-96 overflow-y-auto">
          {brands.map((brand) => {
            const s = statuses[brand.id] ?? { state: "pending" };
            return (
              <div
                key={brand.id}
                className="flex items-start gap-3 rounded-xl px-4 py-3"
                style={{ backgroundColor: "#faf7f5", border: "1px solid #f0eae6" }}
              >
                <div className="mt-0.5 shrink-0">
                  <StatusIcon s={s} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "#525252" }}>{brand.company_name}</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: s.state === "error" ? "#e05252" : s.state === "done" ? "#4caf7d" : "#8a8a8a" }}>
                    {statusLabel(s)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 shrink-0" style={{ borderTop: "1px solid #f0eae6" }}>
          <button
            onClick={onClose}
            disabled={!allSettled}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={
              allSettled
                ? { backgroundColor: "#d57282", color: "#ffffff", boxShadow: "0 4px 14px rgba(213,114,130,0.28)" }
                : { backgroundColor: "#f5f0ed", color: "#c0b8b8", cursor: "not-allowed" }
            }
          >
            {allSettled ? "Done" : "Scraping…"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirm row ────────────────────────────────────────────────────────

function DeleteConfirmRow({
  brand,
  onConfirm,
  onCancel,
}: {
  brand: CompetitionBrand;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  return (
    <tr style={{ backgroundColor: "#fff8f8" }}>
      <td colSpan={6} className="px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm" style={{ color: "#525252" }}>
            Delete <span className="font-semibold">{brand.company_name}</span>? This cannot be undone.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ border: "1px solid #E2E2E2", color: "#525252", backgroundColor: "#ffffff" }}>Cancel</button>
            <button
              onClick={async () => { setDeleting(true); await onConfirm(); setDeleting(false); }}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ backgroundColor: "#e05252", opacity: deleting ? 0.6 : 1 }}
            >
              {deleting && <Loader2 size={11} className="animate-spin" />}
              Delete
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CompetitionBrandsPage() {
  const [brands, setBrands] = useState<CompetitionBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CompetitionBrand | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompetitionBrand | null>(null);

  // Scrape progress state
  const [scrapeOpen, setScrapeOpen] = useState(false);
  const [scrapeTargets, setScrapeTargets] = useState<CompetitionBrand[]>([]);
  const [scrapeStatuses, setScrapeStatuses] = useState<Record<number, BrandScrapeStatus>>({});
  const abortRef = useRef<AbortController | null>(null);

  const fetchBrands = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/competition-brands");
      const json = await res.json();
      setBrands(json.brands ?? []);
    } catch {
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBrands(); }, [fetchBrands]);

  // ── Selection ──────────────────────────────────────────────────────────────

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === brands.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(brands.map((b) => b.id)));
    }
  };

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const handleAdd = async (data: { company_name: string; shop_url: string }) => {
    const res = await fetch("/api/competition-brands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to add brand");
    await fetchBrands();
  };

  const handleEdit = async (data: { company_name: string; shop_url: string }) => {
    if (!editTarget) return;
    const res = await fetch(`/api/competition-brands/${editTarget.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to update brand");
    await fetchBrands();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await fetch(`/api/competition-brands/${deleteTarget.id}`, { method: "DELETE" });
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(deleteTarget.id); return next; });
    setDeleteTarget(null);
    await fetchBrands();
  };

  const openAdd = () => { setEditTarget(null); setModalOpen(true); };
  const openEdit = (brand: CompetitionBrand) => { setEditTarget(brand); setModalOpen(true); };

  // ── Scrape ──────────────────────────────────────────────────────────────────

  const handleScrape = async () => {
    const targets = brands.filter((b) => selectedIds.has(b.id));
    if (!targets.length) return;

    const initialStatuses: Record<number, BrandScrapeStatus> = {};
    targets.forEach((b) => { initialStatuses[b.id] = { state: "pending" }; });

    setScrapeTargets(targets);
    setScrapeStatuses(initialStatuses);
    setScrapeOpen(true);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/competition-brands/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandIds: targets.map((b) => b.id) }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) throw new Error("Scrape request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as {
              type: string;
              brandId?: number;
              page?: number;
              total?: number;
              count?: number;
              message?: string;
            };

            if (event.type === "complete") {
              await fetchBrands();
              break;
            }

            if (!event.brandId) continue;
            const id = event.brandId;

            setScrapeStatuses((prev) => {
              const next = { ...prev };
              if (event.type === "start")      next[id] = { state: "pending" };
              if (event.type === "page")       next[id] = { state: "fetching", page: event.page!, total: event.total! };
              if (event.type === "processing") next[id] = { state: "processing", count: event.count! };
              if (event.type === "done")       next[id] = { state: "done", count: event.count! };
              if (event.type === "error")      next[id] = { state: "error", message: event.message! };
              return next;
            });
          } catch {
            // malformed event — skip
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        // Mark all pending brands as errored
        setScrapeStatuses((prev) => {
          const next = { ...prev };
          targets.forEach((b) => {
            if (next[b.id]?.state !== "done") {
              next[b.id] = { state: "error", message: "Connection lost" };
            }
          });
          return next;
        });
      }
    }
  };

  const handleScrapeClose = () => {
    setScrapeOpen(false);
    setSelectedIds(new Set());
    setScrapeTargets([]);
    setScrapeStatuses({});
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const allSelected = brands.length > 0 && selectedIds.size === brands.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "#525252", fontFamily: "var(--font-poppins), sans-serif" }}>
            Competition Brands
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#8a8a8a" }}>
            {loading ? "Loading…" : `${brands.length} brand${brands.length !== 1 ? "s" : ""} tracked`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Scrape button — shown only when brands are selected */}
          {selectedIds.size > 0 && (
            <button
              onClick={handleScrape}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all"
              style={{
                borderRadius: 22,
                border: "1px solid #d57282",
                color: "#d57282",
                backgroundColor: "#ffffff",
              }}
            >
              <RefreshCw size={14} />
              Scrape Product Data
              <span
                className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: "#f9e8eb", color: "#d57282" }}
              >
                {selectedIds.size}
              </span>
            </button>
          )}

          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-all"
            style={{
              borderRadius: 22,
              backgroundColor: "#d57282",
              color: "#ffffff",
              boxShadow: "0 4px 14px rgba(213,114,130,0.28)",
            }}
          >
            <Plus size={14} />
            Add URL
          </button>
        </div>
      </div>

      {/* Table card */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 16px rgba(213,114,130,0.07)", border: "1px solid #E2E2E2" }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={22} className="animate-spin" style={{ color: "#d57282" }} />
          </div>
        ) : brands.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#f9e8eb" }}>
              <GitCompare size={20} style={{ color: "#d57282" }} />
            </div>
            <p className="text-sm font-medium" style={{ color: "#525252" }}>No competitor brands yet</p>
            <p className="text-xs" style={{ color: "#8a8a8a" }}>Click &ldquo;Add URL&rdquo; to start tracking a competitor</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <div style={{ minWidth: "700px" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid #f0eae6" }}>
                {/* Select-all checkbox */}
                <th className="px-4 py-3 w-10">
                  <button onClick={toggleAll} className="flex items-center justify-center" style={{ color: allSelected ? "#d57282" : someSelected ? "#d57282" : "#c0b8b8" }}>
                    {allSelected ? <CheckSquare size={16} /> : someSelected ? <CheckSquare size={16} style={{ opacity: 0.5 }} /> : <Square size={16} />}
                  </button>
                </th>
                {["Company", "Shop URL", "Products", "Last Synced", "Added", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "#8a8a8a" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {brands.map((brand) =>
                deleteTarget?.id === brand.id ? (
                  <DeleteConfirmRow key={brand.id} brand={brand} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
                ) : (
                  <tr
                    key={brand.id}
                    style={{ borderBottom: "1px solid #f5f5f5", backgroundColor: selectedIds.has(brand.id) ? "#fffbf6" : "" }}
                    onMouseEnter={(e) => { if (!selectedIds.has(brand.id)) (e.currentTarget as HTMLElement).style.backgroundColor = "#fffbf6"; }}
                    onMouseLeave={(e) => { if (!selectedIds.has(brand.id)) (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3.5">
                      <button onClick={() => toggleSelect(brand.id)} className="flex items-center justify-center" style={{ color: selectedIds.has(brand.id) ? "#d57282" : "#c0b8b8" }}>
                        {selectedIds.has(brand.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 font-medium" style={{ color: "#525252" }}>{brand.company_name}</td>
                    <td className="px-4 py-3.5">
                      <a
                        href={normaliseUrl(brand.shop_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 w-fit"
                        style={{ color: "#d57282" }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = "underline")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = "")}
                      >
                        <span className="max-w-[200px] truncate">{brand.shop_url}</span>
                        <ExternalLink size={12} className="shrink-0" />
                      </a>
                    </td>
                    <td className="px-4 py-3.5">
                      {brand.products_count > 0 ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#f9e8eb", color: "#d57282" }}>
                          {brand.products_count.toLocaleString()}
                        </span>
                      ) : (
                        <span style={{ color: "#c0b8b8" }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs" style={{ color: "#8a8a8a" }}>
                      {brand.last_synced ? formatDateTime(brand.last_synced) : <span style={{ color: "#c0b8b8" }}>Never</span>}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap" style={{ color: "#8a8a8a" }}>
                      {formatDate(brand.created_at)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(brand)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f5f0ed] transition-colors" style={{ color: "#8a8a8a" }} title="Edit">
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(brand)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                          style={{ color: "#8a8a8a" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#fff0f0"; (e.currentTarget as HTMLElement).style.color = "#e05252"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ""; (e.currentTarget as HTMLElement).style.color = "#8a8a8a"; }}
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
          </div>
          </div>
        )}
      </div>

      <BrandModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={editTarget ? handleEdit : handleAdd} initial={editTarget} />

      <ScrapeProgressModal
        open={scrapeOpen}
        brands={scrapeTargets}
        statuses={scrapeStatuses}
        onClose={handleScrapeClose}
      />
    </div>
  );
}
