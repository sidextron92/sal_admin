"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Eye,
  Smartphone,
  Monitor,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface Visualization {
  id: string;
  created_at: string;
  product_id: number;
  product_title: string;
  product_handle: string;
  product_type: string;
  product_price: number;
  variant_id: number;
  shop_domain: string;
  customer_id: number | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  user_agent: string | null;
  room_image_url: string | null;
  generated_image_url: string | null;
  product_image_url: string | null;
}

interface VisualizationsResponse {
  visualizations: Visualization[];
  total: number;
  page: number;
  pageSize: number;
  product_types: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatPrice(paisa: number): string {
  const rupees = paisa / 100;
  return "₹" + rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "yesterday";
  if (diffDay < 30) return `${diffDay} days ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${Math.floor(diffMonth / 12)}y ago`;
}

function parseDevice(userAgent: string | null): { label: string; icon: "mobile" | "desktop" } {
  if (!userAgent) return { label: "Unknown", icon: "desktop" };
  const ua = userAgent.toLowerCase();
  if (ua.includes("iphone") || ua.includes("ipad")) return { label: "iPhone", icon: "mobile" };
  if (ua.includes("android")) return { label: "Android", icon: "mobile" };
  if (ua.includes("mobile")) return { label: "Mobile", icon: "mobile" };
  return { label: "Desktop", icon: "desktop" };
}

function getProductTypeBadge(type: string): { background: string; color: string } {
  const normalized = type.toLowerCase();
  if (normalized === "bedsheet") return { background: "#f9e8eb", color: "#d57282" };
  if (normalized === "comforter") return { background: "#e8f5ff", color: "#1a8fde" };
  if (normalized === "towel") return { background: "#f0faf4", color: "#27a559" };
  if (normalized === "bedcovers") return { background: "#fff3e8", color: "#d4600a" };
  return { background: "#f5f0ed", color: "#8a8a8a" };
}

function getDefaultDateFrom(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
}

function getDefaultDateTo(): string {
  return new Date().toISOString().split("T")[0];
}

// ── Image Preview Modal ────────────────────────────────────────────────────

interface PreviewModalProps {
  src: string;
  alt: string;
  onClose: () => void;
}

function ImagePreviewModal({ src, alt, onClose }: PreviewModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(0,0,0,0.80)" }}
      onClick={onClose}
    >
      <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          aria-label="Close preview"
          className="absolute -top-3 -right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full"
          style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 8px rgba(0,0,0,0.22)" }}
        >
          <X size={15} style={{ color: "#525252" }} />
        </button>
        <img
          src={src}
          alt={alt}
          className="w-full rounded-2xl object-contain"
          style={{ maxHeight: "82vh", boxShadow: "0 8px 40px rgba(0,0,0,0.45)" }}
        />
      </div>
    </div>
  );
}

// ── Skeleton Card ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "#fff",
        border: "1px solid #E2E2E2",
        boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
      }}
    >
      {/* 3-col image strip */}
      <div className="grid grid-cols-3" style={{ borderBottom: "1px solid #f0eae6" }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-36 flex flex-col items-center justify-center" style={{ background: "#ede8e5", borderRight: i < 2 ? "1px solid #f0eae6" : undefined }}>
            <div className="w-6 h-6 rounded-lg mb-1" style={{ background: "#e0d8d4" }} />
            <div className="w-10 h-2 rounded" style={{ background: "#e0d8d4" }} />
          </div>
        ))}
      </div>
      <div className="p-4 space-y-2">
        <div className="h-4 rounded-lg w-3/4" style={{ background: "#f0eae6" }} />
        <div className="h-3 rounded-lg w-1/3" style={{ background: "#f5f0ed" }} />
        <div className="h-3 rounded-lg w-1/2" style={{ background: "#f5f0ed" }} />
      </div>
    </div>
  );
}

// ── Image Thumbnail ────────────────────────────────────────────────────────

interface ImageThumbnailProps {
  url: string | null;
  label: string;
  onPreview: (src: string) => void;
}

