import type {
  CreateReviewInput,
  PendingReviewDto,
  SentReviewDto,
} from '@healthcare-system/shared';
import { apiClient, type ApiResponse } from '../../lib/api-client';
import { env } from '../../lib/env';
import * as mockReviews from './reviews.mock';

export const resetReviewsMockState = mockReviews.resetReviewsMockState;
export const mockSetReviewErrorForTesting = mockReviews.mockSetReviewErrorForTesting;

export async function getPendingReviews(): Promise<ApiResponse<PendingReviewDto[]>> {
  if (env.useMockReviews) {
    try {
      const data = await mockReviews.mockGetPendingReviews();
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        error: {
          code: err?.code || 'UNKNOWN_ERROR',
          message: err?.message || 'Lỗi tải danh sách ca chờ đánh giá',
        },
      };
    }
  }
  return apiClient<PendingReviewDto[]>('/nurse/reviews/pending');
}

export async function getSentReviews(): Promise<ApiResponse<SentReviewDto[]>> {
  if (env.useMockReviews) {
    try {
      const data = await mockReviews.mockGetSentReviews();
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        error: {
          code: err?.code || 'UNKNOWN_ERROR',
          message: err?.message || 'Lỗi tải danh sách đánh giá đã gửi',
        },
      };
    }
  }
  return apiClient<SentReviewDto[]>('/nurse/reviews/sent');
}

export async function submitCustomerRating(
  bookingId: string,
  input: CreateReviewInput
): Promise<ApiResponse<{ review_id: string }>> {
  if (env.useMockReviews) {
    try {
      const data = await mockReviews.mockSubmitCustomerRating(bookingId, input);
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null as unknown as { review_id: string },
        error: {
          code: err?.code || 'UNKNOWN_ERROR',
          message: err?.message || 'Gửi đánh giá khách hàng thất bại',
        },
      };
    }
  }

  return apiClient<{ review_id: string }>(`/bookings/${bookingId}/reviews`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
