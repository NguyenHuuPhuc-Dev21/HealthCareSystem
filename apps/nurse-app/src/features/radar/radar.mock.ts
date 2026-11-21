import {
  DEFAULT_MIN_NURSE_DEPOSIT_VND,
  JOB_CLAIM_ERROR_MESSAGES,
  type ClaimJobResult,
  type RadarJob,
} from '@healthcare-system/shared';
import {
  getMockDepositScenario,
  jobItemToMobileShiftSummary,
} from '../job-board/job-board.mock';
import { upsertShiftFromJob } from '../shifts/shifts.mock';

export function createSimulatedRadarOffer(overrides?: Partial<RadarJob>): RadarJob {
  const expiresAt = new Date(Date.now() + 45 * 1000).toISOString();
  return {
    id: 'job-radar-urgent-1055',
    code: 'HC-RADAR-1055',
    serviceName: 'Thay băng vết mổ hậu phẫu',
    serviceType: 'procedure',
    requiredTier: 'TIER_2_SPECIALIST',
    isInvasive: true,
    hasPrescription: true,
    prescriptionFileName: 'Toa_BV_DaKhoa_DN.pdf',
    prescriptionPrescribedDate: '2026-10-29',
    prescriptionExpiryDays: 7,
    date: 'Hôm nay',
    startTime: '15:00',
    endTime: '16:00',
    district: 'Hải Châu',
    distanceKm: 1.2,
    patientName: 'Bà Nguyễn Thị Hoa',
    patientAge: 78,
    patientGender: 'Nữ',
    patientWeight: 52,
    mobilityStatus: 'Yếu, nằm tại giường',
    medicalCondition: 'Hậu phẫu mổ ruột thừa ngày thứ 3, vết mổ khô',
    allergies: 'Dị ứng Povidone Iodine nhẹ',
    fullAddress: 'Số 45/12 đường Lê Duẩn, P. Hải Châu 1, Q. Hải Châu, TP. Đà Nẵng',
    totalAmount: 350000,
    baseAmount: 250000,
    urgentBonus: 100000,
    netAmount: 297500,
    paymentMethod: 'BANK_TRANSFER',
    paymentStatus: 'ESCROW_HELD',
    matchingMode: 'RADAR_DISPATCH',
    wave: 1,
    radarExpiresAt: expiresAt,
    expiresInSeconds: 45,
    isUrgent: true,
    status: 'MATCHING',
    ...overrides,
  };
}

let activeMockRadarOffer: RadarJob | null = createSimulatedRadarOffer();
let isNurseOnline = true;
const registeredDeviceTokens = new Set<string>();
const acknowledgedNotifications = new Set<string>();

export function resetRadarMock(): void {
  activeMockRadarOffer = createSimulatedRadarOffer();
  isNurseOnline = true;
  registeredDeviceTokens.clear();
  acknowledgedNotifications.clear();
}

export function setMockRadarOffer(offer: RadarJob | null): void {
  activeMockRadarOffer = offer;
}

export function expireMockRadarOffer(): void {
  if (activeMockRadarOffer) {
    activeMockRadarOffer = {
      ...activeMockRadarOffer,
      radarExpiresAt: new Date(Date.now() - 5000).toISOString(),
      expiresInSeconds: 0,
    };
  }
}

export function clearMockRadarOffer(): void {
  activeMockRadarOffer = null;
}

export async function mockGetRadarOffers(): Promise<RadarJob | null> {
  if (!isNurseOnline) return null;
  if (!activeMockRadarOffer) return null;

  const expiryMs = Date.parse(activeMockRadarOffer.radarExpiresAt);
  if (!Number.isNaN(expiryMs) && Date.now() > expiryMs) {
    return null;
  }

  return { ...activeMockRadarOffer };
}

