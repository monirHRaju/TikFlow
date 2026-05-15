/** Number of consecutive failed sign-in attempts before the account is locked. */
export const LOCKOUT_THRESHOLD = 5;

/** Duration of an account lockout, in seconds (15 minutes). */
export const LOCKOUT_DURATION_SECONDS = 15 * 60;

/** Session JWT lifetime, in seconds (8 hours). */
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

/** Minimum password length enforced at registration / change time. */
export const PASSWORD_MIN_LENGTH = 12;

/** Issuer label baked into TOTP otpauth URIs. */
export const TOTP_ISSUER = 'TikFlow';
