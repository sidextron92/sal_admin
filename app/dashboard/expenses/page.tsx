"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Receipt,
  X,
  Pencil,
  Trash2,
  RefreshCw,
  Download,
  Plus,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type ExpenseFunction =
  | "MARKETING"
  | "EMPLOYEE"
  | "LOGISTIC"
  | "PACKAGING"
  | "SOFTWARE"
  | "PAYMENT_GATEWAY"
  | "MISCELLANEOUS";

interface Expense {
  id: number;
  function_name: ExpenseFunction;
  type: string | null;
  particulars: string;
  expense_date: string;
  base_amount: number;
  tax_amount: number;
  total_amount: number;
  remarks: string | null;
  is_recurring: boolean;
  created_at: string;
}

interface ByFunction {
  function_name: string;
  total_amount: number;
  count: number;
}

interface Summary {
  total_base: number;
  total_tax: number;
  total_amount: number;
  by_function: ByFunction[];
}

interface ExpensesResponse {
  expenses: Expense[];
  total: number;
  page: number;
  pageSize: number;
  summary: Summary;
}

interface ExpenseFormData {
  function_name: ExpenseFunction | "";
  type: string;
  particulars: string;
  date: string;
  base_amount: string;
  tax_amount: string;
  remarks: string;
  is_recurring: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────

const FUNCTION_OPTIONS: { value: ExpenseFunction; label: string }[] = [
  { value: "MARKETING",        label: "Marketing" },
  { value: "EMPLOYEE",         label: "Employee" },
  { value: "LOGISTIC",         label: "Logistic" },
  { value: "PACKAGING",        label: "Packaging" },
  { value: "SOFTWARE",         label: "Software" },
  { value: "PAYMENT_GATEWAY",  label: "Payment Gateway" },
  { value: "MISCELLANEOUS",    label: "Miscellaneous" },
];

const FUNCTION_COLORS: Record<ExpenseFunction, { bg: string; color: string }> = {
  MARKETING:       { bg: "#fde8ef", color: "#c2185b" },
  EMPLOYEE:        { bg: "#e8f5e9", color: "#2e7d32" },
  LOGISTIC:        { bg: "#e3f2fd", color: "#1565c0" },
  PACKAGING:       { bg: "#fff8e1", color: "#f57f17" },
  SOFTWARE:        { bg: "#f3e5f5", color: "#6a1b9a" },
  PAYMENT_GATEWAY: { bg: "#e0f7fa", color: "#00695c" },
  MISCELLANEOUS:   { bg: "#f5f5f5", color: "#424242" },
};

function getDefaultDateFrom(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
}

function getDefaultDateTo(): string {
  return new Date().toISOString().split("T")[0];
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatINR(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + "…";
}

// ── Function Badge ────────────────────────────────────────────────────────

function FunctionBadge({ fn }: { fn: ExpenseFunction }) {
  const colors = FUNCTION_COLORS[fn] ?? { bg: "#f5f5f5", color: "#424242" };
  const label = FUNCTION_OPTIONS.find((o) => o.value === fn)?.label ?? fn;
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ backgroundColor: colors.bg, color: colors.color }}
    >
      {label}
    </span>
  );
}

// ── Summary Cards ─────────────────────────────────────────────────────────

