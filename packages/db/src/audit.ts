import type { Prisma } from '@prisma/client';

import { requireTenantId } from './tenant-context.js';

export type AuditDiff = {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

export type WriteAuditLogInput = {
  /** Authenticated user making the change. Null for system-initiated actions. */
  actorUserId: string | null;
  /** Free-form verb describing what happened, e.g. `tenant.settings.update`. */
  action: string;
  /** Logical entity affected, e.g. `tenant`, `subscriber`, `service_plan`. */
  entityType: string;
  /** Stable identifier of the affected row. Optional for bulk actions. */
  entityId?: string | null;
  /** Before / after snapshots. Caller is responsible for redacting secrets. */
  diff?: AuditDiff | null;
  /** Source IP of the actor, when available. */
  ip?: string | null;
  /** User agent string of the actor, when available. */
  userAgent?: string | null;
};

/**
 * Append an audit log entry inside the current tenant transaction.
 *
 * Must be called with a Prisma transaction client obtained from
 * {@link withTenantTransaction}. The tenant id is read from
 * {@link requireTenantId} so callers can't accidentally write into a
 * different tenant's history.
 *
 * The underlying table has an append-only trigger (see migration
 * 20260515050000_init) — UPDATE / DELETE will be rejected at the DB.
 */
export async function writeAuditLog(
  tx: Prisma.TransactionClient,
  input: WriteAuditLogInput,
): Promise<void> {
  const tenantId = requireTenantId();
  await tx.auditLog.create({
    data: {
      tenantId,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      diff: (input.diff ?? null) as Prisma.InputJsonValue | null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
