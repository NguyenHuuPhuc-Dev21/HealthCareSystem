/**
 * Điều tra & phán quyết khiếu nại (FR-DISP-01, FR-ADMIN-01) — khớp docs/api/disputes.api.md và
 * packages/shared/src/contracts/dispute.contracts.ts + docs/api/chat.api.md (xem chat của Admin).
 * (Sao chép kiểu thay vì import @healthcare-system/shared: dist của package đó là bản build cục bộ, không có trong repo.)
 */

export type DisputeCategory =
  | 'PREMATURE_ABANDONMENT'
  | 'CLINICAL_PROTOCOL_VIOLATION'
  | 'UNPROFESSIONAL_CONDUCT'
  | 'FALSE_CLINICAL_DECLARATION';

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED_CUSTOMER' | 'RESOLVED_NURSE';
export type Resolution = 'RESOLVED_CUSTOMER' | 'RESOLVED_NURSE';

export interface DisputeEvidence {
  id: string;
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
  rebuttalDueAt?: string;
  resolution?: {
    outcome: DisputeStatus;
    note: string;
    trustScoreDelta?: number;
    depositDeducted?: number;
    resolvedAt: string;
    refundedToPatient?: boolean;
    releasedToNurse?: boolean;
  } | null;
  /** PENALTY_APPEAL: điều dưỡng khiếu nại một khoản trừ ký quỹ (ADR-0004 D3) */
  kind?: 'BOOKING' | 'PENALTY_APPEAL';
  penaltyAmount?: number;
  penaltyReason?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ResolveBody {
  resolution: Resolution;
  /** ≥ 10 ký tự; lưu trong nhật ký kiểm toán */
  notes: string;
  /** Chỉ khi chấp nhận khiếu nại của khách: trừ ký quỹ điều dưỡng (phạt DISPUTE_UPHELD, không kháng cáo được) */
  depositDeduction?: number;
}

export interface ResolveResult {
  updated: boolean;
  outcome: Resolution;
  refunded: number;
  released: number;
  trustScoreDelta: number;
  depositDeducted: number;
  penaltyReversed: number;
}

export type ChatMessageType = 'TEXT' | 'IMAGE' | 'VOICE_CALL_LOG' | 'SYSTEM_ALERT';
export type OffPlatformReason = 'PHONE_NUMBER' | 'EXTERNAL_LINK' | 'OFF_PLATFORM_PAYMENT';

export interface AdminChatMessage {
  id: string;
  senderRole: 'PATIENT' | 'NURSE' | 'SYSTEM';
  senderName: string;
  receiverRole: 'PATIENT' | 'NURSE';
  type: ChatMessageType;
  content: string;
  imageUrl?: string | null;
  flagged?: boolean;
  flagReasons: OffPlatformReason[];
  callDurationSec: number | null;
  createdAt: string;
}

export interface AdminConversation {
  bookingId: string;
  bookingCode: string;
  executionStatus: string;
  customerName: string;
  nurseName: string | null;
  messages: AdminChatMessage[];
  flaggedCount: number;
}

export const NOTES_MIN = 10;
export const NOTES_MAX = 2000;

export const CATEGORY_LABEL: Record<DisputeCategory, string> = {
  PREMATURE_ABANDONMENT: 'Bỏ ca / kết thúc sớm',
  CLINICAL_PROTOCOL_VIOLATION: 'Sai quy trình chuyên môn',
  UNPROFESSIONAL_CONDUCT: 'Thái độ, hành vi không phù hợp',
  FALSE_CLINICAL_DECLARATION: 'Khai báo sai tình trạng người bệnh',
};

export const STATUS_LABEL: Record<DisputeStatus, { text: string; tone: 'amber' | 'teal' | 'red' | '' }> = {
  OPEN: { text: 'Mới mở', tone: 'red' },
  UNDER_REVIEW: { text: 'Đang xem xét', tone: 'amber' },
  RESOLVED_CUSTOMER: { text: 'Đã xử lý · chấp nhận khiếu nại', tone: 'teal' },
  RESOLVED_NURSE: { text: 'Đã xử lý · bác bỏ khiếu nại', tone: '' },
};

export const REASON_LABEL: Record<OffPlatformReason, string> = {
  PHONE_NUMBER: 'Số điện thoại',
  EXTERNAL_LINK: 'Liên kết ngoài',
  OFF_PLATFORM_PAYMENT: 'Thanh toán ngoài hệ thống',
};

export type StatusFilter = 'ACTIVE' | 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'ALL';
