import 'server-only';

import { Prisma, writeAuditLog } from '@tikflow/db';
import type {
  CreateInventoryItemInput,
  InventoryItemStatus,
  InventoryItemSummary,
  InventoryItemType,
  UpdateInventoryItemInput,
} from '@tikflow/contracts';

import { withTenantDb } from './db';
import type { AuthenticatedSession } from './session';

export class InventoryError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'SERIAL_TAKEN' | 'UNKNOWN_SUBSCRIBER',
    message: string,
  ) {
    super(message);
    this.name = 'InventoryError';
  }
}

type ListOptions = {
  status?: InventoryItemStatus;
  type?: InventoryItemType;
  q?: string;
};

export async function listInventoryItems(
  session: AuthenticatedSession,
  options: ListOptions = {},
): Promise<InventoryItemSummary[]> {
  return withTenantDb(session, async (tx) => {
    const where: Prisma.InventoryItemWhereInput = { deletedAt: null };
    if (options.status) where.status = options.status;
    if (options.type) where.type = options.type;
    if (options.q && options.q.trim().length > 0) {
      const q = options.q.trim();
      where.OR = [
        { serial: { contains: q, mode: 'insensitive' } },
        { mac: { contains: q, mode: 'insensitive' } },
        { vendor: { contains: q, mode: 'insensitive' } },
        { model: { contains: q, mode: 'insensitive' } },
        { location: { contains: q, mode: 'insensitive' } },
      ];
    }

    const rows = await tx.inventoryItem.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
      select: {
        id: true,
        type: true,
        status: true,
        serial: true,
        mac: true,
        vendor: true,
        model: true,
        location: true,
        purchasedAt: true,
        warrantyUntil: true,
        cost: true,
        createdAt: true,
        subscriber: { select: { id: true, code: true, fullName: true } },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      serial: r.serial,
      mac: r.mac,
      vendor: r.vendor,
      model: r.model,
      location: r.location,
      subscriber: r.subscriber
        ? { id: r.subscriber.id, code: r.subscriber.code, fullName: r.subscriber.fullName }
        : null,
      purchasedAt: r.purchasedAt ? r.purchasedAt.toISOString().slice(0, 10) : null,
      warrantyUntil: r.warrantyUntil ? r.warrantyUntil.toISOString().slice(0, 10) : null,
      cost: r.cost === null ? null : Number(r.cost),
      createdAt: r.createdAt.toISOString(),
    }));
  });
}

export async function getInventoryItem(
  session: AuthenticatedSession,
  itemId: string,
): Promise<InventoryItemSummary> {
  return withTenantDb(session, async (tx) => {
    const r = await tx.inventoryItem.findFirst({
      where: { id: itemId, deletedAt: null },
      select: {
        id: true,
        type: true,
        status: true,
        serial: true,
        mac: true,
        vendor: true,
        model: true,
        location: true,
        purchasedAt: true,
        warrantyUntil: true,
        cost: true,
        createdAt: true,
        subscriber: { select: { id: true, code: true, fullName: true } },
      },
    });
    if (!r) throw new InventoryError('NOT_FOUND', `item ${itemId} not found`);
    return {
      id: r.id,
      type: r.type,
      status: r.status,
      serial: r.serial,
      mac: r.mac,
      vendor: r.vendor,
      model: r.model,
      location: r.location,
      subscriber: r.subscriber
        ? { id: r.subscriber.id, code: r.subscriber.code, fullName: r.subscriber.fullName }
        : null,
      purchasedAt: r.purchasedAt ? r.purchasedAt.toISOString().slice(0, 10) : null,
      warrantyUntil: r.warrantyUntil ? r.warrantyUntil.toISOString().slice(0, 10) : null,
      cost: r.cost === null ? null : Number(r.cost),
      createdAt: r.createdAt.toISOString(),
    };
  });
}

