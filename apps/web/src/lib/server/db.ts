import 'server-only';

import type { Prisma } from '@tikflow/db';
import { prisma, withTenantTransaction } from '@tikflow/db';

import type { AuthenticatedSession } from './session';

/**
 * Run a Prisma transaction scoped to the caller's tenant.
 *
 * Sets `app.current_tenant` for the duration of the transaction so RLS
 * filters every query, and forwards `actorUserId` to anything inside that
 * wants to write an audit log entry.
 */
export function withTenantDb<T>(
  session: AuthenticatedSession,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return withTenantTransaction(prisma, session.tenantId, fn, {
    userId: session.userId,
  });
}
