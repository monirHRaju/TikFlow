import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * The fixed marker that distinguishes TikFlow API keys from any other
 * `Authorization: Bearer …` value an integrator might send. Inspired by
 * Stripe's `sk_live_…` convention.
 */
export const API_KEY_BRAND = 'tkf';

/** Length of the random suffix in bytes; 32 bytes = 256 bits of entropy. */
const API_KEY_RANDOM_BYTES = 32;

/** Length of the public-facing prefix shown in dashboards and lists. */
export const API_KEY_PREFIX_LENGTH = 12;

export type GeneratedApiKey = {
  /** The full key shown to the admin once; never persisted. */
  plaintext: string;
  /** The first 12 characters — safe to show forever (no entropy leaked). */
  prefix: string;
  /** Server-side identifier; what we persist. */
  hashedKey: string;
};

/**
 * Generate a new API key. The plaintext is shown to the admin once and
 * thrown away; the database only stores `hashedKey` plus the public
 * `prefix`.
 *
 * Format: `tkf_<43 url-safe base64 chars>`.
 *
 * Hashing uses SHA-256: the input already has 256 bits of CSPRNG entropy
 * so a memory-hard KDF (argon2) would be wasted compute on every API
 * request. Brute-forcing a 256-bit key is infeasible regardless.
 */
export function generateApiKey(): GeneratedApiKey {
  const random = randomBytes(API_KEY_RANDOM_BYTES);
  const body = base64url(random);
  const plaintext = `${API_KEY_BRAND}_${body}`;
  return {
    plaintext,
    prefix: plaintext.slice(0, API_KEY_PREFIX_LENGTH),
    hashedKey: hashApiKey(plaintext),
  };
}

/**
 * Hash an API key plaintext for storage and comparison. Always returns
 * lowercase hex so a `timingSafeEqual` comparison is straightforward.
 */
export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext, 'utf8').digest('hex');
}

/**
 * Constant-time comparison of a candidate plaintext against a stored
 * hash. Returns `false` for any malformed input rather than throwing —
 * the caller is dealing with attacker-controlled bytes.
 */
export function verifyApiKey(candidate: string, expectedHash: string): boolean {
  if (typeof candidate !== 'string' || typeof expectedHash !== 'string') return false;
  if (!candidate.startsWith(`${API_KEY_BRAND}_`)) return false;
  const actual = Buffer.from(hashApiKey(candidate), 'hex');
  let expected: Buffer;
  try {
    expected = Buffer.from(expectedHash, 'hex');
  } catch {
    return false;
  }
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function base64url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
