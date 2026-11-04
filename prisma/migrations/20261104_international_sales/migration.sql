-- Herbal Vitaly | International Sales (separate from domestic Shopify / affiliate ledger)
-- Apply ONLY to an approved isolated Neon branch first. No destructive statements.
CREATE TABLE IF NOT EXISTS intl_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  country TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  registration_no TEXT,
  tax_no TEXT,
  contact_name TEXT,
  contact_email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS intl_products (
  sku TEXT PRIMARY KEY,
  product_name TEXT NOT NULL,
  unit_price_cents BIGINT NOT NULL CHECK (unit_price_cents >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS intl_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES intl_clients(id),
  reference TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  effective_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK(status IN ('DRAFT','ACTIVE','EXPIRED','TERMINATED')),
  document_url TEXT,
  terms_notes TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expiry_date >= effective_date)
);
CREATE TABLE IF NOT EXISTS intl_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES intl_clients(id),
  contract_id UUID REFERENCES intl_contracts(id),
  reference TEXT NOT NULL UNIQUE,
  issued_at DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK(status IN ('DRAFT','SENT','ACCEPTED','REJECTED','EXPIRED')),
  currency CHAR(3) NOT NULL DEFAULT 'USD' CHECK(currency = 'USD'),
  total_cents BIGINT NOT NULL CHECK(total_cents >= 0),
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(valid_until >= issued_at)
);
CREATE TABLE IF NOT EXISTS intl_quote_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES intl_quotes(id),
  sku TEXT NOT NULL REFERENCES intl_products(sku),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_price_cents BIGINT NOT NULL CHECK(unit_price_cents >= 0),
  line_total_cents BIGINT NOT NULL CHECK(line_total_cents >= 0),
  UNIQUE(quote_id,sku)
);
CREATE TABLE IF NOT EXISTS intl_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES intl_clients(id),
  quote_id UUID NOT NULL UNIQUE REFERENCES intl_quotes(id),
  reference TEXT NOT NULL UNIQUE,
  order_status TEXT NOT NULL DEFAULT 'CONFIRMED'
    CHECK(order_status IN ('CONFIRMED','SHIPPED','DELIVERED','CANCELLED','RETURNED')),
  currency CHAR(3) NOT NULL DEFAULT 'USD' CHECK(currency = 'USD'),
  total_cents BIGINT NOT NULL CHECK(total_cents >= 0),
  paid_cents BIGINT NOT NULL DEFAULT 0 CHECK(paid_cents >= 0 AND paid_cents <= total_cents),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS intl_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES intl_orders(id),
  sku TEXT NOT NULL REFERENCES intl_products(sku),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_price_cents BIGINT NOT NULL CHECK(unit_price_cents >= 0),
  UNIQUE(order_id,sku)
);
CREATE TABLE IF NOT EXISTS intl_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES intl_orders(id),
  reference TEXT NOT NULL,
  amount_cents BIGINT NOT NULL CHECK(amount_cents > 0),
  paid_at DATE NOT NULL,
  recorded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_id, reference)
);
CREATE TABLE IF NOT EXISTS intl_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS intl_commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES intl_clients(id),
  agent_id UUID NOT NULL REFERENCES intl_agents(id),
  rate_cents BIGINT NOT NULL CHECK(rate_cents >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'USD' CHECK(currency = 'USD'),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id,agent_id)
);
CREATE TABLE IF NOT EXISTS intl_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES intl_orders(id),
  order_line_id UUID NOT NULL REFERENCES intl_order_lines(id),
  rule_id UUID NOT NULL REFERENCES intl_commission_rules(id),
  agent_id UUID NOT NULL REFERENCES intl_agents(id),
  eligible_quantity INTEGER NOT NULL CHECK(eligible_quantity > 0),
  rate_cents BIGINT NOT NULL CHECK(rate_cents >= 0),
  amount_cents BIGINT NOT NULL CHECK(amount_cents >= 0),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK(status IN ('PENDING','APPROVED','PAID','VOID')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  payout_reference TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_line_id,rule_id)
);
CREATE TABLE IF NOT EXISTS intl_audit (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_intl_contracts_client ON intl_contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_intl_quotes_client ON intl_quotes(client_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intl_orders_client ON intl_orders(client_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intl_commissions_status ON intl_commissions(status,agent_id);
CREATE INDEX IF NOT EXISTS idx_intl_payments_order ON intl_payments(order_id);
-- Initial catalogue from approved Gulf Generic USD quotation. This does not create any client, obligation or payment.
INSERT INTO intl_products(sku,product_name,unit_price_cents) VALUES
('USHABTI','USHABTI',368),('TUT-FLORA','TUT FLORA',296),
('AMUHOTEP','AMUHOTEP',303),('FLEXORIA','FLEXORIA',353)
ON CONFLICT(sku) DO NOTHING;
