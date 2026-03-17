"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Package,
  Truck,
  X,
} from "lucide-react";

// ---- Types ----

interface LineItem {
  title: string;
  quantity: number;
  discounted_unit_price: number;
  variant_title: string;
}

interface Order {
  order_id: string;
  order_name: string;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_city: string | null;
  customer_state: string | null;
  total_price: number;
  currency: string;
  financial_status: string;
  fulfillment_status: string;
  sr_status: string | null;
  payment_method: string | null;
  awb_code: string | null;
  courier_name: string | null;
  etd: string | null;
  cancelled_at: string | null;
  customer_order_index: number | null;
  order_line_items: LineItem[];
}

// ---- Status config ----

const SR_STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  NEW:                        { label: "New",            bg: "#f0f4ff", color: "#4a6cf7" },
  "PICKED UP":                { label: "Picked Up",      bg: "#fff8e6", color: "#d4930a" },
  "IN TRANSIT":               { label: "In Transit",     bg: "#e8f5ff", color: "#1a8fde" },
  DELIVERED:                  { label: "Delivered",      bg: "#f0faf4", color: "#27a559" },
  "RTO INITIATED":            { label: "RTO Initiated",  bg: "#fff0f0", color: "#e05252" },
  "RTO DELIVERED":            { label: "RTO Delivered",  bg: "#fff0f0", color: "#e05252" },
  CANCELED:                   { label: "Cancelled",      bg: "#f5f5f5", color: "#8a8a8a" },
  "UNDELIVERED-3RD ATTEMPT":  { label: "Undelivered",   bg: "#fff3e8", color: "#d4600a" },
  "SELF FULFILLED":           { label: "Self Fulfilled", bg: "#f9e8eb", color: "#d57282" },
};

function getSrStatusConfig(status: string | null) {
  if (!status) return null;
  const key = status.startsWith("IN TRANSIT") ? "IN TRANSIT" : status;
  return SR_STATUS_CONFIG[key] ?? { label: status, bg: "#f5f5f5", color: "#8a8a8a" };
}

const PAYMENT_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  cod:     { label: "COD",     bg: "#fff8e6", color: "#d4930a" },
  prepaid: { label: "Prepaid", bg: "#f0faf4", color: "#27a559" },
};

// ---- Filter options ----

const STATUS_FILTERS = [
  { value: "",                 label: "All Statuses" },
  { value: "NEW",              label: "New" },
  { value: "PICKED UP",        label: "Picked Up" },
  { value: "IN TRANSIT",       label: "In Transit" },
  { value: "DELIVERED",        label: "Delivered" },
  { value: "RTO INITIATED",    label: "RTO Initiated" },
  { value: "RTO DELIVERED",    label: "RTO Delivered" },
  { value: "CANCELED",         label: "Cancelled" },
  { value: "UNDELIVERED-3RD ATTEMPT", label: "Undelivered" },
];

