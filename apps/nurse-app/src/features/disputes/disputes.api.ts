import type {
  DisputeDto,
  OpenDisputeInput,
  PresignedUploadUrlDto,
} from '@healthcare-system/shared';
import { apiClient, type ApiResponse } from '../../lib/api-client';
import { env } from '../../lib/env';
import * as mockDisputes from './disputes.mock';

export const resetDisputesMockState = mockDisputes.resetDisputesMockState;

export async function getMyDisputes(): Promise<ApiResponse<DisputeDto[]>> {
  if (env.useMockDisputes) {
    try {
      const data = await mockDisputes.mockGetMyDisputes();
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        error: {
          code: err?.code || 'UNKNOWN_ERROR',
          message: err?.message || 'Lỗi tải danh sách khiếu nại',
        },
      };
    }
  }
  return apiClient<DisputeDto[]>('/nurse/disputes');
}

export async function getDispute(id: string): Promise<ApiResponse<DisputeDto>> {
  if (env.useMockDisputes) {
    try {
      const data = await mockDisputes.mockGetDispute(id);
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null as unknown as DisputeDto,
        error: {
          code: err?.code || 'UNKNOWN_ERROR',
          message: err?.message || 'Không thể tải chi tiết khiếu nại',
        },
      };
    }
  }
  return apiClient<DisputeDto>(`/disputes/${id}`);
}

export async function openDispute(
  bookingId: string,
  input: OpenDisputeInput
): Promise<ApiResponse<{ dispute_id: string }>> {
  if (env.useMockDisputes) {
    try {
      const data = await mockDisputes.mockOpenDispute(bookingId, input);
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null as unknown as { dispute_id: string },
        error: {
          code: err?.code || 'UNKNOWN_ERROR',
          message: err?.message || 'Gửi khiếu nại thất bại',
        },
      };
    }
  }
  return apiClient<{ dispute_id: string }>(`/bookings/${bookingId}/disputes`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getEvidenceUploadUrls(
  disputeId: string,
  fileNames: string[]
): Promise<ApiResponse<PresignedUploadUrlDto[]>> {
  if (env.useMockDisputes) {
    try {
      const data = await mockDisputes.mockGetEvidenceUploadUrls(disputeId, fileNames);
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        error: {
          code: err?.code || 'UNKNOWN_ERROR',
          message: err?.message || 'Lỗi tạo liên kết tải tệp',
        },
      };
    }
  }
  return apiClient<PresignedUploadUrlDto[]>(
    `/disputes/${disputeId}/evidence-upload-urls`,
    {
      method: 'POST',
      body: JSON.stringify({ file_names: fileNames }),
    }
  );
}

export async function submitDisputeRebuttal(
  disputeId: string,
  rebuttal: string,
  evidenceUrls: string[] = []
): Promise<ApiResponse<{ updated: boolean }>> {
  if (env.useMockDisputes) {
    try {
      const data = await mockDisputes.mockSubmitDisputeRebuttal(
        disputeId,
        rebuttal,
        evidenceUrls
      );
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: { updated: false },
        error: {
          code: err?.code || 'UNKNOWN_ERROR',
          message: err?.message || 'Gửi phản hồi thất bại',
        },
      };
    }
  }
  return apiClient<{ updated: boolean }>(`/disputes/${disputeId}/rebuttal`, {
    method: 'POST',
    body: JSON.stringify({
      content: rebuttal,
      evidenceUrls,
    }),
  });
}
