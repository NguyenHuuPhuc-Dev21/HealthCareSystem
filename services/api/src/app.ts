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
import { createCredentialReviewRouter } from './modules/credential-review/credential-review.routes';
import { getCredentialReviewService } from './modules/credential-review/credential-review.service';
import { createNurseOnboardingRouter } from './modules/nurse-onboarding/nurse-onboarding.routes';
import { getNurseOnboardingService } from './modules/nurse-onboarding/nurse-onboarding.service';
import { createNurseSearchRouter } from './modules/nurse-search/nurse-search.routes';
import { getNurseSearchService } from './modules/nurse-search/nurse-search.service';
import { createGatewayWebhooksRouter } from './modules/gateway-webhooks/gateway-webhooks.routes';
import { getGatewayWebhooksService } from './modules/gateway-webhooks/gateway-webhooks.service';
import { createJobBoardRouter } from './modules/job-board/job-board.routes';
import { getJobBoardService } from './modules/job-board/job-board.service';
import { createBookingsRouter } from './modules/bookings/bookings.routes';
import { getBookingsService } from './modules/bookings/bookings.service';
import { createMatchingRadarRouter } from './modules/matching-radar/matching-radar.routes';
import { getMatchingRadarService } from './modules/matching-radar/matching-radar.service';
import { createNurseAvailabilitiesRouter } from './modules/nurse-availabilities/nurse-availabilities.routes';
import { getNurseAvailabilitiesService } from './modules/nurse-availabilities/nurse-availabilities.service';
import { createPatientProfilesRouter } from './modules/patient-profiles/patient-profiles.routes';
import { getPatientProfilesService } from './modules/patient-profiles/patient-profiles.service';
import { createPrescriptionGateRouter } from './modules/prescription-gate/prescription-gate.routes';
import { createPrescriptionRejectionRouter } from './modules/prescription-rejection/prescription-rejection.routes';
import { createShiftExtendRouter } from './modules/shift-extend/shift-extend.routes';
import { createCancellationPolicyRouter } from './modules/cancellation-policy/cancellation-policy.routes';
import { getCancellationPolicyService } from './modules/cancellation-policy/cancellation-policy.service';
import { getShiftExtendService } from './modules/shift-extend/shift-extend.service';
import { createReviewsRouter } from './modules/reviews-trustscore/reviews-trustscore.routes';
import { getReviewsService } from './modules/reviews-trustscore/reviews-trustscore.service';
import { createWalletsLedgerRouter } from './modules/wallets-ledger/wallets-ledger.routes';
import { getWalletsLedgerService } from './modules/wallets-ledger/wallets-ledger.service';
import { createDepositsRouter } from './modules/deposits/deposits.routes';
import { getDepositsService } from './modules/deposits/deposits.service';
import { createSettlementsRouter } from './modules/settlements/settlements.routes';
import { getSettlementsService } from './modules/settlements/settlements.service';
import { createWithdrawalsRouter } from './modules/withdrawals/withdrawals.routes';
import { getWithdrawalsService } from './modules/withdrawals/withdrawals.service';
import { createCashCommissionRouter } from './modules/cash-commission/cash-commission.routes';
import { getCashCommissionService } from './modules/cash-commission/cash-commission.service';
import { createDisputesRouter } from './modules/disputes/disputes.routes';
import { getDisputesService } from './modules/disputes/disputes.service';
import { createNotificationsRouter } from './modules/notifications/notifications.routes';
import { getNotificationsService } from './modules/notifications/notifications.service';
import { createAdminFinanceRouter } from './modules/admin-finance/admin-finance.routes';
import { getAdminFinanceService } from './modules/admin-finance/admin-finance.service';
import { getPrescriptionRejectionService } from './modules/prescription-rejection/prescription-rejection.service';
import { getPrescriptionGateService } from './modules/prescription-gate/prescription-gate.service';
import { createPrivacyConsentRouter } from './modules/privacy-consent/privacy-consent.routes';
import { getPrivacyConsentService } from './modules/privacy-consent/privacy-consent.service';
import { createCheckInRouter } from './modules/check-in/check-in.routes';
import { getCheckInService } from './modules/check-in/check-in.service';
import { createShiftLogsRouter } from './modules/shift-logs/shift-logs.routes';
import { getShiftLogsService } from './modules/shift-logs/shift-logs.service';
import { createCheckOutRouter } from './modules/check-out/check-out.routes';
import { createChatRouter } from './modules/chat/chat.routes';
import { createAdminUsersRouter } from './modules/admin-users/admin-users.routes';
import { getAdminUsersService } from './modules/admin-users/admin-users.service';
import { getChatService } from './modules/chat/chat.service';
import { getCheckOutService } from './modules/check-out/check-out.service';

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
  api.use(createNurseOnboardingRouter(getNurseOnboardingService())); // BE-1 · Phase 1 · nurse-onboarding
  api.use(createCredentialReviewRouter(getCredentialReviewService())); // BE-1 · Phase 1 · credential-review
  api.use(createPrivacyConsentRouter(getPrivacyConsentService())); // BE-3 · Phase 1 · privacy-consent
  api.use(createPatientProfilesRouter(getPatientProfilesService())); // BE-2 · Phase 1 · patient-profiles
  api.use(createNurseAvailabilitiesRouter(getNurseAvailabilitiesService())); // BE-2 · Phase 2 · nurse-availabilities
  api.use(createNurseSearchRouter(getNurseSearchService())); // BE-3 · Phase 2 · nurse-search
  api.use(createBookingsRouter(getBookingsService())); // BE-2 · Phase 3 · bookings + pricing-engine
  api.use(createMatchingRadarRouter(getMatchingRadarService())); // BE-2 · Phase 3 · matching-radar
  api.use(createGatewayWebhooksRouter(getGatewayWebhooksService())); // BE-3 · Phase 3 · gateway-webhooks (escrow webhook, payment link)
  api.use(createJobBoardRouter(getJobBoardService())); // BE-3 · Phase 3 · job-board (board, direct requests)
  api.use(createPrescriptionGateRouter(getPrescriptionGateService())); // BE-1 · Phase 3 · prescription-gate
  api.use(createPrescriptionRejectionRouter(getPrescriptionRejectionService())); // BE-1 · Phase 4 · prescription-rejection
  api.use(createShiftExtendRouter(getShiftExtendService())); // BE-1 · Phase 4 · shift-extend
  api.use(createCheckInRouter(getCheckInService())); // BE-2 · Phase 4 · check-in (anti mock GPS, ≤ 200 m, live selfie)
  api.use(createShiftLogsRouter(getShiftLogsService())); // BE-2 · Phase 4 · shift-logs (assessment, vitals, checklist, tracking)
  api.use(createCheckOutRouter(getCheckOutService())); // BE-2 · Phase 4 · check-out (care report, 24h/12h clocks)
  api.use(createChatRouter(getChatService())); // BE-2 · Phase 6 · chat (masked in-app chat & call logs, FR-CHAT-01)
  api.use(createAdminUsersRouter(getAdminUsersService())); // BE-2 · Phase 7 · admin-users (search, lock / unlock accounts, FR-ADMIN-01)
  api.use(createCancellationPolicyRouter(getCancellationPolicyService())); // BE-1 · Phase 5 · cancellation-policy
  api.use(createReviewsRouter(getReviewsService())); // BE-1 · Phase 6 · reviews-trustscore
  api.use(createWalletsLedgerRouter(getWalletsLedgerService())); // BE-3 · Phase 5 · wallets-ledger (balances, history, earnings, upcoming settlements)
  api.use(createDepositsRouter(getDepositsService())); // BE-3 · Phase 5 · deposits (ADR-0004: top-up, penalties, appeal, closure refund, bank account)
  api.use(createSettlementsRouter(getSettlementsService())); // BE-3 · Phase 5 · settlements (85/15 payout, customer confirm-completion)
  api.use(createWithdrawalsRouter(getWithdrawalsService())); // BE-3 · Phase 5 · withdrawals (FR-PAY-04)
  api.use(createCashCommissionRouter(getCashCommissionService())); // BE-3 · Phase 5 · cash-commission (FR-PAY-02 cash part)
  api.use(createDisputesRouter(getDisputesService())); // BE-3 · Phase 6 · disputes (open/freeze, rebuttal, admin resolve, penalty appeals)
  api.use(createNotificationsRouter(getNotificationsService())); // BE-3 · Phase 6 · notifications (in-app centre; WebSocket in index.ts)
  api.use(createAdminFinanceRouter(getAdminFinanceService())); // BE-3 · Phase 7 · admin-finance (CT-15 reconciliation, ledger export, finance queues)

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
