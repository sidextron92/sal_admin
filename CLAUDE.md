# Maeri Control Centre — CLAUDE.md

## Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS v4 + inline styles for brand tokens
- **UI:** shadcn/ui backed by `@base-ui/react` (NOT Radix UI)
- **Charts:** Recharts
- **Database:** Supabase (PostgreSQL)
- **External APIs:** Shopify Admin GraphQL API, Shiprocket REST API
- **Excel:** `exceljs` (bulk inventory download/upload)

---

## Key Caveats

- **`@base-ui/react` ≠ Radix UI** — no `asChild` prop on Tooltip. Use `render={<div />}` on `TooltipTrigger`.
- **Recharts Tooltip `formatter`** — param type is `ValueType`, not `number`. Don't type it explicitly.
- **Next.js 16** — deprecation warning for `"middleware"` → `"proxy"`. Harmless, ignore it.
- **Shopify PII restriction** — plan does not allow `customer { firstName lastName email phone }` or `shippingAddress`. Customer details come from Shiprocket.
- **Google Sheets re-export + ExcelJS** — formula cells come back as error objects. Bulk upload ignores the `validationError` formula column and validates server-side only.

---

## Auth

Hardcoded single-user auth (no Supabase Auth). Credentials via env `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
Cookie: `sal_session=authenticated` (HttpOnly, 7-day expiry). Middleware in `middleware.ts` protects `/dashboard/*`.

```
POST /api/auth/login  →  validates credentials  →  sets sal_session cookie
POST /api/auth/logout →  clears sal_session cookie
/ (root)              →  redirects to /dashboard/overview or /login
```

---

## API Routes

### `POST /api/auth/login` · `POST /api/auth/logout`
`app/api/auth/login/route.ts` · `app/api/auth/logout/route.ts`
Login sets cookie, logout clears it. Both return `{ success: true }`.

---

### `POST /api/sync/shopify`
`app/api/sync/shopify/route.ts`
Fetches Shopify orders updated in last 7 days → upserts `orders` + `order_line_items` (batches of 500) → logs to `sync_log`.
Returns `{ success, orders, items, duration_ms }`.

### `GET /api/sync/shopify`
Returns last 10 `sync_log` rows ordered by `synced_at DESC`.

---

### `POST /api/sync/shiprocket`
`app/api/sync/shiprocket/route.ts`
Fetches Shiprocket orders (last 7 days) → updates matching `orders` rows by `order_name = #${channel_order_id}`.
Fields updated: `customer_name/email/phone/city/pincode/state/address`, `sr_order_id`, `sr_status`, `payment_method`, `awb_code`, `courier_name`, `etd`.
Matches across **all** `sales_channel` values (Shopify, Offline, Amazon) — no channel filter.
Returns `{ success, fetched, updated, duration_ms }`.

---

### `POST /api/sync/products`
`app/api/sync/products/route.ts`
Fetches all active Shopify products + variants → upserts `products` + `product_variants`. Sets `inventory_changed_by: 'shopify_sync'`. Never overwrites `cost`, `virtual_inventory`, `physical_inventory`. Populates `inventory_item_id` per variant (needed for Shopify write-back).

---

### `GET /api/orders`
`app/api/orders/route.ts`
Paginated orders (30/page) with search + filtering. Joins `order_line_items`.
Query params: `page`, `search` (ilike on order_name/customer_name/phone), `status` (sr_status; `"IN TRANSIT"` uses prefix match), `payment` (`cod` | `prepaid`).
Returns `{ orders, total, page, pageSize }`. Each order includes `shipping_status` (canonical system status from webhook layer).

---

### `GET /api/products`
`app/api/products/route.ts`
Paginated variants (50/page) with joined product info. Used by Inventory page and the Add Order variant picker.
Query params: `page`, `search`, `low_stock` (bool), `stock_status` (`in_stock` | `out_of_stock`).
Returns `{ variants, total, page, pageSize }`. Each variant includes `cost`, `virtual_inventory`, `physical_inventory`, `inventory_remark`, nested `products { product_id, title, handle, image_url, vendor, product_type, status }`.
**Note:** Add Order variant picker always passes `stock_status=in_stock` — zero-inventory variants are excluded.

---

### `PATCH /api/products/[variantId]/cost`
`app/api/products/[variantId]/cost/route.ts`
Updates `cost` only. Validates `cost >= 0`. DB trigger guard skips logging (no inventory columns changed).
Body: `{ cost: number }`

---

### `PATCH /api/products/[variantId]/inventory`
`app/api/products/[variantId]/inventory/route.ts`
Updates `virtual_inventory` + `physical_inventory` locally → DB trigger recalculates `inventory_quantity = virtual + physical` + logs to `inventory_logs` → **pushes new total to Shopify** via `inventorySetQuantities`.
Body: `{ virtual_inventory: number, physical_inventory: number, remark?: string }`
Returns `{ success, shopify_push: { success, pushed, errors } }`. Shopify push failure is non-fatal — local update always commits.

---

### `POST /api/orders/custom`
`app/api/orders/custom/route.ts`
Creates a manual order (Offline or Amazon channel) — inserts into `orders` + `order_line_items`, deducts inventory, pushes updated stock to Shopify, and **pushes the order to Shiprocket**.

**Channels:** `Offline` → `order_id: OFFLINE-{timestamp}-{random}` · `Amazon` → `AMZ-{timestamp}-{random}`, requires `amazon_order_id` (prepended to `note` as `[AMZ: {id}]`).

**`order_name` normalisation:** `#` prefix is always enforced server-side (user may omit it in the form).

**Body:**
```ts
{
  channel: 'Offline' | 'Amazon'
  amazon_order_id?: string        // required if channel = Amazon
  order_name: string              // e.g. "M-001" or "#M-001" — # auto-prepended
  customer_name: string
  customer_phone: string
  customer_email?: string
  customer_city: string
  customer_pincode: string        // 6-digit, required
  customer_state: string
  customer_address?: string
  payment_method: 'Prepaid' | 'COD'
  fulfillment_status: 'FULFILLED' | 'UNFULFILLED'
  note?: string
  shipping_charges: number        // >= 0
  weight: number                  // kg, > 0 (for Shiprocket)
  length: number                  // cm
  breadth: number                 // cm
  height: number                  // cm
  line_items: [{
    variant_id, product_id, product_title, product_handle,
    vendor, product_type, variant_title, sku,
    quantity,             // integer >= 1
    original_unit_price,
    discount_percent      // 0–100
  }]
}
```

**Financials (computed server-side):**
- `discounted_unit_price = original_unit_price × (1 − discount% / 100)`
- `subtotal_price = Σ discounted_unit_price × quantity`
- `total_price = subtotal + shipping_charges`

**`orders` fields set:**
`financial_status` → `PAID` (Prepaid) / `PENDING` (COD) · `sr_status` → `NEW` · `sales_channel` → channel value · `confirmed` → `true` · `currency` → `INR` · `total_tax` → `0`

**Inventory deduction:** drains `physical_inventory` first, spills to `virtual_inventory`. Sets `inventory_changed_by: 'order'`, `inventory_remark: 'Order {id}'`. Warns (non-blocking) if qty > available stock. After DB update, pushes new totals to Shopify via `inventorySetQuantities` (non-fatal on failure).

**Shiprocket push:** After Shopify write-back, pushes order to Shiprocket via `POST /orders/create/adhoc` (non-fatal). On success, saves `sr_order_id` + `sr_status` back to the `orders` row. Pickup location hardcoded as `'Delhi Warehouse EOK'`. `order_name` (stripped of `#`) is sent as Shiprocket's `order_id` — Shiprocket echoes it as `channel_order_id`, enabling the future sync join (`#channel_order_id = orders.order_name`). Line item `sku` field uses `product_type`, falling back to `'N/A'` if empty.

**`order_line_items` fields:** `line_item_id: {order_id}-item-{index}`, title composed as `product_title - variant_title`, plus all pricing fields, `product_handle`, `product_type`, `vendor`, `sku`.

Returns `{ success, order_id, shopify_push: { success, pushed, errors }, shiprocket_push: { success, sr_order_id?, error? }, inventory_warnings: string[] }`.

**Rollback:** if line item insert fails, the order row is deleted to avoid orphaned orders.

---

### `POST /api/webhooks/shipping/[partnerId]`
`app/api/webhooks/shipping/[partnerId]/route.ts`
Receives inbound shipping status webhooks from any logistics partner. `partnerId` is the numeric `shipping_partners.id` (e.g., `1` for Shiprocket).

> **URL note:** Shiprocket bans "shiprocket", "sr", "kr", "kartrocket" in webhook URLs — use the numeric ID path, not the slug.

**Auth:** If `shipping_partners.webhook_secret` is set, the request must include a matching `x-api-key` header — returns `401` otherwise. If `webhook_secret` is `NULL`, auth is skipped (opt-in per partner).

**Logic:**
1. Look up partner by `id` — 404 if not found or inactive
2. Verify `x-api-key` if `webhook_secret` is configured
3. Parse JSON body — 400 on failure
4. Extract fields via partner-specific extractor (Shiprocket: `awb = awb_no`, `current_status = partner_status`, `current_timestamp` parsed from `"DD MM YYYY HH:MM:SS"` → ISO)
5. Map `partner_status` → `system_status` via `status_mapper` table (null if unmapped — still logs)
6. Find matching order via `orders.awb_code = awb_no` (null if no match — orphan log still written)
7. Insert row into `order_tracking_logs` (always)
8. If order found + system_status mapped: update `orders.shipping_status` + `orders.shipping_partner_id`

Always returns `{ received: true }` with 200 — Shiprocket retries on non-2xx.

**Register in Shiprocket:** `POST https://<domain>/api/webhooks/shipping/1`

---

### `GET /api/orders/[orderId]/tracking`
`app/api/orders/[orderId]/tracking/route.ts`
Returns all tracking log entries for an order, ordered chronologically (`received_at ASC`).
Returns `{ logs: [...] }`. Each entry: `id`, `system_status`, `partner_status`, `awb_no`, `event_timestamp`, `received_at`, `partner_name`. Raw `partner_payload` is excluded from response.

---

### `GET /api/inventory/[variantId]/logs`
`app/api/inventory/[variantId]/logs/route.ts`
Returns all inventory log entries for a given variant, ordered by `changed_at DESC`.
Returns `{ logs: [...] }`. Each log entry includes: `variant_id`, `product_id`, `variant_title`, `product_title`, `prev/new/delta` for virtual/physical/total, `remarks`, `changed_by`, `changed_at`.

---

### `GET /api/inventory/bulk/download`
`app/api/inventory/bulk/download/route.ts`
Streams a styled `.xlsx` of all active variants.

| Col | Field | Type |
|-----|-------|------|
| A | variant_id | locked |
| B | product_title | locked |
| C | image (`=IMAGE(url)`) | locked |
| D | status | locked |
| E–I | current cost/sale/virtual/physical/total | locked |
| J | updatedCostPrice | **editable** |
| K | updatedVirtualInventory | **editable** |
| L | updatedPhysicalInventory | **editable** |
| M | totalInventory (`=K+L`) | locked, formula |
| N | updateInventoryRemarks | **editable** |
| O | validationError | locked, formula |

Sheet password-protected (`maeri_bulk`), filters/sort allowed.

---

### `POST /api/inventory/bulk/upload`
`app/api/inventory/bulk/upload/route.ts`
Accepts multipart `.xlsx`. Validates server-side (cost ≥ 0, inventory non-negative integers, virtual+physical required together). Cost and inventory update independently. Sets `inventory_changed_by: 'bulk_upload'`. After all DB updates, bulk-pushes inventory changes to Shopify in one call.
Returns:
```json
{
  "success": true,
  "summary": { "total_rows": 287, "updated_rows": 3, "updated_cost": 2, "updated_inventory": 2, "skipped": 284, "errors": 0 },
  "shopify_push": { "success": true, "pushed": 2, "errors": [] },
  "results": [...]
}
```

---

### `GET /api/expenses` · `POST /api/expenses`
`app/api/expenses/route.ts`
Paginated expense list (30/page) with inline summary aggregation.
Query params: `page`, `search` (ilike on `particulars` OR `remarks`), `function` (exact match on `function_name`), `type` (ilike), `date_from`, `date_to`.
Returns `{ expenses, total, page, pageSize, summary: { total_base, total_tax, total_amount, by_function: [{function_name, total_amount, count}] } }`. Summary reflects same filters as list.
`POST` body: `{ function_name, type?, particulars, expense_date, base_amount, tax_amount?, remarks?, is_recurring }`. Returns 201 `{ success, expense }`.

---

### `PATCH /api/expenses/[id]` · `DELETE /api/expenses/[id]`
`app/api/expenses/[id]/route.ts`
`PATCH` — partial update, all fields optional, sets `updated_at`. Returns `{ success, expense }`. 404 if not found.
`DELETE` — existence-checked delete. Returns `{ success }`. 404 if not found.

---

### `GET /api/expenses/export`
`app/api/expenses/export/route.ts`
Returns CSV of **all** expenses (no filters, no pagination), ordered `expense_date DESC`.
Columns: `Date, Function, Type, Particulars, Base Amount, Tax Amount, Total Amount, Remarks, Recurring, Created At`.
Headers: `Content-Type: text/csv`, `Content-Disposition: attachment; filename="maeri_expenses.csv"`.

---

## Library Modules

### `lib/shopify.ts`
Shopify Admin GraphQL client. Env: `SHOPIFY_DOMAIN`, `SHOPIFY_ACCESS_TOKEN`, `SHOPIFY_API_VERSION`, `SHOPIFY_LOCATION_ID`.

**`fetchOrders(limit, daysBack)`** — order header + journey + line items. `daysBack=0` skips date filter. UTM fallback: Fastrr checkout writes UTMs into `customAttributes`; used when `customerJourneySummary` visits are null.

**`fetchProducts()`** — full catalog sync with pagination. Fetches `inventoryItem { id }` per variant to populate `inventory_item_id`.

**`fetchPrimaryLocationId()`** — returns Shopify location ID. Reads `SHOPIFY_LOCATION_ID` env var (fast path); falls back to `locations` GraphQL query.

**`pushInventoryToShopify(items, locationId)`** — calls `inventorySetQuantities` mutation with `ignoreCompareQuantity: true`. Batched at 250 items. Returns `{ success, pushed, errors }`.

All Shopify GIDs stripped to numeric IDs. Types: `ShopifyOrder`, `ShopifyLineItem`, `ShopifyProduct`, `ShopifyVariant`, `InventoryPushItem`, `InventoryPushResult`.

---

### `lib/shiprocket.ts`
Env: `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`. Base URL: `https://apiv2.shiprocket.in/v1/external`.

**`fetchShiprocketOrders()`** — authenticates, paginates GET `/orders` (100/page, last 7 days via `updated_from`/`updated_to`). `updated_to` always set to tomorrow. Join key: `#${channel_order_id}` → `orders.order_name`. ETD `0000-00-00` coerced to null. Now also maps `customer_pincode`.

**`pushOrderToShiprocket(input: ShiprocketOrderInput)`** — pushes a manual order to Shiprocket `POST /orders/create/adhoc`. Strips `#` from `order_name` for Shiprocket's `order_id`. Splits `customer_name` into `billing_customer_name` / `billing_last_name`. Sets `shipping_is_billing: true`. Maps `product_type` → `sku` (falls back to `'N/A'`). Pickup location: `'Delhi Warehouse EOK'` (hardcoded in route). Returns `ShiprocketPushResult { success, sr_order_id?, shipment_id?, status?, error? }`.

**IP allowlist:** Shiprocket is IP-restricted. Dev IP: `106.215.80.229`. For Vercel, set `0.0.0.0/0`.

---

### `lib/supabase.ts`
```ts
import { supabaseAdmin } from '@/lib/supabase'
```
Uses `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS. Server-side only.

---

## Database Schema

### `orders`
PK: `order_id` (Shopify numeric ID as TEXT for Shopify orders; `OFFLINE-{ts}-{rand}` or `AMZ-{ts}-{rand}` for manual orders).
- Shopify columns: order fields, UTM/journey (first + last visit × 10 cols), `synced_at`
- Shiprocket columns: `customer_name/email/phone/city/pincode/state/address`, `sr_order_id`, `sr_status`, `payment_method`, `awb_code`, `courier_name`, `etd`
- Manual order columns: `sales_channel` (`Offline` | `Amazon` | `Shopify` default), `customer_pincode`, `customer_address`
- Tracking columns: `shipping_status` (canonical system status, set by webhook), `shipping_partner_id` FK → `shipping_partners`
- Always null (PII blocked): `customer_first_name`, `customer_last_name`
- Indexes: `created_at DESC`, `financial_status`, `customer_id`, `sales_channel`
- Known `sr_status`: `NEW`, `PICKED UP`, `IN TRANSIT`, `IN TRANSIT-EN-ROUTE`, `IN TRANSIT-AT DESTINATION HUB`, `DELIVERED`, `RTO INITIATED`, `RTO DELIVERED`, `CANCELED`, `UNDELIVERED-3RD ATTEMPT`, `SELF FULFILLED`

### `order_line_items`
PK: `line_item_id`. FK: `order_id → orders ON DELETE CASCADE`. Indexes: `order_id`, `product_id`.

### `sync_log`
PK: `id` (bigserial). Columns: `synced_at`, `orders_upserted`, `items_upserted`, `status`, `error_message`, `duration_ms`, `platform`, `type`.

### `products`
PK: `product_id`. Columns: `title`, `handle`, `vendor`, `product_type`, `tags`, `status`, `total_inventory`, `total_variants`, `image_url`, `published_at`, `created_at`, `updated_at`, `synced_at`.

### `product_variants`
PK: `variant_id`. FK: `product_id → products`.

Shopify-synced (overwritten on sync): `title`, `price`, `sku`, `inventory_quantity`, `inventory_item_id`, `synced_at`.

Inventory management (never overwritten by sync):
- `cost` — cost price (default 0, ≥ 0)
- `virtual_inventory` — anticipated/pre-added stock (default 0, ≥ 0)
- `physical_inventory` — actual on-hand stock (default 0, ≥ 0)
- `inventory_remark` — last change context
- `inventory_changed_by` — `'admin'` | `'shopify_sync'` | `'bulk_upload'` | `'order'`

**Invariant:** `inventory_quantity = virtual_inventory + physical_inventory` (maintained by DB trigger).

### `inventory_logs`
Full audit log written by `trg_inventory_change`. Columns: `variant_id`, `product_id`, `variant_title`, `product_title`, `prev/new/delta` for virtual/physical/total, `remarks`, `changed_by`, `changed_at`. Indexes: `variant_id`, `changed_at DESC`.

### `shipping_partners`
PK: `id` (serial). Columns: `name`, `slug` (unique, internal only — not used in URL), `status` (`active`|`inactive`), `webhook_secret` (nullable; if set, `x-api-key` header is required on inbound webhooks), `created_at`.
Seeded: id=1 → Shiprocket.

### `status_mapper`
Maps vendor-specific statuses → canonical system statuses. Columns: `shipping_partner_id` FK, `partner_status`, `system_status`. Unique on `(shipping_partner_id, partner_status)`.

**Canonical system statuses (12):**
`NEW` | `OUT_FOR_PICKUP` | `PICKED_UP` | `IN_TRANSIT` | `OUT_FOR_DELIVERY` | `DELIVERED` | `UNDELIVERED` | `RETURN_INITIATED` | `RETURNED` | `CANCELLED` | `LOST` | `PICKUP_FAILED`

Seeded: 53 Shiprocket status mappings covering all known Shiprocket statuses.

### `order_tracking_logs`
One row per inbound webhook event. PK: `id` (bigserial). Columns: `order_id` (nullable FK, null for orphan events where AWB has no match), `shipping_partner_id` FK, `awb_no`, `system_status` (null if unmapped), `partner_status`, `partner_payload` (full raw JSONB — not exposed in API response), `event_timestamp` (parsed from payload), `received_at`. Indexes: `order_id`, `awb_no`, `received_at DESC`.

### `expenses`
PK: `id` (bigserial). Columns: `function_name` (CHECK: `MARKETING`|`EMPLOYEE`|`LOGISTIC`|`PACKAGING`|`SOFTWARE`|`PAYMENT_GATEWAY`|`MISCELLANEOUS`), `type` (nullable), `particulars`, `expense_date` (date), `base_amount` (numeric 10,2), `tax_amount` (numeric 10,2, default 0), `total_amount` (generated: `base_amount + tax_amount`), `remarks` (nullable), `is_recurring` (bool, default false), `created_at`, `updated_at`. Indexes: `expense_date DESC`, `function_name`.

---

## DB Trigger: `trg_inventory_change`

BEFORE UPDATE on `product_variants`. Guard: skips if no inventory columns changed (cost-only updates pass through silently).

- **Shopify sync mode** (only `inventory_quantity` changed): decrease → drain `physical` first, spill to `virtual`; increase → add delta to `virtual`
- **Manual mode** (`virtual` or `physical` explicitly set): recalculates `inventory_quantity = virtual + physical`

Both modes write to `inventory_logs`.

| Caller | `inventory_changed_by` |
|--------|----------------------|
| Inventory modal | `'admin'` |
| Product sync | `'shopify_sync'` |
| Bulk upload | `'bulk_upload'` |

---

## Pages & Components

| Route | File | Status |
|---|---|---|
| `/login` | `app/login/page.tsx` | Built |
| `/dashboard/overview` | `app/dashboard/overview/page.tsx` | Built (dummy metrics) |
| `/dashboard/orders` | `app/dashboard/orders/page.tsx` | Built — live data |
| `/dashboard/inventory` | `app/dashboard/inventory/page.tsx` | Built — live data |
| `/dashboard/settings` | `app/dashboard/settings/page.tsx` | Built |
| `/dashboard/expenses` | `app/dashboard/expenses/page.tsx` | Built — live data |
| `/dashboard/shipping` | — | Planned (Phase 3) |
| `/dashboard/ads` | — | Planned (Phase 5) |
| `/dashboard/reconciliation` | — | Planned (Phase 5) |

| Component | File | Notes |
|---|---|---|
| Sidebar | `components/layout/Sidebar.tsx` | Collapsible; `built: false` items show "Soon" badge |
| Header | `components/layout/Header.tsx` | Top bar + logout |
| MetricCard | `components/dashboard/MetricCard.tsx` | KPI card |
| OverviewCharts | `components/dashboard/OverviewCharts.tsx` | Recharts bar + area |

**Inventory page (`app/dashboard/inventory/page.tsx`):**
- **CostCell** — inline editable, saves via `PATCH /api/products/[variantId]/cost`
- **InventoryModal** — virtual/physical steppers, calculated total, remarks; calls `PATCH /api/products/[variantId]/inventory` which also pushes to Shopify
- **BulkOperationButton** — Download / Upload; upload shows result modal with Shopify push status

**Orders page (`app/dashboard/orders/page.tsx`):**
- **TrackingPanel** — fixed right slide-in panel (380px). Opened by clicking the AWB chip on any order row. Fetches `GET /api/orders/[orderId]/tracking` and renders a vertical timeline: system status badge + partner status text + timestamp. Empty state + loading skeleton. Backdrop click closes panel.
- AWB code in status column is a `<button>` with a `MapPin` icon — only shown when `awb_code` is present.

**Expenses page (`app/dashboard/expenses/page.tsx`):**
- **Summary cards** — Total Spend, Total Tax, Entries count. All reflect active filters.
- **Function breakdown strip** — compact pills showing spend per function, only functions with data shown.
- **Filter bar** — debounced keyword search (particulars/remarks), Function dropdown, Type text input, Date From/To. Default: last 30 days. Reset button appears when filters differ from default.
- **Expense table** — colored function badges, recurring icon (RefreshCw), inline delete confirmation (replaces action buttons in-row).
- **Add/Edit modal** — 9 fields: Function, Type, Particulars, Date, Base Amount, Tax Amount (live Total), Remarks, Recurring toggle.
- **CSV Export** — triggers `GET /api/expenses/export`, downloads full dataset regardless of active filters.

---

## Roadmap

- [x] Phase 1: Auth + Dashboard shell + Overview (dummy metrics)
- [x] Phase 1.5: Shopify orders sync + Settings page
- [x] Phase 2: Orders page — live data + Shiprocket sync
- [x] Phase 2.5: Inventory — cost tracking, virtual/physical split, bulk Excel, Shopify write-back
- [x] Phase 3: Shiprocket shipping updates — webhook ingestion, status mapping, tracking timeline UI
- [x] Phase 3.5: Expenses module — full CRUD, filters, summary cards, CSV export
- [ ] Phase 4: Voice AI triggers
- [ ] Phase 5: Meta Ads dashboard, Reconciliation
- [ ] Shopify sync: full historical order pagination
- [ ] Scheduled sync (cron)
