import { router } from '../trpc.js';
import { healthRouter } from './health.js';
import { meRouter } from './me.js';

export const appRouter = router({
  health: healthRouter,
  me: meRouter,
});

export type AppRouter = typeof appRouter;
