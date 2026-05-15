import type { Prisma, PrismaClient } from '@prisma/client';

import { withTenant } from './tenant-context.js';

/**
 * Open a Prisma transaction, set the Postgres session variable
 * `app.current_tenant` for the duration of the transaction, and run the
 * caller's code with a transaction-scoped client.
 *
 * Combined with FORCE ROW LEVEL SECURITY on every tenant-scoped table,
 * this guarantees no row from another tenant can be read or written even
 * if the caller forges a `where: { tenantId: '<other>' }` clause.
 */
export async function withTenantTransaction<T>(
  prisma: PrismaClient,
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { userId?: string },
): Promise<T> {
  return withTenant({ tenantId, userId: options?.userId }, () =>
    prisma.$transaction(async (tx) => {
      // set_config(setting, value, is_local=true) is the parameterised
      // equivalent of SET LOCAL — safe from injection.
      await tx.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`;
      return fn(tx);
    }),
  );
}
