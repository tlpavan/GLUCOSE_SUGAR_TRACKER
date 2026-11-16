// Validate destinations without ever including a connection string in errors.
export function validateDatabaseUrl(value, expectedDatabase) {
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)
      || decodeURIComponent(url.pathname) !== `/${expectedDatabase}`
      || !url.username || !url.password || url.search || url.hash) {
      throw new Error();
    }
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      throw new Error();
    }
    if (decodeURIComponent(url.username) === 'postgres') throw new Error();
  } catch {
    throw new Error(`Configure a local dedicated application account for ${expectedDatabase}.`);
  }
  return value;
}

// Exact allow-list: no substring checks, development URL fallback or URL options.
export function validateTestDatabaseUrl(value) {
  return validateDatabaseUrl(value, 'sweety_test');
}
