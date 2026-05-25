import 'server-only';

import type { Prisma } from '@tikflow/db';
import { writeAuditLog } from '@tikflow/db';

import { withTenantDb } from './db';
import type { AuthenticatedSession } from './session';

/**
 * The ordered list of onboarding steps. Adding a step is a matter of:
 *   1. appending its slug here
 *   2. creating the corresponding page under app/[locale]/onboarding/
 *   3. wiring the back/next links in `<StepNav>`
 */
export const ONBOARDING_STEPS = ['welcome', 'general', 'branding', 'team', 'done'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function isOnboardingStep(value: unknown): value is OnboardingStep {
  return typeof value === 'string' && (ONBOARDING_STEPS as readonly string[]).includes(value);
}

export function nextStep(current: OnboardingStep): OnboardingStep | null {
  const idx = ONBOARDING_STEPS.indexOf(current);
  if (idx < 0 || idx >= ONBOARDING_STEPS.length - 1) return null;
  return ONBOARDING_STEPS[idx + 1] ?? null;
}

export function previousStep(current: OnboardingStep): OnboardingStep | null {
  const idx = ONBOARDING_STEPS.indexOf(current);
  if (idx <= 0) return null;
  return ONBOARDING_STEPS[idx - 1] ?? null;
}

export type OnboardingState = {
  completedAt: string | null;
};

const COMPLETED_KEY = 'onboardingCompletedAt';

/**
 * Read the onboarding status for the current tenant. Stored inside the
 * existing `tenants.settings` JSON document so no migration is needed.
 */
export async function getOnboardingState(
  session: AuthenticatedSession,
): Promise<OnboardingState> {
  const row = await withTenantDb(session, async (tx) => {
    return tx.tenant.findFirstOrThrow({
      where: { id: session.tenantId },
      select: { settings: true },
    });
  });
  return parseState(row.settings);
}

/**
 * Mark onboarding finished for the current tenant. Merges into the
 * existing `settings` JSON instead of overwriting it so other keys live
 * on. Writes a single audit log entry; idempotent — calling twice with
 * onboarding already complete is a no-op (no second audit row).
 */
export async function completeOnboarding(
  session: AuthenticatedSession,
  meta: { ip: string | null; userAgent: string | null },
): Promise<void> {
  await withTenantDb(session, async (tx) => {
    const row = await tx.tenant.findFirstOrThrow({
      where: { id: session.tenantId },
      select: { settings: true },
    });
    const before = parseState(row.settings);
    if (before.completedAt !== null) return;

    const merged = mergeSettings(row.settings, { [COMPLETED_KEY]: new Date().toISOString() });
    await tx.tenant.update({
      where: { id: session.tenantId },
      data: { settings: merged },
    });

    await writeAuditLog(tx, {
      actorUserId: session.userId,
      action: 'tenant.onboarding.complete',
      entityType: 'tenant',
      entityId: session.tenantId,
      diff: { after: { onboardingCompletedAt: parseState(merged).completedAt } },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  });
}

function parseState(settings: unknown): OnboardingState {
  if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
    const v = (settings as Record<string, unknown>)[COMPLETED_KEY];
    if (typeof v === 'string') return { completedAt: v };
  }
  return { completedAt: null };
}

function mergeSettings(
  existing: unknown,
  patch: Record<string, unknown>,
): Prisma.InputJsonValue {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, ...patch } as Prisma.InputJsonValue;
}
