import { describe, expect, it } from 'vitest';

import {
  API_KEY_SCOPES,
  CreateApiKeySchema,
} from '../src/api-key.js';

describe('CreateApiKeySchema', () => {
  it('accepts a minimal valid payload (no expiry)', () => {
    const result = CreateApiKeySchema.safeParse({
      label: 'Production webhooks',
      scopes: ['tenant.read'],
      expiresAt: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty scopes list', () => {
    expect(
      CreateApiKeySchema.safeParse({
        label: 'noop',
        scopes: [],
        expiresAt: null,
      }).success,
    ).toBe(false);
  });

  it('rejects an unknown scope code', () => {
    expect(
      CreateApiKeySchema.safeParse({
        label: 'noop',
        scopes: ['subscriber.write'],
        expiresAt: null,
      }).success,
    ).toBe(false);
  });

  it('rejects an expiry in the past', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(
      CreateApiKeySchema.safeParse({
        label: 'noop',
        scopes: ['tenant.read'],
        expiresAt: past,
      }).success,
    ).toBe(false);
  });

  it('accepts a future expiry', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(
      CreateApiKeySchema.safeParse({
        label: 'noop',
        scopes: ['tenant.read'],
        expiresAt: future,
      }).success,
    ).toBe(true);
  });

  it('rejects label shorter than 2 chars', () => {
    expect(
      CreateApiKeySchema.safeParse({
        label: 'a',
        scopes: ['tenant.read'],
        expiresAt: null,
      }).success,
    ).toBe(false);
  });

  it('exposes the API_KEY_SCOPES tuple for the UI', () => {
    expect(API_KEY_SCOPES.length).toBeGreaterThan(0);
    expect(API_KEY_SCOPES).toContain('tenant.read');
  });
});
