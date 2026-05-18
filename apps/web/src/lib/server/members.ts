import 'server-only';

import { hashPassword } from '@tikflow/auth';
import { Prisma, writeAuditLog } from '@tikflow/db';
import type {
  CreateMemberInput,
  MemberStatus,
  MemberSummary,
  SetMemberStatusInput,
  UpdateMemberRolesInput,
} from '@tikflow/contracts';

import { withTenantDb } from './db';
import type { AuthenticatedSession } from './session';

export class MemberError extends Error {
  constructor(
    public readonly code:
      | 'NOT_FOUND'
      | 'EMAIL_TAKEN'
      | 'UNKNOWN_ROLE'
      | 'LAST_OWNER'
      | 'SELF_SUSPEND',
    message: string,
  ) {
    super(message);
    this.name = 'MemberError';
  }
}

type ListMembersOptions = {
  status?: MemberStatus;
};

export async function listMembers(
  session: AuthenticatedSession,
  options: ListMembersOptions = {},
): Promise<MemberSummary[]> {
  return withTenantDb(session, async (tx) => {
    const rows = await tx.user.findMany({
      where: {
        deletedAt: null,
        ...(options.status ? { status: options.status } : {}),
      },
      orderBy: [{ status: 'asc' }, { email: 'asc' }],
      select: {
        id: true,
        email: true,
        status: true,
        mfaEnabled: true,
        lastLoginAt: true,
        userRoles: {
          select: {
            role: { select: { id: true, name: true } },
          },
        },
      },
    });

    return rows.map((u) => ({
      id: u.id,
      email: u.email,
      status: u.status,
      mfaEnabled: u.mfaEnabled,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      roles: u.userRoles.map((ur) => ur.role).sort((a, b) => a.name.localeCompare(b.name)),
    }));
  });
}

export async function getMember(
  session: AuthenticatedSession,
  memberId: string,
): Promise<MemberSummary> {
  return withTenantDb(session, async (tx) => {
    const row = await tx.user.findFirst({
      where: { id: memberId, deletedAt: null },
      select: {
        id: true,
        email: true,
        status: true,
        mfaEnabled: true,
        lastLoginAt: true,
        userRoles: { select: { role: { select: { id: true, name: true } } } },
      },
    });
    if (!row) {
      throw new MemberError('NOT_FOUND', `member ${memberId} not found`);
    }
    return {
      id: row.id,
      email: row.email,
      status: row.status,
      mfaEnabled: row.mfaEnabled,
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      roles: row.userRoles.map((ur) => ur.role).sort((a, b) => a.name.localeCompare(b.name)),
    };
  });
}

/**
 * Create a new tenant user with an admin-supplied initial password and
 * one or more roles. Email-driven invitations land in Phase 4 once SMTP
 * is wired; for now the admin shares the password out-of-band.
 *
 * The whole flow is atomic: row, role assignments, and audit log all
 * happen in the same Prisma transaction.
 */
export async function createMember(
  session: AuthenticatedSession,
  input: CreateMemberInput,
  meta: { ip: string | null; userAgent: string | null },
): Promise<MemberSummary> {
  const passwordHash = await hashPassword(input.password);

  return withTenantDb(session, async (tx) => {
    const validRoles = await tx.role.findMany({
      where: { id: { in: input.roleIds }, deletedAt: null },
      select: { id: true, name: true },
    });
    if (validRoles.length !== input.roleIds.length) {
      throw new MemberError('UNKNOWN_ROLE', 'one or more roles do not exist in this tenant');
    }

    let user;
    try {
      user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          status: 'active',
        },
        select: { id: true, email: true, status: true, mfaEnabled: true, lastLoginAt: true },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new MemberError('EMAIL_TAKEN', 'a member with that email already exists');
      }
      throw err;
    }

    await tx.userRole.createMany({
      data: input.roleIds.map((roleId) => ({
        userId: user.id,
        roleId,
        assignedBy: session.userId,
      })),
    });

    await writeAuditLog(tx, {
      actorUserId: session.userId,
      action: 'tenant.member.create',
      entityType: 'user',
      entityId: user.id,
      diff: {
        after: { email: user.email, roles: validRoles.map((r) => r.name) },
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      id: user.id,
      email: user.email,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      roles: validRoles.sort((a, b) => a.name.localeCompare(b.name)),
    };
  });
}

/**
 * Replace a member's role set. Guards against accidentally removing the
 * last owner — that would lock the tenant out of owner-only operations.
 */
