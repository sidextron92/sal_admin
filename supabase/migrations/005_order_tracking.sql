-- =====================================================================
-- 005_order_tracking.sql — vendor-agnostic shipping tracking layer
-- =====================================================================

-- shipping_partners: one row per logistics vendor
CREATE TABLE shipping_partners (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  status     TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- status_mapper: translates vendor-specific statuses → canonical system statuses
CREATE TABLE status_mapper (
  id                   SERIAL PRIMARY KEY,
  shipping_partner_id  INTEGER REFERENCES shipping_partners(id) ON DELETE CASCADE,
  partner_status       TEXT NOT NULL,
  system_status        TEXT NOT NULL,
  UNIQUE(shipping_partner_id, partner_status)
);

-- order_tracking_logs: one row per webhook event received
CREATE TABLE order_tracking_logs (
  id                   BIGSERIAL PRIMARY KEY,
  order_id             TEXT REFERENCES orders(order_id) ON DELETE CASCADE,
  shipping_partner_id  INTEGER REFERENCES shipping_partners(id),
  awb_no               TEXT,
  system_status        TEXT,
  partner_status       TEXT,
  partner_payload      JSONB,
  event_timestamp      TIMESTAMPTZ,
  received_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tracking_order_id ON order_tracking_logs(order_id);
CREATE INDEX idx_tracking_awb      ON order_tracking_logs(awb_no);
CREATE INDEX idx_tracking_received ON order_tracking_logs(received_at DESC);

-- Add shipping columns to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_status      TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_partner_id  INTEGER REFERENCES shipping_partners(id);

-- =====================================================================
-- Seed: Shiprocket partner
-- =====================================================================

INSERT INTO shipping_partners (name, slug) VALUES ('Shiprocket', 'shiprocket');
-- Shiprocket gets id = 1

-- =====================================================================
-- Seed: Shiprocket status mappings
-- =====================================================================

INSERT INTO status_mapper (shipping_partner_id, partner_status, system_status) VALUES
  -- Pre-pickup / warehouse
  (1, 'Shipment Booked',              'NEW'),
  (1, 'Box Packing',                  'NEW'),
  (1, 'PROCESSED AT WAREHOUSE',       'NEW'),
  (1, 'FC Allocated',                 'NEW'),
  (1, 'Picklist Generated',           'NEW'),
  (1, 'Ready To Pack',                'NEW'),
  (1, 'Packed',                       'NEW'),
  (1, 'FC MANIFEST GENERATED',        'NEW'),
  -- Pickup phase
  (1, 'Pickup Booked',                'OUT_FOR_PICKUP'),
  (1, 'Out For Pickup',               'OUT_FOR_PICKUP'),
  (1, 'Pickup Rescheduled',           'OUT_FOR_PICKUP'),
  (1, 'Pickup Error',                 'PICKUP_FAILED'),
  (1, 'Pickup Exception',             'PICKUP_FAILED'),
  (1, 'HANDOVER EXCEPTION',           'PICKUP_FAILED'),
  (1, 'PACKED EXCEPTION',             'PICKUP_FAILED'),
  (1, 'QC FAILED',                    'PICKUP_FAILED'),
  (1, 'PICKED UP',                    'PICKED_UP'),
  (1, 'Shipped',                      'PICKED_UP'),
  (1, 'Handover to Courier',          'PICKED_UP'),
  -- In transit
  (1, 'In Transit',                   'IN_TRANSIT'),
  (1, 'Delayed',                      'IN_TRANSIT'),
  (1, 'REACHED AT DESTINATION HUB',   'IN_TRANSIT'),
  (1, 'MISROUTED',                    'IN_TRANSIT'),
  (1, 'Reached Warehouse',            'IN_TRANSIT'),
  (1, 'Custom Cleared',               'IN_TRANSIT'),
  (1, 'In Flight',                    'IN_TRANSIT'),
  (1, 'In Transit Overseas',          'IN_TRANSIT'),
  (1, 'Connection Aligned',           'IN_TRANSIT'),
  (1, 'Reached Overseas Warehouse',   'IN_TRANSIT'),
  (1, 'Custom Cleared Overseas',      'IN_TRANSIT'),
  -- Delivery
  (1, 'Out For Delivery',             'OUT_FOR_DELIVERY'),
  (1, 'Delivered',                    'DELIVERED'),
  (1, 'Partial_Delivered',            'DELIVERED'),
  (1, 'FULFILLED',                    'DELIVERED'),
  (1, 'SELF FULFILLED',               'DELIVERED'),
  -- Undelivered
  (1, 'Undelivered',                  'UNDELIVERED'),
  (1, 'ISSUE_RELATED_TO_THE_RECIPIENT', 'UNDELIVERED'),
  -- Returns
  (1, 'RTO Initiated',                'RETURN_INITIATED'),
  (1, 'Cancellation Requested',       'RETURN_INITIATED'),
  (1, 'RTO Acknowledged',             'RETURN_INITIATED'),
  (1, 'RTO_NDR',                      'RETURN_INITIATED'),
  (1, 'RTO_OFD',                      'RETURN_INITIATED'),
  (1, 'RTO IN INTRANSIT',             'RETURN_INITIATED'),
  (1, 'RTO_LOCK',                     'RETURN_INITIATED'),
  (1, 'RTO Delivered',                'RETURNED'),
  (1, 'REACHED_BACK_AT_SELLER_CITY',  'RETURNED'),
  -- Cancelled
  (1, 'Canceled',                     'CANCELLED'),
  (1, 'CANCELLED_BEFORE_DISPATCHED',  'CANCELLED'),
  -- Lost / damaged
  (1, 'Lost',                         'LOST'),
  (1, 'DESTROYED',                    'LOST'),
  (1, 'DAMAGED',                      'LOST'),
  (1, 'DISPOSED OFF',                 'LOST'),
  (1, 'UNTRACEABLE',                  'LOST');
