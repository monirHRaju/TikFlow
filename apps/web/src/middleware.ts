import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing.js';

export default createMiddleware(routing);

export const config = {
  // Match everything except Next internals, static files, and the future API proxy.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
