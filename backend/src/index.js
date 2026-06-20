import './env.js';
import './jobs/cleanupUnverified.js';
import { createApp } from './app.js';

const PORT = process.env.PORT || 3001;
const rawCorsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedCorsOrigins = rawCorsOrigins.filter((origin) => origin !== '*' && origin.toLowerCase() !== 'null');

console.log('Environment loaded - PORT:', PORT);
console.log('DATABASE_URL loaded:', process.env.DATABASE_URL ? 'Yes' : 'No');
console.log('CORS origins allowlist:', allowedCorsOrigins.length ? allowedCorsOrigins.join(', ') : '(none configured)');

const app = createApp();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
