-- ============================================================
-- 1. ALTER product_variants — add new columns
-- ============================================================
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS cost                 NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS virtual_inventory    INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS physical_inventory   INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inventory_remark     TEXT,
  ADD COLUMN IF NOT EXISTS inventory_changed_by TEXT          NOT NULL DEFAULT 'admin';

-- Seed physical_inventory from existing inventory_quantity (floor negatives to 0)
UPDATE product_variants
SET physical_inventory = GREATEST(0, COALESCE(inventory_quantity, 0));

-- Add check constraints (safe now that data is clean)
ALTER TABLE product_variants
  ADD CONSTRAINT chk_cost_non_negative              CHECK (cost >= 0),
  ADD CONSTRAINT chk_virtual_inventory_non_negative  CHECK (virtual_inventory >= 0),
  ADD CONSTRAINT chk_physical_inventory_non_negative CHECK (physical_inventory >= 0);

-- ============================================================
-- 2. CREATE inventory_logs table
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_logs (
  id              BIGSERIAL PRIMARY KEY,
  variant_id      TEXT NOT NULL REFERENCES product_variants(variant_id) ON DELETE CASCADE,
  product_id      TEXT NOT NULL,
  variant_title   TEXT,
  product_title   TEXT,

  -- Before
  prev_virtual    INTEGER NOT NULL,
  prev_physical   INTEGER NOT NULL,
  prev_total      INTEGER NOT NULL,

  -- After
  new_virtual     INTEGER NOT NULL,
  new_physical    INTEGER NOT NULL,
  new_total       INTEGER NOT NULL,

  -- Deltas (signed: negative = decrease, positive = increase)
  delta_virtual   INTEGER NOT NULL,
  delta_physical  INTEGER NOT NULL,
  delta_total     INTEGER NOT NULL,

  -- Context
  remarks         TEXT,
  changed_by      TEXT NOT NULL DEFAULT 'admin',
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_logs_variant_id ON inventory_logs (variant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_changed_at ON inventory_logs (changed_at DESC);

-- ============================================================
-- 3. BEFORE UPDATE trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION handle_inventory_change()
RETURNS TRIGGER AS $$
DECLARE
  v_delta          INTEGER;
  v_reduce_phys    INTEGER;
  v_reduce_virt    INTEGER;
  v_product_title  TEXT;
BEGIN
  -- Guard: skip if no inventory column actually changed
  IF (OLD.virtual_inventory  IS NOT DISTINCT FROM NEW.virtual_inventory)  AND
     (OLD.physical_inventory IS NOT DISTINCT FROM NEW.physical_inventory) AND
     (OLD.inventory_quantity IS NOT DISTINCT FROM NEW.inventory_quantity) THEN
    RETURN NEW;
  END IF;

  -- ── Mode detection ──────────────────────────────────────────
  IF (OLD.inventory_quantity IS DISTINCT FROM NEW.inventory_quantity) AND
     (OLD.virtual_inventory  IS NOT DISTINCT FROM NEW.virtual_inventory) AND
     (OLD.physical_inventory IS NOT DISTINCT FROM NEW.physical_inventory) THEN

    -- SHOPIFY SYNC MODE: only inventory_quantity was changed by the caller
    v_delta := NEW.inventory_quantity - OLD.inventory_quantity;

    IF v_delta < 0 THEN
      -- Decrease: consume physical first, spill into virtual, floor both at 0
      v_reduce_phys := LEAST(ABS(v_delta), OLD.physical_inventory);
      v_reduce_virt := ABS(v_delta) - v_reduce_phys;
      NEW.physical_inventory := GREATEST(0, OLD.physical_inventory - v_reduce_phys);
      NEW.virtual_inventory  := GREATEST(0, OLD.virtual_inventory  - v_reduce_virt);
    ELSE
      -- Increase: add to virtual
      NEW.virtual_inventory := OLD.virtual_inventory + v_delta;
    END IF;

  ELSE
    -- MANUAL MODE: virtual and/or physical set explicitly by the modal
    NEW.inventory_quantity := NEW.virtual_inventory + NEW.physical_inventory;
  END IF;

  -- ── Write to inventory_logs ──────────────────────────────────
  SELECT title INTO v_product_title FROM products WHERE product_id = NEW.product_id;

  INSERT INTO inventory_logs (
    variant_id,    product_id,    variant_title,  product_title,
    prev_virtual,  prev_physical, prev_total,
    new_virtual,   new_physical,  new_total,
    delta_virtual, delta_physical, delta_total,
    remarks,       changed_by
  ) VALUES (
    NEW.variant_id,
    NEW.product_id,
    NEW.title,
    v_product_title,
    OLD.virtual_inventory,
    OLD.physical_inventory,
    OLD.inventory_quantity,
    NEW.virtual_inventory,
    NEW.physical_inventory,
    NEW.inventory_quantity,
    NEW.virtual_inventory  - OLD.virtual_inventory,
    NEW.physical_inventory - OLD.physical_inventory,
    NEW.inventory_quantity - OLD.inventory_quantity,
    NEW.inventory_remark,
    COALESCE(NEW.inventory_changed_by, 'admin')
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. Attach trigger to product_variants
-- ============================================================
DROP TRIGGER IF EXISTS trg_inventory_change ON product_variants;

CREATE TRIGGER trg_inventory_change
  BEFORE UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION handle_inventory_change();
