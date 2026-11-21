import {
  DocType,
  NurseTier,
  ProfileStatus,
  UserRole,
  VerificationStatus,
  type ApiResponse,
  type NurseCredential,
  type NurseProfile,
  type RequestOtpData,
  type SessionData,
  type VerifyOutcome,
} from '@healthcare-system/shared';

export const MOCK_OTP = '123456';

interface MockAccount {
  user: SessionData['user'];
  profile: NurseProfile | null;
  credentials: NurseCredential[];
}

const mockDatabase: Record<string, MockAccount> = {
  // 1. Số mẫu Vùng Active (Đã duyệt hồ sơ, đang hoạt động)
  '0902222222': {
    user: {
      id: 'nurse-mai',
      phone: '0902222222',
      full_name: 'Trần Thị Mai',
      role: UserRole.NURSE,
    },
    profile: {
      user_id: 'nurse-mai',
      tier: NurseTier.TIER_2_SPECIALIST,
      gphn_number: '00123/GPHN-ĐN',
      gphn_expiry_date: '2027-04-12',
      scope_of_practice: 'Chăm sóc sau phẫu thuật, thay băng, tiêm truyền',
      years_of_exp: 12,
      is_retired_medical_staff: true,
      is_online: true,
      trust_score: 92,
      rating_avg: 4.9,
      profile_status: ProfileStatus.ACTIVE,
      created_at: '2026-10-20T08:00:00+07:00',
      updated_at: '2026-10-20T08:00:00+07:00',
    },
    credentials: [
      {
        id: 'cred-mai-gphn',
        nurse_id: 'nurse-mai',
        doc_type: DocType.GPHN,
        file_url: 'mock://gphn.jpg',
        verification_status: VerificationStatus.APPROVED,
        expiry_date: '2027-04-12',
        created_at: '2026-10-20T08:00:00+07:00',
      },
    ],
  },

  // 2. Số mẫu Vùng Pending (Đang chờ thẩm định hồ sơ)
  '0903333333': {
    user: {
      id: 'nurse-ha',
      phone: '0903333333',
      full_name: 'Phạm Thu Hà',
      role: UserRole.NURSE,
    },
    profile: {
      user_id: 'nurse-ha',
      tier: NurseTier.TIER_1_BASIC,
      gphn_number: '01284/GPHN-ĐN',
      gphn_expiry_date: '2027-05-15',
      scope_of_practice: 'Chăm sóc cơ bản',
      years_of_exp: 3,
      is_retired_medical_staff: false,
      is_online: false,
      trust_score: 100,
      rating_avg: 0,
      profile_status: ProfileStatus.PENDING_VERIFICATION,
      created_at: '2026-11-01T08:00:00+07:00',
      updated_at: '2026-11-01T08:00:00+07:00',
    },
    credentials: [
      {
        id: 'cred-ha-cccd',
        nurse_id: 'nurse-ha',
        doc_type: DocType.CCCD,
        file_url: 'mock://cccd.jpg',
        verification_status: VerificationStatus.APPROVED,
        created_at: '2026-11-01T08:00:00+07:00',
      },
      {
        id: 'cred-ha-degree',
        nurse_id: 'nurse-ha',
        doc_type: DocType.DEGREE,
        file_url: 'mock://degree.jpg',
        verification_status: VerificationStatus.PENDING,
        created_at: '2026-11-01T08:00:00+07:00',
      },
      {
        id: 'cred-ha-gphn',
        nurse_id: 'nurse-ha',
        doc_type: DocType.GPHN,
        file_url: 'mock://gphn.jpg',
        verification_status: VerificationStatus.REJECTED,
        rejection_reason: 'Ảnh GPHN mờ, không đọc được số giấy phép. Vui lòng chụp lại rõ nét.',
        expiry_date: '2027-05-15',
        created_at: '2026-11-01T08:00:00+07:00',
      },
    ],
  },

  // 3. Số mẫu Vùng Locked (Tạm khóa do vi phạm hoặc điểm tín nhiệm thấp)
  '0906666666': {
    user: {
      id: 'nurse-binh',
      phone: '0906666666',
      full_name: 'Đỗ Văn Bình',
      role: UserRole.NURSE,
    },
    profile: {
      user_id: 'nurse-binh',
      tier: NurseTier.TIER_1_BASIC,
      gphn_number: '01999/GPHN-ĐN',
      gphn_expiry_date: '2027-01-10',
      scope_of_practice: 'Chăm sóc cơ bản',
      years_of_exp: 4,
      is_retired_medical_staff: false,
      is_online: false,
      trust_score: 55,
      rating_avg: 3.2,
      profile_status: ProfileStatus.SUSPENDED,
      suspended_reason: 'Tài khoản đang bị tạm ngưng nhận ca do vi phạm hợp đồng hoặc hủy ca nhiều lần.',
      created_at: '2026-10-15T08:00:00+07:00',
      updated_at: '2026-11-02T08:00:00+07:00',
    },
    credentials: [],
  },
};

