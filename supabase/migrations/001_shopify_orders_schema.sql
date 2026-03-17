-- Maeri Shopify Orders Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/qvclrvbmdhfjhkrnmosh/sql/new

-- ============================================================
-- ORDERS (aggregated order header + marketing journey data)
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  -- Primary key: Shopify order ID (numeric part of gid)
  order_id          TEXT PRIMARY KEY,
  order_name        TEXT,                        -- e.g. "#1001"
  created_at        TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ,
  customer_id       TEXT,

  -- Financials
  total_price       NUMERIC(12, 2),
  subtotal_price    NUMERIC(12, 2),
  total_tax         NUMERIC(12, 2),
  currency          TEXT DEFAULT 'INR',

  -- Status
  financial_status    TEXT,                      -- PAID, PENDING, REFUNDED, etc.
  fulfillment_status  TEXT,                      -- FULFILLED, UNFULFILLED, etc.
  confirmed           BOOLEAN DEFAULT TRUE,
  cancelled_at        TIMESTAMPTZ,
  cancel_reason       TEXT,

  -- Metadata
  tags                TEXT,
  note                TEXT,
  line_items_count    INTEGER DEFAULT 0,

  -- Customer journey (first touch)
  customer_order_index  INTEGER,                 -- 0 = new customer, >0 = returning
  days_to_conversion    INTEGER,
  first_landing_page    TEXT,
  first_referrer        TEXT,
  first_source          TEXT,
  first_marketing_channel TEXT,
  first_marketing_type  TEXT,
  first_utm_campaign    TEXT,
  first_utm_content     TEXT,
  first_utm_medium      TEXT,
  first_utm_source      TEXT,
  first_utm_term        TEXT,

  -- Customer journey (last touch)
  last_landing_page     TEXT,
  last_referrer         TEXT,
  last_source           TEXT,
  last_marketing_channel TEXT,
  last_marketing_type   TEXT,
  last_utm_campaign     TEXT,
  last_utm_content      TEXT,
  last_utm_medium       TEXT,
  last_utm_source       TEXT,
  last_utm_term         TEXT,

  synced_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ORDER LINE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS order_line_items (
  line_item_id          TEXT PRIMARY KEY,        -- Shopify line item ID
  order_id              TEXT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,

  -- Item details
  title                 TEXT,
  quantity              INTEGER DEFAULT 1,
  original_unit_price   NUMERIC(12, 2),
  discounted_unit_price NUMERIC(12, 2),
  total_discount        NUMERIC(12, 2) DEFAULT 0,
  currency              TEXT DEFAULT 'INR',
  line_total            NUMERIC(12, 2),          -- original_price * quantity
  line_total_discounted NUMERIC(12, 2),          -- discounted_price * quantity

  -- Product
  product_id            TEXT,
  product_title         TEXT,
  product_handle        TEXT,
  vendor                TEXT,
  product_type          TEXT,

  -- Variant
  variant_id            TEXT,
  variant_title         TEXT,
  sku                   TEXT,

  synced_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES for common query patterns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_created_at      ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_financial_status ON orders (financial_status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id      ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_line_items_order_id     ON order_line_items (order_id);
CREATE INDEX IF NOT EXISTS idx_line_items_product_id   ON order_line_items (product_id);

-- ============================================================
-- SYNC LOG (tracks each sync run)
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_log (
  id              BIGSERIAL PRIMARY KEY,
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
  orders_upserted INTEGER DEFAULT 0,
  items_upserted  INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'success',        -- 'success' | 'error'
  error_message   TEXT,
  duration_ms     INTEGER
);
