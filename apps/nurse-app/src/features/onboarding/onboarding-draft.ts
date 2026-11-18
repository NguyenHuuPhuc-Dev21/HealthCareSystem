import EncryptedStorage from 'react-native-encrypted-storage';

export const ONBOARDING_DRAFT_KEY = 'carenest_onboarding_draft_v1';

export interface OnboardingDraftData {
  step: number;
  // Step 1: CCCD
  cccdNumber: string;
  cccdFrontUri: string | null;
  cccdBackUri: string | null;
  // Step 2: Portrait
  portraitUri: string | null;
  // Step 3: Degree
  degreeUri: string | null;
  yearsOfExp: string;
  // Step 4: GPHN
  hasGphn: boolean;
  gphnUri: string | null;
  gphnNumber: string;
  gphnIssuedDate: string;
  gphnExpiryDate: string;
  gphnAuthority: string;
  scopeOfPractice: string;
  // Step 5: Supplement
  isRetired: boolean;
  retirementUri: string | null;
}

export const DEFAULT_ONBOARDING_DRAFT: OnboardingDraftData = {
  step: 0,
  cccdNumber: '',
  cccdFrontUri: null,
  cccdBackUri: null,
  portraitUri: null,
  degreeUri: null,
  yearsOfExp: '',
  hasGphn: true,
  gphnUri: null,
  gphnNumber: '',
  gphnIssuedDate: '',
  gphnExpiryDate: '',
  gphnAuthority: '',
  scopeOfPractice: 'Điều dưỡng đa khoa',
  isRetired: false,
  retirementUri: null,
};

/**
 * Lưu nháp tiến trình eKYC vào EncryptedStorage
 */
export async function saveOnboardingDraft(
  patch: Partial<OnboardingDraftData>
): Promise<void> {
  try {
    const current = await loadOnboardingDraft();
    const updated: OnboardingDraftData = {
      ...(current || DEFAULT_ONBOARDING_DRAFT),
      ...patch,
    };
    await EncryptedStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(updated));
  } catch {
    // Ignore errors in non-native / test environments
  }
}

/**
 * Tải nháp tiến trình eKYC từ EncryptedStorage
 */
export async function loadOnboardingDraft(): Promise<OnboardingDraftData | null> {
  try {
    const raw = await EncryptedStorage.getItem(ONBOARDING_DRAFT_KEY);
    if (!raw) return null;
    return { ...DEFAULT_ONBOARDING_DRAFT, ...JSON.parse(raw) };
  } catch {
    return null;
  }
}

/**
 * Xóa nháp khi đã nộp hồ sơ thành công hoặc người dùng bấm Hủy
 */
export async function clearOnboardingDraft(): Promise<void> {
  try {
    await EncryptedStorage.removeItem(ONBOARDING_DRAFT_KEY);
  } catch {
    // Ignore
  }
}
