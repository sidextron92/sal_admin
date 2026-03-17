# Maeri Control Centre — CLAUDE.md

Developer reference for the Maeri admin dashboard. Read this before making changes.

---

## Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS v4 + inline styles for brand tokens
- **UI components:** shadcn/ui backed by `@base-ui/react` (NOT Radix UI)
- **Charts:** Recharts
- **Database:** Supabase (PostgreSQL)
- **External APIs:** Shopify Admin GraphQL API, Shiprocket REST API

---

## Key Caveats

- **`@base-ui/react` ≠ Radix UI** — no `asChild` prop on Tooltip. Use `render={<div />}` on `TooltipTrigger` for custom elements.
- **Recharts Tooltip `formatter`** — param type is `ValueType`, not `number`. Don't type it explicitly.
- **Next.js 16** — shows deprecation warning for `"middleware"` → `"proxy"`. Harmless, ignore it.
- **Shopify PII restriction** — Shopify plan does not allow access to `customer { firstName lastName email phone }` or `shippingAddress`. Customer details come from Shiprocket instead.

---

## Auth

**Hardcoded single-user auth** (no Supabase Auth).

- Credentials: `admin@maeri.in` / `maeri2026` (set via env `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
- Session cookie: `sal_session=authenticated` (HttpOnly, 7-day expiry)
- Middleware in `middleware.ts` protects all `/dashboard/*` routes

Flow:
```
POST /api/auth/login  →  validates credentials  →  sets sal_session cookie
POST /api/auth/logout →  clears sal_session cookie
/ (root)              →  redirects to /dashboard/overview or /login based on cookie
```

Public paths (no auth required): `/login`, `/api/auth/login`

---

## API Routes

### `POST /api/auth/login`
**File:** `app/api/auth/login/route.ts`

Validates email + password against env vars. On success sets `sal_session=authenticated` HttpOnly cookie (7 days). Returns `{ success: true }` or `{ success: false, error }` with 401.

---

### `POST /api/auth/logout`
**File:** `app/api/auth/logout/route.ts`

Clears the `sal_session` cookie by setting `maxAge: 0`. Always returns `{ success: true }`.

---

### `POST /api/sync/shopify`
**File:** `app/api/sync/shopify/route.ts`

Fetches Shopify orders updated in the last 7 days and upserts them into Supabase.

**Steps:**
1. Calls `fetchOrders(250, 7)` from `lib/shopify.ts` — filters by `updated_at >= 7 days ago`
2. Upserts into `orders` table — conflict on `order_id` (inserts new, updates existing)
3. Upserts into `order_line_items` in batches of 500 — conflict on `line_item_id`
4. Inserts a row into `sync_log` with counts + duration

**Upsert behaviour:** Safe to run repeatedly — no duplicates. New orders are inserted; existing orders are overwritten with fresh data.

**Typical volume:** ~50 orders per sync run. Completes in ~3s.

Returns:
```json
{ "success": true, "orders": 53, "items": 64, "duration_ms": 3001 }
```

---

### `GET /api/sync/shopify`
**File:** `app/api/sync/shopify/route.ts`

Returns the last 10 rows from `sync_log`, ordered by `synced_at DESC`.

```json
{ "logs": [ { "id", "synced_at", "orders_upserted", "items_upserted", "status", "error_message", "duration_ms" } ] }
```

---

### `POST /api/sync/shiprocket`
**File:** `app/api/sync/shiprocket/route.ts`

Fetches Shiprocket orders updated in the last 7 days and updates matching rows in the `orders` table by matching `order_name` to `#${channel_order_id}`.

**Fields updated:** `customer_name`, `customer_email`, `customer_phone`, `customer_city`, `customer_state`, `sr_order_id`, `sr_status`, `payment_method`, `awb_code`, `courier_name`, `etd`.

**Note:** Only orders that already exist in `orders` (synced from Shopify) are updated. Shiprocket rows with no matching `order_name` are silently skipped.

**Typical volume:** ~36 orders per sync run. Completes in ~6s.

Returns:
```json
{ "success": true, "fetched": 36, "updated": 36, "duration_ms": 6319 }
```

---

### `GET /api/orders`
**File:** `app/api/orders/route.ts`

Paginated orders list with search and filtering. Joins `order_line_items` for product names.

**Query params:**
- `page` — page number (default 1, 30/page)
- `search` — ilike match on `order_name`, `customer_name`, `customer_phone`
- `status` — exact match on `sr_status`; `"IN TRANSIT"` uses prefix match to capture variants
- `payment` — exact match on `payment_method` (`cod` | `prepaid`)

Returns:
```json
{ "orders": [...], "total": 250, "page": 1, "pageSize": 30 }
```

---

## Library Modules

### `lib/shopify.ts`

Shopify Admin GraphQL client. Reads from env:
- `SHOPIFY_DOMAIN` — e.g. `ab0f6f-61.myshopify.com`
- `SHOPIFY_ACCESS_TOKEN` — private app token (`shpat_*`)
- `SHOPIFY_API_VERSION` — e.g. `2025-07`

**`fetchOrders(limit = 250, daysBack = 7)`**
Single GraphQL query that fetches order header + marketing journey + line items in one call. Returns `{ orders: ShopifyOrder[], lineItems: ShopifyLineItem[] }`.

- Filters by `updated_at >= {daysBack} days ago` using Shopify's `query` filter param
- Sorted by `UPDATED_AT DESC`
- Pass `daysBack=0` to skip the date filter and fetch the latest `limit` orders (useful for a one-off full backfill)

The query fetches:
- Order: id, name, timestamps, customer id, financials, statuses, tags, note
- `customAttributes` (Shopify's `note_attributes`) — contains UTM params set by Fastrr checkout
- Customer journey: first + last visit with landing page, referrer, source, marketing channel/type, UTM params
- Line items (up to 50 per order): title, quantity, pricing, product, variant

**UTM fallback logic:** Fastrr checkout writes UTM params into `customAttributes` rather than firing Shopify's journey pixel, so `customerJourneySummary.firstVisit` / `lastVisit` are often `null` for Fastrr orders. When journey visit data is null, UTM fields (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `landing_page_url`) are populated from `customAttributes` instead. Journey data always takes priority when present.

Shopify GIDs (e.g. `gid://shopify/Order/123`) are stripped to just the numeric ID.

**Types exported:** `ShopifyOrder`, `ShopifyLineItem`, `FetchOrdersResult`

---

### `lib/shiprocket.ts`

Shiprocket REST API client. Reads from env:
- `SHIPROCKET_EMAIL` — API user email
- `SHIPROCKET_PASSWORD` — API user password

**Base URL:** `https://apiv2.shiprocket.in/v1/external`

**`fetchShiprocketOrders()`**
Authenticates (POST `/auth/login`), then paginates through GET `/orders` (100/page) using `updated_from`/`updated_to` for the last 7 days. Returns `ShiprocketOrderRow[]`.

- Uses `updated_from` / `updated_to` params (Shiprocket API constraint: both required together, max 30-day window, max 30-day lookback)
- **`updated_to` is always set to tomorrow** — Shiprocket treats the date as `00:00:00`, so using today excludes orders updated during the current day
- The join key is `order_name: '#${channel_order_id}'` which matches `orders.order_name` in Supabase
- **ETD handling:** `0000-00-00 00:00:00` values are coerced to `null`
- **`daysBack` constant:** set to `7` inside the function — adjust if needed (max 30)

**Sync strategy rationale:** `updated_at` covers both new orders (created_at = updated_at) and existing orders with status changes (shipment updates, RTO, delivery). This avoids the previous issue of the default endpoint silently truncating to ~119 recent orders.

**IP allowlist note:** Shiprocket API user is IP-restricted. Current allowed IP: `106.215.80.229` (local dev). For Vercel deployment, update to `0.0.0.0/0` or a fixed-IP proxy.

**Types exported:** `ShiprocketOrderRow`

---

### `lib/supabase.ts`

Exports a single server-side Supabase admin client:

```ts
import { supabaseAdmin } from '@/lib/supabase'
```

Uses `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS. Only use server-side (API routes, server components). Never expose to the client.

---

## Database Schema (Supabase)

### `orders`
One row per Shopify order. Primary key: `order_id` (Shopify numeric ID as TEXT).

**Shopify-sourced columns:** `order_id`, `order_name`, `created_at`, `updated_at`, `customer_id`, `total_price`, `subtotal_price`, `total_tax`, `currency`, `financial_status`, `fulfillment_status`, `confirmed`, `cancelled_at`, `cancel_reason`, `tags`, `note`, `line_items_count`, `customer_order_index`, `days_to_conversion`, UTM/journey fields (first + last visit × 10 cols each), `synced_at`.

**Shiprocket-sourced columns:** `customer_name`, `customer_email`, `customer_phone`, `customer_city`, `customer_state`, `sr_order_id`, `sr_status`, `payment_method`, `awb_code`, `courier_name`, `etd`.

**Unused columns (always null — Shopify PII blocked):** `customer_first_name`, `customer_last_name`.

Indexes: `created_at DESC`, `financial_status`, `customer_id`

**Known `sr_status` values:** `NEW`, `PICKED UP`, `IN TRANSIT`, `IN TRANSIT-EN-ROUTE`, `IN TRANSIT-AT DESTINATION HUB`, `DELIVERED`, `RTO INITIATED`, `RTO DELIVERED`, `CANCELED`, `UNDELIVERED-3RD ATTEMPT`, `SELF FULFILLED`

---

### `order_line_items`
One row per line item. Primary key: `line_item_id`. Foreign key: `order_id → orders(order_id) ON DELETE CASCADE`.

Key columns: `line_item_id`, `order_id`, `title`, `quantity`, `original_unit_price`, `discounted_unit_price`, `total_discount`, `currency`, `line_total`, `line_total_discounted`, `product_id`, `product_title`, `product_handle`, `vendor`, `product_type`, `variant_id`, `variant_title`, `sku`, `synced_at`.

Indexes: `order_id`, `product_id`

---

### `sync_log`
Tracks every Shopify sync run. Columns: `id` (bigserial), `synced_at`, `orders_upserted`, `items_upserted`, `status` (`success` | `error`), `error_message`, `duration_ms`.

---

## Pages & Components

### Pages

| Route | File | Status |
|---|---|---|
| `/login` | `app/login/page.tsx` | Built |
| `/dashboard/overview` | `app/dashboard/overview/page.tsx` | Built (dummy metrics) |
| `/dashboard/orders` | `app/dashboard/orders/page.tsx` | Built — live data |
| `/dashboard/settings` | `app/dashboard/settings/page.tsx` | Built |
| `/dashboard/shipping` | — | Planned (Phase 3) |
| `/dashboard/inventory` | — | Planned |
| `/dashboard/ads` | — | Planned (Phase 5) |
| `/dashboard/reconciliation` | — | Planned (Phase 5) |

### Key Components

| Component | File | Notes |
|---|---|---|
| Sidebar | `components/layout/Sidebar.tsx` | Collapsible; `built: false` items show "Soon" badge and are non-clickable |
| Header | `components/layout/Header.tsx` | Top bar + logout button |
| MetricCard | `components/dashboard/MetricCard.tsx` | KPI card |
| OverviewCharts | `components/dashboard/OverviewCharts.tsx` | Recharts bar + area |

---

## Roadmap

- [x] Phase 1: Auth + Dashboard shell + collapsible sidebar + Overview (dummy metrics)
- [x] Phase 1.5: Shopify sync — orders + line items → Supabase + Settings page
- [x] Phase 2: My Orders page — live data from Supabase + Shiprocket customer/shipment sync
- [ ] Phase 3: Shiprocket shipping updates (tracking timeline, NDR management)
- [ ] Phase 4: Voice AI triggers
- [ ] Phase 5: Meta Ads dashboard, Reconciliation
- [ ] Shopify sync: full pagination (all historical orders)
- [ ] Scheduled sync (cron job)
