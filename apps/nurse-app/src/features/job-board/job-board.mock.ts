import {
  BookingDisputeStatus,
  DEFAULT_MIN_NURSE_DEPOSIT_VND,
  DEFAULT_PLATFORM_COMMISSION_RATE,
  ExecutionStatus,
  PaymentMethod,
  PaymentStatus,
  type ClaimJobResult,
  type DirectInvitation,
  type JobBoardFilter,
  type JobItem,
  type MobileShiftSummary,
} from '@healthcare-system/shared';
import {
  calculateJobNetAmount,
  filterMockJobs,
  getInitialMockInvite,
  getInitialMockJobs,
  JOB_CLAIM_ERROR_MESSAGES,
} from '@healthcare-system/shared';
import { upsertShiftFromJob } from '../shifts/shifts.mock';

export type MockDepositScenario =
  | 'full'
  | 'grace'
  | 'below_min'
  | 'grace_cash_error'
  | 'grace_exhausted'
  | 'closing';

let mockJobsStore: JobItem[] = getInitialMockJobs();
let mockInviteStore: DirectInvitation | null = getInitialMockInvite();
let currentDepositScenario: MockDepositScenario = 'full';

export function resetJobBoardMock(
  customJobs?: JobItem[],
  customInvite?: DirectInvitation | null
): void {
  mockJobsStore = customJobs ? [...customJobs] : getInitialMockJobs();
  mockInviteStore = customInvite !== undefined ? customInvite : getInitialMockInvite();
  currentDepositScenario = 'full';
}

export function setMockDepositScenario(scenario: MockDepositScenario): void {
  currentDepositScenario = scenario;
}

export function getMockDepositScenario(): MockDepositScenario {
  return currentDepositScenario;
}

export function expireMockDirectInvite(): void {
  mockInviteStore = null;
}

function delay<T>(value: T, ms = 150): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function jobItemToMobileShiftSummary(job: JobItem): MobileShiftSummary {
  const commission = Math.round(job.totalAmount * DEFAULT_PLATFORM_COMMISSION_RATE);
  const net = job.totalAmount - commission;
  return {
    bookingId: job.id,
    bookingCode: job.code,
    patientName: job.patientName,
    patientAge: job.patientAge,
    patientAddress: job.fullAddress || `Quận ${job.district}, TP. Đà Nẵng`,
    patientLatitude: 16.0718,
    patientLongitude: 108.2205,
    district: job.district,
    serviceName: job.serviceName,
    timeRange: `${job.startTime} – ${job.endTime} ${job.date}`,
    startTime: job.startTime,
    endTime: job.endTime,
    mobilityNote: job.mobilityStatus || 'Bình thường',
    allergies: job.allergies || 'Không ghi nhận dị ứng',
    isInvasive: job.isInvasive,
    prescriptionSummary: job.hasPrescription
      ? `Toa thuốc y lệnh ${job.prescriptionFileName || ''} ngày ${job.prescriptionPrescribedDate || ''}`
      : undefined,
    totalAmount: job.totalAmount,
    commissionAmount: commission,
    netAmount: net,
    executionStatus: ExecutionStatus.CONFIRMED,
    paymentStatus:
      job.paymentMethod === 'CASH' ? PaymentStatus.UNPAID : PaymentStatus.ESCROW_HELD,
    paymentMethod:
      job.paymentMethod === 'CASH' ? PaymentMethod.CASH : PaymentMethod.BANK_TRANSFER,
    disputeStatus: BookingDisputeStatus.NONE,
    notes: job.note,
  };
}

export function directInviteToJobItem(invite: DirectInvitation): JobItem {
  return {
    id: invite.bookingId,
    code: invite.code,
    serviceName: invite.serviceName,
    serviceType: 'procedure',
    requiredTier: 'TIER_1_BASIC',
    isInvasive: false,
    hasPrescription: false,
    date: invite.date,
    startTime: invite.startTime,
    endTime: invite.endTime,
    district: invite.district,
    distanceKm: 1.2,
    patientName: invite.patientName,
    patientAge: invite.patientAge,
    patientGender: 'Nữ',
    mobilityStatus: 'Hỗ trợ di chuyển',
    fullAddress: `Số 25 Quang Trung, Hải Châu, TP. Đà Nẵng`,
    customerName: invite.inviterName,
    customerPhoneMasked: '0905 ••• 123',
    note: `Lời mời nhận ca trực tiếp từ khách hàng ${invite.inviterName}.`,
    totalAmount: invite.totalAmount,
    baseAmount: invite.totalAmount,
    netAmount: calculateJobNetAmount(invite.totalAmount),
    cancellationPenaltyPercent: 20,
    paymentMethod: 'BANK_TRANSFER',
    paymentStatus: 'ESCROW_HELD',
    matchingMode: 'JOB_BOARD',
    status: 'MATCHING',
    isDirectInvite: true,
    inviterName: invite.inviterName,
  };
}

