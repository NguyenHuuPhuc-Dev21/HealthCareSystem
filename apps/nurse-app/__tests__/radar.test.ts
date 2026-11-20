import {
  computeRemainingSeconds,
  parsePushPayload,
} from '../src/lib/push';
import {
  ackNotification,
  claimRadar,
  declineRadar,
  getOnlineStatus,
  getRadarOffers,
  registerDeviceToken,
  setOnline,
  unregisterDeviceToken,
} from '../src/features/radar/radar.api';
import {
  clearMockRadarOffer,
  createSimulatedRadarOffer,
  expireMockRadarOffer,
  getAcknowledgedNotifications,
  getRegisteredTokens,
  resetRadarMock,
  setMockRadarOffer,
} from '../src/features/radar/radar.mock';
import {
  resetJobBoardMock,
  setMockDepositScenario,
} from '../src/features/job-board/job-board.mock';
import { mockGetShiftById, resetMockShifts } from '../src/features/shifts/shifts.mock';
import { DEFAULT_MIN_NURSE_DEPOSIT_VND } from '@healthcare-system/shared';

describe('A08 — Radar Dispatch & Push Notification Unit Tests', () => {
  beforeEach(() => {
    resetRadarMock();
    resetJobBoardMock();
    resetMockShifts();
    jest.clearAllMocks();
  });

  describe('1. Countdown and Time Calculations', () => {
    it('computes remaining seconds accurately from future ISO timestamp', () => {
      const now = Date.now();
      const future = new Date(now + 35 * 1000).toISOString();
      const remaining = computeRemainingSeconds(future, 45);
      expect(remaining).toBeGreaterThanOrEqual(34);
      expect(remaining).toBeLessThanOrEqual(36);
    });

    it('returns 0 for expired timestamps in the past', () => {
      const past = new Date(Date.now() - 10000).toISOString();
      expect(computeRemainingSeconds(past, 45)).toBe(0);
    });

    it('falls back to expiresInSeconds when expiresAt is invalid or missing', () => {
      expect(computeRemainingSeconds('invalid-date', 30)).toBe(30);
      expect(computeRemainingSeconds(undefined, 25)).toBe(25);
    });

    it('defaults to 45 seconds when neither expiresAt nor expiresInSeconds is provided', () => {
      expect(computeRemainingSeconds(undefined, undefined)).toBe(45);
    });
  });

  describe('2. Push Payload Parsing & Robustness', () => {
    it('correctly parses valid RADAR_URGENT remote message', () => {
      const rawMessage = {
        messageId: 'msg-radar-123',
        data: {
          type: 'RADAR_URGENT',
          offerId: 'job-radar-1055',
          bookingId: 'job-radar-1055',
          notificationId: 'notif-999',
          serviceName: 'Thay băng vết mổ',
          urgentBonus: '100000',
          totalAmount: '350000',
          district: 'Hải Châu',
          patientName: 'Bà Hoa',
          patientAge: '78',
          isInvasive: 'true',
          hasPrescription: 'true',
          paymentMethod: 'BANK_TRANSFER',
          expiresInSeconds: '45',
        },
      } as any;

      const parsed = parsePushPayload(rawMessage);
      expect(parsed).not.toBeNull();
      expect(parsed?.type).toBe('RADAR_URGENT');
      expect(parsed?.offerId).toBe('job-radar-1055');
      expect(parsed?.notificationId).toBe('notif-999');
      expect(parsed?.serviceName).toBe('Thay băng vết mổ');
      expect(parsed?.urgentBonus).toBe(100000);
      expect(parsed?.totalAmount).toBe(350000);
      expect(parsed?.patientAge).toBe(78);
      expect(parsed?.isInvasive).toBe(true);
      expect(parsed?.hasPrescription).toBe(true);
      expect(parsed?.paymentMethod).toBe('BANK_TRANSFER');
      expect(parsed?.expiresInSeconds).toBe(45);
    });

    it('handles stringified JSON data payloads safely', () => {
      const rawMessage = {
        messageId: 'msg-json-456',
        data: JSON.stringify({
          type: 'RADAR_URGENT',
          offerId: 'job-radar-stringified',
          serviceName: 'Chăm sóc người già',
          urgentBonus: 50000,
          totalAmount: 200000,
        }),
      } as any;

      const parsed = parsePushPayload(rawMessage);
      expect(parsed).not.toBeNull();
      expect(parsed?.offerId).toBe('job-radar-stringified');
      expect(parsed?.serviceName).toBe('Chăm sóc người già');
      expect(parsed?.urgentBonus).toBe(50000);
    });

    it('returns null safely for empty or invalid remote messages', () => {
      expect(parsePushPayload(null)).toBeNull();
      expect(parsePushPayload(undefined)).toBeNull();
      expect(parsePushPayload({} as any)).not.toBeNull();
      expect(parsePushPayload({ data: 'invalid-non-json{' } as any)).toBeNull();
    });
  });

  describe('3. Online / Offline Status Filtering (FR-BOOK-03)', () => {
    it('returns radar offers when nurse is online', async () => {
      await setOnline(true);
      const onlineStatus = await getOnlineStatus();
      expect(onlineStatus).toBe(true);

      const res = await getRadarOffers();
      expect(res.success).toBe(true);
      expect(res.data).not.toBeNull();
      expect(res.data?.matchingMode).toBe('RADAR_DISPATCH');
    });

    it('returns null and does not show radar when nurse turns offline', async () => {
      await setOnline(false);
      const onlineStatus = await getOnlineStatus();
      expect(onlineStatus).toBe(false);

      const res = await getRadarOffers();
      expect(res.success).toBe(true);
      expect(res.data).toBeNull();
    });
  });

  describe('4. Radar Claiming & Deposit Hardening (ADR-0004)', () => {
    it('successfully claims an urgent radar offer when nurse has Tier 2 and full deposit', async () => {
      await setOnline(true);
      const offerRes = await getRadarOffers();
      const offer = offerRes.data!;
      expect(offer).toBeDefined();

      const claimRes = await claimRadar(
        offer.id,
        'TIER_2_SPECIALIST',
        DEFAULT_MIN_NURSE_DEPOSIT_VND
      );

      expect(claimRes.success).toBe(true);
      expect(claimRes.bookingId).toBe(offer.id);

      // Verify the claimed job is automatically stored in MyShifts
      const shiftInStore = mockGetShiftById(offer.id);
      expect(shiftInStore).toBeDefined();
      expect(shiftInStore?.bookingCode).toBe(offer.code);
      expect(shiftInStore?.serviceName).toBe(offer.serviceName);
    });

    it('rejects claim with OFFER_EXPIRED when radar timer has elapsed', async () => {
      expireMockRadarOffer();
      const offer = createSimulatedRadarOffer();

      const claimRes = await claimRadar(
        offer.id,
        'TIER_2_SPECIALIST',
        DEFAULT_MIN_NURSE_DEPOSIT_VND
      );

      expect(claimRes.success).toBe(false);
      expect(claimRes.errorCode).toBe('OFFER_EXPIRED');
    });

    it('rejects claim with JOB_ALREADY_TAKEN when offer was cleared or taken by another nurse', async () => {
      clearMockRadarOffer();

      const claimRes = await claimRadar(
        'job-radar-urgent-1055',
        'TIER_2_SPECIALIST',
        DEFAULT_MIN_NURSE_DEPOSIT_VND
      );

      expect(claimRes.success).toBe(false);
      expect(claimRes.errorCode).toBe('JOB_ALREADY_TAKEN');
    });

    it('rejects claim with DEPOSIT_BELOW_MIN when deposit < 300,000 VND and not in grace period', async () => {
      setMockDepositScenario('below_min');

      const claimRes = await claimRadar(
        'job-radar-urgent-1055',
        'TIER_2_SPECIALIST',
        150000
      );

      expect(claimRes.success).toBe(false);
      expect(claimRes.errorCode).toBe('DEPOSIT_BELOW_MIN');
    });

    it('rejects claim with DEPOSIT_GRACE_CASH_NOT_ALLOWED when in grace period but job is cash (ADR-0004)', async () => {
      setMockDepositScenario('grace_cash_error');

      // Create a cash radar offer
      const cashOffer = createSimulatedRadarOffer({
        id: 'job-radar-cash',
        paymentMethod: 'CASH',
        paymentStatus: 'UNPAID',
      });
      setMockRadarOffer(cashOffer);

      const claimRes = await claimRadar(
        cashOffer.id,
        'TIER_2_SPECIALIST',
        200000
      );

      expect(claimRes.success).toBe(false);
      expect(claimRes.errorCode).toBe('DEPOSIT_GRACE_CASH_NOT_ALLOWED');
    });

    it('rejects claim with DEPOSIT_GRACE_EXHAUSTED when grace period shifts are exhausted', async () => {
      setMockDepositScenario('grace_exhausted');

      const claimRes = await claimRadar(
        'job-radar-urgent-1055',
        'TIER_2_SPECIALIST',
        100000
      );

      expect(claimRes.success).toBe(false);
      expect(claimRes.errorCode).toBe('DEPOSIT_GRACE_EXHAUSTED');
    });

    it('rejects claim with ACCOUNT_CLOSING when nurse is undergoing deposit settlement closing', async () => {
      setMockDepositScenario('closing');

      const claimRes = await claimRadar(
        'job-radar-urgent-1055',
        'TIER_2_SPECIALIST',
        300000
      );

      expect(claimRes.success).toBe(false);
      expect(claimRes.errorCode).toBe('ACCOUNT_CLOSING');
    });

    it('rejects claim with TIER_NOT_ALLOWED when service is invasive but nurse is Tier 1', async () => {
      const claimRes = await claimRadar(
        'job-radar-urgent-1055',
        'TIER_1_BASIC',
        DEFAULT_MIN_NURSE_DEPOSIT_VND
      );

      expect(claimRes.success).toBe(false);
      expect(claimRes.errorCode).toBe('TIER_NOT_ALLOWED');
    });
  });

  describe('5. Decline, Ack Notification, and Token Registration', () => {
    it('successfully dismisses radar offer upon decline', async () => {
      const declineRes = await declineRadar('job-radar-urgent-1055');
      expect(declineRes.success).toBe(true);

      const afterDecline = await getRadarOffers();
      expect(afterDecline.data).toBeNull();
    });

    it('acknowledges notification so server knows not to trigger 60s SMS fallback', async () => {
      const ackRes = await ackNotification('notif-radar-777');
      expect(ackRes.success).toBe(true);

      const acks = getAcknowledgedNotifications();
      expect(acks).toContain('notif-radar-777');
    });

    it('registers and unregisters FCM device tokens properly', async () => {
      const token = 'fcm-device-test-token-888';
      await registerDeviceToken(token, 'android');
      expect(getRegisteredTokens()).toContain(token);

      await unregisterDeviceToken(token);
      expect(getRegisteredTokens()).not.toContain(token);
    });
  });
});
