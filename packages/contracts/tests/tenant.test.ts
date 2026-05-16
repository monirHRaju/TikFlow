import { describe, expect, it } from 'vitest';

import {
  HexColorSchema,
  TenantBrandingSchema,
  TenantGeneralSettingsSchema,
} from '../src/tenant.js';

describe('TenantGeneralSettingsSchema', () => {
  it('accepts a minimal valid payload', () => {
    const result = TenantGeneralSettingsSchema.safeParse({
      name: 'Acme Networks',
      billingEmail: 'finance@acme.net',
      timezone: 'Asia/Dhaka',
      currency: 'BDT',
    });
    expect(result.success).toBe(true);
  });

  it('coerces empty billingEmail to a validation error, but null is allowed', () => {
    expect(
      TenantGeneralSettingsSchema.safeParse({
        name: 'Acme',
        billingEmail: null,
        timezone: 'UTC',
        currency: 'USD',
      }).success,
    ).toBe(true);

    expect(
      TenantGeneralSettingsSchema.safeParse({
        name: 'Acme',
        billingEmail: '',
        timezone: 'UTC',
        currency: 'USD',
      }).success,
    ).toBe(false);
  });

  it('rejects three-letter currency that is not all uppercase', () => {
    const result = TenantGeneralSettingsSchema.safeParse({
      name: 'Acme',
      billingEmail: null,
      timezone: 'UTC',
      currency: 'usd',
    });
    expect(result.success).toBe(false);
  });

  it('rejects clearly bogus timezones', () => {
    const result = TenantGeneralSettingsSchema.safeParse({
      name: 'Acme',
      billingEmail: null,
      timezone: '../etc/passwd',
      currency: 'USD',
    });
    expect(result.success).toBe(false);
  });
});

describe('HexColorSchema', () => {
  it.each(['#0066ff', '#FFFFFF', '#abcDEF'])('accepts %s', (val) => {
    expect(HexColorSchema.safeParse(val).success).toBe(true);
  });

  it.each(['0066ff', '#fff', '#0066FFa', 'rgb(0,0,0)', '#ZZZZZZ'])('rejects %s', (val) => {
    expect(HexColorSchema.safeParse(val).success).toBe(false);
  });
});

describe('TenantBrandingSchema', () => {
  it('accepts an all-null payload (defaults)', () => {
    const result = TenantBrandingSchema.safeParse({
      accentHex: null,
      logoUrl: null,
      invoicePrefix: null,
      invoiceHeader: null,
      invoiceFooter: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects http logo URLs (requires https)', () => {
    const result = TenantBrandingSchema.safeParse({
      accentHex: null,
      logoUrl: 'http://cdn.example.com/logo.png',
      invoicePrefix: null,
      invoiceHeader: null,
      invoiceFooter: null,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invoice prefix with lowercase or special chars', () => {
    expect(
      TenantBrandingSchema.safeParse({
        accentHex: null,
        logoUrl: null,
        invoicePrefix: 'inv_',
        invoiceHeader: null,
        invoiceFooter: null,
      }).success,
    ).toBe(false);
  });

  it('accepts UPPERCASE-DIGITS-HYPHEN invoice prefix', () => {
    expect(
      TenantBrandingSchema.safeParse({
        accentHex: null,
        logoUrl: null,
        invoicePrefix: 'INV-2026',
        invoiceHeader: null,
        invoiceFooter: null,
      }).success,
    ).toBe(true);
  });

  it('rejects an oversize invoice header (> 1000 chars)', () => {
    const big = 'x'.repeat(1001);
    expect(
      TenantBrandingSchema.safeParse({
        accentHex: null,
        logoUrl: null,
        invoicePrefix: null,
        invoiceHeader: big,
        invoiceFooter: null,
      }).success,
    ).toBe(false);
  });
});
