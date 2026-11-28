/**
 * Bộ quét phát hiện rò rỉ số điện thoại, liên kết ngoài và giao dịch ngoài nền tảng (FR-CHAT-01).
 * Dùng chung giữa Nurse Web, Patient Web/App và Admin Console (A16).
 */

export interface ContactDetectionResult {
  hasOffPlatformContact: boolean;
  reasons: Array<'PHONE_NUMBER' | 'EXTERNAL_LINK' | 'OFF_PLATFORM_PAYMENT'>;
  matches: string[];
  warningMessage?: string;
}

// Regex phát hiện số điện thoại chuẩn Việt Nam và dạng tách chữ số
const VN_PHONE_REGEX =
  /(?:(?:\+84|84|0)[3|5|7|8|9])(?:[\s.-]?\d){8}\b/g;

// Regex phát hiện chuỗi chữ số liên tiếp hoặc tách khoảng trắng dài từ 9 đến 11 số bắt đầu bằng 0
const OBFUSCATED_DIGITS_REGEX =
  /\b0(?:[\s.-]*\d){8,10}\b/g;

// Regex phát hiện URL hoặc tên miền mạng xã hội
const URL_REGEX =
  /(?:https?:\/\/|www\.)[^\s/$.?#].[^\s]*|\b(?:facebook\.com|fb\.com|fb\.me|zalo\.me|t\.me|telegram\.me)(?:\/[^\s]*)?/gi;

// Từ khóa giao dịch ngoài nền tảng
const PAYMENT_KEYWORDS = [
  'chuyển khoản',
  'chuyen khoan',
  'stk',
  'số tài khoản',
  'so tai khoan',
  'bắn tiền',
  'ban tien',
  'momo',
  'zalopay',
  'viettelpay',
  'trả riêng',
  'tra rieng',
  'thanh toán ngoài',
  'thanh toan ngoai',
  'giao dịch ngoài',
  'giao dich ngoai',
];

/**
 * Quét nội dung tin nhắn để phát hiện số điện thoại, link hoặc thanh toán ngoài nền tảng.
 */
export function detectOffPlatformContact(text: string): ContactDetectionResult {
  if (!text || typeof text !== 'string') {
    return { hasOffPlatformContact: false, reasons: [], matches: [] };
  }

  const matches: string[] = [];
  const reasons: Array<'PHONE_NUMBER' | 'EXTERNAL_LINK' | 'OFF_PLATFORM_PAYMENT'> = [];

  // 1. Quét số điện thoại
  const phoneMatches = text.match(VN_PHONE_REGEX);
  if (phoneMatches && phoneMatches.length > 0) {
    phoneMatches.forEach((m) => matches.push(m.trim()));
    if (!reasons.includes('PHONE_NUMBER')) reasons.push('PHONE_NUMBER');
  }

  // Quét thêm dạng số cố tình cách chữ số (0 9 0 5 ...)
  const obfuscatedMatches = text.match(OBFUSCATED_DIGITS_REGEX);
  if (obfuscatedMatches && obfuscatedMatches.length > 0) {
    obfuscatedMatches.forEach((m) => {
      const clean = m.replace(/[\s.-]/g, '');
      if (clean.length >= 9 && clean.length <= 11 && !matches.includes(m.trim())) {
        matches.push(m.trim());
        if (!reasons.includes('PHONE_NUMBER')) reasons.push('PHONE_NUMBER');
      }
    });
  }

  // 2. Quét liên kết mạng xã hội
  const urlMatches = text.match(URL_REGEX);
  if (urlMatches && urlMatches.length > 0) {
    urlMatches.forEach((m) => matches.push(m.trim()));
    if (!reasons.includes('EXTERNAL_LINK')) reasons.push('EXTERNAL_LINK');
  }

  // 3. Quét từ khóa thanh toán ngoài
  const lowerText = text.toLowerCase();
  for (const kw of PAYMENT_KEYWORDS) {
    if (lowerText.includes(kw)) {
      matches.push(kw);
      if (!reasons.includes('OFF_PLATFORM_PAYMENT')) reasons.push('OFF_PLATFORM_PAYMENT');
    }
  }

  const hasOffPlatformContact = reasons.length > 0;

  let warningMessage: string | undefined;
  if (hasOffPlatformContact) {
    const parts: string[] = [];
    if (reasons.includes('PHONE_NUMBER')) parts.push('số điện thoại cá nhân');
    if (reasons.includes('EXTERNAL_LINK')) parts.push('liên kết bên ngoài');
    if (reasons.includes('OFF_PLATFORM_PAYMENT')) parts.push('gợi ý giao dịch ngoài ứng dụng');

    warningMessage = `Phát hiện ${parts.join(', ')}. Quy định CareNest (FR-CHAT-01) yêu cầu liên lạc và thanh toán an toàn trực tiếp trên hệ thống để được bảo vệ quyền lợi.`;
  }

  return {
    hasOffPlatformContact,
    reasons,
    matches,
    warningMessage,
  };
}

/**
 * Che số điện thoại theo định dạng chuẩn: 0905 ••• 123 hoặc 09•• ••• 123
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || typeof phone !== 'string') return '••• ••• •••';
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 9) return '••• ••• •••';

  const prefix = clean.slice(0, 4);
  const suffix = clean.slice(-3);
  return `${prefix} ••• ${suffix}`;
}
