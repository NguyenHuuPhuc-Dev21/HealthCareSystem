/**
 * Khiếu nại của khách (FR-DISP-01) — khớp docs/api/disputes.api.md và packages/shared/src/contracts/dispute.contracts.ts.
 * (Sao chép kiểu thay vì import từ @healthcare-system/shared vì dist của package đó là build cục bộ, không có trong repo.)
 */

export type DisputeCategory =
  | 'PREMATURE_ABANDONMENT'
  | 'CLINICAL_PROTOCOL_VIOLATION'
  | 'UNPROFESSIONAL_CONDUCT'
  | 'FALSE_CLINICAL_DECLARATION';

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED_CUSTOMER' | 'RESOLVED_NURSE';

export interface DisputeEvidence {
  id: string;
  /** Đường dẫn tải (presigned, hết hạn nhanh) — tải lại chi tiết để lấy link mới */
  url: string;
  kind: 'IMAGE' | 'VIDEO';
  uploadedBy: 'PATIENT' | 'NURSE';
  fileName?: string;
  fileSizeBytes?: number;
}

export interface Dispute {
  id: string;
  bookingId: string;
  bookingCode: string;
  openedBy: 'PATIENT' | 'NURSE';
  category: DisputeCategory;
  description: string;
  status: DisputeStatus;
  evidences: DisputeEvidence[];
  nurseRebuttal?: { content: string; submittedAt: string; evidences?: DisputeEvidence[] } | null;
  /** Hạn phản hồi của bên bị khiếu nại (mở + DISPUTE_REBUTTAL_HOURS) */
  rebuttalDueAt?: string;
  resolution?: {
    outcome: DisputeStatus;
    note: string;
    resolvedAt: string;
    refundedToPatient?: boolean;
    releasedToNurse?: boolean;
  } | null;
  kind?: 'BOOKING' | 'PENALTY_APPEAL';
  createdAt: string;
  updatedAt?: string;
}

export interface PresignedUploadUrl {
  fileId: string;
  fileName: string;
  uploadUrl: string;
  /** Khoá lưu trữ — gửi lại làm `evidenceUrls` khi mở khiếu nại */
  publicUrl: string;
}

/** Giới hạn bằng chứng (FR-DISP-01; định dạng theo kho lưu trữ hiện tại, chưa hỗ trợ video). */
export const MAX_EVIDENCE_FILES = 5;
export const MAX_EVIDENCE_MB = 20;
export const EVIDENCE_ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const EVIDENCE_EXT_LABEL = 'JPG, PNG, WEBP hoặc PDF';

/** Nhóm lý do khách có thể chọn (nhóm "khai báo sai tình trạng" chỉ dành cho điều dưỡng khiếu nại). */
export const CUSTOMER_CATEGORIES: Array<{ value: DisputeCategory; title: string; description: string }> = [
  { value: 'PREMATURE_ABANDONMENT', title: 'Điều dưỡng bỏ ca / kết thúc sớm', description: 'Rời đi hoặc dừng chăm sóc trước giờ kết thúc mà không có lý do chính đáng.' },
  { value: 'CLINICAL_PROTOCOL_VIOLATION', title: 'Sai quy trình chuyên môn', description: 'Thao tác không đúng phác đồ/y lệnh, không đảm bảo vô khuẩn, ghi chép sai.' },
  { value: 'UNPROFESSIONAL_CONDUCT', title: 'Thái độ, hành vi không phù hợp', description: 'Thiếu tôn trọng, đòi thêm tiền ngoài hệ thống, yêu cầu việc ngoài chuyên môn.' },
];

export const CATEGORY_LABEL: Record<DisputeCategory, string> = {
  PREMATURE_ABANDONMENT: 'Điều dưỡng bỏ ca / kết thúc sớm',
  CLINICAL_PROTOCOL_VIOLATION: 'Sai quy trình chuyên môn',
  UNPROFESSIONAL_CONDUCT: 'Thái độ, hành vi không phù hợp',
  FALSE_CLINICAL_DECLARATION: 'Khai báo sai tình trạng người bệnh',
};

export const STATUS_LABEL: Record<DisputeStatus, { text: string; tone: 'amber' | 'teal' | 'red' | '' }> = {
  OPEN: { text: 'Đã gửi · chờ điều dưỡng phản hồi', tone: 'amber' },
  UNDER_REVIEW: { text: 'Admin đang xem xét', tone: 'amber' },
  RESOLVED_CUSTOMER: { text: 'Đã xử lý · khiếu nại được chấp nhận', tone: 'teal' },
  RESOLVED_NURSE: { text: 'Đã xử lý · khiếu nại không được chấp nhận', tone: '' },
};
