import {
  UserRole,
  type SessionData,
} from '@healthcare-system/shared';
import {
  completeRegistration,
  isValidVietnamesePhone,
  logoutServer,
  normalizePhoneNumber,
  requestOtp,
  verifyOtp,
} from '../src/features/auth/auth.api';
import { loadSession, saveSession } from '../src/lib/storage';

process.env.USE_MOCK_AUTH = 'true';

jest.mock('react-native-encrypted-storage', () => {
  const store = new Map<string, string>();
  return {
    setItem: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItem: jest.fn(async (key: string) => {
      return store.get(key) || null;
    }),
    removeItem: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    clear: jest.fn(async () => {
      store.clear();
    }),
  };
});

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: { USE_MOCK_AUTH: 'true' },
  Config: { USE_MOCK_AUTH: 'true' },
}));

describe('Auth OTP Flow (FR-AUTH-01 / A01)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await saveSession(null);
  });

  describe('Phone number normalization and validation', () => {
    it('normalizes valid phone formats to 10 digits starting with 0', () => {
      expect(normalizePhoneNumber('0905 123 456')).toBe('0905123456');
      expect(normalizePhoneNumber('+84905123456')).toBe('0905123456');
      expect(normalizePhoneNumber('+84 905.123.456')).toBe('0905123456');
      expect(normalizePhoneNumber('038-123-4567')).toBe('0381234567');
    });

    it('validates Vietnamese mobile numbers correctly', () => {
      expect(isValidVietnamesePhone('0905123456')).toBe(true);
      expect(isValidVietnamesePhone('0381234567')).toBe(true);
      expect(isValidVietnamesePhone('0771234567')).toBe(true);
      expect(isValidVietnamesePhone('0831234567')).toBe(true);
      expect(isValidVietnamesePhone('0561234567')).toBe(true);

      // Invalid cases
      expect(isValidVietnamesePhone('090512345')).toBe(false); // 9 digits
      expect(isValidVietnamesePhone('09051234567')).toBe(false); // 11 digits
      expect(isValidVietnamesePhone('1234567890')).toBe(false); // doesn't start with 0
      expect(isValidVietnamesePhone('0123456789')).toBe(false); // invalid prefix 01
      expect(isValidVietnamesePhone('abcdefghij')).toBe(false); // letters
    });
  });

  describe('requestOtp API', () => {
    it('requests OTP and returns requestId and resend countdown', async () => {
      const res = await requestOtp('0902222222');
      expect(res.success).toBe(true);
      expect(res.data.requestId).toBeDefined();
      expect(res.data.resendAfterSeconds).toBeGreaterThan(0);
      expect(res.data.devOtp).toBe('123456');
    });
  });

  describe('verifyOtp with 3 VerifyOutcome branches', () => {
    it('returns AUTHENTICATED when phone is registered and OTP is correct', async () => {
      const res = await verifyOtp('0902222222', '123456');

      expect(res.success).toBe(true);
      expect(res.data.status).toBe('AUTHENTICATED');
      if (res.data.status === 'AUTHENTICATED') {
        expect(res.data.session.user.phone).toBe('0902222222');
        expect(res.data.session.user.role).toBe(UserRole.NURSE);
        expect(res.data.session.token).toBeDefined();
        expect(res.data.session.profile?.profile_status).toBe('ACTIVE');
      }
    });

    it('returns REGISTRATION_REQUIRED when phone is new and OTP is correct', async () => {
      const newPhone = '0908888888';
      const res = await verifyOtp(newPhone, '123456');

      expect(res.success).toBe(true);
      expect(res.data.status).toBe('REGISTRATION_REQUIRED');
      if (res.data.status === 'REGISTRATION_REQUIRED') {
        expect(res.data.registrationToken).toBeDefined();
        expect(res.data.registrationToken.length).toBeGreaterThan(0);
      }
    });

    it('returns error when OTP is incorrect', async () => {
      const res = await verifyOtp('0902222222', '999999');

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('OTP_INVALID_OR_EXPIRED');
    });
  });

  describe('completeRegistration for new nurse', () => {
    it('creates a new session with profile=null (directing to onboarding)', async () => {
      const newPhone = '0909123456';
      const verifyRes = await verifyOtp(newPhone, '123456');
      expect(verifyRes.success).toBe(true);
      expect(verifyRes.data.status).toBe('REGISTRATION_REQUIRED');

      if (verifyRes.data.status === 'REGISTRATION_REQUIRED') {
        const token = verifyRes.data.registrationToken;
        const regRes = await completeRegistration(token, 'Nguyễn Văn An');

        expect(regRes.success).toBe(true);
        expect(regRes.data.user.full_name).toBe('Nguyễn Văn An');
        expect(regRes.data.user.phone).toBe(newPhone);
        expect(regRes.data.profile).toBeNull();
      }
    });
  });

  describe('Session persistence and logout', () => {
    it('saves session to storage and clears session on logout', async () => {
      const mockSession: SessionData = {
        token: 'test-token-123',
        refreshToken: 'test-refresh-123',
        user: { id: 'u1', phone: '0902222222', full_name: 'Trần Thị Mai', role: UserRole.NURSE },
        profile: null,
        credentials: [],
      };

      await saveSession(mockSession);
      const loaded = await loadSession();
      expect(loaded).toEqual(mockSession);

      await logoutServer('test-refresh-123');
      await saveSession(null);

      const empty = await loadSession();
      expect(empty).toBeNull();
    });
  });
});
