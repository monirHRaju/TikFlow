export { Prisma, PrismaClient } from '@prisma/client';
export type {
  Tenant,
  User,
  Role,
  Permission,
  RolePermission,
  UserRole,
  ApiKey,
  Session,
  AuditLog,
  SecurityEvent,
  TenantPlan,
  TenantStatus,
  KycStatus,
  UserStatus,
  SecurityEventKind,
  SecurityEventSeverity,
} from '@prisma/client';

export { prisma, prismaWithTenantIsolation } from './client.js';
export type { PrismaClientWithTenantIsolation } from './client.js';

export {
  getCurrentTenantId,
  getTenantContext,
  requireTenantId,
  withTenant,
  type TenantStore,
} from './tenant-context.js';

export { withTenantTransaction } from './tenant-transaction.js';

export { tenantIsolation } from './extensions/tenant-isolation.js';
