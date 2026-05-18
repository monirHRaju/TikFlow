-- Add a non-secret prefix to api_keys so admins can identify the key
-- in the list after the secret is hidden. Stripe / GitHub-style.
--
-- The prefix is part of the public-facing identifier ("tkf_abcd…") and is
-- the only piece we can safely render in dashboards, audit logs, and
-- usage telemetry. The full key only ever exists in plaintext once, at
-- creation time, and only its argon2id-style hash is persisted.

ALTER TABLE api_keys
  ADD COLUMN prefix TEXT NOT NULL DEFAULT '';

-- Drop the default so future inserts have to supply a value explicitly.
ALTER TABLE api_keys
  ALTER COLUMN prefix DROP DEFAULT;

CREATE INDEX api_keys_tenant_prefix_idx ON api_keys (tenant_id, prefix);