function SummaryCards({
  summary,
  entriesCount,
  loading,
}: {
  summary: Summary | null;
  entriesCount: number;
  loading: boolean;
}) {
  const cards = [
    {
      label: "Total Spend",
      value: summary ? formatINR(summary.total_amount) : "—",
      sub: summary ? `Base ${formatINR(summary.total_base)}` : "",
    },
    {
      label: "Total Tax",
      value: summary ? formatINR(summary.total_tax) : "—",
      sub: summary && summary.total_amount > 0
        ? `${((summary.total_tax / summary.total_amount) * 100).toFixed(1)}% of spend`
        : "",
    },
    {
      label: "Entries",
      value: loading ? "—" : String(entriesCount),
      sub: "matching filters",
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
          <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "#8a8a8a" }}>
            {c.label}
          </p>
          <p className="text-xl font-semibold" style={{ color: "#525252", fontFamily: "var(--font-poppins), sans-serif" }}>
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

// ── Spend by Function Strip ───────────────────────────────────────────────

function SpendByFunction({ byFunction }: { byFunction: ByFunction[] }) {
  if (!byFunction || byFunction.length === 0) return null;

  return (
    <div
      className="rounded-2xl px-5 py-3.5 flex flex-wrap gap-2 items-center"
      style={{
        backgroundColor: "#ffffff",
        boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
        border: "1px solid #E2E2E2",
      }}
    >
      <span className="text-xs font-medium shrink-0 mr-1" style={{ color: "#8a8a8a" }}>
        By function:
      </span>
      {byFunction.map((item) => {
        const fn = item.function_name as ExpenseFunction;
        const colors = FUNCTION_COLORS[fn] ?? { bg: "#f5f5f5", color: "#424242" };
        const label = FUNCTION_OPTIONS.find((o) => o.value === fn)?.label ?? fn;
        return (
          <span
            key={fn}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ backgroundColor: colors.bg, color: colors.color }}
          >
            {label}
            <span className="font-semibold">{formatINR(item.total_amount)}</span>
          </span>
        );
      })}
    </div>
  );
}

// ── Function Filter Dropdown ──────────────────────────────────────────────