export async function createInventoryItem(
  session: AuthenticatedSession,
  input: CreateInventoryItemInput,
  meta: { ip: string | null; userAgent: string | null },
): Promise<InventoryItemSummary> {
  return withTenantDb(session, async (tx) => {
    if (input.subscriberId) {
      const s = await tx.subscriber.findFirst({
        where: { id: input.subscriberId, deletedAt: null },
        select: { id: true },
      });
      if (!s) throw new InventoryError('UNKNOWN_SUBSCRIBER', 'subscriber not found');
    }

    let row;
    try {
      row = await tx.inventoryItem.create({
        data: {
          type: input.type,
          status: input.status,
          serial: input.serial,
          mac: input.mac && input.mac.length > 0 ? input.mac.toUpperCase() : null,
          vendor: input.vendor,
          model: input.model,
          location: input.location,
          subscriberId: input.subscriberId,
          purchasedAt: input.purchasedAt ? new Date(input.purchasedAt) : null,
          warrantyUntil: input.warrantyUntil ? new Date(input.warrantyUntil) : null,
          cost: input.cost === null ? null : new Prisma.Decimal(input.cost),
          notes: input.notes,
          createdBy: session.userId,
        },
        select: { id: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new InventoryError('SERIAL_TAKEN', 'an item with that serial already exists');
      }
      throw err;
    }

    await writeAuditLog(tx, {
      actorUserId: session.userId,
      action: 'inventory.create',
      entityType: 'inventory_item',
      entityId: row.id,
      diff: {
        after: { type: input.type, serial: input.serial, status: input.status },
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return await getInventoryItem(session, row.id);
  });
}

export async function updateInventoryItem(
  session: AuthenticatedSession,
  itemId: string,
  input: UpdateInventoryItemInput,
  meta: { ip: string | null; userAgent: string | null },
): Promise<InventoryItemSummary> {
  return withTenantDb(session, async (tx) => {
    const before = await tx.inventoryItem.findFirst({
      where: { id: itemId, deletedAt: null },
      select: { id: true, serial: true, status: true, subscriberId: true },
    });
    if (!before) throw new InventoryError('NOT_FOUND', `item ${itemId} not found`);

    if (input.subscriberId && input.subscriberId !== before.subscriberId) {
      const s = await tx.subscriber.findFirst({
        where: { id: input.subscriberId, deletedAt: null },
        select: { id: true },
      });
      if (!s) throw new InventoryError('UNKNOWN_SUBSCRIBER', 'subscriber not found');
    }

    try {
      await tx.inventoryItem.update({
        where: { id: itemId },
        data: {
          type: input.type,
          status: input.status,
          serial: input.serial,
          mac: input.mac && input.mac.length > 0 ? input.mac.toUpperCase() : null,
          vendor: input.vendor,
          model: input.model,
          location: input.location,
          subscriberId: input.subscriberId,
          purchasedAt: input.purchasedAt ? new Date(input.purchasedAt) : null,
          warrantyUntil: input.warrantyUntil ? new Date(input.warrantyUntil) : null,
          cost: input.cost === null ? null : new Prisma.Decimal(input.cost),
          notes: input.notes,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new InventoryError('SERIAL_TAKEN', 'an item with that serial already exists');
      }
      throw err;
    }

    await writeAuditLog(tx, {
      actorUserId: session.userId,
      action: 'inventory.update',
      entityType: 'inventory_item',
      entityId: itemId,
      diff: {
        before: { serial: before.serial, status: before.status },
        after: { serial: input.serial, status: input.status },
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return await getInventoryItem(session, itemId);
  });
}

export async function deleteInventoryItem(
  session: AuthenticatedSession,
  itemId: string,
  meta: { ip: string | null; userAgent: string | null },
): Promise<void> {
  await withTenantDb(session, async (tx) => {
    const item = await tx.inventoryItem.findFirst({
      where: { id: itemId, deletedAt: null },
      select: { id: true, serial: true, type: true },
    });
    if (!item) throw new InventoryError('NOT_FOUND', `item ${itemId} not found`);

    await tx.inventoryItem.update({
      where: { id: itemId },
      data: { deletedAt: new Date() },
    });

    await writeAuditLog(tx, {
      actorUserId: session.userId,
      action: 'inventory.delete',
      entityType: 'inventory_item',
      entityId: itemId,
      diff: { before: { serial: item.serial, type: item.type } },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  });
}
