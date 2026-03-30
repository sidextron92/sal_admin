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

### `POST /api/cron/sync`
`app/api/cron/sync/route.ts`
Protected dispatcher for scheduled sync jobs. Called by GitHub Actions on cron schedule.
Auth: `x-cron-secret` header must match `CRON_SECRET` env var — returns 401 otherwise.
Query param: `type` (`shopify-orders` | `shopify-products` | `shiprocket`). Derives origin from incoming request URL and delegates to the corresponding sync route internally.
Returns the sync result from the delegated route plus the `type` field.

**Scheduled via:** `.github/workflows/sync.yml` — GitHub Actions cron, runs 9x/day.
**Schedule (IST):** Every 2h during peak (9 AM–7 PM): 9, 11 AM, 1, 3, 5, 7 PM · Every 4h off-peak (7 PM–9 AM): 11 PM, 3 AM, 7 AM.
**Cron expression (UTC):** `30 1,3,5,7,9,11,13,17,21 * * *`
**Job order (sequential via `needs:`):** Shopify Products → Shopify Orders → Shiprocket.
**GitHub secrets required:** `APP_URL` (production URL, no trailing slash), `CRON_SECRET`.
**Vercel env required:** `CRON_SECRET` (same value as GitHub secret).

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

### `GET /api/purchase-invoices` · `POST /api/purchase-invoices`
`app/api/purchase-invoices/route.ts`
Paginated invoice list (30/page) with inline summary aggregation.
Query params: `page`, `search` (ilike on `vendor_name` OR `invoice_number`), `vendor` (exact match), `payment_status` (`PAID` | `UNPAID`), `date_from`, `date_to` (filter on `invoice_date`).
Returns `{ invoices, total, page, pageSize, summary: { total_invoices_amount, total_gst_amount, paid_count, unpaid_count } }`. Summary reflects same filters as list.
`POST` body: `{ invoice_number, invoice_date, vendor_name, vendor_gst?, total_amount, total_gst?, payment_date?, document_url?, document_path?, notes? }`. Returns 201 `{ success, invoice }`.

---

### `PATCH /api/purchase-invoices/[id]` · `DELETE /api/purchase-invoices/[id]`
`app/api/purchase-invoices/[id]/route.ts`
`PATCH` — partial update, all fields optional, sets `updated_at`. Returns `{ success, invoice }`. 404 if not found.
`DELETE` — fetches `document_path` first, removes file from Supabase Storage (non-fatal on failure), then deletes the row. Returns `{ success }`. 404 if not found.

---

### `GET /api/purchase-invoices/export`
`app/api/purchase-invoices/export/route.ts`
Returns CSV of matching invoices (same filter params as list — `search`, `vendor`, `payment_status`, `date_from`, `date_to`), ordered `invoice_date DESC`.
Columns: `Invoice Number, Invoice Date, Vendor Name, Vendor GST, Total Amount, Total GST, Payment Date, Payment Status, Notes, Created At`.
Headers: `Content-Type: text/csv`, `Content-Disposition: attachment; filename="maeri_purchase_invoices.csv"`.

---

### `POST /api/purchase-invoices/upload`
`app/api/purchase-invoices/upload/route.ts`
Accepts multipart form data with a `file` field. Validates MIME type (PDF/JPEG/PNG/WEBP) and 10 MB size limit.
Uploads to Supabase Storage bucket `documents` at path `invoices/{timestamp}-{sanitized_name}`.
Returns `{ success, url, path }` — caller passes both to POST/PATCH as `document_url` + `document_path`.

---

### `GET /api/pnl`
`app/api/pnl/route.ts`
Returns a full D2C P&L snapshot for a date range. See `docs/pnl_claude.md` for full logic.
Query params: `month` (YYYY-MM), `date_from`/`date_to` (YYYY-MM-DD, takes precedence), `channel` (`ALL|Shopify|Amazon|Offline`, default `ALL`). Default: current month.
Returns `{ revenue, expenses, rto, trend, meta }`. All margin computations done server-side via two Supabase RPCs (`get_pnl_data`, `get_pnl_monthly_trend`) + in-process expense aggregation.

---

### `GET /api/analytics`
`app/api/analytics/route.ts`
Returns order analytics for a date range. See `docs/analytics_claude.md` for full RPC and page logic.
Query params: `date_from`/`date_to` (YYYY-MM-DD). Default: last 30 days.
Calls 7 RPCs in parallel. Returns `{ summary: { current, prev }, locations: { by_city, by_state }, variants: { all, organic, inorganic }, channel_split, meta }`.
All three variant sets (all/organic/inorganic) are pre-fetched — UI toggles are instant.
**Organic/inorganic split:** uses `NULLIF(TRIM(last_utm_campaign), '') IS NULL/NOT NULL` — Shopify sync stores `''` (not `NULL`) when no UTM is present; plain `IS NULL` check would mark all orders as organic.

---

### `GET /api/visualizations`
`app/api/visualizations/route.ts`
Paginated visualizer plugin records (30/page) with search + filtering. Reads from `visualizations` table.
Query params: `page`, `search` (ilike on product_title/product_handle/utm_source/utm_campaign), `product_type` (ilike), `date_from`, `date_to`.
Returns `{ visualizations, total, page, pageSize, product_types }`. `product_types` is a distinct list for the filter dropdown.

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

