import { databaseDiagnostic } from '../src/db/diagnostics.js';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadTestDatabaseUrl } from '../src/config/isolated-env.js';
import { READING_SLOTS } from '../src/domain/reading-slots.js';
import { assertDatabase, createPool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrations.js';

describe('real PostgreSQL persistence and authentication', () => {
  let pool;
  let app;
  const credentials = { name: 'Synthetic User', email: 'user@example.test', password: 'synthetic-password-123' };

  before(async () => {
    // Fail, rather than skip or silently use a mock, if real PostgreSQL is unavailable.
    try {
      pool = createPool(loadTestDatabaseUrl(), 'sweety_test');
      await runMigrations(pool, 'sweety_test');
    } catch (error) {
      throw new Error(`Real PostgreSQL test setup failed: ${databaseDiagnostic(error)}`);
    }
    app = createApp({ pool, jwtSecret: randomBytes(48).toString('hex') });
  });

  beforeEach(async () => {
    const client = await pool.connect();
    try {
      await assertDatabase(client, 'sweety_test');
      await client.query('TRUNCATE readings, users RESTART IDENTITY');
    } finally {
      client.release();
    }
  });

  after(async () => { if (pool) await pool.end(); });

  async function register(overrides = {}) {
    const response = await request(app).post('/api/auth/register').send({ ...credentials, ...overrides });
    assert.equal(response.status, 201);
    return response;
  }

  it('applies versioned migrations idempotently without deleting users', async () => {
    await register();
    assert.deepEqual(await runMigrations(pool, 'sweety_test'), []);
    const { rows } = await pool.query('SELECT count(*)::int AS count FROM users');
    assert.equal(rows[0].count, 1);
    const versions = await pool.query('SELECT version FROM schema_migrations ORDER BY version');
    assert.deepEqual(versions.rows, [{ version: '001_create_users_and_readings.sql' }]);
  });

  it('refuses mismatched actual database identity before migration writes', async () => {
    await assert.rejects(runMigrations(pool, 'sweety_dev'), /safety check failed/);
    const { rows } = await pool.query('SELECT count(*)::int AS count FROM schema_migrations');
    assert.equal(rows[0].count, 1);
  });

  it('refuses a modified applied migration ledger without changing user data', async () => {
    await register();
    const { rows } = await pool.query('SELECT version, checksum FROM schema_migrations');
    const { version, checksum } = rows[0];
    try {
      await pool.query('UPDATE schema_migrations SET checksum = $1 WHERE version = $2', ['modified', version]);
      await assert.rejects(runMigrations(pool, 'sweety_test'), /applied migration was modified/);
      const users = await pool.query('SELECT count(*)::int AS count FROM users');
      assert.equal(users.rows[0].count, 1);
    } finally {
      await pool.query('UPDATE schema_migrations SET checksum = $1 WHERE version = $2', [checksum, version]);
    }
  });

  it('registers a normalized user and persists a verifiable salted bcrypt hash', async () => {
    const response = await register({ name: ' Synthetic User ', email: ' USER@EXAMPLE.TEST ' });
    assert.deepEqual(response.body.user, { id: 1, name: credentials.name, email: credentials.email });
    assert.ok(typeof response.body.token === 'string');
    assert.equal(response.body.tokenType, 'Bearer');
    assert.equal(response.body.expiresIn, 900);
    assert.equal(response.headers['cache-control'], 'no-store');
    const { rows } = await pool.query('SELECT password_hash, created_at FROM users WHERE id = $1', [1]);
    assert.ok(rows[0].password_hash !== credentials.password);
    assert.ok(await bcrypt.compare(credentials.password, rows[0].password_hash));
    assert.equal(bcrypt.getRounds(rows[0].password_hash), 12);
    assert.ok(rows[0].created_at instanceof Date);
    assert.ok(!JSON.stringify(response.body).includes('password'));
    await register({ email: 'second@example.test' });
    const second = await pool.query('SELECT password_hash FROM users WHERE id = $1', [2]);
    assert.ok(second.rows[0].password_hash !== rows[0].password_hash);
  });

  it('rejects duplicate normalized emails including concurrent registrations', async () => {
    const responses = await Promise.all([
      request(app).post('/api/auth/register').send(credentials),
      request(app).post('/api/auth/register').send({ ...credentials, email: ' USER@EXAMPLE.TEST ' }),
    ]);
    assert.deepEqual(responses.map((res) => res.status).sort(), [201, 409]);
    assert.equal(responses.find((res) => res.status === 409).body.error.code, 'EMAIL_EXISTS');
    const { rows } = await pool.query('SELECT count(*)::int AS count FROM users');
    assert.equal(rows[0].count, 1);
  });

  it('logs in with a normalized email and authenticates the stored user', async () => {
    const registered = await register();
    const response = await request(app).post('/api/auth/login').send({ email: ' USER@EXAMPLE.TEST ', password: credentials.password });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.user, registered.body.user);
    assert.ok(!JSON.stringify(response.body).includes('password'));
    const identity = await request(app).get('/api/auth/me?userId=999').set('Authorization', `Bearer ${response.body.token}`);
    assert.equal(identity.status, 200);
    assert.deepEqual(identity.body.user, registered.body.user);
    const missing = await request(app).get('/api/auth/me');
    assert.equal(missing.status, 401);
    await pool.query('DELETE FROM users WHERE id = $1', [registered.body.user.id]);
    assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${response.body.token}`)).status, 401);
  });

  it('returns the same generic error for unknown email and incorrect password', async () => {
    await register();
    const wrongPassword = await request(app).post('/api/auth/login').send({ email: credentials.email, password: 'incorrect-password' });
    const unknownEmail = await request(app).post('/api/auth/login').send({ email: 'missing@example.test', password: credentials.password });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.deepEqual(wrongPassword.body, unknownEmail.body);
  });

  it('rejects malformed registration/login input without inserting users', async () => {
    for (const body of [
      {}, { ...credentials, name: ' ' }, { ...credentials, email: 'invalid' },
      { ...credentials, password: 'short' }, { ...credentials, password: 'a'.repeat(73) },
      { ...credentials, password: 'é'.repeat(37) }, { ...credentials, userId: 99 },
    ]) assert.equal((await request(app).post('/api/auth/register').send(body)).status, 400);
    assert.equal((await request(app).post('/api/auth/login').send({ email: credentials.email })).status, 400);
    const malformed = await request(app).post('/api/auth/register').set('Content-Type', 'application/json').send('{');
    assert.equal(malformed.status, 400);
    const { rows } = await pool.query('SELECT count(*)::int AS count FROM users');
    assert.equal(rows[0].count, 0);
  });

  async function insertReading(userId, slot, value, date = '2026-01-01') {
    return pool.query(`INSERT INTO readings (user_id, reading_date, slot, value_mg_dl)
      VALUES ($1, $2, $3, $4) RETURNING id`, [userId, date, slot, value]);
  }

  it('enforces exactly the original slots, inclusive value bounds and per-user uniqueness', async () => {
    const first = (await register()).body.user;
    for (const [index, slot] of READING_SLOTS.entries()) {
      await insertReading(first.id, slot, index === 0 ? 40 : 600);
    }
    await assert.rejects(insertReading(first.id, READING_SLOTS[0], 100), { code: '23505' });
    const second = (await register({ email: 'second@example.test' })).body.user;
    await insertReading(second.id, READING_SLOTS[0], 100);
    for (const slot of ['snacks', 'bedtime', 'after_snacks', '']) {
      await assert.rejects(insertReading(first.id, slot, 100), { code: '23514' });
    }
    for (const value of [39, 601]) {
      await assert.rejects(insertReading(first.id, READING_SLOTS[0], value, '2026-01-02'), { code: '23514' });
    }
    await assert.rejects(insertReading(first.id, READING_SLOTS[0], 40.5, '2026-01-02'), { code: '22P02' });
    const { rows } = await pool.query('SELECT count(*)::int AS count FROM readings');
    assert.equal(rows[0].count, 5);
  });

  it('enforces the reading foreign key and normalized email constraints in PostgreSQL', async () => {
    await assert.rejects(insertReading(999, READING_SLOTS[0], 100), { code: '23503' });
    const user = (await register()).body.user;
    await assert.rejects(pool.query('UPDATE users SET email = $1 WHERE id = $2', [' UPPER@EXAMPLE.TEST ', user.id]), { code: '23514' });
    await assert.rejects(pool.query('UPDATE users SET name = $1 WHERE id = $2', [' ', user.id]), { code: '23514' });
    await assert.rejects(pool.query('INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)',
      ['Other', credentials.email, 'synthetic-hash']), { code: '23505' });
  });
});
