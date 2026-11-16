import { Router } from 'express';
import { requireAuthentication } from '../auth/middleware.js';
import { createTokenService } from '../auth/tokens.js';
import { createUserRepository } from '../auth/repository.js';
import { READING_SLOTS } from '../domain/reading-slots.js';
import { dateInTimeZone, readingSchemas, validationError } from '../readings/validation.js';
import { reportRange } from './ranges.js';
import { createReportRepository } from './repository.js';

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

export function createReportsRouter({ pool, jwtSecret, timeZone, now }) {
  const router = Router();
  const users = createUserRepository(pool);
  const reports = createReportRepository(pool);
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(requireAuthentication(createTokenService(jwtSecret)));
  router.use(asyncRoute(async (req, res, next) => {
    if (!await users.findPublicById(req.auth.userId)) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'The account is no longer available.' } });
    }
    next();
  }));

  for (const type of ['daily', 'month-to-date', 'previous-month']) {
    router.get(`/${type}`, asyncRoute(async (req, res) => {
      const parsed = readingSchemas(dateInTimeZone(now(), timeZone)).query.safeParse(req.query);
      if (!parsed.success) {
        const error = validationError(parsed.error);
        if (error.fields.request) error.fields.request = 'Only the date query parameter is accepted.';
        return res.status(400).json({ error });
      }
      // The preceding month of January 0001 cannot be represented by our date-only contract.
      if (type === 'previous-month' && parsed.data.date.startsWith('0001-01-')) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', fields: { date: 'Select February 0001 or later for a previous-month report.' } } });
      }
      const range = reportRange(type, parsed.data.date);
      const report = await reports.summarize(req.auth.userId, range);
      const body = { range, ...report };
      if (type === 'daily') {
        body.slots = READING_SLOTS.map((slot) => ({ slot, reading: report.readings.find((reading) => reading.slot === slot) ?? null }));
      }
      res.json(body);
    }));
  }
  return router;
}
