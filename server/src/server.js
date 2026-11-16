import { createApp } from './app.js';
import { env } from './config/env.js';
import { assertDatabase, createPool } from './db/pool.js';

const database = env.NODE_ENV === 'test' ? 'sweety_test' : 'sweety_dev';
const pool = createPool(env.NODE_ENV === 'test' ? env.TEST_DATABASE_URL : env.DATABASE_URL, database);

try {
  await assertDatabase(pool, database);
  const app = createApp({ clientOrigin: env.CLIENT_ORIGIN, pool, jwtSecret: env.JWT_SECRET });
  const server = app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
  });
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    server.close(async () => {
      await pool.end();
      process.exitCode = 0;
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch {
  console.error('API startup failed. Check local database configuration and application-role permissions.');
  await pool.end();
  process.exitCode = 1;
}