// ---- Helpers ----

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatEtd(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ---- Component ----

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageSize = 30;
  const totalPages = Math.ceil(total / pageSize);

  // Debounce search
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [search]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [statusFilter, paymentFilter]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      search: debouncedSearch,
      status: statusFilter,
      payment: paymentFilter,
    });
    const res = await fetch(`/api/orders?${params}`);
    const data = await res.json();
    setOrders(data.orders ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [page, debouncedSearch, statusFilter, paymentFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const hasActiveFilters = debouncedSearch || statusFilter || paymentFilter;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-xl font-semibold"
            style={{ color: "#525252", fontFamily: "var(--font-poppins), sans-serif" }}
          >
            My Orders
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#8a8a8a" }}>
            {total > 0 ? `${total} orders` : "Loading…"}
          </p>
        </div>
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
            placeholder="Order #, customer name or phone…"
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

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm px-3 py-2 rounded-xl outline-none cursor-pointer"
          style={{
            backgroundColor: statusFilter ? "#f9e8eb" : "#ffffff",
            border: "1px solid #E2E2E2",
            color: statusFilter ? "#d57282" : "#525252",
          }}
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        {/* Payment filter */}
        <div className="flex gap-1.5">
          {["", "cod", "prepaid"].map((v) => (
            <button
              key={v}
              onClick={() => setPaymentFilter(v)}
              className="px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-100"
              style={
                paymentFilter === v
                  ? { backgroundColor: "#d57282", color: "#ffffff" }
                  : { backgroundColor: "#ffffff", border: "1px solid #E2E2E2", color: "#525252" }
              }
            >
              {v === "" ? "All" : v === "cod" ? "COD" : "Prepaid"}
            </button>
          ))}
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={() => { setSearch(""); setStatusFilter(""); setPaymentFilter(""); }}
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
        {/* Table header */}
        <div
          className="grid text-xs font-semibold uppercase tracking-wide px-5 py-3"
          style={{
            gridTemplateColumns: "90px 1fr 1fr 100px 90px 130px 90px",
            borderBottom: "1px solid #f0eae6",
            color: "#8a8a8a",
          }}
        >
          <span>Order</span>
          <span>Customer</span>
          <span>Product</span>
          <span className="text-right">Amount</span>
          <span className="text-center">Payment</span>
          <span className="text-center">Status</span>
          <span className="text-right">Date</span>
        </div>

        {/* Rows */}
        {loading ? (
          <div className="py-16 flex flex-col items-center gap-3" style={{ color: "#8a8a8a" }}>
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "#d57282", borderTopColor: "transparent" }}
            />
            <p className="text-sm">Loading orders…</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2" style={{ color: "#8a8a8a" }}>
            <Package size={32} style={{ opacity: 0.3 }} />
            <p className="text-sm">No orders found</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "#f0eae6" }}>
            {orders.map((order) => {
              const statusCfg = getSrStatusConfig(order.sr_status);
              const paymentCfg = order.payment_method
                ? PAYMENT_CONFIG[order.payment_method] ?? null
                : null;
              const items = order.order_line_items ?? [];
              const firstItem = items[0];
              const isRepeat = (order.customer_order_index ?? 1) > 1;

              return (
                <div
                  key={order.order_id}
                  className="grid items-center px-5 py-3.5 hover:bg-[#fffbf6] transition-colors duration-100"
                  style={{ gridTemplateColumns: "90px 1fr 1fr 100px 90px 130px 90px" }}
                >
                  {/* Order # */}
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "#525252" }}>
                      {order.order_name}
                    </p>
                    {isRepeat && (
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: "#f9e8eb", color: "#d57282" }}
                      >
                        Repeat
                      </span>
                    )}
                  </div>

                  {/* Customer */}
                  <div className="min-w-0 pr-3">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: "#525252" }}
                    >
                      {order.customer_name ?? "—"}
                    </p>
                    <p className="text-xs truncate" style={{ color: "#8a8a8a" }}>
                      {[order.customer_city, order.customer_state]
                        .filter(Boolean)
                        .join(", ") || order.customer_phone || ""}
                    </p>
                  </div>

                  {/* Product */}
                  <div className="min-w-0 pr-3">
                    {firstItem ? (
                      <>
                        <p
                          className="text-sm truncate"
                          style={{ color: "#525252" }}
                          title={firstItem.title}
                        >
                          {firstItem.title}
                        </p>
                        <p className="text-xs" style={{ color: "#8a8a8a" }}>
                          {items.length > 1
                            ? `+${items.length - 1} more`
                            : firstItem.variant_title && firstItem.variant_title !== "Default Title"
                            ? firstItem.variant_title
                            : `Qty ${firstItem.quantity}`}
                        </p>
                      </>
                    ) : (
                      <span className="text-sm" style={{ color: "#8a8a8a" }}>—</span>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="text-right">
                    <p className="text-sm font-semibold" style={{ color: "#525252" }}>
                      {formatAmount(order.total_price, order.currency)}
                    </p>
                  </div>

                  {/* Payment */}
                  <div className="flex justify-center">
                    {paymentCfg ? (
                      <span
                        className="text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: paymentCfg.bg, color: paymentCfg.color }}
                      >
                        {paymentCfg.label}
                      </span>
                    ) : (
                      <span style={{ color: "#8a8a8a" }}>—</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="flex flex-col items-center gap-1">
                    {statusCfg ? (
                      <span
                        className="text-xs font-medium px-2.5 py-1 rounded-full text-center"
                        style={{ backgroundColor: statusCfg.bg, color: statusCfg.color }}
                      >
                        {statusCfg.label}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "#8a8a8a" }}>—</span>
                    )}
                    {order.awb_code && (
                      <span className="text-[10px] font-mono" style={{ color: "#b8a0a0" }}>
                        {order.awb_code}
                      </span>
                    )}
                    {order.etd && statusCfg?.label !== "Delivered" && (
                      <span className="text-[10px] flex items-center gap-0.5" style={{ color: "#8a8a8a" }}>
                        <Truck size={9} />
                        {formatEtd(order.etd)}
                      </span>
                    )}
                  </div>

                  {/* Date */}
                  <div className="text-right">
                    <p className="text-xs" style={{ color: "#8a8a8a" }}>
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="flex items-center justify-between px-5 py-3.5 text-sm"
            style={{ borderTop: "1px solid #f0eae6" }}
          >
            <span style={{ color: "#8a8a8a" }}>
              Page {page} of {totalPages} · {total} orders
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
