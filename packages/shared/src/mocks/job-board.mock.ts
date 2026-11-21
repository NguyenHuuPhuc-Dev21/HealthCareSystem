import {
  DEFAULT_MIN_NURSE_DEPOSIT_VND,
  DEFAULT_PLATFORM_COMMISSION_RATE,
} from '../constants';
import type {
  DirectInvitation,
  JobBoardFilter,
  JobItem,
} from '../contracts/job-board.contracts';

export function calculateJobNetAmount(totalAmount: number): number {
  return Math.round(totalAmount * (1 - DEFAULT_PLATFORM_COMMISSION_RATE));
}

export function toLocalIsoDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayMockDate(): string {
  return toLocalIsoDateString(new Date());
}

export function getTomorrowMockDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toLocalIsoDateString(d);
}

export const JOB_CLAIM_ERROR_MESSAGES = {
  DEPOSIT_BELOW_MIN: `Số dư ví ký quỹ của bạn không đủ tối thiểu ${DEFAULT_MIN_NURSE_DEPOSIT_VND.toLocaleString('vi-VN')}đ để nhận ca.`,
  DEPOSIT_SHORTFALL: `Số dư ví ký quỹ của bạn không đủ tối thiểu ${DEFAULT_MIN_NURSE_DEPOSIT_VND.toLocaleString('vi-VN')}đ để nhận ca.`,
  DEPOSIT_GRACE_CASH_NOT_ALLOWED:
    'Ca tiền mặt cần ký quỹ đủ 300.000đ. Trong giai đoạn làm quen bạn nhận được ca chuyển khoản.',
  DEPOSIT_GRACE_EXHAUSTED:
    'Đã dùng hết 3 ca làm quen / hết 30 ngày, nạp thêm để nhận tiếp.',
  ACCOUNT_CLOSING: 'Bạn đã yêu cầu ngừng hợp tác nên không thể nhận ca mới.',
  TIER_NOT_ALLOWED: 'Dịch vụ xâm lấn yêu cầu Điều dưỡng Cấp 2 có GPHN còn hạn.',
  TIER_MISMATCH: 'Dịch vụ xâm lấn chỉ dành riêng cho Điều dưỡng Cấp 2 có GPHN hợp lệ.',
  SCHEDULE_CONFLICT: 'Thời gian ca này trùng với ca trực hoặc lịch bận đã đăng ký.',
  JOB_ALREADY_TAKEN: 'Ca làm việc này vừa được một điều dưỡng khác tiếp nhận (First-come claim)!',
  ALREADY_CLAIMED: 'Ca làm việc này vừa được một điều dưỡng khác tiếp nhận (First-come claim)!',
  ACCOUNT_SUSPENDED: 'Tài khoản của bạn hiện đang bị tạm khóa nhận ca mới.',
} as const;

