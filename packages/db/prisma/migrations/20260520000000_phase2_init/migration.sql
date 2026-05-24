-- Phase 2 — subscriber master data, service catalogue, network territory,
-- inventory. RLS is mandatory on every table. Indexes are sized for the
-- expected access patterns (filter by tenant, then a small selective
-- predicate). No MikroTik orchestration columns yet — those land with
-- Phase 3.

-- ============================================================
-- 1. zones — district / upazila / para hierarchy
-- ============================================================
CREATE TABLE zones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  parent_id   UUID REFERENCES zones(id) ON DELETE RESTRICT,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  CONSTRAINT zones_slug_unique UNIQUE (tenant_id, slug)
);
CREATE INDEX zones_tenant_idx ON zones (tenant_id);
CREATE INDEX zones_parent_idx ON zones (parent_id);
CREATE INDEX zones_name_trgm_idx ON zones USING gin (name gin_trgm_ops);
CREATE TRIGGER zones_set_updated_at BEFORE UPDATE ON zones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones FORCE ROW LEVEL SECURITY;
CREATE POLICY zones_tenant_isolation ON zones
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON zones TO tikflow_app;

-- ============================================================
-- 2. service_plans — what the ISP sells
-- ============================================================
CREATE TYPE service_plan_type AS ENUM ('pppoe', 'hotspot', 'static', 'wireless');

CREATE TABLE service_plans (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  name                     TEXT NOT NULL,
  code                     TEXT NOT NULL,
  description              TEXT,
  type                     service_plan_type NOT NULL DEFAULT 'pppoe',
  upload_kbps              INTEGER NOT NULL,
  download_kbps            INTEGER NOT NULL,
  burst_upload_kbps        INTEGER,
  burst_download_kbps      INTEGER,
  burst_threshold_upload   INTEGER,
  burst_threshold_download INTEGER,
  burst_time_seconds       INTEGER,
  validity_days            INTEGER NOT NULL DEFAULT 30,
  price                    NUMERIC(12,2) NOT NULL,
  vat_pct                  NUMERIC(5,2) NOT NULL DEFAULT 0,
  fup_limit_gb             INTEGER,
  fup_throttle_kbps        INTEGER,
  mikrotik_profile         TEXT,
  queue_name               TEXT,
  is_active                BOOLEAN NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at               TIMESTAMPTZ,
  CONSTRAINT service_plans_code_unique UNIQUE (tenant_id, code),
  CONSTRAINT service_plans_price_nonneg CHECK (price >= 0),
  CONSTRAINT service_plans_speeds_positive CHECK (upload_kbps > 0 AND download_kbps > 0)
);
CREATE INDEX service_plans_tenant_idx ON service_plans (tenant_id);
CREATE INDEX service_plans_active_idx ON service_plans (tenant_id, is_active);
CREATE TRIGGER service_plans_set_updated_at BEFORE UPDATE ON service_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE service_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_plans FORCE ROW LEVEL SECURITY;
CREATE POLICY service_plans_tenant_isolation ON service_plans
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON service_plans TO tikflow_app;

-- ============================================================
-- 3. subscribers — the customer master record
-- ============================================================
CREATE TYPE subscriber_status AS ENUM ('pending', 'active', 'suspended', 'cancelled');
CREATE TYPE connection_type   AS ENUM ('pppoe', 'hotspot', 'static');

