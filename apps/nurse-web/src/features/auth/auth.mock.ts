/**
 * Mock cho Giai đoạn 1 (chỉ chạy khi VITE_USE_MOCK=true).
 *
 * - Mã OTP mẫu cho MỌI số điện thoại: 123456. Nhập khác -> lỗi OTP_INVALID.
 * - 6 số mẫu dưới đây cho 6 trạng thái khác nhau; bất kỳ số hợp lệ nào khác
 *   đều được coi là điều dưỡng mới (chưa có hồ sơ -> đi onboarding).
 * - Dữ liệu lưu ở localStorage để nộp hồ sơ / tải GPHN mới / duyệt mock
 *   vẫn còn sau khi tải lại trang. Xoá key 'mock_nurse_db_v1' để reset.
 */
import {
    DocType,
    NurseTier,
    ProfileStatus,
    UserRole,
    VerificationStatus,
} from '@healthcare-system/shared';
import type { NurseCredential, NurseProfile } from '@healthcare-system/shared';
import type { ApiResponse } from '../../lib/api-client';
import type { RequestOtpData, SessionData } from './auth.types';

export const MOCK_OTP = '123456';
const DB_KEY = 'mock_nurse_db_v1';

interface MockAccount {
    user: SessionData['user'];
    profile: NurseProfile | null;
    credentials: NurseCredential[];
}

type MockDb = Record<string, MockAccount>;

function cred(
    nurseId: string,
    docType: DocType,
    status: VerificationStatus,
    extra: Partial<NurseCredential> = {},
): NurseCredential {
    return {
        id: `cred-${nurseId}-${docType.toLowerCase()}`,
        nurse_id: nurseId,
        doc_type: docType,
        file_url: `mock://${docType.toLowerCase()}.jpg`,
        verification_status: status,
        created_at: '2026-11-02T08:00:00+07:00',
        ...extra,
    };
}

function seed(): MockDb {
    const mai: MockAccount = {
        user: { id: 'nurse-mai', phone: '0902222222', full_name: 'Trần Thị Mai', role: UserRole.NURSE },
        profile: {
            user_id: 'nurse-mai',
            tier: NurseTier.TIER_2_SPECIALIST,
            gphn_number: '00123/GPHN-ĐN',
            gphn_expiry_date: '2027-04-12',
            scope_of_practice: 'Chăm sóc sau phẫu thuật, thay băng, tiêm truyền',
            years_of_exp: 12,
            is_retired_medical_staff: true,
            is_online: false,
            trust_score: 92,
            rating_avg: 4.9,
            profile_status: ProfileStatus.ACTIVE,
            created_at: '2026-10-20T08:00:00+07:00',
            updated_at: '2026-10-20T08:00:00+07:00',
        },
        credentials: [
            cred('nurse-mai', DocType.CCCD, VerificationStatus.APPROVED),
            cred('nurse-mai', DocType.DEGREE, VerificationStatus.APPROVED),
            cred('nurse-mai', DocType.GPHN, VerificationStatus.APPROVED, { expiry_date: '2027-04-12' }),
        ],
    };

    const ha: MockAccount = {
        user: { id: 'nurse-ha', phone: '0903333333', full_name: 'Phạm Thu Hà', role: UserRole.NURSE },
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
            cred('nurse-ha', DocType.CCCD, VerificationStatus.PENDING),
            cred('nurse-ha', DocType.DEGREE, VerificationStatus.PENDING),
            cred('nurse-ha', DocType.GPHN, VerificationStatus.PENDING, { expiry_date: '2027-05-15' }),
        ],
    };

    const binh: MockAccount = {
        user: { id: 'nurse-binh', phone: '0906666666', full_name: 'Đỗ Văn Bình', role: UserRole.NURSE },
        profile: {
            user_id: 'nurse-binh',
            tier: NurseTier.TIER_1_BASIC,
            gphn_number: '00987/GPHN-ĐN',
            gphn_expiry_date: '2027-01-20',
            scope_of_practice: 'Chăm sóc cơ bản',
            years_of_exp: 5,
            is_retired_medical_staff: false,
            is_online: false,
            trust_score: 100,
            rating_avg: 0,
            profile_status: ProfileStatus.PENDING_VERIFICATION,
            created_at: '2026-10-30T08:00:00+07:00',
            updated_at: '2026-10-30T08:00:00+07:00',
        },
        credentials: [
            cred('nurse-binh', DocType.CCCD, VerificationStatus.APPROVED),
            cred('nurse-binh', DocType.DEGREE, VerificationStatus.APPROVED),
            cred('nurse-binh', DocType.GPHN, VerificationStatus.REJECTED, {
                expiry_date: '2027-01-20',
                rejection_reason: 'Ảnh GPHN mờ, không đọc được số giấy phép. Vui lòng chụp lại rõ nét.',
            }),
        ],
    };

    const an: MockAccount = {
        user: { id: 'nurse-an', phone: '0904444444', full_name: 'Nguyễn Văn An', role: UserRole.NURSE },
        profile: {
            user_id: 'nurse-an',
            tier: NurseTier.TIER_1_BASIC,
            gphn_number: '00555/GPHN-ĐN',
            gphn_expiry_date: '2027-08-01',
            scope_of_practice: 'Chăm sóc cơ bản',
            years_of_exp: 2,
            is_retired_medical_staff: false,
            is_online: false,
            trust_score: 55,
            rating_avg: 4.2,
            profile_status: ProfileStatus.SUSPENDED,
            suspended_reason: 'Chưa nộp hoa hồng ca tiền mặt trong 24 giờ sau check-out',
            created_at: '2026-09-15T08:00:00+07:00',
            updated_at: '2026-10-28T08:00:00+07:00',
        },
        credentials: [cred('nurse-an', DocType.GPHN, VerificationStatus.APPROVED, { expiry_date: '2027-08-01' })],
    };

    const hoa: MockAccount = {
        user: { id: 'nurse-hoa', phone: '0905555555', full_name: 'Lê Thị Hoa', role: UserRole.NURSE },
        profile: {
            user_id: 'nurse-hoa',
            tier: NurseTier.TIER_1_BASIC,
            gphn_number: '00777/GPHN-ĐN',
            gphn_expiry_date: '2025-06-30',
            scope_of_practice: 'Chăm sóc cơ bản, đo chỉ số sinh tồn',
            years_of_exp: 8,
            is_retired_medical_staff: true,
            is_online: false,
            trust_score: 78,
            rating_avg: 4.6,
            profile_status: ProfileStatus.ACTIVE,
            created_at: '2026-08-01T08:00:00+07:00',
            updated_at: '2026-06-30T08:00:00+07:00',
        },
        credentials: [
            cred('nurse-hoa', DocType.CCCD, VerificationStatus.APPROVED),
            cred('nurse-hoa', DocType.DEGREE, VerificationStatus.APPROVED),
            cred('nurse-hoa', DocType.GPHN, VerificationStatus.APPROVED, { expiry_date: '2025-06-30' }),
        ],
    };

    const moi: MockAccount = {
        user: { id: 'nurse-moi', phone: '0901111111', full_name: 'Điều dưỡng mới', role: UserRole.NURSE },
        profile: null,
        credentials: [],
    };

    return {
        [mai.user.phone]: mai,
        [ha.user.phone]: ha,
        [binh.user.phone]: binh,
        [an.user.phone]: an,
        [hoa.user.phone]: hoa,
        [moi.user.phone]: moi,
    };
}

