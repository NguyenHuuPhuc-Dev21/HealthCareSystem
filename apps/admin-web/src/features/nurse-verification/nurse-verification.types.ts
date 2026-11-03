/**
 * Duyệt hồ sơ điều dưỡng & gán Tier (FR-AUTH-01, FR-AUTH-02, CT-01) — màn A2 + A3.
 *
 * Nguyên tắc: FE KHÔNG tự tính Tier, hiệu lực GPHN hay điều kiện nhận ca.
 * "Cấp gợi ý", "còn hạn", "khớp CCCD" đều do backend trả về; Admin ra quyết định cuối, backend kiểm tra lại.
 *
 * TODO: NurseTier, ProfileStatus, CredentialDocType → import từ '@healthcare-system/shared'.
 * ⚠️ Ngoài PATCH /admin/nurses/:id/verify (SRS §8), các endpoint đọc là đề xuất — cần BE-1 xác nhận.
 */

export type NurseTier = 'TIER_1_BASIC' | 'TIER_2_SPECIALIST';
export type RequestType = 'NEW' | 'RENEWAL'; // Đăng ký mới · Gia hạn GPHN
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type QueueTab = 'NEW' | 'RENEWAL' | 'PROCESSED';

/** SRS §7 nurse_credentials.doc_type có CCCD (1 loại) — FE cần tách 2 mặt để xem, đề xuất BE tách CCCD_FRONT/BACK. */
export type CredentialDocType = 'CCCD_FRONT' | 'CCCD_BACK' | 'DEGREE' | 'GPHN' | 'SELFIE' | 'RETIREMENT_DECISION';

export type GphnState = 'NONE' | 'VALID' | 'EXPIRED' | 'NEW_SUBMITTED';

/* ---------- A2 · Hàng đợi ---------- */

export interface QueueQuery {
  tab: QueueTab;
  q?: string;
  submitted?: 'ALL' | 'TODAY' | 'OVER_24H';
  docs?: 'ALL' | 'HAS_GPHN' | 'DEGREE_ONLY' | 'HAS_RETIREMENT';
}

export interface QueueItem {
  nurse_id: string;
  full_name: string;
  phone_masked: string; // backend che sẵn: "0905 ••• 214"
  subtitle: string; // "Đà Nẵng · 6 năm kinh nghiệm"
  request_type: RequestType;
  submitted_at: string; // ISO
  documents: { cccd: boolean; degree: boolean; gphn: GphnState; retirement: boolean };
  current_tier: NurseTier | null; // có giá trị với hồ sơ gia hạn
  suggested_tier: NurseTier;
  suggestion_note: string; // "GPHN 01284/GPHN-ĐN · còn hạn tới 15/05/2027"
  review_status: ReviewStatus;
  assigned_tier?: NurseTier | null; // tab Đã xử lý
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
}

/** GET /admin/nurses/verification-queue/summary */
export interface QueueSummary {
  NEW: number;
  RENEWAL: number;
}

/* ---------- A3 · Thẩm định ---------- */

export interface Credential {
  id: string;
  doc_type: CredentialDocType;
  verification_status: ReviewStatus;
}

export interface GphnInfo {
  number: string;
  issuer: string;
  issued_date: string; // YYYY-MM-DD
  expiry_date: string;
  scope_of_practice: string;
  is_valid: boolean; // backend tính — FE không tự so ngày
  days_remaining: number | null;
  identity_match: boolean | null; // đối chiếu họ tên/ngày sinh với CCCD (null = chưa đối chiếu)
}

export interface NurseReviewDetail {
  nurse_id: string;
  full_name: string;
  phone_masked: string;
  address: string;
  years_of_exp: number | null;
  cccd_number_masked: string | null;
  request_type: RequestType;
  submitted_at: string;
  review_status: ReviewStatus;
  current_tier: NurseTier | null;
  suggested_tier: NurseTier;
  suggestion_reason: string; // "có GPHN còn hạn"
  gphn: GphnInfo | null;
  degree: { title: string; year: number | null } | null;
  retirement_submitted: boolean;
  credentials: Credential[];
  // Đã xử lý
  assigned_tier?: NurseTier | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
}

/** GET /admin/nurses/:id/credentials/:credentialId/url — presigned URL hiệu lực 10 phút (NFR-SEC-01). */
export interface CredentialUrl {
  url: string;
  expires_at: string; // ISO
}

/** PATCH /admin/nurses/:id/verify (SRS §8) — backend ghi reviewed_by = admin hiện tại + audit_logs. */
export interface VerifyNurseRequest {
  decision: 'APPROVED' | 'REJECTED';
  tier?: NurseTier; // bắt buộc khi APPROVED hồ sơ đăng ký mới; hồ sơ gia hạn backend tự khôi phục Cấp 2
  rejection_reason?: string; // bắt buộc khi REJECTED
}

/* ---------- Nhãn hiển thị ---------- */

export const TIER_LABEL: Record<NurseTier, string> = {
  TIER_1_BASIC: 'Cấp 1',
  TIER_2_SPECIALIST: 'Cấp 2',
};

export const DOC_META: Record<CredentialDocType, { icon: string; label: string }> = {
  CCCD_FRONT: { icon: '🪪', label: 'CCCD trước' },
  CCCD_BACK: { icon: '🪪', label: 'CCCD sau' },
  DEGREE: { icon: '🎓', label: 'Bằng tốt nghiệp' },
  GPHN: { icon: '📜', label: 'GPHN' },
  SELFIE: { icon: '🤳', label: 'Ảnh chân dung trực tiếp' },
  RETIREMENT_DECISION: { icon: '🏅', label: 'Quyết định nghỉ hưu' },
};