export function getInitialMockJobs(): JobItem[] {
  const today = getTodayMockDate();
  const tomorrow = getTomorrowMockDate();

  return [
    {
      id: 'job-1042',
      code: 'HC-2026-1042',
      serviceName: 'Thay băng vết mổ hậu phẫu',
      serviceType: 'procedure',
      requiredTier: 'TIER_2_SPECIALIST',
      isInvasive: true,
      hasPrescription: true,
      prescriptionUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800',
      prescriptionFileName: 'ylenh_thaybang_1042.jpg',
      prescriptionPrescribedDate: '26/10/2026',
      prescriptionExpiryDays: 7,
      date: today,
      startTime: '15:00',
      endTime: '16:00',
      district: 'Hải Châu',
      distanceKm: 1.2,
      patientName: 'Bà Nguyễn Thị Hoa',
      patientAge: 78,
      patientGender: 'Nữ',
      patientWeight: 52,
      mobilityStatus: 'Hỗ trợ di chuyển',
      medicalCondition: 'Sau phẫu thuật thay khớp háng phải (3 tháng)',
      medicalHistory: 'Tăng huyết áp · Đái tháo đường type 2',
      allergies: 'Penicillin (mề đay, khó thở nhẹ)',
      contagionRisk: 'Không có',
      fullAddress: 'Số 25 Quang Trung, Phường Hải Châu 1, Quận Hải Châu, TP. Đà Nẵng',
      customerName: 'Anh Nguyễn Văn An',
      customerPhoneMasked: '0905 ••• 123',
      note: 'Vết mổ thay khớp gối ngày thứ 5, dịch thấm băng ít, người nhà hỗ trợ chu đáo.',
      baseAmount: 500000,
      totalAmount: 500000,
      netAmount: calculateJobNetAmount(500000),
      cancellationPenaltyPercent: 20,
      paymentMethod: 'BANK_TRANSFER',
      paymentStatus: 'ESCROW_HELD',
      matchingMode: 'JOB_BOARD',
      status: 'MATCHING',
    },
    {
      id: 'job-1043',
      code: 'HC-2026-1043',
      serviceName: 'Ca đêm chăm sóc sau phẫu thuật',
      serviceType: 'shift',
      requiredTier: 'TIER_2_SPECIALIST',
      isInvasive: true,
      hasPrescription: true,
      prescriptionUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800',
      prescriptionFileName: 'ylenh_cadem_1043.jpg',
      prescriptionPrescribedDate: '28/10/2026',
      prescriptionExpiryDays: 7,
      date: today,
      startTime: '20:00',
      endTime: '06:00',
      district: 'Hải Châu',
      distanceKm: 1.8,
      patientName: 'Ông Trần Văn Nam',
      patientAge: 72,
      patientGender: 'Nam',
      patientWeight: 64,
      mobilityStatus: 'Nằm tại giường',
      medicalCondition: 'Hậu phẫu lồng ngực ngày thứ 3',
      medicalHistory: 'COPD nhẹ · Tăng mỡ máu',
      allergies: 'Không có tiền sử dị ứng thuốc',
      contagionRisk: 'Không có',
      fullAddress: 'Số 112 Lê Lợi, Phường Thạch Thang, Quận Hải Châu, TP. Đà Nẵng',
      customerName: 'Chị Trần Thu Hà',
      customerPhoneMasked: '0912 ••• 456',
      note: 'Chăm sóc dẫn lưu màng phổi, theo dõi sinh hiệu mỗi 2 giờ, phụ phí đêm +20% và thưởng nóng.',
      baseAmount: 480000,
      nightSurcharge: 100000,
      urgentBonus: 100000,
      totalAmount: 680000,
      netAmount: calculateJobNetAmount(680000),
      cancellationPenaltyPercent: 20,
      durationHours: 10,
      paymentMethod: 'BANK_TRANSFER',
      paymentStatus: 'ESCROW_HELD',
      matchingMode: 'JOB_BOARD',
      status: 'MATCHING',
    },
    {
      id: 'job-1044',
      code: 'HC-2026-1044',
      serviceName: 'Trông & chăm sóc bệnh nhân theo ca 8 giờ',
      serviceType: 'shift',
      requiredTier: 'TIER_1_BASIC',
      isInvasive: false,
      hasPrescription: false,
      date: tomorrow,
      startTime: '07:00',
      endTime: '15:00',
      district: 'Sơn Trà',
      distanceKm: 4.6,
      patientName: 'Cụ Lê Văn Tùng',
      patientAge: 85,
      patientGender: 'Nam',
      patientWeight: 58,
      mobilityStatus: 'Nằm tại giường',
      medicalCondition: 'Suy nhược tuổi già',
      medicalHistory: 'Đục thủy tinh thể',
      allergies: 'Không có',
      contagionRisk: 'Không có',
      fullAddress: 'Số 88 Võ Văn Kiệt, Phường An Hải Đông, Quận Sơn Trà, TP. Đà Nẵng',
      customerName: 'Anh Lê Tuấn',
      customerPhoneMasked: '0988 ••• 321',
      note: 'Hỗ trợ ăn uống qua sonde dạ dày, xoay trở chống loét, nhắc thuốc theo đơn có sẵn.',
      baseAmount: 800000,
      totalAmount: 800000,
      netAmount: calculateJobNetAmount(800000),
      durationHours: 8,
      cancellationPenaltyPercent: 20,
      paymentMethod: 'BANK_TRANSFER',
      paymentStatus: 'ESCROW_HELD',
      matchingMode: 'JOB_BOARD',
      status: 'MATCHING',
    },
    {
      id: 'job-1045',
      code: 'HC-2026-1045',
      serviceName: 'Tiêm bắp & đo huyết áp định kỳ',
      serviceType: 'procedure',
      requiredTier: 'TIER_2_SPECIALIST',
      isInvasive: true,
      hasPrescription: true,
      prescriptionUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800',
      prescriptionFileName: 'ylenh_tiembap_1045.jpg',
      prescriptionPrescribedDate: '29/10/2026',
      prescriptionExpiryDays: 5,
      date: tomorrow,
      startTime: '16:30',
      endTime: '17:30',
      district: 'Thanh Khê',
      distanceKm: 3.1,
      patientName: 'Bà Đặng Thị Mai',
      patientAge: 64,
      patientGender: 'Nữ',
      patientWeight: 55,
      mobilityStatus: 'Tự đi lại',
      medicalCondition: 'Viêm phế quản co thắt',
      medicalHistory: 'Viêm khớp gối mạn tính',
      allergies: 'Aspirin',
      contagionRisk: 'Không có',
      fullAddress: 'Số 45 Điện Biên Phủ, Phường Chính Gián, Quận Thanh Khê, TP. Đà Nẵng',
      customerName: 'Chị Mai Lan',
      customerPhoneMasked: '0935 ••• 789',
      note: 'Tiêm kháng sinh theo y lệnh Bệnh viện Đà Nẵng, đo huyết áp và đường huyết mao mạch.',
      baseAmount: 200000,
      totalAmount: 200000,
      netAmount: calculateJobNetAmount(200000),
      cancellationPenaltyPercent: 20,
      paymentMethod: 'CASH',
      paymentStatus: 'UNPAID',
      matchingMode: 'JOB_BOARD',
      status: 'MATCHING',
    },
    {
      id: 'job-1046',
      code: 'HC-2026-1046',
      serviceName: 'Tắm bé & massage sơ sinh tại nhà',
      serviceType: 'procedure',
      requiredTier: 'TIER_1_BASIC',
      isInvasive: false,
      hasPrescription: false,
      date: today,
      startTime: '09:00',
      endTime: '10:00',
      district: 'Hải Châu',
      distanceKm: 0.9,
      patientName: 'Bé Nguyễn Minh Khôi',
      patientAge: 0,
      patientGender: 'Nam',
      patientWeight: 3.6,
      mobilityStatus: 'Sơ sinh',
      medicalCondition: 'Rốn khô, không sốt',
      allergies: 'Không có',
      contagionRisk: 'Không có',
      fullAddress: 'Số 15 Hoàng Diệu, Phường Phước Ninh, Quận Hải Châu, TP. Đà Nẵng',
      customerName: 'Chị Nguyễn Phương Thảo',
      customerPhoneMasked: '0903 ••• 999',
      note: 'Tắm bé sơ sinh, chăm sóc rốn chuẩn y khoa và hướng dẫn mẹ massage bé.',
      baseAmount: 180000,
      urgentBonus: 50000,
      totalAmount: 230000,
      netAmount: calculateJobNetAmount(230000),
      cancellationPenaltyPercent: 20,
      paymentMethod: 'BANK_TRANSFER',
      paymentStatus: 'ESCROW_HELD',
      matchingMode: 'JOB_BOARD',
      status: 'MATCHING',
    },
  ];
}

