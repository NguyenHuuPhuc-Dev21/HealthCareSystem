import {
  BookingDisputeStatus,
  DEFAULT_PLATFORM_COMMISSION_RATE,
  ExecutionStatus,
  PaymentMethod,
  PaymentStatus,
  type MobileShiftSummary,
} from '@healthcare-system/shared';
import { getMyShifts, getShiftState } from '../src/features/active-shift/active-shift.api';
import {
  DEV_SAMPLE_SHIFT,
  MOCK_SHIFT_CASH,
  MOCK_SHIFT_COMPLETED,
  MOCK_SHIFT_NIGHT,
  mockGetShiftById,
  mockGetShifts,
  resetMockShifts,
} from '../src/features/shifts/shifts.mock';

process.env.USE_MOCK_SHIFTS = 'true';

jest.mock('react-native-encrypted-storage', () => ({
  setItem: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: { USE_MOCK_SHIFTS: 'true' },
  Config: { USE_MOCK_SHIFTS: 'true' },
}));

describe('A04 — My Shifts & 3-Axis Status (nurse-app)', () => {
  beforeEach(() => {
    resetMockShifts();
  });

  describe('1. Phân nhóm ca trực theo 3 trạng thái (Đang chạy / Sắp tới / Đã xong)', () => {
    it('lấy toàn bộ danh sách ca trực khi không truyền bộ lọc', () => {
      const allShifts = mockGetShifts();
      expect(allShifts.length).toBe(4);
    });

    it('lọc chính xác ca Đang thực hiện (in_progress)', () => {
      const inProgress = mockGetShifts({ status: 'in_progress' });
      expect(inProgress.length).toBe(1);
      expect(inProgress[0].bookingCode).toBe('BK-20261102-001');
      expect(inProgress[0].executionStatus).toBe(ExecutionStatus.IN_PROGRESS);
    });

    it('lọc chính xác ca Sắp tới (upcoming)', () => {
      const upcoming = mockGetShifts({ status: 'upcoming' });
      expect(upcoming.length).toBe(1);
      expect(upcoming[0].bookingCode).toBe('HC-2026-1050');
      expect(upcoming[0].executionStatus).toBe(ExecutionStatus.CONFIRMED);
    });

    it('lọc chính xác các ca Đã xong (completed)', () => {
      const completed = mockGetShifts({ status: 'completed' });
      expect(completed.length).toBe(2);
      expect(completed.map((s) => s.bookingCode)).toEqual(
        expect.arrayContaining(['HC-2026-1042', 'HC-2026-1057'])
      );
      expect(
        completed.every((s) => s.executionStatus === ExecutionStatus.COMPLETED)
      ).toBe(true);
    });
  });

  describe('2. Tính số tiền thực nhận sau hoa hồng (Financial calculation)', () => {
    it('tính đúng số tiền thực nhận sau hoa hồng 15% cho ca đêm 580.000đ → 493.000đ', () => {
      const totalAmount = MOCK_SHIFT_NIGHT.totalAmount!;
      expect(totalAmount).toBe(580000);

      const commission = Math.round(totalAmount * DEFAULT_PLATFORM_COMMISSION_RATE);
      expect(commission).toBe(87000);

      const netAmount = totalAmount - commission;
      expect(netAmount).toBe(493000);
      expect(MOCK_SHIFT_NIGHT.netAmount).toBe(493000);
    });

    it('tính đúng số tiền thực nhận cho ca thay băng 500.000đ → 425.000đ (hoa hồng 75.000đ)', () => {
      const totalAmount = MOCK_SHIFT_COMPLETED.totalAmount!;
      expect(totalAmount).toBe(500000);

      const commission = Math.round(totalAmount * DEFAULT_PLATFORM_COMMISSION_RATE);
      expect(commission).toBe(75000);

      const netAmount = totalAmount - commission;
      expect(netAmount).toBe(425000);
      expect(MOCK_SHIFT_COMPLETED.netAmount).toBe(425000);
    });

    it('tính đúng cho ca mẫu ban đầu 450.000đ → 382.500đ', () => {
      const totalAmount = DEV_SAMPLE_SHIFT.totalAmount!;
      expect(totalAmount).toBe(450000);

      const commission = Math.round(totalAmount * DEFAULT_PLATFORM_COMMISSION_RATE);
      expect(commission).toBe(67500);

      const netAmount = totalAmount - commission;
      expect(netAmount).toBe(382500);
      expect(DEV_SAMPLE_SHIFT.netAmount).toBe(382500);
    });
  });

  describe('3. Trạng thái 3 trục độc lập: Thực hiện, Thanh toán, Khiếu nại (FR-BOOK-01)', () => {
    it('nhận diện ca tiền mặt (CASH) và số tiền hoa hồng cần nộp ở tab Ví', () => {
      expect(MOCK_SHIFT_CASH.paymentMethod).toBe(PaymentMethod.CASH);
      expect(MOCK_SHIFT_CASH.commissionAmount).toBe(75000);
      expect(MOCK_SHIFT_CASH.executionStatus).toBe(ExecutionStatus.COMPLETED);
    });

    it('nhận diện ca trực tuyến giữ qua Escrow (ESCROW_HELD) chờ giải ngân sau 24h', () => {
      expect(MOCK_SHIFT_COMPLETED.paymentMethod).toBe(PaymentMethod.BANK_TRANSFER);
      expect(MOCK_SHIFT_COMPLETED.paymentStatus).toBe(PaymentStatus.ESCROW_HELD);
      expect(MOCK_SHIFT_COMPLETED.disputeStatus).toBe(BookingDisputeStatus.NONE);
    });

    it('nhận diện đúng khi ca có tranh chấp / khiếu nại (DISPUTE_OPEN)', () => {
      const disputedShift: MobileShiftSummary = {
        ...MOCK_SHIFT_COMPLETED,
        bookingId: 'job-disputed-999',
        disputeStatus: BookingDisputeStatus.OPEN,
      };

      expect(disputedShift.disputeStatus).toBe(BookingDisputeStatus.OPEN);
    });
  });

  describe('4. API getMyShifts & getShiftState', () => {
    it('getMyShifts trả về danh sách ca trực thành công khi bật env.useMockShifts', async () => {
      const res = await getMyShifts();
      expect(res.success).toBe(true);
      expect(res.data.length).toBe(4);
    });

    it('getMyShifts với bộ lọc upcoming chỉ trả về các ca sắp tới', async () => {
      const res = await getMyShifts({ status: 'upcoming' });
      expect(res.success).toBe(true);
      expect(res.data.length).toBe(1);
      expect(res.data[0].bookingCode).toBe('HC-2026-1050');
    });

    it('getShiftState trả về đúng ca trực theo bookingId', async () => {
      const res = await getShiftState('job-night-1050');
      expect(res.success).toBe(true);
      expect(res.data).not.toBeNull();
      expect(res.data?.bookingCode).toBe('HC-2026-1050');
      expect(res.data?.serviceName).toBe('Chăm sóc người cao tuổi ca đêm');
    });

    it('getShiftState trả về null khi không tìm thấy bookingId', async () => {
      const res = await getShiftState('non-existent-id');
      expect(res.success).toBe(true);
      expect(res.data).toBeNull();
    });
  });

  describe('5. Kịch bản danh sách rỗng (Empty state)', () => {
    it('trả về mảng rỗng khi không có ca nào được giao', async () => {
      resetMockShifts([]);
      const res = await getMyShifts();
      expect(res.success).toBe(true);
      expect(res.data).toEqual([]);

      const inProgress = mockGetShifts({ status: 'in_progress' });
      expect(inProgress).toEqual([]);
    });
  });
});
