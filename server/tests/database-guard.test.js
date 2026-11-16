import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateTestDatabaseUrl } from '../src/db/config.js';
import { assertDatabase } from '../src/db/pool.js';

describe('test database safety', () => {
  const safe = 'postgresql://application:placeholder@localhost:5432/sweety_test';

  it('accepts only the exact local test database and a dedicated role', () => {
    assert.equal(validateTestDatabaseUrl(safe), safe);
    for (const invalid of [
      undefined, '', 'not a URL', safe.replace('sweety_test', 'sweety_dev'),
      safe.replace('sweety_test', 'sweety_test_backup'), safe.replace('localhost', 'remote.example'),
      safe + '?options=-c%20search_path%3Dpublic', safe.replace('application:', 'postgres:'),
      safe.replace('postgresql:', 'https:'), safe + '#fragment',
    ]) {
      assert.throws(() => validateTestDatabaseUrl(invalid), /dedicated application account/);
    }
  });

  it('redacts invalid configuration values from errors', () => {
    try {
      validateTestDatabaseUrl(safe.replace('sweety_test', 'sweety_dev'));
      assert.fail('Expected refusal.');
    } catch (error) {
      assert.ok(!error.message.includes('placeholder'));
      assert.ok(!error.message.includes(safe));
    }
  });

  it('checks the actual database and refuses superuser connections', async () => {
    for (const row of [
      { database: 'sweety_dev', rolsuper: false },
      { database: 'sweety_test', rolsuper: true },
    ]) {
      const client = { query: async () => ({ rows: [row] }) };
      await assert.rejects(assertDatabase(client, 'sweety_test'), /safety check failed/);
    }
  });
});