export async function updateMemberRoles(
  session: AuthenticatedSession,
  memberId: string,
  input: UpdateMemberRolesInput,
  meta: { ip: string | null; userAgent: string | null },
): Promise<MemberSummary> {
  return withTenantDb(session, async (tx) => {
    const member = await tx.user.findFirst({
      where: { id: memberId, deletedAt: null },
      select: {
        id: true,
        email: true,
        userRoles: { select: { role: { select: { id: true, name: true } } } },
      },
    });
    if (!member) throw new MemberError('NOT_FOUND', `member ${memberId} not found`);

    const beforeRoles = member.userRoles.map((ur) => ur.role);
    const beforeNames = beforeRoles.map((r) => r.name).sort();

    const requestedRoles = await tx.role.findMany({
      where: { id: { in: input.roleIds }, deletedAt: null },
      select: { id: true, name: true },
    });
    if (requestedRoles.length !== input.roleIds.length) {
      throw new MemberError('UNKNOWN_ROLE', 'one or more roles do not exist in this tenant');
    }
    const afterNames = requestedRoles.map((r) => r.name).sort();

    // Last-owner guard: if removing owner from this member, ensure at
    // least one *other* active user still has the owner role.
    const losingOwner =
      beforeRoles.some((r) => r.name === 'owner') &&
      !requestedRoles.some((r) => r.name === 'owner');
    if (losingOwner) {
      await assertAnotherOwnerExists(tx, memberId);
    }

    await tx.userRole.deleteMany({ where: { userId: memberId } });
    await tx.userRole.createMany({
      data: requestedRoles.map((r) => ({
        userId: memberId,
        roleId: r.id,
        assignedBy: session.userId,
      })),
    });

    const sameRoles =
      beforeNames.length === afterNames.length &&
      beforeNames.every((n, i) => n === afterNames[i]);

    if (!sameRoles) {
      await writeAuditLog(tx, {
        actorUserId: session.userId,
        action: 'tenant.member.roles.update',
        entityType: 'user',
        entityId: memberId,
        diff: { before: { roles: beforeNames }, after: { roles: afterNames } },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    }

    const fresh = await tx.user.findFirstOrThrow({
      where: { id: memberId },
      select: {
        id: true,
        email: true,
        status: true,
        mfaEnabled: true,
        lastLoginAt: true,
      },
    });
    return {
      id: fresh.id,
      email: fresh.email,
      status: fresh.status,
      mfaEnabled: fresh.mfaEnabled,
      lastLoginAt: fresh.lastLoginAt?.toISOString() ?? null,
      roles: requestedRoles.sort((a, b) => a.name.localeCompare(b.name)),
    };
  });
}

/**
 * Suspend or reactivate a member. We never allow:
 *   - suspending yourself (you'd lock yourself out of recovery)
 *   - suspending the last owner of the tenant
 */
export async function setMemberStatus(
  session: AuthenticatedSession,
  memberId: string,
  input: SetMemberStatusInput,
  meta: { ip: string | null; userAgent: string | null },
): Promise<MemberSummary> {
  if (input.status === 'suspended' && memberId === session.userId) {
    throw new MemberError('SELF_SUSPEND', 'you cannot suspend your own account');
  }

  return withTenantDb(session, async (tx) => {
    const member = await tx.user.findFirst({
      where: { id: memberId, deletedAt: null },
      select: {
        id: true,
        email: true,
        status: true,
        userRoles: { select: { role: { select: { name: true } } } },
      },
    });
    if (!member) throw new MemberError('NOT_FOUND', `member ${memberId} not found`);

    if (input.status === 'suspended' && member.userRoles.some((ur) => ur.role.name === 'owner')) {
      await assertAnotherOwnerExists(tx, memberId);
    }

    if (member.status !== input.status) {
      await tx.user.update({
        where: { id: memberId },
        data: { status: input.status },
      });

      await writeAuditLog(tx, {
        actorUserId: session.userId,
        action:
          input.status === 'suspended'
            ? 'tenant.member.suspend'
            : 'tenant.member.reactivate',
        entityType: 'user',
        entityId: memberId,
        diff: { before: { status: member.status }, after: { status: input.status } },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    }

    const fresh = await tx.user.findFirstOrThrow({
      where: { id: memberId },
      select: {
        id: true,
        email: true,
        status: true,
        mfaEnabled: true,
        lastLoginAt: true,
        userRoles: { select: { role: { select: { id: true, name: true } } } },
      },
    });
    return {
      id: fresh.id,
      email: fresh.email,
      status: fresh.status,
      mfaEnabled: fresh.mfaEnabled,
      lastLoginAt: fresh.lastLoginAt?.toISOString() ?? null,
      roles: fresh.userRoles.map((ur) => ur.role).sort((a, b) => a.name.localeCompare(b.name)),
    };
  });
}

async function assertAnotherOwnerExists(
  tx: Prisma.TransactionClient,
  excludingMemberId: string,
): Promise<void> {
  const count = await tx.userRole.count({
    where: {
      userId: { not: excludingMemberId },
      role: { name: 'owner', deletedAt: null },
      user: { status: 'active', deletedAt: null },
    },
  });
  if (count === 0) {
    throw new MemberError(
      'LAST_OWNER',
      'cannot remove the last active owner of the workspace',
    );
  }
}
