/**
 * Theo dõi hoàn tiền theo Ma trận huỷ lịch / timeout / đền bù (SRS §5.2, BR-04 §2.4, BR-02, BR-13 §2.5).
 *
 * ⚠️ Backend chưa có contract cho huỷ ca và hoàn tiền (docs/api/README.md chưa liệt kê). Hình dạng dưới đây là
 * ĐỀ XUẤT (camelCase), cần BE xác nhận. Mọi số tiền do BACKEND tính; frontend chỉ hiển thị.
 * Hoàn tiền chỉ áp dụng đơn CHUYỂN KHOẢN — đơn tiền mặt chưa trả trước nên không phát sinh hoàn tiền.
 */

export type RefundScenario =
  | 'CUSTOMER_CANCEL_EARLY' // 1
  | 'CUSTOMER_CANCEL_NEAR' // 2
  | 'CUSTOMER_CANCEL_LATE' // 3
  | 'CUSTOMER_STOP_AFTER_CHECKIN' // 4
  | 'FORCE_MAJEURE_ICU' // 5
  | 'NURSE_CANCEL_EARLY' // 6
  | 'NURSE_CANCEL_URGENT' // 7
  | 'NURSE_NO_SHOW' // 8
  | 'UNMATCHED_EXPIRED'; // 9

export type RefundStatus = 'PROCESSING' | 'REFUNDED';

/** Một khoản hoàn tiền (một dòng trong "Theo dõi hoàn tiền"). */
export interface RefundRecord {
  refundId: string;
  bookingId: string | null;
  bookingCode: string;
  serviceLabel: string;
  scenario: RefundScenario;
  /** Số tiền khách đã trả (escrow) cho đơn */
  amountPaid: number;
  refundAmount: number;
  /** Phần trăm hoàn cho khách (0–100) */
  refundPercent: number;
  /** Đền bù cho điều dưỡng từ khoản phí huỷ (kịch bản 2, 3, 5) */
  nurseCompensation: number;
  /** Phần nền tảng thu từ phí huỷ */
  platformShare: number;
  /** Voucher xin lỗi (kịch bản 8) */
  voucherAmount: number;
  status: RefundStatus;
  createdAt: string;
  refundedAt: string | null;
}

/** Xem trước hậu quả của việc huỷ ca (trước khi khách xác nhận). */
export interface CancelPreview {
  bookingId: string;
  scenario: RefundScenario;
  /** Số giờ còn lại tới giờ bắt đầu lúc xem trước */
  hoursBeforeStart: number;
  paymentMethod: 'BANK_TRANSFER' | 'CASH';
  amountPaid: number;
  feePercent: number;
  refundPercent: number;
  refundAmount: number;
  nurseCompensation: number;
  platformShare: number;
}

export interface PolicyRow {
  no: number;
  scenario: RefundScenario;
  actor: 'CUSTOMER' | 'NURSE' | 'SYSTEM';
  title: string;
  trigger: string;
  sanction: string;
  handling: string;
}

/**
 * Bản mô tả chính sách theo SRS §5.2 — chỉ để giải thích cho khách. Số liệu thật nằm ở `system_configs`
 * và do backend áp dụng; không dùng bảng này để tính tiền.
 */
