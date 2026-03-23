-- Fix: get_pnl_data and get_pnl_monthly_trend were summing order-level columns
-- (total_price, subtotal_price) through a JOIN with order_line_items, causing
-- those values to be counted N times for orders with N line items.
-- Fix: order-level aggregates now query orders directly; line-item aggregates
-- remain in the JOIN query.

CREATE OR REPLACE FUNCTION public.get_pnl_data(
  p_date_from date,
  p_date_to   date,
  p_channel   text DEFAULT 'ALL'
)
RETURNS TABLE(
  gross_revenue    numeric,
  total_discounts  numeric,
  shipping_revenue numeric,
  net_revenue      numeric,
  cogs             numeric,
  order_count      integer,
  rto_count        integer
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_gross_revenue    numeric := 0;
  v_discounts        numeric := 0;
  v_cogs             numeric := 0;
  v_net_revenue      numeric := 0;
  v_shipping_revenue numeric := 0;
  v_order_count      integer := 0;
  v_rto_count        integer := 0;
BEGIN

  -- Line-item aggregates: gross revenue, discounts, COGS
  -- Each row is one line item — no inflation risk
  SELECT
    COALESCE(SUM(oli.line_total), 0),
    COALESCE(SUM(oli.line_total - oli.line_total_discounted), 0),
    COALESCE(SUM(pv.cost * oli.quantity), 0)
  INTO v_gross_revenue, v_discounts, v_cogs
  FROM orders o
  JOIN order_line_items oli ON oli.order_id = o.order_id
  LEFT JOIN product_variants pv ON pv.variant_id = oli.variant_id
  WHERE o.cancelled_at IS NULL
    AND DATE(o.created_at) >= p_date_from
    AND DATE(o.created_at) <= p_date_to
    AND (p_channel = 'ALL' OR o.sales_channel = p_channel);

  -- Order-level aggregates: net revenue, shipping, count
  -- Queried directly from orders — no JOIN, no duplication
  SELECT
    COALESCE(SUM(total_price), 0),
    COALESCE(SUM(total_price - subtotal_price), 0),
    COUNT(DISTINCT order_id)
  INTO v_net_revenue, v_shipping_revenue, v_order_count
  FROM orders
  WHERE cancelled_at IS NULL
    AND DATE(created_at) >= p_date_from
    AND DATE(created_at) <= p_date_to
    AND (p_channel = 'ALL' OR sales_channel = p_channel);

  -- RTO count
  SELECT COUNT(DISTINCT order_id)
  INTO v_rto_count
  FROM orders
  WHERE cancelled_at IS NULL
    AND sr_status IN ('RTO INITIATED', 'RTO DELIVERED')
    AND DATE(created_at) >= p_date_from
    AND DATE(created_at) <= p_date_to
    AND (p_channel = 'ALL' OR sales_channel = p_channel);

  RETURN QUERY SELECT
    v_gross_revenue, v_discounts, v_shipping_revenue,
    v_net_revenue, v_cogs, v_order_count, v_rto_count;
END;
$$;


CREATE OR REPLACE FUNCTION public.get_pnl_monthly_trend(
  p_months_back integer DEFAULT 11,
  p_channel     text    DEFAULT 'ALL'
)
RETURNS TABLE(
  month_start  date,
  month_label  text,
  net_revenue  numeric,
  cogs         numeric,
  gross_profit numeric
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH order_totals AS (
    -- One row per order — sum total_price safely at order granularity
    SELECT
      DATE_TRUNC('month', created_at)::date              AS month_start,
      TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YY') AS month_label,
      SUM(total_price)                                   AS net_revenue
    FROM orders
    WHERE cancelled_at IS NULL
      AND created_at >= DATE_TRUNC('month', NOW()) - (p_months_back || ' months')::interval
      AND (p_channel = 'ALL' OR sales_channel = p_channel)
    GROUP BY 1, 2
  ),
  cogs_by_month AS (
    -- One row per line item — summing cost × qty is correct here
    SELECT
      DATE_TRUNC('month', o.created_at)::date  AS month_start,
      COALESCE(SUM(pv.cost * oli.quantity), 0) AS cogs
    FROM orders o
    JOIN order_line_items oli ON oli.order_id = o.order_id
    LEFT JOIN product_variants pv ON pv.variant_id = oli.variant_id
    WHERE o.cancelled_at IS NULL
      AND o.created_at >= DATE_TRUNC('month', NOW()) - (p_months_back || ' months')::interval
      AND (p_channel = 'ALL' OR o.sales_channel = p_channel)
    GROUP BY 1
  )
  SELECT
    ot.month_start,
    ot.month_label,
    ot.net_revenue,
    COALESCE(c.cogs, 0)                  AS cogs,
    ot.net_revenue - COALESCE(c.cogs, 0) AS gross_profit
  FROM order_totals ot
  LEFT JOIN cogs_by_month c ON c.month_start = ot.month_start
  ORDER BY ot.month_start;
END;
$$;