export async function mockFetchJobBoard(filter: JobBoardFilter = 'all'): Promise<JobItem[]> {
  // ADR-0004: if closing account, return empty list
  if (currentDepositScenario === 'closing') {
    return delay([], 100);
  }

  let list = [...mockJobsStore];

  // ADR-0004: if grace period active, server only returns BANK_TRANSFER jobs
  if (currentDepositScenario === 'grace' || currentDepositScenario === 'grace_cash_error') {
    list = list.filter((j) => j.paymentMethod === 'BANK_TRANSFER');
  }

  const filtered = filterMockJobs(list, filter);
  return delay(filtered, 150);
}

export async function mockFetchJobById(id: string): Promise<JobItem | null> {
  const job = mockJobsStore.find((j) => j.id === id);
  if (job) return delay({ ...job }, 100);

  if (mockInviteStore && mockInviteStore.bookingId === id) {
    return delay(directInviteToJobItem(mockInviteStore), 100);
  }

  return delay(null, 100);
}

export async function mockFetchDirectInvite(): Promise<DirectInvitation | null> {
  if (currentDepositScenario === 'closing') {
    return delay(null, 100);
  }
  return delay(mockInviteStore ? { ...mockInviteStore } : null, 100);
}

export async function mockAcceptJob(
  jobId: string,
  nurseTier: string,
  options?: {
    depositBalance?: number;
    depositGraceActive?: boolean;
    isAccountClosing?: boolean;
  }
): Promise<ClaimJobResult> {
  const isClosing = options?.isAccountClosing || currentDepositScenario === 'closing';
  if (isClosing) {
    return delay({
      success: false,
      errorCode: 'ACCOUNT_CLOSING',
      message: JOB_CLAIM_ERROR_MESSAGES.ACCOUNT_CLOSING,
    });
  }

  if (currentDepositScenario === 'grace_exhausted') {
    return delay({
      success: false,
      errorCode: 'DEPOSIT_GRACE_EXHAUSTED',
      message: JOB_CLAIM_ERROR_MESSAGES.DEPOSIT_GRACE_EXHAUSTED,
    });
  }

  const target = mockJobsStore.find((j) => j.id === jobId);
  if (!target) {
    return delay({
      success: false,
      errorCode: 'ALREADY_CLAIMED',
      message: JOB_CLAIM_ERROR_MESSAGES.ALREADY_CLAIMED,
    });
  }

  // Check deposit below min
  const deposit = options?.depositBalance ?? (currentDepositScenario === 'below_min' ? 100000 : DEFAULT_MIN_NURSE_DEPOSIT_VND);
  const graceActive = options?.depositGraceActive ?? (currentDepositScenario === 'grace' || currentDepositScenario === 'grace_cash_error');

  if (deposit < DEFAULT_MIN_NURSE_DEPOSIT_VND && !graceActive) {
    return delay({
      success: false,
      errorCode: 'DEPOSIT_BELOW_MIN',
      message: JOB_CLAIM_ERROR_MESSAGES.DEPOSIT_BELOW_MIN,
    });
  }

  // Grace period cash job not allowed
  if (graceActive && target.paymentMethod === 'CASH') {
    return delay({
      success: false,
      errorCode: 'DEPOSIT_GRACE_CASH_NOT_ALLOWED',
      message: JOB_CLAIM_ERROR_MESSAGES.DEPOSIT_GRACE_CASH_NOT_ALLOWED,
    });
  }

  // Check tier
  if (target.isInvasive && nurseTier !== 'TIER_2_SPECIALIST') {
    return delay({
      success: false,
      errorCode: 'TIER_NOT_ALLOWED',
      message: JOB_CLAIM_ERROR_MESSAGES.TIER_NOT_ALLOWED,
    });
  }

  // Success: remove from board, sync to shifts store
  mockJobsStore = mockJobsStore.filter((j) => j.id !== jobId);
  const shiftSummary = jobItemToMobileShiftSummary(target);
  upsertShiftFromJob(shiftSummary);

  return delay({
    success: true,
    bookingId: target.id,
    message: `Đã nhận thành công đơn ${target.code}. Ca trực đã được thêm vào mục Ca của tôi!`,
  });
}

