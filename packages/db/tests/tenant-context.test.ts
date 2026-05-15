import { describe, expect, it } from 'vitest';

import {
  getCurrentTenantId,
  getTenantContext,
  requireTenantId,
  withTenant,
} from '../src/tenant-context.js';

describe('tenant-context AsyncLocalStorage', () => {
  it('returns undefined outside a withTenant scope', () => {
    expect(getCurrentTenantId()).toBeUndefined();
    expect(getTenantContext()).toBeUndefined();
  });

  it('exposes tenantId inside a withTenant scope', async () => {
    const tenantId = '00000000-0000-0000-0000-000000000001';
    const result = await withTenant({ tenantId }, () => {
      return Promise.resolve(getCurrentTenantId());
    });
    expect(result).toBe(tenantId);
  });

  it('isolates concurrent tenant contexts', async () => {
    const a = '00000000-0000-0000-0000-0000000000aa';
    const b = '00000000-0000-0000-0000-0000000000bb';

    const [seenA, seenB] = await Promise.all([
      withTenant({ tenantId: a }, async () => {
        await new Promise((r) => setTimeout(r, 10));
        return getCurrentTenantId();
      }),
      withTenant({ tenantId: b }, async () => {
        await new Promise((r) => setTimeout(r, 5));
        return getCurrentTenantId();
      }),
    ]);

    expect(seenA).toBe(a);
    expect(seenB).toBe(b);
  });

  it('requireTenantId throws when no context is set', () => {
    expect(() => requireTenantId()).toThrow(/tenant context/i);
  });

  it('requireTenantId returns id inside scope', async () => {
    const tenantId = '00000000-0000-0000-0000-000000000042';
    const result = await withTenant({ tenantId }, () => Promise.resolve(requireTenantId()));
    expect(result).toBe(tenantId);
  });
});