export async function mockClaimRadar(
  jobId: string,
  nurseTier = 'TIER_1_BASIC',
  options?: {
    depositBalance?: number;
    depositGraceActive?: boolean;
    isAccountClosing?: boolean;
  }
): Promise<ClaimJobResult> {
  const currentScenario = getMockDepositScenario();

  const isClosing = options?.isAccountClosing || currentScenario === 'closing';
  if (isClosing) {
    return {
      success: false,
      errorCode: 'ACCOUNT_CLOSING',
      message: JOB_CLAIM_ERROR_MESSAGES.ACCOUNT_CLOSING,
    };
  }

  if (currentScenario === 'grace_exhausted') {
    return {
      success: false,
      errorCode: 'DEPOSIT_GRACE_EXHAUSTED',
      message: JOB_CLAIM_ERROR_MESSAGES.DEPOSIT_GRACE_EXHAUSTED,
    };
  }

  if (!activeMockRadarOffer || activeMockRadarOffer.id !== jobId) {
    return {
      success: false,
      errorCode: 'JOB_ALREADY_TAKEN',
      message: 'Ca đã được nhận bởi người khác hoặc hết hạn.',
    };
  }

  // Check expiration
  const expiryMs = Date.parse(activeMockRadarOffer.radarExpiresAt);
  if (!Number.isNaN(expiryMs) && Date.now() > expiryMs) {
    return {
      success: false,
      errorCode: 'OFFER_EXPIRED',
      message: 'Ca đã được nhận bởi người khác hoặc hết hạn.',
    };
  }

  // Check deposit below min
  const deposit =
    options?.depositBalance ??
    (currentScenario === 'below_min' ? 100000 : DEFAULT_MIN_NURSE_DEPOSIT_VND);
  const graceActive =
    options?.depositGraceActive ??
    (currentScenario === 'grace' || currentScenario === 'grace_cash_error');

  if (deposit < DEFAULT_MIN_NURSE_DEPOSIT_VND && !graceActive) {
    return {
      success: false,
      errorCode: 'DEPOSIT_BELOW_MIN',
      message: JOB_CLAIM_ERROR_MESSAGES.DEPOSIT_BELOW_MIN,
    };
  }

  // Grace period cash job not allowed (ADR-0004)
  if (graceActive && activeMockRadarOffer.paymentMethod === 'CASH') {
    return {
      success: false,
      errorCode: 'DEPOSIT_GRACE_CASH_NOT_ALLOWED',
      message: JOB_CLAIM_ERROR_MESSAGES.DEPOSIT_GRACE_CASH_NOT_ALLOWED,
    };
  }

  // Check tier
  if (activeMockRadarOffer.isInvasive && nurseTier !== 'TIER_2_SPECIALIST') {
    return {
      success: false,
      errorCode: 'TIER_NOT_ALLOWED',
      message: JOB_CLAIM_ERROR_MESSAGES.TIER_NOT_ALLOWED,
    };
  }

  // Claim success
  const claimedJob = { ...activeMockRadarOffer };
  activeMockRadarOffer = null;

  // Convert to shift and add to shift store so briefing and shifts screen have it
  const shiftSummary = jobItemToMobileShiftSummary(claimedJob);
  upsertShiftFromJob(shiftSummary);

  return {
    success: true,
    bookingId: claimedJob.id,
    message: `Đã nhận thành công ca khẩn cấp ${claimedJob.code} qua Radar Dispatch!`,
  };
}

export async function mockDeclineRadar(jobId: string): Promise<{ success: boolean }> {
  if (activeMockRadarOffer && activeMockRadarOffer.id === jobId) {
    activeMockRadarOffer = null;
  }
  return { success: true };
}

export async function mockRegisterDeviceToken(
  token: string,
  _platform = 'android'
): Promise<{ success: boolean }> {
  registeredDeviceTokens.add(token);
  return { success: true };
}

export async function mockUnregisterDeviceToken(
  token: string
): Promise<{ success: boolean }> {
  registeredDeviceTokens.delete(token);
  return { success: true };
}

export async function mockAckNotification(id: string): Promise<{ success: boolean }> {
  acknowledgedNotifications.add(id);
  return { success: true };
}

export async function mockSetOnline(isOnline: boolean): Promise<{ success: boolean }> {
  isNurseOnline = isOnline;
  return { success: true };
}

export async function mockGetOnlineStatus(): Promise<boolean> {
  return isNurseOnline;
}

export function getRegisteredTokens(): string[] {
  return Array.from(registeredDeviceTokens);
}

export function getAcknowledgedNotifications(): string[] {
  return Array.from(acknowledgedNotifications);
}
