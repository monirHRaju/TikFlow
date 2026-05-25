import 'server-only';

import { generateApiKey } from '@tikflow/auth';
import { Prisma, writeAuditLog } from '@tikflow/db';
import type { ApiKeySummary, CreateApiKeyInput, CreatedApiKey } from '@tikflow/contracts';

import { withTenantDb } from './db';
import type { AuthenticatedSession } from './session';

export class ApiKeyError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'HASH_COLLISION',
    message: string,
  ) {
    super(message);
    this.name = 'ApiKeyError';
  }
}

export async function listApiKeys(session: AuthenticatedSession): Promise<ApiKeySummary[]> {
  return withTenantDb(session, async (tx) => {
    const rows = await tx.apiKey.findMany({
      where: { deletedAt: null },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        label: true,
        prefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      prefix: r.prefix,
      scopes: r.scopes,
      lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
      expiresAt: r.expiresAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  });
}

/**
 * Issue a new API key. The plaintext returned here is the only time it
 * will ever leave the server in clear; the database persists only the
 * argon-of-randomness hash and a 12-character public prefix.
 */
export async function createApiKey(
  session: AuthenticatedSession,
  input: CreateApiKeyInput,
  meta: { ip: string | null; userAgent: string | null },
): Promise<CreatedApiKey> {
  const generated = generateApiKey();

  return withTenantDb(session, async (tx) => {
    let row;
    try {
      row = await tx.apiKey.create({
        data: {
          label: input.label,
          prefix: generated.prefix,
          hashedKey: generated.hashedKey,
          scopes: input.scopes,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          createdBy: session.userId,
        },
        select: {
          id: true,
          label: true,
          prefix: true,
          scopes: true,
          lastUsedAt: true,
          expiresAt: true,
          createdAt: true,
        },
      });
    } catch (err) {
      // The `hashed_key` column is UNIQUE — a hash collision would mean
      // we hit a 1-in-2^256 event, but surface a clean error anyway.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ApiKeyError('HASH_COLLISION', 'API key collision — please retry');
      }
      throw err;
    }

    await writeAuditLog(tx, {
      actorUserId: session.userId,
      action: 'tenant.apikey.create',
      entityType: 'api_key',
      entityId: row.id,
      diff: {
        after: {
          label: row.label,
          prefix: row.prefix,
          scopes: row.scopes,
          expiresAt: row.expiresAt?.toISOString() ?? null,
        },
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      id: row.id,
      label: row.label,
      prefix: row.prefix,
      scopes: row.scopes,
      lastUsedAt: null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      plaintext: generated.plaintext,
    };
  });
}

/**
 * Soft-delete an API key. Revoked keys are kept for audit traceability
 * (you can still see when they were used) but reject every subsequent
 * verification attempt because the API authenticator filters them out
 * with `WHERE deleted_at IS NULL`.
 */
export async function revokeApiKey(
  session: AuthenticatedSession,
  apiKeyId: string,
  meta: { ip: string | null; userAgent: string | null },
): Promise<void> {
  await withTenantDb(session, async (tx) => {
    const existing = await tx.apiKey.findFirst({
      where: { id: apiKeyId, deletedAt: null },
      select: { id: true, label: true, prefix: true, scopes: true },
    });
    if (!existing) {
      throw new ApiKeyError('NOT_FOUND', `api key ${apiKeyId} not found`);
    }

    await tx.apiKey.update({
      where: { id: apiKeyId },
      data: { deletedAt: new Date() },
    });

    await writeAuditLog(tx, {
      actorUserId: session.userId,
      action: 'tenant.apikey.revoke',
      entityType: 'api_key',
      entityId: existing.id,
      diff: {
        before: {
          label: existing.label,
          prefix: existing.prefix,
          scopes: existing.scopes,
        },
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  });
}
