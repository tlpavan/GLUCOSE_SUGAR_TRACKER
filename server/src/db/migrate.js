import { databaseDiagnostic } from './diagnostics.js';
import { createPool } from './pool.js';
import { runMigrations } from './migrations.js';

let pool;
try {
  const testMode = process.argv.includes('--test');
  let connectionString;
  let database;
  if (testMode) {
    const { loadTestDatabaseUrl } = await import('../config/isolated-env.js');
    connectionString = loadTestDatabaseUrl();
    database = 'sweety_test';
  } else {
    const { env } = await import('../config/env.js');
    if (env.NODE_ENV === 'test') throw new Error('Use the explicit test migration command.');
    connectionString = env.DATABASE_URL;
    database = 'sweety_dev';
  }
  pool = createPool(connectionString, database);
  const applied = await runMigrations(pool, database);
  console.log(`Migrations complete for ${database}: ${applied.length} applied.`);
} catch (error) {
  console.error(`Migration failed: ${databaseDiagnostic(error)}`);
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
}
