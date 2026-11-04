import type { ApiError } from '../../lib/api-client';
import { AuthErrorCode } from './auth.types';

export interface AuthMessage {
  title: string;
  detail?: string;
}

function readNumber(details: unknown, key: string): number | undefined {
  if (details && typeof details === 'object' && key in details) {
    const value = (details as Record<string, unknown>)[key];
    return typeof value === 'number' ? value : undefined;
  }
  return undefined;
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} giây`;
  return `${Math.ceil(seconds / 60)} phút`;
}

/** Đổi mã lỗi backend thành câu tiếng Việt hiển thị cho người dùng. */
export function getAuthErrorMessage(error?: ApiError): AuthMessage {
  switch (error?.code) {
    case AuthErrorCode.INVALID_PHONE:
      return { title: 'Số điện thoại không hợp lệ.', detail: 'Vui lòng nhập số di động Việt Nam gồm 10 chữ số.' };

    case AuthErrorCode.OTP_RATE_LIMITED: {
      const wait = readNumber(error.details, 'retry_after_sec');
      return {
        title: 'Bạn đã yêu cầu mã quá nhiều lần.',
        detail: wait ? `Vui lòng thử lại sau ${formatWait(wait)}.` : 'Vui lòng thử lại sau ít phút.',
      };
    }

    case AuthErrorCode.OTP_INVALID: {
      const left = readNumber(error.details, 'attempts_left');
      return {
        title: left !== undefined ? `Mã không đúng — còn ${left} lần thử.` : 'Mã không đúng.',
        detail: 'Nếu không nhận được mã, bạn có thể gửi lại sau khi hết đếm ngược.',
      };
    }

    case AuthErrorCode.OTP_EXPIRED:
      return { title: 'Mã OTP đã hết hạn.', detail: 'Vui lòng bấm "Gửi lại mã" để nhận mã mới.' };

    case AuthErrorCode.OTP_TOO_MANY_ATTEMPTS:
      return { title: 'Bạn đã nhập sai quá số lần cho phép.', detail: 'Vui lòng gửi lại mã để nhận mã mới.' };

    case AuthErrorCode.NETWORK_ERROR:
      return { title: 'Không kết nối được máy chủ.', detail: 'Vui lòng kiểm tra mạng và thử lại.' };

    default:
      return { title: error?.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.' };
  }
}
