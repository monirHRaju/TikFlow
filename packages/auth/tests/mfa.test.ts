import { authenticator } from 'otplib';
import { describe, expect, it } from 'vitest';

import { buildTotpUri, generateTotpSecret, verifyTotpToken } from '../src/mfa.js';

describe('mfa / TOTP', () => {
  it('generates a base32 secret', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThanOrEqual(16);
  });

  it('produces an otpauth URI with the TikFlow issuer', () => {
    const uri = buildTotpUri('owner@demo.com', 'JBSWY3DPEHPK3PXP');
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain('issuer=TikFlow');
    expect(uri).toContain('owner%40demo.com');
  });

  it('verifies a freshly generated token', () => {
    const secret = generateTotpSecret();
    const token = authenticator.generate(secret);
    expect(verifyTotpToken(token, secret)).toBe(true);
  });

  it('rejects malformed tokens', () => {
    const secret = generateTotpSecret();
    expect(verifyTotpToken('abcdef', secret)).toBe(false);
    expect(verifyTotpToken('12345', secret)).toBe(false);
    expect(verifyTotpToken('1234567', secret)).toBe(false);
  });

  it('rejects tokens that do not match the secret', () => {
    const secret = generateTotpSecret();
    const other = generateTotpSecret();
    const token = authenticator.generate(other);
    expect(verifyTotpToken(token, secret)).toBe(false);
  });
});
