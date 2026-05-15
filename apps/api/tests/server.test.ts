import { afterAll, describe, expect, it } from 'vitest';

import request from 'supertest';

import { prisma } from '../src/prisma.js';
import { redis } from '../src/redis.js';
import { createServer } from '../src/server.js';

const app = createServer();

afterAll(async () => {
  await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
});

describe('server smoke', () => {
  it('GET /healthz returns 200 or 503 with the expected shape', async () => {
    const res = await request(app).get('/healthz');
    expect([200, 503]).toContain(res.status);
    expect(res.body.status).toMatch(/^(ok|degraded)$/);
    expect(typeof res.body.db).toBe('boolean');
    expect(typeof res.body.cache).toBe('boolean');
    expect(typeof res.body.ts).toBe('string');
  });

  it('echoes x-request-id when provided', async () => {
    const res = await request(app).get('/healthz').set('x-request-id', 'abc-123');
    expect(res.headers['x-request-id']).toBe('abc-123');
  });

  it('generates an x-request-id when missing', async () => {
    const res = await request(app).get('/healthz');
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('GET /trpc/health.ping returns 200 ok', async () => {
    const res = await request(app).get('/trpc/health.ping');
    expect(res.status).toBe(200);
    expect(res.body.result.data.ok).toBe(true);
  });

  it('GET /trpc/me.whoami without tenant context returns UNAUTHORIZED', async () => {
    const res = await request(app).get('/trpc/me.whoami');
    expect(res.status).toBe(401);
    expect(res.body.error.data.code).toBe('UNAUTHORIZED');
  });

  it('GET /trpc/me.whoami with x-tenant-id resolves the tenant context', async () => {
    const tenant = '11111111-1111-1111-1111-111111111111';
    const res = await request(app).get('/trpc/me.whoami').set('x-tenant-id', tenant);
    expect(res.status).toBe(200);
    expect(res.body.result.data.tenantId).toBe(tenant);
  });

  it('ignores forged x-tenant-id that is not a UUID', async () => {
    const res = await request(app).get('/trpc/me.whoami').set('x-tenant-id', 'not-a-uuid');
    expect(res.status).toBe(401);
  });

  it('returns 404 with a JSON body for unknown routes', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
    expect(res.body.path).toBe('/nope');
    expect(typeof res.body.requestId).toBe('string');
  });
});
