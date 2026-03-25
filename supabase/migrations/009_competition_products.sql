-- Competition products: scraped variant data from competitor Shopify stores
CREATE TABLE competition_products (
  id BIGSERIAL PRIMARY KEY,
  competition_brand_id BIGINT NOT NULL REFERENCES competition_brands(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  product_title TEXT,
  product_type TEXT,
  tags TEXT,
  variant_title TEXT,
  price NUMERIC(12,2),
  compare_at_price NUMERIC(12,2),
  sku TEXT,
  available BOOLEAN,
  description TEXT,
  image_urls TEXT,
  product_url TEXT,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX competition_products_brand_id_idx ON competition_products (competition_brand_id);
CREATE INDEX competition_products_scraped_at_idx ON competition_products (scraped_at DESC);

-- RPC: brands list with products_count + last_synced
CREATE OR REPLACE FUNCTION get_competition_brands_with_stats()
RETURNS TABLE (
  id BIGINT,
  company_name TEXT,
  shop_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  products_count BIGINT,
  last_synced TIMESTAMPTZ
)
LANGUAGE sql STABLE AS $$
  SELECT
    cb.id, cb.company_name, cb.shop_url, cb.created_at, cb.updated_at,
    COUNT(cp.id)       AS products_count,
    MAX(cp.scraped_at) AS last_synced
  FROM competition_brands cb
  LEFT JOIN competition_products cp ON cp.competition_brand_id = cb.id
  GROUP BY cb.id, cb.company_name, cb.shop_url, cb.created_at, cb.updated_at
  ORDER BY cb.created_at DESC;
$$;
