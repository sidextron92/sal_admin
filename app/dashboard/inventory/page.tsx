"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Package,
  X,
  AlertTriangle,
  Pencil,
  Check,
  Boxes,
  Download,
  Upload,
  ChevronDown as ChevronDownIcon,
  CheckCircle2,
  XCircle,
  SkipForward,
  MoreHorizontal,
  ClipboardList,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface ProductInfo {
  product_id: string;
  title: string;
  image_url: string;
  vendor: string;
  product_type: string;
  status: string;
}

interface VariantRow {
  variant_id: string;
  title: string;
  price: number;
  sku: string;
  inventory_quantity: number;
  cost: number;
  virtual_inventory: number;
  physical_inventory: number;
  inventory_remark: string | null;
  products: ProductInfo;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

function StockBadge({ qty }: { qty: number }) {
  if (qty <= 0)
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#fff0f0", color: "#e05252" }}>
        Out of stock
      </span>
    );
  if (qty < 5)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#fff3e8", color: "#d4600a" }}>
        <AlertTriangle size={10} />
        Low · {qty}
      </span>
    );
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "#f0faf4", color: "#27a559" }}>
      {qty} in stock
    </span>
  );
}

// ── Bulk Operation ─────────────────────────────────────────────────────────

interface UploadSummary {
  total_rows:        number;
  updated_rows:      number;
  updated_cost:      number;
  updated_inventory: number;
  skipped:           number;
  errors:            number;
}

interface UploadResult {
  row:               number;
  variantId:         string;
  status:            'updated' | 'skipped' | 'error';
  reason?:           string;
  costUpdated?:      boolean;
  inventoryUpdated?: boolean;
}

