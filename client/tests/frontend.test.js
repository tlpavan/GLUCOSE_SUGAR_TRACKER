import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { api } from '../src/api.js';
import { SLOTS, localToday, dateError, readingErrors } from '../src/reading-utils.js';
import { READING_SLOTS } from '../../server/src/domain/reading-slots.js';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('UI uses exactly the canonical backend slot IDs', () => {
  assert.deepEqual(SLOTS.map(([id]) => id), READING_SLOTS);
});
test('date controls use local calendar parts and validate future/leap dates', () => {
  assert.equal(localToday(new Date(2026, 10, 16, 0, 5)), '2026-11-16');
  assert.equal(dateError('2024-02-29', '2026-11-16'), '');
  for (const date of ['', '2026-02-30', '2026-11-17', '2026-1-1']) assert.ok(dateError(date, '2026-11-16'));
});
test('reading validation rejects missing, decimal, nonnumeric and out-of-range values', () => {
  const base = { date: '2026-11-16', slot: 'morning_fasting', valueMgDl: '' };
  for (const value of ['', ' ', '39', '601', '40.5', 'text', '1e2']) {
    assert.ok(readingErrors({ ...base, valueMgDl: value }, base.date).valueMgDl);
  }
  for (const value of ['40', '600']) assert.deepEqual(readingErrors({ ...base, valueMgDl: value }, base.date), {});
  assert.ok(readingErrors({ ...base, slot: 'snacks' }, base.date).slot);
});
test('API uses bearer authorization and sends the reading contract without ownership fields', async () => {
  let observed;
  const body = { date: '2026-11-16', slot: 'morning_fasting', valueMgDl: 100 };
  globalThis.fetch = async (url, options) => { observed = { url, options }; return new Response(JSON.stringify({ reading: body }), { status: 201 }); };
  await api('/readings', { token: 'synthetic-token', method: 'POST', body });
  assert.equal(observed.url, '/api/readings');
  assert.equal(observed.options.headers.Authorization, 'Bearer synthetic-token');
  assert.deepEqual(JSON.parse(observed.options.body), body);
  assert.equal(observed.options.cache, 'no-store');
});
test('API preserves backend conflict messages and field errors', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'A reading already exists.', fields: { slot: 'Choose an unused slot.' } } }), { status: 409 });
  await assert.rejects(api('/readings'), error => error.status === 409 && error.fields.slot === 'Choose an unused slot.' && error.message === 'A reading already exists.');
});
test('protected 401 expires the session but bad login does not call expiry', async () => {
  let expired = 0;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), { status: 401 });
  await assert.rejects(api('/readings', { token: 'invalid', onExpired: () => expired++ }));
  assert.equal(expired, 1);
  await assert.rejects(api('/auth/login', { onExpired: () => expired++ }));
  assert.equal(expired, 1);
});
test('DELETE supports a 204 empty response', async () => {
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await api('/readings/1', { method: 'DELETE' }), null);
});
test('network failures get a useful message and cancellation stays identifiable', async () => {
  globalThis.fetch = async () => { throw new TypeError('network'); };
  await assert.rejects(api('/readings'), /Cannot reach the server/);
  globalThis.fetch = async () => { throw new DOMException('Aborted', 'AbortError'); };
  await assert.rejects(api('/readings'), { name: 'AbortError' });
});
