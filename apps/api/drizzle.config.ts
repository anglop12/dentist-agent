import 'dotenv/config';
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/infrastructure/database/schema/*.ts',
  out: './db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? './storage/clinic.sqlite',
  },
  verbose: true,
  strict: true,
} satisfies Config;
