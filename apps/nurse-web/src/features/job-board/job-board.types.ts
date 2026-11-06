export type JobServiceType = 'procedure' | 'shift';
export type JobBoardFilter = 'all' | 'shift' | 'task' | 'near' | 'bonus';

export interface JobItem {
    id: string;
    code: string;
    serviceName: string;
    serviceType: JobServiceType;
    requiredTier: 'TIER_1_BASIC' | 'TIER_2_SPECIALIST';
    isInvasive: boolean;
    hasPrescription: boolean;
    prescriptionUrl?: string;
    prescriptionFileName?: string;
    prescriptionPrescribedDate?: string;
    prescriptionExpiryDays?: number;
    date: string; // YYYY-MM-DD
    startTime: string; // HH:mm
    endTime: string; // HH:mm
    district: string;
    distanceKm: number;
    patientName: string;
    patientAge: number;
    patientGender?: string;
    patientWeight?: number; // Cân nặng (kg)
    mobilityStatus?: string; // Vận động: Hỗ trợ di chuyển / Tự đi lại / Bất động
    medicalCondition?: string; // Tình trạng hiện tại
    medicalHistory?: string; // Tiền sử bệnh
    allergies?: string; // Dị ứng thuốc/thức ăn
    contagionRisk?: string; // Nguy cơ truyền nhiễm
    fullAddress?: string; // Địa chỉ chi tiết
    customerName?: string; // Tên người đặt ca
    customerPhoneMasked?: string; // SĐT người đặt (đã che)
    note?: string;
    totalAmount: number;
    baseAmount: number;
    urgentBonus?: number; // Thưởng nóng (nếu có)
    nightSurcharge?: number; // Phụ phí đêm
    durationHours?: number; // Thời lượng tính theo giờ
    netAmount?: number; // Thu nhập thực nhận sau quyết toán do backend tính (BR-11)
    cancellationPenaltyPercent?: number; // % phạt hủy ca theo SLA (§5.2)
    paymentMethod: 'BANK_TRANSFER' | 'CASH';
    paymentStatus: 'ESCROW_HELD' | 'UNPAID';
    matchingMode: 'JOB_BOARD' | 'RADAR_DISPATCH';
    isDirectInvite?: boolean;
    inviterName?: string;
    directInviteExpiresAt?: string; // ISO datetime
    status: 'MATCHING' | 'CONFIRMED' | 'IN_PROGRESS';
    // Helper fields computed or assigned for display
    isLockedForTier1?: boolean;
}

export interface RadarJob extends JobItem {
    wave: 1 | 2; // Wave 1: 0-5km (0-5p), Wave 2: 0-10km (5-15p)
    radarExpiresAt: string; // ISO datetime
    expiresInSeconds?: number;
    isUrgent?: boolean;
}

export interface DirectInvitation {
    bookingId: string;
    code: string;
    inviterName: string;
    patientName: string;
    patientAge: number;
    serviceName: string;
    date: string;
    startTime: string;
    endTime: string;
    district: string;
    totalAmount: number;
    expiresAt: string; // ISO datetime
    expiresInSeconds?: number;
}

export interface ClaimJobResult {
    success: boolean;
    bookingId?: string;
    message?: string;
    errorCode?: 'ALREADY_CLAIMED' | 'TIER_MISMATCH' | 'DEPOSIT_SHORTFALL' | 'SCHEDULE_CONFLICT';
}
