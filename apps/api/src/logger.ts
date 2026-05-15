import { pino } from 'pino';

import { env } from './env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  // Anything that smells like a credential, token, or PII never hits the log
  // stream — extend the list, don't bypass it (see CLAUDE.md §6).
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["set-cookie"]',
      'req.headers["x-csrf-token"]',
      'req.headers["x-api-key"]',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.refreshToken',
      '*.accessToken',
      '*.mfaSecret',
      '*.nid',
      '*.nidNumber',
      '*.pppoeSecret',
      '*.pppoePassword',
      '*.snmpCommunity',
      'body.password',
      'body.token',
    ],
    censor: '[REDACTED]',
  },
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', singleLine: false },
        }
      : undefined,
});
