/**
 * Core Middlewares (owners: BE-1, BE-2, BE-3) — Express (ADR-0003)
 *
 * - authGuard: FAILS CLOSED. Until Phase 1 (accounts-otp) registers a real
 *   token verifier with setTokenVerifier(), every protected route returns 401.
 *   The old stub that turned any "Bearer x" into a PATIENT is removed.
 * - roleGuard: checks the role carried by the verified token.
 * - requireNurseEligibility: reads nurse_profiles FROM THE DATABASE on every
 *   call. Tier and profile_status are NEVER trusted from the token, because the
 *   GPHN sweep can demote a nurse while their token is still valid
 *   (profile_status is the single source of truth).
 * - validateBody: Zod whitelist validation (unknown fields rejected).
 * - errorHandler / notFoundHandler: the shared JSON error envelope.
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z, ZodError } from 'zod';
import { NurseTier, ProfileStatus, UserRole } from '@healthcare-system/shared';
import { query } from '../database';
import { AppError, badRequest, forbidden, unauthorized } from '../errors';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
    nurse?: { tier: NurseTier; profileStatus: ProfileStatus };
  }
}

/** Verifies a bearer token and returns the user, or null if invalid/expired. */
export type TokenVerifier = (token: string) => Promise<AuthenticatedUser | null>;

let tokenVerifier: TokenVerifier | null = null;

/** Called once by accounts-otp (Phase 1) at startup. */
export function setTokenVerifier(verifier: TokenVerifier): void {
  tokenVerifier = verifier;
}

export const authGuard: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) throw unauthorized('Bearer token required');
    if (!tokenVerifier) throw unauthorized('Authentication is not configured');
    const user = await tokenVerifier(header.slice('Bearer '.length).trim());
    if (!user) throw unauthorized('Invalid or expired token');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

export function roleGuard(allowedRoles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!allowedRoles.includes(req.user.role)) {
      return next(forbidden('FORBIDDEN', 'Insufficient role permission'));
    }
    next();
  };
}

const TIER_RANK: Record<NurseTier, number> = {
  [NurseTier.TIER_1_BASIC]: 1,
  [NurseTier.TIER_2_SPECIALIST]: 2,
};

/**
 * Nurse-only gate: profile_status must be ACTIVE and tier ≥ requiredTier,
 * both read fresh from nurse_profiles. Attaches req.nurse for the handler.
 * Deposit and availability checks stay in the business modules (they need
 * the booking context), but they must re-check inside the accept transaction.
 */
export function requireNurseEligibility(requiredTier: NurseTier = NurseTier.TIER_1_BASIC): RequestHandler {
  return async (req, _res, next) => {
    try {
      if (!req.user) throw unauthorized();
      if (req.user.role !== UserRole.NURSE) throw forbidden('FORBIDDEN', 'Nurse account required');
      const { rows } = await query<{ tier: NurseTier; profile_status: ProfileStatus }>(
        'SELECT tier, profile_status FROM nurse_profiles WHERE user_id = $1',
        [req.user.id],
      );
      const profile = rows[0];
      if (!profile) throw forbidden('NURSE_PROFILE_NOT_FOUND', 'Nurse profile not found');
      if (profile.profile_status !== ProfileStatus.ACTIVE) {
        throw forbidden('PROFILE_NOT_ACTIVE', `Nurse profile is ${profile.profile_status}`);
      }
      if (TIER_RANK[profile.tier] < TIER_RANK[requiredTier]) {
        throw forbidden('TIER_INSUFFICIENT', `This action requires ${requiredTier}`);
      }
      req.nurse = { tier: profile.tier, profileStatus: profile.profile_status };
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Wraps an async route handler so a rejected promise reaches errorHandler
 * (Express 4 does not do this by itself — ADR-0003).
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

/** Reads the raw bearer token (for logout); null when absent. */
export function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  return header && header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;
}

/** Validates and REPLACES req.body with the parsed value (strict schemas drop nothing silently). */
export function validateBody<S extends z.ZodTypeAny>(schema: S): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return next(badRequest('VALIDATION_ERROR', 'Request body is invalid', parsed.error.flatten()));
    }
    req.body = parsed.data;
    next();
  };
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
};

// Express recognises error handlers by their 4 parameters — keep `_next`.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) },
    });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: err.flatten() } });
    return;
  }
  // body-parser errors (malformed JSON → 400, body too large → 413 …)
  const bp = err as { type?: string; status?: number };
  if (typeof err === 'object' && err !== null && typeof bp.type === 'string' && bp.status && bp.status >= 400 && bp.status < 500) {
    const code = bp.type === 'entity.parse.failed' ? 'INVALID_JSON' : bp.type.toUpperCase().replace(/[.\s]/g, '_');
    res.status(bp.status).json({ success: false, error: { code, message: 'Invalid request body' } });
    return;
  }
  // Unknown error: log the detail server-side, never leak it to the client.
  console.error('[Error]', err);
  res.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } });
}
