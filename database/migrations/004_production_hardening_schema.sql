ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS ip_allowlist TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS progress INTEGER NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS result_id UUID;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

UPDATE jobs
SET organization_id = documents.organization_id
FROM documents
WHERE jobs.document_id = documents.id
  AND jobs.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS jobs_org_created_idx ON jobs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_org_status_idx ON jobs (organization_id, status);

CREATE TABLE IF NOT EXISTS quota_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  meter TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('minute','day','month')),
  limit_value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, meter, period)
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  event_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivering','delivered','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES webhook_events(id) ON DELETE CASCADE;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES webhook_subscriptions(id) ON DELETE CASCADE;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS attempt INTEGER NOT NULL DEFAULT 1;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS response_body TEXT;
ALTER TABLE webhook_deliveries ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;
ALTER TABLE webhook_deliveries ALTER COLUMN endpoint_id DROP NOT NULL;
ALTER TABLE webhook_subscriptions ADD COLUMN IF NOT EXISTS secret_ref TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_payment_unique_idx ON payments (provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS webhook_events_org_created_idx ON webhook_events (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS webhook_deliveries_event_idx ON webhook_deliveries (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS webhook_deliveries_subscription_idx ON webhook_deliveries (subscription_id, created_at DESC);

INSERT INTO quota_limits (organization_id, meter, period, limit_value)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'api_call', 'minute', 120),
  ('00000000-0000-0000-0000-000000000001', 'page_processed', 'month', 100),
  ('00000000-0000-0000-0000-000000000001', 'ocr_page', 'month', 100),
  ('00000000-0000-0000-0000-000000000001', 'storage_mb_month', 'month', 100)
ON CONFLICT (organization_id, meter, period) DO NOTHING;
