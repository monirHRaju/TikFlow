import { Prisma } from '@prisma/client';

import { getCurrentTenantId } from '../tenant-context.js';

// Models that carry a `tenant_id` column. These get `tenantId` auto-injected
// on read and write operations. Keep in sync with prisma/schema.prisma.
const TENANT_SCOPED_MODELS = new Set<string>([
  'User',
  'Role',
  'RolePermission',
  'UserRole',
  'ApiKey',
  'Session',
  'AuditLog',
  'SecurityEvent',
]);

const READ_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

const MUTATING_FILTER_OPERATIONS = new Set([
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
]);

const CREATE_OPERATIONS = new Set(['create', 'createMany']);

/**
 * App-layer defence in depth. RLS at the database is the primary guard;
 * this extension prevents accidental cross-tenant queries from being
 * sent to Postgres at all by auto-injecting `tenantId` into every
 * scoped operation.
 *
 * Requires `withTenant(...)` (or `withTenantTransaction(...)`) to set
 * the AsyncLocalStorage tenant id before any query runs.
 */
export const tenantIsolation = Prisma.defineExtension({
  name: 'tikflow:tenantIsolation',
  query: {
    $allModels: {
      $allOperations({ args, query, model, operation }) {
        if (!TENANT_SCOPED_MODELS.has(model)) {
          return query(args);
        }

        const tenantId = getCurrentTenantId();
        if (!tenantId) {
          // Without a tenant context, Postgres' RLS function returns NULL
          // and every row is hidden. Surface the misuse early with a clear
          // application-layer error rather than a confusing empty result.
          throw new Error(
            `Tenant context missing for ${model}.${operation}. Wrap the call in withTenant() / withTenantTransaction().`,
          );
        }

        const nextArgs = args as Record<string, unknown>;

        if (READ_OPERATIONS.has(operation) || MUTATING_FILTER_OPERATIONS.has(operation)) {
          const existingWhere = (nextArgs.where ?? {}) as Record<string, unknown>;
          nextArgs.where = { ...existingWhere, tenantId };
        }

        if (CREATE_OPERATIONS.has(operation)) {
          const existingData = nextArgs.data;
          if (Array.isArray(existingData)) {
            nextArgs.data = existingData.map((row: Record<string, unknown>) => ({
              ...row,
              tenantId,
            }));
          } else if (existingData && typeof existingData === 'object') {
            nextArgs.data = { ...(existingData as Record<string, unknown>), tenantId };
          }
        }

        return query(nextArgs);
      },
    },
  },
});
