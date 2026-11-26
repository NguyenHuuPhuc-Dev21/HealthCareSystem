import { apiClient } from '../../lib/api-client';

/**
 * Đánh giá hai chiều (FR-RATE-01) — khớp docs/api/reviews-trustscore.api.md.
 * Đánh giá được mở ngay khi ca `COMPLETED` (không chờ quyết toán), trong `REVIEW_WINDOW_DAYS` (7 ngày);
 * ở chế độ "đánh giá ẩn": chỉ hiển thị công khai khi cả hai bên đã đánh giá hoặc sau 7 ngày.
 */

export interface CreateReviewInput {
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string; // tối đa 500 ký tự
  tags?: string[]; // tối đa 10, mỗi tag 1–40 ký tự
}

export interface CreateReviewResult {
  review_id: string;
  /** true khi đây là đánh giá của bên thứ hai → cả hai cùng hiển thị */
  isVisible: boolean;
}

/** POST /bookings/:id/reviews */
export function submitReview(bookingId: string, input: CreateReviewInput) {
  return apiClient<CreateReviewResult>(`/bookings/${bookingId}/reviews`, { method: 'POST', body: JSON.stringify(input) });
}

export const REVIEW_COMMENT_MAX = 500;
export const REVIEW_WINDOW_DAYS = 7; // chỉ để hiển thị hạn; backend mới là nơi kiểm tra (REVIEW_WINDOW_CLOSED)

/** Gợi ý nhanh cho khách khi đánh giá điều dưỡng. */
export const REVIEW_TAGS = ['Đúng giờ', 'Chuyên nghiệp', 'Nhẹ nhàng, kiên nhẫn', 'Giải thích rõ ràng', 'Cẩn thận, an toàn', 'Gọn gàng, sạch sẽ'];

export const RATING_TEXT: Record<number, string> = {
  1: 'Rất không hài lòng',
  2: 'Không hài lòng',
  3: 'Bình thường',
  4: 'Hài lòng',
  5: 'Rất hài lòng',
};

/**
 * Backend không có endpoint "ca nào khách đã đánh giá" → ghi nhớ tạm trong trình duyệt để ẩn nút sau khi đã đánh giá.
 * Chỉ là tiện ích hiển thị; nguồn sự thật là lỗi 409 ALREADY_REVIEWED từ backend.
 */
const KEY = 'reviewed-bookings';
export function wasReviewed(bookingId: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]).includes(bookingId);
  } catch {
    return false;
  }
}
export function rememberReviewed(bookingId: string) {
  try {
    const list = new Set<string>(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
    list.add(bookingId);
    localStorage.setItem(KEY, JSON.stringify([...list].slice(-200)));
  } catch {
    /* localStorage bị chặn — bỏ qua */
  }
}
