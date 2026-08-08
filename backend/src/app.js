import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import prisma from './prismaClient.js';
import authController from './controllers/auth.controller.js';
import getPublicConfigController from './controllers/getPublicConfigController.js';
import { configureSecurity } from './middleware/security.js';
import { globalApiLimiter } from './middleware/rateLimiters.js';
import configRoutes from './routes/configRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import sponsorshipRoutes from './routes/sponsorshipRoutes.js';
import mediaRoutes from './routes/mediaRoutes.js';
import faqRoutes from './routes/faqRoutes.js';
import executiveRoutes from './routes/executiveRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import { handleStripeWebhook } from './controllers/paymentController.js';
import { setUploadStaticHeaders, UPLOADS_DIR } from './controllers/uploadController.js';
import logger from './utils/logger.js';
import {
  getConfiguredCspConnectSrcValues,
  getConfiguredCspImageSrcValues,
  getConfiguredCspScriptSrcValues,
  getConfiguredCspFrameSrcValues,
} from '../../shared/securityHeaders.mjs';

function getAllowedCorsOrigins() {
  const rawCorsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const ignoredCorsOrigins = rawCorsOrigins.filter((origin) => origin === '*' || origin.toLowerCase() === 'null');
  const allowedCorsOrigins = rawCorsOrigins.filter((origin) => origin !== '*' && origin.toLowerCase() !== 'null');

  if (ignoredCorsOrigins.length > 0) {
    logger.warn({ origins: ignoredCorsOrigins }, 'Ignoring unsafe CORS origins');
  }

  return new Set(allowedCorsOrigins);
}

function createHelmetMiddleware() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", ...getConfiguredCspScriptSrcValues()],
        styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
        imgSrc: getConfiguredCspImageSrcValues(process.env),
        fontSrc: ["'self'", 'data:', 'https:'],
        connectSrc: getConfiguredCspConnectSrcValues({
          env: process.env,
          allowWebSockets: process.env.NODE_ENV !== 'production',
        }),
        frameSrc: getConfiguredCspFrameSrcValues(),
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    strictTransportSecurity: false,
    xFrameOptions: {
      action: 'deny',
    },
  });
}

function createCorsMiddleware() {
  const allowedCorsOriginSet = getAllowedCorsOrigins();

  return cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, false);
      }

      if (origin === 'null' || !allowedCorsOriginSet.has(origin)) {
        const error = new Error('Not allowed by CORS');
        error.status = 403;
        return callback(error);
      }

      return callback(null, origin);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });
}

// Structured HTTP request logging. Bodies are never logged; sensitive headers
// (Authorization, Cookie) are redacted via the shared logger's redact rules.
// Health/readiness probes are skipped to keep logs signal-rich.
const HEALTH_PROBE_PATHS = new Set(['/healthz', '/api/health', '/readyz']);

function createHttpLogger() {
  return pinoHttp({
    logger,
    autoLogging: {
      // req.url can carry a query string (e.g. /healthz?full=1); compare the
      // pathname only so probes are still skipped when params are present.
      ignore: (req) => HEALTH_PROBE_PATHS.has((req.url || '').split('?')[0]),
    },
  });
}

function handleCorsErrors(error, _req, res, next) {
  if (error.message === 'Not allowed by CORS') {
    return res.status(error.status || 403).json({ error: 'Not allowed by CORS' });
  }

  return next(error);
}

export function createApp() {
  const app = express();

  configureSecurity(app);
  app.use(createHelmetMiddleware());
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
  app.use(createCorsMiddleware());
  app.use(createHttpLogger());

  // Stripe webhook must see the raw body to verify the signature, so it is
  // registered before the JSON body parser.
  app.post(
    '/api/payments/webhook',
    express.raw({ type: 'application/json' }),
    handleStripeWebhook,
  );

  app.use(express.json());

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/readyz', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return res.json({ status: 'ok' });
    } catch (error) {
      logger.error({ err: error }, 'Readiness check failed');
      return res.status(503).json({ status: 'unavailable' });
    }
  });

  app.use('/api', globalApiLimiter);

  app.use('/api/auth', authController);

  app.use('/uploads', express.static(UPLOADS_DIR, {
    dotfiles: 'deny',
    index: false,
    immutable: true,
    maxAge: '1y',
    setHeaders: setUploadStaticHeaders,
  }));

  app.get('/api/test', (_req, res) => {
    res.json({
      message: 'Backend is running!',
      timestamp: new Date().toISOString(),
      port: process.env.PORT || 3001,
      environment: process.env.NODE_ENV || 'development',
    });
  });

  app.use('/api/config', configRoutes);
  app.get('/api/public-config', getPublicConfigController);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/activities', activityRoutes);
  app.use('/api', sponsorshipRoutes);
  app.use('/api', faqRoutes);
  app.use('/api', executiveRoutes);
  app.use('/api', mediaRoutes);
  app.use('/api', paymentRoutes);

  app.use(handleCorsErrors);

  return app;
}

export default createApp;