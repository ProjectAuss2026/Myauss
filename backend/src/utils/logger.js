import pino from 'pino';

// Centralized redaction rules (KAN-99 / KAN-128).
// Anything matching one of these paths is replaced with the censor value before
// it is written to a log, so secrets and sensitive auth data never reach a log
// drain, terminal, screenshot, or CI output.
//
// Paths cover the explicit request shapes used by pino-http (req.headers.*,
// req.body.*) plus single-level wildcards for arbitrary objects we log
// directly. Bare top-level keys are also redacted so `logger.info({ token })`
// is safe.
const REDACT_PATHS = [
  // Request-scoped (pino-http serializers)
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.execCode',
  'req.body.code',
  // Wildcards — one level deep into any logged object (e.g. logged under a
  // wrapper object rather than under req.*). Note: we deliberately do NOT add
  // '*.code', because that would also redact diagnostic fields like err.code
  // (Prisma 'P2025', Node 'ECONNREFUSED') that we log via { err } and want to
  // keep. Verification codes are covered by req.body.code + top-level 'code'.
  '*.authorization',
  '*.cookie',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.execCode',
  '*.JWT_SECRET',
  '*.SMTP_PASS',
  '*.DATABASE_URL',
  '*.SENTRY_DSN',
  // Top-level keys
  'authorization',
  'cookie',
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'code',
  'execCode',
  'JWT_SECRET',
  'SMTP_PASS',
  'DATABASE_URL',
  'SENTRY_DSN',
  'VITE_SENTRY_DSN',
];

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: undefined,
  redact: {
    paths: REDACT_PATHS,
    censor: '[redacted]',
  },
});

export default logger;
