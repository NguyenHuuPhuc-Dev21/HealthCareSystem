/**
 * Đặt ca (FR-BOOK-01/02/03 · BR-03 · BR-04 · BR-13 · BR-15) và máy trạng thái 3 trục (SRS §2.2).
 *
 * ⚠️ Backend `bookings` mới có dòng `POST /api/v1/bookings` trong docs/api/README.md, chưa có contract chi tiết.
 * Hình dạng dưới đây là ĐỀ XUẤT (camelCase như các module BE đã có), cần BE-2/BE-3 xác nhận trước khi nối thật.
 * Mọi số tiền do BACKEND tính (SEC-05) — frontend chỉ hiển thị, không tự cộng phụ phí.
 */

export type PaymentMethod = 'BANK_TRANSFER' | 'CASH';
export type ExecutionStatus = 'DRAFT' | 'MATCHING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
export type PaymentStatus = 'UNPAID' | 'ESCROW_HELD' | 'SETTLED' | 'REFUNDED' | 'PARTIALLY_SETTLED';
export type DisputeStatus = 'NONE' | 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED_CUSTOMER' | 'RESOLVED_NURSE' | 'RESOLVED_PARTIAL';

/** Lấy ngày y lệnh tối đa 7 ngày trước (BR-15 §2.2). */
export const PRESCRIPTION_MAX_AGE_DAYS = 7;

/** Khung giờ đã chọn ở bước 3. */
export interface BookingSlot {
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  startTime: string;
  durationHours: number;
}

/** Bản nháp trong quá trình đặt ca. */
export interface BookingDraft {
  serviceCode: string;
  patientProfileId: string;
  slot: BookingSlot;
  paymentMethod: PaymentMethod | null;
  /** Chỉ có khi dịch vụ xâm lấn */
  prescriptionFile: File | null;
  prescriptionIssuedDate: string;
  /** Điều dưỡng được mời trực tiếp (nếu đặt từ màn hình tìm kiếm) */
  invitedNurseId: string | null;
}

/** POST /bookings/quote — bảng giá minh bạch (backend tính). */
export interface PricingQuote {
  hours: number;
  baseAmount: number;
  nightSurcharge: number;
  nightHours: number;
  holidaySurcharge: number;
  holidayName: string | null;
  heavyPatientSurcharge: number;
  /** Phí nền tảng (15%): đã nằm TRONG tổng tiền, trừ vào thu nhập điều dưỡng khi quyết toán — không cộng thêm cho khách. */
  platformFee: number;
  platformFeeRate: number;
  totalAmount: number;
}

export interface QuoteRequest {
  serviceCode: string;
  patientProfileId: string;
  startAt: string;
  endAt: string;
}

export interface CreateBookingRequest extends QuoteRequest {
  paymentMethod: PaymentMethod;
  /** Object key của ảnh y lệnh đã tải lên (dịch vụ xâm lấn) */
  prescription?: { imageKey: string; issuedDate: string };
  invitedNurseId?: string;
}

export interface BankTransferInfo {
  bankName: string;
  accountNumber: string;
  accountName: string;
  transferContent: string;
}

/**
 * Escrow của đơn chuyển khoản (FR-PAY-01/02, BR-04): tiền khoá khi cổng thanh toán xác nhận,
 * giải ngân 24 giờ sau check-out (hoặc khi khách xác nhận hoàn thành sớm) nếu không có khiếu nại.
 */
export interface EscrowInfo {
  heldAmount: number;
  heldAt: string;
  /** Mốc tự giải ngân (check-out + 24 giờ); null khi ca chưa check-out. */
  releaseAt: string | null;
  /** Khiếu nại đang mở → đóng băng, không tự giải ngân (BR-11). */
  frozenByDispute: boolean;
}

export interface Booking {
  id: string;
  code: string;
  serviceCode: string;
  serviceLabel: string;
  isInvasive: boolean;
  patientProfileId: string;
  patientName: string;
  startAt: string;
  endAt: string;
  paymentMethod: PaymentMethod;
  pricing: PricingQuote;
  /** 3 trục trạng thái độc lập */
  executionStatus: ExecutionStatus;
  paymentStatus: PaymentStatus;
  disputeStatus: DisputeStatus;
  /** Hạn thanh toán (DRAFT + chuyển khoản): tạo + 15 phút. */
  paymentExpiresAt: string | null;
  bankTransfer: BankTransferInfo | null;
  /** Tiền đang tạm giữ (chỉ đơn chuyển khoản đã thanh toán, chưa quyết toán/hoàn). */
  escrow?: EscrowInfo | null;
  /** Ca đặt trực tiếp: điều dưỡng được mời có 15 phút để phản hồi, quá hạn thì phát lên Job Board. */
  invitedNurse: { nurseId: string; fullName: string; respondBy: string | null } | null;
  matchingMode: 'RADAR' | 'JOB_BOARD' | 'DIRECT_REQUEST' | null;
  /** Y lệnh đang chờ Admin duyệt (ca xâm lấn) */
  prescriptionReview: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  createdAt: string;
}

/* ----- Nhãn hiển thị ----- */

type Tone = 'teal' | 'amber' | 'red' | '';

export const EXECUTION_LABEL: Record<ExecutionStatus, { text: string; tone: Tone }> = {
  DRAFT: { text: 'Chờ thanh toán', tone: 'amber' },
  MATCHING: { text: 'Đang tìm điều dưỡng', tone: 'amber' },
  CONFIRMED: { text: 'Đã xác nhận', tone: 'teal' },
  IN_PROGRESS: { text: 'Đang thực hiện', tone: 'teal' },
  COMPLETED: { text: 'Hoàn thành', tone: 'teal' },
  CANCELLED: { text: 'Đã huỷ', tone: 'red' },
  EXPIRED: { text: 'Hết hạn', tone: 'red' },
};

export const PAYMENT_LABEL: Record<PaymentStatus, { text: string; tone: Tone }> = {
  UNPAID: { text: 'Chưa thanh toán', tone: 'amber' },
  ESCROW_HELD: { text: 'Đã tạm giữ an toàn', tone: 'teal' },
  SETTLED: { text: 'Đã quyết toán', tone: 'teal' },
  REFUNDED: { text: 'Đã hoàn tiền', tone: '' },
  PARTIALLY_SETTLED: { text: 'Quyết toán một phần', tone: '' },
};

export const DISPUTE_LABEL: Record<DisputeStatus, { text: string; tone: Tone }> = {
  NONE: { text: 'Không khiếu nại', tone: '' },
  OPEN: { text: 'Đang khiếu nại', tone: 'red' },
  UNDER_REVIEW: { text: 'Admin đang xem xét', tone: 'amber' },
  RESOLVED_CUSTOMER: { text: 'Đã xử lý · hoàn khách', tone: '' },
  RESOLVED_NURSE: { text: 'Đã xử lý · giữ cho điều dưỡng', tone: '' },
  RESOLVED_PARTIAL: { text: 'Đã xử lý · chia một phần', tone: '' },
};