function UploadResultModal({
  summary,
  results,
  onClose,
}: {
  summary: UploadSummary;
  results: UploadResult[];
  onClose: () => void;
}) {
  const errorRows = results.filter((r) => r.status === 'error');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ backgroundColor: "#ffffff", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: "1px solid #f0eae6" }}>
          <h3 className="text-sm font-semibold" style={{ color: "#525252" }}>Upload Complete</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#f5f0ed]">
            <X size={16} style={{ color: "#8a8a8a" }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ backgroundColor: "#f0faf4" }}>
              <CheckCircle2 size={18} style={{ color: "#27a559" }} />
              <div>
                <p className="text-lg font-bold" style={{ color: "#27a559" }}>
                  {summary.updated_rows}
                </p>
                <p className="text-xs" style={{ color: "#27a559" }}>Rows updated</p>
              </div>
            </div>
            <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ backgroundColor: "#fff0f0" }}>
              <XCircle size={18} style={{ color: "#e05252" }} />
              <div>
                <p className="text-lg font-bold" style={{ color: "#e05252" }}>{summary.errors}</p>
                <p className="text-xs" style={{ color: "#e05252" }}>Errors</p>
              </div>
            </div>
            <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ backgroundColor: "#faf7f5" }}>
              <SkipForward size={18} style={{ color: "#8a8a8a" }} />
              <div>
                <p className="text-lg font-bold" style={{ color: "#525252" }}>{summary.skipped}</p>
                <p className="text-xs" style={{ color: "#8a8a8a" }}>Skipped (no changes)</p>
              </div>
            </div>
            <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ backgroundColor: "#faf7f5" }}>
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: "#8a8a8a" }}>Breakdown</p>
                <p className="text-xs" style={{ color: "#525252" }}>Cost: {summary.updated_cost} · Inventory: {summary.updated_inventory}</p>
              </div>
            </div>
          </div>

          {/* Error detail */}
          {errorRows.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: "#e05252" }}>Errors ({errorRows.length})</p>
              <div
                className="rounded-xl overflow-auto max-h-48 text-xs space-y-1 p-3"
                style={{ backgroundColor: "#fff8f8", border: "1px solid #f5d0d0" }}
              >
                {errorRows.map((r) => (
                  <div key={r.row} className="flex gap-2">
                    <span className="shrink-0 font-mono" style={{ color: "#8a8a8a" }}>Row {r.row}</span>
                    <span style={{ color: "#e05252" }}>{r.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: "#d57282", color: "#ffffff", boxShadow: "0 4px 14px rgba(213,114,130,0.28)" }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkOperationButton({ onUploaded }: { onUploaded: () => void }) {
  const [open, setOpen]                         = useState(false);
  const [downloading, setDownloading]           = useState(false);
  const [uploading, setUploading]               = useState(false);
  const [uploadResult, setUploadResult]         = useState<{ summary: UploadSummary; results: UploadResult[] } | null>(null);
  const [uploadError, setUploadError]           = useState("");
  const fileInputRef                            = useRef<HTMLInputElement>(null);
  const containerRef                            = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function handleDownload() {
    setDownloading(true);
    setOpen(false);
    try {
      const res = await fetch("/api/inventory/bulk/download");
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `maeri_inventory_bulk_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploading(true);
    setUploadError("");
    setOpen(false);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res  = await fetch("/api/inventory/bulk/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setUploadResult({ summary: data.summary, results: data.results });
      onUploaded();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={downloading || uploading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-100"
          style={{ backgroundColor: "#d57282", color: "#ffffff", boxShadow: "0 4px 14px rgba(213,114,130,0.28)", opacity: downloading || uploading ? 0.7 : 1 }}
        >
          {uploading ? "Uploading…" : downloading ? "Downloading…" : "Bulk Operation"}
          <ChevronDownIcon size={13} />
        </button>

        {open && (
          <div
            className="absolute right-0 mt-1.5 z-20 rounded-xl overflow-hidden w-44"
            style={{ backgroundColor: "#ffffff", border: "1px solid #E2E2E2", boxShadow: "0 4px 20px rgba(0,0,0,0.10)" }}
          >
            <button
              onClick={handleDownload}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm hover:bg-[#faf7f5] transition-colors"
              style={{ color: "#525252" }}
            >
              <Download size={14} style={{ color: "#d57282" }} />
              Download File
            </button>
            <div style={{ borderTop: "1px solid #f0eae6" }} />
            <button
              onClick={() => { setOpen(false); fileInputRef.current?.click(); }}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm hover:bg-[#faf7f5] transition-colors"
              style={{ color: "#525252" }}
            >
              <Upload size={14} style={{ color: "#d57282" }} />
              Upload File
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {uploadError && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm"
          style={{ backgroundColor: "#fff0f0", border: "1px solid #f5d0d0", color: "#e05252" }}
        >
          {uploadError}
        </div>
      )}

      {uploadResult && (
        <UploadResultModal
          summary={uploadResult.summary}
          results={uploadResult.results}
          onClose={() => setUploadResult(null)}
        />
      )}
    </>
  );
}

// ── Inventory Update Modal ─────────────────────────────────────────────────

interface InventoryModalProps {
  variant: VariantRow;
  onClose: () => void;
  onSaved: () => void;
}

function InventoryModal({ variant, onClose, onSaved }: InventoryModalProps) {
  const [newVirtual, setNewVirtual]   = useState(variant.virtual_inventory);
  const [newPhysical, setNewPhysical] = useState(variant.physical_inventory);
  const [remark, setRemark]           = useState("");
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");

  const newTotal  = newVirtual + newPhysical;
  const hasChange = newVirtual !== variant.virtual_inventory || newPhysical !== variant.physical_inventory;

  function clampInt(val: number) {
    return Math.max(0, Math.floor(val));
  }

  async function handleSave() {
    if (!hasChange) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/products/${variant.variant_id}/inventory`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ virtual_inventory: newVirtual, physical_inventory: newPhysical, remark }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Update failed");
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  const productTitle = variant.products.title;
  const variantLabel = variant.title !== "Default Title" ? variant.title : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ backgroundColor: "#ffffff", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4" style={{ borderBottom: "1px solid #f0eae6" }}>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "#525252" }}>Update Inventory</h3>
            <p className="text-xs mt-0.5" style={{ color: "#8a8a8a" }}>
              {productTitle}
              {variantLabel && <> · <span style={{ color: "#d57282" }}>{variantLabel}</span></>}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#f5f0ed]">
            <X size={16} style={{ color: "#8a8a8a" }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Current snapshot */}
          <div className="rounded-xl px-4 py-3 space-y-2" style={{ backgroundColor: "#faf7f5", border: "1px solid #f0eae6" }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#8a8a8a" }}>Current</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Virtual",  value: variant.virtual_inventory },
                { label: "Physical", value: variant.physical_inventory },
                { label: "Total",    value: variant.inventory_quantity },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <p className="text-lg font-semibold" style={{ color: "#525252" }}>{value}</p>
                  <p className="text-xs" style={{ color: "#8a8a8a" }}>{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Editable new values */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#8a8a8a" }}>New Values</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Virtual */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#525252" }}>Virtual</label>
                <div className="flex items-center rounded-xl overflow-hidden" style={{ border: "1px solid #E2E2E2" }}>
                  <button
                    onClick={() => setNewVirtual((v) => clampInt(v - 1))}
                    className="px-3 py-2 text-lg font-light hover:bg-[#f5f0ed] transition-colors"
                    style={{ color: "#d57282" }}
                  >−</button>
                  <input
                    type="number"
                    min={0}
                    value={newVirtual === 0 ? "" : newVirtual}
                    placeholder="0"
                    onChange={(e) => setNewVirtual(clampInt(parseInt(e.target.value, 10) || 0))}
                    className="flex-1 min-w-0 text-center text-sm font-semibold outline-none bg-transparent py-2"
                    style={{ color: "#525252" }}
                  />
                  <button
                    onClick={() => setNewVirtual((v) => v + 1)}
                    className="px-3 py-2 text-lg font-light hover:bg-[#f5f0ed] transition-colors"
                    style={{ color: "#d57282" }}
                  >+</button>
                </div>
              </div>

              {/* Physical */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#525252" }}>Physical</label>
                <div className="flex items-center rounded-xl overflow-hidden" style={{ border: "1px solid #E2E2E2" }}>
                  <button
                    onClick={() => setNewPhysical((v) => clampInt(v - 1))}
                    className="px-3 py-2 text-lg font-light hover:bg-[#f5f0ed] transition-colors"
                    style={{ color: "#d57282" }}
                  >−</button>
                  <input
                    type="number"
                    min={0}
                    value={newPhysical === 0 ? "" : newPhysical}
                    placeholder="0"
                    onChange={(e) => setNewPhysical(clampInt(parseInt(e.target.value, 10) || 0))}
                    className="flex-1 min-w-0 text-center text-sm font-semibold outline-none bg-transparent py-2"
                    style={{ color: "#525252" }}
                  />
                  <button
                    onClick={() => setNewPhysical((v) => v + 1)}
                    className="px-3 py-2 text-lg font-light hover:bg-[#f5f0ed] transition-colors"
                    style={{ color: "#d57282" }}
                  >+</button>
                </div>
              </div>
            </div>

            {/* Calculated total */}
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl" style={{ backgroundColor: "#f9e8eb" }}>
              <span className="text-xs font-medium" style={{ color: "#d57282" }}>New Total</span>
              <span className="text-sm font-bold" style={{ color: "#d57282" }}>{newTotal}</span>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#525252" }}>
              Remarks <span style={{ color: "#8a8a8a" }}>(optional)</span>
            </label>
            <textarea
              rows={2}
              maxLength={500}
              placeholder="e.g. Received new shipment, pre-added for incoming PO…"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className="w-full text-sm rounded-xl px-3 py-2.5 outline-none resize-none placeholder:text-[#c0b8b8]"
              style={{ border: "1px solid #E2E2E2", color: "#525252", backgroundColor: "#ffffff" }}
            />
            <p className="text-xs mt-1 text-right" style={{ color: "#c0b8b8" }}>{remark.length}/500</p>
          </div>

          {error && <p className="text-xs" style={{ color: "#e05252" }}>{error}</p>}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              style={{ border: "1px solid #E2E2E2", color: "#525252", backgroundColor: "#ffffff" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChange || saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={
                hasChange && !saving
                  ? { backgroundColor: "#d57282", color: "#ffffff", boxShadow: "0 4px 14px rgba(213,114,130,0.28)" }
                  : { backgroundColor: "#f0e8ea", color: "#c0a0a8", cursor: "not-allowed" }
              }
            >
              {saving ? "Saving…" : "Update"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Inline cost editor ─────────────────────────────────────────────────────

function CostCell({ variantId, initialCost, onSaved }: { variantId: string; initialCost: number; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue]     = useState(String(initialCost));
  const [saving, setSaving]   = useState(false);
  const inputRef              = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  async function save() {
    const cost = parseFloat(value);
    if (isNaN(cost) || cost < 0) { setValue(String(initialCost)); setEditing(false); return; }
    setSaving(true);
    try {
      await fetch(`/api/products/${variantId}/cost`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cost }),
      });
      onSaved();
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs" style={{ color: "#8a8a8a" }}>₹</span>
        <input
          ref={inputRef}
          type="number"
          min={0}
          step={0.01}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") { setValue(String(initialCost)); setEditing(false); }
          }}
          className="w-16 text-xs font-medium outline-none rounded px-1 py-0.5"
          style={{ border: "1px solid #d57282", color: "#525252" }}
          disabled={saving}
          autoFocus
        />
        <button onClick={save} disabled={saving}>
          <Check size={12} style={{ color: "#27a559" }} />
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => { setValue(String(initialCost)); setEditing(true); }} className="flex items-center gap-1 group">
      <span className="text-xs font-medium" style={{ color: "#525252" }}>{formatPrice(initialCost)}</span>
      <Pencil size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#d57282" }} />
    </button>
  );
}

// ── Inventory Log Modal ─────────────────────────────────────────────────────

interface InventoryLog {
  changed_at: string;
  changed_by: string;
  delta_virtual: number;
  delta_physical: number;
  delta_total: number;
  new_total: number;
  remarks: string | null;
}

function InventoryLogModal({
  variant,
  onClose,
}: {
  variant: VariantRow;
  onClose: () => void;
}) {
  const [logs, setLogs]       = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    fetch(`/api/inventory/${variant.variant_id}/logs`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setLogs(d.logs ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [variant.variant_id]);

  const productTitle = variant.products.title;
  const variantLabel = variant.title !== "Default Title" ? variant.title : null;

  function formatTs(ts: string) {
    return new Date(ts).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  }

  function changedByLabel(cb: string) {
    if (cb === "admin") return "Admin";
    if (cb === "shopify_sync") return "Shopify Sync";
    if (cb === "bulk_upload") return "Bulk Upload";
    if (cb === "order") return "Order";
    return cb;
  }

  function deltaCell(val: number) {
    const color = val > 0 ? "#27a559" : val < 0 ? "#e05252" : "#8a8a8a";
    const sign  = val > 0 ? "+" : "";
    return <span style={{ color, fontWeight: 500 }}>{sign}{val}</span>;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: "#ffffff", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", maxHeight: "85vh" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 shrink-0" style={{ borderBottom: "1px solid #f0eae6" }}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl" style={{ backgroundColor: "#f9e8eb" }}>
              <ClipboardList size={14} style={{ color: "#d57282" }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "#525252" }}>Inventory Log</h3>
              <p className="text-xs mt-0.5" style={{ color: "#8a8a8a" }}>
                {productTitle}
                {variantLabel && <> · <span style={{ color: "#d57282" }}>{variantLabel}</span></>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#f5f0ed]">
            <X size={16} style={{ color: "#8a8a8a" }} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-auto flex-1">
          {loading && (
            <div className="py-12 flex flex-col items-center gap-3" style={{ color: "#8a8a8a" }}>
              <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: "#d57282", borderTopColor: "transparent" }} />
              <p className="text-sm">Loading log…</p>
            </div>
          )}

          {!loading && error && (
            <p className="text-sm py-8 text-center" style={{ color: "#e05252" }}>{error}</p>
          )}

          {!loading && !error && logs.length === 0 && (
            <div className="py-12 flex flex-col items-center gap-2" style={{ color: "#8a8a8a" }}>
              <ClipboardList size={28} style={{ opacity: 0.3 }} />
              <p className="text-sm">No changes recorded yet</p>
            </div>
          )}

          {!loading && !error && logs.length > 0 && (
            <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#faf7f5", borderBottom: "1px solid #f0eae6" }}>
                  {["Timestamp", "Changed By", "Δ Virtual", "Δ Physical", "Δ Total", "New Total", "Remarks"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 font-semibold uppercase tracking-wide whitespace-nowrap"
                      style={{ color: "#8a8a8a", fontSize: "11px" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr
                    key={i}
                    className="hover:bg-[#fffbf6] transition-colors"
                    style={{ borderBottom: "1px solid #f0eae6" }}
                  >
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#525252" }}>
                      {formatTs(log.changed_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: "#f0f0f0", color: "#525252" }}>
                        {changedByLabel(log.changed_by)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{deltaCell(log.delta_virtual)}</td>
                    <td className="px-4 py-3 text-center">{deltaCell(log.delta_physical)}</td>
                    <td className="px-4 py-3 text-center">{deltaCell(log.delta_total)}</td>
                    <td className="px-4 py-3 text-center font-semibold" style={{ color: "#d57282" }}>{log.new_total}</td>
                    <td className="px-4 py-3 max-w-[180px]" style={{ color: "#8a8a8a" }}>
                      {log.remarks ? <span className="italic">{log.remarks}</span> : <span style={{ color: "#d0d0d0" }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 shrink-0" style={{ borderTop: "1px solid #f0eae6" }}>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: "#d57282", color: "#ffffff", boxShadow: "0 4px 14px rgba(213,114,130,0.28)" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Row more menu ───────────────────────────────────────────────────────────

function RowMoreMenu({
  onUpdateInventory,
  onViewLog,
}: {
  onUpdateInventory: () => void;
  onViewLog: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref             = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-lg hover:bg-[#f9e8eb] transition-colors"
        title="More options"
      >
        <MoreHorizontal size={13} style={{ color: "#d57282" }} />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1 z-30 rounded-xl overflow-hidden w-44"
          style={{ backgroundColor: "#ffffff", border: "1px solid #E2E2E2", boxShadow: "0 4px 20px rgba(0,0,0,0.10)" }}
        >
          <button
            onClick={() => { setOpen(false); onUpdateInventory(); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-[#faf7f5] transition-colors"
            style={{ color: "#525252" }}
          >
            <Boxes size={13} style={{ color: "#d57282" }} />
            Update Inventory
          </button>
          <div style={{ borderTop: "1px solid #f0eae6" }} />
          <button
            onClick={() => { setOpen(false); onViewLog(); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-[#faf7f5] transition-colors"
            style={{ color: "#525252" }}
          >
            <ClipboardList size={13} style={{ color: "#d57282" }} />
            View Inventory Log
          </button>
        </div>
      )}
    </div>
  );
}

// ── Table row ──────────────────────────────────────────────────────────────

const COL = "40px 1fr 110px 110px 110px 110px 36px";

function VariantTableRow({ variant, onRefresh }: { variant: VariantRow; onRefresh: () => void }) {
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [logOpen, setLogOpen]             = useState(false);
  const p = variant.products;

  return (
    <>
      <div
        className="grid items-center px-5 py-3 hover:bg-[#fffbf6] transition-colors duration-100"
        style={{ gridTemplateColumns: COL }}
      >
        {/* Image */}
        <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0" style={{ backgroundColor: "#f9e8eb" }}>
          {p.image_url ? (
            <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package size={12} style={{ color: "#d57282" }} />
            </div>
          )}
        </div>

        {/* Product + variant name */}
        <div className="min-w-0 px-3">
          <p className="text-sm font-medium truncate" style={{ color: "#525252" }}>{p.title}</p>
          {p.product_type && (
            <p className="text-xs truncate" style={{ color: "#b0b0b0" }}>{p.product_type}</p>
          )}
          {variant.title !== "Default Title" && (
            <p className="text-xs truncate" style={{ color: "#8a8a8a" }}>{variant.title}</p>
          )}
        </div>

        {/* Cost price (editable) */}
        <div>
          <CostCell variantId={variant.variant_id} initialCost={variant.cost} onSaved={onRefresh} />
        </div>

        {/* Sale price */}
        <div className="text-xs font-medium" style={{ color: "#525252" }}>
          {formatPrice(variant.price)}
        </div>

        {/* Stock */}
        <div>
          <StockBadge qty={variant.inventory_quantity} />
        </div>

        {/* V / P split */}
        <div className="flex gap-1.5">
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "#f0f4ff", color: "#4a6cf7" }} title="Virtual">
            V {variant.virtual_inventory}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "#f0faf4", color: "#27a559" }} title="Physical">
            P {variant.physical_inventory}
          </span>
        </div>

        {/* More menu */}
        <div className="flex justify-center">
          <RowMoreMenu
            onUpdateInventory={() => setInventoryOpen(true)}
            onViewLog={() => setLogOpen(true)}
          />
        </div>
      </div>

      {inventoryOpen && (
        <InventoryModal
          variant={variant}
          onClose={() => setInventoryOpen(false)}
          onSaved={onRefresh}
        />
      )}

      {logOpen && (
        <InventoryLogModal
          variant={variant}
          onClose={() => setLogOpen(false)}
        />
      )}
    </>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [variants, setVariants]             = useState<VariantRow[]>([]);
  const [total, setTotal]                   = useState(0);
  const [page, setPage]                     = useState(1);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [lowStock, setLowStock]             = useState(false);
  const [stockStatus, setStockStatus]       = useState<"" | "in_stock" | "out_of_stock">("");

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageSize   = 50;
  const totalPages = Math.ceil(total / pageSize);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [search]);

  useEffect(() => { setPage(1); }, [lowStock, stockStatus]);

  const fetchVariants = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      search: debouncedSearch,
      low_stock: String(lowStock),
      stock_status: stockStatus,
    });
    const res  = await fetch(`/api/products?${params}`);
    const data = await res.json();
    setVariants(data.variants ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [page, debouncedSearch, lowStock, stockStatus]);

  useEffect(() => { fetchVariants(); }, [fetchVariants]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "#525252", fontFamily: "var(--font-poppins), sans-serif" }}>
            Inventory
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#8a8a8a" }}>
            {total > 0 ? `${total} variants` : "Loading…"}
          </p>
        </div>
        <BulkOperationButton onUploaded={fetchVariants} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-[160px] max-w-sm"
          style={{ backgroundColor: "#ffffff", border: "1px solid #E2E2E2" }}
        >
          <Search size={14} style={{ color: "#8a8a8a" }} />
          <input
            type="text"
            placeholder="Search by product name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-[#c0b8b8]"
            style={{ color: "#525252" }}
          />
          {search && <button onClick={() => setSearch("")}><X size={13} style={{ color: "#8a8a8a" }} /></button>}
        </div>

        <div className="flex gap-1.5">
          {(["", "in_stock", "out_of_stock"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setStockStatus(v)}
              className="px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-100"
              style={
                stockStatus === v
                  ? { backgroundColor: "#d57282", color: "#ffffff" }
                  : { backgroundColor: "#ffffff", border: "1px solid #E2E2E2", color: "#525252" }
              }
            >
              {v === "" ? "All" : v === "in_stock" ? "In Stock" : "Out of Stock"}
            </button>
          ))}
        </div>

        <button
          onClick={() => setLowStock((v) => !v)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-100"
          style={
            lowStock
              ? { backgroundColor: "#fff3e8", color: "#d4600a", border: "1px solid #f5c89a" }
              : { backgroundColor: "#ffffff", border: "1px solid #E2E2E2", color: "#525252" }
          }
        >
          <AlertTriangle size={13} />
          Low stock
        </button>

        {(search || lowStock || stockStatus) && (
          <button
            onClick={() => { setSearch(""); setLowStock(false); setStockStatus(""); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm"
            style={{ color: "#8a8a8a", border: "1px solid #E2E2E2", backgroundColor: "#ffffff" }}
          >
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs" style={{ color: "#8a8a8a" }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: "#4a6cf7" }} />
          V = Virtual (anticipated)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: "#27a559" }} />
          P = Physical (on-hand)
        </span>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 16px rgba(213,114,130,0.07)", border: "1px solid #E2E2E2" }}
      >
        <div className="overflow-x-auto">
        <div style={{ minWidth: "700px" }}>
        <div
          className="grid text-xs font-semibold uppercase tracking-wide px-5 py-3"
          style={{ gridTemplateColumns: COL, borderBottom: "1px solid #f0eae6", color: "#8a8a8a" }}
        >
          <span />
          <span className="px-3">Product / Variant</span>
          <span>Cost Price</span>
          <span>Sale Price</span>
          <span>Stock</span>
          <span>V / P Split</span>
          <span />
        </div>

        {loading ? (
          <div className="py-16 flex flex-col items-center gap-3" style={{ color: "#8a8a8a" }}>
            <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "#d57282", borderTopColor: "transparent" }} />
            <p className="text-sm">Loading inventory…</p>
          </div>
        ) : variants.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2" style={{ color: "#8a8a8a" }}>
            <Package size={32} style={{ opacity: 0.3 }} />
            <p className="text-sm">No variants found</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "#f0eae6" }}>
            {variants.map((v) => (
              <VariantTableRow key={v.variant_id} variant={v} onRefresh={fetchVariants} />
            ))}
          </div>
        )}
        </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 text-sm" style={{ borderTop: "1px solid #f0eae6" }}>
            <span style={{ color: "#8a8a8a" }}>Page {page} of {totalPages} · {total} variants</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm disabled:opacity-40 transition-opacity"
                style={{ border: "1px solid #E2E2E2", color: "#525252" }}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm disabled:opacity-40 transition-opacity"
                style={{ border: "1px solid #E2E2E2", color: "#525252" }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
