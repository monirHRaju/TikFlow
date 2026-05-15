-- Application database role used by the API + workers at runtime.
-- This role does NOT bypass RLS. The 'tikflow' superuser is used for
-- migrations and support tooling only.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tikflow_app') THEN
    CREATE ROLE tikflow_app LOGIN PASSWORD 'tikflow_app';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE tikflow TO tikflow_app;
GRANT USAGE ON SCHEMA public TO tikflow_app;

-- Default privileges so that anything created by the migrate user
-- is automatically usable by the app role (RLS still applies).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tikflow_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO tikflow_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO tikflow_app;
