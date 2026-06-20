import express from 'express';
import cors from 'cors';
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
import { setUploadStaticHeaders, UPLOADS_DIR } from './controllers/uploadController.js';

function getAllowedCorsOrigins() {
  const rawCorsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const ignoredCorsOrigins = rawCorsOrigins.filter((origin) => origin === '*' || origin.toLowerCase() === 'null');
  const allowedCorsOrigins = rawCorsOrigins.filter((origin) => origin !== '*' && origin.toLowerCase() !== 'null');

  if (ignoredCorsOrigins.length > 0) {
    console.warn('Ignoring unsafe CORS origins:', ignoredCorsOrigins.join(', '));
  }

  return new Set(allowedCorsOrigins);
}

function getAppContentSecurityPolicy() {
  const uploadsPublicOrigin = process.env.UPLOADS_PUBLIC_ORIGIN?.replace(/\/+$/, '');
  const imageSources = ["'self'", 'data:', 'blob:'];

  if (uploadsPublicOrigin) {
    imageSources.push(uploadsPublicOrigin);
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imageSources.join(' ')}`,
  ].join('; ');
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

function handleCorsErrors(error, _req, res, next) {
  if (error.message === 'Not allowed by CORS') {
    return res.status(error.status || 403).json({ error: 'Not allowed by CORS' });
  }

  return next(error);
}

export function createApp() {
  const app = express();

  configureSecurity(app);
  app.use(createCorsMiddleware());
  app.use((_req, res, next) => {
    res.setHeader('Content-Security-Policy', getAppContentSecurityPolicy());
    next();
  });
  app.use(express.json());
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

  app.get('/api/health', (req, res) => {
    res.json({ status: 'Backend is running' });
  });

  app.get('/api/test', (req, res) => {
    res.json({
      message: 'Backend is running!',
      timestamp: new Date().toISOString(),
      port: process.env.PORT || 3001,
      environment: process.env.NODE_ENV || 'development',
    });
  });

  // Config routes - GET is public, mutating routes are admin only
  app.use('/api/config', configRoutes);
  app.get('/api/public-config', getPublicConfigController);

  // Upload route (protected - must be logged in)
  app.use('/api/upload', uploadRoutes);

  // Activity routes - GET is public, mutating/admin routes are admin only
  app.use('/api/activities', activityRoutes);

  // Sponsorship + media routes for dynamic rendering
  app.use('/api', sponsorshipRoutes);

  // FAQ + Executive routes
  app.use('/api', faqRoutes);
  app.use('/api', executiveRoutes);
  app.use('/api', mediaRoutes);

  app.use(handleCorsErrors);

  return app;
}

export default createApp;