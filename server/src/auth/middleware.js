export function requireAuthentication(tokens) {
  return (req, res, next) => {
    const authorization = req.get('authorization');
    const match = typeof authorization === 'string' && /^Bearer ([^\s]+)$/i.exec(authorization);
    try {
      if (!match) throw new Error('Missing bearer token.');
      // Ignore userId fields, query parameters and other unverified client data.
      req.auth = Object.freeze({ userId: tokens.verify(match[1]) });
      next();
    } catch {
      res.status(401).json({ error: {
        code: 'UNAUTHORIZED', message: 'A valid, unexpired bearer token is required.',
      } });
    }
  };
}
