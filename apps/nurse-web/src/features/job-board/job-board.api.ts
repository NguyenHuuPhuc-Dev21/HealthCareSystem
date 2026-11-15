import { apiClient } from '../../lib/api-client';
import { USE_MOCK_JOB_BOARD } from '../../lib/mock-flags';
import {
    mockAcceptDirectInvite,
    mockAcceptJob,
    mockAcceptRadar,
    mockDeclineDirectInvite,
    mockDismissRadar,
    mockFetchDirectInvite,
    mockFetchJobBoard,
    mockFetchJobById,
    mockFetchRadarJob,
} from './job-board.mock';
import type { ClaimJobResult, DirectInvitation, JobItem, RadarJob } from './job-board.types';

export async function getJobBoard(): Promise<{ success: boolean; data: JobItem[]; message?: string }> {
    if (USE_MOCK_JOB_BOARD) {
        const jobs = await mockFetchJobBoard();
        return { success: true, data: jobs };
    }
    const res = await apiClient<JobItem[]>('/nurse/job-board');
    return { success: res.success, data: res.data ?? [], message: res.error?.message };
}

export async function getJobById(jobId: string): Promise<{ success: boolean; data: JobItem | null; message?: string }> {
    if (USE_MOCK_JOB_BOARD) {
        const job = await mockFetchJobById(jobId);
        return { success: !!job, data: job, message: job ? undefined : 'Không tìm thấy ca làm việc.' };
    }
    const res = await apiClient<JobItem>(`/nurse/job-board/${jobId}`);
    return { success: res.success, data: res.data ?? null, message: res.error?.message };
}

export async function getDirectInvitation(): Promise<{
    success: boolean;
    data: DirectInvitation | null;
}> {
    if (USE_MOCK_JOB_BOARD) {
        const invite = await mockFetchDirectInvite();
        return { success: true, data: invite };
    }
    const res = await apiClient<DirectInvitation | null>('/nurse/direct-invitation');
    return { success: res.success, data: res.data ?? null };
}

export async function getRadarJob(): Promise<{ success: boolean; data: RadarJob | null }> {
    if (USE_MOCK_JOB_BOARD) {
        const radar = await mockFetchRadarJob();
        return { success: true, data: radar };
    }
    const res = await apiClient<RadarJob | null>('/nurse/radar');
    return { success: res.success, data: res.data ?? null };
}

export async function acceptJob(
    bookingId: string,
    nurseTier: string,
    depositBalance = 300000,
): Promise<ClaimJobResult> {
    if (USE_MOCK_JOB_BOARD) {
        return mockAcceptJob(bookingId, nurseTier, depositBalance);
    }
    const res = await apiClient<{ success: boolean; booking_id: string }>(
        `/bookings/${bookingId}/accept`,
        { method: 'POST' },
    );
    if (!res.success) {
        return {
            success: false,
            message: res.error?.message ?? 'Nhận ca thất bại, vui lòng thử lại.',
        };
    }
    return { success: true, bookingId: res.data?.booking_id };
}

export async function acceptDirectInvite(
    bookingId: string,
    nurseTier: string,
    depositBalance = 300000,
): Promise<ClaimJobResult> {
    if (USE_MOCK_JOB_BOARD) {
        return mockAcceptDirectInvite(bookingId, nurseTier, depositBalance);
    }
    const res = await apiClient<{ success: boolean }>(
        `/bookings/${bookingId}/accept-direct-invite`,
        { method: 'POST' },
    );
    return { success: res.success, bookingId, message: res.error?.message };
}

export async function declineDirectInvite(bookingId: string): Promise<{ success: boolean }> {
    if (USE_MOCK_JOB_BOARD) {
        return mockDeclineDirectInvite(bookingId);
    }
    const res = await apiClient<{ success: boolean }>(
        `/bookings/${bookingId}/decline-direct-invite`,
        { method: 'POST' },
    );
    return { success: res.success };
}

export async function acceptRadarJob(
    jobId: string,
    nurseTier: string,
    depositBalance = 300000,
): Promise<ClaimJobResult> {
    if (USE_MOCK_JOB_BOARD) {
        return mockAcceptRadar(jobId, nurseTier, depositBalance);
    }
    const res = await apiClient<{ success: boolean }>(`/bookings/${jobId}/claim-radar`, {
        method: 'POST',
    });
    return { success: res.success, bookingId: jobId, message: res.error?.message };
}

export async function dismissRadarJob(): Promise<{ success: boolean }> {
    if (USE_MOCK_JOB_BOARD) {
        return mockDismissRadar();
    }
    return { success: true };
}
