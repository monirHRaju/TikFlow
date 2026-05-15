import { initTRPC, TRPCError } from '@trpc/server';
import { type CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { ZodError } from 'zod';

export type Context = {
  tenantId: string | undefined;
  userId: string | undefined;
  requestId: string;
};

export function createContext({ req }: CreateExpressContextOptions): Context {
  return {
    tenantId: req.tenantId,
    userId: req.userId,
    requestId: req.id,
  };
}

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure;

/**
 * Procedure that requires a resolved tenant context. PR-0.5 will swap the
 * resolver from header-stub to JWT-verified.
 */
export const tenantProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.tenantId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Tenant context required' });
  }
  return next({ ctx: { ...ctx, tenantId: ctx.tenantId } });
});
