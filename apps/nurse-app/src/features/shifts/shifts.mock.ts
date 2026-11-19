import {
  BookingDisputeStatus,
  ExecutionStatus,
  PaymentMethod,
  PaymentStatus,
  type MobileShiftSummary,
} from '@healthcare-system/shared';

export const DEV_SAMPLE_SHIFT: MobileShiftSummary = {
  bookingId: 'job-1',
  bookingCode: 'BK-20261102-001',
  patientName: 'Bà Nguyễn Thị Mai',
  patientAge: 78,
  patientAddress: 'Số 25 Quang Trung, Hải Châu, Đà Nẵng',
  patientLatitude: 16.0718,
  patientLongitude: 108.2205,
  district: 'Hải Châu',
  serviceName: 'Chăm sóc vết loét độ 3 và thay băng',
  timeRange: '08:00 – 12:00 hôm nay',
  startTime: '08:00',
  endTime: '12:00',
  mobilityNote: 'Nằm tại giường, cần hỗ trợ xoay trở nhẹ nhàng',
  allergies: 'Dị ứng kháng sinh nhóm Penicillin',
  isInvasive: true,
  prescriptionSummary:
    'Đơn thuốc ngày 26/10/2026: Dung dịch sát khuẩn vết loét Povidone Iodine 10%, gạc vô khuẩn và băng ép chuyên dụng.',
  totalAmount: 450000,
  commissionAmount: 67500,
  netAmount: 382500,
  executionStatus: ExecutionStatus.IN_PROGRESS,
  paymentStatus: PaymentStatus.ESCROW_HELD,
  paymentMethod: PaymentMethod.BANK_TRANSFER,
  disputeStatus: BookingDisputeStatus.NONE,
};

export const MOCK_SHIFT_NIGHT: MobileShiftSummary = {
  bookingId: 'job-night-1050',
  bookingCode: 'HC-2026-1050',
  patientName: 'Bà Lê Thị Hoa',
  patientAge: 82,
  patientAddress: 'Số 14 Bạch Đằng, Hải Châu, Đà Nẵng',
  patientLatitude: 16.0682,
  patientLongitude: 108.2235,
  district: 'Hải Châu',
  serviceName: 'Chăm sóc người cao tuổi ca đêm',
  timeRange: 'Tối nay 20:00 – 06:00',
  startTime: '20:00',
  endTime: '06:00',
  mobilityNote: 'Hỗ trợ vệ sinh cá nhân và trở mình định kỳ ban đêm',
  allergies: 'Không ghi nhận dị ứng',
  isInvasive: false,
  totalAmount: 580000,
  commissionAmount: 87000,
  netAmount: 493000,
  executionStatus: ExecutionStatus.CONFIRMED,
  paymentStatus: PaymentStatus.ESCROW_HELD,
  paymentMethod: PaymentMethod.BANK_TRANSFER,
  disputeStatus: BookingDisputeStatus.NONE,
};

export const MOCK_SHIFT_COMPLETED: MobileShiftSummary = {
  bookingId: 'job-completed-1042',
  bookingCode: 'HC-2026-1042',
  patientName: 'Ông Trần Văn Nam',
  patientAge: 69,
  patientAddress: '128 Nguyễn Thị Minh Khai, Hải Châu, Đà Nẵng',
  patientLatitude: 16.0612,
  patientLongitude: 108.2145,
  district: 'Hải Châu',
  serviceName: 'Thay băng & chăm sóc vết thương',
  timeRange: 'Hôm nay 14:30 – 15:20',
  startTime: '14:30',
  endTime: '15:20',
  mobilityNote: 'Tự đi lại nhẹ nhàng trong phòng',
  allergies: 'Không có tiền sử dị ứng thuốc',
  isInvasive: true,
  prescriptionSummary: 'Dung dịch sát khuẩn NaCl 0.9%, gạc Urgo vô trùng.',
  totalAmount: 500000,
  commissionAmount: 75000,
  netAmount: 425000,
  executionStatus: ExecutionStatus.COMPLETED,
  paymentStatus: PaymentStatus.ESCROW_HELD,
  paymentMethod: PaymentMethod.BANK_TRANSFER,
  disputeStatus: BookingDisputeStatus.NONE,
  notes: 'Bệnh nhân hồi phục tốt, vết mổ khô ráo, không sưng viêm.',
};

export const MOCK_SHIFT_CASH: MobileShiftSummary = {
  bookingId: 'job-cash-1057',
  bookingCode: 'HC-2026-1057',
  patientName: 'Bà Phạm Thị Lan',
  patientAge: 75,
  patientAddress: '45 Lê Duẩn, Thanh Khê, Đà Nẵng',
  patientLatitude: 16.0701,
  patientLongitude: 108.2112,
  district: 'Thanh Khê',
  serviceName: 'Chăm sóc phục hồi chức năng (Ca 8 giờ)',
  timeRange: 'Hôm qua 08:00 – 16:00',
  startTime: '08:00',
  endTime: '16:00',
  mobilityNote: 'Di chứng sau tai biến, cần nâng đỡ khi tập đi',
  allergies: 'Không có dị ứng',
  isInvasive: false,
  totalAmount: 500000,
  commissionAmount: 75000,
  netAmount: 425000,
  executionStatus: ExecutionStatus.COMPLETED,
  paymentStatus: PaymentStatus.SETTLED,
  paymentMethod: PaymentMethod.CASH,
  disputeStatus: BookingDisputeStatus.NONE,
  notes: 'Đã hoàn tất hỗ trợ tập phục hồi chức năng và bàn giao cho người nhà.',
};

export const INITIAL_MOCK_SHIFTS: MobileShiftSummary[] = [
  DEV_SAMPLE_SHIFT,
  MOCK_SHIFT_NIGHT,
  MOCK_SHIFT_COMPLETED,
  MOCK_SHIFT_CASH,
];

let mockShiftsStore: MobileShiftSummary[] = [...INITIAL_MOCK_SHIFTS];

export function resetMockShifts(shifts?: MobileShiftSummary[]): void {
  mockShiftsStore = shifts ? [...shifts] : [...INITIAL_MOCK_SHIFTS];
}

export function mockGetShifts(filter?: {
  status?: 'upcoming' | 'in_progress' | 'completed';
}): MobileShiftSummary[] {
  if (!filter?.status) {
    return [...mockShiftsStore];
  }

  if (filter.status === 'in_progress') {
    return mockShiftsStore.filter((s) => s.executionStatus === ExecutionStatus.IN_PROGRESS);
  }

  if (filter.status === 'upcoming') {
    return mockShiftsStore.filter(
      (s) =>
        s.executionStatus === ExecutionStatus.CONFIRMED ||
        s.executionStatus === undefined
    );
  }

  if (filter.status === 'completed') {
    return mockShiftsStore.filter((s) => s.executionStatus === ExecutionStatus.COMPLETED);
  }

  return [...mockShiftsStore];
}

export function mockGetShiftById(bookingId: string): MobileShiftSummary | null {
  return mockShiftsStore.find((s) => s.bookingId === bookingId) ?? null;
}
