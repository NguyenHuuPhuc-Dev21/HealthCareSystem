/**
 * Mock tham số hệ thống — contract ĐỀ XUẤT (features/configs/configs.types.ts):
 *   GET   /admin/configs                 → { items }
 *   PATCH /admin/configs/:key { value, note? } → ConfigItem; 400 INVALID_CONFIG_VALUE · 404 CONFIG_NOT_FOUND
 * Giá trị mặc định lấy theo SRS §5.1 / packages/shared/src/config-keys.ts.
 */

import type { ConfigDataType, ConfigItem } from '../features/configs/configs.types';
import { validateValue } from '../features/configs/configs.types';
import { fail, ok } from './mock-fetch';
import type { MockHandler } from './mock-fetch';
import { getUserData, setUserData } from './mock-db';

const seedAt = '2026-09-01T00:00:00.000Z';
const c = (key: string, value: string, dataType: ConfigDataType, description: string): ConfigItem => ({ key, value, dataType, description, updatedBy: null, updatedAt: seedAt });

const seed = (): ConfigItem[] => [
  c('PLATFORM_COMMISSION_RATE', '0.15', 'NUMBER', 'Tỷ lệ hoa hồng nền tảng thu từ điều dưỡng khi quyết toán (không cộng thêm vào giá khách trả).'),
  c('SURCHARGE_NIGHT_SHIFT', '0.2', 'NUMBER', 'Phụ phí ca đêm: áp cho số giờ trong 22:00–06:00, cộng trên giá cơ bản.'),
  c('SURCHARGE_HOLIDAY_MAJOR', '3', 'NUMBER', 'Phụ phí Tết Nguyên đán (3 = +300% giá cơ bản).'),
  c('SURCHARGE_HOLIDAY_MINOR', '2', 'NUMBER', 'Phụ phí các ngày lễ khác (2 = +200% giá cơ bản).'),
  c('SURCHARGE_HEAVY_PATIENT', '0.15', 'NUMBER', 'Phụ phí bệnh nhân nặng: từ 80 kg hoặc nằm tại giường.'),
  c('PAYMENT_TIMEOUT_MINUTES', '15', 'NUMBER', 'Thời gian giữ chỗ chờ khách chuyển khoản; quá hạn → ca hết hạn.'),
  c('SETTLEMENT_COOLING_HOURS', '24', 'NUMBER', 'Số giờ sau check-out trước khi tự quyết toán (cũng là cửa sổ khiếu nại).'),
  c('MIN_BILLABLE_HOURS', '1', 'NUMBER', 'Số giờ tối thiểu được tính tiền khi khách dừng ca sau check-in.'),
  c('URGENT_BOOKING_LEAD_HOURS', '6', 'NUMBER', 'Ca bắt đầu trong vòng số giờ này được ghép theo Radar; xa hơn đăng lên Job Board.'),
  c('RADAR_INITIAL_RADIUS_KM', '5', 'NUMBER', 'Bán kính tìm điều dưỡng ban đầu của Radar.'),
  c('RADAR_EXPANDED_RADIUS_KM', '10', 'NUMBER', 'Bán kính mở rộng của Radar và giới hạn tìm kiếm điều dưỡng.'),
  c('TRAVEL_BUFFER_MINUTES', '60', 'NUMBER', 'Khoảng đệm di chuyển giữa hai ca liên tiếp của điều dưỡng.'),
  c('UNMATCHED_EXPIRY_LEAD_MINUTES', '30', 'NUMBER', 'Chưa ai nhận trước giờ bắt đầu từng này phút → hết hạn và hoàn 100%.'),
  c('DIRECT_REQUEST_WINDOW_MINUTES', '15', 'NUMBER', 'Thời gian độc quyền của điều dưỡng được mời trực tiếp trước khi phát lên Job Board.'),
  c('PRESCRIPTION_MAX_AGE_DAYS', '7', 'NUMBER', 'Y lệnh phải kê trong vòng số ngày này khi đặt thủ thuật xâm lấn.'),
  c('EXTENSION_REQUEST_DEADLINE_MINUTES', '30', 'NUMBER', 'Khách gia hạn được đến trước giờ kết thúc ca từng này phút.'),
  c('MAX_EXTENSION_HOURS', '4', 'NUMBER', 'Số giờ gia hạn tối đa cho mỗi yêu cầu (bước 1 giờ).'),
  c('CUSTOMER_CANCEL_FREE_HOURS', '12', 'NUMBER', 'Khách huỷ trước giờ bắt đầu hơn số giờ này: hoàn 100%.'),
  c('CUSTOMER_CANCEL_LATE_HOURS', '2', 'NUMBER', 'Khách huỷ dưới số giờ này trước giờ bắt đầu: áp phí huỷ sát giờ.'),
  c('CUSTOMER_CANCEL_NEAR_FEE_RATE', '0.2', 'NUMBER', 'Phí huỷ cận giờ (2–12 giờ).'),
  c('CUSTOMER_CANCEL_NEAR_NURSE_RATE', '0.15', 'NUMBER', 'Phần phí huỷ cận giờ đền bù cho điều dưỡng (nền tảng giữ phần còn lại).'),
  c('CUSTOMER_CANCEL_LATE_FEE_RATE', '0.5', 'NUMBER', 'Phí huỷ sát giờ (dưới 2 giờ).'),
  c('CUSTOMER_CANCEL_LATE_NURSE_RATE', '0.4', 'NUMBER', 'Phần phí huỷ sát giờ đền bù cho điều dưỡng.'),
  c('NURSE_CANCEL_FREE_HOURS', '12', 'NUMBER', 'Điều dưỡng huỷ trước giờ bắt đầu hơn số giờ này: trừ ít điểm TrustScore, không phạt tiền.'),
  c('NURSE_LATE_CANCEL_FINE_RATE', '0.2', 'NUMBER', 'Phạt điều dưỡng huỷ gấp: tỷ lệ giá trị ca (chuyển thành thưởng nóng).'),
  c('NO_SHOW_PENALTY', '50000', 'NUMBER', 'Phạt và voucher xin lỗi khi điều dưỡng không đến.'),
  c('NO_SHOW_GRACE_MINUTES', '30', 'NUMBER', 'Quá số phút này sau giờ bắt đầu mà điều dưỡng chưa đến → coi là không đến.'),
  c('ICU_TRAVEL_SUPPORT', '50000', 'NUMBER', 'Hỗ trợ đi lại cho điều dưỡng khi khách huỷ vì bệnh nhân chuyển cấp cứu ICU.'),
  c('CHECKIN_MAX_RADIUS_METERS', '200', 'NUMBER', 'Điều dưỡng phải ở trong bán kính này quanh địa chỉ khi check-in.'),
  c('CHECKIN_OPENS_BEFORE_START_MINUTES', '30', 'NUMBER', 'Cho check-in sớm nhất trước giờ bắt đầu từng này phút.'),
  c('CASH_COMMISSION_DUE_HOURS', '24', 'NUMBER', 'Hạn nộp hoa hồng đơn tiền mặt sau check-out; quá hạn → tạm khoá điều dưỡng.'),
  c('CHAT_CALL_RING_TIMEOUT_SECONDS', '45', 'NUMBER', 'Cuộc gọi trong ứng dụng không trả lời sau từng này giây → nhỡ.'),
  c('MAINTENANCE_EMBARGO_START', '19:00', 'STRING', 'Bắt đầu khung giờ cấm bảo trì/triển khai (giờ Việt Nam).'),
  c('MAINTENANCE_EMBARGO_END', '21:00', 'STRING', 'Kết thúc khung giờ cấm bảo trì (không gồm mốc này).'),
  c('REVIEW_BLIND_DAYS', '7', 'NUMBER', 'Đánh giá ẩn tối đa số ngày hoặc tới khi bên kia đánh giá.'),
  c('REVIEW_WINDOW_DAYS', '7', 'NUMBER', 'Hạn gửi đánh giá sau khi ca kết thúc.'),
  c('TRUST_PENALTY_NURSE_CANCEL_EARLY', '5', 'NUMBER', 'Điểm TrustScore bị trừ khi điều dưỡng huỷ sớm.'),
  c('TRUST_PENALTY_NURSE_CANCEL_LATE', '20', 'NUMBER', 'Điểm TrustScore bị trừ khi điều dưỡng huỷ gấp.'),
  c('TRUST_PENALTY_DISPUTE_UPHELD', '25', 'NUMBER', 'Điểm TrustScore bị trừ khi khiếu nại của khách được chấp nhận.'),
  c('TRUST_RECOVERY_GOOD_RATING', '2', 'NUMBER', 'Điểm TrustScore được cộng mỗi ca được đánh giá tốt.'),
  c('TRUST_RECOVERY_MIN_STARS', '4', 'NUMBER', 'Số sao tối thiểu để được cộng điểm hồi phục.'),
  c('TRUST_SUSPEND_BELOW', '60', 'NUMBER', 'Điều dưỡng ACTIVE có TrustScore dưới mức này bị tự động tạm khoá.'),
  c('DISPUTE_REBUTTAL_HOURS', '24', 'NUMBER', 'Thời hạn bên bị khiếu nại được phản hồi.'),
  c('MIN_NURSE_DEPOSIT', '300000', 'NUMBER', 'Ký quỹ tối thiểu để điều dưỡng được nhận ca.'),
  c('DEPOSIT_WITHHOLD_RATE', '0.3', 'NUMBER', 'Tỷ lệ mỗi khoản chi trả được giữ lại để bù ký quỹ trong thời gian ân hạn.'),
  c('DEPOSIT_GRACE_MAX_SHIFTS', '3', 'NUMBER', 'Số ca chuyển khoản tối đa được nhận khi ký quỹ chưa đủ (ân hạn).'),
  c('PENALTY_APPEAL_DAYS', '3', 'NUMBER', 'Điều dưỡng được kháng cáo khoản phạt ký quỹ trong số ngày này.'),
  c('OTP_MAX_VERIFY_ATTEMPTS', '5', 'NUMBER', 'Số lần nhập sai OTP tối đa trước khi bị khoá.'),
  c('OTP_TTL_SECONDS', '300', 'NUMBER', 'Thời hạn hiệu lực của mã OTP.'),
  c('ACCESS_TOKEN_TTL_MINUTES', '15', 'NUMBER', 'Thời hạn access token.'),
  c('ADMIN_SESSION_IDLE_MINUTES', '30', 'NUMBER', 'Phiên Admin tự hết hạn sau số phút không thao tác.'),
  c('RECORD_ACCESS_EXPIRY_HOURS', '12', 'NUMBER', 'Quyền xem hồ sơ bệnh án của điều dưỡng đóng sau check-out từng này giờ.'),
  c('MEDICAL_RECORD_RETENTION_MONTHS', '24', 'NUMBER', 'Thời gian lưu hồ sơ bệnh án tối đa trước khi ẩn danh hoá.'),
];

