import { PrismaClient } from '@tikflow/db';
import {
  LOCKOUT_DURATION_SECONDS,
  LOCKOUT_THRESHOLD,
  SESSION_MAX_AGE_SECONDS,
  verifyPassword,
  verifyTotpToken,
} from '@tikflow/auth';
import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';

// Local PrismaClient — sign-in queries call SECURITY DEFINER functions
// (see migration 20260516000000_auth_functions) so they work without a
// tenant context being set in advance.
const prisma = new PrismaClient();

const credentialsSchema = z.object({
  tenantSlug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9](-?[a-z0-9])*$/, 'invalid tenant slug'),
  email: z.string().email().toLowerCase(),
  password: z.string().min(1).max(200),
  otp: z
    .string()
    .regex(/^\d{6}$/)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

type UserLoginRow = {
  user_id: string;
  tenant_id: string;
  password_hash: string;
  mfa_secret: string | null;
  mfa_enabled: boolean;
  status: 'active' | 'invited' | 'suspended' | 'deleted';
  failed_login_count: number;
  locked_until: Date | null;
};

/**
 * Specific sign-in error codes surfaced to the client. We keep them small
 * and non-revealing — INVALID_CREDENTIALS covers "unknown tenant", "unknown
 * email" and "wrong password" alike.
 */
export class TikflowAuthError extends CredentialsSignin {
  override code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

async function recordSecurityEvent(
  tenantId: string,
  kind: 'login_success' | 'login_fail' | 'mfa_fail' | 'account_lockout',
  severity: 'low' | 'medium' | 'high' | 'critical',
): Promise<void> {
  await prisma.$executeRaw`
    SELECT record_security_event(
      ${tenantId}::uuid,
      ${kind}::security_event_kind,
      ${severity}::security_event_severity,
      NULL::inet,
      NULL::text,
      NULL::jsonb
    )
  `;
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        tenantSlug: { label: 'Tenant' },
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        otp: { label: 'One-time code' },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) {
          throw new TikflowAuthError('INVALID_CREDENTIALS');
        }
        const { tenantSlug, email, password, otp } = parsed.data;

        const rows = await prisma.$queryRaw<UserLoginRow[]>`
          SELECT * FROM find_user_for_login(${tenantSlug}, ${email})
        `;
        const user = rows[0];
        if (!user) {
          throw new TikflowAuthError('INVALID_CREDENTIALS');
        }

        if (user.status !== 'active' && user.status !== 'invited') {
          throw new TikflowAuthError('ACCOUNT_INACTIVE');
        }

        if (user.locked_until && user.locked_until > new Date()) {
          throw new TikflowAuthError('ACCOUNT_LOCKED');
        }

        const passwordOk = await verifyPassword(password, user.password_hash);
        if (!passwordOk) {
          const lockedUntil = await prisma.$queryRaw<Array<{ record_login_failure: Date | null }>>`
            SELECT record_login_failure(
              ${user.user_id}::uuid,
              ${LOCKOUT_THRESHOLD}::int,
              ${LOCKOUT_DURATION_SECONDS}::int
            )
          `;
          await recordSecurityEvent(user.tenant_id, 'login_fail', 'medium');
          if (lockedUntil[0]?.record_login_failure) {
            await recordSecurityEvent(user.tenant_id, 'account_lockout', 'high');
            throw new TikflowAuthError('ACCOUNT_LOCKED');
          }
          throw new TikflowAuthError('INVALID_CREDENTIALS');
        }

        if (user.mfa_enabled && user.mfa_secret) {
          if (!otp) {
            throw new TikflowAuthError('MFA_REQUIRED');
          }
          if (!verifyTotpToken(otp, user.mfa_secret)) {
            await recordSecurityEvent(user.tenant_id, 'mfa_fail', 'medium');
            throw new TikflowAuthError('INVALID_CREDENTIALS');
          }
        }

        await prisma.$executeRaw`SELECT record_login_success(${user.user_id}::uuid)`;
        await recordSecurityEvent(user.tenant_id, 'login_success', 'low');

        return {
          id: user.user_id,
          email,
          tenantId: user.tenant_id,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.tenantId = user.tenantId;
      }
      return token;
    },
    session({ session, token }) {
      if (typeof token.userId === 'string') {
        session.user.id = token.userId;
      }
      if (typeof token.tenantId === 'string') {
        session.tenantId = token.tenantId;
      }
      return session;
    },
  },
});
