import pg from 'pg';
import { validateDatabaseUrl } from './config.js';

export function createPool(connectionString, database) {
  if (!['sweety_dev', 'sweety_test'].includes(database)) {
    throw new Error('Unsupported application database.');
  }
  validateDatabaseUrl(connectionString, database);
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    statement_timeout: 10000,
    application_name: 'sweety',
  });
  pool.on('error', () => console.error('An idle database connection failed.'));
  return pool;
}

// Check the real connection before migrations or destructive test setup.
export async function assertDatabase(client, expectedDatabase) {
  const { rows } = await client.query(`
    SELECT current_database() AS database, rolsuper
    FROM pg_roles WHERE rolname = current_user
  `);
  if (rows[0]?.database !== expectedDatabase || rows[0]?.rolsuper !== false) {
    throw new Error('Database identity or application role safety check failed.');
  }
}
