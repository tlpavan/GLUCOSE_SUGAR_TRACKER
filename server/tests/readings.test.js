import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createTokenService } from '../src/auth/tokens.js';
import { loadTestDatabaseUrl } from '../src/config/isolated-env.js';
import { assertDatabase, createPool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrations.js';
import { databaseDiagnostic } from '../src/db/diagnostics.js';
import { READING_SLOTS } from '../src/domain/reading-slots.js';
import { dateInTimeZone, isCalendarDate } from '../src/readings/validation.js';

describe('date-only validation', () => {
  it('validates actual calendar dates, including leap years, without rollover', () => {
    for (const date of ['2024-02-29', '2000-02-29', '2026-11-16', '0001-01-01']) assert.equal(isCalendarDate(date), true);
    for (const date of ['1900-02-29', '2025-02-29', '2026-04-31', '0000-01-01', '2026-00-01', '2026-13-01', '2026-01-00', '2026-1-1', '2026-11-16T00:00:00Z']) assert.equal(isCalendarDate(date), false);
  });
  it('uses the configured timezone at midnight rather than the host or UTC calendar day', () => {
    const instant = new Date('2026-11-15T18:30:00Z');
    assert.equal(dateInTimeZone(instant, 'Asia/Kolkata'), '2026-11-16');
    assert.equal(dateInTimeZone(new Date('2026-11-15T18:29:59Z'), 'Asia/Kolkata'), '2026-11-15');
    assert.equal(dateInTimeZone(instant, 'America/Los_Angeles'), '2026-11-15');
  });
});

describe('reading CRUD with real PostgreSQL', () => {
  let pool, app, tokenA, tokenB;
  const secret = randomBytes(48).toString('hex');
  const tokens = createTokenService(secret);
  const input = { date: '2026-11-16', slot: 'morning_fasting', valueMgDl: 100 };
  const instant = new Date('2026-11-15T18:30:00Z');
  const api = (method, url, token = tokenA) => request(app)[method](url).set('Authorization', `Bearer ${token}`);
  const create = (body = input, token = tokenA) => api('post', '/api/readings', token).send(body);
  const list = (date = input.date, token = tokenA) => api('get', `/api/readings?date=${date}`, token);

  before(async () => {
    try {
      pool = createPool(loadTestDatabaseUrl(), 'sweety_test');
      await runMigrations(pool, 'sweety_test');
    } catch (error) {
      throw new Error(`Reading test setup failed: ${databaseDiagnostic(error)}`);
    }
    app = createApp({ pool, jwtSecret: secret, timeZone: 'Asia/Kolkata', now: () => instant });
  });
  beforeEach(async () => {
    const client = await pool.connect();
    try {
      await assertDatabase(client, 'sweety_test');
      await client.query('TRUNCATE readings, users RESTART IDENTITY');
      // Auth itself is covered by postgres.test.js; these synthetic users exercise verified JWT ownership.
      const { rows } = await client.query(`INSERT INTO users (name, email, password_hash)
        VALUES ($1, $2, $3), ($4, $5, $6) RETURNING id`,
      ['User A', 'reading-a@example.test', 'synthetic-fixture', 'User B', 'reading-b@example.test', 'synthetic-fixture']);
      tokenA = tokens.issue(rows[0].id);
      tokenB = tokens.issue(rows[1].id);
    } finally { client.release(); }
  });
  after(async () => { if (pool) await pool.end(); });

  it('creates, lists, fully updates and deletes a reading with a stable date-only response', async () => {
    assert.deepEqual((await list()).body, { readings: [] });
    const created = await create();
    assert.equal(created.status, 201);
    const reading = created.body.reading;
    assert.equal(reading.date, input.date);
    assert.equal(reading.valueMgDl, 100);
    assert.deepEqual(Object.keys(reading).sort(), ['createdAt', 'date', 'id', 'slot', 'valueMgDl']);
    assert.equal(created.headers['cache-control'], 'no-store');
    assert.deepEqual((await list()).body.readings, [reading]);
    const changed = { date: '2024-02-29', slot: 'after_dinner', valueMgDl: 140 };
    const updated = await api('put', `/api/readings/${reading.id}`).send(changed);
    assert.equal(updated.status, 200);
    assert.deepEqual(updated.body.reading, { ...reading, ...changed });
    assert.deepEqual((await list()).body.readings, []);
    assert.equal((await list(changed.date)).body.readings[0].date, changed.date);
    const removed = await api('delete', `/api/readings/${reading.id}`);
    assert.equal(removed.status, 204);
    assert.equal(removed.text, '');
    assert.deepEqual((await list(changed.date)).body.readings, []);
    assert.equal((await api('delete', `/api/readings/${reading.id}`)).status, 404);
  });

  for (const value of [40, 600]) {
    it(`accepts boundary value ${value} on both creation and update`, async () => {
      const created = await create({ ...input, valueMgDl: value });
      assert.equal(created.status, 201);
      assert.equal(created.body.reading.valueMgDl, value);
      const updated = await api('put', `/api/readings/${created.body.reading.id}`).send({ ...input, valueMgDl: value });
      assert.equal(updated.status, 200);
      assert.equal(updated.body.reading.valueMgDl, value);
    });
  }

  for (const [label, patch, field] of [
    ['missing glucose', { valueMgDl: undefined }, 'valueMgDl'],
    ['39', { valueMgDl: 39 }, 'valueMgDl'], ['601', { valueMgDl: 601 }, 'valueMgDl'],
    ['decimal', { valueMgDl: 100.5 }, 'valueMgDl'], ['text', { valueMgDl: 'invalid' }, 'valueMgDl'],
    ['numeric string', { valueMgDl: '100' }, 'valueMgDl'], ['null', { valueMgDl: null }, 'valueMgDl'],
    ['boolean', { valueMgDl: true }, 'valueMgDl'],
    ['missing date', { date: undefined }, 'date'], ['invalid date', { date: '2026-02-30' }, 'date'],
    ['future date', { date: '2026-11-17' }, 'date'], ['timestamp', { date: '2026-11-16T00:00:00Z' }, 'date'],
    ['missing slot', { slot: undefined }, 'slot'], ['fifth slot', { slot: 'snacks' }, 'slot'],
    ['client user_id', { user_id: 2 }, 'request'], ['client userId', { userId: 2 }, 'request'],
  ]) {
    it(`rejects ${label} on create and update without changing stored data`, async () => {
      const created = await create();
      assert.equal(created.status, 201);
      const bad = { ...input, ...patch };
      for (const response of [await create(bad), await api('put', `/api/readings/${created.body.reading.id}`).send(bad)]) {
        assert.equal(response.status, 400);
        assert.equal(response.body.error.code, 'VALIDATION_ERROR');
        assert.ok(response.body.error.fields[field]);
      }
      assert.deepEqual((await list()).body.readings, [created.body.reading]);
    });
  }

  it('handles concurrent duplicate creates as one success and one friendly conflict', async () => {
    const responses = await Promise.all([create(), create()]);
    assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
    assert.equal(responses.find(r => r.status === 409).body.error.code, 'READING_EXISTS');
    assert.equal((await list()).body.readings.length, 1);
  });

  it('permits exactly four slots, lists them in canonical order and rejects a fifth reading', async () => {
    for (const slot of [...READING_SLOTS].reverse()) assert.equal((await create({ ...input, slot })).status, 201);
    assert.deepEqual((await list()).body.readings.map(r => r.slot), READING_SLOTS);
    assert.equal((await create({ ...input, slot: 'snacks' })).status, 400);
    assert.equal((await create()).status, 409);
    assert.equal((await list()).body.readings.length, 4);
    assert.equal((await create({ ...input, date: '2026-11-15' })).status, 201);
    assert.equal((await create(input, tokenB)).status, 201);
  });

  it('rejects updates into an occupied slot or date and preserves the original reading', async () => {
    const first = (await create()).body.reading;
    const second = (await create({ ...input, slot: 'after_lunch' })).body.reading;
    const third = (await create({ ...input, date: '2026-11-15' })).body.reading;
    for (const id of [second.id, third.id]) {
      const response = await api('put', `/api/readings/${id}`).send(input);
      assert.equal(response.status, 409);
      assert.equal(response.body.error.code, 'READING_EXISTS');
      assert.ok(response.body.error.fields.slot);
    }
    assert.deepEqual((await list()).body.readings, [first, second]);
    assert.deepEqual((await list(third.date)).body.readings, [third]);
  });

  it('rejects unauthenticated and invalid-token access to every reading endpoint', async () => {
    for (const [method, url] of [['post', '/api/readings'], ['get', '/api/readings?date=2026-11-16'], ['put', '/api/readings/1'], ['delete', '/api/readings/1']]) {
      assert.equal((await request(app)[method](url).send(input)).status, 401);
      assert.equal((await api(method, url, 'invalid').send(input)).status, 401);
    }
  });

  it('prevents A from reading, editing or deleting B data and hides record existence', async () => {
    const ownedByB = (await create(input, tokenB)).body.reading;
    assert.deepEqual((await list()).body.readings, []);
    for (const method of ['put', 'delete']) {
      const foreign = await api(method, `/api/readings/${ownedByB.id}`).send(input);
      const missing = await api(method, '/api/readings/999999').send(input);
      assert.equal(foreign.status, 404);
      assert.equal(missing.status, 404);
      assert.deepEqual(foreign.body, missing.body);
    }
    assert.deepEqual((await list(input.date, tokenB)).body.readings, [ownedByB]);
    assert.equal((await api('get', `/api/readings?date=${input.date}&user_id=2`)).status, 400);
    const own = await create();
    assert.equal(own.status, 201);
    assert.deepEqual((await list()).body.readings, [own.body.reading]);
  });

  it('validates list dates and IDs with safe error envelopes', async () => {
    for (const query of ['', '?date=2026-02-30', '?date=2026-11-17', '?date=2026-11-16&date=2026-11-15', '?date=invalid']) {
      const response = await api('get', '/api/readings' + query);
      assert.equal(response.status, 400);
      assert.equal(response.body.error.code, 'VALIDATION_ERROR');
    }
    for (const id of ['0', '-1', '1.5', '2147483648', '1-or-1=1']) {
      assert.equal((await api('put', `/api/readings/${id}`).send(input)).status, 400);
      assert.equal((await api('delete', `/api/readings/${id}`)).status, 400);
    }
  });

  it('rejects a token for a deleted user', async () => {
    await pool.query('DELETE FROM users WHERE id = $1', [1]);
    assert.equal((await create()).status, 401);
    assert.equal((await list()).status, 401);
  });
});
