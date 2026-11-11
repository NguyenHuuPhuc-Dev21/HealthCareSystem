import type { ClaimJobResult, DirectInvitation, JobItem, RadarJob } from './job-board.types';
import {
    DEFAULT_MIN_NURSE_DEPOSIT_VND,
    DEFAULT_PLATFORM_COMMISSION_RATE,
    ExecutionStatus,
    MobilityStatus,
    PaymentStatus,
} from '@healthcare-system/shared';
import { getStoredShiftsMap, upsertAcceptedShiftFromJob } from '../shifts/shift.mock';
import type { ShiftExecutionState } from '../shifts/shift.types';

const STORAGE_KEY = 'carenest_mock_job_board_v1';
const RADAR_KEY = 'carenest_mock_radar_job_v1';
const INVITE_KEY = 'carenest_mock_direct_invite_v1';
const AVAIL_KEY = 'mock_availability_db_v1';
const ACCEPTED_JOBS_KEY = 'carenest_mock_accepted_jobs_v1';

function delay<T>(data: T, ms = 300): Promise<T> {
    return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

function toLocalIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function getTomorrowDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toLocalIsoDate(d);
}

function getTodayDate(): string {
    return toLocalIsoDate(new Date());
}

function getInitialJobs(): JobItem[] {
    const today = getTodayDate();
    const tomorrow = getTomorrowDate();

    return [
        {
            id: 'job-1042',
            code: 'HC-2026-1042',
            serviceName: 'Thay băng vết mổ hậu phẫu',
            serviceType: 'procedure',
            requiredTier: 'TIER_2_SPECIALIST',
            isInvasive: true,
            hasPrescription: true,
            prescriptionUrl: '/mock/don-thuoc-1042.jpg',
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
            baseAmount: 250000,
            totalAmount: 250000,
            netAmount: 212500,
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
            prescriptionUrl: '/mock/don-thuoc-1043.jpg',
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
            netAmount: 578000,
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
            note: 'Hỗ trợ ăn uống qua sonde dạ dày, xoay trở chống loét, nhắc thuốc theo đơn có sẵn.',
            baseAmount: 800000,
            totalAmount: 800000,
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
            date: tomorrow,
            startTime: '16:30',
            endTime: '17:30',
            district: 'Thanh Khê',
            distanceKm: 3.1,
            patientName: 'Bà Đặng Thị Mai',
            patientAge: 64,
            patientGender: 'Nữ',
            note: 'Tiêm kháng sinh theo y lệnh Bệnh viện Đà Nẵng, đo huyết áp và đường huyết mao mạch.',
            baseAmount: 200000,
            totalAmount: 200000,
            paymentMethod: 'CASH',
            paymentStatus: 'UNPAID',
            matchingMode: 'JOB_BOARD',
            status: 'MATCHING',
        },
    ];
}

function getInitialInvite(): DirectInvitation {
    const tomorrow = getTomorrowDate();
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
        totalAmount: 400000,
        expiresAt: expireTime.toISOString(),
    };
}

function getInitialRadar(): RadarJob {
    const today = getTodayDate();
    const expireTime = new Date(Date.now() + 45 * 1000); // 45 giây đếm ngược

    return {
        id: 'job-radar-1055',
        code: 'HC-2026-1055',
        serviceName: 'Thay băng vết thương khẩn cấp',
        serviceType: 'procedure',
        requiredTier: 'TIER_2_SPECIALIST',
        isInvasive: true,
        hasPrescription: true,
        date: today,
        startTime: '15:00',
        endTime: '16:00',
        district: 'Hải Châu',
        distanceKm: 1.2,
        patientName: 'Bà Hoa',
        patientAge: 78,
        patientGender: 'Nữ',
        note: 'Bệnh nhân chảy dịch băng vết mổ, cần thay băng vô khuẩn gấp tại nhà.',
        baseAmount: 250000,
        totalAmount: 250000,
        netAmount: 212500,
        cancellationPenaltyPercent: 20,
        paymentMethod: 'BANK_TRANSFER',
        paymentStatus: 'ESCROW_HELD',
        matchingMode: 'RADAR_DISPATCH',
        status: 'MATCHING',
        wave: 1,
        radarExpiresAt: expireTime.toISOString(),
    };
}