const load = () => getUserData<ConfigItem[]>('admin', 'configs', seed());
const hasToken = (h: Headers) => (h.get('Authorization') ?? '').startsWith('Bearer ');
const unauthorized = () => fail(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn');

export const configsHandlers: Record<string, MockHandler> = {
  'GET /api/v1/admin/configs': (_b, { headers }) => {
    if (!hasToken(headers)) return unauthorized();
    return ok({ items: load() });
  },

  'PATCH /api/v1/admin/configs/:key': (body: { value?: unknown; note?: string }, { headers, params }) => {
    if (!hasToken(headers)) return unauthorized();
    const list = load();
    const i = list.findIndex((x) => x.key === params.key);
    if (i < 0) return fail(404, 'CONFIG_NOT_FOUND', 'Không tìm thấy tham số.');
    const value = typeof body?.value === 'string' ? body.value.trim() : '';
    const problem = validateValue(list[i], value);
    if (problem) return fail(400, 'INVALID_CONFIG_VALUE', problem);
    list[i] = { ...list[i], value, updatedBy: { id: 'u-admin', name: 'Admin vận hành' }, updatedAt: new Date().toISOString() };
    setUserData('admin', 'configs', list);
    console.info(`[mock] audit_logs UPDATE_CONFIG · ${params.key} = ${value}${body?.note ? ` (${body.note})` : ''}`);
    return ok(list[i]);
  },
};
