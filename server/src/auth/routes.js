import bcrypt from 'bcrypt';
import { Router } from 'express';
import { requireAuthentication } from './middleware.js';
import { createUserRepository } from './repository.js';
import { TOKEN_LIFETIME_SECONDS, createTokenService } from './tokens.js';
import { loginSchema, parseCredentials, registrationSchema } from './validation.js';

const HASH_ROUNDS = 12;
// Equal-cost comparison for unknown accounts reduces email-existence timing leaks.
const dummyHash = bcrypt.hash('synthetic-timing-comparison', HASH_ROUNDS);
const invalidLogin = { error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } };
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);

export function createAuthRouter({ pool, jwtSecret }) {
  const router = Router();
  const users = createUserRepository(pool);
  const tokens = createTokenService(jwtSecret);
  const authenticate = requireAuthentication(tokens);

  function sendAuthentication(res, status, user) {
    res.set('Cache-Control', 'no-store');
    return res.status(status).json({
      user, token: tokens.issue(user.id), tokenType: 'Bearer', expiresIn: TOKEN_LIFETIME_SECONDS,
    });
  }

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.post('/register', asyncRoute(async (req, res) => {
    const parsed = parseCredentials(registrationSchema, req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const { name, email, password } = parsed.data;
    const passwordHash = await bcrypt.hash(password, HASH_ROUNDS);
    try {
      const user = await users.create({ name, email, passwordHash });
      return sendAuthentication(res, 201, user);
    } catch (error) {
      // Database uniqueness is authoritative, including simultaneous registrations.
      if (error.code === '23505' && error.constraint === 'users_email_unique') {
        return res.status(409).json({ error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists.' } });
      }
      throw error;
    }
  }));

  router.post('/login', asyncRoute(async (req, res) => {
    const parsed = parseCredentials(loginSchema, req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const { email, password } = parsed.data;
    const user = await users.findByEmail(email);
    const matches = await bcrypt.compare(password, user?.password_hash ?? await dummyHash);
    if (!user || !matches) return res.status(401).json(invalidLogin);
    return sendAuthentication(res, 200, { id: user.id, name: user.name, email: user.email });
  }));

  // A minimal protected identity endpoint verifies middleware without adding readings.
  router.get('/me', authenticate, asyncRoute(async (req, res) => {
    const user = await users.findPublicById(req.auth.userId);
    if (!user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'The account is no longer available.' } });
    return res.json({ user });
  }));
  return router;
}
