import {
  DocType,
  NurseTier,
  ProfileStatus,
  VerificationStatus,
} from '@healthcare-system/shared';
import {
  getOnboardingStatus,
  getUploadUrls,
  putFileToPresignedUrl,
  submitOnboarding,
} from '../src/features/onboarding/onboarding.api';
import {
  clearOnboardingDraft,
  DEFAULT_ONBOARDING_DRAFT,
  loadOnboardingDraft,
  saveOnboardingDraft,
  type OnboardingDraftData,
} from '../src/features/onboarding/onboarding-draft';
import {
  mockAdminApproveProfile,
  mockSetDocumentReviewResult,
} from '../src/features/onboarding/onboarding.mock';
import { saveSession } from '../src/lib/storage';

process.env.USE_MOCK_ONBOARDING = 'true';
process.env.USE_MOCK_AUTH = 'true';

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
  default: { USE_MOCK_AUTH: 'true', USE_MOCK_ONBOARDING: 'true' },
  Config: { USE_MOCK_AUTH: 'true', USE_MOCK_ONBOARDING: 'true' },
}));

describe('Nurse Onboarding eKYC & Approval Flow (A02 / FR-AUTH-01)', () => {
  const testPhone = '0907777777';
  const testUserId = 'nurse-test-777';

  beforeEach(async () => {
    jest.clearAllMocks();
    mockStorageMap.clear();
    await saveSession({
      token: 'mock-test-token',
      user: {
        id: testUserId,
        phone: testPhone,
        full_name: 'Lê Hoàng Yến',
        role: 'NURSE' as any,
      },
      profile: null,
      credentials: [],
    });
  });

  describe('1. Onboarding Draft Persistence (onboarding-draft.ts)', () => {
    it('saves draft and restores draft data from storage', async () => {
      const draftUpdate: Partial<OnboardingDraftData> = {
        step: 2,
        cccdNumber: '079123456789',
        cccdFrontUri: 'file:///data/cccd-front.jpg',
        cccdBackUri: 'file:///data/cccd-back.jpg',
        portraitUri: 'file:///data/selfie.jpg',
      };

      await saveOnboardingDraft(draftUpdate);

      const loaded = await loadOnboardingDraft();
      expect(loaded).not.toBeNull();
      expect(loaded?.step).toBe(2);
      expect(loaded?.cccdNumber).toBe('079123456789');
      expect(loaded?.cccdFrontUri).toBe('file:///data/cccd-front.jpg');
      expect(loaded?.cccdBackUri).toBe('file:///data/cccd-back.jpg');
      expect(loaded?.portraitUri).toBe('file:///data/selfie.jpg');
      // Default fields remain intact
      expect(loaded?.scopeOfPractice).toBe('Điều dưỡng đa khoa');
    });

    it('clears draft when completed or cancelled', async () => {
      await saveOnboardingDraft({ step: 3, cccdNumber: '079123456789' });
      let loaded = await loadOnboardingDraft();
      expect(loaded?.cccdNumber).toBe('079123456789');

      await clearOnboardingDraft();
      loaded = await loadOnboardingDraft();
      expect(loaded).toBeNull();
    });
  });

  describe('2. Step Validation and GPHN Expiration Checks', () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const futureDate = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);

    it('rejects submission when CCCD is not exactly 12 digits', async () => {
      const res = await submitOnboarding({
        cccdNumber: '07912345', // only 8 digits
        identity: {
          cccdFrontKey: 'key-front',
          cccdBackKey: 'key-back',
          portraitKey: 'key-portrait',
        },
        degree: { fileKey: 'key-degree' },
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('VALIDATION_ERROR');
      expect(res.error?.message).toContain('12 chữ số');
    });

    it('rejects submission when GPHN expiry date is today or earlier', async () => {
      const res = await submitOnboarding({
        cccdNumber: '079123456789',
        identity: {
          cccdFrontKey: 'key-front',
          cccdBackKey: 'key-back',
          portraitKey: 'key-portrait',
        },
        degree: { fileKey: 'key-degree' },
        gphn: {
          fileKey: 'key-gphn',
          number: '01284/GPHN-ĐN',
          issuedDate: '2019-01-01',
          expiryDate: yesterday, // Expired yesterday
          issuingAuthority: 'Sở Y tế TP. Đà Nẵng',
          scopeOfPractice: 'Điều dưỡng đa khoa',
        },
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('GPHN_EXPIRED');
    });

    it('rejects submission when GPHN expiry date is on or before issued date', async () => {
      const res = await submitOnboarding({
        cccdNumber: '079123456789',
        identity: {
          cccdFrontKey: 'key-front',
          cccdBackKey: 'key-back',
          portraitKey: 'key-portrait',
        },
        degree: { fileKey: 'key-degree' },
        gphn: {
          fileKey: 'key-gphn',
          number: '01284/GPHN-ĐN',
          issuedDate: '2028-01-01',
          expiryDate: '2027-01-01', // Before issued date
          issuingAuthority: 'Sở Y tế',
          scopeOfPractice: 'Điều dưỡng',
        },
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('VALIDATION_ERROR');
    });

    it('accepts submission without GPHN and assigns Tier 1 Basic', async () => {
      const res = await submitOnboarding({
        cccdNumber: '079123456789',
        identity: {
          cccdFrontKey: 'key-front',
          cccdBackKey: 'key-back',
          portraitKey: 'key-portrait',
        },
        degree: { fileKey: 'key-degree' },
      });

      expect(res.success).toBe(true);
      expect(res.data.profile.profile_status).toBe(ProfileStatus.PENDING_VERIFICATION);
      expect(res.data.profile.tier).toBe(NurseTier.TIER_1_BASIC);
      expect(res.data.credentials.some((c) => c.doc_type === DocType.CCCD)).toBe(true);
      expect(res.data.credentials.some((c) => c.doc_type === DocType.DEGREE)).toBe(true);
      expect(res.data.credentials.some((c) => c.doc_type === DocType.GPHN)).toBe(false);
    });

    it('accepts submission with valid future GPHN and assigns Tier 2 Specialist', async () => {
      const res = await submitOnboarding({
        cccdNumber: '079123456789',
        identity: {
          cccdFrontKey: 'key-front',
          cccdBackKey: 'key-back',
          portraitKey: 'key-portrait',
        },
        degree: { fileKey: 'key-degree' },
        gphn: {
          fileKey: 'key-gphn',
          number: '01284/GPHN-ĐN',
          issuedDate: '2020-05-15',
          expiryDate: futureDate,
          issuingAuthority: 'Sở Y tế TP. Đà Nẵng',
          scopeOfPractice: 'Điều dưỡng đa khoa',
        },
      });

      expect(res.success).toBe(true);
      expect(res.data.profile.profile_status).toBe(ProfileStatus.PENDING_VERIFICATION);
      expect(res.data.profile.tier).toBe(NurseTier.TIER_2_SPECIALIST);
      expect(res.data.credentials.some((c) => c.doc_type === DocType.GPHN)).toBe(true);
    });
  });

  describe('3. Presigned URLs and File Upload Flow', () => {
    it('requests presigned URLs with 10-minute expiry (600s)', async () => {
      const res = await getUploadUrls(['CCCD_FRONT', 'CCCD_BACK', 'PORTRAIT', 'DEGREE']);
      expect(res.success).toBe(true);
      expect(res.data.files).toHaveLength(4);

      for (const item of res.data.files) {
        expect(item.uploadUrl).toBeDefined();
        expect(item.objectKey).toBeDefined();
        expect(item.expiresInSeconds).toBe(600);
      }
    });

    it('uploads files to presigned URL successfully', async () => {
      const ok = await putFileToPresignedUrl(
        'mock://presigned-upload/cccd_front',
        'file:///data/cache/cccd_front.jpg',
        'image/jpeg'
      );
      expect(ok).toBe(true);
    });
  });

  describe('4. Pending Approval & Admin Review Simulation', () => {
    it('retrieves onboarding credentials status', async () => {
      // First submit
      await submitOnboarding({
        cccdNumber: '079123456789',
        identity: {
          cccdFrontKey: 'key-front',
          cccdBackKey: 'key-back',
          portraitKey: 'key-portrait',
        },
        degree: { fileKey: 'key-degree' },
      });

      const statusRes = await getOnboardingStatus();
      expect(statusRes.success).toBe(true);
      expect(statusRes.data.profileStatus).toBe(ProfileStatus.PENDING_VERIFICATION);
      expect(statusRes.data.credentials.length).toBeGreaterThanOrEqual(2);
    });

    it('handles rejected document with reason and allows re-submission navigation', async () => {
      // Submit with GPHN
      const futureDate = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
      await submitOnboarding({
        cccdNumber: '079123456789',
        identity: {
          cccdFrontKey: 'key-front',
          cccdBackKey: 'key-back',
          portraitKey: 'key-portrait',
        },
        degree: { fileKey: 'key-degree' },
        gphn: {
          fileKey: 'key-gphn',
          number: '01284/GPHN-ĐN',
          issuedDate: '2020-05-15',
          expiryDate: futureDate,
          issuingAuthority: 'Sở Y tế',
          scopeOfPractice: 'Điều dưỡng đa khoa',
        },
      });

      // Admin rejects GPHN
      mockSetDocumentReviewResult(
        testPhone,
        DocType.GPHN,
        VerificationStatus.REJECTED,
        'Ảnh GPHN mờ, không đọc được số giấy phép. Vui lòng chụp lại rõ nét.'
      );

      const statusRes = await getOnboardingStatus();
      expect(statusRes.success).toBe(true);

      const rejectedGphn = statusRes.data.credentials.find((c) => c.docType === DocType.GPHN);
      expect(rejectedGphn).toBeDefined();
      expect(rejectedGphn?.verificationStatus).toBe(VerificationStatus.REJECTED);
      expect(rejectedGphn?.rejectionReason).toContain('Ảnh GPHN mờ');
    });

    it('promotes profile to ACTIVE when Admin approves all documents', async () => {
      mockAdminApproveProfile(testPhone);

      const statusRes = await getOnboardingStatus();
      expect(statusRes.success).toBe(true);
      expect(statusRes.data.profileStatus).toBe(ProfileStatus.ACTIVE);
    });
  });
});
