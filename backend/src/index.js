import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import './jobs/cleanupUnverified.js';
import { createApp } from './app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env') });

const PORT = process.env.PORT || 3001;

console.log('Environment loaded - PORT:', PORT);
console.log('DATABASE_URL loaded:', process.env.DATABASE_URL ? 'Yes' : 'No');

const app = createApp();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
