import 'server-only';

import { Prisma, writeAuditLog } from '@tikflow/db';
import type { CreateZoneInput, UpdateZoneInput, ZoneSummary } from '@tikflow/contracts';

import { withTenantDb } from './db';
import type { AuthenticatedSession } from './session';

export class ZoneError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'SLUG_TAKEN' | 'IN_USE' | 'PARENT_CYCLE',
    message: string,
  ) {
    super(message);
    this.name = 'ZoneError';
  }
}

export async function listZones(session: AuthenticatedSession): Promise<ZoneSummary[]> {
  return withTenantDb(session, async (tx) => {
    const rows = await tx.zone.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        parentId: true,
        createdAt: true,
        parent: { select: { name: true } },
        _count: { select: { subscribers: { where: { deletedAt: null } } } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      parentId: r.parentId,
      parentName: r.parent?.name ?? null,
      subscriberCount: r._count.subscribers,
      createdAt: r.createdAt.toISOString(),
    }));
  });
}

export async function getZone(
  session: AuthenticatedSession,
  zoneId: string,
): Promise<ZoneSummary> {
  return withTenantDb(session, async (tx) => {
    const r = await tx.zone.findFirst({
      where: { id: zoneId, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        parentId: true,
        createdAt: true,
        parent: { select: { name: true } },
        _count: { select: { subscribers: { where: { deletedAt: null } } } },
      },
    });
    if (!r) throw new ZoneError('NOT_FOUND', `zone ${zoneId} not found`);
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      parentId: r.parentId,
      parentName: r.parent?.name ?? null,
      subscriberCount: r._count.subscribers,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

export async function createZone(
  session: AuthenticatedSession,
  input: CreateZoneInput,
  meta: { ip: string | null; userAgent: string | null },
): Promise<ZoneSummary> {
  return withTenantDb(session, async (tx) => {
    if (input.parentId) {
      const parent = await tx.zone.findFirst({
        where: { id: input.parentId, deletedAt: null },
        select: { id: true },
      });
      if (!parent) throw new ZoneError('NOT_FOUND', 'parent zone not found');
    }

    let row;
    try {
      row = await tx.zone.create({
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description,
          parentId: input.parentId,
        },
        select: { id: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ZoneError('SLUG_TAKEN', 'a zone with that slug already exists');
      }
      throw err;
    }

    await writeAuditLog(tx, {
      actorUserId: session.userId,
      action: 'zone.create',
      entityType: 'zone',
      entityId: row.id,
      diff: { after: { name: input.name, slug: input.slug, parentId: input.parentId } },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return await reload(tx, row.id);
  });
}

export async function updateZone(
  session: AuthenticatedSession,
  zoneId: string,
  input: UpdateZoneInput,
  meta: { ip: string | null; userAgent: string | null },
): Promise<ZoneSummary> {
  return withTenantDb(session, async (tx) => {
    const before = await tx.zone.findFirst({
      where: { id: zoneId, deletedAt: null },
      select: { id: true, name: true, slug: true, description: true, parentId: true },
    });
    if (!before) throw new ZoneError('NOT_FOUND', `zone ${zoneId} not found`);

    if (input.parentId === zoneId) {
      throw new ZoneError('PARENT_CYCLE', 'a zone cannot be its own parent');
    }

    if (input.parentId) {
      // Cheap O(depth) cycle check; depths are tiny in practice.
      let cursor: string | null = input.parentId;
      let steps = 0;
      while (cursor && steps < 20) {
        if (cursor === zoneId) {
          throw new ZoneError('PARENT_CYCLE', 'that would create a cycle in the hierarchy');
        }
        const next: { parentId: string | null } | null = await tx.zone.findFirst({
          where: { id: cursor, deletedAt: null },
          select: { parentId: true },
        });
        cursor = next?.parentId ?? null;
        steps++;
      }
    }

    try {
      await tx.zone.update({
        where: { id: zoneId },
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description,
          parentId: input.parentId,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ZoneError('SLUG_TAKEN', 'a zone with that slug already exists');
      }
      throw err;
    }

    await writeAuditLog(tx, {
      actorUserId: session.userId,
      action: 'zone.update',
      entityType: 'zone',
      entityId: zoneId,
      diff: { before, after: input },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return await reload(tx, zoneId);
  });
}

export async function deleteZone(
  session: AuthenticatedSession,
  zoneId: string,
  meta: { ip: string | null; userAgent: string | null },
): Promise<void> {
  await withTenantDb(session, async (tx) => {
    const zone = await tx.zone.findFirst({
      where: { id: zoneId, deletedAt: null },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            subscribers: { where: { deletedAt: null } },
            children: { where: { deletedAt: null } },
          },
        },
      },
    });
    if (!zone) throw new ZoneError('NOT_FOUND', `zone ${zoneId} not found`);
    if (zone._count.subscribers > 0 || zone._count.children > 0) {
      throw new ZoneError(
        'IN_USE',
        'zone is in use — reassign or delete dependants first',
      );
    }

    await tx.zone.update({
      where: { id: zoneId },
      data: { deletedAt: new Date() },
    });

    await writeAuditLog(tx, {
      actorUserId: session.userId,
      action: 'zone.delete',
      entityType: 'zone',
      entityId: zoneId,
      diff: { before: { name: zone.name } },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  });
}

async function reload(
  tx: Prisma.TransactionClient,
  zoneId: string,
): Promise<ZoneSummary> {
  const r = await tx.zone.findFirstOrThrow({
    where: { id: zoneId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      parentId: true,
      createdAt: true,
      parent: { select: { name: true } },
      _count: { select: { subscribers: { where: { deletedAt: null } } } },
    },
  });
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    parentId: r.parentId,
    parentName: r.parent?.name ?? null,
    subscriberCount: r._count.subscribers,
    createdAt: r.createdAt.toISOString(),
  };
}
