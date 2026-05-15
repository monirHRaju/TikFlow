-- TikFlow — Phase 0 initial schema.
-- Identity, tenancy, audit, security events with Row-Level Security.
-- Run as a superuser (DATABASE_MIGRATE_URL). The runtime app role
-- 'tikflow_app' is provisioned by infra/postgres/init/02-roles.sql.

-- ============================================================
-- Enums
-- ============================================================

CREATE TYPE "tenant_plan" AS ENUM ('trial', 'standard', 'pro');
CREATE TYPE "tenant_status" AS ENUM ('active', 'suspended', 'closed');
CREATE TYPE "kyc_status" AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE "user_status" AS ENUM ('active', 'invited', 'suspended', 'deleted');
CREATE TYPE "security_event_kind" AS ENUM (
  'login_success',
  'login_fail',
  'mfa_fail',
  'mfa_success',
  'password_reset',
  'password_change',
  'impossible_travel',
  'api_key_used',
  'export_data',
  'permission_change',
  'account_lockout'
);
CREATE TYPE "security_event_severity" AS ENUM ('low', 'medium', 'high', 'critical');

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE "tenants" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "name"          TEXT NOT NULL,
  "slug"          TEXT NOT NULL,
  "country"       CHAR(2) NOT NULL DEFAULT 'BD',
  "currency"      CHAR(3) NOT NULL DEFAULT 'BDT',
  "timezone"      TEXT NOT NULL DEFAULT 'Asia/Dhaka',
  "plan"          "tenant_plan" NOT NULL DEFAULT 'trial',
  "status"        "tenant_status" NOT NULL DEFAULT 'active',
  "billing_email" TEXT,
  "kyc_status"    "kyc_status" NOT NULL DEFAULT 'pending',
  "settings"      JSONB NOT NULL DEFAULT '{}',
  "branding"      JSONB NOT NULL DEFAULT '{}',
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at"    TIMESTAMPTZ,
  CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

