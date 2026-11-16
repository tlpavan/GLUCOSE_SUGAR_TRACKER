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
import { reportRange } from '../src/reports/ranges.js';

const types = ['daily', 'month-to-date', 'previous-month'];
const emptySummary = { min: null, max: null, average: null, count: 0 };

describe('calendar report ranges', () => {
  for (const [type, date, startDate, endDate] of [
    ['daily', '2026-10-15', '2026-10-15', '2026-10-15'],
    ['month-to-date', '2026-10-15', '2026-10-01', '2026-10-15'],
    ['previous-month', '2026-10-15', '2026-09-01', '2026-09-30'],
    ['previous-month', '2026-01-15', '2025-12-01', '2025-12-31'],
    ['previous-month', '2024-03-31', '2024-02-01', '2024-02-29'],
    ['previous-month', '1900-03-01', '1900-02-01', '1900-02-28'],
    ['previous-month', '2000-03-01', '2000-02-01', '2000-02-29'],
    ['month-to-date', '2026-10-01', '2026-10-01', '2026-10-01'],
  ]) {
    it(`${type} for ${date} uses inclusive calendar boundaries`, () => {
      assert.deepEqual(reportRange(type, date), { startDate, endDate });
    });
  }
  it('rejects invalid dates, unknown report types and year underflow', () => {
    assert.throws(() => reportRange('daily', '2026-02-30'), RangeError);
    assert.throws(() => reportRange('annual', '2026-10-15'), RangeError);
    assert.throws(() => reportRange('previous-month', '0001-01-15'), RangeError);
  });
});

