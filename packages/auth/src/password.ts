import argon2 from 'argon2';

import { PASSWORD_MIN_LENGTH } from './constants.js';

// argon2id parameters tuned for ~100ms on a modern server CPU. Tune in
// load-test phase. These ALSO encode into the hash, so old hashes keep
// working when we re-tune.
const HASH_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export class WeakPasswordError extends Error {
  constructor(reason: string) {
    super(`Weak password: ${reason}`);
    this.name = 'WeakPasswordError';
  }
}

/**
 * Hash a plaintext password with argon2id. Throws WeakPasswordError if the
 * password fails the policy check.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  assertPasswordPolicy(plaintext);
  return argon2.hash(plaintext, HASH_OPTIONS);
}

/**
 * Constant-time verify of a plaintext password against an argon2 hash.
 * Returns false on any verification failure rather than throwing, so
 * callers can record a single login_fail event regardless of the reason.
 */
export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  if (!plaintext || !hash) {
    return false;
  }
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}

export function assertPasswordPolicy(plaintext: string): void {
  if (plaintext.length < PASSWORD_MIN_LENGTH) {
    throw new WeakPasswordError(`must be at least ${String(PASSWORD_MIN_LENGTH)} characters`);
  }
  // Cheap, opinionated: require at least one digit and one letter. Real
  // breach-corpus checks (e.g. zxcvbn) happen at registration in PR-1.x.
  if (!/[A-Za-z]/.test(plaintext) || !/[0-9]/.test(plaintext)) {
    throw new WeakPasswordError('must include letters and digits');
  }
}
