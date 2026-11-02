/**
 * Core Middlewares (Auth Guard, Role & Tier Authorization, Error Handler)
 */

export interface AuthenticatedUser {
  id: string;
  role: 'PATIENT' | 'NURSE' | 'ADMIN';
  tier?: 'TIER_1_BASIC' | 'TIER_2_SPECIALIST';
  profile_status?: string;
}

export function authGuard(req: any, res: any, next: any) {
  const authHeader = req.headers?.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Bearer token required' },
    });
  }
  // JWT verification stub
  req.user = { id: 'usr_mock', role: 'PATIENT' } as AuthenticatedUser;
  next();
}

export function roleGuard(allowedRoles: Array<'PATIENT' | 'NURSE' | 'ADMIN'>) {
  return (req: any, res: any, next: any) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient role permission' },
      });
    }
    next();
  };
}

export function tierGuard(requiredTier: 'TIER_1_BASIC' | 'TIER_2_SPECIALIST') {
  return (req: any, res: any, next: any) => {
    if (requiredTier === 'TIER_2_SPECIALIST' && req.user?.tier !== 'TIER_2_SPECIALIST') {
      return res.status(403).json({
        success: false,
        error: { code: 'TIER_INSUFFICIENT', message: 'Invasive procedures strictly require TIER_2_SPECIALIST license' },
      });
    }
    next();
  };
}

export function errorHandler(err: any, req: any, res: any, next: any) {
  console.error('[Error]', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred',
    },
  });
}

