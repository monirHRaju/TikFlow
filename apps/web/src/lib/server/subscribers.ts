import 'server-only';

import { Prisma, writeAuditLog } from '@tikflow/db';
import type {
  CreateSubscriberInput,
  SubscriberDetail,
  SubscriberStatus,
  SubscriberSummary,
  UpdateSubscriberInput,
} from '@tikflow/contracts';

import { withTenantDb } from './db';
import type { AuthenticatedSession } from './session';

export class SubscriberError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'CODE_TAKEN' | 'UNKNOWN_ZONE' | 'UNKNOWN_PLAN',
    message: string,
  ) {
    super(message);
    this.name = 'SubscriberError';
  }
}

type ListOptions = {
  status?: SubscriberStatus;
  zoneId?: string;
  /** Free-text search across code, full_name, full_name_bn, phone. */
  q?: string;
};

export async function listSubscribers(
  session: AuthenticatedSession,
  options: ListOptions = {},
): Promise<SubscriberSummary[]> {
  return withTenantDb(session, async (tx) => {
    const where: Prisma.SubscriberWhereInput = { deletedAt: null };
    if (options.status) where.status = options.status;
    if (options.zoneId) where.zoneId = options.zoneId;
    if (options.q && options.q.trim().length > 0) {
      const q = options.q.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { fullName: { contains: q, mode: 'insensitive' } },
        { fullNameBn: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { altPhone: { contains: q } },
      ];
    }

    const rows = await tx.subscriber.findMany({
      where,
      orderBy: [{ status: 'asc' }, { fullName: 'asc' }],
      take: 200,
      select: {
        id: true,
        code: true,
        fullName: true,
        phone: true,
        email: true,
        status: true,
        connectionType: true,
        installationDate: true,
        createdAt: true,
        zone: { select: { id: true, name: true } },
        subscriptions: {
          where: { deletedAt: null, status: { in: ['active', 'pending', 'suspended'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { plan: { select: { id: true, name: true, price: true } } },
        },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      fullName: r.fullName,
      phone: r.phone,
      email: r.email,
      status: r.status,
      connectionType: r.connectionType,
      zone: r.zone ? { id: r.zone.id, name: r.zone.name } : null,
      currentPlan: r.subscriptions[0]?.plan
        ? {
            id: r.subscriptions[0].plan.id,
            name: r.subscriptions[0].plan.name,
            price: Number(r.subscriptions[0].plan.price),
          }
        : null,
      installationDate: r.installationDate
        ? r.installationDate.toISOString().slice(0, 10)
        : null,
      createdAt: r.createdAt.toISOString(),
    }));
  });
}

export async function getSubscriber(
  session: AuthenticatedSession,
  subscriberId: string,
): Promise<SubscriberDetail> {
  return withTenantDb(session, async (tx) => {
    const r = await tx.subscriber.findFirst({
      where: { id: subscriberId, deletedAt: null },
      select: {
        id: true,
        code: true,
        fullName: true,
        fatherName: true,
        nidNumber: true,
        phone: true,
        altPhone: true,
        email: true,
        address: true,
        status: true,
        connectionType: true,
        installationDate: true,
        notes: true,
        createdAt: true,
        zone: { select: { id: true, name: true } },
        subscriptions: {
          where: { deletedAt: null, status: { in: ['active', 'pending', 'suspended'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { plan: { select: { id: true, name: true, price: true } } },
        },
      },
    });
    if (!r) throw new SubscriberError('NOT_FOUND', `subscriber ${subscriberId} not found`);
    return {
      id: r.id,
      code: r.code,
      fullName: r.fullName,
      fatherName: r.fatherName,
      nidNumber: r.nidNumber,
      phone: r.phone,
      altPhone: r.altPhone,
      email: r.email,
      address: r.address,
      status: r.status,
      connectionType: r.connectionType,
      zone: r.zone ? { id: r.zone.id, name: r.zone.name } : null,
      currentPlan: r.subscriptions[0]?.plan
        ? {
            id: r.subscriptions[0].plan.id,
            name: r.subscriptions[0].plan.name,
            price: Number(r.subscriptions[0].plan.price),
          }
        : null,
      installationDate: r.installationDate
        ? r.installationDate.toISOString().slice(0, 10)
        : null,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

export async function createSubscriber(
  session: AuthenticatedSession,
  input: CreateSubscriberInput,
  meta: { ip: string | null; userAgent: string | null },
): Promise<SubscriberSummary> {
  return withTenantDb(session, async (tx) => {
    if (input.zoneId) {
      const z = await tx.zone.findFirst({
        where: { id: input.zoneId, deletedAt: null },
        select: { id: true },
      });
      if (!z) throw new SubscriberError('UNKNOWN_ZONE', 'selected zone not found');
    }
    if (input.planId) {
      const p = await tx.servicePlan.findFirst({
        where: { id: input.planId, deletedAt: null },
        select: { id: true },
      });
      if (!p) throw new SubscriberError('UNKNOWN_PLAN', 'selected plan not found');
    }

    let row;
    try {
      row = await tx.subscriber.create({
        data: {
          code: input.code,
          fullName: input.fullName,
          fatherName: input.fatherName,
          nidNumber: input.nidNumber,
          phone: input.phone,
          altPhone: input.altPhone,
          email: input.email,
          address: input.address,
          zoneId: input.zoneId,
          installationDate: input.installationDate ? new Date(input.installationDate) : null,
          connectionType: input.connectionType,
          notes: input.notes,
          createdBy: session.userId,
        },
        select: { id: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new SubscriberError('CODE_TAKEN', 'a subscriber with that code already exists');
      }
      throw err;
    }

    if (input.planId) {
      await tx.subscription.create({
        data: {
          subscriberId: row.id,
          planId: input.planId,
          status: 'pending',
        },
      });
    }

    await writeAuditLog(tx, {
      actorUserId: session.userId,
      action: 'subscriber.create',
      entityType: 'subscriber',
      entityId: row.id,
      diff: {
        after: {
          code: input.code,
          fullName: input.fullName,
          phone: input.phone,
          planId: input.planId,
        },
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return await listOne(tx, row.id);
  });
}

export async function updateSubscriber(
  session: AuthenticatedSession,
  subscriberId: string,
  input: UpdateSubscriberInput,
  meta: { ip: string | null; userAgent: string | null },
): Promise<SubscriberSummary> {
  return withTenantDb(session, async (tx) => {
    const before = await tx.subscriber.findFirst({
      where: { id: subscriberId, deletedAt: null },
      select: {
        id: true,
        code: true,
        fullName: true,
        phone: true,
        status: true,
        zoneId: true,
        subscriptions: {
          where: { deletedAt: null, status: { in: ['pending', 'active', 'suspended'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, planId: true },
        },
      },
    });
    if (!before) throw new SubscriberError('NOT_FOUND', `subscriber ${subscriberId} not found`);

    if (input.zoneId && input.zoneId !== before.zoneId) {
      const z = await tx.zone.findFirst({
        where: { id: input.zoneId, deletedAt: null },
        select: { id: true },
      });
      if (!z) throw new SubscriberError('UNKNOWN_ZONE', 'selected zone not found');
    }
    if (input.planId) {
      const p = await tx.servicePlan.findFirst({
        where: { id: input.planId, deletedAt: null },
        select: { id: true },
      });
      if (!p) throw new SubscriberError('UNKNOWN_PLAN', 'selected plan not found');
    }

    try {
      await tx.subscriber.update({
        where: { id: subscriberId },
        data: {
          code: input.code,
          fullName: input.fullName,
          fatherName: input.fatherName,
          nidNumber: input.nidNumber,
          phone: input.phone,
          altPhone: input.altPhone,
          email: input.email,
          address: input.address,
          zoneId: input.zoneId,
          installationDate: input.installationDate ? new Date(input.installationDate) : null,
          connectionType: input.connectionType,
          status: input.status,
          notes: input.notes,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new SubscriberError('CODE_TAKEN', 'a subscriber with that code already exists');
      }
      throw err;
    }

    // Sync the active subscription's plan if the admin picked a new one.
    const currentSubscription = before.subscriptions[0];
    if (input.planId) {
      if (!currentSubscription) {
        await tx.subscription.create({
          data: {
            subscriberId,
            planId: input.planId,
            status: 'pending',
          },
        });
      } else if (currentSubscription.planId !== input.planId) {
        await tx.subscription.update({
          where: { id: currentSubscription.id },
          data: { planId: input.planId },
        });
      }
    }

    await writeAuditLog(tx, {
      actorUserId: session.userId,
      action: 'subscriber.update',
      entityType: 'subscriber',
      entityId: subscriberId,
      diff: {
        before: {
          code: before.code,
          fullName: before.fullName,
          phone: before.phone,
          status: before.status,
        },
        after: {
          code: input.code,
          fullName: input.fullName,
          phone: input.phone,
          status: input.status,
          planId: input.planId,
        },
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return await listOne(tx, subscriberId);
  });
}

export async function deleteSubscriber(
  session: AuthenticatedSession,
  subscriberId: string,
  meta: { ip: string | null; userAgent: string | null },
): Promise<void> {
  await withTenantDb(session, async (tx) => {
    const sub = await tx.subscriber.findFirst({
      where: { id: subscriberId, deletedAt: null },
      select: { id: true, code: true, fullName: true },
    });
    if (!sub) throw new SubscriberError('NOT_FOUND', `subscriber ${subscriberId} not found`);

    await tx.subscriber.update({
      where: { id: subscriberId },
      data: { deletedAt: new Date(), status: 'cancelled' },
    });
    await tx.subscription.updateMany({
      where: { subscriberId, deletedAt: null },
      data: { deletedAt: new Date(), status: 'cancelled' },
    });

    await writeAuditLog(tx, {
      actorUserId: session.userId,
      action: 'subscriber.delete',
      entityType: 'subscriber',
      entityId: subscriberId,
      diff: { before: { code: sub.code, fullName: sub.fullName } },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  });
}

async function listOne(
  tx: Prisma.TransactionClient,
  subscriberId: string,
): Promise<SubscriberSummary> {
  const r = await tx.subscriber.findFirstOrThrow({
    where: { id: subscriberId },
    select: {
      id: true,
      code: true,
      fullName: true,
      phone: true,
      email: true,
      status: true,
      connectionType: true,
      installationDate: true,
      createdAt: true,
      zone: { select: { id: true, name: true } },
      subscriptions: {
        where: { deletedAt: null, status: { in: ['active', 'pending', 'suspended'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { plan: { select: { id: true, name: true, price: true } } },
      },
    },
  });
  return {
    id: r.id,
    code: r.code,
    fullName: r.fullName,
    phone: r.phone,
    email: r.email,
    status: r.status,
    connectionType: r.connectionType,
    zone: r.zone ? { id: r.zone.id, name: r.zone.name } : null,
    currentPlan: r.subscriptions[0]?.plan
      ? {
          id: r.subscriptions[0].plan.id,
          name: r.subscriptions[0].plan.name,
          price: Number(r.subscriptions[0].plan.price),
        }
      : null,
    installationDate: r.installationDate
      ? r.installationDate.toISOString().slice(0, 10)
      : null,
    createdAt: r.createdAt.toISOString(),
  };
}
