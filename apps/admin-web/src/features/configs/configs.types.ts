/**
 * Tham số hệ thống `system_configs` (SRS §5.1, Annex A) — đổi được không cần triển khai lại; mọi lần đổi ghi `audit_logs` với `updated_by`.
 *
 * ⚠️ Backend `admin-configs` (BE-1, Phase 7) CHƯA có tài liệu contract — hình dạng dưới đây là ĐỀ XUẤT (camelCase, bám các cột
 * của bảng `system_configs`: config_key, config_value, data_type, description, updated_by, updated_at) và cần BE-1 xác nhận.
 */

export type ConfigDataType = 'NUMBER' | 'STRING' | 'BOOLEAN' | 'JSON';

export interface ConfigItem {
  key: string;
  /** Giá trị lưu dạng chuỗi (VARCHAR 500) */
  value: string;
  dataType: ConfigDataType;
  description: string | null;
  /** null = giá trị seed ban đầu (chưa ai đổi) */
  updatedBy: { id: string; name: string } | null;
  updatedAt: string;
}

export interface ConfigRule {
  /** Cách hiển thị giá trị cho dễ đọc */
  kind: 'percent' | 'money' | 'minutes' | 'hours' | 'days' | 'seconds' | 'km' | 'meters' | 'count' | 'time' | 'plain';
  /** Khoảng hợp lệ (chỉ cảnh báo ở giao diện; backend mới là nơi quyết định) */
  min?: number;
  max?: number;
  integer?: boolean;
}

/** Quy tắc theo tên khoá — suy từ hậu tố/tiền tố tên và các giá trị mặc định trong packages/shared/src/config-keys.ts. */
export function ruleFor(key: string, dataType: ConfigDataType): ConfigRule {
  if (dataType === 'BOOLEAN' || dataType === 'JSON') return { kind: 'plain' };
  if (dataType === 'STRING') return { kind: /EMBARGO_(START|END)$/.test(key) ? 'time' : 'plain' };
  if (key.startsWith('SURCHARGE_')) return { kind: 'percent', min: 0, max: 10 };
  if (key.endsWith('_RATE')) return { kind: 'percent', min: 0, max: 1 };
  if (key.endsWith('_MINUTES')) return { kind: 'minutes', min: 0, integer: true };
  if (key.endsWith('_HOURS') || key === 'MIN_BILLABLE_HOURS') return { kind: 'hours', min: 0, integer: true };
  if (key.endsWith('_DAYS')) return { kind: 'days', min: 0, integer: true };
  if (key.endsWith('_SECONDS')) return { kind: 'seconds', min: 0, integer: true };
  if (key.endsWith('_KM')) return { kind: 'km', min: 0 };
  if (key.endsWith('_METERS')) return { kind: 'meters', min: 0, integer: true };
  if (/(DEPOSIT|PENALTY|SUPPORT)$/.test(key) && !key.startsWith('TRUST_') && !key.startsWith('NURSE_')) return { kind: 'money', min: 0, integer: true };
  if (key.startsWith('TRUST_') || key.includes('MAX_') || key.includes('_SHIFTS') || key === 'OTP_LENGTH') return { kind: 'count', min: 0, integer: true };
  return { kind: 'plain', min: 0 };
}

const nf = new Intl.NumberFormat('vi-VN');

/** Hiển thị giá trị dễ đọc kèm đơn vị. */
export function displayValue(c: Pick<ConfigItem, 'key' | 'value' | 'dataType'>): string {
  if (c.dataType === 'BOOLEAN') return c.value === 'true' ? 'Bật' : 'Tắt';
  const rule = ruleFor(c.key, c.dataType);
  const n = Number(c.value);
  if (c.dataType !== 'NUMBER' || Number.isNaN(n)) return c.value;
  switch (rule.kind) {
    case 'percent': return `${nf.format(Math.round(n * 10_000) / 100)}%`;
    case 'money': return `${nf.format(n)} ₫`;
    case 'minutes': return `${nf.format(n)} phút`;
    case 'hours': return `${nf.format(n)} giờ`;
    case 'days': return `${nf.format(n)} ngày`;
    case 'seconds': return `${nf.format(n)} giây`;
    case 'km': return `${nf.format(n)} km`;
    case 'meters': return `${nf.format(n)} m`;
    default: return nf.format(n);
  }
}

