import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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

describe('Row-Level Security tenant isolation', () => {
  let container!: StartedPostgreSqlContainer;
  let appClient!: Client;
  let migrateClient!: Client;
  let tenantA!: string;
  let tenantB!: string;

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

    // Seed two tenants as the migrate (superuser) role.
    const { rows: aRows } = await migrateClient.query<{ id: string }>(
      "INSERT INTO tenants (name, slug) VALUES ('Tenant A', 'tenant-a') RETURNING id",
    );
    const { rows: bRows } = await migrateClient.query<{ id: string }>(
      "INSERT INTO tenants (name, slug) VALUES ('Tenant B', 'tenant-b') RETURNING id",
    );
    const aId = aRows[0]?.id;
    const bId = bRows[0]?.id;
    if (!aId || !bId) {
      throw new Error('Tenant seeding failed');
    }
    tenantA = aId;
    tenantB = bId;

    // Seed a user per tenant.
    await migrateClient.query(
      "INSERT INTO users (tenant_id, email, password_hash) VALUES ($1, 'a@example.com', 'x'), ($2, 'b@example.com', 'x')",
      [tenantA, tenantB],
    );

    // Switch to the non-superuser app role for the actual assertions.
    appClient = new Client({
      host,
      port,
      database: 'tikflow',
      user: 'tikflow_app',
      password: 'tikflow_app',
    });
    await appClient.connect();
  }, 120_000);

  afterAll(async () => {
    await appClient?.end();
    await migrateClient?.end();
    await container?.stop();
  });

  it('returns zero rows when no tenant context is set', async () => {
    const { rows } = await appClient.query<{ count: string }>('SELECT count(*) FROM users');
    expect(rows[0]?.count).toBe('0');
  });

  it('returns only Tenant A rows when context = A', async () => {
    await appClient.query('BEGIN');
    await appClient.query("SELECT set_config('app.current_tenant', $1, true)", [tenantA]);

    const { rows } = await appClient.query<{ tenant_id: string; email: string }>(
      'SELECT tenant_id, email FROM users',
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.tenant_id).toBe(tenantA);
    expect(rows[0]?.email).toBe('a@example.com');

    await appClient.query('ROLLBACK');
  });

  it('returns only Tenant B rows when context = B', async () => {
    await appClient.query('BEGIN');
    await appClient.query("SELECT set_config('app.current_tenant', $1, true)", [tenantB]);

    const { rows } = await appClient.query<{ tenant_id: string; email: string }>(
      'SELECT tenant_id, email FROM users',
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.tenant_id).toBe(tenantB);
    expect(rows[0]?.email).toBe('b@example.com');

    await appClient.query('ROLLBACK');
  });

  it('forged WHERE clause cannot cross tenants', async () => {
    await appClient.query('BEGIN');
    await appClient.query("SELECT set_config('app.current_tenant', $1, true)", [tenantA]);

    // Attempt to read Tenant B's rows from a Tenant A session.
    const { rows } = await appClient.query('SELECT * FROM users WHERE tenant_id = $1', [tenantB]);

    expect(rows).toHaveLength(0);

    await appClient.query('ROLLBACK');
  });

  it('blocks cross-tenant INSERT via WITH CHECK', async () => {
    await appClient.query('BEGIN');
    await appClient.query("SELECT set_config('app.current_tenant', $1, true)", [tenantA]);

    // Try to insert a row labelled for Tenant B while in Tenant A's session.
    await expect(
      appClient.query(
        "INSERT INTO users (tenant_id, email, password_hash) VALUES ($1, 'evil@example.com', 'x')",
        [tenantB],
      ),
    ).rejects.toThrow(/row-level security|violates/i);

    await appClient.query('ROLLBACK');
  });

  it('audit_logs is append-only', async () => {
    await migrateClient.query('BEGIN');
    await migrateClient.query("SELECT set_config('app.current_tenant', $1, true)", [tenantA]);
    await migrateClient.query(
      "INSERT INTO audit_logs (tenant_id, action, entity_type) VALUES ($1, 'test', 'user')",
      [tenantA],
    );

    await expect(
      migrateClient.query("UPDATE audit_logs SET action = 'changed'"),
    ).rejects.toThrow(/append-only/i);

    await expect(migrateClient.query('DELETE FROM audit_logs')).rejects.toThrow(/append-only/i);

    await migrateClient.query('ROLLBACK');
  });

  it('set_tenant() helper sets the same context as set_config()', async () => {
    await appClient.query('BEGIN');
    await appClient.query('SELECT set_tenant($1)', [tenantA]);

    const { rows } = await appClient.query<{ count: string }>('SELECT count(*) FROM users');
    expect(rows[0]?.count).toBe('1');

    await appClient.query('ROLLBACK');
  });
});