function ImageThumbnail({ url, label, onPreview }: ImageThumbnailProps) {
  const [errored, setErrored] = useState(false);

  return (
    <div className="flex flex-col">
      {/* Label */}
      <div
        className="text-center py-1"
        style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "#b8a0a0", background: "#faf7f5" }}
      >
        {label}
      </div>
      {/* Image */}
      {!url || errored ? (
        <div
          className="h-32 flex flex-col items-center justify-center gap-1"
          style={{ background: "#f5f0ed" }}
        >
          <ImageIcon size={18} style={{ color: "#b8a0a0" }} />
          <span style={{ fontSize: 10, color: "#c4b0b0" }}>No image</span>
        </div>
      ) : (
        <button
          onClick={() => onPreview(url)}
          className="relative overflow-hidden group h-32"
          aria-label={`Preview ${label}`}
        >
          <img
            src={url}
            alt={label}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            onError={() => setErrored(true)}
          />
          <div
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            style={{ background: "rgba(0,0,0,0.32)" }}
          >
            <Eye size={16} style={{ color: "#fff" }} />
          </div>
        </button>
      )}
    </div>
  );
}

// ── Visualization Card ─────────────────────────────────────────────────────

interface VisualizationCardProps {
  item: Visualization;
  onPreview: (src: string) => void;
}

