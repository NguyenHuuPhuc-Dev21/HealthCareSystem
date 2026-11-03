import { describe, expect, it } from 'vitest';
import { UserRole } from '@healthcare-system/shared';
import { haversineDistanceMeters } from '@healthcare-system/shared';
import { AppError } from '../../src/core/errors';
import { authGuard, errorHandler, roleGuard, setTokenVerifier } from '../../src/core/middleware';

function run(mw: (req: any, res: any, next: (err?: unknown) => void) => unknown, req: any): Promise<unknown> {
  return new Promise((resolve) => {
    void mw(req, {}, (err?: unknown) => resolve(err));
  });
}

function fakeRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (s: number) => ((res.statusCode = s), res);
  res.json = (b: unknown) => ((res.body = b), res);
  return res;
}

describe('authGuard', () => {
  it('fails closed with 401 when no verifier is registered (Phase 0)', async () => {
    const err = (await run(authGuard, { headers: { authorization: 'Bearer anything' } })) as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(401);
  });

  it('rejects a missing header and accepts a verified token', async () => {
    setTokenVerifier(async (t) => (t === 'good' ? { id: 'u1', role: UserRole.PATIENT } : null));
    expect(((await run(authGuard, { headers: {} })) as AppError).status).toBe(401);
    expect(((await run(authGuard, { headers: { authorization: 'Bearer bad' } })) as AppError).status).toBe(401);

    const req: any = { headers: { authorization: 'Bearer good' } };
    expect(await run(authGuard, req)).toBeUndefined();
    expect(req.user).toEqual({ id: 'u1', role: UserRole.PATIENT });
  });
});

describe('roleGuard', () => {
  it('returns 403 for the wrong role', async () => {
    const err = (await run(roleGuard([UserRole.ADMIN]), { user: { id: 'u', role: UserRole.NURSE } })) as AppError;
    expect(err.status).toBe(403);
    expect(await run(roleGuard([UserRole.ADMIN]), { user: { id: 'u', role: UserRole.ADMIN } })).toBeUndefined();
  });
});

describe('errorHandler', () => {
  it('maps AppError to its status and code', () => {
    const res = fakeRes();
    errorHandler(new AppError(403, 'TIER_INSUFFICIENT', 'nope'), {} as any, res, () => undefined);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ success: false, error: { code: 'TIER_INSUFFICIENT', message: 'nope' } });
  });

  it('hides internal error messages behind a generic 500', () => {
    const res = fakeRes();
    const original = console.error;
    console.error = () => undefined;
    try {
      errorHandler(new Error('password=hunter2 leaked'), {} as any, res, () => undefined);
    } finally {
      console.error = original;
    }
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
  });

  it('maps malformed JSON to 400 INVALID_JSON', () => {
    const res = fakeRes();
    errorHandler({ type: 'entity.parse.failed', status: 400 }, {} as any, res, () => undefined);
    expect(res.statusCode).toBe(400);
    expect((res.body as any).error.code).toBe('INVALID_JSON');
  });
});

describe('haversineDistanceMeters (shared/geo)', () => {
  it('is 0 for the same point and ~111.2 km per degree of latitude', () => {
    expect(haversineDistanceMeters(10.77, 106.7, 10.77, 106.7)).toBe(0);
    expect(haversineDistanceMeters(0, 0, 1, 0)).toBeCloseTo(111_195, -1);
  });
  it('rejects invalid coordinates', () => {
    expect(() => haversineDistanceMeters(NaN, 0, 0, 0)).toThrow();
    expect(() => haversineDistanceMeters(91, 0, 0, 0)).toThrow();
  });
});
