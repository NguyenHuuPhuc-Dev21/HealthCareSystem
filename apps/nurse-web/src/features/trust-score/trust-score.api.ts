import type {
  ReceivedReviewDto,
  TrustScoreDto,
} from '@healthcare-system/shared';
import { apiClient, type ApiResponse } from '../../lib/api-client';
import { USE_MOCK_TRUST_SCORE } from '../../lib/mock-flags';
import * as mockTrustScore from './trust-score.mock';

export async function getTrustScore(): Promise<ApiResponse<TrustScoreDto>> {
  if (USE_MOCK_TRUST_SCORE) {
    try {
      const data = await mockTrustScore.mockGetTrustScore();
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null as unknown as TrustScoreDto,
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Lỗi tải điểm TrustScore',
        },
      };
    }
  }
  return apiClient<TrustScoreDto>('/nurse/trust-score');
}

export async function getReceivedReviews(): Promise<ApiResponse<ReceivedReviewDto[]>> {
  if (USE_MOCK_TRUST_SCORE) {
    try {
      const data = await mockTrustScore.mockGetReceivedReviews();
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Lỗi tải đánh giá nhận được',
        },
      };
    }
  }
  return apiClient<ReceivedReviewDto[]>('/nurse/reviews/received');
}
