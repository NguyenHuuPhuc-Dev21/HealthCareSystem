import {
  DocType,
  NurseTier,
  ProfileStatus,
  UserRole,
  VerificationStatus,
  type SessionData,
} from '@healthcare-system/shared';
import {
  calculateGphnDaysRemaining,
  getGphnAlertInfo,
  getMyCredentials,
  mockAdminApproveGphn,
  uploadRenewedGphn,
} from '../src/features/credentials/credentials.api';
import {
  mockGetAccount,
  mockSaveProfile,
  mockUpdateAccount,
} from '../src/features/auth/auth.mock';
import { mockSetGphnExpiryForTesting } from '../src/features/credentials/credentials.mock';
import { saveSession } from '../src/lib/storage';

process.env.USE_MOCK_AUTH = 'true';
process.env.USE_MOCK_ONBOARDING = 'true';
process.env.USE_MOCK_CREDENTIALS = 'true';

const mockStorageMap = new Map<string, string>();

jest.mock('react-native-encrypted-storage', () => ({
  setItem: jest.fn(async (key: string, value: string) => {
    mockStorageMap.set(key, value);
  }),
  getItem: jest.fn(async (key: string) => {
    return mockStorageMap.get(key) || null;
  }),
  removeItem: jest.fn(async (key: string) => {
    mockStorageMap.delete(key);
  }),
  clear: jest.fn(async () => {
    mockStorageMap.clear();
  }),
}));

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: { USE_MOCK_AUTH: 'true', USE_MOCK_ONBOARDING: 'true', USE_MOCK_CREDENTIALS: 'true' },
  Config: { USE_MOCK_AUTH: 'true', USE_MOCK_ONBOARDING: 'true', USE_MOCK_CREDENTIALS: 'true' },
}));

