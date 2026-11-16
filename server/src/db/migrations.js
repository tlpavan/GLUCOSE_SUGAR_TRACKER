import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { assertDatabase } from './pool.js';

const directory = new URL('./migrations/', import.meta.url);

export async function runMigrations(pool, expectedDatabase) {
  if (!['sweety_dev', 'sweety_test'].includes(expectedDatabase)) {
    throw new Error('Unsupported migration target.');
  }
  const client = await pool.connect();
  try {
    await assertDatabase(client, expectedDatabase);
    await client.query('BEGIN');
    // Serialize runners and atomically commit schema changes with their versions.
    await client.query('SELECT pg_advisory_xact_lock($1)', [724012]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    const files = (await readdir(directory)).filter((file) => /^\d{3}_[a-z_]+\.sql$/.test(file)).sort();
    const applied = [];
    for (const file of files) {
      const sql = await readFile(new URL(file, directory), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const { rows } = await client.query('SELECT checksum FROM schema_migrations WHERE version = $1', [file]);
      if (rows.length) {
        if (rows[0].checksum !== checksum) throw new Error('An applied migration was modified.');
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [file, checksum]);
      applied.push(file);
    }
    await client.query('COMMIT');
    return applied;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
