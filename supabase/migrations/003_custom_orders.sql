ALTER TABLE orders ADD COLUMN IF NOT EXISTS sales_channel TEXT NOT NULL DEFAULT 'Shopify';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_address TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_sales_channel ON orders(sales_channel);
