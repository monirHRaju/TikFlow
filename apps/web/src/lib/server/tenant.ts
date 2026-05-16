import 'server-only';

import { writeAuditLog } from '@tikflow/db';
import type { TenantGeneralSettings, TenantSummary } from '@tikflow/contracts';

import { withTenantDb } from './db';
import type { AuthenticatedSession } from './session';

/**
 * Fetch the current tenant. Because RLS restricts the `tenants` table to
 * the active tenant context, `findFirstOrThrow` always returns the right
 * row — no need to filter by id at the application layer.
 */
export async function getCurrentTenant(session: AuthenticatedSession): Promise<TenantSummary> {
  const tenant = await withTenantDb(session, async (tx) => {
    return tx.tenant.findFirstOrThrow({
      where: { id: session.tenantId },
      select: {
        id: true,
        slug: true,
        name: true,
        billingEmail: true,
        timezone: true,
        currency: true,
        country: true,
        plan: true,
        status: true,
      },
    });
  });

  return tenant;
}

/**
 * Update general settings and write an audit log entry inside the same
 * transaction so either both happen or neither.
 *
 * The diff is captured *server-side* (not from the form) so a forged
 * client can't lie about what changed.
 */
export async function updateGeneralSettings(
  session: AuthenticatedSession,
  input: TenantGeneralSettings,
  meta: { ip: string | null; userAgent: string | null },
): Promise<TenantSummary> {
  return withTenantDb(session, async (tx) => {
    const before = await tx.tenant.findFirstOrThrow({
      where: { id: session.tenantId },
      select: {
        id: true,
        slug: true,
        name: true,
        billingEmail: true,
        timezone: true,
        currency: true,
        country: true,
        plan: true,
        status: true,
      },
    });

    const after = await tx.tenant.update({
      where: { id: session.tenantId },
      data: {
        name: input.name,
        billingEmail: input.billingEmail,
        timezone: input.timezone,
        currency: input.currency,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        billingEmail: true,
        timezone: true,
        currency: true,
        country: true,
        plan: true,
        status: true,
      },
    });

    const diff = buildDiff(before, after);
    if (diff) {
      await writeAuditLog(tx, {
        actorUserId: session.userId,
        action: 'tenant.settings.update',
        entityType: 'tenant',
        entityId: session.tenantId,
        diff,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    }

    return after;
  });
}

function buildDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    if (before[key] !== after[key]) {
      changedBefore[key] = before[key];
      changedAfter[key] = after[key];
    }
  }
  if (Object.keys(changedAfter).length === 0) return null;
  return { before: changedBefore, after: changedAfter };
}