function VisualizationCard({ item, onPreview }: VisualizationCardProps) {
  const typeBadgeStyle = getProductTypeBadge(item.product_type);
  const device = parseDevice(item.user_agent);
  const hasUtm = item.utm_source || item.utm_campaign;

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: "#fff",
        border: "1px solid #E2E2E2",
        boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
      }}
    >
      {/* Images — 3 columns: Product → Room → Result */}
      <div className="grid grid-cols-3" style={{ borderBottom: "1px solid #f0eae6" }}>
        <div style={{ borderRight: "1px solid #f0eae6" }}>
          <ImageThumbnail url={item.product_image_url} label="Product" onPreview={onPreview} />
        </div>
        <div style={{ borderRight: "1px solid #f0eae6" }}>
          <ImageThumbnail url={item.room_image_url} label="Room" onPreview={onPreview} />
        </div>
        <div>
          <ImageThumbnail url={item.generated_image_url} label="Result" onPreview={onPreview} />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 p-4 flex-1">
        {/* Product title + type badge */}
        <div className="flex items-start gap-2">
          <p
            className="flex-1 min-w-0 truncate"
            style={{ fontSize: 14, fontWeight: 600, color: "#525252" }}
            title={item.product_title}
          >
            {item.product_title}
          </p>
          <span
            className="shrink-0 rounded-full px-2 py-0.5"
            style={{
              fontSize: 11,
              fontWeight: 600,
              ...typeBadgeStyle,
            }}
          >
            {item.product_type}
          </span>
        </div>

        {/* Price */}
        <p style={{ fontSize: 13, fontWeight: 500, color: "#d57282" }}>
          {formatPrice(item.product_price)}
        </p>

        {/* UTM info */}
        {hasUtm && (
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            {item.utm_source && (
              <span
                className="rounded-full px-2 py-0.5"
                style={{ fontSize: 11, background: "#f5f0ed", color: "#8a8a8a" }}
              >
                {item.utm_source}
              </span>
            )}
            {item.utm_campaign && (
              <span
                className="rounded-full px-2 py-0.5 max-w-[140px] truncate"
                style={{ fontSize: 11, background: "#f5f0ed", color: "#8a8a8a" }}
                title={item.utm_campaign}
              >
                {item.utm_campaign}
              </span>
            )}
          </div>
        )}

        {/* Footer: device + time */}
        <div className="flex items-center justify-between mt-auto pt-2" style={{ borderTop: "1px solid #f0eae6" }}>
          <div className="flex items-center gap-1">
            {device.icon === "mobile" ? (
              <Smartphone size={13} style={{ color: "#b8a0a0" }} />
            ) : (
              <Monitor size={13} style={{ color: "#b8a0a0" }} />
            )}
            <span style={{ fontSize: 12, color: "#b8a0a0" }}>{device.label}</span>
          </div>
          <span style={{ fontSize: 12, color: "#b8a0a0" }}>
            {formatRelativeTime(item.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Dropdown ──────────────────────────────────────────────────────────────

interface DropdownProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}

function Dropdown({ value, onChange, options, placeholder }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center justify-between gap-2 w-full"
        style={{
          background: "#fafafa",
          border: "1px solid #E2E2E2",
          borderRadius: 12,
          padding: "9px 14px",
          fontSize: 14,
          color: selected ? "#525252" : "#c0b8b8",
          cursor: "pointer",
          minWidth: 160,
          whiteSpace: "nowrap",
        }}
      >
        <span>{selected ? selected.label : placeholder}</span>
        <ChevronDown
          size={14}
          style={{
            color: "#8a8a8a",
            transition: "transform 150ms",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 mt-1 z-20 min-w-full"
          style={{
            background: "#fff",
            border: "1px solid #E2E2E2",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
            overflow: "hidden",
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full text-left"
              style={{
                padding: "8px 14px",
                fontSize: 14,
                color: opt.value === value ? "#d57282" : "#525252",
                fontWeight: opt.value === value ? 600 : 400,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                display: "block",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f9e8eb")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function VisualizerPage() {
  const defaultDateFrom = getDefaultDateFrom();
  const defaultDateTo = getDefaultDateTo();

  const [visualizations, setVisualizations] = useState<Visualization[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [productTypes, setProductTypes] = useState<string[]>([]);

  const [search, setSearch] = useState("");
  const [productType, setProductType] = useState("");
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);

  const [loading, setLoading] = useState(true);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const isDefault =
    debouncedSearch === "" &&
    productType === "" &&
    dateFrom === defaultDateFrom &&
    dateTo === defaultDateTo;

  // Debounce search
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [search]);

  // Reset page on filter changes
  useEffect(() => { setPage(1); }, [productType, dateFrom, dateTo]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (productType) params.set("product_type", productType);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      const res = await fetch(`/api/visualizations?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch visualizations");
      const data: VisualizationsResponse = await res.json();

      setVisualizations(data.visualizations);
      setTotal(data.total);
      setPageSize(data.pageSize);
      if (data.product_types?.length) {
        setProductTypes(data.product_types);
      }
    } catch {
      setVisualizations([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, productType, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleReset = () => {
    setSearch("");
    setDebouncedSearch("");
    setProductType("");
    setDateFrom(defaultDateFrom);
    setDateTo(defaultDateTo);
    setPage(1);
  };

  const totalPages = Math.ceil(total / pageSize);
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  const typeOptions = [
    { value: "", label: "All Types" },
    ...productTypes.map((t) => ({ value: t, label: t })),
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "#525252", fontFamily: "var(--font-poppins), sans-serif" }}>
            Visualizer Plugin
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#8a8a8a" }}>
            {loading ? "Loading\u2026" : `${total.toLocaleString("en-IN")} record${total !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div
        className="rounded-2xl px-5 py-4"
        style={{
          background: "#fff",
          border: "1px solid #E2E2E2",
          boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
        }}
      >
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "#b8a0a0" }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product, UTM source, campaign…"
              style={{
                width: "100%",
                background: "#fafafa",
                border: "1px solid #E2E2E2",
                borderRadius: 12,
                padding: "9px 14px 9px 36px",
                fontSize: 14,
                color: "#525252",
                outline: "none",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#d57282";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(213,114,130,0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#E2E2E2";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          {/* Product type dropdown */}
          <Dropdown
            value={productType}
            onChange={(v) => { setProductType(v); setPage(1); }}
            options={typeOptions}
            placeholder="All Types"
          />

          {/* Date From */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 10,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.065em",
                color: "#8a8a8a",
                marginBottom: 4,
              }}
            >
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              style={{
                background: "#fafafa",
                border: "1px solid #E2E2E2",
                borderRadius: 12,
                padding: "9px 12px",
                fontSize: 13,
                color: "#525252",
                outline: "none",
                cursor: "pointer",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#d57282";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(213,114,130,0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#E2E2E2";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          {/* Date To */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 10,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.065em",
                color: "#8a8a8a",
                marginBottom: 4,
              }}
            >
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              style={{
                background: "#fafafa",
                border: "1px solid #E2E2E2",
                borderRadius: 12,
                padding: "9px 12px",
                fontSize: 13,
                color: "#525252",
                outline: "none",
                cursor: "pointer",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#d57282";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(213,114,130,0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#E2E2E2";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          {/* Reset button */}
          {!isDefault && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5"
              style={{
                background: "#fff",
                border: "1px solid #E2E2E2",
                borderRadius: 12,
                padding: "9px 14px",
                fontSize: 13,
                fontWeight: 500,
                color: "#8a8a8a",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f9e8eb")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
            >
              <X size={13} />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Card grid / Loading / Empty */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : visualizations.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20"
          style={{
            background: "#fff",
            border: "1px solid #E2E2E2",
            borderRadius: 18,
            boxShadow: "0 2px 16px rgba(213,114,130,0.07)",
          }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: "#f9e8eb" }}
          >
            <ImageIcon size={22} style={{ color: "#d57282" }} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#525252" }}>
            No visualizations found
          </p>
          <p style={{ fontSize: 13, color: "#8a8a8a", marginTop: 4 }}>
            {isDefault
              ? "No records have been captured yet."
              : "Try adjusting your filters or search query."}
          </p>
          {!isDefault && (
            <button
              onClick={handleReset}
              className="mt-4"
              style={{
                background: "#d57282",
                color: "#fff",
                borderRadius: 22,
                padding: "9px 20px",
                fontSize: 13,
                fontWeight: 600,
                border: "none",
                boxShadow: "0 4px 14px rgba(213,114,130,0.28)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#ce5a56";
                e.currentTarget.style.boxShadow = "0 6px 18px rgba(206,90,86,0.35)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#d57282";
                e.currentTarget.style.boxShadow = "0 4px 14px rgba(213,114,130,0.28)";
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visualizations.map((item) => (
            <VisualizationCard
              key={item.id}
              item={item}
              onPreview={(src) => setPreviewSrc(src)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && total > pageSize && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p style={{ fontSize: 13, color: "#8a8a8a" }}>
            Showing{" "}
            <span style={{ fontWeight: 600, color: "#525252" }}>
              {rangeStart}–{rangeEnd}
            </span>{" "}
            of{" "}
            <span style={{ fontWeight: 600, color: "#525252" }}>
              {total.toLocaleString("en-IN")}
            </span>{" "}
            records
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Previous page"
              className="flex items-center gap-1"
              style={{
                background: "#fff",
                border: "1px solid #E2E2E2",
                borderRadius: 12,
                padding: "7px 14px",
                fontSize: 13,
                fontWeight: 500,
                color: page === 1 ? "#c0b8b8" : "#525252",
                cursor: page === 1 ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (page !== 1) e.currentTarget.style.background = "#f9e8eb";
              }}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
            >
              <ChevronLeft size={14} />
              Prev
            </button>
            <span
              className="rounded-xl px-3 py-1.5"
              style={{
                fontSize: 13,
                fontWeight: 600,
                background: "#f9e8eb",
                color: "#d57282",
              }}
            >
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              aria-label="Next page"
              className="flex items-center gap-1"
              style={{
                background: "#fff",
                border: "1px solid #E2E2E2",
                borderRadius: 12,
                padding: "7px 14px",
                fontSize: 13,
                fontWeight: 500,
                color: page === totalPages ? "#c0b8b8" : "#525252",
                cursor: page === totalPages ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (page !== totalPages) e.currentTarget.style.background = "#f9e8eb";
              }}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewSrc && (
        <ImagePreviewModal
          src={previewSrc}
          alt="Visualization preview"
          onClose={() => setPreviewSrc(null)}
        />
      )}
    </div>
  );
}