export async function mockAcceptDirectInvite(
  bookingId: string,
  nurseTier: string,
  options?: {
    depositBalance?: number;
    depositGraceActive?: boolean;
    isAccountClosing?: boolean;
  }
): Promise<ClaimJobResult> {
  const isClosing = options?.isAccountClosing || currentDepositScenario === 'closing';
  if (isClosing) {
    return delay({
      success: false,
      errorCode: 'ACCOUNT_CLOSING',
      message: JOB_CLAIM_ERROR_MESSAGES.ACCOUNT_CLOSING,
    });
  }

  if (currentDepositScenario === 'grace_exhausted') {
    return delay({
      success: false,
      errorCode: 'DEPOSIT_GRACE_EXHAUSTED',
      message: JOB_CLAIM_ERROR_MESSAGES.DEPOSIT_GRACE_EXHAUSTED,
    });
  }

  if (!mockInviteStore || mockInviteStore.bookingId !== bookingId) {
    return delay({
      success: false,
      errorCode: 'ALREADY_CLAIMED',
      message: 'Lời mời này đã hết hạn hoặc đã chuyển cho điều dưỡng khác.',
    });
  }

  const deposit = options?.depositBalance ?? (currentDepositScenario === 'below_min' ? 100000 : DEFAULT_MIN_NURSE_DEPOSIT_VND);
  const graceActive = options?.depositGraceActive ?? (currentDepositScenario === 'grace' || currentDepositScenario === 'grace_cash_error');

  if (deposit < DEFAULT_MIN_NURSE_DEPOSIT_VND && !graceActive) {
    return delay({
      success: false,
      errorCode: 'DEPOSIT_BELOW_MIN',
      message: JOB_CLAIM_ERROR_MESSAGES.DEPOSIT_BELOW_MIN,
    });
  }

  const job = directInviteToJobItem(mockInviteStore);
  mockInviteStore = null;

  const shiftSummary = jobItemToMobileShiftSummary(job);
  upsertShiftFromJob(shiftSummary);

  return delay({
    success: true,
    bookingId,
    message: `Đã chấp nhận lời mời từ ${job.customerName}. Ca trực đã được thêm vào Ca của tôi!`,
  });
}

export async function mockDeclineDirectInvite(
  _bookingId: string,
  _reason?: string
): Promise<{ success: boolean }> {
  mockInviteStore = null;
  return delay({ success: true }, 150);
}

export async function mockGetDepositStatus(): Promise<{
  depositBalance: number;
  minDeposit: number;
  depositGraceActive: boolean;
  graceShiftsRemaining: number;
  isAccountClosing: boolean;
}> {
  if (currentDepositScenario === 'closing') {
    return delay({
      depositBalance: DEFAULT_MIN_NURSE_DEPOSIT_VND,
      minDeposit: DEFAULT_MIN_NURSE_DEPOSIT_VND,
      depositGraceActive: false,
      graceShiftsRemaining: 0,
      isAccountClosing: true,
    });
  }

  if (currentDepositScenario === 'grace' || currentDepositScenario === 'grace_cash_error') {
    return delay({
      depositBalance: 120000,
      minDeposit: DEFAULT_MIN_NURSE_DEPOSIT_VND,
      depositGraceActive: true,
      graceShiftsRemaining: 2,
      isAccountClosing: false,
    });
  }

  if (currentDepositScenario === 'below_min' || currentDepositScenario === 'grace_exhausted') {
    return delay({
      depositBalance: 100000,
      minDeposit: DEFAULT_MIN_NURSE_DEPOSIT_VND,
      depositGraceActive: false,
      graceShiftsRemaining: 0,
      isAccountClosing: false,
    });
  }

  return delay({
    depositBalance: DEFAULT_MIN_NURSE_DEPOSIT_VND,
    minDeposit: DEFAULT_MIN_NURSE_DEPOSIT_VND,
    depositGraceActive: false,
    graceShiftsRemaining: 0,
    isAccountClosing: false,
  });
}
