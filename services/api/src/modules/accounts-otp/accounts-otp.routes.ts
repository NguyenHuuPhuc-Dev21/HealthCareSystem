/**
 * Routes for accounts-otp, mounted at /api/v1/auth. No business logic here.
 * Contract: docs/api/accounts-otp.api.md
 */
import { Router, type Request } from 'express';
import { UserRole } from '@healthcare-system/shared';
import { asyncHandler, authGuard, bearerToken, validateBody } from '../../core/middleware';
import { badRequest, unauthorized } from '../../core/errors';
import {
  completeRegistrationSchema,
  normalizeVietnamPhone,
  refreshSchema,
  requestOtpSchema,
  twoFactorSetupSchema,
  verifyOtpSchema,
  verifyTwoFactorSchema,
  type CompleteRegistrationBody,
  type RefreshBody,
  type RequestOtpBody,
  type TwoFactorSetupBody,
  type VerifyOtpBody,
  type VerifyTwoFactorBody,
} from './accounts-otp.schema';
import type { AccountsOtpService } from './accounts-otp.service';
import type { RequestContext } from './accounts-otp.types';

function context(req: Request, deviceId?: string): RequestContext {
  return {
    ip: req.ip ?? 'unknown',
    userAgent: req.get('user-agent') ?? undefined,
    ...(deviceId ? { deviceId } : {}),
  };
}

export function createAccountsOtpRouter(service: AccountsOtpService): Router {
  const router = Router();

  router.post(
    '/request-otp',
    validateBody(requestOtpSchema),
    asyncHandler(async (req, res) => {
      const body = req.body as RequestOtpBody;
      res.json({ success: true, data: await service.requestOtp(body.phone, context(req)) });
    }),
  );

  router.post(
    '/verify-otp',
    validateBody(verifyOtpSchema),
    asyncHandler(async (req, res) => {
      const body = req.body as VerifyOtpBody;
      res.json({ success: true, data: await service.verifyOtp(body.phone, body.otp, context(req, body.deviceId)) });
    }),
  );

  router.post(
    '/complete-registration',
    validateBody(completeRegistrationSchema),
    asyncHandler(async (req, res) => {
      const body = req.body as CompleteRegistrationBody;
      const data = await service.completeRegistration(
        body.registrationToken,
        { fullName: body.fullName, role: body.role === 'NURSE' ? UserRole.NURSE : UserRole.PATIENT },
        context(req, body.deviceId),
      );
      res.status(201).json({ success: true, data: { status: 'AUTHENTICATED', ...data } });
    }),
  );

  router.post(
    '/2fa/setup',
    validateBody(twoFactorSetupSchema),
    asyncHandler(async (req, res) => {
      const body = req.body as TwoFactorSetupBody;
      res.json({ success: true, data: await service.setupSecondFactor(body.challengeToken) });
    }),
  );

  router.post(
    '/verify-2fa',
    validateBody(verifyTwoFactorSchema),
    asyncHandler(async (req, res) => {
      const body = req.body as VerifyTwoFactorBody;
      res.json({
        success: true,
        data: await service.verifySecondFactor(body.challengeToken, body.code, context(req, body.deviceId)),
      });
    }),
  );

  router.post(
    '/refresh',
    validateBody(refreshSchema),
    asyncHandler(async (req, res) => {
      const body = req.body as RefreshBody;
      res.json({ success: true, data: await service.sessions.refresh(body.refreshToken, context(req, body.deviceId)) });
    }),
  );

  router.post(
    '/logout',
    authGuard,
    asyncHandler(async (req, res) => {
      const token = bearerToken(req);
      if (!token) throw unauthorized();
      await service.sessions.logout(token);
      res.json({ success: true, data: { loggedOut: true } });
    }),
  );

  router.get(
    '/me',
    authGuard,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.getMe(req.user!.id) });
    }),
  );

  // Dev/staging only: exists when OTP_CHANNEL=mock, which the server refuses in production.
  const inbox = service.mockInbox;
  if (inbox) {
    router.get(
      '/dev/otp-inbox',
      asyncHandler(async (req, res) => {
        if (!inbox.isAuthorized(req.get('x-otp-inbox-key') ?? undefined)) throw unauthorized();
        const raw = req.query.phone;
        const phone = typeof raw === 'string' ? normalizeVietnamPhone(raw) : null;
        if (!phone) throw badRequest('INVALID_PHONE', 'Query parameter "phone" must be a Vietnamese mobile number');
        res.json({ success: true, data: { message: await inbox.latest(phone) } });
      }),
    );
  }

  return router;
}
