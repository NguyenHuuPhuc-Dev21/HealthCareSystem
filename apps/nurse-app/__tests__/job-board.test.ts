process.env.USE_MOCK_JOB_BOARD = 'true';

jest.mock('react-native-encrypted-storage', () => ({
  setItem: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: { USE_MOCK_JOB_BOARD: 'true' },
  Config: { USE_MOCK_JOB_BOARD: 'true' },
}));

import {
  BookingDisputeStatus,
  DEFAULT_MIN_NURSE_DEPOSIT_VND,
  DEFAULT_PLATFORM_COMMISSION_RATE,
  ExecutionStatus,
  PaymentMethod,
  PaymentStatus,
  calculateJobNetAmount,
  filterMockJobs,
  type JobItem,
  type MobileShiftSummary,
} from '@healthcare-system/shared';
import {
  acceptDirectInvite,
  acceptJob,
  declineDirectInvite,
  getDepositStatus,
  getDirectInvitations,
  getJobBoard,
  getJobDetail,
} from '../src/features/job-board/job-board.api';
import {
  directInviteToJobItem,
  expireMockDirectInvite,
  jobItemToMobileShiftSummary,
  resetJobBoardMock,
  setMockDepositScenario,
} from '../src/features/job-board/job-board.mock';
import {
  mockGetShiftById,
  mockGetShifts,
  resetMockShifts,
} from '../src/features/shifts/shifts.mock';

