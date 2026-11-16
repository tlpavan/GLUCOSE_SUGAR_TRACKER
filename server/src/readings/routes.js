import { Router } from 'express';
import { requireAuthentication } from '../auth/middleware.js';
import { createTokenService } from '../auth/tokens.js';
import { createUserRepository } from '../auth/repository.js';
import { createReadingRepository } from './repository.js';
import { dateInTimeZone, readingIdSchema, readingSchemas, validationError } from './validation.js';

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const notFound = { error: { code: 'NOT_FOUND', message: 'Reading not found.' } };

export function createReadingsRouter({ pool, jwtSecret, timeZone, now }) {
  const router = Router();
  const readings = createReadingRepository(pool);
  const users = createUserRepository(pool);
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(requireAuthentication(createTokenService(jwtSecret)));
  router.use(asyncRoute(async (req, res, next) => {
    // A previously issued token must not revive a deleted account.
    if (!await users.findPublicById(req.auth.userId)) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'The account is no longer available.' } });
    }
    next();
  }));

  const validate = (kind) => (req, res, next) => {
    const schemas = readingSchemas(dateInTimeZone(now(), timeZone));
    const parsed = schemas[kind].safeParse(kind === 'body' ? req.body : req.query);
    if (!parsed.success) return res.status(400).json({ error: validationError(parsed.error) });
    req.readingInput = parsed.data;
    next();
  };
  const validateId = (req, res, next) => {
    if (!readingIdSchema.safeParse(req.params.id).success) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid reading ID.', fields: { id: 'Use a positive integer reading ID.' } } });
    }
    next();
  };

  router.post('/', validate('body'), asyncRoute(async (req, res) => {
    const reading = await readings.create(req.auth.userId, req.readingInput);
    res.status(201).json({ reading });
  }));
  router.get('/', validate('query'), asyncRoute(async (req, res) => {
    res.json({ readings: await readings.list(req.auth.userId, req.readingInput.date) });
  }));
  router.put('/:id', validateId, validate('body'), asyncRoute(async (req, res) => {
    const reading = await readings.update(req.auth.userId, req.params.id, req.readingInput);
    if (!reading) return res.status(404).json(notFound);
    res.json({ reading });
  }));
  router.delete('/:id', validateId, asyncRoute(async (req, res) => {
    if (!await readings.remove(req.auth.userId, req.params.id)) return res.status(404).json(notFound);
    res.status(204).end();
  }));

  router.use((error, _req, res, next) => {
    // Let the database arbitrate uniqueness atomically, including concurrent requests.
    if (error.code === '23505' && error.constraint === 'readings_user_date_slot_unique') {
      return res.status(409).json({ error: {
        code: 'READING_EXISTS', message: 'A reading already exists for this date and slot.',
        fields: { slot: 'Choose an unused slot or edit the existing reading.' },
      } });
    }
    next(error);
  });
  return router;
}
