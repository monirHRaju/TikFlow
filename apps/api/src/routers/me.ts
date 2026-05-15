import { router, tenantProcedure } from '../trpc.js';

export const meRouter = router({
  whoami: tenantProcedure.query(({ ctx }) => ({
    tenantId: ctx.tenantId,
    userId: ctx.userId ?? null,
    requestId: ctx.requestId,
  })),
});
