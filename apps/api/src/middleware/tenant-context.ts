import { type NextFunction, type Request, type Response } from 'express';

import { withTenant } from '@tikflow/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve a tenant id from the request.
 *
 * For Phase 0 we accept `X-Tenant-Id` (dev override) and stub the JWT path.
 * PR-0.5 (Auth.js) will replace this with verified JWT extraction, so
 * tenantId can never be set by a client header in production.
 */
function resolveTenant(req: Request): { tenantId?: string; userId?: string } {
  const header = req.header('x-tenant-id');
  if (header && UUID_RE.test(header)) {
    return { tenantId: header };
  }
  return {};
}

/**
 * Attaches `req.tenantId` / `req.userId` and runs the downstream pipeline
 * inside an AsyncLocalStorage scope, so any code path can read the tenant
 * via `getCurrentTenantId()` from `@tikflow/db` without prop-drilling.
 *
 * RLS-isolated DB work is still done by opening a transaction with
 * `withTenantTransaction()` — that's the actual guard, this middleware
 * just publishes the context.
 */
export function tenantContext(req: Request, res: Response, next: NextFunction): void {
  const { tenantId, userId } = resolveTenant(req);
  if (tenantId) {
    req.tenantId = tenantId;
  }
  if (userId) {
    req.userId = userId;
  }

  if (tenantId) {
    // AsyncLocalStorage propagates through any async work `next()` triggers,
    // because async_hooks tracks the chain that starts inside `storage.run`.
    withTenant({ tenantId, userId }, () => {
      next();
    });
    return;
  }
  next();
}
