# Competition Scraper — CLAUDE.md

## Overview

Scrapes product + variant data from competitor Shopify stores using their public `/products.json` API. No browser or authentication required — works on any Shopify storefront.

Two pages under **Tools** in the sidebar:
- `/dashboard/tools/product-comparison` — manage competitor brands + trigger scrapes
- `/dashboard/tools/competition-products` — browse all scraped product/variant data

---

## Pages & Components

**`app/dashboard/tools/product-comparison/page.tsx`** — Competition Brands
- Multiselect table of competitor brands (checkboxes per row + select-all)
- "Add URL" CTA — opens `BrandModal` to create a new brand
- "Scrape Product Data" CTA — appears only when ≥1 brand is selected, shows count badge
- `BrandModal` — Add / Edit brand (Company Name + Shop URL)
- `ScrapeProgressModal` — live per-brand status during scrape (Pending → Fetching page N → Processing → Done / Error). "Done" button disabled until all brands settle
- `DeleteConfirmRow` — inline delete confirmation
- Brands table shows: Company, Shop URL, **Products Count**, **Last Synced**, Added date

**`app/dashboard/tools/competition-products/page.tsx`** — Competition Products
- Paginated table (50/page) of all scraped variants across all brands
- **Filter bar:** debounced keyword search (product title / variant / tags / SKU), Brand dropdown, Category dropdown, Available toggle (default: Available only), Price Min/Max range. Reset button when filters differ from default.
- **Row design** — Product column contains: Product Title (bold) + Variant Title (small) + Description (truncated 110 chars, muted) + Tag pills (max 3 shown, +N overflow). Separate columns for Brand/Category badges, Price (with strikethrough compare-at), Available status badge, and external link icon.
- Filter dropdowns populated from distinct values in `competition_products` (returned alongside first fetch)
- Empty state prompts user to scrape from Competition Brands page

---

## API Routes

### `GET /api/competition-brands`
`app/api/competition-brands/route.ts`
Calls `get_competition_brands_with_stats` RPC. Returns all brands ordered by `created_at DESC`, each with computed `products_count` and `last_synced`.
Falls back to plain `SELECT *` if RPC is unavailable.
Returns `{ brands: [...] }`.

### `POST /api/competition-brands`
Creates a new brand. Body: `{ company_name, shop_url }`. Returns 201 `{ success, brand }`.

### `PATCH /api/competition-brands/[id]`
Partial update. All fields optional. Sets `updated_at`. Returns `{ success, brand }`. 404 if not found.

### `DELETE /api/competition-brands/[id]`
Deletes brand row. Cascades to `competition_products`. Returns `{ success }`. 404 if not found.

### `GET /api/competition-products`
`app/api/competition-products/route.ts`
Paginated list of scraped variants (50/page).

**Query params:**
| Param | Type | Notes |
|-------|------|-------|
| `page` | number | default 1 |
| `search` | string | ilike on `product_title`, `variant_title`, `tags`, `sku` |
| `company_name` | string | exact match |
| `product_type` | string | exact match (shown as "Category" in UI) |
| `available` | `"true"` \| `"false"` \| `"all"` | default `"true"` |
| `price_min` | number | ≥ filter on `price` |
| `price_max` | number | ≤ filter on `price` |

Returns `{ products, total, page, pageSize, filter_options: { company_names, product_types } }`.
`filter_options` contains distinct values from the table — used to populate filter dropdowns. Returned on every request (lightweight).
Results ordered by `company_name ASC`, `product_title ASC`.

### `POST /api/competition-brands/scrape`
`app/api/competition-brands/scrape/route.ts`
**Streaming SSE endpoint.** Scrapes all selected brands in parallel.

**Auth:** None (internal dashboard only).

**Body:** `{ brandIds: number[] }`

**Response:** `Content-Type: text/event-stream` — each line is `data: <JSON>\n\n`

**Event types:**
```ts
{ type: "start",      brandId: number }
{ type: "page",       brandId: number, page: number, total: number }
{ type: "processing", brandId: number, count: number }
{ type: "done",       brandId: number, count: number }
{ type: "error",      brandId: number, message: string }
{ type: "complete" }   // fired once after all brands finish
```

