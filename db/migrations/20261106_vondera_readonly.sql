-- Additive, read-only Vondera ingestion. Apply to an isolated Neon branch first.
-- No changes to Shopify COD orders, commissions, balances, or payouts.
CREATE TABLE IF NOT EXISTS hv_vondera_webhook_events (
  event_key varchar(64) PRIMARY KEY,
  store_id text NOT NULL,
  event_type varchar(64) NOT NULL,
  resource_id text,
  safe_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hv_vondera_events_store_received_idx
  ON hv_vondera_webhook_events(store_id, received_at DESC);
CREATE INDEX IF NOT EXISTS hv_vondera_events_type_idx
  ON hv_vondera_webhook_events(event_type, received_at DESC);

CREATE TABLE IF NOT EXISTS hv_vondera_orders (
  store_id text NOT NULL,
  order_id text NOT NULL,
  order_number text,
  status text,
  payment_status text,
  currency varchar(3) NOT NULL DEFAULT 'EGP',
  total_piasters bigint,
  discount_code text,
  referral_code text,
  source_updated_at timestamptz NOT NULL,
  last_event_key varchar(64) NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, order_id)
);
CREATE INDEX IF NOT EXISTS hv_vondera_orders_status_idx
  ON hv_vondera_orders(store_id, status);
CREATE INDEX IF NOT EXISTS hv_vondera_orders_discount_idx
  ON hv_vondera_orders(store_id, discount_code);

CREATE TABLE IF NOT EXISTS hv_vondera_products (
  store_id text NOT NULL,
  product_id text NOT NULL,
  title text,
  currency varchar(3) NOT NULL DEFAULT 'EGP',
  price_piasters bigint,
  quantity integer,
  source_updated_at timestamptz NOT NULL,
  last_event_key varchar(64) NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, product_id)
);
