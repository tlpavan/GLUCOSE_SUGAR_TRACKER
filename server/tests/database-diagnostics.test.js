import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { databaseDiagnostic } from '../src/db/diagnostics.js';

describe('sanitized database diagnostics', () => {
  it('identifies authentication, permissions and connection failures without exposing driver details', () => {
    for (const code of ['28P01', '42501', 'ECONNREFUSED', '3D000', 'ENV_INVALID']) {
      const text = databaseDiagnostic({ code, message: 'sensitive-marker', detail: 'sensitive-marker', connectionString: 'sensitive-marker', cause: new Error('sensitive-marker') });
      assert.ok(text.startsWith(`[${code}]`));
      assert.ok(!text.includes('sensitive-marker'));
    }
  });

  it('does not echo unknown error codes, messages, SQL or inherited object properties', () => {
    for (const code of ['sensitive-marker', 'constructor', '__proto__', 'toString', undefined]) {
      assert.equal(databaseDiagnostic({ code, message: 'sensitive-marker', query: 'sensitive-marker' }),
        '[DATABASE_FAILURE] Unclassified database/setup failure. Check configuration and review the failing operation locally; raw error details are suppressed.');
    }
    assert.ok(databaseDiagnostic(null).startsWith('[DATABASE_FAILURE]'));
  });

  it('distinguishes fixed configuration, isolation and checksum failures', () => {
    for (const [message, code] of [
      ['Configure ignored .env.test with NODE_ENV=test and TEST_DATABASE_URL.', 'TEST_ENV_INVALID'],
      ['Configure a local dedicated application account for sweety_test.', 'TEST_DATABASE_URL_INVALID'],
      ['Database identity or application role safety check failed.', 'DATABASE_GUARD'],
      ['An applied migration was modified.', 'MIGRATION_CHECKSUM'],
    ]) assert.ok(databaseDiagnostic(new Error(message)).startsWith(`[${code}]`));
  });
});
