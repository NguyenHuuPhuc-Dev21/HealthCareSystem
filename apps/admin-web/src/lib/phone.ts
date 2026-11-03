/**
 * Tiện ích số điện thoại di động Việt Nam.
 * Đầu số di động hiện hành: 03x, 05x, 07x, 08x, 09x (10 chữ số tính cả số 0).
 */

const VN_MOBILE_LOCAL = /^(3|5|7|8|9)\d{8}$/;

/** Chỉ giữ chữ số, tối đa 10 số, nhóm dạng "0905 123 456" để hiển thị trong ô nhập. */
export function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

/**
 * Chuẩn hoá về E.164 (+84xxxxxxxxx) để gửi backend.
 * Trả về null nếu không phải số di động Việt Nam hợp lệ.
 */
export function normalizeVnPhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('84')) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('0')) digits = digits.slice(1);
  return VN_MOBILE_LOCAL.test(digits) ? `+84${digits}` : null;
}

/** "+84905123456" → "0905 ••• 456" (che giữa số như thiết kế SH2). */
export function maskPhone(e164: string): string {
  const local = `0${e164.replace(/^\+84/, '')}`;
  return `${local.slice(0, 4)} ••• ${local.slice(-3)}`;
}
