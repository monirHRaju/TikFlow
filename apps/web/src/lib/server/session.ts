import 'server-only';

import { redirect } from 'next/navigation';
import { Prisma } from '@tikflow/db';

import { auth } from '@/auth';
import { withTenantDb } from './db';

export type AuthenticatedSession = {
  userId: string;
  tenantId: string;
  email: string;
};

/**
 * Resolve the current session and return a flat object the server-side
 * code can rely on. If anything is missing we redirect to /login rather
 * than throw — this is invoked from layouts and pages, never from APIs.
 */
export async function requireSession(locale: string): Promise<AuthenticatedSession> {
  const session = await auth();
  const userId = session?.user?.id;
  const tenantId = session?.tenantId;
  const email = session?.user?.email;
  if (!session || !userId || !tenantId || !email) {
    redirect(`/${locale}/login`);
  }
  return { userId, tenantId, email };
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Authorise a session against one or more role names. Roles are stored in
 * the `roles` table and assigned through `user_roles`; this resolves them
 * inside the tenant transaction so RLS picks up only this tenant's rows.
 *
 * Throws {@link ForbiddenError} when the caller doesn't hold any of the
 * required roles. Callers convert this to a 403 (server actions) or a
 * 404 (pages, to avoid leaking the existence of a privileged page).
 */
export async function requireRole(
  session: AuthenticatedSession,
  allowed: ReadonlyArray<string>,
): Promise<void> {
  const roleNames = await listRoleNames(session);
  const ok = roleNames.some((name) => allowed.includes(name));
  if (!ok) {
    throw new ForbiddenError(
      `Requires one of: ${allowed.join(', ')} (have: ${roleNames.join(', ') || 'none'})`,
    );
  }
}

async function listRoleNames(session: AuthenticatedSession): Promise<string[]> {
  return withTenantDb(session, async (tx) => {
    const rows = await tx.$queryRaw<Array<{ name: string }>>(Prisma.sql`
      SELECT r.name
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ${session.userId}::uuid
    `);
    return rows.map((r) => r.name);
  });
}