describe('A03 — Credentials & GPHN Lifecycle (nurse-app)', () => {
  const testPhone = '0908888888';
  const testUserId = 'nurse-test-888';

  beforeEach(async () => {
    jest.clearAllMocks();
    mockStorageMap.clear();

    const session: SessionData = {
      token: 'mock-token-test',
      user: {
        id: testUserId,
        phone: testPhone,
        full_name: 'Trần Thị Mai',
        role: UserRole.NURSE,
      },
      profile: {
        user_id: testUserId,
        tier: NurseTier.TIER_2_SPECIALIST,
        gphn_number: '00123/GPHN-ĐN',
        gphn_expiry_date: '2027-04-12',
        scope_of_practice: 'Điều dưỡng đa khoa',
        years_of_exp: 8,
        is_retired_medical_staff: false,
        is_online: true,
        trust_score: 95,
        rating_avg: 4.9,
        profile_status: ProfileStatus.ACTIVE,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      credentials: [
        {
          id: 'cred-cccd-1',
          nurse_id: testUserId,
          doc_type: DocType.CCCD,
          file_url: 'mock://cccd.jpg',
          verification_status: VerificationStatus.APPROVED,
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'cred-degree-1',
          nurse_id: testUserId,
          doc_type: DocType.DEGREE,
          file_url: 'mock://degree.jpg',
          verification_status: VerificationStatus.APPROVED,
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'cred-gphn-1',
          nurse_id: testUserId,
          doc_type: DocType.GPHN,
          file_url: 'mock://gphn.jpg',
          verification_status: VerificationStatus.APPROVED,
          expiry_date: '2027-04-12',
          issued_date: '2022-04-12',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    };

    await saveSession(session);
    mockSaveProfile(testPhone, session.profile!, session.credentials, session.user);
  });

  describe('1. calculateGphnDaysRemaining', () => {
    it('returns null when expiryDate is empty or malformed', () => {
      expect(calculateGphnDaysRemaining(null)).toBeNull();
      expect(calculateGphnDaysRemaining(undefined)).toBeNull();
      expect(calculateGphnDaysRemaining('')).toBeNull();
      expect(calculateGphnDaysRemaining('invalid-date')).toBeNull();
    });

    it('calculates exact positive days remaining relative to reference date', () => {
      const ref = new Date('2026-11-01T08:00:00Z');
      expect(calculateGphnDaysRemaining('2026-11-21', ref)).toBe(20);
      expect(calculateGphnDaysRemaining('2026-12-16', ref)).toBe(45);
    });

    it('returns 0 for expiry on the exact reference date', () => {
      const ref = new Date('2026-11-01T14:30:00Z');
      expect(calculateGphnDaysRemaining('2026-11-01', ref)).toBe(0);
    });

    it('returns negative days for already expired GPHN', () => {
      const ref = new Date('2026-11-01T08:00:00Z');
      expect(calculateGphnDaysRemaining('2026-10-31', ref)).toBe(-1);
      expect(calculateGphnDaysRemaining('2026-10-15', ref)).toBe(-17);
    });
  });

  describe('2. getGphnAlertInfo (Warning levels and UI tones)', () => {
    it('returns PENDING with amber tone when GPHN renewal is awaiting review', () => {
      const info = getGphnAlertInfo('2027-04-12', true);
      expect(info.status).toBe('PENDING');
      expect(info.tone).toBe('amber');
      expect(info.label).toContain('đang chờ duyệt');
      expect(info.actionRequired).toBe(false);
    });

    it('returns EXPIRED with crimson tone and downgrade message when days <= 0 (FR-AUTH-02)', () => {
      const ref = new Date('2026-11-01T00:00:00Z');
      const info = getGphnAlertInfo('2026-10-25', false, ref);
      expect(info.status).toBe('EXPIRED');
      expect(info.tone).toBe('crimson');
      expect(info.label).toBe('GPHN đã hết hạn');
      expect(info.description).toContain('hạ về Tầng 1');
      expect(info.actionRequired).toBe(true);
    });

    it('returns EXPIRING_SOON with amber tone when 0 < days <= 30', () => {
      const ref = new Date('2026-11-01T00:00:00Z');
      const info = getGphnAlertInfo('2026-11-21', false, ref); // 20 days remaining
      expect(info.status).toBe('EXPIRING_SOON');
      expect(info.tone).toBe('amber');
      expect(info.label).toBe('GPHN còn 20 ngày');
      expect(info.actionRequired).toBe(true);
    });

    it('returns VALID with jade tone when days > 30', () => {
      const ref = new Date('2026-11-01T00:00:00Z');
      const info = getGphnAlertInfo('2027-05-01', false, ref);
      expect(info.status).toBe('VALID');
      expect(info.tone).toBe('jade');
      expect(info.label).toContain('Còn hiệu lực');
      expect(info.actionRequired).toBe(false);
    });
  });

  describe('3. getMyCredentials', () => {
    it('fetches credentials successfully from nurse profile', async () => {
      const res = await getMyCredentials();
      expect(res.success).toBe(true);
      expect(res.data.length).toBe(3);
      expect(res.data.some((c) => c.doc_type === DocType.GPHN)).toBe(true);
      expect(res.data.some((c) => c.doc_type === DocType.CCCD)).toBe(true);
      expect(res.data.some((c) => c.doc_type === DocType.DEGREE)).toBe(true);
    });
  });

  describe('4. uploadRenewedGphn (FR-AUTH-01)', () => {
    it('rejects upload when expiryDate is in the past or today', async () => {
      const res = await uploadRenewedGphn({
        fileUri: 'file:///photo-new-gphn.jpg',
        number: '00999/GPHN-ĐN',
        issuedDate: '2020-01-01',
        expiryDate: '2026-01-01', // Past date
        issuingAuthority: 'Sở Y tế TP. Đà Nẵng',
        scopeOfPractice: 'Điều dưỡng đa khoa',
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('GPHN_EXPIRED');
    });

    it('rejects upload when expiryDate is before or equal to issuedDate', async () => {
      const res = await uploadRenewedGphn({
        fileUri: 'file:///photo-new-gphn.jpg',
        number: '00999/GPHN-ĐN',
        issuedDate: '2028-05-10',
        expiryDate: '2028-05-01', // Expiry before issued
        issuingAuthority: 'Sở Y tế TP. Đà Nẵng',
        scopeOfPractice: 'Điều dưỡng đa khoa',
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('INVALID_DATE_ORDER');
    });

    it('creates a new GPHN with PENDING status while keeping current tier', async () => {
      const res = await uploadRenewedGphn({
        fileUri: 'file:///photo-new-gphn.jpg',
        number: '00999/GPHN-ĐN',
        issuedDate: '2026-10-01',
        expiryDate: '2031-10-01',
        issuingAuthority: 'Sở Y tế TP. Đà Nẵng',
        scopeOfPractice: 'Điều dưỡng đa khoa',
      });

      expect(res.success).toBe(true);
      expect(res.data.credential.doc_type).toBe(DocType.GPHN);
      expect(res.data.credential.verification_status).toBe(VerificationStatus.PENDING);
      expect(res.data.credential.expiry_date).toBe('2031-10-01');

      // Verify in credential list
      const credsRes = await getMyCredentials();
      const pending = credsRes.data.find(
        (c) => c.doc_type === DocType.GPHN && c.verification_status === VerificationStatus.PENDING
      );
      expect(pending).toBeDefined();
    });
  });

  describe('5. Exit Criteria Phase 1 Lifecycle: Expired -> Downgrade Tier 1 -> Renew PENDING -> Approve -> Restore Tier 2', () => {
    it('executes full lifecycle flow on nurse app', async () => {
      // Step A: Nurse starts as Tier 2 Specialist
      let account = mockGetAccount(testPhone);
      expect(account?.profile?.tier).toBe(NurseTier.TIER_2_SPECIALIST);

      // Step B: GPHN expires -> nurse is downgraded to TIER_1_BASIC (FR-AUTH-02)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const expiredDateStr = yesterday.toISOString().slice(0, 10);

      const downgradedProfile = mockSetGphnExpiryForTesting(testPhone, expiredDateStr, true);
      expect(downgradedProfile?.tier).toBe(NurseTier.TIER_1_BASIC);

      // Verify alert info triggers EXPIRED red alert
      const expiredAlert = getGphnAlertInfo(expiredDateStr, false);
      expect(expiredAlert.status).toBe('EXPIRED');
      expect(expiredAlert.tone).toBe('crimson');

      // Step C: Nurse uploads renewed GPHN -> status PENDING, tier stays TIER_1_BASIC
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 5);
      const futureDateStr = futureDate.toISOString().slice(0, 10);

      const renewRes = await uploadRenewedGphn({
        fileUri: 'file:///photo-new-gphn-2031.jpg',
        number: '00888/GPHN-RENEWED',
        issuedDate: '2026-10-01',
        expiryDate: futureDateStr,
        issuingAuthority: 'Sở Y tế TP. Đà Nẵng',
        scopeOfPractice: 'Điều dưỡng đa khoa',
      });

      expect(renewRes.success).toBe(true);
      expect(renewRes.data.credential.verification_status).toBe(VerificationStatus.PENDING);
      // Still at Tier 1 until Admin approves
      account = mockGetAccount(testPhone);
      expect(account?.profile?.tier).toBe(NurseTier.TIER_1_BASIC);

      // Verify alert info shows PENDING amber alert
      const pendingAlert = getGphnAlertInfo(futureDateStr, true);
      expect(pendingAlert.status).toBe('PENDING');
      expect(pendingAlert.tone).toBe('amber');

      // Step D: Admin approves renewed GPHN -> tier automatically restored to TIER_2_SPECIALIST!
      const approveRes = await mockAdminApproveGphn();
      expect(approveRes.success).toBe(true);
      expect(approveRes.data.credential.verification_status).toBe(VerificationStatus.APPROVED);
      expect(approveRes.data.profile?.tier).toBe(NurseTier.TIER_2_SPECIALIST);
      expect(approveRes.data.profile?.gphn_expiry_date).toBe(futureDateStr);

      // Verify alert info now shows VALID jade
      const approvedAlert = getGphnAlertInfo(futureDateStr, false);
      expect(approvedAlert.status).toBe('VALID');
      expect(approvedAlert.tone).toBe('jade');
    });
  });
});
