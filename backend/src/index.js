import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import authController from './controllers/auth.controller.js';
import { authenticate } from './middleware/authMiddleware.js';
import './jobs/cleanupUnverified.js';
import configRoutes from './routes/configRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

console.log('Environment loaded - PORT:', PORT);
console.log('DATABASE_URL loaded:', process.env.DATABASE_URL ? 'Yes' : 'No');

app.use(cors());
app.use(express.json());

// Auth routes
app.use('/api/auth', authController);

// Serve uploaded images as static files
app.use('/uploads', express.static(resolve(__dirname, '../uploads')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend is running' });
});

app.get('/api/test', authenticate, (req, res) => {
  res.json({
    message: 'Test successful — you are authenticated!',
    user: req.user,
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Config & upload routes (protected — must be logged in)
app.use('/api/config', authenticate, configRoutes);
app.use('/api/upload', authenticate, uploadRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
