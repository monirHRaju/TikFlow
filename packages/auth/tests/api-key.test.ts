import { describe, expect, it } from 'vitest';

import {
  API_KEY_BRAND,
  API_KEY_PREFIX_LENGTH,
  generateApiKey,
  hashApiKey,
  verifyApiKey,
} from '../src/api-key.js';

describe('generateApiKey', () => {
  it('emits a branded plaintext, a stable prefix, and a sha256 hash', () => {
    const key = generateApiKey();
    expect(key.plaintext.startsWith(`${API_KEY_BRAND}_`)).toBe(true);
    expect(key.prefix.length).toBe(API_KEY_PREFIX_LENGTH);
    expect(key.prefix).toBe(key.plaintext.slice(0, API_KEY_PREFIX_LENGTH));
    expect(key.hashedKey).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces unique values across calls', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.plaintext).not.toBe(b.plaintext);
    expect(a.hashedKey).not.toBe(b.hashedKey);
  });
});

describe('verifyApiKey', () => {
  it('accepts a matching plaintext', () => {
    const key = generateApiKey();
    expect(verifyApiKey(key.plaintext, key.hashedKey)).toBe(true);
  });

  it('rejects a tampered plaintext', () => {
    const key = generateApiKey();
    const tampered = `${key.plaintext.slice(0, -1)}X`;
    expect(verifyApiKey(tampered, key.hashedKey)).toBe(false);
  });

  it('rejects an unbranded plaintext (defends against bearer-prefix confusion)', () => {
    const key = generateApiKey();
    const stripped = key.plaintext.slice(`${API_KEY_BRAND}_`.length);
    expect(verifyApiKey(stripped, key.hashedKey)).toBe(false);
  });

  it('rejects empty string or non-string input without throwing', () => {
    expect(verifyApiKey('', 'a'.repeat(64))).toBe(false);
    // @ts-expect-error: deliberate misuse to confirm we don't throw on bad input.
    expect(verifyApiKey(null, 'a'.repeat(64))).toBe(false);
  });
});

describe('hashApiKey', () => {
  it('is deterministic for the same input', () => {
    const a = hashApiKey('tkf_test_value');
    const b = hashApiKey('tkf_test_value');
    expect(a).toBe(b);
  });
});
