"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Package,
  Truck,
  X,
  ShoppingBag,
  ShoppingCart,
  ChevronDown,
  Plus,
  Trash2,
  Check,
} from "lucide-react";

// ---- Types ----

interface LineItemForm {
  variant_id: string;
  product_id: string;
  product_title: string;
  product_handle: string;
  vendor: string;
  product_type: string;
  variant_title: string;
  sku: string;
  original_unit_price: number;
  quantity: number;
  discount_percent: number;
  available_qty: number;
}

interface PickerVariant {
  variant_id: string;
  title: string;
  price: string;
  sku: string;
  inventory_quantity: number;
  products: {
    product_id: string;
    title: string;
    handle: string;
    image_url: string | null;
    vendor: string;
    product_type: string;
  };
}

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

// ---- Indian States & UTs ----

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  // Union Territories
  "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry",
];

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

// ---- Toast ----

interface ToastData {
  type: "success" | "error";
  title: string;
  message?: string;
  persistent?: boolean;
}

function Toast({ toast, onClose }: { toast: ToastData; onClose: () => void }) {
  useEffect(() => {
    if (toast.persistent) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  const isSuccess = toast.type === "success";

  return (
    <div
      className="fixed top-5 right-5 z-[999] flex items-start gap-3 px-4 py-3.5 rounded-2xl max-w-sm w-full"
      style={{
        backgroundColor: "#ffffff",
        boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
        border: `1px solid ${isSuccess ? "#d1f0de" : "#fdd8d8"}`,
      }}
    >
      {/* Icon */}
      <div
        className="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: isSuccess ? "#f0faf4" : "#fff0f0" }}
      >
        {isSuccess ? (
          <Check size={12} style={{ color: "#27a559" }} />
        ) : (
          <X size={12} style={{ color: "#e05252" }} />
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: "#525252" }}>
          {toast.title}
        </p>
        {toast.message && (
          <p className="text-xs mt-0.5 break-words" style={{ color: "#8a8a8a" }}>
            {toast.message}
          </p>
        )}
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        className="shrink-0 p-0.5 rounded-md hover:bg-[#f5f0ed] transition-colors"
      >
        <X size={13} style={{ color: "#8a8a8a" }} />
      </button>
    </div>
  );
}

// ---- Add Custom Order Dropdown ----

function AddCustomOrderDropdown({
  onSelect,
}: {
  onSelect: (channel: "Offline" | "Amazon") => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
        className="flex items-center gap-2 px-4 py-2 rounded-[22px] text-sm font-medium transition-all duration-100"
        style={{
          backgroundColor: "#d57282",
          color: "#ffffff",
          boxShadow: "0 4px 14px rgba(213,114,130,0.28)",
        }}
      >
        Add Custom Order
        <ChevronDown size={13} />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1.5 z-20 rounded-xl overflow-hidden w-48"
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #E2E2E2",
            boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
          }}
        >
          <button
            onClick={() => {
              setOpen(false);
              onSelect("Offline");
            }}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm hover:bg-[#faf7f5] transition-colors"
            style={{ color: "#525252" }}
          >
            <ShoppingBag size={14} style={{ color: "#d57282" }} />
            Offline Order
          </button>
          <div style={{ borderTop: "1px solid #f0eae6" }} />
          <button
            onClick={() => {
              setOpen(false);
              onSelect("Amazon");
            }}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm hover:bg-[#faf7f5] transition-colors"
            style={{ color: "#525252" }}
          >
            <ShoppingCart size={14} style={{ color: "#d57282" }} />
            Amazon Order
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Variant Picker ----

function VariantPicker({
  selectedIds,
  onToggle,
  onClose,
}: {
  selectedIds: Set<string>;
  onToggle: (v: PickerVariant) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<PickerVariant[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  useEffect(() => {
    async function fetch_() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: "1", search: debouncedQuery, stock_status: "in_stock" });
        const res = await fetch(`/api/products?${params}`);
        const data = await res.json();
        const variants = data.variants ?? [];
        setResults(variants);
        setPage(1);
        setHasMore(variants.length < (data.total ?? 0));
      } finally {
        setLoading(false);
      }
    }
    fetch_();
  }, [debouncedQuery]);

  async function loadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ page: String(nextPage), search: debouncedQuery, stock_status: "in_stock" });
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      const newVariants = data.variants ?? [];
      setResults((prev) => [...prev, ...newVariants]);
      setPage(nextPage);
      setHasMore(results.length + newVariants.length < (data.total ?? 0));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.25)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: "#ffffff",
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          maxHeight: "70vh",
        }}
      >
        {/* Header */}
        <div
          className="px-5 pt-4 pb-3 space-y-3"
          style={{ borderBottom: "1px solid #f0eae6" }}
        >
          <div className="flex items-center justify-between">
            <h4
              className="text-sm font-semibold"
              style={{ color: "#525252" }}
            >
              Select Products
            </h4>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-[#f5f0ed]"
            >
              <X size={16} style={{ color: "#8a8a8a" }} />
            </button>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #E2E2E2",
            }}
          >
            <Search size={14} style={{ color: "#8a8a8a" }} />
            <input
              type="text"
              placeholder="Search products…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-[#c0b8b8]"
              style={{ color: "#525252" }}
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div
              className="py-10 flex flex-col items-center gap-2"
              style={{ color: "#8a8a8a" }}
            >
              <div
                className="w-6 h-6 rounded-full border-2 animate-spin"
                style={{
                  borderColor: "#d57282",
                  borderTopColor: "transparent",
                }}
              />
              <p className="text-xs">Searching…</p>
            </div>
          ) : results.length === 0 ? (
            <div
              className="py-10 text-center text-sm"
              style={{ color: "#8a8a8a" }}
            >
              No products found
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "#f0eae6" }}>
              {results.map((v) => {
                const selected = selectedIds.has(v.variant_id);
                return (
                  <button
                    key={v.variant_id}
                    onClick={() => onToggle(v)}
                    className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-[#fffbf6] transition-colors"
                    style={{
                      backgroundColor: selected ? "#f9e8eb" : undefined,
                    }}
                  >
                    {/* Image */}
                    <div
                      className="w-[30px] h-[30px] rounded-lg overflow-hidden shrink-0"
                      style={{ backgroundColor: "#f9e8eb" }}
                    >
                      {v.products.image_url ? (
                        <img
                          src={v.products.image_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package size={10} style={{ color: "#d57282" }} />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: "#525252" }}
                      >
                        {v.products.title}
                      </p>
                      <p
                        className="text-xs truncate"
                        style={{ color: "#8a8a8a" }}
                      >
                        {v.title !== "Default Title" ? v.title : ""}{" "}
                        {v.sku ? `· ${v.sku}` : ""}
                      </p>
                    </div>

                    <span
                      className="text-xs font-medium shrink-0"
                      style={{ color: "#525252" }}
                    >
                      {formatAmount(parseFloat(v.price) || 0, "INR")}
                    </span>

                    {selected && (
                      <Check
                        size={14}
                        style={{ color: "#27a559" }}
                        className="shrink-0"
                      />
                    )}
                  </button>
                );
              })}
              {/* Load more */}
              {hasMore && (
                <div className="px-5 py-3 flex justify-center">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 px-4 py-2 rounded-[22px] text-xs font-medium transition-all"
                    style={{
                      border: "1px solid #d57282",
                      color: "#d57282",
                      backgroundColor: "#ffffff",
                      opacity: loadingMore ? 0.6 : 1,
                    }}
                  >
                    {loadingMore ? (
                      <>
                        <div className="w-3 h-3 rounded-full border border-t-transparent animate-spin" style={{ borderColor: "#d57282", borderTopColor: "transparent" }} />
                        Loading…
                      </>
                    ) : (
                      `Load more (${results.length} shown)`
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Done */}
        <div className="px-5 py-3" style={{ borderTop: "1px solid #f0eae6" }}>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-[22px] text-sm font-semibold"
            style={{
              backgroundColor: "#d57282",
              color: "#ffffff",
              boxShadow: "0 4px 14px rgba(213,114,130,0.28)",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Add Custom Order Modal ----

function AddCustomOrderModal({
  channel,
  onClose,
  onCreated,
  onToast,
}: {
  channel: "Offline" | "Amazon";
  onClose: () => void;
  onCreated: () => void;
  onToast: (t: ToastData) => void;
}) {
  // Order info
  const [orderName, setOrderName] = useState("");
  const [amazonOrderId, setAmazonOrderId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [customerPincode, setCustomerPincode] = useState("");
  const [customerState, setCustomerState] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Prepaid" | "COD">(
    "Prepaid"
  );
  const [fulfillmentStatus, setFulfillmentStatus] = useState<
    "FULFILLED" | "UNFULFILLED"
  >("UNFULFILLED");
  const [note, setNote] = useState("");

  // Products
  const [lineItems, setLineItems] = useState<LineItemForm[]>([]);
  const [variantPickerOpen, setVariantPickerOpen] = useState(false);

  // Shipping
  const [shippingCharges, setShippingCharges] = useState(0);

  // Package dimensions
  const [weight, setWeight] = useState(0.5);
  const [length, setLength] = useState(10);
  const [breadth, setBreadth] = useState(10);
  const [height, setHeight] = useState(10);

  // Submission
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedIds = useMemo(() => new Set(lineItems.map((i) => i.variant_id)), [lineItems]);

  function handleToggleVariant(v: PickerVariant) {
    setLineItems((prev) => {
      const exists = prev.find((i) => i.variant_id === v.variant_id);
      if (exists) return prev.filter((i) => i.variant_id !== v.variant_id);
      return [
        ...prev,
        {
          variant_id: v.variant_id,
          product_id: v.products.product_id,
          product_title: v.products.title,
          product_handle: v.products.handle || "",
          vendor: v.products.vendor || "",
          product_type: v.products.product_type || "",
          variant_title: v.title,
          sku: v.sku || "",
          original_unit_price: parseFloat(v.price) || 0,
          quantity: 1,
          discount_percent: 0,
          available_qty: v.inventory_quantity,
        },
      ];
    });
  }

  function updateItem(idx: number, updates: Partial<LineItemForm>) {
    setLineItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...updates } : item))
    );
  }

  function removeItem(idx: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function discountedPrice(item: LineItemForm) {
    return item.original_unit_price * (1 - item.discount_percent / 100);
  }

  const subtotal = lineItems.reduce(
    (sum, item) => sum + discountedPrice(item) * item.quantity,
    0
  );
  const finalTotal = subtotal + shippingCharges;

  function validate(): string | null {
    if (!orderName.trim()) return "Order name is required";
    if (channel === "Amazon" && !amazonOrderId.trim())
      return "Amazon Order ID is required";
    if (!customerName.trim()) return "Customer name is required";
    if (!customerPhone.trim()) return "Customer phone is required";
    if (customerPhone.length !== 10) return "Customer phone must be 10 digits";
    if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail))
      return "Enter a valid email address";
    if (!customerCity.trim()) return "City is required";
    if (!/^\d{6}$/.test(customerPincode)) return "Pincode must be 6 digits";
    if (!customerState.trim()) return "State is required";
    if (weight <= 0) return "Weight must be greater than 0";
    if (lineItems.length === 0) return "Add at least one product";
    for (let i = 0; i < lineItems.length; i++) {
      if (lineItems[i].quantity < 1)
        return `Item ${i + 1}: quantity must be at least 1`;
      if (lineItems[i].quantity > lineItems[i].available_qty)
        return `"${lineItems[i].product_title}" — only ${lineItems[i].available_qty} in stock`;
      if (
        lineItems[i].discount_percent < 0 ||
        lineItems[i].discount_percent > 100
      )
        return `Item ${i + 1}: discount must be 0–100%`;
    }
    return null;
  }

  async function handleSubmit() {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/orders/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          amazon_order_id:
            channel === "Amazon" ? amazonOrderId : undefined,
          order_name: orderName,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail || undefined,
          customer_city: customerCity,
          customer_pincode: customerPincode,
          customer_state: customerState,
          customer_address: customerAddress || undefined,
          payment_method: paymentMethod,
          fulfillment_status: fulfillmentStatus,
          note: note || undefined,
          shipping_charges: shippingCharges,
          weight,
          length,
          breadth,
          height,
          line_items: lineItems.map((item) => ({
            variant_id: item.variant_id,
            product_id: item.product_id,
            product_title: item.product_title,
            product_handle: item.product_handle || "",
            vendor: item.vendor,
            product_type: item.product_type,
            variant_title: item.variant_title,
            sku: item.sku,
            quantity: item.quantity,
            original_unit_price: item.original_unit_price,
            discount_percent: item.discount_percent,
          })),
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        throw new Error(d.error ?? "Failed to create order");
      }
      onCreated();
      onClose();
      if (d.shiprocket_push?.success) {
        onToast({ type: "success", title: "Order created & pushed to Shiprocket" });
      } else {
        onToast({
          type: "error",
          title: "Order created — Shiprocket push failed",
          message: d.shiprocket_push?.error ?? "Unknown error",
          persistent: true,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create order");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    border: "1px solid #E2E2E2",
    color: "#525252",
    backgroundColor: "#ffffff",
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
          style={{
            backgroundColor: "#ffffff",
            boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
            maxHeight: "90vh",
          }}
        >
          {/* Header */}
          <div
            className="flex items-start justify-between px-6 pt-5 pb-4 shrink-0"
            style={{ borderBottom: "1px solid #f0eae6" }}
          >
            <div>
              <h3
                className="text-base font-semibold"
                style={{ color: "#525252" }}
              >
                Add {channel} Order
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "#8a8a8a" }}>
                Create a new order manually
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-[#f5f0ed]"
            >
              <X size={16} style={{ color: "#8a8a8a" }} />
            </button>
          </div>

          {/* Body */}
          <div
            className="flex-1 overflow-y-auto px-6 py-5 space-y-6"
            style={{ maxHeight: "70vh" }}
          >
            {/* Section 1 — Order Information */}
            <div className="space-y-4">
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "#8a8a8a" }}
              >
                Order Information
              </p>

              <div className="grid grid-cols-2 gap-3">
                {/* Order Name */}
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "#525252" }}
                  >
                    Order Name<span style={{ color: "#e05252" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={orderName}
                    onChange={(e) => setOrderName(e.target.value)}
                    placeholder="#1001"
                    className="w-full text-sm rounded-xl px-3 py-2.5 outline-none placeholder:text-[#c0b8b8]"
                    style={inputStyle}
                  />
                </div>

                {/* Amazon Order ID */}
                {channel === "Amazon" && (
                  <div>
                    <label
                      className="block text-xs font-medium mb-1.5"
                      style={{ color: "#525252" }}
                    >
                      Amazon Order ID
                      <span style={{ color: "#e05252" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={amazonOrderId}
                      onChange={(e) => setAmazonOrderId(e.target.value)}
                      placeholder="402-1234567-8901234"
                      className="w-full text-sm rounded-xl px-3 py-2.5 outline-none placeholder:text-[#c0b8b8]"
                      style={inputStyle}
                    />
                  </div>
                )}

                {/* Customer Name */}
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "#525252" }}
                  >
                    Customer Name<span style={{ color: "#e05252" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Full name"
                    className="w-full text-sm rounded-xl px-3 py-2.5 outline-none placeholder:text-[#c0b8b8]"
                    style={inputStyle}
                  />
                </div>

                {/* Customer Phone */}
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "#525252" }}
                  >
                    Customer Phone
                    <span style={{ color: "#e05252" }}>*</span>
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={customerPhone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setCustomerPhone(digits);
                    }}
                    placeholder="9876543210"
                    maxLength={10}
                    className="w-full text-sm rounded-xl px-3 py-2.5 outline-none placeholder:text-[#c0b8b8]"
                    style={{
                      ...inputStyle,
                      borderColor: customerPhone.length > 0 && customerPhone.length < 10 ? "#e05252" : "#E2E2E2",
                    }}
                  />
                  {customerPhone.length > 0 && customerPhone.length < 10 && (
                    <p className="text-[10px] mt-1" style={{ color: "#e05252" }}>
                      Must be 10 digits ({customerPhone.length}/10)
                    </p>
                  )}
                </div>

                {/* Customer Email */}
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "#525252" }}
                  >
                    Customer Email{" "}
                    <span style={{ color: "#8a8a8a" }}>(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full text-sm rounded-xl px-3 py-2.5 outline-none placeholder:text-[#c0b8b8]"
                    style={{
                      ...inputStyle,
                      borderColor:
                        customerEmail.length > 0 &&
                        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)
                          ? "#e05252"
                          : "#E2E2E2",
                    }}
                  />
                  {customerEmail.length > 0 &&
                    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) && (
                      <p className="text-[10px] mt-1" style={{ color: "#e05252" }}>
                        Enter a valid email address
                      </p>
                    )}
                </div>

                {/* City */}
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "#525252" }}
                  >
                    City<span style={{ color: "#e05252" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={customerCity}
                    onChange={(e) => setCustomerCity(e.target.value)}
                    placeholder="City"
                    className="w-full text-sm rounded-xl px-3 py-2.5 outline-none placeholder:text-[#c0b8b8]"
                    style={inputStyle}
                  />
                </div>

                {/* Pincode */}
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "#525252" }}
                  >
                    Pincode<span style={{ color: "#e05252" }}>*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={customerPincode}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setCustomerPincode(digits);
                    }}
                    placeholder="110001"
                    maxLength={6}
                    className="w-full text-sm rounded-xl px-3 py-2.5 outline-none placeholder:text-[#c0b8b8]"
                    style={{
                      ...inputStyle,
                      borderColor: customerPincode.length > 0 && customerPincode.length < 6 ? "#e05252" : "#E2E2E2",
                    }}
                  />
                  {customerPincode.length > 0 && customerPincode.length < 6 && (
                    <p className="text-[10px] mt-1" style={{ color: "#e05252" }}>
                      Must be 6 digits ({customerPincode.length}/6)
                    </p>
                  )}
                </div>

                {/* State */}
                <div className="col-span-2">
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "#525252" }}
                  >
                    State<span style={{ color: "#e05252" }}>*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={customerState}
                      onChange={(e) => setCustomerState(e.target.value)}
                      className="w-full text-sm rounded-xl px-3 py-2.5 outline-none cursor-pointer appearance-none"
                      style={{
                        ...inputStyle,
                        color: customerState ? "#525252" : "#c0b8b8",
                        paddingRight: "2rem",
                      }}
                    >
                      <option value="" disabled style={{ color: "#c0b8b8" }}>Select state…</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s} value={s} style={{ color: "#525252" }}>{s}</option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: "#8a8a8a" }}
                    />
                  </div>
                </div>

                {/* Customer Address */}
                <div className="col-span-2">
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "#525252" }}
                  >
                    Customer Address{" "}
                    <span style={{ color: "#8a8a8a" }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Full address"
                    className="w-full text-sm rounded-xl px-3 py-2.5 outline-none placeholder:text-[#c0b8b8]"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Payment Mode + Fulfillment Status — side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "#525252" }}
                  >
                    Payment Mode
                  </label>
                  <div className="flex gap-1.5">
                    {(["Prepaid", "COD"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m)}
                        className="px-4 py-2 rounded-[22px] text-sm font-medium transition-all duration-100"
                        style={
                          paymentMethod === m
                            ? { backgroundColor: "#d57282", color: "#ffffff", border: "1px solid transparent" }
                            : { backgroundColor: "#ffffff", border: "1px solid #E2E2E2", color: "#525252" }
                        }
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "#525252" }}
                  >
                    Fulfillment Status
                  </label>
                  <div className="flex gap-1.5">
                    {(["UNFULFILLED", "FULFILLED"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFulfillmentStatus(s)}
                        className="px-4 py-2 rounded-[22px] text-sm font-medium transition-all duration-100"
                        style={
                          fulfillmentStatus === s
                            ? { backgroundColor: "#d57282", color: "#ffffff", border: "1px solid transparent" }
                            : { backgroundColor: "#ffffff", border: "1px solid #E2E2E2", color: "#525252" }
                        }
                      >
                        {s === "UNFULFILLED" ? "Unfulfilled" : "Fulfilled"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Note */}
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "#525252" }}
                >
                  Note <span style={{ color: "#8a8a8a" }}>(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Internal note…"
                  className="w-full text-sm rounded-xl px-3 py-2.5 outline-none resize-none placeholder:text-[#c0b8b8]"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Section 2 — Products */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "#8a8a8a" }}
                >
                  Products
                </p>
                <button
                  type="button"
                  onClick={() => setVariantPickerOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[22px] text-xs font-medium transition-all duration-100"
                  style={{
                    border: "1px solid #d57282",
                    color: "#d57282",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <Plus size={12} />
                  Add Product
                </button>
              </div>

              {lineItems.length === 0 ? (
                <div
                  className="py-8 text-center text-sm rounded-xl"
                  style={{
                    color: "#8a8a8a",
                    backgroundColor: "#faf7f5",
                    border: "1px dashed #E2E2E2",
                  }}
                >
                  No products added yet
                </div>
              ) : (
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ border: "1px solid #E2E2E2" }}
                >
                  {lineItems.map((item, idx) => {
                    const dp = discountedPrice(item);
                    return (
                      <div
                        key={item.variant_id}
                        className="flex items-center gap-3 px-4 py-3"
                        style={{
                          borderTop: idx > 0 ? "1px solid #f0eae6" : undefined,
                        }}
                      >
                        {/* Product info */}
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium truncate"
                            style={{ color: "#d57282" }}
                          >
                            {item.product_title}
                          </p>
                          {item.variant_title !== "Default Title" && (
                            <p
                              className="text-xs truncate"
                              style={{ color: "#8a8a8a" }}
                            >
                              {item.variant_title}
                            </p>
                          )}
                        </div>

                        {/* Qty */}
                        <div className="shrink-0 w-16">
                          <label
                            className="block text-[10px] mb-0.5"
                            style={{ color: "#8a8a8a" }}
                          >
                            Qty
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(idx, {
                                quantity: Math.max(
                                  1,
                                  parseInt(e.target.value) || 1
                                ),
                              })
                            }
                            onFocus={(e) => e.target.select()}
                            className="w-full text-xs text-center rounded-lg px-2 py-1.5 outline-none"
                            style={{
                              ...inputStyle,
                              borderColor: item.quantity > item.available_qty ? "#e05252" : "#E2E2E2",
                            }}
                          />
                          {item.quantity > item.available_qty && (
                            <p className="text-[9px] mt-0.5 text-center leading-tight" style={{ color: "#e05252" }}>
                              Max {item.available_qty}
                            </p>
                          )}
                        </div>

                        {/* Original price */}
                        <div className="shrink-0 text-right w-16">
                          <label
                            className="block text-[10px] mb-0.5"
                            style={{ color: "#8a8a8a" }}
                          >
                            Price
                          </label>
                          <p
                            className="text-xs font-medium"
                            style={{ color: "#525252" }}
                          >
                            {formatAmount(item.original_unit_price, "INR")}
                          </p>
                        </div>

                        {/* Discount */}
                        <div className="shrink-0 w-16">
                          <label
                            className="block text-[10px] mb-0.5"
                            style={{ color: "#8a8a8a" }}
                          >
                            Disc %
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={item.discount_percent === 0 ? "" : item.discount_percent}
                            placeholder="0"
                            maxLength={4}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
                              const val = Math.min(100, Math.max(0, parseInt(raw) || 0));
                              updateItem(idx, { discount_percent: val });
                            }}
                            onFocus={(e) => e.target.select()}
                            className="w-full text-xs text-center rounded-lg px-2 py-1.5 outline-none"
                            style={inputStyle}
                          />
                        </div>

                        {/* Discounted price */}
                        <div className="shrink-0 text-right w-16">
                          <label
                            className="block text-[10px] mb-0.5"
                            style={{ color: "#8a8a8a" }}
                          >
                            Final
                          </label>
                          <p
                            className="text-xs font-medium"
                            style={{ color: "#8a8a8a" }}
                          >
                            {formatAmount(dp, "INR")}
                          </p>
                        </div>

                        {/* Remove */}
                        <button
                          onClick={() => removeItem(idx)}
                          className="shrink-0 p-1.5 rounded-lg hover:bg-[#fff0f0] transition-colors"
                        >
                          <Trash2 size={13} style={{ color: "#e05252" }} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 3 — Order Totals */}
            <div className="space-y-2">
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "#8a8a8a" }}
              >
                Order Totals
              </p>
              <div
                className="rounded-xl px-4 py-3 space-y-2"
                style={{
                  backgroundColor: "#faf7f5",
                  border: "1px solid #f0eae6",
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "#8a8a8a" }}>
                    Subtotal
                  </span>
                  <span
                    className="text-sm font-medium"
                    style={{ color: "#525252" }}
                  >
                    {formatAmount(subtotal, "INR")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "#8a8a8a" }}>
                    Shipping Charges
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs" style={{ color: "#8a8a8a" }}>
                      ₹
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={shippingCharges === 0 ? "" : shippingCharges}
                      placeholder="0"
                      maxLength={4}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
                        setShippingCharges(Math.max(0, parseInt(raw) || 0));
                      }}
                      onFocus={(e) => e.target.select()}
                      className="w-20 text-xs text-right rounded-lg px-2 py-1 outline-none"
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div
                  className="flex items-center justify-between pt-2"
                  style={{ borderTop: "1px solid #f0eae6" }}
                >
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "#d57282" }}
                  >
                    Final Total
                  </span>
                  <span
                    className="text-base font-bold"
                    style={{ color: "#d57282" }}
                  >
                    {formatAmount(finalTotal, "INR")}
                  </span>
                </div>
              </div>
            </div>
            {/* Section 4 — Package & Shiprocket */}
            <div className="space-y-4">
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "#8a8a8a" }}
              >
                Package &amp; Dispatch
              </p>

              {/* Dimensions grid */}
              <div className="grid grid-cols-4 gap-3">
                {/* Weight */}
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "#525252" }}
                  >
                    Weight (kg)<span style={{ color: "#e05252" }}>*</span>
                  </label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={weight}
                    onChange={(e) => setWeight(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                    onFocus={(e) => e.target.select()}
                    className="w-full text-sm rounded-xl px-3 py-2.5 outline-none"
                    style={inputStyle}
                  />
                </div>
                {/* Length */}
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "#525252" }}
                  >
                    Length (cm)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={length}
                    onChange={(e) => setLength(Math.max(1, parseInt(e.target.value) || 1))}
                    onFocus={(e) => e.target.select()}
                    className="w-full text-sm rounded-xl px-3 py-2.5 outline-none"
                    style={inputStyle}
                  />
                </div>
                {/* Breadth */}
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "#525252" }}
                  >
                    Breadth (cm)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={breadth}
                    onChange={(e) => setBreadth(Math.max(1, parseInt(e.target.value) || 1))}
                    onFocus={(e) => e.target.select()}
                    className="w-full text-sm rounded-xl px-3 py-2.5 outline-none"
                    style={inputStyle}
                  />
                </div>
                {/* Height */}
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "#525252" }}
                  >
                    Height (cm)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={height}
                    onChange={(e) => setHeight(Math.max(1, parseInt(e.target.value) || 1))}
                    onFocus={(e) => e.target.select()}
                    className="w-full text-sm rounded-xl px-3 py-2.5 outline-none"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex items-center gap-2 px-6 py-4 shrink-0"
            style={{ borderTop: "1px solid #f0eae6" }}
          >
            {error && (
              <p
                className="flex-1 text-xs"
                style={{ color: "#e05252" }}
              >
                {error}
              </p>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-[22px] text-sm font-medium"
                style={{
                  border: "1px solid #E2E2E2",
                  color: "#525252",
                  backgroundColor: "#ffffff",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-5 py-2.5 rounded-[22px] text-sm font-semibold transition-all"
                style={
                  !saving
                    ? {
                        backgroundColor: "#d57282",
                        color: "#ffffff",
                        boxShadow: "0 4px 14px rgba(213,114,130,0.28)",
                      }
                    : {
                        backgroundColor: "#f0e8ea",
                        color: "#c0a0a8",
                        cursor: "not-allowed",
                      }
                }
              >
                {saving ? "Creating…" : "Create Order"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {variantPickerOpen && (
        <VariantPicker
          selectedIds={selectedIds}
          onToggle={handleToggleVariant}
          onClose={() => setVariantPickerOpen(false)}
        />
      )}
    </>
  );
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
  const [modalChannel, setModalChannel] = useState<"Offline" | "Amazon" | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

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
        <AddCustomOrderDropdown onSelect={(ch) => setModalChannel(ch)} />
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

      {/* Custom Order Modal */}
      {modalChannel && (
        <AddCustomOrderModal
          channel={modalChannel}
          onClose={() => setModalChannel(null)}
          onCreated={() => fetchOrders()}
          onToast={(t) => setToast(t)}
        />
      )}

      {/* Toast */}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