export function loadStoredJobs(): JobItem[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch {
        // fallback
    }
    const initial = getInitialJobs();
    saveStoredJobs(initial);
    return initial;
}

export function saveStoredJobs(jobs: JobItem[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

export function loadStoredInvite(): DirectInvitation | null {
    try {
        const raw = localStorage.getItem(INVITE_KEY);
        if (raw === 'declined' || raw === 'accepted') return null;
        if (raw) return JSON.parse(raw);
    } catch {
        // fallback
    }
    const initial = getInitialInvite();
    localStorage.setItem(INVITE_KEY, JSON.stringify(initial));
    return initial;
}

export function loadStoredRadar(): RadarJob | null {
    try {
        const raw = localStorage.getItem(RADAR_KEY);
        if (raw === 'dismissed' || raw === 'accepted') return null;
        if (raw) return JSON.parse(raw);
    } catch {
        // fallback
    }
    const initial = getInitialRadar();
    localStorage.setItem(RADAR_KEY, JSON.stringify(initial));
    return initial;
}

/**
 * Đồng bộ ca vừa nhận vào danh sách ca đã chốt của Giai đoạn 2 (Availability & Shifts)
 */
function syncToConfirmedBookings(job: {
    id: string;
    code: string;
    serviceName: string;
    date: string;
    startTime: string;
    endTime: string;
}) {
    try {
        const availRaw = localStorage.getItem(AVAIL_KEY);
        if (!availRaw) return;
        const availDb = JSON.parse(availRaw);
        // Duyệt qua các tài khoản và gắn booking mới
        for (const phone of Object.keys(availDb)) {
            const userDb = availDb[phone];
            if (userDb && Array.isArray(userDb.bookings)) {
                if (!userDb.bookings.some((b: any) => b.id === job.id)) {
                    userDb.bookings.push({
                        id: job.id,
                        code: job.code,
                        date: job.date,
                        startTime: job.startTime,
                        endTime: job.endTime,
                        status: 'CONFIRMED',
                        serviceName: job.serviceName,
                    });
                }
            }
        }
        localStorage.setItem(AVAIL_KEY, JSON.stringify(availDb));
    } catch {
        // Bỏ qua nếu chưa khởi tạo DB lịch rảnh
    }
}

function loadAcceptedJobSnapshots(): Record<string, JobItem> {
    try {
        const raw = localStorage.getItem(ACCEPTED_JOBS_KEY);
        if (raw) return JSON.parse(raw) as Record<string, JobItem>;
    } catch {
        // ignore parse errors
    }
    return {};
}

function saveAcceptedJobSnapshot(job: JobItem): void {
    try {
        const map = loadAcceptedJobSnapshots();
        map[job.id] = job;
        localStorage.setItem(ACCEPTED_JOBS_KEY, JSON.stringify(map));
    } catch {
        // ignore storage errors
    }
}

function inviteToJobItem(invite: DirectInvitation): JobItem {
    const netAmount = Math.round(invite.totalAmount * (1 - DEFAULT_PLATFORM_COMMISSION_RATE));
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
        distanceKm: 2.0,
        patientName: invite.patientName,
        patientAge: invite.patientAge,
        mobilityStatus: 'Hỗ trợ di chuyển',
        medicalCondition: 'Chăm sóc tại nhà theo chỉ định người nhà cũ',
        fullAddress: `${invite.district}, TP. Đà Nẵng`,
        customerName: invite.inviterName,
        customerPhoneMasked: '0905 ••• 456',
        note: `Lời mời trực tiếp từ gia đình (${invite.inviterName}).`,
        totalAmount: invite.totalAmount,
        baseAmount: invite.totalAmount,
        netAmount,
        cancellationPenaltyPercent: 20,
        paymentMethod: 'BANK_TRANSFER',
        paymentStatus: 'ESCROW_HELD',
        matchingMode: 'JOB_BOARD',
        isDirectInvite: true,
        inviterName: invite.inviterName,
        status: 'CONFIRMED',
    };
}

function mobilityLabel(mobility: MobilityStatus): string {
    switch (mobility) {
        case MobilityStatus.BEDRIDDEN:
            return 'Nằm tại giường';
        case MobilityStatus.PARTIAL:
            return 'Hỗ trợ di chuyển';
        default:
            return 'Tự đi lại';
    }
}

function shiftStateToJobItem(shift: ShiftExecutionState, snapshot?: JobItem): JobItem {
    const mappedStatus: JobItem['status'] =
        shift.executionStatus === ExecutionStatus.IN_PROGRESS ? 'IN_PROGRESS' : 'CONFIRMED';

    if (snapshot) {
        return {
            ...snapshot,
            totalAmount: shift.totalAmount,
            netAmount: Math.round(shift.totalAmount * (1 - DEFAULT_PLATFORM_COMMISSION_RATE)),
            startTime: shift.startTime,
            endTime: shift.endTime,
            status: mappedStatus,
        };
    }

    const districtGuess = shift.patientAddress.split(',').slice(-2, -1)[0]?.trim() || 'Hải Châu';
    return {
        id: shift.bookingId,
        code: shift.bookingCode,
        serviceName: shift.serviceName,
        serviceType: shift.isInvasive ? 'procedure' : 'shift',
        requiredTier: shift.isInvasive ? 'TIER_2_SPECIALIST' : 'TIER_1_BASIC',
        isInvasive: shift.isInvasive,
        hasPrescription: shift.isInvasive,
        prescriptionFileName: shift.isInvasive ? `ylenh_${shift.bookingCode.toLowerCase()}.jpg` : undefined,
        prescriptionPrescribedDate: getTodayDate(),
        prescriptionExpiryDays: 7,
        date: getTodayDate(),
        startTime: shift.startTime,
        endTime: shift.endTime,
        district: districtGuess,
        distanceKm: 1.8,
        patientName: shift.patientName,
        patientAge: shift.patientAge,
        mobilityStatus: mobilityLabel(shift.mobilityStatus),
        medicalCondition: shift.isInvasive
            ? 'Cần theo dõi và thực hiện thủ thuật vô khuẩn theo y lệnh'
            : 'Chăm sóc & hỗ trợ sinh hoạt phục hồi tại nhà',
        medicalHistory: 'Theo hồ sơ bệnh án người cao tuổi tại CareNest',
        allergies: 'Không ghi nhận dị ứng',
        contagionRisk: 'Không có',
        fullAddress: shift.patientAddress,
        customerName: 'Người nhà bệnh nhân',
        customerPhoneMasked: '0905 ••• 123',
        note: shift.progressNotes[0] || 'Mang đầy đủ thiết bị đo sinh tồn và vật tư tiêu chuẩn.',
        totalAmount: shift.totalAmount,
        baseAmount: shift.totalAmount,
        durationHours: shift.scheduledHours,
        netAmount: Math.round(shift.totalAmount * (1 - DEFAULT_PLATFORM_COMMISSION_RATE)),
        cancellationPenaltyPercent: 20,
        paymentMethod: 'BANK_TRANSFER',
        paymentStatus: shift.paymentStatus === PaymentStatus.UNPAID ? 'UNPAID' : 'ESCROW_HELD',
        matchingMode: 'JOB_BOARD',
        status: mappedStatus,
    };
}

function syncJobToShiftStore(job: JobItem) {
    saveAcceptedJobSnapshot({ ...job, status: 'CONFIRMED' });
    upsertAcceptedShiftFromJob({
        bookingId: job.id,
        bookingCode: job.code,
        patientName: job.patientName,
        patientAge: job.patientAge,
        patientAddress: job.fullAddress || `${job.district}, Đà Nẵng`,
        serviceName: job.serviceName,
        startTime: job.startTime,
        endTime: job.endTime,
        scheduledHours: job.durationHours,
        totalAmount: job.totalAmount,
        isInvasive: job.isInvasive,
        mobilityStatus: job.mobilityStatus,
        paymentStatus: job.paymentStatus,
    });
}

export async function mockFetchJobBoard(): Promise<JobItem[]> {
    return delay(loadStoredJobs(), 300);
}

export async function mockFetchDirectInvite(): Promise<DirectInvitation | null> {
    return delay(loadStoredInvite(), 200);
}

export async function mockFetchRadarJob(): Promise<RadarJob | null> {
    return delay(loadStoredRadar(), 200);
}

export async function mockAcceptJob(
    jobId: string,
    nurseTier: string,
    depositBalance = DEFAULT_MIN_NURSE_DEPOSIT_VND,
): Promise<ClaimJobResult> {
    const jobs = loadStoredJobs();
    const target = jobs.find((j) => j.id === jobId);

    if (!target) {
        return delay({
            success: false,
            message: 'Ca làm việc này vừa được một điều dưỡng khác tiếp nhận (First-come claim)!',
            errorCode: 'ALREADY_CLAIMED',
        });
    }

    // 1. Kiểm tra ký quỹ
    if (depositBalance < DEFAULT_MIN_NURSE_DEPOSIT_VND) {
        return delay({
            success: false,
            message: `Số dư ví ký quỹ của bạn không đủ tối thiểu ${DEFAULT_MIN_NURSE_DEPOSIT_VND.toLocaleString('vi-VN')}đ để nhận ca.`,
            errorCode: 'DEPOSIT_SHORTFALL',
        });
    }

    // 2. Kiểm tra Tier
    if (target.isInvasive && nurseTier !== 'TIER_2_SPECIALIST') {
        return delay({
            success: false,
            message: 'Dịch vụ xâm lấn chỉ dành riêng cho Điều dưỡng Cấp 2 có GPHN hợp lệ.',
            errorCode: 'TIER_MISMATCH',
        });
    }

    // Nhận thành công: xóa khỏi Job Board & đồng bộ sang Ca của tôi + Lịch rảnh
    saveStoredJobs(jobs.filter((j) => j.id !== jobId));
    syncToConfirmedBookings(target);
    syncJobToShiftStore(target);

    return delay({
        success: true,
        bookingId: target.id,
        message: `Đã nhận thành công đơn ${target.code}. Ca trực đã được thêm vào mục Ca của tôi!`,
    });
}

export async function mockDeclineDirectInvite(_bookingId: string): Promise<{ success: boolean }> {
    localStorage.setItem(INVITE_KEY, 'declined');
    return delay({ success: true }, 250);
}

export async function mockAcceptDirectInvite(
    bookingId: string,
    _nurseTier: string,
    depositBalance = DEFAULT_MIN_NURSE_DEPOSIT_VND,
): Promise<ClaimJobResult> {
    const invite = loadStoredInvite();
    if (!invite || invite.bookingId !== bookingId) {
        return delay({
            success: false,
            message: 'Lời mời này đã hết hạn hoặc không còn khả dụng.',
            errorCode: 'ALREADY_CLAIMED',
        });
    }

    if (depositBalance < DEFAULT_MIN_NURSE_DEPOSIT_VND) {
        return delay({
            success: false,
            message: `Số dư ví ký quỹ của bạn không đủ tối thiểu ${DEFAULT_MIN_NURSE_DEPOSIT_VND.toLocaleString('vi-VN')}đ để nhận ca.`,
            errorCode: 'DEPOSIT_SHORTFALL',
        });
    }

    localStorage.setItem(INVITE_KEY, 'accepted');
    const mappedJob = inviteToJobItem(invite);
    syncToConfirmedBookings({
        id: invite.bookingId,
        code: invite.code,
        serviceName: invite.serviceName,
        date: invite.date,
        startTime: invite.startTime,
        endTime: invite.endTime,
    });
    syncJobToShiftStore(mappedJob);

    return delay({
        success: true,
        bookingId: invite.bookingId,
        message: `Đã chấp nhận lời mời từ ${invite.inviterName}. Đơn ${invite.code} đã được thêm vào Ca của tôi!`,
    });
}

export async function mockDismissRadar(): Promise<{ success: boolean }> {
    localStorage.setItem(RADAR_KEY, 'dismissed');
    return delay({ success: true }, 200);
}

export async function mockAcceptRadar(
    jobId: string,
    nurseTier: string,
    depositBalance = DEFAULT_MIN_NURSE_DEPOSIT_VND,
): Promise<ClaimJobResult> {
    const radar = loadStoredRadar();
    if (!radar || radar.id !== jobId) {
        return delay({
            success: false,
            message: 'Ca khẩn cấp này vừa được điều dưỡng khác nhận trên Radar!',
            errorCode: 'ALREADY_CLAIMED',
        });
    }

    if (depositBalance < DEFAULT_MIN_NURSE_DEPOSIT_VND) {
        return delay({
            success: false,
            message: `Số dư ký quỹ không đủ tối thiểu ${DEFAULT_MIN_NURSE_DEPOSIT_VND.toLocaleString('vi-VN')}đ.`,
            errorCode: 'DEPOSIT_SHORTFALL',
        });
    }

    if (radar.isInvasive && nurseTier !== 'TIER_2_SPECIALIST') {
        return delay({
            success: false,
            message: 'Dịch vụ yêu cầu Điều dưỡng Cấp 2.',
            errorCode: 'TIER_MISMATCH',
        });
    }

    localStorage.setItem(RADAR_KEY, 'accepted');
    syncToConfirmedBookings(radar);
    syncJobToShiftStore(radar);

    return delay({
        success: true,
        bookingId: radar.id,
        message: `Đã nhận thành công ca khẩn cấp ${radar.code} qua Radar Dispatch!`,
    });
}

export async function mockFetchJobById(jobId: string): Promise<JobItem | null> {
    const jobs = loadStoredJobs();
    const found = jobs.find((j) => j.id === jobId || j.code === jobId);
    if (found) return delay(found, 100);

    const radar = loadStoredRadar();
    if (radar && (radar.id === jobId || radar.code === jobId)) return delay(radar, 100);

    const invite = loadStoredInvite();
    if (invite && (invite.bookingId === jobId || invite.code === jobId)) {
        return delay(inviteToJobItem(invite), 100);
    }

    const snapshots = loadAcceptedJobSnapshots();
    const shiftsMap = getStoredShiftsMap();
    const matchedShift =
        shiftsMap[jobId] ||
        Object.values(shiftsMap).find((s) => s.bookingCode === jobId);

    if (matchedShift) {
        const snapshot = snapshots[matchedShift.bookingId] || snapshots[jobId];
        return delay(shiftStateToJobItem(matchedShift, snapshot), 100);
    }

    if (snapshots[jobId]) {
        return delay(snapshots[jobId], 100);
    }

    // Fallback: Look up across account bookings saved in AVAIL_KEY (availDb[phone].bookings)
    try {
        const rawAvail = localStorage.getItem(AVAIL_KEY);
        if (rawAvail) {
            const parsed = JSON.parse(rawAvail) as Record<string, { bookings?: Array<{ id: string; code: string; serviceName: string; date: string; startTime: string; endTime: string }> }>;
            for (const account of Object.values(parsed)) {
                const matched = account?.bookings?.find((b) => b.id === jobId || b.code === jobId);
                if (matched) {
                    const fullJob: JobItem = {
                        id: matched.id,
                        code: matched.code,
                        serviceName: matched.serviceName,
                        serviceType: 'procedure',
                        requiredTier: 'TIER_2_SPECIALIST',
                        isInvasive: true,
                        hasPrescription: true,
                        prescriptionFileName: `ylenh_${matched.code.toLowerCase().replace(/[^a-z0-9]/g, '_')}.jpg`,
                        prescriptionPrescribedDate: matched.date,
                        prescriptionExpiryDays: 7,
                        date: matched.date,
                        startTime: matched.startTime,
                        endTime: matched.endTime,
                        district: 'Hải Châu',
                        distanceKm: 1.2,
                        patientName: 'Bà Nguyễn Thị Hoa',
                        patientAge: 78,
                        patientWeight: 52,
                        mobilityStatus: 'Hỗ trợ di chuyển',
                        medicalCondition: 'Hậu phẫu thay khớp háng phải, theo dõi vết mổ',
                        medicalHistory: 'Tăng huyết áp · Đái tháo đường type 2',
                        allergies: 'Penicillin (mề đay, khó thở nhẹ)',
                        contagionRisk: 'Không có',
                        fullAddress: 'Số 25 Quang Trung, Hải Châu 1, Hải Châu, Đà Nẵng',
                        customerName: 'Anh Nguyễn Văn An',
                        customerPhoneMasked: '0905 ••• 123',
                        note: 'Bệnh nhân sau phẫu thuật cần hỗ trợ thay băng vô khuẩn tại chỗ.',
                        baseAmount: 500000,
                        totalAmount: 500000,
                        netAmount: 425000,
                        cancellationPenaltyPercent: 20,
                        paymentMethod: 'BANK_TRANSFER',
                        paymentStatus: 'ESCROW_HELD',
                        matchingMode: 'JOB_BOARD',
                        status: 'CONFIRMED',
                    };
                    return delay(fullJob, 100);
                }
            }
        }
    } catch {
        // ignore storage parse error
    }

    return delay(null, 100);
}