export function mockGetAccount(phone: string): MockAccount | null {
  return mockDatabase[phone] ?? null;
}

export function mockSaveProfile(
  phone: string,
  profile: NurseProfile,
  credentials: NurseCredential[],
  user?: SessionData['user']
): void {
  if (!mockDatabase[phone]) {
    mockDatabase[phone] = {
      user: user || {
        id: profile.user_id,
        phone,
        full_name: 'Điều dưỡng mới',
        role: UserRole.NURSE,
      },
      profile,
      credentials,
    };
    return;
  }
  const account = mockDatabase[phone];
  account.profile = profile;
  account.credentials = credentials;
}

export function mockUpdateAccount(
  phone: string,
  patch: Partial<Pick<MockAccount, 'profile' | 'credentials'>>
): MockAccount | null {
  if (!mockDatabase[phone]) {
    mockDatabase[phone] = {
      user: {
        id: `nurse-${phone}`,
        phone,
        full_name: 'Điều dưỡng mới',
        role: UserRole.NURSE,
      },
      profile: patch.profile ?? null,
      credentials: patch.credentials ?? [],
    };
    return mockDatabase[phone];
  }
  const account = mockDatabase[phone];
  if (patch.profile !== undefined) account.profile = patch.profile;
  if (patch.credentials !== undefined) account.credentials = patch.credentials;
  return account;
}

// Lưu tạm phiên đăng ký cho số mới
const pendingRegistrations: Record<string, { phone: string; token: string }> = {};

export async function mockRequestOtp(phone: string): Promise<ApiResponse<RequestOtpData>> {
  await new Promise((r) => setTimeout(r, 200));

  const cleanPhone = phone.replace(/\s+/g, '');
  return {
    success: true,
    data: {
      requestId: `mock-req-${Date.now()}`,
      resendAfterSeconds: 45,
      expiresInSeconds: 300,
      devOtp: MOCK_OTP,
    },
  };
}

export async function mockVerifyOtp(
  phone: string,
  otp: string
): Promise<ApiResponse<VerifyOutcome>> {
  await new Promise((r) => setTimeout(r, 250));

  if (otp !== MOCK_OTP) {
    return {
      success: false,
      data: null as any,
      error: {
        code: 'OTP_INVALID_OR_EXPIRED',
        message: 'Mã OTP không đúng hoặc đã hết hạn. Vui lòng thử lại.',
        details: { attemptsRemaining: 4 },
      },
    };
  }

  const cleanPhone = phone.replace(/\s+/g, '');
  const existing = mockDatabase[cleanPhone];

  // Nếu số đã có tài khoản điều dưỡng
  if (existing) {
    return {
      success: true,
      data: {
        status: 'AUTHENTICATED',
        session: {
          token: `mock-token-${cleanPhone}`,
          refreshToken: `mock-refresh-${cleanPhone}`,
          profileSource: 'MOCK',
          user: existing.user,
          profile: existing.profile,
          credentials: existing.credentials,
        },
      },
    };
  }

  // Số mới chưa đăng ký tài khoản -> Cần nhập họ tên để hoàn tất đăng ký
  const regToken = `reg-token-${cleanPhone}-${Date.now()}`;
  pendingRegistrations[regToken] = { phone: cleanPhone, token: regToken };

  return {
    success: true,
    data: {
      status: 'REGISTRATION_REQUIRED',
      registrationToken: regToken,
    },
  };
}

export async function mockCompleteRegistration(
  registrationToken: string,
  fullName: string
): Promise<ApiResponse<SessionData>> {
  await new Promise((r) => setTimeout(r, 300));

  const pending = pendingRegistrations[registrationToken];
  const phone = pending?.phone || '0909999999';
  const newId = `nurse-new-${Date.now()}`;

  const newAccount: MockAccount = {
    user: {
      id: newId,
      phone,
      full_name: fullName.trim(),
      role: UserRole.NURSE,
    },
    profile: null, // Chưa có hồ sơ -> đi onboarding
    credentials: [],
  };

  mockDatabase[phone] = newAccount;

  return {
    success: true,
    data: {
      token: `mock-token-${phone}`,
      refreshToken: `mock-refresh-${phone}`,
      profileSource: 'MOCK',
      user: newAccount.user,
      profile: null,
      credentials: [],
    },
  };
}

export async function mockLogoutServer(): Promise<void> {
  await new Promise((r) => setTimeout(r, 100));
}
