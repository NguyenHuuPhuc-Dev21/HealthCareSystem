import type { ApiError } from './api-client';

/** Câu thông báo lỗi chung cho các API không có bảng mã lỗi riêng. */
export function getErrorMessage(error?: ApiError, fallback = 'Đã có lỗi xảy ra. Vui lòng thử lại.'): string {
  if (!error) return fallback;
  if (error.code === 'NETWORK_ERROR') return 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.';
  if (error.code === 'HTTP_403') return 'Bạn không có quyền thực hiện thao tác này.';
  return error.message || fallback;
}
