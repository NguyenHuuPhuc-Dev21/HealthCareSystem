import type {
  CreateReviewInput,
  PendingReviewDto,
  SentReviewDto,
} from '@healthcare-system/shared';
import { apiClient, type ApiResponse } from '../../lib/api-client';
import { USE_MOCK_REVIEWS } from '../../lib/mock-flags';
import * as mockReviews from './reviews.mock';

/**
 * Lấy danh sách các ca đã hoàn tất nhưng điều dưỡng chưa đánh giá khách hàng
 */
export async function getPendingReviews(): Promise<ApiResponse<PendingReviewDto[]>> {
  if (USE_MOCK_REVIEWS) {
    try {
      const data = await mockReviews.mockGetPendingReviews();
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Lỗi tải danh sách ca chờ đánh giá',
        },
      };
    }
  }
  return apiClient<PendingReviewDto[]>('/nurse/reviews/pending');
}

/**
 * Lấy danh sách đánh giá mà điều dưỡng đã gửi cho khách hàng
 */
export async function getSentReviews(): Promise<ApiResponse<SentReviewDto[]>> {
  if (USE_MOCK_REVIEWS) {
    try {
      const data = await mockReviews.mockGetSentReviews();
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Lỗi tải danh sách đánh giá đã gửi',
        },
      };
    }
  }
  return apiClient<SentReviewDto[]>('/nurse/reviews/sent');
}

/**
 * Điều dưỡng gửi đánh giá 1–5 sao cho khách hàng sau ca trực (FR-RATE-01)
 */
export async function submitCustomerRating(
  bookingId: string,
  input: CreateReviewInput
): Promise<ApiResponse<{ review_id: string }>> {
  if (USE_MOCK_REVIEWS) {
    try {
      const data = await mockReviews.mockSubmitCustomerRating(bookingId, input);
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null as any,
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Gửi đánh giá khách hàng thất bại',
        },
      };
    }
  }

  return apiClient<{ review_id: string }>(`/bookings/${bookingId}/reviews`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