export const POLICY_MATRIX: PolicyRow[] = [
  {
    no: 1, scenario: 'CUSTOMER_CANCEL_EARLY', actor: 'CUSTOMER', title: 'Khách huỷ sớm',
    trigger: 'Huỷ trước giờ bắt đầu ca hơn 12 giờ',
    sanction: 'Phạt 0% · Hoàn 100%',
    handling: 'Hoàn 100% về cho khách và giải phóng lịch điều dưỡng.',
  },
  {
    no: 2, scenario: 'CUSTOMER_CANCEL_NEAR', actor: 'CUSTOMER', title: 'Khách huỷ cận giờ',
    trigger: 'Huỷ trước giờ bắt đầu từ 2 đến 12 giờ',
    sanction: 'Phạt 20% · Hoàn 80%',
    handling: 'Hoàn 80% cho khách; 15% đền bù điều dưỡng giữ lịch, 5% nền tảng thu.',
  },
  {
    no: 3, scenario: 'CUSTOMER_CANCEL_LATE', actor: 'CUSTOMER', title: 'Khách huỷ sát giờ',
    trigger: 'Huỷ trước giờ bắt đầu dưới 2 giờ, chưa check-in',
    sanction: 'Phạt 50% · Hoàn 50%',
    handling: 'Hoàn 50% cho khách; 40% đền bù điều dưỡng (chi phí đi lại, mất ca), 10% nền tảng thu.',
  },
  {
    no: 4, scenario: 'CUSTOMER_STOP_AFTER_CHECKIN', actor: 'CUSTOMER', title: 'Khách dừng ca sau khi check-in',
    trigger: 'Ca đang thực hiện, khách yêu cầu kết thúc sớm (không do lỗi điều dưỡng)',
    sanction: 'Thanh toán theo giờ thực tế · không phạt',
    handling: 'Tính đủ giờ đã phục vụ (tối thiểu 1 giờ); hoàn phần thời gian chưa dùng. Không coi là huỷ ca.',
  },
  {
    no: 5, scenario: 'FORCE_MAJEURE_ICU', actor: 'CUSTOMER', title: 'Huỷ vì lý do y tế bất khả kháng',
    trigger: 'Bệnh nhân chuyển cấp cứu ICU hoặc tử vong (kèm giấy tờ xác nhận)',
    sanction: 'Miễn phạt · Hoàn 100%',
    handling: 'Hoàn 100% phần chưa dùng; trích 50.000đ hỗ trợ đi lại cho điều dưỡng nếu đã di chuyển.',
  },
  {
    no: 6, scenario: 'NURSE_CANCEL_EARLY', actor: 'NURSE', title: 'Điều dưỡng huỷ sớm',
    trigger: 'Điều dưỡng huỷ trước giờ bắt đầu hơn 12 giờ',
    sanction: 'Không ảnh hưởng tiền của khách',
    handling: 'Ca tự động quay về tìm điều dưỡng khác thay thế; khách không mất khoản nào.',
  },
  {
    no: 7, scenario: 'NURSE_CANCEL_URGENT', actor: 'NURSE', title: 'Điều dưỡng huỷ gấp',
    trigger: 'Điều dưỡng huỷ trước giờ bắt đầu từ 12 giờ trở xuống',
    sanction: 'Điều dưỡng bị phạt · khách không mất tiền',
    handling: 'Ca được đẩy lên tìm người thay với "thưởng nóng" từ khoản phạt; khách không phải trả thêm.',
  },
  {
    no: 8, scenario: 'NURSE_NO_SHOW', actor: 'NURSE', title: 'Điều dưỡng không đến',
    trigger: 'Quá 30 phút sau giờ bắt đầu điều dưỡng không đến và không tìm được người thay',
    sanction: 'Hoàn 100% + voucher xin lỗi 50.000đ',
    handling: 'Hoàn trả 100% tiền đơn (đơn chuyển khoản) và tặng voucher xin lỗi 50.000đ; điều dưỡng bị khoá tài khoản.',
  },
  {
    no: 9, scenario: 'UNMATCHED_EXPIRED', actor: 'SYSTEM', title: 'Hết hạn thanh toán / hết hạn ghép cặp',
    trigger: 'Quá 15 phút chưa thanh toán, hoặc đến sát giờ (30 phút trước giờ hẹn) chưa có điều dưỡng nhận ca',
    sanction: 'Không phạt · Hoàn 100% (nếu đã trả)',
    handling: 'Ca tự chuyển sang hết hạn; nếu tiền đã được tạm giữ thì tự động hoàn 100% và gửi lời xin lỗi.',
  },
];

export const SCENARIO_TITLE: Record<RefundScenario, string> = Object.fromEntries(
  POLICY_MATRIX.map((r) => [r.scenario, `Kịch bản ${r.no} · ${r.title}`]),
) as Record<RefundScenario, string>;
