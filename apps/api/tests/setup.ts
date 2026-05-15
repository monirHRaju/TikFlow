// Stub env BEFORE any module that imports `env.ts` is loaded.
// vitest applies `setupFiles` before test modules are imported, so this
// runs first.
process.env.NODE_ENV ??= 'test';
process.env.LOG_LEVEL ??= 'silent';
process.env.DATABASE_URL ??= 'postgres://test:test@127.0.0.1:5432/test';
process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
process.env.CORS_ORIGINS ??= 'http://localhost:3000';
