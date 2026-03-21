# P&L Module — Feature Reference

## Files

| File | Role |
|---|---|
| `app/api/pnl/route.ts` | API route — fetches RPCs + expenses, computes all margins |
| `app/dashboard/pnl/page.tsx` | Page — filter bar, KPI cards, waterfall table, trend chart |
| `supabase/migrations/006_create_get_pnl_data.sql` | Two Supabase RPCs |

---

## Data Sources

| Data | Source |
|---|---|
| Revenue + order count | `orders` + `order_line_items` |
| COGS | `product_variants.cost × oli.quantity` (current snapshot, not historical) |
| Operating expenses | `expenses` table (global — not channel-filtered) |

---

## P&L Waterfall (D2C CM Framework)

```
Gross Revenue         SUM(oli.line_total)                          [original_unit_price × qty]
  − Discounts         SUM(oli.line_total − oli.line_total_discounted)
  + Shipping Revenue  SUM(o.total_price − o.subtotal_price)
─────────────────────────────────────────────────────────────
Net Revenue           SUM(o.total_price)                           [exact identity, not approximation]
  − COGS              SUM(pv.cost × oli.quantity)  LEFT JOIN variant
─────────────────────────────────────────────────────────────
Gross Profit (CM1)    / Gross Margin %
  − Logistics         expenses WHERE function_name = 'LOGISTIC'
  − Packaging         expenses WHERE function_name = 'PACKAGING'
  − Payment Gateway   expenses WHERE function_name = 'PAYMENT_GATEWAY'
─────────────────────────────────────────────────────────────
CM2                   / CM2 %
  − Marketing         expenses WHERE function_name = 'MARKETING'
─────────────────────────────────────────────────────────────
CM3                   / CM3 %
  − Employee          expenses WHERE function_name = 'EMPLOYEE'
  − Software          expenses WHERE function_name = 'SOFTWARE'
  − Miscellaneous     expenses WHERE function_name = 'MISCELLANEOUS'
─────────────────────────────────────────────────────────────
EBITDA                / EBITDA %
```

All `%` columns = value / net_revenue × 100, rounded to 1 decimal. Zero net revenue → 0%.

RTO (orders with `sr_status IN ('RTO INITIATED', 'RTO DELIVERED')`) is shown for operational awareness only — **not subtracted from revenue**.

---

## Supabase RPCs

### `get_pnl_data(p_date_from, p_date_to, p_channel)`
Single-period snapshot. Filters: `cancelled_at IS NULL`, `DATE(created_at)` in range, optional `sales_channel` match. COGS uses `LEFT JOIN product_variants` so deleted variants contribute 0 COGS but don't drop revenue. Returns one row.

### `get_pnl_monthly_trend(p_months_back, p_channel)`
Monthly buckets. Always covers last `p_months_back + 1` months (called with 11 → last 12 months including current). Groups by `DATE_TRUNC('month', created_at)`. Returns `month_label`, `net_revenue`, `cogs`, `gross_profit` per month.

---

## API Logic (`GET /api/pnl`)

1. Parse `month` → derive `date_from = YYYY-MM-01`, `date_to = last day` (uses local date math, not `toISOString()` to avoid UTC offset shift).
2. `Promise.all` — RPC snapshot + RPC trend + expenses query.
3. Aggregate expenses by `function_name` in-process.
4. Return full `PnLResponse` with `revenue`, `expenses`, `rto`, `trend`, `meta`.

---

## Page (`app/dashboard/pnl/page.tsx`)

**Filters:** Month/Custom Range toggle → `<input type="month">` or two date inputs. Channel pills: All / Shopify / Amazon / Offline. Expenses note shown when channel ≠ ALL (expenses are always global).

**Fetch:** `useEffect` with `AbortController`. Returns early if custom mode and either date is empty. Checks `r.ok` before setting `data` — error responses go to `error` state, not `data`.

**Sub-components (all inline):**
- `KpiCard` — hero metrics (Net Revenue, Gross Margin %, CM3 %, EBITDA %)
- `PnLWaterfallTable` — static `WATERFALL_ROWS` config array drives rendering; result rows have coloured left border + tinted background; Info icon surfaces tooltips on hover
- `RtoStatsCard` — count + rate pill, non-subtraction disclaimer
- `PnLTrendChart` — Recharts `BarChart`, two series (Net Revenue `#d57282`, Gross Profit `#27a559`), custom tooltip component (no `formatter` prop — per CLAUDE.md Recharts caveat)
- `PnLSkeleton` — pulse placeholder for loading state

---

## Key Caveats

| Caveat | Where surfaced |
|---|---|
| COGS = current cost, not historical | Waterfall COGS row tooltip + footnote |
| Gross Revenue includes GST | Gross Revenue row tooltip |
| Expenses are global (no channel split) | Filter bar note when channel ≠ ALL |
| RTO not subtracted from revenue | RTO card disclaimer |
