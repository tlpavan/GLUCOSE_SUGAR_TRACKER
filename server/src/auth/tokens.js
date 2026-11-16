import jwt from 'jsonwebtoken';

export const TOKEN_LIFETIME_SECONDS = 15 * 60;
const options = { issuer: 'sweety-api', audience: 'sweety-client' };

export function createTokenService(secret) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT_SECRET must contain at least 32 bytes.');
  }
  return {
    issue(userId) {
      return jwt.sign({}, secret, {
        ...options, subject: String(userId), algorithm: 'HS256',
        expiresIn: TOKEN_LIFETIME_SECONDS,
      });
    },
    verify(token) {
      const claims = jwt.verify(token, secret, { ...options, algorithms: ['HS256'] });
      const userId = Number(claims.sub);
      if (!Number.isSafeInteger(userId) || userId <= 0 || String(userId) !== claims.sub
        || !Number.isInteger(claims.iat) || !Number.isInteger(claims.exp)
        || claims.iat > Math.floor(Date.now() / 1000)
        || claims.exp <= claims.iat || claims.exp - claims.iat > TOKEN_LIFETIME_SECONDS) {
        throw new Error('Invalid authentication claims.');
      }
      return userId;
    },
  };
}
