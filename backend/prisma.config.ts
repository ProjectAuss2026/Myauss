import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import { defineConfig, env } from 'prisma/config';

const dbUrl = env('DATABASE_URL');
console.log('Prisma config - DATABASE_URL:', dbUrl); // Debug

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: dbUrl },
});