CREATE TABLE "users" (
  "id"                    UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"             UUID NOT NULL,
  "email"                 TEXT NOT NULL,
  "phone"                 TEXT,
  "password_hash"         TEXT NOT NULL,
  "mfa_secret"            TEXT,
  "mfa_enabled"           BOOLEAN NOT NULL DEFAULT false,
  "status"                "user_status" NOT NULL DEFAULT 'active',
  "last_login_at"         TIMESTAMPTZ,
  "failed_login_count"    INTEGER NOT NULL DEFAULT 0,
  "locked_until"          TIMESTAMPTZ,
  "password_changed_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at"            TIMESTAMPTZ,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

CREATE TABLE "roles" (
  "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"   UUID NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "is_system"   BOOLEAN NOT NULL DEFAULT false,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at"  TIMESTAMPTZ,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "roles_tenant_id_name_key" ON "roles"("tenant_id", "name");
CREATE INDEX "roles_tenant_id_idx" ON "roles"("tenant_id");

CREATE TABLE "permissions" (
  "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
  "code"        TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

CREATE TABLE "role_permissions" (
  "tenant_id"     UUID NOT NULL,
  "role_id"       UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id"),
  CONSTRAINT "role_permissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE,
  CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE
);
CREATE INDEX "role_permissions_tenant_id_idx" ON "role_permissions"("tenant_id");

CREATE TABLE "user_roles" (
  "tenant_id"   UUID NOT NULL,
  "user_id"     UUID NOT NULL,
  "role_id"     UUID NOT NULL,
  "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "assigned_by" UUID,
  CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id"),
  CONSTRAINT "user_roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE
);
CREATE INDEX "user_roles_tenant_id_idx" ON "user_roles"("tenant_id");

CREATE TABLE "api_keys" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"    UUID NOT NULL,
  "label"        TEXT NOT NULL,
  "hashed_key"   TEXT NOT NULL,
  "scopes"       TEXT[] NOT NULL DEFAULT '{}',
  "last_used_at" TIMESTAMPTZ,
  "expires_at"   TIMESTAMPTZ,
  "created_by"   UUID,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at"   TIMESTAMPTZ,
  CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "api_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "api_keys_hashed_key_key" ON "api_keys"("hashed_key");
CREATE INDEX "api_keys_tenant_id_idx" ON "api_keys"("tenant_id");

CREATE TABLE "sessions" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"  UUID NOT NULL,
  "user_id"    UUID NOT NULL,
  "jti"        TEXT NOT NULL,
  "ip"         INET,
  "user_agent" TEXT,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "revoked_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "sessions_jti_key" ON "sessions"("jti");
CREATE INDEX "sessions_tenant_id_idx" ON "sessions"("tenant_id");
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

CREATE TABLE "audit_logs" (
  "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"      UUID NOT NULL,
  "actor_user_id"  UUID,
  "action"         TEXT NOT NULL,
  "entity_type"    TEXT NOT NULL,
  "entity_id"      TEXT,
  "diff"           JSONB,
  "ip"             INET,
  "user_agent"     TEXT,
  "at"             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE INDEX "audit_logs_tenant_id_at_idx" ON "audit_logs"("tenant_id", "at" DESC);
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs"("entity_type", "entity_id");

CREATE TABLE "security_events" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"  UUID NOT NULL,
  "kind"       "security_event_kind" NOT NULL,
  "severity"   "security_event_severity" NOT NULL DEFAULT 'low',
  "ip"         INET,
  "user_agent" TEXT,
  "payload"    JSONB,
  "at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "security_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "security_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT
);
CREATE INDEX "security_events_tenant_id_at_idx" ON "security_events"("tenant_id", "at" DESC);
CREATE INDEX "security_events_kind_at_idx" ON "security_events"("kind", "at" DESC);

-- ============================================================
-- Triggers: updated_at maintenance
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_set_updated_at BEFORE UPDATE ON "tenants"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER roles_set_updated_at BEFORE UPDATE ON "roles"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Triggers: append-only audit_logs and security_events
-- ============================================================

CREATE OR REPLACE FUNCTION block_append_only_modify() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'append-only table %: % is not permitted', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION block_append_only_modify();
CREATE TRIGGER audit_logs_no_delete BEFORE DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION block_append_only_modify();
CREATE TRIGGER security_events_no_update BEFORE UPDATE ON "security_events"
  FOR EACH ROW EXECUTE FUNCTION block_append_only_modify();
CREATE TRIGGER security_events_no_delete BEFORE DELETE ON "security_events"
  FOR EACH ROW EXECUTE FUNCTION block_append_only_modify();

-- ============================================================
-- Tenant-context helpers
-- ============================================================

-- Returns NULL if app.current_tenant is unset, so RLS policies that
-- compare against this function correctly deny access by default.
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_tenant', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- Convenience wrapper for the API middleware: SELECT set_tenant($1).
CREATE OR REPLACE FUNCTION set_tenant(p_tenant_id UUID) RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_tenant', p_tenant_id::text, true);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Row-Level Security
-- FORCE ensures even the table owner is subject to RLS.
-- ============================================================

ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenants"
  USING (id = current_tenant_id())
  WITH CHECK (id = current_tenant_id());

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "users"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "roles"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "role_permissions"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_roles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "user_roles"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_keys" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "api_keys"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "sessions"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "audit_logs"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE "security_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "security_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "security_events"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- "permissions" is a system catalog (no tenant_id, system roles seed it).
-- It is readable by all app sessions but writable only by the migrate role.
ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY permissions_read_all ON "permissions" FOR SELECT USING (true);

-- ============================================================
-- Grants to the runtime application role (tikflow_app).
-- RLS still applies; these grants only set the privilege ceiling.
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "tenants",
  "users",
  "roles",
  "role_permissions",
  "user_roles",
  "api_keys",
  "sessions",
  "audit_logs",
  "security_events"
TO tikflow_app;

GRANT SELECT ON "permissions" TO tikflow_app;

GRANT EXECUTE ON FUNCTION current_tenant_id() TO tikflow_app;
GRANT EXECUTE ON FUNCTION set_tenant(UUID) TO tikflow_app;
