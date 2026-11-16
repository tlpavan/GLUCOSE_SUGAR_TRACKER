import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { validateTestDatabaseUrl } from '../db/config.js';

export function loadTestDatabaseUrl() {
  // Deliberately never load .env or fall back to DATABASE_URL in tests.
  const values = {};
  const result = dotenv.config({
    path: fileURLToPath(new URL('../../../.env.test', import.meta.url)),
    processEnv: values,
  });
  if (result.error || values.NODE_ENV !== 'test') {
    throw new Error('Configure ignored .env.test with NODE_ENV=test and TEST_DATABASE_URL.');
  }
  return validateTestDatabaseUrl(values.TEST_DATABASE_URL);
}
