"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightSm,
  Package,
  X,
  AlertTriangle,
} from "lucide-react";

// ---- Types ----

interface Variant {
  variant_id: string;
  title: string;
  price: number;
  sku: string;
  inventory_quantity: number;
}

interface Product {
  product_id: string;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  tags: string;
  status: string;
  total_inventory: number;
  total_variants: number;
  image_url: string;
  synced_at: string;
  product_variants: Variant[];
}

// ---- Helpers ----

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

function StockBadge({ qty }: { qty: number }) {
  if (qty === 0) {
    return (
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded-full"
        style={{ backgroundColor: "#fff0f0", color: "#e05252" }}
      >
        Out of stock
      </span>
    );
  }
  if (qty < 5) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
        style={{ backgroundColor: "#fff3e8", color: "#d4600a" }}
      >
        <AlertTriangle size={10} />
        Low · {qty}
      </span>
    );
  }
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ backgroundColor: "#f0faf4", color: "#27a559" }}
    >
      {qty} in stock
    </span>
  );
}

// ---- Product Row ----

function ProductRow({ product }: { product: Product }) {
  const [expanded, setExpanded] = useState(false);
  const hasMultipleVariants =
    product.product_variants.length > 1 ||
    (product.product_variants.length === 1 &&
      product.product_variants[0].title !== "Default Title");
  const isExpandable = hasMultipleVariants;

  // For single-variant products, show that variant's price/sku directly
  const singleVariant =
    product.product_variants.length === 1 ? product.product_variants[0] : null;
  const priceDisplay = singleVariant
    ? formatPrice(singleVariant.price)
    : product.product_variants.length > 0
    ? `${formatPrice(Math.min(...product.product_variants.map((v) => v.price)))} – ${formatPrice(Math.max(...product.product_variants.map((v) => v.price)))}`
    : "—";
  const skuDisplay = singleVariant?.sku || "—";

  return (
    <>
      <div
        className={`grid items-center px-5 py-3.5 transition-colors duration-100 ${
          isExpandable ? "cursor-pointer hover:bg-[#fffbf6]" : "hover:bg-[#fffbf6]"
        }`}
        style={{ gridTemplateColumns: "44px 1fr 160px 100px 80px 110px 32px" }}
        onClick={() => isExpandable && setExpanded((e) => !e)}
      >
        {/* Image */}
        <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0" style={{ backgroundColor: "#f9e8eb" }}>
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package size={14} style={{ color: "#d57282" }} />
            </div>
          )}
        </div>

        {/* Title + meta */}
        <div className="min-w-0 px-3">
          <p className="text-sm font-medium truncate" style={{ color: "#525252" }}>
            {product.title}
          </p>
          <p className="text-xs truncate" style={{ color: "#8a8a8a" }}>
            {[product.vendor, product.product_type].filter(Boolean).join(" · ")}
          </p>
        </div>

        {/* SKU */}
        <div className="text-xs font-mono truncate" style={{ color: "#8a8a8a" }}>
          {skuDisplay}
        </div>

        {/* Price */}
        <div className="text-sm font-medium" style={{ color: "#525252" }}>
          {priceDisplay}
        </div>

        {/* Stock */}
        <div>
          <StockBadge qty={product.total_inventory} />
        </div>

        {/* Variants count */}
        <div className="text-xs" style={{ color: "#8a8a8a" }}>
          {product.total_variants > 1 ? `${product.total_variants} variants` : ""}
        </div>

        {/* Expand toggle */}
        <div className="flex justify-center">
          {isExpandable ? (
            expanded ? (
              <ChevronDown size={15} style={{ color: "#8a8a8a" }} />
            ) : (
              <ChevronRightSm size={15} style={{ color: "#8a8a8a" }} />
            )
          ) : null}
        </div>
      </div>

      {/* Expanded variants */}
      {expanded && isExpandable && (
        <div style={{ backgroundColor: "#fffbf6", borderTop: "1px solid #f0eae6" }}>
          {product.product_variants.map((v) => (
            <div
              key={v.variant_id}
              className="grid items-center px-5 py-2.5"
              style={{ gridTemplateColumns: "44px 1fr 160px 100px 80px 110px 32px" }}
            >
              {/* Indent spacer */}
              <div />
              {/* Variant title */}
              <div className="px-3">
                <p className="text-xs font-medium" style={{ color: "#8a8a8a" }}>
                  {v.title}
                </p>
              </div>
              {/* SKU */}
              <div className="text-xs font-mono" style={{ color: "#b8a0a0" }}>
                {v.sku || "—"}
              </div>
              {/* Price */}
              <div className="text-xs font-medium" style={{ color: "#525252" }}>
                {formatPrice(v.price)}
              </div>
              {/* Stock */}
              <div>
                <StockBadge qty={v.inventory_quantity} />
              </div>
              <div />
              <div />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ---- Page ----

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [stockStatus, setStockStatus] = useState<"" | "in_stock" | "out_of_stock">("");

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageSize = 40;
  const totalPages = Math.ceil(total / pageSize);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [search]);

  useEffect(() => { setPage(1); }, [lowStock, stockStatus]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      search: debouncedSearch,
      low_stock: String(lowStock),
      stock_status: stockStatus,
    });
    const res = await fetch(`/api/products?${params}`);
    const data = await res.json();
    setProducts(data.products ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [page, debouncedSearch, lowStock, stockStatus]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1
          className="text-xl font-semibold"
          style={{ color: "#525252", fontFamily: "var(--font-poppins), sans-serif" }}
        >
          Inventory
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "#8a8a8a" }}>
          {total > 0 ? `${total} active products` : "Loading…"}
        </p>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-[220px] max-w-sm"
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
          {search && (
            <button onClick={() => setSearch("")}>
              <X size={13} style={{ color: "#8a8a8a" }} />
            </button>
          )}
        </div>

        {/* In stock / Out of stock toggle */}
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

        {/* Low stock toggle */}
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

        {/* Clear */}
        {(search || lowStock || stockStatus) && (
          <button
            onClick={() => { setSearch(""); setLowStock(false); setStockStatus(""); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm"
            style={{ color: "#8a8a8a", border: "1px solid #E2E2E2", backgroundColor: "#ffffff" }}
          >
            <X size={13} />
            Clear
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
        {/* Header */}
        <div
          className="grid text-xs font-semibold uppercase tracking-wide px-5 py-3"
          style={{
            gridTemplateColumns: "44px 1fr 160px 100px 80px 110px 32px",
            borderBottom: "1px solid #f0eae6",
            color: "#8a8a8a",
          }}
        >
          <span />
          <span className="px-3">Product</span>
          <span>SKU</span>
          <span>Price</span>
          <span>Stock</span>
          <span>Variants</span>
          <span />
        </div>

        {/* Rows */}
        {loading ? (
          <div className="py-16 flex flex-col items-center gap-3" style={{ color: "#8a8a8a" }}>
            <div
              className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor: "#d57282", borderTopColor: "transparent" }}
            />
            <p className="text-sm">Loading inventory…</p>
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2" style={{ color: "#8a8a8a" }}>
            <Package size={32} style={{ opacity: 0.3 }} />
            <p className="text-sm">No products found</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "#f0eae6" }}>
            {products.map((product) => (
              <ProductRow key={product.product_id} product={product} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="flex items-center justify-between px-5 py-3.5 text-sm"
            style={{ borderTop: "1px solid #f0eae6" }}
          >
            <span style={{ color: "#8a8a8a" }}>
              Page {page} of {totalPages} · {total} products
            </span>
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
