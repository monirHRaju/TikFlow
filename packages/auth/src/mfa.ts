import { authenticator } from 'otplib';

import { TOTP_ISSUER } from './constants.js';

// 30-second step, 6-digit token, ±1 window (60s clock skew tolerance).
authenticator.options = {
  step: 30,
  digits: 6,
  window: 1,
};

/**
 * Generate a fresh base32 secret to store with the user (encrypted at rest).
 */
export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Build the otpauth:// URI for QR rendering during enrolment.
 * `accountLabel` is typically the user email; it's URL-encoded by otplib.
 */
export function buildTotpUri(accountLabel: string, secret: string): string {
  return authenticator.keyuri(accountLabel, TOTP_ISSUER, secret);
}

/**
 * Verify a 6-digit token against a stored secret. Returns false for any
 * malformed input rather than throwing.
 */
export function verifyTotpToken(token: string, secret: string): boolean {
  if (!/^\d{6}$/.test(token) || !secret) {
    return false;
  }
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}
