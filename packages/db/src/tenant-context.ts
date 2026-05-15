import { AsyncLocalStorage } from 'node:async_hooks';

export type TenantStore = {
  tenantId: string;
  userId?: string;
};

const storage = new AsyncLocalStorage<TenantStore>();

export function getTenantContext(): TenantStore | undefined {
  return storage.getStore();
}

export function getCurrentTenantId(): string | undefined {
  return storage.getStore()?.tenantId;
}

export function requireTenantId(): string {
  const id = getCurrentTenantId();
  if (!id) {
    throw new Error('No tenant context set. Wrap the call in withTenant().');
  }
  return id;
}

/**
 * Run `fn` inside an AsyncLocalStorage scope so any code downstream can
 * read the tenant id (and optional user id) without threading it through
 * every signature. This sets the JS-side context only; for DB queries to
 * also be RLS-isolated, use `withTenantTransaction` (see
 * ./tenant-transaction.ts).
 */
export function withTenant<T>(store: TenantStore, fn: () => Promise<T> | T): Promise<T> | T {
  return storage.run(store, fn);
}
