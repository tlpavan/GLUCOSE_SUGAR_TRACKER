// Only fixed messages and allow-listed codes may leave database/config failures.
// Never include raw messages, detail, stack, causes or connection properties.
const diagnostics = {
  '28P01': 'Password authentication failed. Correct the application role password in the ignored environment file for this PostgreSQL instance.',
  '28000': 'Authentication was rejected. Check the application role LOGIN attribute and local PostgreSQL authentication rules.',
  '42501': 'Insufficient privileges. Check CONNECT on the target database, USAGE/CREATE on public, and ownership of existing migration objects.',
  '3D000': 'The target database does not exist on the configured PostgreSQL instance.',
  'ECONNREFUSED': 'Connection refused. Check the PostgreSQL 17 service and its configured port.',
  'ETIMEDOUT': 'Connection timed out. Check the local service and port.',
  'ENOTFOUND': 'Database hostname could not be resolved.',
  '42601': 'Migration SQL syntax error. Review the versioned migration SQL.',
  '42P07': 'A migration object already exists without the expected migration ledger. Inspect existing schema; do not delete user data.',
  'ENV_INVALID': 'Invalid application environment configuration. Check required keys and ensure JWT_SECRET has at least 32 characters.',
};
const knownMessages = new Map([
  ['Configure ignored .env.test with NODE_ENV=test and TEST_DATABASE_URL.', '[TEST_ENV_INVALID] Configure repository-root .env.test with NODE_ENV=test and a nonempty TEST_DATABASE_URL.'],
  ['Configure a local dedicated application account for sweety_dev.', '[DATABASE_URL_INVALID] DATABASE_URL must use a dedicated local role and target exactly sweety_dev with no URL options.'],
  ['Configure a local dedicated application account for sweety_test.', '[TEST_DATABASE_URL_INVALID] TEST_DATABASE_URL must use a dedicated local role and target exactly sweety_test with no URL options.'],
  ['Database identity or application role safety check failed.', '[DATABASE_GUARD] The actual database identity or non-superuser role check failed.'],
  ['An applied migration was modified.', '[MIGRATION_CHECKSUM] An applied migration checksum differs. Restore the original migration; use a new version for changes.'],
  ['Use the explicit test migration command.', '[MIGRATION_TARGET] Use migrate:test when NODE_ENV=test.'],
]);

export function databaseDiagnostic(error) {
  if (Object.hasOwn(diagnostics, error?.code)) {
    return `[${error.code}] ${diagnostics[error.code]}`;
  }
  return knownMessages.get(error?.message)
    ?? '[DATABASE_FAILURE] Unclassified database/setup failure. Check configuration and review the failing operation locally; raw error details are suppressed.';
}
