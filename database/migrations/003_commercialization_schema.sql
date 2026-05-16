CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_monthly_cents INTEGER,
  included_pages INTEGER,
  included_storage_mb INTEGER,
  overage_page_cents INTEGER,
  features JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO plans (id, name, price_monthly_cents, included_pages, included_storage_mb, overage_page_cents, features)
VALUES
  ('free', 'Free', 0, 100, 100, 4, '["API keys","document upload","OCR sandbox"]'),
  ('starter', 'Starter', 2900, 1000, 1024, 3, '["API keys","OCR","quality analysis","webhooks"]'),
  ('growth', 'Growth', 9900, 5000, 10240, 2, '["semantic search","translation","advanced usage analytics"]'),
  ('business', 'Business', 49900, 30000, 102400, 1, '["priority jobs","billing exports","white-label branding"]'),
  ('enterprise', 'Enterprise', NULL, NULL, NULL, NULL, '["custom SLA","data residency","on-premise deployment","SSO"]')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  included_pages = EXCLUDED.included_pages,
  included_storage_mb = EXCLUDED.included_storage_mb,
  overage_page_cents = EXCLUDED.overage_page_cents,
  features = EXCLUDED.features;

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  plan_id TEXT NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL CHECK (status IN ('trialing','active','past_due','cancelled','paused')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '1 month',
  provider TEXT NOT NULL DEFAULT 'local',
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  api_key_id UUID REFERENCES api_keys(id),
  document_id UUID REFERENCES documents(id),
  meter TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  subscription_id UUID REFERENCES subscriptions(id),
  status TEXT NOT NULL CHECK (status IN ('draft','open','paid','void','uncollectible')),
  currency TEXT NOT NULL DEFAULT 'usd',
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  provider_invoice_id TEXT,
  due_at TIMESTAMPTZ,
  issued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  meter TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  invoice_id UUID REFERENCES invoices(id),
  provider TEXT NOT NULL CHECK (provider IN ('stripe','razorpay','manual','local')),
  provider_payment_id TEXT,
  status TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  secret_hash TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  retry_policy JSONB NOT NULL DEFAULT '{"max_attempts":8,"backoff":"exponential"}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usage_records_org_created_idx ON usage_records (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS subscriptions_org_status_idx ON subscriptions (organization_id, status);
CREATE INDEX IF NOT EXISTS invoices_org_created_idx ON invoices (organization_id, created_at DESC);
