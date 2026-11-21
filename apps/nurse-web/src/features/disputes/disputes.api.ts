import type {
  DisputeDto,
  OpenDisputeInput,
  PresignedUploadUrlDto,
} from '@healthcare-system/shared';
import { apiClient, type ApiResponse } from '../../lib/api-client';
import { USE_MOCK_DISPUTES } from '../../lib/mock-flags';
import * as mockDisputes from './disputes.mock';

/**
 * Lấy danh sách các khiếu nại liên quan đến điều dưỡng hiện tại
 */
export async function getMyDisputes(): Promise<ApiResponse<DisputeDto[]>> {
  if (USE_MOCK_DISPUTES) {
    try {
      const data = await mockDisputes.mockGetMyDisputes();
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Lỗi tải danh sách khiếu nại',
        },
      };
    }
  }
  return apiClient<DisputeDto[]>('/nurse/disputes');
}

/**
 * Lấy chi tiết một khiếu nại cụ thể
 */
export async function getDispute(id: string): Promise<ApiResponse<DisputeDto>> {
  if (USE_MOCK_DISPUTES) {
    try {
      const data = await mockDisputes.mockGetDispute(id);
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null as any,
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Không thể tải chi tiết khiếu nại',
        },
      };
    }
  }
  return apiClient<DisputeDto>(`/disputes/${id}`);
}

/**
 * Điều dưỡng mở khiếu nại mới cho ca trực (FR-DISP-01)
 */
export async function openDispute(
  bookingId: string,
  input: OpenDisputeInput
): Promise<ApiResponse<{ dispute_id: string }>> {
  if (USE_MOCK_DISPUTES) {
    try {
      const data = await mockDisputes.mockOpenDispute(bookingId, input);
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null as any,
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Gửi khiếu nại thất bại',
        },
      };
    }
  }
  return apiClient<{ dispute_id: string }>(`/bookings/${bookingId}/disputes`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Lấy danh sách Presigned Upload URLs để tải lên bằng chứng
 */
export async function getEvidenceUploadUrls(
  disputeId: string,
  fileNames: string[]
): Promise<ApiResponse<PresignedUploadUrlDto[]>> {
  if (USE_MOCK_DISPUTES) {
    try {
      const data = await mockDisputes.mockGetEvidenceUploadUrls(disputeId, fileNames);
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Lỗi tạo liên kết tải tệp',
        },
      };
    }
  }
  return apiClient<PresignedUploadUrlDto[]>(`/disputes/${disputeId}/evidence-upload-urls`, {
    method: 'POST',
    body: JSON.stringify({ file_names: fileNames }),
  });
}

/**
 * Điều dưỡng gửi văn bản phản hồi và bằng chứng gỡ bỏ cáo buộc (Rebuttal)
 */
export async function submitDisputeRebuttal(
  disputeId: string,
  rebuttal: string,
  evidenceUrls: string[] = []
): Promise<ApiResponse<{ updated: boolean }>> {
  if (USE_MOCK_DISPUTES) {
    try {
      const data = await mockDisputes.mockSubmitDisputeRebuttal(disputeId, rebuttal, evidenceUrls);
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null as any,
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Gửi phản hồi khiếu nại thất bại',
        },
      };
    }
  }
  return apiClient<{ updated: boolean }>(`/disputes/${disputeId}/rebuttal`, {
    method: 'POST',
    body: JSON.stringify({ rebuttal, evidence_urls: evidenceUrls }),
  });
}
