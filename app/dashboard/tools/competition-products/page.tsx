"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  BarChart2,
  Loader2,
  X,
  ChevronDown,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ── Image Preview Modal ───────────────────────────────────────────────────────

function ImagePreview({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full"
          style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}
        >
          <X size={15} style={{ color: "#525252" }} />
        </button>
        <img
          src={src}
          alt={alt}
          className="w-full rounded-2xl object-contain"
          style={{ maxHeight: "80vh", boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}
        />
      </div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CompetitionProduct {
  id: number;
  company_name: string;
  product_title: string;
  product_type: string;
  tags: string;
  variant_title: string;
  price: number | null;
  compare_at_price: number | null;
  sku: string;
  available: boolean | null;
  description: string;
  image_urls: string;
  product_url: string;
  scraped_at: string;
}

interface FilterOptions {
  company_names: string[];
  product_types: string[];
}

interface AnalysisRow {
  company_name: string;
  product_type: string;
  variants: number;
  median_price: number;
  max_price: number;
  min_price: number;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_AVAILABLE = "true";

function isDefault(
  search: string,
  company: string,
  category: string,
  available: string,
  priceMin: string,
  priceMax: string
) {
  return (
    search === "" &&
    company === "" &&
    category === "" &&
    available === DEFAULT_AVAILABLE &&
    priceMin === "" &&
    priceMax === ""
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatINR(n: number | null) {
  if (n == null) return "—";
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function parseTags(tags: string): string[] {
  if (!tags) return [];
  return tags.split(",").map((t) => t.trim()).filter(Boolean);
}

function extractTCTags(description: string): string[] {
  if (!description) return [];
  const matches = description.matchAll(/(\d+)\s*(?:tc|thread\s*count)/gi);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const m of matches) {
    const label = `${m[1]} TC`;
    if (!seen.has(label)) { seen.add(label); result.push(label); }
  }
  return result;
}

function truncate(str: string, max: number) {
  if (!str) return "";
  return str.length <= max ? str : str.slice(0, max) + "…";
}

// ── Dropdown ──────────────────────────────────────────────────────────────────

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none w-full text-sm rounded-xl pl-3 pr-8 py-2 outline-none"
        style={{
          border: "1px solid #E2E2E2",
          color: value ? "#525252" : "#b0a8a8",
          backgroundColor: "#ffffff",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#b0a8a8" }} />
    </div>
  );
}

// ── Tag pills ─────────────────────────────────────────────────────────────────

function TagPills({ tags, tcTags }: { tags: string; tcTags?: string[] }) {
  const list = parseTags(tags);
  const shown = list.slice(0, 3);
  const extra = list.length - shown.length;
  if (!shown.length && !tcTags?.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {tcTags?.map((t) => (
        <span
          key={t}
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
          style={{ backgroundColor: "#e3f0fb", color: "#1565c0" }}
        >
          {t}
        </span>
      ))}
      {shown.map((t) => (
        <span
          key={t}
          className="text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap"
          style={{ backgroundColor: "#f5f0ed", color: "#8a8a8a" }}
        >
          {t}
        </span>
      ))}
      {extra > 0 && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#f5f0ed", color: "#b0a8a8" }}>
          +{extra}
        </span>
      )}
    </div>
  );
}

// ── Analysis Modal ───────────────────────────────────────────────────────────

function MultiSelect({
  selected,
  onChange,
  options,
  placeholder,
}: {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  options: string[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery(""); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const toggle = (val: string) => {
    const next = new Set(selected);
    if (next.has(val)) next.delete(val); else next.add(val);
    onChange(next);
  };

  const filtered = query
    ? options
        .map((o) => {
          const lower = o.toLowerCase();
          const words = query.toLowerCase().split(/\s+/).filter(Boolean);
          // Each query word must fuzzy-match somewhere in the option
          let score = 0;
          for (const w of words) {
            if (lower.includes(w)) { /* exact substring — best */ }
            else {
              // Fuzzy: every char in the word must appear in order
              let oi = 0;
              let matched = true;
              for (let ci = 0; ci < w.length; ci++) {
                oi = lower.indexOf(w[ci], oi);
                if (oi === -1) { matched = false; break; }
                oi++;
              }
              if (!matched) return null;
              score++;
            }
          }
          return { option: o, score };
        })
        .filter(Boolean)
        .sort((a, b) => a!.score - b!.score)
        .map((r) => r!.option)
    : options;

  const label = selected.size === 0
    ? placeholder
    : selected.size === 1
      ? [...selected][0]
      : `${selected.size} selected`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="appearance-none w-full text-sm rounded-xl pl-3 pr-8 py-2 outline-none text-left"
        style={{
          border: "1px solid #E2E2E2",
          color: selected.size ? "#525252" : "#b0a8a8",
          backgroundColor: "#ffffff",
        }}
      >
        {label}
      </button>
      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#b0a8a8" }} />
      {open && (
        <div
          className="absolute z-10 mt-1 w-64 rounded-xl overflow-hidden"
          style={{ backgroundColor: "#ffffff", border: "1px solid #E2E2E2", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}
        >
          <div className="px-2 pt-2 pb-1" style={{ borderBottom: "1px solid #f0eae6" }}>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#b0a8a8" }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search categories…"
                className="w-full text-xs rounded-lg pl-7 pr-2 py-1.5 outline-none placeholder:text-[#c0b8b8]"
                style={{ border: "1px solid #E2E2E2", color: "#525252", backgroundColor: "#faf7f5" }}
              />
            </div>
          </div>
          <div className="max-h-52 overflow-auto py-1">
          {filtered.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1" style={{ borderBottom: "1px solid #f0eae6" }}>
              {(() => {
                const allSelected = filtered.every((o) => selected.has(o));
                return (
                  <button
                    onClick={() => {
                      const next = new Set(selected);
                      if (allSelected) filtered.forEach((o) => next.delete(o));
                      else filtered.forEach((o) => next.add(o));
                      onChange(next);
                    }}
                    className="text-xs font-medium hover:underline"
                    style={{ color: "#d57282" }}
                  >
                    {allSelected ? "Deselect all" : "Select all"}{query ? " matches" : ""}
                  </button>
                );
              })()}
              {selected.size > 0 && (
                <button
                  onClick={() => { onChange(new Set()); setQuery(""); }}
                  className="text-xs font-medium hover:underline ml-auto"
                  style={{ color: "#8a8a8a" }}
                >
                  Clear
                </button>
              )}
            </div>
          )}
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs" style={{ color: "#b0a8a8" }}>No matches</p>
          ) : filtered.map((o) => (
            <label
              key={o}
              className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-[#f5f0ed]"
              style={{ color: "#525252" }}
            >
              <input
                type="checkbox"
                checked={selected.has(o)}
                onChange={() => toggle(o)}
                className="accent-[#d57282] rounded"
              />
              {o}
            </label>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AnalysisModal({
  rows,
  loading,
  onClose,
}: {
  rows: AnalysisRow[];
  loading: boolean;
  onClose: () => void;
}) {
  const [brandFilter, setBrandFilter] = useState("");
  const [catFilter, setCatFilter] = useState<Set<string>>(new Set());

  const brands = [...new Set(rows.map((r) => r.company_name))].sort();
  const afterBrand = brandFilter ? rows.filter((r) => r.company_name === brandFilter) : rows;
  const categories = [...new Set(afterBrand.map((r) => r.product_type).filter(Boolean))].sort();
  const filtered = catFilter.size > 0 ? afterBrand.filter((r) => catFilter.has(r.product_type)) : afterBrand;

  // Reset category selection when brand changes and selected cats are no longer valid
  useEffect(() => {
    setCatFilter((prev) => {
      const valid = new Set(categories);
      const next = new Set([...prev].filter((c) => valid.has(c)));
      return next.size === prev.size ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandFilter]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ backgroundColor: "#ffffff", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4" style={{ borderBottom: "1px solid #f0eae6" }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: "#525252" }}>Price Analysis</h2>
              <p className="text-xs mt-0.5" style={{ color: "#8a8a8a" }}>
                {loading ? "Loading…" : `${filtered.length} categor${filtered.length !== 1 ? "ies" : "y"} across ${brands.length} brand${brands.length !== 1 ? "s" : ""} (available variants only)`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f5f0ed] transition-colors"
            >
              <X size={15} style={{ color: "#525252" }} />
            </button>
          </div>
          {!loading && (
            <div className="flex flex-wrap gap-2 mt-3">
              {brands.length > 1 && (
                <div className="w-40 sm:w-44">
                  <FilterSelect value={brandFilter} onChange={setBrandFilter} options={brands} placeholder="All Brands" />
                </div>
              )}
              {categories.length > 1 && (
                <div className="w-44 sm:w-48">
                  <MultiSelect selected={catFilter} onChange={setCatFilter} options={categories} placeholder="All Categories" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={22} className="animate-spin" style={{ color: "#d57282" }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm" style={{ color: "#8a8a8a" }}>No data found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0" style={{ backgroundColor: "#faf7f5" }}>
                <tr style={{ borderBottom: "1px solid #f0eae6" }}>
                  {["Brand", "Category", "Variants", "Min Price", "Median Price", "Max Price"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "#8a8a8a" }}
                    >
                      {h === "Median Price" ? (
                        <span className="inline-flex items-center gap-1">
                          {h}
                          <Tooltip>
                            <TooltipTrigger render={<span />}>
                              <Info size={12} className="cursor-help" style={{ color: "#b0a8a8" }} />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs max-w-[220px] leading-relaxed">
                              The middle value when all prices are sorted low to high. Half the variants are priced below and half above this value.
                            </TooltipContent>
                          </Tooltip>
                        </span>
                      ) : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr
                    key={`${r.company_name}-${r.product_type}-${i}`}
                    style={{ borderBottom: "1px solid #f5f5f5" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#fffbf6")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "")}
                  >
                    <td className="px-4 py-2.5">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ backgroundColor: "#f9e8eb", color: "#d57282" }}
                      >
                        {r.company_name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "#525252" }}>{r.product_type || "—"}</td>
                    <td className="px-4 py-2.5 font-medium" style={{ color: "#525252" }}>{r.variants}</td>
                    <td className="px-4 py-2.5" style={{ color: "#525252" }}>{formatINR(r.min_price)}</td>
                    <td className="px-4 py-2.5 font-semibold" style={{ color: "#d57282" }}>{formatINR(r.median_price)}</td>
                    <td className="px-4 py-2.5" style={{ color: "#525252" }}>{formatINR(r.max_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CompetitionProductsPage() {
  const [products, setProducts]           = useState<CompetitionProduct[]>([]);
  const [total, setTotal]                 = useState(0);
  const [page, setPage]                   = useState(1);
  const [loading, setLoading]             = useState(true);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ company_names: [], product_types: [] });
  const [preview, setPreview]             = useState<{ src: string; alt: string } | null>(null);
  const [analysisOpen, setAnalysisOpen]   = useState(false);
  const [analysisData, setAnalysisData]   = useState<AnalysisRow[]>([]);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // Filters
  const [search,    setSearch]    = useState("");
  const [company,   setCompany]   = useState("");
  const [category,  setCategory]  = useState("");
  const [available, setAvailable] = useState(DEFAULT_AVAILABLE);
  const [priceMin,  setPriceMin]  = useState("");
  const [priceMax,  setPriceMax]  = useState("");

  const searchRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PAGE_SIZE  = 50;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetchProducts = useCallback(async (
    pg: number,
    srch: string,
    co: string,
    cat: string,
    avail: string,
    pMin: string,
    pMax: string
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pg) });
      if (srch)  params.set("search", srch);
      if (co)    params.set("company_name", co);
      if (cat)   params.set("product_type", cat);
      if (avail) params.set("available", avail);
      if (pMin)  params.set("price_min", pMin);
      if (pMax)  params.set("price_max", pMax);

      const res  = await fetch(`/api/competition-products?${params}`);
      const json = await res.json();

      setProducts(json.products ?? []);
      setTotal(json.total ?? 0);
      if (json.filter_options) {
        setFilterOptions(json.filter_options);
        // Reset category if no longer valid for the selected brand
        setCategory((prev) =>
          prev && !(json.filter_options.product_types as string[]).includes(prev) ? "" : prev
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setPage(1);
      fetchProducts(1, search, company, category, available, priceMin, priceMax);
    }, 350);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Immediate re-fetch on filter changes
  useEffect(() => {
    setPage(1);
    fetchProducts(1, search, company, category, available, priceMin, priceMax);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, category, available, priceMin, priceMax]);

  // Page changes
  useEffect(() => {
    fetchProducts(page, search, company, category, available, priceMin, priceMax);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleReset = () => {
    setSearch(""); setCompany(""); setCategory("");
    setAvailable(DEFAULT_AVAILABLE); setPriceMin(""); setPriceMax("");
    setPage(1);
  };

  const openAnalysis = async () => {
    setAnalysisOpen(true);
    setAnalysisLoading(true);
    try {
      const res = await fetch("/api/competition-products/analysis");
      const json = await res.json();
      setAnalysisData(json.analysis ?? []);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const showReset = !isDefault(search, company, category, available, priceMin, priceMax);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "#525252", fontFamily: "var(--font-poppins), sans-serif" }}>
            Competition Products
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#8a8a8a" }}>
            {loading ? "Loading…" : `${total.toLocaleString()} variant${total !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={openAnalysis}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all"
          style={{
            backgroundColor: "#d57282",
            color: "#ffffff",
            boxShadow: "0 4px 14px rgba(213,114,130,0.28)",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#ce5a56")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#d57282")}
        >
          <BarChart2 size={15} />
          Analysis
        </button>
      </div>

      {/* Filter bar */}
      <div
        className="rounded-2xl px-5 py-4"
        style={{ backgroundColor: "#ffffff", border: "1px solid #E2E2E2", boxShadow: "0 2px 16px rgba(213,114,130,0.07)" }}
      >
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#b0a8a8" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product, variant, tag, SKU…"
              className="w-full text-sm rounded-xl pl-9 pr-3 py-2 outline-none placeholder:text-[#c0b8b8]"
              style={{ border: "1px solid #E2E2E2", color: "#525252", backgroundColor: "#ffffff" }}
            />
          </div>

          {/* Company */}
          <div className="w-44">
            <FilterSelect value={company} onChange={setCompany} options={filterOptions.company_names} placeholder="All Brands" />
          </div>

          {/* Category */}
          <div className="w-44">
            <FilterSelect value={category} onChange={setCategory} options={filterOptions.product_types} placeholder="All Categories" />
          </div>

          {/* Available toggle */}
          <div className="relative">
            <select
              value={available}
              onChange={(e) => setAvailable(e.target.value)}
              className="appearance-none text-sm rounded-xl pl-3 pr-8 py-2 outline-none"
              style={{ border: "1px solid #E2E2E2", color: "#525252", backgroundColor: "#ffffff" }}
            >
              <option value="true">Available only</option>
              <option value="false">Unavailable only</option>
              <option value="all">All</option>
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#b0a8a8" }} />
          </div>

          {/* Price range */}
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
              placeholder="Min ₹"
              className="w-24 text-sm rounded-xl px-3 py-2 outline-none placeholder:text-[#c0b8b8]"
              style={{ border: "1px solid #E2E2E2", color: "#525252", backgroundColor: "#ffffff" }}
            />
            <span style={{ color: "#c0b8b8", fontSize: 12 }}>–</span>
            <input
              type="number"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              placeholder="Max ₹"
              className="w-24 text-sm rounded-xl px-3 py-2 outline-none placeholder:text-[#c0b8b8]"
              style={{ border: "1px solid #E2E2E2", color: "#525252", backgroundColor: "#ffffff" }}
            />
          </div>

          {showReset && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors hover:bg-[#f5f0ed]"
              style={{ color: "#d57282" }}
            >
              <X size={13} /> Reset
            </button>
          )}
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
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#f9e8eb" }}>
              <BarChart2 size={20} style={{ color: "#d57282" }} />
            </div>
            <p className="text-sm font-medium" style={{ color: "#525252" }}>No products found</p>
            <p className="text-xs" style={{ color: "#8a8a8a" }}>Try adjusting your filters or scrape data from Competition Brands</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <div style={{ minWidth: "700px" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #f0eae6" }}>
                  {[
                    { label: "Product",  cls: "" },
                    { label: "Brand / Category", cls: "w-40" },
                    { label: "Price",    cls: "w-32" },
                    { label: "Status",   cls: "w-24" },
                    { label: "",         cls: "w-10" },
                  ].map(({ label, cls }) => (
                    <th key={label} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide ${cls}`} style={{ color: "#8a8a8a" }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr
                    key={p.id}
                    style={{ borderBottom: "1px solid #f5f5f5" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#fffbf6")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "")}
                  >
                    {/* Product column */}
                    <td className="px-4 py-3.5 max-w-sm">
                      <div className="flex items-start gap-3">
                        {/* Thumbnail */}
                        <div
                          className="shrink-0 w-[72px] h-[72px] rounded-xl overflow-hidden"
                          style={{ backgroundColor: "#f5f0ed", border: "1px solid #E2E2E2", cursor: p.image_urls ? "zoom-in" : "default" }}
                          onClick={() => {
                            if (p.image_urls) setPreview({ src: p.image_urls.split(" | ")[0], alt: p.product_title });
                          }}
                        >
                          {p.image_urls ? (
                            <img
                              src={p.image_urls.split(" | ")[0]}
                              alt={p.product_title}
                              className="w-full h-full object-cover transition-opacity hover:opacity-80"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <BarChart2 size={14} style={{ color: "#c0b8b8" }} />
                            </div>
                          )}
                        </div>
                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium leading-snug" style={{ color: "#525252" }}>
                            {p.product_title || "—"}
                          </p>
                          {p.variant_title && (
                            <p className="text-xs mt-0.5" style={{ color: "#8a8a8a" }}>{p.variant_title}</p>
                          )}
                          {p.description && (
                            <Tooltip>
                              <TooltipTrigger render={<span />}>
                                <p className="text-xs mt-1 leading-relaxed cursor-default" style={{ color: "#b0a8a8" }}>
                                  {truncate(p.description, 110)}
                                </p>
                              </TooltipTrigger>
                              <TooltipContent
                                side="right"
                                className="text-xs leading-relaxed whitespace-pre-wrap"
                                style={{ maxWidth: 480 }}
                              >
                                {p.description}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <TagPills tags={p.tags} tcTags={extractTCTags(p.description)} />
                        </div>
                      </div>
                    </td>

                    {/* Brand / Category */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1.5">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full w-fit whitespace-nowrap"
                          style={{ backgroundColor: "#f9e8eb", color: "#d57282" }}
                        >
                          {p.company_name}
                        </span>
                        {p.product_type && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full w-fit whitespace-nowrap"
                            style={{ backgroundColor: "#f0f0f0", color: "#8a8a8a" }}
                          >
                            {p.product_type}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3.5">
                      <p className="font-semibold" style={{ color: "#525252" }}>
                        {formatINR(p.price)}
                      </p>
                      {p.compare_at_price && p.compare_at_price > (p.price ?? 0) && (
                        <p className="text-xs mt-0.5 line-through" style={{ color: "#b0a8a8" }}>
                          {formatINR(p.compare_at_price)}
                        </p>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      {p.available === true && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}>
                          Available
                        </span>
                      )}
                      {p.available === false && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "#fdecea", color: "#c62828" }}>
                          Sold out
                        </span>
                      )}
                      {p.available == null && (
                        <span style={{ color: "#c0b8b8" }}>—</span>
                      )}
                    </td>

                    {/* Link */}
                    <td className="px-4 py-3.5">
                      {p.product_url && (
                        <a
                          href={p.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f5f0ed] transition-colors"
                          style={{ color: "#8a8a8a" }}
                          title="Open product"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div
                className="flex items-center justify-between px-5 py-3"
                style={{ borderTop: "1px solid #f0eae6" }}
              >
                <p className="text-xs" style={{ color: "#8a8a8a" }}>
                  Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-[#f5f0ed] disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ color: "#525252" }}
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span className="text-xs px-2" style={{ color: "#525252" }}>
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-[#f5f0ed] disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ color: "#525252" }}
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {preview && (
        <ImagePreview src={preview.src} alt={preview.alt} onClose={() => setPreview(null)} />
      )}

      {analysisOpen && (
        <AnalysisModal
          rows={analysisData}
          loading={analysisLoading}
          onClose={() => setAnalysisOpen(false)}
        />
      )}
    </div>
  );
}