export function getInitialMockInvite(): DirectInvitation {
  const tomorrow = getTomorrowMockDate();
  const expireTime = new Date(Date.now() + 14 * 60 * 1000 + 45 * 1000); // 14p45s

  return {
    bookingId: 'job-1048',
    code: 'HC-2026-1048',
    inviterName: 'Anh Nguyễn Văn An',
    patientName: 'Bà Nguyễn Thị Hoa',
    patientAge: 78,
    serviceName: 'Chăm sóc sau phẫu thuật tại nhà',
    date: tomorrow,
    startTime: '08:00',
    endTime: '12:00',
    district: 'Hải Châu',
    totalAmount: 500000,
    expiresAt: expireTime.toISOString(),
    expiresInSeconds: 14 * 60 + 45,
  };
}

export function filterMockJobs(jobs: JobItem[], filter: JobBoardFilter): JobItem[] {
  switch (filter) {
    case 'shift':
      return jobs.filter((j) => j.serviceType === 'shift');
    case 'task':
      return jobs.filter((j) => j.serviceType === 'procedure');
    case 'near':
      return [...jobs].sort((a, b) => a.distanceKm - b.distanceKm);
    case 'bonus':
      return jobs.filter((j) => Boolean(j.urgentBonus || j.nightSurcharge));
    case 'all':
    default:
      return [...jobs];
  }
}
