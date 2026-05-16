import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { writeAuditLog } from '../src/audit.js';
import { withTenantTransaction } from '../src/tenant-transaction.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(PACKAGE_ROOT, '../..');

const INIT_SQL = [
  readFileSync(join(REPO_ROOT, 'infra/postgres/init/01-extensions.sql'), 'utf8'),
  readFileSync(join(REPO_ROOT, 'infra/postgres/init/02-roles.sql'), 'utf8'),
];

const MIGRATION_SQL = readFileSync(
  join(PACKAGE_ROOT, 'prisma/migrations/20260515050000_init/migration.sql'),
  'utf8',
);

describe('writeAuditLog', () => {
  let container!: StartedPostgreSqlContainer;
  let migrateClient!: Client;
  let prisma!: PrismaClient;
  let tenantA!: string;
  let tenantB!: string;
  let userA!: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('tikflow')
      .withUsername('tikflow')
      .withPassword('tikflow')
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(5432);

    migrateClient = new Client({
      host,
      port,
      database: 'tikflow',
      user: 'tikflow',
      password: 'tikflow',
    });
    await migrateClient.connect();

    for (const sql of INIT_SQL) {
      await migrateClient.query(sql);
    }
    await migrateClient.query(MIGRATION_SQL);

    const { rows: aRows } = await migrateClient.query<{ id: string }>(
      "INSERT INTO tenants (name, slug) VALUES ('Tenant A', 'tenant-a') RETURNING id",
    );
    const { rows: bRows } = await migrateClient.query<{ id: string }>(
      "INSERT INTO tenants (name, slug) VALUES ('Tenant B', 'tenant-b') RETURNING id",
    );
    const aId = aRows[0]?.id;
    const bId = bRows[0]?.id;
    if (!aId || !bId) throw new Error('Tenant seeding failed');
    tenantA = aId;
    tenantB = bId;

    const { rows: userRows } = await migrateClient.query<{ id: string }>(
      "INSERT INTO users (tenant_id, email, password_hash) VALUES ($1, 'owner-a@example.com', 'x') RETURNING id",
      [tenantA],
    );
    const userId = userRows[0]?.id;
    if (!userId) throw new Error('User seeding failed');
    userA = userId;

    // Prisma connects via the non-superuser app role so writeAuditLog runs
    // through the same RLS path the web app does in production.
    const url = `postgres://tikflow_app:tikflow_app@${host}:${port}/tikflow?schema=public`;
    prisma = new PrismaClient({ datasources: { db: { url } } });
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await migrateClient?.end();
    await container?.stop();
  });

  it('writes an audit log row tagged with the active tenant', async () => {
    await withTenantTransaction(prisma, tenantA, async (tx) => {
      await writeAuditLog(tx, {
        actorUserId: userA,
        action: 'tenant.settings.update',
        entityType: 'tenant',
        entityId: tenantA,
        diff: { before: { name: 'Tenant A' }, after: { name: 'A Inc.' } },
        ip: '127.0.0.1',
        userAgent: 'vitest',
      });
    });

    const { rows } = await migrateClient.query<{
      tenant_id: string;
      action: string;
      entity_type: string;
      actor_user_id: string;
    }>(
      "SELECT tenant_id, action, entity_type, actor_user_id FROM audit_logs WHERE entity_id = $1",
      [tenantA],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tenant_id).toBe(tenantA);
    expect(rows[0]?.action).toBe('tenant.settings.update');
    expect(rows[0]?.actor_user_id).toBe(userA);
  });

  it("a tenant cannot read another tenant's audit log entries", async () => {
    // Seed an entry for Tenant B directly via the superuser to set up the case.
    await migrateClient.query(
      "INSERT INTO audit_logs (tenant_id, action, entity_type) VALUES ($1, 'login.success', 'user')",
      [tenantB],
    );

    const rowsForA = await withTenantTransaction(prisma, tenantA, async (tx) => {
      return tx.auditLog.findMany();
    });

    // Tenant A's session must not see Tenant B's row.
    expect(rowsForA.every((r) => r.tenantId === tenantA)).toBe(true);
  });

  it('rejects writes when no tenant context is set', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await writeAuditLog(tx, {
          actorUserId: null,
          action: 'should.fail',
          entityType: 'noop',
        });
      }),
    ).rejects.toThrow(/tenant/i);
  });
});
