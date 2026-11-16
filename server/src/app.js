import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createAuthRouter } from './auth/routes.js';

export function createApp({ clientOrigin = 'http://localhost:5173', pool, jwtSecret } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: clientOrigin, credentials: true }));
  app.use(express.json({ limit: '10kb' }));

  app.get('/api/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  // Dependency injection keeps foundation tests independent of PostgreSQL.
  if (pool) app.use('/api/auth', createAuthRouter({ pool, jwtSecret }));

  app.use((_request, response) => {
    response.status(404).json({ error: {
      code: 'NOT_FOUND', message: 'The requested resource was not found.',
    } });
  });

  app.use((error, _request, response, _next) => {
    if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
      return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Provide a valid JSON request no larger than 10 KB.' } });
    }
    // Never return/log raw driver errors, request bodies, hashes or tokens.
    return response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed. Please try again.' } });
  });
  return app;
}
