export async function api(path, { token, body, method = 'GET', signal, onExpired } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method, signal, cache: 'no-store',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }
  if (response.status === 401 && token) onExpired?.();
  if (response.status === 204) return null;
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(result?.error?.message || 'The request could not be completed. Please try again.');
    error.fields = result?.error?.fields || {};
    error.status = response.status;
    throw error;
  }
  if (!result) throw new Error('Unexpected server response. Please try again.');
  return result;
}
