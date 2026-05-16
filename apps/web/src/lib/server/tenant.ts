import 'server-only';

import { writeAuditLog } from '@tikflow/db';
import {
  DEFAULT_BRANDING,
  TenantBrandingSchema,
  type TenantBranding,
  type TenantGeneralSettings,
  type TenantSummary,
} from '@tikflow/contracts';

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

/**
 * Read the tenant's branding document. Returns {@link DEFAULT_BRANDING}
 * when nothing has been saved yet, so callers never need to null-check
 * individual fields.
 */
export async function getBranding(session: AuthenticatedSession): Promise<TenantBranding> {
  const row = await withTenantDb(session, async (tx) => {
    return tx.tenant.findFirstOrThrow({
      where: { id: session.tenantId },
      select: { branding: true },
    });
  });
  return parseBranding(row.branding);
}

/**
 * Persist branding changes + write an audit log entry atomically.
 * Returns the parsed (and validated) branding so the caller can render
 * the freshest values without a round-trip.
 */
export async function updateBranding(
  session: AuthenticatedSession,
  input: TenantBranding,
  meta: { ip: string | null; userAgent: string | null },
): Promise<TenantBranding> {
  return withTenantDb(session, async (tx) => {
    const beforeRow = await tx.tenant.findFirstOrThrow({
      where: { id: session.tenantId },
      select: { branding: true },
    });
    const before = parseBranding(beforeRow.branding);

    const afterRow = await tx.tenant.update({
      where: { id: session.tenantId },
      data: { branding: input },
      select: { branding: true },
    });
    const after = parseBranding(afterRow.branding);

    const diff = buildDiff(
      before as unknown as Record<string, unknown>,
      after as unknown as Record<string, unknown>,
    );
    if (diff) {
      await writeAuditLog(tx, {
        actorUserId: session.userId,
        action: 'tenant.branding.update',
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

/**
 * Parse whatever was stored in `tenants.branding`. Old tenants may have
 * `{}` or be missing newly-added fields; the schema's `nullable()` on
 * every key means we tolerate that gracefully.
 */
function parseBranding(value: unknown): TenantBranding {
  const result = TenantBrandingSchema.partial().safeParse(value ?? {});
  if (!result.success) {
    return DEFAULT_BRANDING;
  }
  return {
    accentHex: result.data.accentHex ?? null,
    logoUrl: result.data.logoUrl ?? null,
    invoicePrefix: result.data.invoicePrefix ?? null,
    invoiceHeader: result.data.invoiceHeader ?? null,
    invoiceFooter: result.data.invoiceFooter ?? null,
  };
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
