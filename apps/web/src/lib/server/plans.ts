import 'server-only';

import { Prisma, writeAuditLog } from '@tikflow/db';
import type {
  CreateServicePlanInput,
  ServicePlanDetail,
  ServicePlanSummary,
  UpdateServicePlanInput,
} from '@tikflow/contracts';

import { withTenantDb } from './db';
import type { AuthenticatedSession } from './session';

export class ServicePlanError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'CODE_TAKEN' | 'IN_USE',
    message: string,
  ) {
    super(message);
    this.name = 'ServicePlanError';
  }
}

export async function listServicePlans(
  session: AuthenticatedSession,
): Promise<ServicePlanSummary[]> {
  return withTenantDb(session, async (tx) => {
    const rows = await tx.servicePlan.findMany({
      where: { deletedAt: null },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        type: true,
        uploadKbps: true,
        downloadKbps: true,
        price: true,
        vatPct: true,
        validityDays: true,
        isActive: true,
        createdAt: true,
        _count: { select: { subscriptions: { where: { deletedAt: null } } } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      description: r.description,
      type: r.type,
      uploadKbps: r.uploadKbps,
      downloadKbps: r.downloadKbps,
      price: Number(r.price),
      vatPct: Number(r.vatPct),
      validityDays: r.validityDays,
      isActive: r.isActive,
      subscriberCount: r._count.subscriptions,
      createdAt: r.createdAt.toISOString(),
    }));
  });
}

