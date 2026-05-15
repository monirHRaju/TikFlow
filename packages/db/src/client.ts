import { PrismaClient } from '@prisma/client';

import { tenantIsolation } from './extensions/tenant-isolation.js';

const globalForPrisma = globalThis as unknown as {
  __prisma?: PrismaClient;
};

function buildClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
        : ['warn', 'error'],
  });
}

export const prisma = globalForPrisma.__prisma ?? buildClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}

export const prismaWithTenantIsolation = prisma.$extends(tenantIsolation);

export type PrismaClientWithTenantIsolation = typeof prismaWithTenantIsolation;
