import './env.js';
import * as Sentry from '@sentry/node';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import prisma from './prismaClient.js';
import authController from './controllers/auth.controller.js';
import getPublicConfigController from './controllers/getPublicConfigController.js';
import { authenticate } from './middleware/authMiddleware.js';
import { globalApiLimiter, uploadUserLimiter } from './middleware/rateLimiters.js';
import logger from './utils/logger.js';
import './jobs/cleanupUnverified.js';
import configRoutes from './routes/configRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import sponsorshipRoutes from './routes/sponsorshipRoutes.js';
import mediaRoutes from './routes/mediaRoutes.js';
import faqRoutes from './routes/faqRoutes.js';
import executiveRoutes from './routes/executiveRoutes.js';
import { setUploadStaticHeaders, UPLOADS_DIR } from './controllers/uploadController.js';
import {
  getConfiguredCspConnectSrcValues,
  getConfiguredCspImageSrcValues,
} from '../../shared/securityHeaders.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sentryDsn = process.env.SENTRY_DSN;
const sentryEnabled = Boolean(sentryDsn);

function getSentryTracesSampleRate() {
  const rawSampleRate = process.env.SENTRY_TRACES_SAMPLE_RATE;

  if (rawSampleRate === undefined || rawSampleRate === '') {
    return 0;
  }

  const sampleRate = Number(rawSampleRate);

  if (!Number.isFinite(sampleRate) || sampleRate < 0 || sampleRate > 1) {
    throw new Error('SENTRY_TRACES_SAMPLE_RATE must be a number between 0 and 1');
  }

  return sampleRate;
}

if (sentryEnabled) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV || 'development',
    integrations: [Sentry.expressIntegration()],
    tracesSampleRate: getSentryTracesSampleRate(),
  });
}

const app = express();
const PORT = process.env.PORT || 3001;
const rawCorsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const ignoredCorsOrigins = rawCorsOrigins.filter((origin) => origin === '*' || origin.toLowerCase() === 'null');
const allowedCorsOrigins = rawCorsOrigins.filter((origin) => origin !== '*' && origin.toLowerCase() !== 'null');
const allowedCorsOriginSet = new Set(allowedCorsOrigins);


const ENABLE_HSTS_PRELOAD = process.env.HSTS_PRELOAD === 'true';

logger.info({ port: PORT }, 'Environment loaded');
logger.info({ configured: Boolean(process.env.DATABASE_URL) }, 'DATABASE_URL configuration checked');
logger.info({ origins: allowedCorsOrigins }, 'CORS origins allowlist configured');


if (ignoredCorsOrigins.length > 0) {
  logger.warn({ origins: ignoredCorsOrigins }, 'Ignoring unsafe CORS origins');
}

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        imgSrc: getConfiguredCspImageSrcValues(process.env),
        connectSrc: getConfiguredCspConnectSrcValues({ env: process.env }),
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"]
      }
    },
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    },
    strictTransportSecurity: false,
    xFrameOptions: {
      action: 'deny'
    }
  })
);

// HSTS (Production only)
if (process.env.NODE_ENV === 'production') {
  app.use(
    helmet.hsts({
      maxAge: 31536000,
      includeSubDomains: true,
      preload: ENABLE_HSTS_PRELOAD
    })
  );
}

// Permissions Policy
app.use((req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );
  next();
});
app.use(cors({
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
}));
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

// Auth routes
app.use('/api/auth', authController);

// Serve uploaded images as static files
app.use('/uploads', express.static(UPLOADS_DIR, {
  dotfiles: 'deny',
  index: false,
  immutable: true,
  maxAge: '1y',
  setHeaders: setUploadStaticHeaders,
}));

app.get('/api/test', (req, res) => {
  res.json({
    message: 'Backend is running!',
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Config routes — GET is public, mutating routes are protected per-route
app.use('/api/config', configRoutes);
app.get('/api/public-config', getPublicConfigController);

// Upload route (protected — must be logged in)
app.use('/api/upload', authenticate, uploadUserLimiter, uploadRoutes);

// Activity routes — GET is public, POST/DELETE are admin only
app.use('/api/activities', activityRoutes);

// Sponsorship + media routes for dynamic rendering
app.use('/api', sponsorshipRoutes);

// FAQ + Executive routes
app.use('/api', faqRoutes);
app.use('/api', executiveRoutes);
app.use('/api', mediaRoutes);

app.use((error, _req, res, next) => {
  if (error.message === 'Not allowed by CORS') {
    return res.status(error.status || 403).json({ error: 'Not allowed by CORS' });
  }

  return next(error);
});

if (sentryEnabled) {
  Sentry.setupExpressErrorHandler(app);
}

app.use((error, _req, res, _next) => {
  logger.error({ err: error }, 'Unhandled request error');
  res.status(error.status || 500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info({ port: PORT, sentryEnabled }, 'Server is running');
});
