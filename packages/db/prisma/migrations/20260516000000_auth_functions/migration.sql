-- Authentication helpers.
--
-- Sign-in is special: at the point where we receive (tenantSlug, email)
-- there is no tenant context yet, so a regular RLS-constrained query
-- would return zero rows. We expose narrow SECURITY DEFINER functions
-- that perform the precise lookup/update needed, owned by the migrate
-- (superuser) role so they bypass RLS. The runtime tikflow_app role
-- only gets EXECUTE on these specific functions — it never gets a
-- general RLS bypass.

-- ----------------------------------------------------------------------
-- find_user_for_login: look up a single user across the (slug, email)
-- pair. Returns at most one row.
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_user_for_login(p_slug TEXT, p_email TEXT)
RETURNS TABLE (
  user_id            UUID,
  tenant_id          UUID,
  password_hash      TEXT,
  mfa_secret         TEXT,
  mfa_enabled        BOOLEAN,
  status             user_status,
  failed_login_count INTEGER,
  locked_until       TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE sql
STABLE
AS $$
  SELECT
    u.id,
    u.tenant_id,
    u.password_hash,
    u.mfa_secret,
    u.mfa_enabled,
    u.status,
    u.failed_login_count,
    u.locked_until
  FROM users u
  JOIN tenants t ON t.id = u.tenant_id
  WHERE t.slug = p_slug
    AND lower(u.email) = lower(p_email)
    AND u.deleted_at IS NULL
    AND t.deleted_at IS NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION find_user_for_login(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_user_for_login(TEXT, TEXT) TO tikflow_app;

-- ----------------------------------------------------------------------
-- record_login_failure: bump the failed-attempt counter and apply the
-- lockout window when the threshold is crossed. Returns the resulting
-- locked_until (NULL if not locked).
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_login_failure(
  p_user_id                   UUID,
  p_lockout_threshold         INTEGER,
  p_lockout_duration_seconds  INTEGER
)
RETURNS TIMESTAMPTZ
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_count    INTEGER;
  v_locked_until TIMESTAMPTZ;
BEGIN
  UPDATE users
  SET failed_login_count = failed_login_count + 1,
      locked_until = CASE
        WHEN failed_login_count + 1 >= p_lockout_threshold
        THEN now() + make_interval(secs => p_lockout_duration_seconds)
        ELSE locked_until
      END
  WHERE id = p_user_id
  RETURNING failed_login_count, locked_until
       INTO v_new_count, v_locked_until;
  RETURN v_locked_until;
END
$$;

REVOKE ALL ON FUNCTION record_login_failure(UUID, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_login_failure(UUID, INTEGER, INTEGER) TO tikflow_app;

-- ----------------------------------------------------------------------
-- record_login_success: clear counters and stamp last_login_at.
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_login_success(p_user_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE sql
AS $$
  UPDATE users
  SET failed_login_count = 0,
      locked_until = NULL,
      last_login_at = now()
  WHERE id = p_user_id;
$$;

REVOKE ALL ON FUNCTION record_login_success(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_login_success(UUID) TO tikflow_app;

-- ----------------------------------------------------------------------
-- record_security_event: append-only audit insert that does not require
-- the caller to have a tenant context set.
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_security_event(
  p_tenant_id  UUID,
  p_kind       security_event_kind,
  p_severity   security_event_severity,
  p_ip         INET,
  p_user_agent TEXT,
  p_payload    JSONB
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE sql
AS $$
  INSERT INTO security_events (tenant_id, kind, severity, ip, user_agent, payload)
  VALUES (p_tenant_id, p_kind, p_severity, p_ip, p_user_agent, p_payload);
$$;

REVOKE ALL ON FUNCTION record_security_event(
  UUID, security_event_kind, security_event_severity, INET, TEXT, JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION record_security_event(
  UUID, security_event_kind, security_event_severity, INET, TEXT, JSONB
) TO tikflow_app;
