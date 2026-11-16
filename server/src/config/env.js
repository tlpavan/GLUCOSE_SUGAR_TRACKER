import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';
import { validateDatabaseUrl, validateTestDatabaseUrl } from '../db/config.js';

const rootDirectory = fileURLToPath(new URL('../../../', import.meta.url));
dotenv.config({ path: path.join(rootDirectory, '.env') });

const timeZone = z.string().refine(
  (value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  },
  { message: 'APP_TIME_ZONE must be a valid IANA timezone.' },
);

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  APP_TIME_ZONE: timeZone.default('Asia/Kolkata'),
  DATABASE_URL: z.string().min(1).optional(),
  TEST_DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(32),
});

const result = environmentSchema.safeParse(process.env);
if (!result.success) {
  // Field names are enough to diagnose configuration; never echo raw input.
  const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
  throw Object.assign(new Error(`Invalid environment configuration fields: ${fields.join(', ')}.`), { code: 'ENV_INVALID' });
}
if (result.data.NODE_ENV === 'test') {
  validateTestDatabaseUrl(result.data.TEST_DATABASE_URL);
} else {
  validateDatabaseUrl(result.data.DATABASE_URL, 'sweety_dev');
}
export const env = Object.freeze(result.data);
