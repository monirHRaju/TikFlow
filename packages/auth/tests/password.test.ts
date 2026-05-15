import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword, WeakPasswordError } from '../src/password.js';

describe('password', () => {
  it('round-trips a strong password', async () => {
    const hash = await hashPassword('correct-horse-battery-42');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword('correct-horse-battery-42', hash)).toBe(true);
    expect(await verifyPassword('wrong-password-12345', hash)).toBe(false);
  });

  it('rejects too-short passwords', async () => {
    await expect(hashPassword('shortP12')).rejects.toBeInstanceOf(WeakPasswordError);
  });

  it('rejects passwords without a digit', async () => {
    await expect(hashPassword('only-letters-here')).rejects.toBeInstanceOf(WeakPasswordError);
  });

  it('returns false for empty inputs without throwing', async () => {
    expect(await verifyPassword('', '$argon2id$v=19$...')).toBe(false);
    expect(await verifyPassword('anything', '')).toBe(false);
  });

  it('returns false for malformed hashes without throwing', async () => {
    expect(await verifyPassword('anything', 'not-a-hash')).toBe(false);
  });
});
