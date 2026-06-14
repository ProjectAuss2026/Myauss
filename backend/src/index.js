import './env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import authController from './controllers/auth.controller.js';
import getPublicConfigController from './controllers/getPublicConfigController.js';
import { authenticate } from './middleware/authMiddleware.js';
import { globalApiLimiter, uploadUserLimiter } from './middleware/rateLimiters.js';
import './jobs/cleanupUnverified.js';
import configRoutes from './routes/configRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import sponsorshipRoutes from './routes/sponsorshipRoutes.js';
import mediaRoutes from './routes/mediaRoutes.js';
import faqRoutes from './routes/faqRoutes.js';
import executiveRoutes from './routes/executiveRoutes.js';
import { setUploadStaticHeaders, UPLOADS_DIR } from './controllers/uploadController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const rawCorsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const ignoredCorsOrigins = rawCorsOrigins.filter((origin) => origin === '*' || origin.toLowerCase() === 'null');
const allowedCorsOrigins = rawCorsOrigins.filter((origin) => origin !== '*' && origin.toLowerCase() !== 'null');
const allowedCorsOriginSet = new Set(allowedCorsOrigins);

const IMAGE_SRC_VALUES = [
  "'self'",
  'data:',
  'blob:',
  'https://prodcdn.sporty.co.nz',
  'https://images.squarespace-cdn.com',
  'https://www.lskd.co',
  'https://upload.wikimedia.org',
  'https://nevafoldcollection.com',
  'https://avancus.com',
  'https://assets.shipcode.com',
  'https://images.pixieset.com',
];

console.log('Environment loaded - PORT:', PORT);
console.log('DATABASE_URL loaded:', process.env.DATABASE_URL ? 'Yes' : 'No');
console.log('CORS origins allowlist:', allowedCorsOrigins.length ? allowedCorsOrigins.join(', ') : '(none configured)');

if (ignoredCorsOrigins.length > 0) {
  console.warn('Ignoring unsafe CORS origins:', ignoredCorsOrigins.join(', '));
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
        imgSrc: IMAGE_SRC_VALUES,
        connectSrc: ["'self'"],
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
      preload: true
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
