/**
 * Mock đánh giá — khớp docs/api/reviews-trustscore.api.md.
 *   POST /bookings/:id/reviews { rating 1–5, comment ≤ 500, tags ≤ 10 }
 *     → 201 { review_id, isVisible: false }   (đánh giá ẩn cho tới khi bên kia đánh giá hoặc sau 7 ngày)
 *   Lỗi: 404 BOOKING_NOT_FOUND · 422 BOOKING_NOT_COMPLETED · 422 REVIEW_WINDOW_CLOSED · 409 ALREADY_REVIEWED · 400 VALIDATION_ERROR
 */

import { loadMockBookings, unauthorized } from './booking.handlers';
import { fail } from './mock-fetch';
import type { MockHandler } from './mock-fetch';
import { getUserData, setUserData, userIdFromHeaders } from './mock-db';

const WINDOW_MS = 7 * 24 * 3_600_000;

export const reviewHandlers: Record<string, MockHandler> = {
  'POST /api/v1/bookings/:id/reviews': (body: { rating?: unknown; comment?: unknown; tags?: unknown }, { headers, params }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    const b = loadMockBookings(userId).find((x) => x.id === params.id);
    if (!b) return fail(404, 'BOOKING_NOT_FOUND', 'Không tìm thấy ca.');

    const rating = body?.rating;
    if (!Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) return fail(400, 'VALIDATION_ERROR', 'Điểm đánh giá phải từ 1 đến 5.');
    if (typeof body.comment === 'string' && body.comment.length > 500) return fail(400, 'VALIDATION_ERROR', 'Nhận xét tối đa 500 ký tự.');
    if (body.tags !== undefined && (!Array.isArray(body.tags) || body.tags.length > 10 || body.tags.some((t) => typeof t !== 'string' || t.length < 1 || t.length > 40))) {
      return fail(400, 'VALIDATION_ERROR', 'Thẻ nhanh không hợp lệ.');
    }
    if (b.executionStatus !== 'COMPLETED') return fail(422, 'BOOKING_NOT_COMPLETED', 'Chỉ đánh giá được khi ca đã hoàn thành.');
    if (Date.now() - Date.parse(b.endAt) > WINDOW_MS) return fail(422, 'REVIEW_WINDOW_CLOSED', 'Đã quá 7 ngày kể từ khi ca kết thúc nên không thể đánh giá.');

    const done = getUserData<string[]>(userId, 'reviewed', []);
    if (done.includes(b.id)) return fail(409, 'ALREADY_REVIEWED', 'Bạn đã đánh giá ca này rồi.');
    setUserData(userId, 'reviewed', [...done, b.id]);
    return { status: 201, body: { success: true, data: { review_id: crypto.randomUUID(), isVisible: false } } };
  },
};
