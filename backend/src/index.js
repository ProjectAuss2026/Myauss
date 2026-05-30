import './env.js';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
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

console.log('Environment loaded - PORT:', PORT);
console.log('DATABASE_URL loaded:', process.env.DATABASE_URL ? 'Yes' : 'No');

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
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

app.use(cors());
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
