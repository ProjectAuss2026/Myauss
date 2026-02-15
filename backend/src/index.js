import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (two levels up from backend/src/)
dotenv.config({ path: resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

console.log('Environment loaded - PORT:', PORT);
console.log('DATABASE_URL loaded:', process.env.DATABASE_URL ? 'Yes' : 'No');

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend is running' });
});

app.get('/api/test', (req, res) => {
  res.json({
    message: 'Test successful!',
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