export async function getServicePlan(
  session: AuthenticatedSession,
  planId: string,
): Promise<ServicePlanDetail> {
  return withTenantDb(session, async (tx) => {
    const r = await tx.servicePlan.findFirst({
      where: { id: planId, deletedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        type: true,
        uploadKbps: true,
        downloadKbps: true,
        burstUploadKbps: true,
        burstDownloadKbps: true,
        price: true,
        vatPct: true,
        validityDays: true,
        fupLimitGb: true,
        fupThrottleKbps: true,
        mikrotikProfile: true,
        isActive: true,
        createdAt: true,
        _count: { select: { subscriptions: { where: { deletedAt: null } } } },
      },
    });
    if (!r) throw new ServicePlanError('NOT_FOUND', `plan ${planId} not found`);
    return {
      id: r.id,
      name: r.name,
      code: r.code,
      description: r.description,
      type: r.type,
      uploadKbps: r.uploadKbps,
      downloadKbps: r.downloadKbps,
      burstUploadKbps: r.burstUploadKbps,
      burstDownloadKbps: r.burstDownloadKbps,
      price: Number(r.price),
      vatPct: Number(r.vatPct),
      validityDays: r.validityDays,
      fupLimitGb: r.fupLimitGb,
      fupThrottleKbps: r.fupThrottleKbps,
      mikrotikProfile: r.mikrotikProfile,
      isActive: r.isActive,
      subscriberCount: r._count.subscriptions,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

export async function createServicePlan(
  session: AuthenticatedSession,
  input: CreateServicePlanInput,
  meta: { ip: string | null; userAgent: string | null },
): Promise<ServicePlanSummary> {
  return withTenantDb(session, async (tx) => {
    let row;
    try {
      row = await tx.servicePlan.create({
        data: {
          name: input.name,
          code: input.code,
          description: input.description,
          type: input.type,
          uploadKbps: input.uploadKbps,
          downloadKbps: input.downloadKbps,
          burstUploadKbps: input.burstUploadKbps,
          burstDownloadKbps: input.burstDownloadKbps,
          validityDays: input.validityDays,
          price: new Prisma.Decimal(input.price),
          vatPct: new Prisma.Decimal(input.vatPct),
          fupLimitGb: input.fupLimitGb,
          fupThrottleKbps: input.fupThrottleKbps,
          mikrotikProfile: input.mikrotikProfile,
          isActive: input.isActive,
        },
        select: { id: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ServicePlanError('CODE_TAKEN', 'a plan with that code already exists');
      }
      throw err;
    }

    await writeAuditLog(tx, {
      actorUserId: session.userId,
      action: 'plan.create',
      entityType: 'service_plan',
      entityId: row.id,
      diff: { after: { name: input.name, code: input.code, price: input.price } },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return await listOne(tx, row.id);
  });
}

export async function updateServicePlan(
  session: AuthenticatedSession,
  planId: string,
  input: UpdateServicePlanInput,
  meta: { ip: string | null; userAgent: string | null },
): Promise<ServicePlanSummary> {
  return withTenantDb(session, async (tx) => {
    const before = await tx.servicePlan.findFirst({
      where: { id: planId, deletedAt: null },
      select: { id: true, name: true, code: true, price: true, isActive: true },
    });
    if (!before) throw new ServicePlanError('NOT_FOUND', `plan ${planId} not found`);

    try {
      await tx.servicePlan.update({
        where: { id: planId },
        data: {
          name: input.name,
          code: input.code,
          description: input.description,
          type: input.type,
          uploadKbps: input.uploadKbps,
          downloadKbps: input.downloadKbps,
          burstUploadKbps: input.burstUploadKbps,
          burstDownloadKbps: input.burstDownloadKbps,
          validityDays: input.validityDays,
          price: new Prisma.Decimal(input.price),
          vatPct: new Prisma.Decimal(input.vatPct),
          fupLimitGb: input.fupLimitGb,
          fupThrottleKbps: input.fupThrottleKbps,
          mikrotikProfile: input.mikrotikProfile,
          isActive: input.isActive,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ServicePlanError('CODE_TAKEN', 'a plan with that code already exists');
      }
      throw err;
    }

    await writeAuditLog(tx, {
      actorUserId: session.userId,
      action: 'plan.update',
      entityType: 'service_plan',
      entityId: planId,
      diff: {
        before: { name: before.name, code: before.code, price: Number(before.price) },
        after: { name: input.name, code: input.code, price: input.price },
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return await listOne(tx, planId);
  });
}

export async function archiveServicePlan(
  session: AuthenticatedSession,
  planId: string,
  meta: { ip: string | null; userAgent: string | null },
): Promise<void> {
  await withTenantDb(session, async (tx) => {
    const plan = await tx.servicePlan.findFirst({
      where: { id: planId, deletedAt: null },
      select: {
        id: true,
        name: true,
        _count: { select: { subscriptions: { where: { deletedAt: null } } } },
      },
    });
    if (!plan) throw new ServicePlanError('NOT_FOUND', `plan ${planId} not found`);
    if (plan._count.subscriptions > 0) {
      throw new ServicePlanError(
        'IN_USE',
        'plan has active subscriptions — set inactive instead of archiving',
      );
    }

    await tx.servicePlan.update({
      where: { id: planId },
      data: { deletedAt: new Date(), isActive: false },
    });

    await writeAuditLog(tx, {
      actorUserId: session.userId,
      action: 'plan.archive',
      entityType: 'service_plan',
      entityId: planId,
      diff: { before: { name: plan.name } },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  });
}

async function listOne(
  tx: Prisma.TransactionClient,
  planId: string,
): Promise<ServicePlanSummary> {
  const r = await tx.servicePlan.findFirstOrThrow({
    where: { id: planId },
    select: {
      id: true,
      name: true,
      code: true,
      description: true,
      type: true,
      uploadKbps: true,
      downloadKbps: true,
      price: true,
      vatPct: true,
      validityDays: true,
      isActive: true,
      createdAt: true,
      _count: { select: { subscriptions: { where: { deletedAt: null } } } },
    },
  });
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    description: r.description,
    type: r.type,
    uploadKbps: r.uploadKbps,
    downloadKbps: r.downloadKbps,
    price: Number(r.price),
    vatPct: Number(r.vatPct),
    validityDays: r.validityDays,
    isActive: r.isActive,
    subscriberCount: r._count.subscriptions,
    createdAt: r.createdAt.toISOString(),
  };
}