function loadDb(): MockDb {
    try {
        const raw = localStorage.getItem(DB_KEY);
        if (raw) return JSON.parse(raw) as MockDb;
    } catch {
        // dữ liệu mock hỏng thì seed lại
    }
    const db = seed();
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    return db;
}

function saveDb(db: MockDb): void {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function ok<T>(data: T): ApiResponse<T> {
    return { success: true, data };
}

function fail<T>(code: string, message: string): ApiResponse<T> {
    return { success: false, data: null as unknown as T, error: { code, message } };
}

const delay = () => new Promise((r) => setTimeout(r, 350));

export async function mockRequestOtp(phone: string): Promise<ApiResponse<RequestOtpData>> {
    await delay();
    if (!/^0\d{9}$/.test(phone)) {
        return fail('PHONE_INVALID', 'Số điện thoại phải gồm 10 số và bắt đầu bằng 0');
    }
    // Giá trị mẫu của mock — hệ thống thật lấy từ response/config của BE.
    return ok({ requestId: `mock-${Date.now()}`, resendAfterSeconds: 60, expiresInSeconds: 300 });
}

export async function mockVerifyOtp(phone: string, otp: string): Promise<ApiResponse<SessionData>> {
    await delay();
    if (otp !== MOCK_OTP) {
        return fail('OTP_INVALID', 'Mã OTP không đúng. Vui lòng kiểm tra lại');
    }
    const db = loadDb();
    let account = db[phone];
    if (!account) {
        account = {
            user: { id: `nurse-${phone}`, phone, full_name: 'Điều dưỡng mới', role: UserRole.NURSE },
            profile: null,
            credentials: [],
        };
        db[phone] = account;
        saveDb(db);
    }
    return ok({
        token: `mock-token-${phone}`,
        user: account.user,
        profile: account.profile,
        credentials: account.credentials,
    });
}

export function mockGetAccount(phone: string): MockAccount | null {
    return loadDb()[phone] ?? null;
}

export function mockSaveProfile(
    phone: string,
    profile: NurseProfile,
    credentials: NurseCredential[],
): void {
    const db = loadDb();
    const account = db[phone];
    if (!account) return;
    account.profile = profile;
    account.credentials = credentials;
    saveDb(db);
}

export function mockUpdateAccount(
    phone: string,
    patch: Partial<Pick<MockAccount, 'profile' | 'credentials'>>,
): MockAccount | null {
    const db = loadDb();
    const account = db[phone];
    if (!account) return null;
    if (patch.profile !== undefined) account.profile = patch.profile;
    if (patch.credentials !== undefined) account.credentials = patch.credentials;
    saveDb(db);
    return account;
}