import 'server-only';

import type { RoleSummary } from '@tikflow/contracts';

import { withTenantDb } from './db';
import type { AuthenticatedSession } from './session';

/**
 * List every role defined for the tenant, along with its assigned
 * permissions and the count of users currently holding it.
 *
 * Useful both for the read-only /settings/roles page and for the
 * role-selector on the add-member form.
 */
export async function listRoles(session: AuthenticatedSession): Promise<RoleSummary[]> {
  return withTenantDb(session, async (tx) => {
    const roles = await tx.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true,
        _count: { select: { userRoles: true } },
        rolePermissions: {
          select: {
            permission: { select: { code: true, description: true } },
          },
        },
      },
    });

    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      memberCount: r._count.userRoles,
      permissions: r.rolePermissions
        .map((rp) => ({
          code: rp.permission.code,
          description: rp.permission.description,
        }))
        .sort((a, b) => a.code.localeCompare(b.code)),
    }));
  });
}