function FunctionFilterDropdown({
  value,
  onChange,
}: {
  value: ExpenseFunction | "";
  onChange: (v: ExpenseFunction | "") => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isActive = value !== "";
  const selectedLabel = FUNCTION_OPTIONS.find((o) => o.value === value)?.label ?? "All Functions";

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
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
            ? { backgroundColor: "#f9e8eb", color: "#d57282", border: "1px solid #d57282" }
            : { backgroundColor: "#ffffff", border: "1px solid #E2E2E2", color: "#525252" }),
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
            minWidth: 180,
          }}
        >
          <button
            onClick={() => { onChange(""); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm transition-colors"
            style={{
              color: value === "" ? "#d57282" : "#525252",
              fontWeight: value === "" ? 600 : 400,
              backgroundColor: "transparent",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#f9e8eb"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
          >
            All Functions
          </button>
          {FUNCTION_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm transition-colors"
              style={{
                color: value === o.value ? "#d57282" : "#525252",
                fontWeight: value === o.value ? 600 : 400,
                backgroundColor: "transparent",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#f9e8eb"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Skeleton rows ─────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: 9 }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div
                className="h-3 rounded-full"
                style={{
                  backgroundColor: "#f0eae6",
                  width: j === 0 ? 80 : j === 1 ? 70 : j === 3 ? 140 : j === 8 ? 60 : 100,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Form Function Select (modal) ──────────────────────────────────────────

function FormFunctionSelect({
  value,
  onChange,
  inputClass,
  inputStyle,
}: {
  value: ExpenseFunction | "";
  onChange: (v: ExpenseFunction | "") => void;
  inputClass: string;
  inputStyle: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedLabel = FUNCTION_OPTIONS.find((o) => o.value === value)?.label;

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={inputClass + " w-full flex items-center justify-between text-left"}
        style={inputStyle}
      >
        <span style={{ color: value ? "#525252" : "#c0b8b8" }}>
          {selectedLabel ?? "Select function…"}
        </span>
        <ChevronDown
          size={14}
          style={{
            color: "#8a8a8a",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 150ms ease",
            flexShrink: 0,
          }}
        />
      </button>

      {open && (
        <div
          className="absolute top-full mt-1 left-0 right-0 z-50 py-1 overflow-hidden"
          style={{
            backgroundColor: "#ffffff",
            boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
            border: "1px solid #E2E2E2",
            borderRadius: 12,
          }}
        >
          {FUNCTION_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm transition-colors"
              style={{
                color: value === o.value ? "#d57282" : "#525252",
                fontWeight: value === o.value ? 600 : 400,
                backgroundColor: "transparent",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#f9e8eb"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────

function ExpenseModal({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: "add" | "edit";
  initial?: Expense;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState<ExpenseFormData>({
    function_name: initial?.function_name ?? "",
    type: initial?.type ?? "",
    particulars: initial?.particulars ?? "",
    date: initial?.expense_date ? initial.expense_date.split("T")[0] : today,
    base_amount: initial ? String(initial.base_amount) : "",
    tax_amount: initial ? String(initial.tax_amount) : "0",
    remarks: initial?.remarks ?? "",
    is_recurring: initial?.is_recurring ?? false,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const base = parseFloat(form.base_amount) || 0;
  const tax = parseFloat(form.tax_amount) || 0;
  const total = base + tax;

  function set<K extends keyof ExpenseFormData>(key: K, value: ExpenseFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.function_name) { setError("Function is required."); return; }
    if (!form.particulars.trim()) { setError("Particulars is required."); return; }
    if (!form.date) { setError("Date is required."); return; }
    if (base <= 0) { setError("Base amount must be greater than 0."); return; }

    setSaving(true);
    setError("");

    const body = {
      function_name: form.function_name,
      type: form.type.trim() || null,
      particulars: form.particulars.trim(),
      expense_date: form.date,
      base_amount: base,
      tax_amount: tax,
      remarks: form.remarks.trim() || null,
      is_recurring: form.is_recurring,
    };

    try {
      const url = mode === "edit" && initial ? `/api/expenses/${initial.id}` : "/api/expenses";
      const method = mode === "edit" ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save expense");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save expense");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full text-sm rounded-xl px-3 py-2.5 outline-none placeholder:text-[#c0b8b8]";
  const inputStyle = { border: "1px solid #E2E2E2", color: "#525252", backgroundColor: "#ffffff" };
  const labelClass = "block text-xs font-medium mb-1.5";
  const labelStyle = { color: "#525252" };

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
              <Receipt size={14} style={{ color: "#d57282" }} />
            </div>
            <h3 className="text-sm font-semibold" style={{ color: "#525252" }}>
              {mode === "add" ? "Add Expense" : "Edit Expense"}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#f5f0ed]">
            <X size={16} style={{ color: "#8a8a8a" }} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* Function */}
          <div>
            <label className={labelClass} style={labelStyle}>
              Function <span style={{ color: "#e05252" }}>*</span>
            </label>
            <FormFunctionSelect
              value={form.function_name}
              onChange={(v) => set("function_name", v)}
              inputClass={inputClass}
              inputStyle={inputStyle}
            />
          </div>

          {/* Type */}
          <div>
            <label className={labelClass} style={labelStyle}>
              Type <span style={{ color: "#8a8a8a" }}>(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Ads, Salary, Subscription…"
              value={form.type}
              onChange={(e) => set("type", e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {/* Particulars */}
          <div>
            <label className={labelClass} style={labelStyle}>
              Particulars <span style={{ color: "#e05252" }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Describe this expense…"
              value={form.particulars}
              onChange={(e) => set("particulars", e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {/* Date */}
          <div>
            <label className={labelClass} style={labelStyle}>
              Date <span style={{ color: "#e05252" }}>*</span>
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {/* Amounts row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Base Amount */}
            <div>
              <label className={labelClass} style={labelStyle}>
                Base Amount <span style={{ color: "#e05252" }}>*</span>
              </label>
              <div
                className="flex items-center rounded-xl overflow-hidden"
                style={{ border: "1px solid #E2E2E2" }}
              >
                <span className="px-3 py-2.5 text-sm shrink-0" style={{ color: "#8a8a8a", borderRight: "1px solid #E2E2E2", backgroundColor: "#faf7f5" }}>₹</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={form.base_amount}
                  onChange={(e) => set("base_amount", e.target.value)}
                  className="flex-1 min-w-0 text-sm px-3 py-2.5 outline-none bg-transparent"
                  style={{ color: "#525252" }}
                />
              </div>
            </div>

            {/* Tax Amount */}
            <div>
              <label className={labelClass} style={labelStyle}>
                Tax Amount <span style={{ color: "#8a8a8a" }}>(optional)</span>
              </label>
              <div
                className="flex items-center rounded-xl overflow-hidden"
                style={{ border: "1px solid #E2E2E2" }}
              >
                <span className="px-3 py-2.5 text-sm shrink-0" style={{ color: "#8a8a8a", borderRight: "1px solid #E2E2E2", backgroundColor: "#faf7f5" }}>₹</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={form.tax_amount}
                  onChange={(e) => set("tax_amount", e.target.value)}
                  className="flex-1 min-w-0 text-sm px-3 py-2.5 outline-none bg-transparent"
                  style={{ color: "#525252" }}
                />
              </div>
            </div>
          </div>

          {/* Total (read-only) */}
          <div
            className="flex items-center justify-between px-4 py-2.5 rounded-xl"
            style={{ backgroundColor: "#f9e8eb" }}
          >
            <span className="text-xs font-medium" style={{ color: "#d57282" }}>Total</span>
            <span className="text-sm font-bold" style={{ color: "#d57282" }}>{formatINR(total)}</span>
          </div>

          {/* Remarks */}
          <div>
            <label className={labelClass} style={labelStyle}>
              Remarks <span style={{ color: "#8a8a8a" }}>(optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Any additional notes…"
              value={form.remarks}
              onChange={(e) => set("remarks", e.target.value)}
              className="w-full text-sm rounded-xl px-3 py-2.5 outline-none resize-none placeholder:text-[#c0b8b8]"
              style={inputStyle}
            />
          </div>

          {/* Recurring toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              className="relative w-9 h-5 rounded-full transition-colors duration-150 shrink-0"
              style={{ backgroundColor: form.is_recurring ? "#d57282" : "#E2E2E2" }}
              onClick={() => set("is_recurring", !form.is_recurring)}
            >
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-150"
                style={{ left: form.is_recurring ? "calc(100% - 18px)" : "2px" }}
              />
            </div>
            <span className="text-sm" style={{ color: "#525252" }}>Mark as recurring expense</span>
          </label>

          {error && <p className="text-xs" style={{ color: "#e05252" }}>{error}</p>}
        </div>

        {/* Footer */}
        <div
          className="flex gap-2 px-6 py-4 shrink-0"
          style={{ borderTop: "1px solid #f0eae6" }}
        >
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ border: "1px solid #E2E2E2", color: "#525252", backgroundColor: "#ffffff" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={
              saving
                ? { backgroundColor: "#f0e8ea", color: "#c0a0a8", cursor: "not-allowed" }
                : { backgroundColor: "#d57282", color: "#ffffff", boxShadow: "0 4px 14px rgba(213,114,130,0.28)" }
            }
          >
            {saving ? "Saving…" : mode === "add" ? "Add Expense" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const defaultDateFrom = getDefaultDateFrom();
  const defaultDateTo = getDefaultDateTo();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [functionFilter, setFunctionFilter] = useState<ExpenseFunction | "">("");
  const [typeFilter, setTypeFilter] = useState("");
  const [debouncedType, setDebouncedType] = useState("");
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Expense | undefined>(undefined);

  // Delete confirm state — stores id of row pending confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // CSV export
  const [exporting, setExporting] = useState(false);

  const debounceSearch = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceType = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pageSize = 30;
  const totalPages = Math.ceil(total / pageSize);

  // Debounce search
  useEffect(() => {
    if (debounceSearch.current) clearTimeout(debounceSearch.current);
    debounceSearch.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => { if (debounceSearch.current) clearTimeout(debounceSearch.current); };
  }, [search]);

  // Debounce type filter
  useEffect(() => {
    if (debounceType.current) clearTimeout(debounceType.current);
    debounceType.current = setTimeout(() => {
      setDebouncedType(typeFilter);
      setPage(1);
    }, 300);
    return () => { if (debounceType.current) clearTimeout(debounceType.current); };
  }, [typeFilter]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [functionFilter, dateFrom, dateTo]);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (functionFilter)  params.set("function", functionFilter);
      if (debouncedType)   params.set("type", debouncedType);
      if (dateFrom)        params.set("date_from", dateFrom);
      if (dateTo)          params.set("date_to", dateTo);

      const res = await fetch(`/api/expenses?${params}`);
      const data: ExpensesResponse = await res.json();
      setExpenses(data.expenses ?? []);
      setTotal(data.total ?? 0);
      setSummary(data.summary ?? null);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, functionFilter, debouncedType, dateFrom, dateTo]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  function handleResetFilters() {
    setSearch("");
    setDebouncedSearch("");
    setFunctionFilter("");
    setTypeFilter("");
    setDebouncedType("");
    setDateFrom(defaultDateFrom);
    setDateTo(defaultDateTo);
    setPage(1);
  }

  function isFilterActive(): boolean {
    return (
      !!search ||
      !!functionFilter ||
      !!typeFilter ||
      dateFrom !== defaultDateFrom ||
      dateTo !== defaultDateTo
    );
  }

  async function handleDelete(id: number) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setDeleteConfirmId(null);
      fetchExpenses();
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
      if (functionFilter)  params.set("function", functionFilter);
      if (debouncedType)   params.set("type", debouncedType);
      if (dateFrom)        params.set("date_from", dateFrom);
      if (dateTo)          params.set("date_to", dateTo);

      const res = await fetch(`/api/expenses/export?${params}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `maeri_expenses_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const inputBase =
    "flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-white outline-none";
  const inputBorder = { border: "1px solid #E2E2E2" };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1
            className="text-xl font-semibold"
            style={{ color: "#525252", fontFamily: "var(--font-poppins), sans-serif" }}
          >
            Expenses
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#8a8a8a" }}>
            {loading ? "Loading…" : `${total} entries`}
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

          {/* Add Expense */}
          <button
            onClick={() => { setEditTarget(undefined); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-all"
            style={{
              borderRadius: 22,
              backgroundColor: "#d57282",
              color: "#ffffff",
              boxShadow: "0 4px 14px rgba(213,114,130,0.28)",
            }}
          >
            <Plus size={14} />
            Add Expense
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards
        summary={summary}
        entriesCount={total}
        loading={loading}
      />

      {/* Spend by Function */}
      {summary && summary.by_function.length > 0 && (
        <SpendByFunction byFunction={summary.by_function} />
      )}

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
            placeholder="Search particulars or remarks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-[#c0b8b8]"
            style={{ color: "#525252" }}
          />
          {search && (
            <button onClick={() => setSearch("")}>
              <X size={13} style={{ color: "#8a8a8a" }} />
            </button>
          )}
        </div>

        {/* Function dropdown */}
        <FunctionFilterDropdown
          value={functionFilter}
          onChange={setFunctionFilter}
        />

        {/* Type filter */}
        <div
          className={inputBase}
          style={{
            ...inputBorder,
            minWidth: 160,
            ...(typeFilter ? { border: "1px solid #d57282", backgroundColor: "#f9e8eb" } : {}),
          }}
        >
          <input
            type="text"
            placeholder="Filter by type…"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-[#c0b8b8]"
            style={{ color: typeFilter ? "#d57282" : "#525252" }}
          />
          {typeFilter && (
            <button onClick={() => setTypeFilter("")}>
              <X size={13} style={{ color: "#d57282" }} />
            </button>
          )}
        </div>

        {/* Date From */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs" style={{ color: "#8a8a8a" }}>From</span>
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
          <span className="text-xs" style={{ color: "#8a8a8a" }}>To</span>
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
            style={{ color: "#8a8a8a", border: "1px solid #E2E2E2", backgroundColor: "#ffffff" }}
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
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#faf7f5", borderBottom: "1px solid #f0eae6" }}>
                {["Date", "Function", "Type", "Particulars", "Base Amount", "Tax", "Total", "Rec.", "Remarks", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                      style={{ color: "#8a8a8a" }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows />
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Receipt size={32} style={{ color: "#E2E2E2" }} />
                      <p className="text-sm" style={{ color: "#8a8a8a" }}>
                        No expenses found. Add your first expense.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr
                    key={exp.id}
                    className="hover:bg-[#fffbf6] transition-colors"
                    style={{ borderBottom: "1px solid #f0eae6" }}
                  >
                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: "#525252" }}>
                      {formatDate(exp.expense_date)}
                    </td>

                    {/* Function */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <FunctionBadge fn={exp.function_name} />
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3 text-xs" style={{ color: "#525252" }}>
                      {exp.type || <span style={{ color: "#c0b8b8" }}>—</span>}
                    </td>

                    {/* Particulars */}
                    <td
                      className="px-4 py-3 text-xs max-w-[180px]"
                      style={{ color: "#525252" }}
                      title={exp.particulars}
                    >
                      {truncate(exp.particulars, 40)}
                    </td>

                    {/* Base Amount */}
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "#525252" }}>
                      {formatINR(exp.base_amount)}
                    </td>

                    {/* Tax */}
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "#8a8a8a" }}>
                      {exp.tax_amount > 0 ? formatINR(exp.tax_amount) : <span style={{ color: "#c0b8b8" }}>—</span>}
                    </td>

                    {/* Total */}
                    <td
                      className="px-4 py-3 text-xs font-semibold whitespace-nowrap"
                      style={{ color: "#525252" }}
                    >
                      {formatINR(exp.total_amount)}
                    </td>

                    {/* Recurring */}
                    <td className="px-4 py-3 text-center">
                      {exp.is_recurring && (
                        <RefreshCw size={13} style={{ color: "#d57282" }} />
                      )}
                    </td>

                    {/* Remarks */}
                    <td
                      className="px-4 py-3 text-xs max-w-[140px]"
                      style={{ color: "#8a8a8a" }}
                      title={exp.remarks ?? ""}
                    >
                      {exp.remarks ? truncate(exp.remarks, 30) : <span style={{ color: "#c0b8b8" }}>—</span>}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {deleteConfirmId === exp.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs" style={{ color: "#525252" }}>Delete?</span>
                          <button
                            onClick={() => handleDelete(exp.id)}
                            disabled={deleting}
                            className="text-xs font-semibold px-2 py-1 rounded-lg transition-colors"
                            style={{ backgroundColor: "#fff0f0", color: "#e05252" }}
                          >
                            {deleting ? "…" : "Yes"}
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-xs font-medium px-2 py-1 rounded-lg transition-colors"
                            style={{ backgroundColor: "#f5f5f5", color: "#525252" }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditTarget(exp); setShowModal(true); }}
                            className="p-1.5 rounded-lg hover:bg-[#f9e8eb] transition-colors"
                            aria-label="Edit expense"
                          >
                            <Pencil size={13} style={{ color: "#8a8a8a" }} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(exp.id)}
                            className="p-1.5 rounded-lg hover:bg-[#fff0f0] transition-colors"
                            aria-label="Delete expense"
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
            Page {page} of {totalPages} · {total} entries
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-all"
              style={
                page === 1
                  ? { border: "1px solid #E2E2E2", color: "#c0b8b8", backgroundColor: "#ffffff", cursor: "not-allowed" }
                  : { border: "1px solid #E2E2E2", color: "#525252", backgroundColor: "#ffffff" }
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
                  ? { border: "1px solid #E2E2E2", color: "#c0b8b8", backgroundColor: "#ffffff", cursor: "not-allowed" }
                  : { border: "1px solid #E2E2E2", color: "#525252", backgroundColor: "#ffffff" }
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
        <ExpenseModal
          mode={editTarget ? "edit" : "add"}
          initial={editTarget}
          onClose={() => { setShowModal(false); setEditTarget(undefined); }}
          onSaved={fetchExpenses}
        />
      )}
    </div>
  );
}
