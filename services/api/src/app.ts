/**
 * Express application factory (ADR-0003). No listen() here so tests can mount
 * the app in-process. Module routers are added in buildApiRouter() as each
 * phase lands, e.g. `api.use('/auth', accountsOtpRoutes)`.
 */

import express, { Router, type Express } from 'express';
import { checkConnection } from './core/database';
import { errorHandler, notFoundHandler, setTokenVerifier } from './core/middleware';
import { createAccountsOtpRouter } from './modules/accounts-otp/accounts-otp.routes';
import { getAccountsOtpService } from './modules/accounts-otp/accounts-otp.service';

function buildApiRouter(): Router {
  const api = Router();

  // Liveness + DB reachability. No auth, no business data.
  api.get('/health', async (_req, res) => {
    try {
      await checkConnection();
      res.json({ success: true, data: { status: 'ok', database: 'up' } });
    } catch {
      res.status(503).json({ success: false, error: { code: 'DATABASE_UNAVAILABLE', message: 'Database unreachable' } });
    }
  });

  // ---- Module routers (one line per module) ----
  const auth = getAccountsOtpService();
  setTokenVerifier((token) => auth.sessions.verifyAccessToken(token)); // authGuard now works
  api.use('/auth', createAccountsOtpRouter(auth)); // BE-1 · Phase 1 · accounts-otp
  // api.use('/admin/nurses', credentialReviewRouter); // BE-1 · Phase 1

  return api;
}

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // real client IP behind one reverse proxy (needed for rate limits/audit IP)
  app.use(express.json({ limit: '1mb' })); // files never go through the API (presigned uploads)

  app.use(process.env.API_PREFIX ?? '/api/v1', buildApiRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
