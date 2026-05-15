-- Extensions required by the TikFlow schema (created on first cluster init).
-- Idempotent: safe to re-run.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