/** Kiểm tra giá trị nhập theo kiểu dữ liệu; trả về thông báo lỗi hoặc null. */
export function validateValue(c: Pick<ConfigItem, 'key' | 'dataType'>, raw: string): string | null {
  const v = raw.trim();
  if (c.dataType === 'BOOLEAN') return v === 'true' || v === 'false' ? null : 'Chọn Bật hoặc Tắt.';
  if (c.dataType === 'JSON') {
    try {
      JSON.parse(v);
      return null;
    } catch {
      return 'Không phải JSON hợp lệ.';
    }
  }
  if (v === '') return 'Không được để trống.';
  if (v.length > 500) return 'Tối đa 500 ký tự.';
  const rule = ruleFor(c.key, c.dataType);
  if (rule.kind === 'time') return /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? null : 'Nhập giờ dạng HH:mm (vd. 19:00).';
  if (c.dataType === 'STRING') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return 'Nhập một số.';
  if (rule.integer && !Number.isInteger(n)) return 'Cần là số nguyên.';
  if (rule.min !== undefined && n < rule.min) return `Không được nhỏ hơn ${rule.min}.`;
  if (rule.max !== undefined && n > rule.max) return rule.kind === 'percent' ? `Tối đa ${rule.max * 100}% (nhập ${rule.max} = ${rule.max * 100}%).` : `Không được lớn hơn ${rule.max}.`;
  return null;
}

/** Khoá có ảnh hưởng tiền/an toàn lớn → cần xác nhận kỹ trước khi lưu. */
export const CRITICAL_KEYS = new Set([
  'PLATFORM_COMMISSION_RATE', 'MIN_NURSE_DEPOSIT', 'SURCHARGE_NIGHT_SHIFT', 'SURCHARGE_HOLIDAY_MAJOR', 'SURCHARGE_HOLIDAY_MINOR', 'SURCHARGE_HEAVY_PATIENT',
  'PAYMENT_TIMEOUT_MINUTES', 'SETTLEMENT_COOLING_HOURS', 'CHECKIN_MAX_RADIUS_METERS', 'TRUST_SUSPEND_BELOW', 'NO_SHOW_PENALTY', 'ICU_TRAVEL_SUPPORT',
  'CUSTOMER_CANCEL_FREE_HOURS', 'CUSTOMER_CANCEL_NEAR_FEE_RATE', 'CUSTOMER_CANCEL_LATE_FEE_RATE', 'ADMIN_SESSION_IDLE_MINUTES', 'OTP_MAX_VERIFY_ATTEMPTS',
]);

export type ConfigGroup = 'Tài chính & phụ phí' | 'Đặt chỗ & ghép ca' | 'Huỷ lịch & đền bù' | 'Ca làm việc' | 'Đánh giá, TrustScore & khiếu nại' | 'Ký quỹ' | 'Xác thực & phiên' | 'Quyền riêng tư' | 'Khác';

export const GROUP_ORDER: ConfigGroup[] = ['Tài chính & phụ phí', 'Đặt chỗ & ghép ca', 'Huỷ lịch & đền bù', 'Ca làm việc', 'Đánh giá, TrustScore & khiếu nại', 'Ký quỹ', 'Xác thực & phiên', 'Quyền riêng tư', 'Khác'];

export function groupOfKey(key: string): ConfigGroup {
  if (/^(PLATFORM_COMMISSION|SURCHARGE_|PAYMENT_TIMEOUT|SETTLEMENT_|MIN_BILLABLE)/.test(key)) return 'Tài chính & phụ phí';
  if (/^(CUSTOMER_CANCEL|NURSE_CANCEL|NURSE_LATE|NO_SHOW|ICU_)/.test(key)) return 'Huỷ lịch & đền bù';
  if (/^(RADAR_|URGENT_|UNMATCHED_|DIRECT_REQUEST|TRAVEL_BUFFER|PRESCRIPTION_|EXTENSION_|MAX_EXTENSION)/.test(key)) return 'Đặt chỗ & ghép ca';
  if (/^(CHECKIN_|CONDITION_|CHECKOUT_|CASH_COMMISSION|CHAT_|MAINTENANCE_)/.test(key)) return 'Ca làm việc';
  if (/^(REVIEW_|TRUST_|DISPUTE_)/.test(key)) return 'Đánh giá, TrustScore & khiếu nại';
  if (/^(MIN_NURSE_DEPOSIT|DEPOSIT_|PENALTY_APPEAL)/.test(key)) return 'Ký quỹ';
  if (/^(OTP_|ACCESS_TOKEN|REFRESH_TOKEN|ADMIN_SESSION)/.test(key)) return 'Xác thực & phiên';
  if (/^(RECORD_|MEDICAL_RECORD)/.test(key)) return 'Quyền riêng tư';
  return 'Khác';
}