### `purchase_invoices`
PK: `id` (bigserial). Columns: `invoice_number` (text, NOT NULL), `invoice_date` (date, NOT NULL), `vendor_name` (text, NOT NULL), `vendor_gst` (nullable), `total_amount` (numeric 12,2, ≥ 0), `total_gst` (numeric 12,2, default 0, ≥ 0), `payment_date` (date, nullable), `payment_status` (generated: `'PAID'` if `payment_date IS NOT NULL` else `'UNPAID'`), `document_url` (nullable), `document_path` (nullable — Supabase Storage path for deletion), `notes` (nullable), `created_at`, `updated_at`. Indexes: `invoice_date DESC`, `vendor_name`, `payment_status`.

**`payment_status` is a GENERATED ALWAYS AS STORED column** — never include it in INSERT or UPDATE statements.

### `visualizations`
PK: `id` (uuid, default `gen_random_uuid()`). Columns: `created_at` (timestamptz), `product_id` (bigint), `product_title`, `product_handle`, `product_type`, `product_price` (bigint, in **paisa** — divide by 100 for INR), `variant_id` (bigint), `shop_domain`, `customer_id` (bigint, nullable), `utm_source/medium/campaign/term/content` (all nullable), `user_agent` (nullable), `room_image_url` (nullable — customer's uploaded room photo), `generated_image_url` (nullable — AI-generated visualization). Written externally by the Shopify Visualizer plugin, read-only in this app.

### Supabase Storage — `documents` bucket
Public bucket. Max file size 50 MB. Allowed types: PDF, JPEG, PNG, WEBP.
Invoice PDFs stored at path `invoices/{timestamp}-{sanitized_filename}`.
`supabaseAdmin` (service role) bypasses RLS — no explicit storage policies needed for server-side uploads.

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
| `/dashboard/purchase-invoices` | `app/dashboard/purchase-invoices/page.tsx` | Built — live data |
| `/dashboard/analytics` | `app/dashboard/analytics/page.tsx` | Built — live data |
| `/dashboard/tools/visualizer` | `app/dashboard/tools/visualizer/page.tsx` | Built — live data |
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

**Purchase Invoices page (`app/dashboard/purchase-invoices/page.tsx`):**
- **Summary cards** — Total Invoice Value, Total GST, Paid/Unpaid counts. All reflect active filters.
- **Filter bar** — debounced keyword search (vendor_name/invoice_number), Payment Status dropdown (All/PAID/UNPAID), Date From/To. Default: last 90 days. Reset button when filters differ from default.
- **Invoice table** — Invoice No., Date, Vendor, GST No., Amount, GST, Payment Date, Status badge (green=PAID, amber=UNPAID), Document link (ExternalLink opens PDF in new tab), inline delete confirmation.
- **Add/Edit modal** — 9 fields: Invoice Number, Invoice Date, Vendor Name, Vendor GST, Total Amount, Total GST, Payment Date (blank = Unpaid), Notes, Document upload. Live "Total Payable" row.
- **Document upload** — dashed upload area, calls `POST /api/purchase-invoices/upload`, shows filename on success with Remove option.
- **CSV Export** — triggers `GET /api/purchase-invoices/export` with active filters applied.

**Analytics page (`app/dashboard/analytics/page.tsx`):**
- No KPI cards — charts only. Default period: last 30 days vs previous 30 days.
- **Top 10 Locations** — horizontal bar, City/State toggle (instant, no re-fetch).
- **Top 10 Variants** — horizontal bar, By Units/By GMV sort + All/Organic/Inorganic source toggle (all instant).
- **Channel Split** — donut (Shopify/Amazon/Offline).
- **RTO Rate** — large % + delta badge (inverted colors: red = worse, green = improved).
- **COD vs Prepaid** — donut with legend.
- See `docs/analytics_claude.md` for full RPC definitions and chart logic.

**Visualizer page (`app/dashboard/tools/visualizer/page.tsx`):**
- **Card grid** (responsive: 1/2/3 cols) — each card shows room + generated image thumbnails side by side, product info (title, type badge, price), UTM pills, device type, relative timestamp.
- **Filter bar** — debounced search (product title/handle/UTM), Product Type dropdown, Date From/To. Default: last 30 days.
- **Image preview modal** — full-screen overlay on thumbnail click, ESC/backdrop to close.
- Read-only — no CRUD operations, data written by external Shopify plugin.

---

## Roadmap

- [x] Phase 1: Auth + Dashboard shell + Overview (dummy metrics)
- [x] Phase 1.5: Shopify orders sync + Settings page
- [x] Phase 2: Orders page — live data + Shiprocket sync
- [x] Phase 2.5: Inventory — cost tracking, virtual/physical split, bulk Excel, Shopify write-back
- [x] Phase 3: Shiprocket shipping updates — webhook ingestion, status mapping, tracking timeline UI
- [x] Phase 3.5: Expenses module — full CRUD, filters, summary cards, CSV export
- [x] Phase 3.6: Purchase Invoices module — full CRUD, PDF upload to Supabase Storage, filters, CSV export
- [x] Phase 3.7: Analytics module — top locations, top variants, RTO rate, COD/Prepaid split, channel split
- [ ] Phase 4: Voice AI triggers
- [ ] Phase 5: Meta Ads dashboard, Reconciliation
- [ ] Shopify sync: full historical order pagination
- [x] Scheduled sync — GitHub Actions cron, 9x/day, sequential (Products → Orders → Shiprocket)