**Per-brand logic:**
1. Fetch brand record from `competition_brands`
2. Parse `shop_url` via `parseShopifyUrl` → determines `baseUrl`, `collection`, `mode`
3. Paginate Shopify JSON endpoint (250 products/page, 500 ms delay between pages)
4. Flatten products × variants into rows via `extractRows`
5. `DELETE FROM competition_products WHERE competition_brand_id = ?`
6. `INSERT` fresh rows in batches of 500
7. Emit `done` or `error` event

Shopify push failure is non-fatal per brand — others continue regardless.

---

## Library: `lib/shopify-scraper.ts`

TypeScript port of `scrape_products.py`.

### `parseShopifyUrl(url)`
Parses a Shopify store or collection URL.
- Collection URL (`/collections/<handle>/...`) → `mode: "collection"`, `collection: handle`
- Store URL (no `/collections/`) → `mode: "all"`, `collection: <store-slug>`
- Auto-prepends `https://` if scheme is missing.

### `fetchShopifyProducts(baseUrl, mode, collection, onPage)`
Paginates the appropriate endpoint:
- `mode: "collection"` → `GET /collections/{collection}/products.json?limit=250&page=N`
  Falls back to `/products.json` if collection returns 0 products.
- `mode: "all"` → `GET /products.json?limit=250&page=N`

`onPage(page, total)` is called after each successful page fetch (used to stream progress).
500 ms polite delay between pages.

### `extractRows(products, baseUrl)`
Flattens Shopify product objects into `ScrapedProductRow[]`.
One row per variant. If a product has no variants, one row is added with empty variant fields.
`"Default Title"` variant title is normalised to `""`.
Variant-specific image is used when available; falls back to all product images joined with ` | `.

### `ScrapedProductRow` (exported type)
```ts
{
  product_title: string
  product_type: string
  tags: string
  variant_title: string
  price: number | null
  compare_at_price: number | null
  sku: string
  available: boolean | null
  description: string       // HTML stripped, whitespace collapsed
  image_urls: string        // space-pipe-space separated if multiple
  product_url: string       // https://{baseUrl}/products/{handle}
}
```

---

## Database Schema

### `competition_brands`
PK: `id` (bigserial). Columns: `company_name` (NOT NULL), `shop_url` (NOT NULL), `created_at`, `updated_at`.
Index: `created_at DESC`.

`products_count` and `last_synced` are **not stored** — computed at query time via `get_competition_brands_with_stats()` RPC.

### `competition_products`
PK: `id` (bigserial). FK: `competition_brand_id → competition_brands(id) ON DELETE CASCADE`.

| Column | Type | Notes |
|--------|------|-------|
| `competition_brand_id` | BIGINT NOT NULL | FK |
| `company_name` | TEXT | Denormalised for easy filtering |
| `product_title` | TEXT | |
| `product_type` | TEXT | |
| `tags` | TEXT | Comma-separated |
| `variant_title` | TEXT | Empty string if "Default Title" |
| `price` | NUMERIC(12,2) | |
| `compare_at_price` | NUMERIC(12,2) | |
| `sku` | TEXT | |
| `available` | BOOLEAN | |
| `description` | TEXT | HTML stripped |
| `image_urls` | TEXT | ` | ` separated |
| `product_url` | TEXT | Full URL |
| `scraped_at` | TIMESTAMPTZ | Set once per scrape run, same for all rows of a brand |

Indexes: `competition_brand_id`, `scraped_at DESC`.

Scrape strategy: **full replace** — all existing rows for a brand are deleted before inserting fresh data.

### `get_competition_brands_with_stats()` RPC
```sql
SELECT cb.*, COUNT(cp.id) AS products_count, MAX(cp.scraped_at) AS last_synced
FROM competition_brands cb
LEFT JOIN competition_products cp ON cp.competition_brand_id = cb.id
GROUP BY cb.id ...
ORDER BY cb.created_at DESC
```

---

## Scraper Behaviour Notes

- **No browser required** — uses Shopify's public unauthenticated `/products.json` endpoint
- **Rate limiting** — 500 ms delay between paginated requests per brand; multiple brands scrape in parallel
- **Timeout** — 15 s per page request (`AbortSignal.timeout`)
- **Collection fallback** — if `/collections/{handle}/products.json` returns 0 products, automatically retries with `/products.json`
- **Batch insert** — rows inserted in batches of 500 to stay within Supabase payload limits
- **Non-Shopify stores** — will fail gracefully with an error event; the JSON endpoint is Shopify-specific