describe('mandatory reports with real PostgreSQL', () => {
  let pool, app, userA, userB, tokenA, tokenB;
  const secret = randomBytes(48).toString('hex');
  const tokens = createTokenService(secret);
  const instant = new Date('2026-11-15T18:30:00Z'); // November 16 in Asia/Kolkata.
  const report = (type, date = '2026-10-15', token = tokenA) => request(app)
    .get(`/api/reports/${type}?date=${date}`).set('Authorization', `Bearer ${token}`);
  const insert = (date, value, slot = 'morning_fasting', userId = userA) => pool.query(
    'INSERT INTO readings (user_id, reading_date, slot, value_mg_dl) VALUES ($1, $2, $3, $4)',
    [userId, date, slot, value],
  );

  before(async () => {
    try {
      pool = createPool(loadTestDatabaseUrl(), 'sweety_test');
      await runMigrations(pool, 'sweety_test');
    } catch (error) {
      throw new Error(`Report test setup failed: ${databaseDiagnostic(error)}`);
    }
    app = createApp({ pool, jwtSecret: secret, timeZone: 'Asia/Kolkata', now: () => instant });
  });
  beforeEach(async () => {
    const client = await pool.connect();
    try {
      await assertDatabase(client, 'sweety_test');
      await client.query('TRUNCATE readings, users RESTART IDENTITY');
      const { rows } = await client.query(`INSERT INTO users (name, email, password_hash)
        VALUES ($1, $2, $3), ($4, $5, $6) RETURNING id`,
      ['Report A', 'report-a@example.test', 'synthetic-fixture', 'Report B', 'report-b@example.test', 'synthetic-fixture']);
      [userA, userB] = rows.map(row => row.id);
      tokenA = tokens.issue(userA);
      tokenB = tokens.issue(userB);
    } finally { client.release(); }
  });
  after(async () => { if (pool) await pool.end(); });

  it('returns daily statistics, date-only details and all four slots in canonical order', async () => {
    await insert('2026-10-15', 101, 'after_dinner');
    await insert('2026-10-15', 100, 'morning_fasting');
    await insert('2026-10-15', 100, 'after_breakfast');
    await insert('2026-10-14', 40);
    await insert('2026-10-16', 600);
    const response = await report('daily');
    assert.equal(response.status, 200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.deepEqual(response.body.range, { startDate: '2026-10-15', endDate: '2026-10-15' });
    assert.deepEqual(response.body.summary, { min: 100, max: 101, average: 100.3, count: 3 });
    assert.deepEqual(response.body.readings.map(r => r.slot), ['morning_fasting', 'after_breakfast', 'after_dinner']);
    assert.ok(response.body.readings.every(r => r.date === '2026-10-15'));
    assert.deepEqual(Object.keys(response.body.readings[0]).sort(), ['createdAt', 'date', 'id', 'slot', 'valueMgDl']);
    assert.deepEqual(response.body.slots.map(s => s.slot), READING_SLOTS);
    assert.equal(response.body.slots[2].reading, null);
    assert.deepEqual(response.body.slots[0].reading, response.body.readings[0]);
  });

  it('rounds exact half tenths once in PostgreSQL and returns a JSON number', async () => {
    for (const [index, slot] of READING_SLOTS.entries()) await insert('2026-10-15', index === 3 ? 101 : 100, slot);
    const response = await report('daily');
    assert.equal(response.status, 200);
    assert.equal(response.body.summary.average, 100.3); // Exact AVG 100.25.
    assert.equal(typeof response.body.summary.average, 'number');
  });

  it('includes both month-to-date boundaries and excludes the prior month and later days', async () => {
    await insert('2026-09-30', 40);
    await insert('2026-10-15', 140, 'after_dinner');
    await insert('2026-10-01', 80);
    await insert('2026-10-15', 110, 'morning_fasting');
    await insert('2026-10-16', 600);
    const response = await report('month-to-date');
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.range, { startDate: '2026-10-01', endDate: '2026-10-15' });
    assert.deepEqual(response.body.summary, { min: 80, max: 140, average: 110, count: 3 });
    assert.deepEqual(response.body.readings.map(r => [r.date, r.slot]), [
      ['2026-10-01', 'morning_fasting'], ['2026-10-15', 'morning_fasting'], ['2026-10-15', 'after_dinner'],
    ]);
    assert.equal(response.body.slots, undefined);
    assert.deepEqual((await report('month-to-date', '2026-10-01')).body.summary, { min: 80, max: 80, average: 80, count: 1 });
  });

  for (const [label, selected, beforeDate, first, last, afterDate] of [
    ['September', '2026-10-15', '2026-08-31', '2026-09-01', '2026-09-30', '2026-10-01'],
    ['January year transition', '2026-01-15', '2025-11-30', '2025-12-01', '2025-12-31', '2026-01-01'],
    ['leap-year February', '2024-03-15', '2024-01-31', '2024-02-01', '2024-02-29', '2024-03-01'],
    ['non-leap February', '2025-03-15', '2025-01-31', '2025-02-01', '2025-02-28', '2025-03-01'],
  ]) {
    it(`previous month includes its entire calendar month for ${label}`, async () => {
      await insert(beforeDate, 40);
      await insert(first, 90);
      await insert(last, 150);
      await insert(afterDate, 600);
      const response = await report('previous-month', selected);
      assert.equal(response.status, 200);
      assert.deepEqual(response.body.range, { startDate: first, endDate: last });
      assert.deepEqual(response.body.summary, { min: 90, max: 150, average: 120, count: 2 });
      assert.deepEqual(response.body.readings.map(r => r.date), [first, last]);
    });
  }

  for (const type of types) {
    it(`${type} returns consistent empty data without using zero as a measurement`, async () => {
      const response = await report(type);
      assert.equal(response.status, 200);
      assert.deepEqual(response.body.summary, emptySummary);
      assert.deepEqual(response.body.readings, []);
      if (type === 'daily') assert.deepEqual(response.body.slots, READING_SLOTS.map(slot => ({ slot, reading: null })));
    });

    it(`${type} rejects missing, impossible, future and malformed selected dates`, async () => {
      for (const suffix of ['', '?date=', '?date=2026-02-30', '?date=2026-11-17', '?date=2026-1-1', '?date=2026-10-15T00:00:00Z', '?date=2026-10-15&date=2026-10-16', '?date=0000-01-01']) {
        const response = await request(app).get(`/api/reports/${type}${suffix}`).set('Authorization', `Bearer ${tokenA}`);
        assert.equal(response.status, 400);
        assert.equal(response.body.error.code, 'VALIDATION_ERROR');
        assert.ok(response.body.error.fields.date);
      }
      assert.equal((await report(type, '2026-11-16')).status, 200); // Local today, although UTC is still November 15.
    });

    it(`${type} scopes statistics and details to verified identity and rejects identity query overrides`, async () => {
      for (const date of ['2026-09-15', '2026-10-15']) {
        await insert(date, 80);
        await insert(date, 600, 'after_dinner', userB);
      }
      const own = await report(type);
      assert.equal(own.status, 200);
      assert.deepEqual(own.body.summary, { min: 80, max: 80, average: 80, count: 1 });
      assert.ok(own.body.readings.every(r => r.valueMgDl === 80));
      const other = await report(type, '2026-10-15', tokenB);
      assert.deepEqual(other.body.summary, { min: 600, max: 600, average: 600, count: 1 });
      assert.equal((await report(type, `2026-10-15&user_id=${userB}`)).status, 400);
      await pool.query('DELETE FROM readings WHERE user_id = $1', [userA]);
      assert.deepEqual((await report(type)).body.summary, emptySummary);
    });

    it(`${type} rejects missing/invalid tokens and deleted accounts`, async () => {
      assert.equal((await request(app).get(`/api/reports/${type}?date=2026-10-15`)).status, 401);
      assert.equal((await report(type, '2026-10-15', 'invalid')).status, 401);
      await pool.query('DELETE FROM users WHERE id = $1', [userA]);
      assert.equal((await report(type)).status, 401);
    });
  }

  it('returns a useful validation error for previous-month year underflow', async () => {
    const response = await report('previous-month', '0001-01-15');
    assert.equal(response.status, 400);
    assert.ok(response.body.error.fields.date);
  });
});
