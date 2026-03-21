"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  X,
  Pencil,
  Trash2,
  Download,
  Plus,
  ExternalLink,
  Upload,
  Check,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type PaymentStatus = "PAID" | "UNPAID";

interface PurchaseInvoice {
  id: number;
  invoice_number: string;
  invoice_date: string;
  vendor_name: string;
  vendor_gst: string | null;
  total_amount: number;
  total_gst: number;
  payment_date: string | null;
  payment_status: PaymentStatus;
  document_url: string | null;
  document_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Summary {
  total_invoices_amount: number;
  total_gst_amount: number;
  paid_count: number;
  unpaid_count: number;
}

interface InvoicesResponse {
  invoices: PurchaseInvoice[];
  total: number;
  page: number;
  pageSize: number;
  summary: Summary;
}

interface InvoiceFormData {
  invoice_number: string;
  invoice_date: string;
  vendor_name: string;
  vendor_gst: string;
  total_amount: string;
  total_gst: string;
  payment_date: string;
  notes: string;
  document_url: string;
  document_path: string;
  document_filename: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: PaymentStatus | ""; label: string }[] = [
  { value: "", label: "All Status" },
  { value: "PAID", label: "Paid" },
  { value: "UNPAID", label: "Unpaid" },
];

// ── Helpers ───────────────────────────────────────────────────────────────

function formatINR(amount: number): string {
  return (
    "₹" +
    amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getDefaultDateFrom(): string {
  return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
}

function getDefaultDateTo(): string {
  return new Date().toISOString().split("T")[0];
}

function extractFilename(url: string): string {
  const segment = url.split("/").pop() ?? url;
  // Strip leading timestamp prefix like "1234567890-"
  return segment.replace(/^\d+-/, "");
}

// ── Status Badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PaymentStatus }) {
  const styles =
    status === "PAID"
      ? { backgroundColor: "#e8f5e9", color: "#2e7d32" }
      : { backgroundColor: "#fff8e1", color: "#e65100" };
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
      style={styles}
    >
      {status === "PAID" ? "Paid" : "Unpaid"}
    </span>
  );
}

// ── Summary Cards ─────────────────────────────────────────────────────────

function SummaryCards({
  summary,
  loading,
}: {
  summary: Summary | null;
  loading: boolean;
}) {
  const cards = [
    {
      label: "Total Invoice Value",
      value: summary ? formatINR(summary.total_invoices_amount) : "—",
      sub: loading ? "" : summary ? "across all invoices" : "",
    },
    {
      label: "Total GST",
      value: summary ? formatINR(summary.total_gst_amount) : "—",
      sub:
        summary && summary.total_invoices_amount > 0
          ? `${((summary.total_gst_amount / summary.total_invoices_amount) * 100).toFixed(1)}% of invoice value`
          : "",
    },
    {
      label: "Paid / Unpaid",
      value: loading
        ? "—"
        : summary
          ? `${summary.paid_count} Paid · ${summary.unpaid_count} Unpaid`
          : "—",
      sub: "by payment status",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
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
            {c.label}
          </p>
          <p
            className="text-xl font-semibold"
            style={{
              color: "#525252",
              fontFamily: "var(--font-poppins), sans-serif",
            }}
          >
            {c.value}
          </p>
          {c.sub && (
            <p className="text-xs mt-0.5" style={{ color: "#8a8a8a" }}>
              {c.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Status Filter Dropdown ─────────────────────────────────────────────────

function StatusFilterDropdown({
  value,
  onChange,
}: {
  value: PaymentStatus | "";
  onChange: (v: PaymentStatus | "") => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isActive = value !== "";
  const selectedLabel =
    STATUS_OPTIONS.find((o) => o.value === value)?.label ?? "All Status";

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      )
        setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium transition-all duration-100"
        style={{
          borderRadius: 22,
          ...(isActive
            ? {
                backgroundColor: "#f9e8eb",
                color: "#d57282",
                border: "1px solid #d57282",
              }
            : {
                backgroundColor: "#ffffff",
                border: "1px solid #E2E2E2",
                color: "#525252",
              }),
        }}
      >
        {selectedLabel}
        <ChevronDown
          size={13}
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 150ms ease",
          }}
        />
      </button>

      {open && (
        <div
          className="absolute top-full mt-1.5 left-0 z-50 py-1 overflow-hidden"
          style={{
            backgroundColor: "#ffffff",
            boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
            border: "1px solid #E2E2E2",
            borderRadius: 14,
            minWidth: 160,
          }}
        >
          {STATUS_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                onChange(o.value as PaymentStatus | "");
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm transition-colors"
              style={{
                color: value === o.value ? "#d57282" : "#525252",
                fontWeight: value === o.value ? 600 : 400,
                backgroundColor: "transparent",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  "#f9e8eb";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  "transparent";
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Skeleton Rows ─────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: 10 }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div
                className="h-3 rounded-full"
                style={{
                  backgroundColor: "#f0eae6",
                  width:
                    j === 0
                      ? 80
                      : j === 1
                        ? 70
                        : j === 2
                          ? 120
                          : j === 9
                            ? 60
                            : 90,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Document Upload Area ───────────────────────────────────────────────────

function DocumentUploadArea({
  documentUrl,
  documentPath,
  documentFilename,
  onUploaded,
  onRemoved,
  inputClass,
}: {
  documentUrl: string;
  documentPath: string;
  documentFilename: string;
  onUploaded: (url: string, path: string, filename: string) => void;
  onRemoved: () => void;
  inputClass: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasDocument = !!documentUrl;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File exceeds 10MB limit.");
      return;
    }
    if (file.type !== "application/pdf") {
      setUploadError("Only PDF files are accepted.");
      return;
    }

    setUploading(true);
    setUploadError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/purchase-invoices/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      onUploaded(data.url, data.path, file.name);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Upload failed. Try again."
      );
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-selected if removed
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (hasDocument) {
    return (
      <div
        className="flex items-center justify-between px-3 py-2.5 rounded-xl"
        style={{ border: "1px solid #c8e6c9", backgroundColor: "#f1f8f1" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Check size={14} style={{ color: "#2e7d32", flexShrink: 0 }} />
          <span
            className="text-xs font-medium truncate"
            style={{ color: "#2e7d32" }}
            title={documentFilename}
          >
            {documentFilename}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemoved}
          className="text-xs ml-3 shrink-0"
          style={{ color: "#8a8a8a" }}
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="sr-only"
        id="invoice-doc-upload"
        onChange={handleFileChange}
        disabled={uploading}
      />
      <label
        htmlFor="invoice-doc-upload"
        className={
          inputClass +
          " flex flex-col items-center justify-center gap-2 py-5 cursor-pointer text-center"
        }
        style={{
          border: "1.5px dashed #E2E2E2",
          borderRadius: 12,
          backgroundColor: uploading ? "#faf7f5" : "#ffffff",
          color: "#8a8a8a",
          transition: "border-color 150ms ease",
        }}
        onMouseEnter={(e) => {
          if (!uploading)
            (e.currentTarget as HTMLLabelElement).style.borderColor = "#d57282";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLLabelElement).style.borderColor = "#E2E2E2";
        }}
      >
        {uploading ? (
          <>
            <div
              className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "#d57282", borderTopColor: "transparent" }}
            />
            <span className="text-xs">Uploading…</span>
          </>
        ) : (
          <>
            <Upload size={18} style={{ color: "#c0b8b8" }} />
            <span className="text-xs">Click to upload PDF (max 10MB)</span>
          </>
        )}
      </label>
      {uploadError && (
        <p className="text-xs mt-1.5" style={{ color: "#e05252" }}>
          {uploadError}
        </p>
      )}
    </div>
  );
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────

function InvoiceModal({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: "add" | "edit";
  initial?: PurchaseInvoice;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState<InvoiceFormData>({
    invoice_number: initial?.invoice_number ?? "",
    invoice_date: initial?.invoice_date
      ? initial.invoice_date.split("T")[0]
      : today,
    vendor_name: initial?.vendor_name ?? "",
    vendor_gst: initial?.vendor_gst ?? "",
    total_amount: initial ? String(initial.total_amount) : "",
    total_gst: initial ? String(initial.total_gst) : "0",
    payment_date: initial?.payment_date
      ? initial.payment_date.split("T")[0]
      : "",
    notes: initial?.notes ?? "",
    document_url: initial?.document_url ?? "",
    document_path: initial?.document_path ?? "",
    document_filename: initial?.document_url
      ? extractFilename(initial.document_url)
      : "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const amount = parseFloat(form.total_amount) || 0;
  const gst = parseFloat(form.total_gst) || 0;
  const totalPayable = amount + gst;

  function set<K extends keyof InvoiceFormData>(
    key: K,
    value: InvoiceFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.invoice_number.trim()) {
      setError("Invoice number is required.");
      return;
    }
    if (!form.invoice_date) {
      setError("Invoice date is required.");
      return;
    }
    if (!form.vendor_name.trim()) {
      setError("Vendor name is required.");
      return;
    }
    if (amount <= 0) {
      setError("Total amount must be greater than 0.");
      return;
    }

    setSaving(true);
    setError("");

    const body = {
      invoice_number: form.invoice_number.trim(),
      invoice_date: form.invoice_date,
      vendor_name: form.vendor_name.trim(),
      vendor_gst: form.vendor_gst.trim() || null,
      total_amount: amount,
      total_gst: gst,
      payment_date: form.payment_date || null,
      notes: form.notes.trim() || null,
      document_url: form.document_url || null,
      document_path: form.document_path || null,
    };

    try {
      const url =
        mode === "edit" && initial
          ? `/api/purchase-invoices/${initial.id}`
          : "/api/purchase-invoices";
      const method = mode === "edit" ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save invoice");
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save invoice"
      );
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full text-sm rounded-xl px-3 py-2.5 outline-none placeholder:text-[#c0b8b8]";
  const inputStyle: React.CSSProperties = {
    border: "1px solid #E2E2E2",
    color: "#525252",
    backgroundColor: "#ffffff",
  };
  const labelClass = "block text-xs font-medium mb-1.5";
  const labelStyle: React.CSSProperties = { color: "#525252" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: "#ffffff",
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          maxHeight: "92vh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0"
          style={{ borderBottom: "1px solid #f0eae6" }}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl" style={{ backgroundColor: "#f9e8eb" }}>
              <FileText size={14} style={{ color: "#d57282" }} />
            </div>
            <h3
              className="text-sm font-semibold"
              style={{ color: "#525252" }}
            >
              {mode === "add" ? "Add Invoice" : "Edit Invoice"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[#f5f0ed]"
            aria-label="Close modal"
          >
            <X size={16} style={{ color: "#8a8a8a" }} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* Invoice Number */}
          <div>
            <label className={labelClass} style={labelStyle}>
              Invoice Number <span style={{ color: "#e05252" }}>*</span>
            </label>
            <input
              type="text"
              placeholder="INV-001"
              value={form.invoice_number}
              onChange={(e) => set("invoice_number", e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {/* Invoice Date */}
          <div>
            <label className={labelClass} style={labelStyle}>
              Invoice Date <span style={{ color: "#e05252" }}>*</span>
            </label>
            <input
              type="date"
              value={form.invoice_date}
              onChange={(e) => set("invoice_date", e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {/* Vendor Name */}
          <div>
            <label className={labelClass} style={labelStyle}>
              Vendor Name <span style={{ color: "#e05252" }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Vendor or supplier name"
              value={form.vendor_name}
              onChange={(e) => set("vendor_name", e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {/* Vendor GST */}
          <div>
            <label className={labelClass} style={labelStyle}>
              Vendor GST{" "}
              <span style={{ color: "#8a8a8a" }}>(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 22AAAAA0000A1Z5"
              value={form.vendor_gst}
              onChange={(e) => set("vendor_gst", e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {/* Amount row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Total Amount */}
            <div>
              <label className={labelClass} style={labelStyle}>
                Total Amount <span style={{ color: "#e05252" }}>*</span>
              </label>
              <div
                className="flex items-center rounded-xl overflow-hidden"
                style={{ border: "1px solid #E2E2E2" }}
              >
                <span
                  className="px-3 py-2.5 text-sm shrink-0"
                  style={{
                    color: "#8a8a8a",
                    borderRight: "1px solid #E2E2E2",
                    backgroundColor: "#faf7f5",
                  }}
                >
                  ₹
                </span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={form.total_amount}
                  onChange={(e) => set("total_amount", e.target.value)}
                  className="flex-1 min-w-0 text-sm px-3 py-2.5 outline-none bg-transparent"
                  style={{ color: "#525252" }}
                />
              </div>
            </div>

            {/* Total GST */}
            <div>
              <label className={labelClass} style={labelStyle}>
                Total GST <span style={{ color: "#8a8a8a" }}>(optional)</span>
              </label>
              <div
                className="flex items-center rounded-xl overflow-hidden"
                style={{ border: "1px solid #E2E2E2" }}
              >
                <span
                  className="px-3 py-2.5 text-sm shrink-0"
                  style={{
                    color: "#8a8a8a",
                    borderRight: "1px solid #E2E2E2",
                    backgroundColor: "#faf7f5",
                  }}
                >
                  ₹
                </span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={form.total_gst}
                  onChange={(e) => set("total_gst", e.target.value)}
                  className="flex-1 min-w-0 text-sm px-3 py-2.5 outline-none bg-transparent"
                  style={{ color: "#525252" }}
                />
              </div>
            </div>
          </div>

          {/* Total Payable (read-only) */}
          <div
            className="flex items-center justify-between px-4 py-2.5 rounded-xl"
            style={{ backgroundColor: "#f9e8eb" }}
          >
            <span className="text-xs font-medium" style={{ color: "#d57282" }}>
              Total Payable
            </span>
            <span
              className="text-sm font-bold"
              style={{ color: "#d57282" }}
            >
              {formatINR(totalPayable)}
            </span>
          </div>

          {/* Payment Date */}
          <div>
            <label className={labelClass} style={labelStyle}>
              Payment Date{" "}
              <span style={{ color: "#8a8a8a" }}>
                (leave blank = Unpaid)
              </span>
            </label>
            <input
              type="date"
              value={form.payment_date}
              onChange={(e) => set("payment_date", e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass} style={labelStyle}>
              Notes <span style={{ color: "#8a8a8a" }}>(optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Any notes about this invoice…"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="w-full text-sm rounded-xl px-3 py-2.5 outline-none resize-none placeholder:text-[#c0b8b8]"
              style={inputStyle}
            />
          </div>

          {/* Document PDF */}
          <div>
            <label className={labelClass} style={labelStyle}>
              Document PDF{" "}
              <span style={{ color: "#8a8a8a" }}>(optional)</span>
            </label>
            <DocumentUploadArea
              documentUrl={form.document_url}
              documentPath={form.document_path}
              documentFilename={form.document_filename}
              inputClass={inputClass}
              onUploaded={(url, path, filename) => {
                set("document_url", url);
                set("document_path", path);
                set("document_filename", filename);
              }}
              onRemoved={() => {
                set("document_url", "");
                set("document_path", "");
                set("document_filename", "");
              }}
            />
          </div>

          {error && (
            <p className="text-xs" style={{ color: "#e05252" }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex gap-2 px-6 py-4 shrink-0"
          style={{ borderTop: "1px solid #f0eae6" }}
        >
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{
              border: "1px solid #E2E2E2",
              color: "#525252",
              backgroundColor: "#ffffff",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={
              saving
                ? {
                    backgroundColor: "#f0e8ea",
                    color: "#c0a0a8",
                    cursor: "not-allowed",
                  }
                : {
                    backgroundColor: "#d57282",
                    color: "#ffffff",
                    boxShadow: "0 4px 14px rgba(213,114,130,0.28)",
                  }
            }
          >
            {saving
              ? "Saving…"
              : mode === "add"
                ? "Add Invoice"
                : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function PurchaseInvoicesPage() {
  const defaultDateFrom = getDefaultDateFrom();
  const defaultDateTo = getDefaultDateTo();

  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "">("");
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<PurchaseInvoice | undefined>(
    undefined
  );

  // Delete confirm state
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // CSV export
  const [exporting, setExporting] = useState(false);

  const debounceSearch = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pageSize = 30;
  const totalPages = Math.ceil(total / pageSize);

  // Debounce search
  useEffect(() => {
    if (debounceSearch.current) clearTimeout(debounceSearch.current);
    debounceSearch.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (debounceSearch.current) clearTimeout(debounceSearch.current);
    };
  }, [search]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, dateFrom, dateTo]);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter) params.set("payment_status", statusFilter);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      const res = await fetch(`/api/purchase-invoices?${params}`);
      const data: InvoicesResponse = await res.json();
      setInvoices(data.invoices ?? []);
      setTotal(data.total ?? 0);
      setSummary(data.summary ?? null);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  function handleResetFilters() {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("");
    setDateFrom(defaultDateFrom);
    setDateTo(defaultDateTo);
    setPage(1);
  }

  function isFilterActive(): boolean {
    return (
      !!search ||
      !!statusFilter ||
      dateFrom !== defaultDateFrom ||
      dateTo !== defaultDateTo
    );
  }

  async function handleDelete(id: number) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/purchase-invoices/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setDeleteConfirmId(null);
      fetchInvoices();
    } catch {
      // silent — row remains
    } finally {
      setDeleting(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter) params.set("payment_status", statusFilter);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      const res = await fetch(`/api/purchase-invoices/export?${params}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `maeri_purchase_invoices_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const inputBase =
    "flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-white outline-none";
  const inputBorder: React.CSSProperties = { border: "1px solid #E2E2E2" };

  const TABLE_HEADERS = [
    "Invoice No.",
    "Date",
    "Vendor",
    "GST No.",
    "Amount",
    "GST",
    "Payment Date",
    "Status",
    "Document",
    "Actions",
  ];

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1
            className="text-xl font-semibold"
            style={{
              color: "#525252",
              fontFamily: "var(--font-poppins), sans-serif",
            }}
          >
            Purchase Invoices
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#8a8a8a" }}>
            {loading ? "Loading…" : `${total} invoices`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* CSV Export */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all"
            style={{
              borderRadius: 22,
              border: "1px solid #E2E2E2",
              color: "#525252",
              backgroundColor: "#ffffff",
              opacity: exporting ? 0.6 : 1,
            }}
          >
            <Download size={14} />
            {exporting ? "Exporting…" : "Export CSV"}
          </button>

          {/* Add Invoice */}
          <button
            onClick={() => {
              setEditTarget(undefined);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-all"
            style={{
              borderRadius: 22,
              backgroundColor: "#d57282",
              color: "#ffffff",
              boxShadow: "0 4px 14px rgba(213,114,130,0.28)",
            }}
          >
            <Plus size={14} />
            Add Invoice
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards summary={summary} loading={loading} />

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2.5 items-center">
        {/* Search */}
        <div
          className={inputBase + " flex-1 min-w-[200px] max-w-xs"}
          style={inputBorder}
        >
          <Search size={14} style={{ color: "#8a8a8a" }} />
          <input
            type="text"
            placeholder="Search vendor or invoice no…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-[#c0b8b8]"
            style={{ color: "#525252" }}
          />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Clear search">
              <X size={13} style={{ color: "#8a8a8a" }} />
            </button>
          )}
        </div>

        {/* Status dropdown */}
        <StatusFilterDropdown
          value={statusFilter}
          onChange={setStatusFilter}
        />

        {/* Date From */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs" style={{ color: "#8a8a8a" }}>
            From
          </span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 text-sm outline-none"
            style={{
              borderRadius: 12,
              border: "1px solid #E2E2E2",
              color: "#525252",
              backgroundColor: "#ffffff",
            }}
          />
        </div>

        {/* Date To */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs" style={{ color: "#8a8a8a" }}>
            To
          </span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 text-sm outline-none"
            style={{
              borderRadius: 12,
              border: "1px solid #E2E2E2",
              color: "#525252",
              backgroundColor: "#ffffff",
            }}
          />
        </div>

        {/* Reset */}
        {isFilterActive() && (
          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm"
            style={{
              color: "#8a8a8a",
              border: "1px solid #E2E2E2",
              backgroundColor: "#ffffff",
            }}
          >
            <X size={13} />
            Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "#ffffff",
          boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
          border: "1px solid #E2E2E2",
        }}
      >
        <div className="overflow-x-auto">
          <table
            className="w-full text-sm"
            style={{ borderCollapse: "collapse" }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: "#faf7f5",
                  borderBottom: "1px solid #f0eae6",
                }}
              >
                {TABLE_HEADERS.map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                    style={{ color: "#8a8a8a" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows />
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <FileText size={32} style={{ color: "#E2E2E2" }} />
                      <p className="text-sm" style={{ color: "#8a8a8a" }}>
                        No purchase invoices found.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-[#fffbf6] transition-colors"
                    style={{ borderBottom: "1px solid #f0eae6" }}
                  >
                    {/* Invoice No. */}
                    <td
                      className="px-4 py-3 whitespace-nowrap text-xs font-mono"
                      style={{ color: "#525252" }}
                    >
                      {inv.invoice_number}
                    </td>

                    {/* Date */}
                    <td
                      className="px-4 py-3 whitespace-nowrap text-xs"
                      style={{ color: "#525252" }}
                    >
                      {formatDate(inv.invoice_date)}
                    </td>

                    {/* Vendor */}
                    <td
                      className="px-4 py-3 text-xs max-w-[160px]"
                      style={{ color: "#525252" }}
                      title={inv.vendor_name}
                    >
                      {inv.vendor_name}
                    </td>

                    {/* GST No. */}
                    <td
                      className="px-4 py-3 text-xs font-mono"
                      style={{ color: "#525252" }}
                    >
                      {inv.vendor_gst ?? (
                        <span style={{ color: "#c0b8b8" }}>—</span>
                      )}
                    </td>

                    {/* Amount */}
                    <td
                      className="px-4 py-3 text-xs font-semibold whitespace-nowrap"
                      style={{ color: "#525252" }}
                    >
                      {formatINR(inv.total_amount)}
                    </td>

                    {/* GST */}
                    <td
                      className="px-4 py-3 text-xs whitespace-nowrap"
                      style={{ color: "#8a8a8a" }}
                    >
                      {inv.total_gst > 0 ? (
                        formatINR(inv.total_gst)
                      ) : (
                        <span style={{ color: "#c0b8b8" }}>—</span>
                      )}
                    </td>

                    {/* Payment Date */}
                    <td
                      className="px-4 py-3 whitespace-nowrap text-xs"
                      style={{ color: "#525252" }}
                    >
                      {inv.payment_date ? (
                        formatDate(inv.payment_date)
                      ) : (
                        <span style={{ color: "#c0b8b8" }}>—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={inv.payment_status} />
                    </td>

                    {/* Document */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {inv.document_url ? (
                        <a
                          href={inv.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors hover:bg-[#f9e8eb]"
                          style={{ color: "#d57282" }}
                          aria-label="Open invoice PDF"
                        >
                          <ExternalLink size={11} />
                          PDF
                        </a>
                      ) : (
                        <span style={{ color: "#c0b8b8" }} className="text-xs">
                          —
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {deleteConfirmId === inv.id ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-xs"
                            style={{ color: "#525252" }}
                          >
                            Delete?
                          </span>
                          <button
                            onClick={() => handleDelete(inv.id)}
                            disabled={deleting}
                            className="text-xs font-semibold px-2 py-1 rounded-lg transition-colors"
                            style={{
                              backgroundColor: "#fff0f0",
                              color: "#e05252",
                            }}
                          >
                            {deleting ? "…" : "Yes"}
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-xs font-medium px-2 py-1 rounded-lg transition-colors"
                            style={{
                              backgroundColor: "#f5f5f5",
                              color: "#525252",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditTarget(inv);
                              setShowModal(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-[#f9e8eb] transition-colors"
                            aria-label="Edit invoice"
                          >
                            <Pencil size={13} style={{ color: "#8a8a8a" }} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(inv.id)}
                            className="p-1.5 rounded-lg hover:bg-[#fff0f0] transition-colors"
                            aria-label="Delete invoice"
                          >
                            <Trash2 size={13} style={{ color: "#8a8a8a" }} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs" style={{ color: "#8a8a8a" }}>
            Page {page} of {totalPages} · {total} invoices
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-all"
              style={
                page === 1
                  ? {
                      border: "1px solid #E2E2E2",
                      color: "#c0b8b8",
                      backgroundColor: "#ffffff",
                      cursor: "not-allowed",
                    }
                  : {
                      border: "1px solid #E2E2E2",
                      color: "#525252",
                      backgroundColor: "#ffffff",
                    }
              }
            >
              <ChevronLeft size={13} />
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-all"
              style={
                page === totalPages
                  ? {
                      border: "1px solid #E2E2E2",
                      color: "#c0b8b8",
                      backgroundColor: "#ffffff",
                      cursor: "not-allowed",
                    }
                  : {
                      border: "1px solid #E2E2E2",
                      color: "#525252",
                      backgroundColor: "#ffffff",
                    }
              }
            >
              Next
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <InvoiceModal
          mode={editTarget ? "edit" : "add"}
          initial={editTarget}
          onClose={() => {
            setShowModal(false);
            setEditTarget(undefined);
          }}
          onSaved={fetchInvoices}
        />
      )}
    </div>
  );
}
