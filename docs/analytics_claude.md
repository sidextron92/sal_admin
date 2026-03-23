# Analytics Module — Reference

## Overview

Live analytics page at `/dashboard/analytics`. Covers last 30 days vs previous 30 days.
No KPI header cards — five chart sections only.

**Files:**
- Page: `app/dashboard/analytics/page.tsx`
- API: `app/api/analytics/route.ts`
- Migration: `supabase/migrations/20260321000000_analytics_rpcs.sql` + `analytics_fix_organic_empty_string`

---

## API Route — `GET /api/analytics`

**Default period:** `date_to = today`, `date_from = today − 29 days` (last 30 days inclusive).
**Query params:** `date_from`, `date_to` (YYYY-MM-DD, both required to override default).

Fires **7 RPC calls in parallel** via `Promise.all`:

| Call | RPC | Params |
|---|---|---|
| summary | `get_analytics_summary` | `p_date_from`, `p_date_to` |
| locations city | `get_analytics_top_locations` | + `p_mode: 'city'` |
| locations state | `get_analytics_top_locations` | + `p_mode: 'state'` |
| variants all | `get_analytics_top_variants` | + `p_organic: 'all'` |
| variants organic | `get_analytics_top_variants` | + `p_organic: 'organic'` |
| variants inorganic | `get_analytics_top_variants` | + `p_organic: 'inorganic'` |
| channel split | `get_analytics_channel_split` | `p_date_from`, `p_date_to` |

**Response shape:**
```ts
{
  summary: {
    current: { order_count, gmv, rto_count, rto_rate_pct, cod_count, prepaid_count },
    prev:    { order_count, gmv, rto_count, rto_rate_pct, cod_count, prepaid_count },
  },
  locations: {
    by_city:  LocationRow[],   // { location, order_count, gmv }
    by_state: LocationRow[],
  },
  variants: {
    all:       VariantRow[],   // { variant_label, qty_sold, gmv }
    organic:   VariantRow[],
    inorganic: VariantRow[],
  },
  channel_split: ChannelRow[], // { channel, order_count, gmv }
  meta: { date_from, date_to },
}
```

All numeric fields are coerced to `Number()` before returning (Supabase returns bigint/numeric as strings).

---

## RPC Definitions

All RPCs share this cancellation filter:
```sql
AND COALESCE(sr_status,'') <> 'CANCELED'
AND COALESCE(financial_status,'') <> 'CANCELLED'
```

### `get_analytics_summary(p_date_from, p_date_to)`
Returns two rows: `period = 'current'` and `period = 'previous'`.

**Previous period** = window of equal length immediately before `p_date_from`:
- `prev_from = p_date_from − (p_date_to − p_date_from + 1)`
- `prev_to   = p_date_from − 1`

Fields per row: `order_count`, `gmv` (SUM total_price), `rto_count` (sr_status IN `'RTO INITIATED'`,`'RTO DELIVERED'`), `rto_rate_pct` (1 decimal, 0 if no orders), `cod_count` / `prepaid_count` (LOWER(payment_method) match).

---

### `get_analytics_top_locations(p_date_from, p_date_to, p_mode)`
`p_mode`: `'city'` (default) or `'state'`.
Groups on `customer_city` or `customer_state` respectively. Empty/NULL values → `'Unknown'`.
Returns top 10 by `order_count DESC`. Fields: `location`, `order_count`, `gmv`.

**UI note:** `'Unknown'` rows are filtered out in the page before rendering — they aren't actionable.

---

### `get_analytics_top_variants(p_date_from, p_date_to, p_organic)`
Joins `order_line_items` → `orders`. Groups on `oli.title`.
`p_organic` controls attribution filter:

| Value | Condition |
|---|---|
| `'all'` | No filter (TRUE) |
| `'organic'` | `NULLIF(TRIM(o.last_utm_campaign), '') IS NULL` |
| `'inorganic'` | `NULLIF(TRIM(o.last_utm_campaign), '') IS NOT NULL` |

**Critical gotcha:** Shopify sync stores `''` (empty string) when no UTM campaign is present — NOT `NULL`. A plain `IS NULL` check incorrectly marks all orders as organic. Always use `NULLIF(TRIM(...), '')` to normalise.

Returns top 10 by `qty_sold DESC`. Fields: `variant_label`, `qty_sold`, `gmv` (rounded to 2dp).

---

### `get_analytics_channel_split(p_date_from, p_date_to)`
Groups on `sales_channel`. Empty/NULL values → `'Unknown'`.
Returns all channels (no LIMIT), ordered by `gmv DESC`.
Fields: `channel`, `order_count`, `gmv`.

---

## Page Logic — `app/dashboard/analytics/page.tsx`

**State:**
```ts
data: AnalyticsData | null        // full API response
loading: boolean
locationMode: 'city' | 'state'    // toggles between by_city / by_state
variantSort: 'units' | 'gmv'      // client-side sort of active source
variantSource: 'all' | 'organic' | 'inorganic'  // which pre-fetched array to use
```

All toggles are **instant** — no network requests after initial load. All three variant sets and both location modes are pre-fetched on mount.

**Derived data (computed in render):**
- `locationData` = `data.locations[by_{locationMode}]` filtered to remove `location === 'Unknown'`
- `variantData` = `data.variants[variantSource]` filtered (no Unknown) → sorted by `variantSort` → sliced to top 10
- `channelDonutData` = channel_split mapped to `{ name, value: order_count }`
- `paymentDonutData` = `[{ name: 'COD', value: cod_count }, { name: 'Prepaid', value: prepaid_count }]`

---

## Chart Implementation

### Horizontal Bar Charts (Locations + Variants)
- Recharts `BarChart layout="vertical"`
- `YAxis type="category"` `width={140}` — category labels
- `XAxis type="number"` — numeric axis, `tickFormatter` for GMV view (`fmtINR`: `₹Xk` / `₹X.XL`)
- Data sorted **descending** before render so highest value appears at top of chart
- Single `Bar fill="#d57282"` `radius={[0,4,4,0]}`
- Chart height: `Math.max(180, rows * 32)` — grows with data

### Donut Charts (Channel + COD/Prepaid)
- Recharts `PieChart` 180×180, `Pie innerRadius={55} outerRadius={80}`
- `startAngle={90} endAngle={-270}` — starts from top, clockwise
- Center label: absolutely-positioned div over relative wrapper showing total + "orders"
- Legend below: colored square + name + count + percentage
- Colors:
  - Channel: Shopify `#d57282`, Amazon `#f4a56e`, Offline `#8ec9b0`, Unknown `#c4b0b0`
  - Payment: COD `#f4a56e`, Prepaid `#27a559`

### RTO Rate Card
- Large `rto_rate_pct%` current value
- Delta badge: `current − prev` in percentage points
- **Inverted color logic** (lower RTO = better): positive delta → red badge (`▲`), negative delta → green badge (`▼`)
- Secondary line shows prev period count + rate for context

---

## Layout

```
Row 1: [Top 10 Locations (50%)] [Channel Split (50%)]
Row 2: [Top 10 Variants (100%)]
Row 3: [RTO Rate (50%)] [COD vs Prepaid (50%)]
```

Grid: `grid-cols-1 lg:grid-cols-2 gap-5`. Responsive — stacks to single column on mobile.
Card style: `bg-white`, `boxShadow: 0 2px 16px rgba(213,114,130,0.07)`, `border: 1px solid #f0ebe6`, `rounded-2xl`.
Loading state: `animate-pulse` skeleton divs at matching heights.
