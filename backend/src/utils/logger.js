import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: undefined,
  redact: {
    paths: [
      'req.headers.authorization',
      'authorization',
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'DATABASE_URL',
      'SENTRY_DSN',
      'VITE_SENTRY_DSN',
    ],
    censor: '[redacted]',
  },
});

export default logger;