describe('A07 — Job Board và lời mời trực tiếp (nurse-app)', () => {
  beforeEach(() => {
    resetJobBoardMock();
    resetMockShifts([]);
    setMockDepositScenario('full');
  });

  describe('1. Tính toán tài chính và thực nhận sau hoa hồng 15% (FR-BOOK-03)', () => {
    it('tính đúng số tiền thực nhận sau khi trừ 15% hoa hồng nền tảng', () => {
      // 500.000đ → 425.000đ
      expect(calculateJobNetAmount(500000)).toBe(425000);
      // 200.000đ → 170.000đ
      expect(calculateJobNetAmount(200000)).toBe(170000);
      // 800.000đ → 680.000đ
      expect(calculateJobNetAmount(800000)).toBe(680000);
      // 680.000đ (ca đêm kèm phụ phí) → 578.000đ
      expect(calculateJobNetAmount(680000)).toBe(578000);
    });

    it('tỉ lệ hoa hồng nền tảng tuân thủ đúng hằng số DEFAULT_PLATFORM_COMMISSION_RATE = 15%', () => {
      expect(DEFAULT_PLATFORM_COMMISSION_RATE).toBe(0.15);
    });
  });

  describe('2. Bộ lọc danh sách việc làm (JobBoardFilter)', () => {
    it('lấy toàn bộ danh sách khi chọn bộ lọc "all"', async () => {
      const res = await getJobBoard('all');
      expect(res.success).toBe(true);
      expect(res.data.length).toBeGreaterThanOrEqual(4);
    });

    it('lọc chính xác các ca làm việc theo giờ khi chọn "shift" (Theo ca)', async () => {
      const res = await getJobBoard('shift');
      expect(res.success).toBe(true);
      expect(res.data.length).toBeGreaterThan(0);
      res.data.forEach((job) => {
        expect(job.serviceType).toBe('shift');
      });
    });

    it('lọc chính xác các thủ thuật chuyên môn khi chọn "task" (Thủ thuật)', async () => {
      const res = await getJobBoard('task');
      expect(res.success).toBe(true);
      expect(res.data.length).toBeGreaterThan(0);
      res.data.forEach((job) => {
        expect(job.serviceType).toBe('procedure');
      });
    });

    it('sắp xếp theo khoảng cách gần nhất khi chọn "near" (Gần tôi)', async () => {
      const res = await getJobBoard('near');
      expect(res.success).toBe(true);
      for (let i = 0; i < res.data.length - 1; i++) {
        expect(res.data[i].distanceKm).toBeLessThanOrEqual(res.data[i + 1].distanceKm);
      }
    });

    it('chỉ hiện ca có phụ phí đêm hoặc thưởng nóng khi chọn "bonus" (Có thưởng)', async () => {
      const res = await getJobBoard('bonus');
      expect(res.success).toBe(true);
      expect(res.data.length).toBeGreaterThan(0);
      res.data.forEach((job) => {
        expect(Boolean(job.urgentBonus || job.nightSurcharge)).toBe(true);
      });
    });
  });

  describe('3. Khóa ca và phân quyền theo Tầng điều dưỡng (Tier 1 vs Tier 2)', () => {
    it('tài khoản Tầng 1 nhận ca có dịch vụ xâm lấn sẽ bị từ chối với mã TIER_NOT_ALLOWED', async () => {
      // job-1042 là ca thay băng vết mổ (isInvasive: true, TIER_2_SPECIALIST)
      const res = await acceptJob('job-1042', 'TIER_1_BASIC');
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('TIER_NOT_ALLOWED');
      expect(res.message).toContain('Dịch vụ xâm lấn yêu cầu Điều dưỡng Cấp 2');
    });

    it('tài khoản Tầng 2 có thể nhận ca xâm lấn thành công', async () => {
      const res = await acceptJob('job-1042', 'TIER_2_SPECIALIST');
      expect(res.success).toBe(true);
      expect(res.bookingId).toBe('job-1042');
    });

    it('tài khoản Tầng 1 nhận ca chăm sóc cơ bản không xâm lấn thành công', async () => {
      // job-1044: Trông & chăm sóc 8 giờ (isInvasive: false, TIER_1_BASIC)
      const res = await acceptJob('job-1044', 'TIER_1_BASIC');
      expect(res.success).toBe(true);
      expect(res.bookingId).toBe('job-1044');
    });
  });

  describe('4. Ký quỹ và chính sách ân hạn làm quen (ADR-0004)', () => {
    it('từ chối nhận ca khi ký quỹ thiếu (< 300.000đ) và không có ân hạn (DEPOSIT_BELOW_MIN)', async () => {
      setMockDepositScenario('below_min');
      const res = await acceptJob('job-1044', 'TIER_1_BASIC', 100000);
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('DEPOSIT_BELOW_MIN');
      expect(res.message).toContain('300.000đ');
    });

    it('trong giai đoạn ân hạn, server chỉ trả ca chuyển khoản BANK_TRANSFER cho điều dưỡng', async () => {
      setMockDepositScenario('grace');
      const res = await getJobBoard('all');
      expect(res.success).toBe(true);
      res.data.forEach((job) => {
        expect(job.paymentMethod).toBe('BANK_TRANSFER');
      });
    });

    it('trong giai đoạn ân hạn, nhận ca chuyển khoản thành công', async () => {
      setMockDepositScenario('grace');
      const res = await acceptJob('job-1044', 'TIER_1_BASIC');
      expect(res.success).toBe(true);
    });

    it('trong giai đoạn ân hạn, nhận ca tiền mặt CASH sẽ trả về lỗi DEPOSIT_GRACE_CASH_NOT_ALLOWED', async () => {
      setMockDepositScenario('grace_cash_error');
      // job-1045 là ca CASH
      const res = await acceptJob('job-1045', 'TIER_2_SPECIALIST');
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('DEPOSIT_GRACE_CASH_NOT_ALLOWED');
      expect(res.message).toContain('Ca tiền mặt cần ký quỹ đủ 300.000đ');
    });

    it('khi đã dùng hết 3 ca làm quen / hết 30 ngày, trả về lỗi DEPOSIT_GRACE_EXHAUSTED', async () => {
      setMockDepositScenario('grace_exhausted');
      const res = await acceptJob('job-1044', 'TIER_1_BASIC');
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('DEPOSIT_GRACE_EXHAUSTED');
      expect(res.message).toContain('Đã dùng hết 3 ca làm quen');
    });

    it('khi đã yêu cầu ngừng hợp tác đóng tài khoản: danh sách việc làm trống và không thể nhận ca mới (ACCOUNT_CLOSING)', async () => {
      setMockDepositScenario('closing');
      const boardRes = await getJobBoard('all');
      expect(boardRes.success).toBe(true);
      expect(boardRes.data).toEqual([]);

      const inviteRes = await getDirectInvitations();
      expect(inviteRes.success).toBe(true);
      expect(inviteRes.data).toBeNull();

      const claimRes = await acceptJob('job-1044', 'TIER_1_BASIC');
      expect(claimRes.success).toBe(false);
      expect(claimRes.errorCode).toBe('ACCOUNT_CLOSING');
      expect(claimRes.message).toContain('ngừng hợp tác');
    });
  });

  describe('5. Lời mời trực tiếp từ khách hàng (Direct Invitation)', () => {
    it('lấy lời mời trực tiếp thành công với đầy đủ thông tin thời gian và người mời', async () => {
      const res = await getDirectInvitations();
      expect(res.success).toBe(true);
      expect(res.data).not.toBeNull();
      expect(res.data?.bookingId).toBe('job-1048');
      expect(res.data?.inviterName).toBe('Anh Nguyễn Văn An');
      expect(res.data?.totalAmount).toBe(500000);
    });

    it('ca khách chọn trực tiếp có thể xem chi tiết ca (getJobDetail) đầy đủ trước khi nhận', async () => {
      const inviteRes = await getDirectInvitations();
      expect(inviteRes.data).not.toBeNull();
      const bookingId = inviteRes.data!.bookingId;

      // Điều dưỡng xem chi tiết ca trước khi nhận
      const detailRes = await getJobDetail(bookingId);
      expect(detailRes.success).toBe(true);
      expect(detailRes.data).not.toBeNull();
      expect(detailRes.data?.id).toBe(bookingId);
      expect(detailRes.data?.patientName).toBe('Bà Nguyễn Thị Hoa');
      expect(detailRes.data?.customerName).toBe('Anh Nguyễn Văn An');
      expect(detailRes.data?.isDirectInvite).toBe(true);

      // Sau khi xem chi tiết, điều dưỡng bấm nhận ca
      const acceptRes = await acceptDirectInvite(bookingId, 'TIER_1_BASIC');
      expect(acceptRes.success).toBe(true);
    });

    it('chấp nhận lời mời trực tiếp thành công và tự động xóa khỏi danh sách lời mời', async () => {
      const res = await acceptDirectInvite('job-1048', 'TIER_1_BASIC');
      expect(res.success).toBe(true);
      expect(res.bookingId).toBe('job-1048');

      // Lời mời đã được chấp nhận thì không còn hiện
      const inviteRes = await getDirectInvitations();
      expect(inviteRes.data).toBeNull();
    });

    it('từ chối lời mời trực tiếp sẽ loại bỏ lời mời khỏi màn hình', async () => {
      const res = await declineDirectInvite('job-1048', 'Bận việc gia đình');
      expect(res.success).toBe(true);

      const inviteRes = await getDirectInvitations();
      expect(inviteRes.data).toBeNull();
    });

    it('khi quá hạn 15 phút, lời mời tự động hết hạn và ẩn khỏi màn hình', async () => {
      expireMockDirectInvite();
      const inviteRes = await getDirectInvitations();
      expect(inviteRes.data).toBeNull();
    });
  });

  describe('6. Chi tiết ca và đồng bộ sang Ca của tôi (A04 Shift Store)', () => {
    it('lấy chi tiết ca theo ID với đầy đủ thông tin bệnh nhân và y lệnh', async () => {
      const res = await getJobDetail('job-1042');
      expect(res.success).toBe(true);
      expect(res.data).not.toBeNull();
      expect(res.data?.patientName).toBe('Bà Nguyễn Thị Hoa');
      expect(res.data?.hasPrescription).toBe(true);
      expect(res.data?.prescriptionFileName).toBe('ylenh_thaybang_1042.jpg');
      expect(res.data?.cancellationPenaltyPercent).toBe(20);
    });

    it('nhận ca thành công sẽ tự động đồng bộ sang tab Ca trực (My Shifts)', async () => {
      // Ban đầu store ca trực rỗng
      expect(mockGetShifts().length).toBe(0);

      // Nhận ca job-1044
      const claimRes = await acceptJob('job-1044', 'TIER_1_BASIC');
      expect(claimRes.success).toBe(true);

      // Kiểm tra trong store Ca của tôi
      const shifts = mockGetShifts({ status: 'upcoming' });
      expect(shifts.length).toBe(1);
      expect(shifts[0].bookingId).toBe('job-1044');
      expect(shifts[0].bookingCode).toBe('HC-2026-1044');
      expect(shifts[0].serviceName).toBe('Trông & chăm sóc bệnh nhân theo ca 8 giờ');
      expect(shifts[0].executionStatus).toBe(ExecutionStatus.CONFIRMED);
      expect(shifts[0].netAmount).toBe(680000); // 800.000đ - 15%
    });

    it('chấp nhận lời mời trực tiếp cũng tự động đồng bộ sang tab Ca trực', async () => {
      const claimRes = await acceptDirectInvite('job-1048', 'TIER_1_BASIC');
      expect(claimRes.success).toBe(true);

      const shift = mockGetShiftById('job-1048');
      expect(shift).not.toBeNull();
      expect(shift?.patientName).toBe('Bà Nguyễn Thị Hoa');
      expect(shift?.executionStatus).toBe(ExecutionStatus.CONFIRMED);
    });

    it('ca đã nhận sẽ biến mất khỏi danh sách Bảng việc làm', async () => {
      const initial = await getJobBoard('all');
      expect(initial.data.some((j) => j.id === 'job-1044')).toBe(true);

      await acceptJob('job-1044', 'TIER_1_BASIC');

      const updated = await getJobBoard('all');
      expect(updated.data.some((j) => j.id === 'job-1044')).toBe(false);
    });
  });
});
