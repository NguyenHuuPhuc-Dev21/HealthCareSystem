import { ProfileStatus, NurseTier, UserRole, type SessionData } from '@healthcare-system/shared';
import { resolveAppZone } from '../src/features/auth/AuthContext';

jest.mock('react-native-encrypted-storage', () => ({
  setItem: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {},
  Config: {},
}));

jest.mock('react-native-geolocation-service', () => ({
  getCurrentPosition: jest.fn(),
}));

jest.mock('react-native-permissions', () => ({
  PERMISSIONS: { ANDROID: { ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION' }, IOS: {} },
  RESULTS: { GRANTED: 'granted', LIMITED: 'limited' },
  check: jest.fn().mockResolvedValue('granted'),
  request: jest.fn().mockResolvedValue('granted'),
}));

function makeSession(profileStatus?: ProfileStatus): SessionData {
  return {
    token: 'tok-123',
    user: { id: 'u1', phone: '0902222222', full_name: 'Trần Thị Mai', role: UserRole.NURSE },
    profile: profileStatus
      ? {
          user_id: 'u1',
          tier: NurseTier.TIER_2_SPECIALIST,
          years_of_exp: 5,
          is_retired_medical_staff: false,
          is_online: true,
          trust_score: 100,
          rating_avg: 5,
          profile_status: profileStatus,
          created_at: '2026-11-01T00:00:00Z',
          updated_at: '2026-11-01T00:00:00Z',
        }
      : null,
    credentials: [],
  };
}

describe('resolveAppZone', () => {
  it('returns auth when no session exists', () => {
    expect(resolveAppZone(null)).toBe('auth');
  });

  it('returns onboarding when session has no profile yet', () => {
    expect(resolveAppZone(makeSession(undefined))).toBe('onboarding');
  });

  it('returns pending when profile is PENDING_VERIFICATION', () => {
    expect(resolveAppZone(makeSession(ProfileStatus.PENDING_VERIFICATION))).toBe('pending');
  });

  it('returns locked when profile is SUSPENDED or BANNED', () => {
    expect(resolveAppZone(makeSession(ProfileStatus.SUSPENDED))).toBe('locked');
    expect(resolveAppZone(makeSession(ProfileStatus.BANNED))).toBe('locked');
  });

  it('returns active when profile is ACTIVE', () => {
    expect(resolveAppZone(makeSession(ProfileStatus.ACTIVE))).toBe('active');
  });
});