CREATE TABLE subscribers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  code                 TEXT NOT NULL,
  full_name            TEXT NOT NULL,
  full_name_bn         TEXT,
  father_name          TEXT,
  nid_number           TEXT,
  phone                TEXT NOT NULL,
  alt_phone            TEXT,
  email                TEXT,
  address              TEXT,
  address_bn           TEXT,
  zone_id              UUID REFERENCES zones(id) ON DELETE RESTRICT,
  lat                  NUMERIC(9,6),
  lng                  NUMERIC(9,6),
  installation_date    DATE,
  status               subscriber_status NOT NULL DEFAULT 'pending',
  connection_type      connection_type   NOT NULL DEFAULT 'pppoe',
  notes                TEXT,
  kyc_docs             JSONB NOT NULL DEFAULT '[]',
  created_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ,
  CONSTRAINT subscribers_code_unique UNIQUE (tenant_id, code)
);
CREATE INDEX subscribers_tenant_idx        ON subscribers (tenant_id);
CREATE INDEX subscribers_phone_idx         ON subscribers (tenant_id, phone);
CREATE INDEX subscribers_zone_idx          ON subscribers (zone_id);
CREATE INDEX subscribers_status_idx        ON subscribers (tenant_id, status);
CREATE INDEX subscribers_name_trgm_idx     ON subscribers USING gin (full_name gin_trgm_ops);
CREATE INDEX subscribers_name_bn_trgm_idx  ON subscribers USING gin (full_name_bn gin_trgm_ops);
CREATE INDEX subscribers_code_trgm_idx     ON subscribers USING gin (code gin_trgm_ops);
CREATE TRIGGER subscribers_set_updated_at BEFORE UPDATE ON subscribers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers FORCE ROW LEVEL SECURITY;
CREATE POLICY subscribers_tenant_isolation ON subscribers
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON subscribers TO tikflow_app;

-- ============================================================
-- 4. subscriptions — link from subscriber to plan
-- One subscriber can hold one active subscription per period; historical
-- rows remain for billing reconstruction. Router / IP / PPPoE columns
-- are deliberately deferred to Phase 3 — they'll be added by a separate
-- migration when the MikroTik connector lands.
-- ============================================================
CREATE TYPE subscription_status AS ENUM ('pending', 'active', 'suspended', 'cancelled');

CREATE TABLE subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE RESTRICT,
  plan_id       UUID NOT NULL REFERENCES service_plans(id) ON DELETE RESTRICT,
  status        subscription_status NOT NULL DEFAULT 'pending',
  activated_at  TIMESTAMPTZ,
  paid_until    TIMESTAMPTZ,
  next_invoice_at TIMESTAMPTZ,
  auto_renew    BOOLEAN NOT NULL DEFAULT true,
  suspend_on_due BOOLEAN NOT NULL DEFAULT true,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX subscriptions_tenant_idx       ON subscriptions (tenant_id);
CREATE INDEX subscriptions_subscriber_idx   ON subscriptions (subscriber_id);
CREATE INDEX subscriptions_plan_idx         ON subscriptions (plan_id);
CREATE INDEX subscriptions_status_idx       ON subscriptions (tenant_id, status);
CREATE INDEX subscriptions_paid_until_idx   ON subscriptions (tenant_id, paid_until);
CREATE TRIGGER subscriptions_set_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_tenant_isolation ON subscriptions
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON subscriptions TO tikflow_app;

-- ============================================================
-- 5. inventory_items — physical assets the ISP tracks
-- ============================================================
CREATE TYPE inventory_item_type AS ENUM (
  'ont', 'onu', 'router', 'switch', 'splitter',
  'cable_drum', 'nic', 'antenna', 'other'
);
CREATE TYPE inventory_item_status AS ENUM (
  'in_stock', 'allocated', 'deployed', 'faulty', 'returned', 'scrapped'
);

CREATE TABLE inventory_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  type             inventory_item_type NOT NULL,
  status           inventory_item_status NOT NULL DEFAULT 'in_stock',
  serial           TEXT,
  mac              TEXT,
  vendor           TEXT,
  model            TEXT,
  location         TEXT,
  subscriber_id    UUID REFERENCES subscribers(id) ON DELETE SET NULL,
  purchased_at     DATE,
  warranty_until   DATE,
  cost             NUMERIC(12,2),
  notes            TEXT,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  CONSTRAINT inventory_items_serial_unique UNIQUE (tenant_id, serial)
);
CREATE INDEX inventory_items_tenant_idx ON inventory_items (tenant_id);
CREATE INDEX inventory_items_status_idx ON inventory_items (tenant_id, status);
CREATE INDEX inventory_items_subscriber_idx ON inventory_items (subscriber_id);
CREATE INDEX inventory_items_serial_trgm_idx ON inventory_items USING gin (serial gin_trgm_ops);
CREATE TRIGGER inventory_items_set_updated_at BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items FORCE ROW LEVEL SECURITY;
CREATE POLICY inventory_items_tenant_isolation ON inventory_items
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_items TO tikflow_app;
