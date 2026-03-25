-- Competition brands: track competitor shop URLs for pricing analysis
CREATE TABLE competition_brands (
  id BIGSERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  shop_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX competition_brands_created_at_idx ON competition_brands (created_at DESC);
