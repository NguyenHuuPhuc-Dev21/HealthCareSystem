// import { apiClient } from '../../lib/api-client';

// export async function submitOnboarding(data: FormData) {
//   return apiClient<{ profile_id: string; profile_status: string }>('/auth/nurse-onboarding', {
//     method: 'POST',
//     body: data,
//   });
// }

import {
  DocType,
  NurseTier,
  ProfileStatus,
  VerificationStatus,
} from '@healthcare-system/shared';
import type { NurseCredential, NurseProfile } from '@healthcare-system/shared';
import { apiClient } from '../../lib/api-client';
import type { ApiResponse } from '../../lib/api-client';
import { USE_MOCK } from '../auth/auth.api';
import { mockGetAccount, mockSaveProfile } from '../auth/auth.mock';

export interface OnboardingResult {
  profile: NurseProfile;
  credentials: NurseCredential[];
}

function makeCred(nurseId: string, docType: DocType, expiry?: string): NurseCredential {
  return {
    id: `cred-${nurseId}-${docType.toLowerCase()}-${Date.now()}`,
    nurse_id: nurseId,
    doc_type: docType,
    file_url: `mock://${docType.toLowerCase()}.jpg`,
    expiry_date: expiry ?? null,
    verification_status: VerificationStatus.PENDING,
    created_at: new Date().toISOString(),
  };
}

/**
 * Nộp hồ sơ eKYC (FR-AUTH-01): POST /auth/nurse-onboarding.
 * Khi bật mock: tạo hồ sơ PENDING_VERIFICATION ngay trong mock DB.
 * FormData phải chứa: cccdFront, cccdBack, selfie, degree, gphn (file),
 * gphnNumber, gphnIssuedDate, gphnExpiryDate, scopeOfPractice,
 * yearsOfExp, isRetiredMedicalStaff, retirementDecision (file, không bắt buộc).
 */
export async function submitOnboarding(
  phone: string,
  data: FormData,
): Promise<ApiResponse<OnboardingResult>> {
  if (USE_MOCK) {
    const account = mockGetAccount(phone);
    if (!account) {
      return {
        success: false,
        data: null as unknown as OnboardingResult,
        error: { code: 'ACCOUNT_NOT_FOUND', message: 'Không tìm thấy tài khoản' },
      };
    }
    const now = new Date().toISOString();
    const profile: NurseProfile = {
      user_id: account.user.id,
      // Chưa có GPHN hợp lệ thì chỉ có thể về Tier 1 — Admin chốt tier cuối cùng khi duyệt.
      tier: data.get('gphn') ? NurseTier.TIER_2_SPECIALIST : NurseTier.TIER_1_BASIC,
      gphn_number: (data.get('gphnNumber') as string) || null,
      gphn_expiry_date: (data.get('gphnExpiryDate') as string) || null,
      scope_of_practice: (data.get('scopeOfPractice') as string) || null,
      years_of_exp: Number(data.get('yearsOfExp') ?? 0),
      is_retired_medical_staff: data.get('isRetiredMedicalStaff') === 'true',
      is_online: false,
      trust_score: 100,
      rating_avg: 0,
      profile_status: ProfileStatus.PENDING_VERIFICATION,
      created_at: now,
      updated_at: now,
    };
    const credentials: NurseCredential[] = [
      makeCred(account.user.id, DocType.CCCD),
      makeCred(account.user.id, DocType.DEGREE),
    ];
    if (data.get('gphn')) {
      credentials.push(
        makeCred(account.user.id, DocType.GPHN, (data.get('gphnExpiryDate') as string) || undefined),
      );
    }
    if (data.get('retirementDecision')) {
      credentials.push(makeCred(account.user.id, DocType.RETIREMENT_DECISION));
    }
    mockSaveProfile(phone, profile, credentials);
    return { success: true, data: { profile, credentials } };
  }

  const res = await apiClient<{ profile_id: string; profile_status: string }>('/auth/nurse-onboarding', {
    method: 'POST',
    body: data,
  });
  if (!res.success) {
    return { success: false, data: null as unknown as OnboardingResult, error: res.error };
  }
  // API thật hiện chỉ trả profile_id + profile_status (scaffold cũ). Khi BE-1 chốt
  // contract (xem auth.types.ts), đổi chỗ này để lấy profile đầy đủ từ response
  // hoặc gọi GET /nurse/profile/me.
  return {
    success: false,
    data: null as unknown as OnboardingResult,
    error: {
      code: 'CONTRACT_PENDING',
      message: 'Đã nộp hồ sơ nhưng BE chưa trả hồ sơ đầy đủ — chờ chốt contract với BE-1',
    },
  };
}