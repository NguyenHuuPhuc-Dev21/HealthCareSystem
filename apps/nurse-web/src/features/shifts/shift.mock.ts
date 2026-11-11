import {
  ExecutionStatus,
  PaymentStatus,
  BookingDisputeStatus,
  MobilityStatus,
  AdjustmentStatus,
  haversineDistanceMeters,
  CHECKIN_MAX_RADIUS_METERS,
  DEFAULT_TRAVEL_SUPPORT_VND,
} from '@healthcare-system/shared';
import {
  ShiftExecutionState,
  CheckInRequest,
  InitialAssessmentRequest,
  AddVitalSignsRequest,
  ToggleCareActivityRequest,
  RespondExtensionRequest,
  RejectPrescriptionRequest,
  CheckOutRequest,
  SosAlertRequest,
} from './shift.types';

const SHIFT_STORAGE_KEY = 'carenest_mock_shifts_v1';

export interface AcceptedShiftSeed {
  bookingId: string;
  bookingCode: string;
  patientName: string;
  patientAge: number;
  patientAddress: string;
  serviceName: string;
  startTime: string;
  endTime: string;
  scheduledHours?: number;
  totalAmount: number;
  isInvasive: boolean;
  mobilityStatus?: string;
  paymentStatus?: 'ESCROW_HELD' | 'UNPAID';
}

function getInitialShiftDatabase(): Record<string, ShiftExecutionState> {
  return {
    'job-1': {
      bookingId: 'job-1',
      bookingCode: 'BK-20261102-001',
      patientName: 'Bà Nguyễn Thị Mai',
      patientAge: 78,
      patientAddress: 'Số 25 Quang Trung, Hải Châu 1, Hải Châu, Đà Nẵng',
      patientLatitude: 16.0718,
      patientLongitude: 108.2205,
      mobilityStatus: MobilityStatus.BEDRIDDEN,
      isInvasive: true,
      serviceName: 'Chăm sóc vết loét độ 3 & Thay băng',
      startTime: '08:00',
      endTime: '12:00',
      scheduledHours: 4,
      totalAmount: 650000,
      executionStatus: ExecutionStatus.CONFIRMED,
      paymentStatus: PaymentStatus.ESCROW_HELD,
      disputeStatus: BookingDisputeStatus.NONE,
      isMockLocationDetected: false,
      assessmentCompleted: false,
      conditionMismatchReported: false,
      vitalSigns: [],
      careActivities: [
        { id: 'act-1', title: 'Đo & ghi nhận chỉ số sinh tồn đầu ca', category: 'Sinh tồn', completed: false, mandatory: true },
        { id: 'act-2', title: 'Đối chiếu y lệnh gốc & thuốc/vật tư tại chỗ', category: 'Chuyên môn', completed: false, mandatory: true },
        { id: 'act-3', title: 'Rửa & vô khuẩn vết loét cùng cụt theo quy trình', category: 'Chuyên môn', completed: false, mandatory: true },
        { id: 'act-4', title: 'Đắp gạc chuyên dụng & băng ép đúng kỹ thuật', category: 'Chuyên môn', completed: false, mandatory: true },
        { id: 'act-5', title: 'Hỗ trợ xoay trở người bệnh chống loét tì đè', category: 'Vận động', completed: false, mandatory: false },
        { id: 'act-6', title: 'Đo chỉ số sinh tồn cuối ca & bàn giao người nhà', category: 'Bàn giao', completed: false, mandatory: true },
      ],
      progressNotes: [],
      pendingExtension: {
        id: 'ext-001',
        extraHours: 1,
        extraAmount: 162500,
        requestedAt: new Date().toISOString(),
        status: AdjustmentStatus.REQUESTED,
      },
    },
    'job-2': {
      bookingId: 'job-2',
      bookingCode: 'BK-20261102-002',
      patientName: 'Ông Trần Văn Nam',
      patientAge: 82,
      patientAddress: 'Số 112 Nguyễn Thị Minh Khai, Hải Châu, Đà Nẵng',
      patientLatitude: 16.0685,
      patientLongitude: 108.2170,
      mobilityStatus: MobilityStatus.PARTIAL,
      isInvasive: false,
      serviceName: 'Hỗ trợ phục hồi chức năng sau tai biến',
      startTime: '14:00',
      endTime: '18:00',
      scheduledHours: 4,
      totalAmount: 520000,
      executionStatus: ExecutionStatus.IN_PROGRESS,
      paymentStatus: PaymentStatus.ESCROW_HELD,
      disputeStatus: BookingDisputeStatus.NONE,
      checkedInAt: '2026-11-07T13:58:00.000Z',
      checkInDistanceMeters: 45,
      checkInSelfieUrl: 'https://images.unsplash.com/photo-1594824813583-1180b271d440?auto=format&fit=crop&w=400&q=80',
      isMockLocationDetected: false,
      assessmentCompleted: true,
      assessmentCompletedAt: '2026-11-07T14:15:00.000Z',
      conditionMismatchReported: false,
      vitalSigns: [
        {
          timestamp: '14:05',
          heartRate: 76,
          bloodPressureSystolic: 125,
          bloodPressureDiastolic: 80,
          temperature: 36.8,
          spo2: 98,
          respiratoryRate: 18,
          notes: 'Chỉ số sinh tồn ổn định trước khi tập vận động',
        },
      ],
      careActivities: [
        { id: 'act-1', title: 'Đo sinh tồn ban đầu', category: 'Sinh tồn', completed: true, completedAt: '14:05', mandatory: true },
        { id: 'act-2', title: 'Khởi động khớp thụ động chi trên & chi dưới', category: 'Vận động', completed: true, completedAt: '14:40', mandatory: true },
        { id: 'act-3', title: 'Tập ngồi thõng chân cạnh giường', category: 'Vận động', completed: false, mandatory: true },
        { id: 'act-4', title: 'Tập đứng có trợ giúp của thanh vịn', category: 'Vận động', completed: false, mandatory: false },
        { id: 'act-5', title: 'Đo sinh tồn kết thúc ca & ghi nhận tiến trình', category: 'Bàn giao', completed: false, mandatory: true },
      ],
      progressNotes: [
        '14:10: Bệnh nhân tỉnh táo, hợp tác tốt trong buổi tập.',
        '14:45: Tay phải phục hồi cử động co duỗi mức 3/5.',
      ],
      pendingExtension: null,
    },
  };
}

function loadShiftStore(): Record<string, ShiftExecutionState> {
  try {
    const raw = localStorage.getItem(SHIFT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, ShiftExecutionState>;
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return parsed;
      }
    }
  } catch {
    // Fallback to seed store when localStorage is unavailable or corrupted
  }
  const initial = getInitialShiftDatabase();
  saveShiftStore(initial);
  return initial;
}

function saveShiftStore(store: Record<string, ShiftExecutionState>): void {
  try {
    localStorage.setItem(SHIFT_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota errors in sandboxed/private browsing
  }
}

function resolveMobilityStatus(value?: string): MobilityStatus {
  const normalized = (value || '').toLowerCase();
  if (normalized.includes('bất động') || normalized.includes('nằm')) {
    return MobilityStatus.BEDRIDDEN;
  }
  if (normalized.includes('hỗ trợ') || normalized.includes('phụ thuộc')) {
    return MobilityStatus.PARTIAL;
  }
  return MobilityStatus.NORMAL;
}

function computeHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if (Number.isNaN(sh) || Number.isNaN(eh)) return 2;
  const diff = (eh * 60 + (em || 0) - (sh * 60 + (sm || 0))) / 60;
  return diff > 0 ? Number(diff.toFixed(1)) : 2;
}

export function getStoredShiftsMap(): Record<string, ShiftExecutionState> {
  return JSON.parse(JSON.stringify(loadShiftStore()));
}

export function upsertAcceptedShiftFromJob(seed: AcceptedShiftSeed): ShiftExecutionState {
  const store = loadShiftStore();
  if (store[seed.bookingId]) {
    return JSON.parse(JSON.stringify(store[seed.bookingId]));
  }

  const created: ShiftExecutionState = {
    bookingId: seed.bookingId,
    bookingCode: seed.bookingCode,
    patientName: seed.patientName,
    patientAge: seed.patientAge,
    patientAddress: seed.patientAddress,
    patientLatitude: 16.0718,
    patientLongitude: 108.2205,
    mobilityStatus: resolveMobilityStatus(seed.mobilityStatus),
    isInvasive: seed.isInvasive,
    serviceName: seed.serviceName,
    startTime: seed.startTime,
    endTime: seed.endTime,
    scheduledHours: seed.scheduledHours ?? computeHours(seed.startTime, seed.endTime),
    totalAmount: seed.totalAmount,
    executionStatus: ExecutionStatus.CONFIRMED,
    paymentStatus: seed.paymentStatus === 'UNPAID' ? PaymentStatus.UNPAID : PaymentStatus.ESCROW_HELD,
    disputeStatus: BookingDisputeStatus.NONE,
    isMockLocationDetected: false,
    assessmentCompleted: false,
    conditionMismatchReported: false,
    vitalSigns: [],
    careActivities: [
      { id: 'act-1', title: 'Đo & ghi nhận chỉ số sinh tồn đầu ca', category: 'Sinh tồn', completed: false, mandatory: true },
      seed.isInvasive
        ? { id: 'act-2', title: 'Đối chiếu y lệnh gốc & vật tư vô khuẩn', category: 'Chuyên môn', completed: false, mandatory: true }
        : { id: 'act-2', title: 'Kiểm tra tình trạng người bệnh & vật dụng chăm sóc', category: 'Chuyên môn', completed: false, mandatory: true },
      { id: 'act-3', title: `Thực hiện ${seed.serviceName}`, category: 'Chuyên môn', completed: false, mandatory: true },
      { id: 'act-4', title: 'Đo sinh tồn cuối ca & bàn giao người nhà', category: 'Bàn giao', completed: false, mandatory: true },
    ],
    progressNotes: [],
    pendingExtension: null,
  };

  store[seed.bookingId] = created;
  saveShiftStore(store);
  return JSON.parse(JSON.stringify(created));
}

export async function mockGetShiftExecutionState(bookingId: string): Promise<ShiftExecutionState> {
  await new Promise((r) => setTimeout(r, 150));
  const store = loadShiftStore();
  const shift = store[bookingId];
  if (!shift) {
    // Generate fallback dummy state for other booking IDs
    const fallback: ShiftExecutionState = {
      bookingId,
      bookingCode: `BK-${bookingId.toUpperCase()}`,
      patientName: 'Người bệnh CareNest',
      patientAge: 75,
      patientAddress: 'Đà Nẵng, Việt Nam',
      patientLatitude: 16.0718,
      patientLongitude: 108.2205,
      mobilityStatus: MobilityStatus.NORMAL,
      isInvasive: false,
      serviceName: 'Chăm sóc điều dưỡng chuyên sâu',
      startTime: '08:00',
      endTime: '12:00',
      scheduledHours: 4,
      totalAmount: 500000,
      executionStatus: ExecutionStatus.CONFIRMED,
      paymentStatus: PaymentStatus.ESCROW_HELD,
      disputeStatus: BookingDisputeStatus.NONE,
      isMockLocationDetected: false,
      assessmentCompleted: false,
      conditionMismatchReported: false,
      vitalSigns: [],
      careActivities: [
        { id: 'act-1', title: 'Kiểm tra sinh tồn', category: 'Sinh tồn', completed: false, mandatory: true },
        { id: 'act-2', title: 'Thực hiện chăm sóc theo y lệnh', category: 'Chuyên môn', completed: false, mandatory: true },
        { id: 'act-3', title: 'Ghi nhận và bàn giao', category: 'Bàn giao', completed: false, mandatory: true },
      ],
      progressNotes: [],
      pendingExtension: null,
    };
    return fallback;
  }
  return JSON.parse(JSON.stringify(shift));
}

export async function mockGetMyShifts(): Promise<ShiftExecutionState[]> {
  await new Promise((r) => setTimeout(r, 150));
  const rank: Record<string, number> = {
    [ExecutionStatus.IN_PROGRESS]: 0,
    [ExecutionStatus.CONFIRMED]: 1,
    [ExecutionStatus.COMPLETED]: 2,
    [ExecutionStatus.CANCELLED]: 3,
  };
  return Object.values(loadShiftStore())
    .sort((a, b) => (rank[a.executionStatus] ?? 9) - (rank[b.executionStatus] ?? 9))
    .map((s) => JSON.parse(JSON.stringify(s)));
}

export async function mockSubmitCheckIn(
  payload: CheckInRequest
): Promise<{ success: boolean; message: string; data?: ShiftExecutionState }> {
  await new Promise((r) => setTimeout(r, 300));
  const store = loadShiftStore();
  const shift = store[payload.bookingId] || await mockGetShiftExecutionState(payload.bookingId);

  // 1. Anti-Mock-Location Check (BR-07 §2.1)
  if (payload.isMockLocation) {
    shift.isMockLocationDetected = true;
    store[payload.bookingId] = shift;
    saveShiftStore(store);
    return {
      success: false,
      message: 'Hệ thống phát hiện định vị giả lập (Mock Location). Check-in bị từ chối để đảm bảo an toàn.',
    };
  }

  // 2. Geofence Proximity Check (CHECKIN_MAX_RADIUS_METERS)
  const distance = haversineDistanceMeters(
    payload.latitude,
    payload.longitude,
    shift.patientLatitude,
    shift.patientLongitude
  );

  if (distance > CHECKIN_MAX_RADIUS_METERS) {
    return {
      success: false,
      message: `Bạn đang ở cách địa chỉ ca trực ${Math.round(distance)}m (yêu cầu ≤ ${CHECKIN_MAX_RADIUS_METERS}m). Vui lòng di chuyển lại gần điểm hẹn để điểm danh.`,
    };
  }

  // 3. Live Selfie Check (BR-07 §2.1)
  if (!payload.selfieImageBase64) {
    return {
      success: false,
      message: 'Bắt buộc phải chụp ảnh selfie trực tiếp tại chỗ bằng camera để xác thực danh tính.',
    };
  }

  // Check-in success -> transition to IN_PROGRESS
  shift.executionStatus = ExecutionStatus.IN_PROGRESS;
  shift.checkedInAt = payload.timestamp || new Date().toISOString();
  shift.checkInDistanceMeters = Math.round(distance);
  shift.checkInSelfieUrl = payload.selfieImageBase64;
  shift.isMockLocationDetected = false;

  store[payload.bookingId] = shift;
  saveShiftStore(store);
  return {
    success: true,
    message: `Điểm danh thành công! Cách nhà bệnh nhân ${Math.round(distance)}m. Ca làm việc đã bắt đầu.`,
    data: JSON.parse(JSON.stringify(shift)),
  };
}

export async function mockSubmitInitialAssessment(
  payload: InitialAssessmentRequest
): Promise<{ success: boolean; message: string; data?: ShiftExecutionState }> {
  await new Promise((r) => setTimeout(r, 250));
  const store = loadShiftStore();
  const shift = store[payload.bookingId];
  if (!shift) return { success: false, message: 'Không tìm thấy ca trực.' };

  shift.assessmentCompleted = true;
  shift.assessmentCompletedAt = new Date().toISOString();
  shift.vitalSigns.unshift(payload.initialVitals);

  if (!payload.isConditionMatched) {
    shift.conditionMismatchReported = true;
    shift.mismatchReason = payload.mismatchReason;
    shift.mismatchOption = payload.requestedAction;

    if (payload.requestedAction === 'REFUSE') {
      shift.executionStatus = ExecutionStatus.CANCELLED;
      saveShiftStore(store);
      return {
        success: true,
        message: 'Đã báo cáo sai lệch tình trạng và dừng ca trực theo quy định BR-16. Bạn không bị phạt điểm TrustScore.',
        data: JSON.parse(JSON.stringify(shift)),
      };
    } else {
      saveShiftStore(store);
      return {
        success: true,
        message: 'Đã gửi yêu cầu bổ sung phụ phí bệnh nhân nặng (+15%) tới khách hàng.',
        data: JSON.parse(JSON.stringify(shift)),
      };
    }
  }

  saveShiftStore(store);
  return {
    success: true,
    message: 'Hoàn tất đánh giá tình trạng ban đầu trong 30 phút thành công.',
    data: JSON.parse(JSON.stringify(shift)),
  };
}

export async function mockAddVitalSigns(
  payload: AddVitalSignsRequest
): Promise<{ success: boolean; message: string; data?: ShiftExecutionState }> {
  await new Promise((r) => setTimeout(r, 200));
  const store = loadShiftStore();
  const shift = store[payload.bookingId];
  if (!shift) return { success: false, message: 'Không tìm thấy ca trực.' };

  shift.vitalSigns.unshift(payload.vitals);
  saveShiftStore(store);
  return {
    success: true,
    message: 'Đã lưu chỉ số sinh tồn và đồng bộ thời gian thực tới gia đình.',
    data: JSON.parse(JSON.stringify(shift)),
  };
}

export async function mockToggleCareActivity(
  payload: ToggleCareActivityRequest
): Promise<{ success: boolean; data?: ShiftExecutionState }> {
  const store = loadShiftStore();
  const shift = store[payload.bookingId];
  if (!shift) return { success: false };

  const act = shift.careActivities.find((a) => a.id === payload.activityId);
  if (act) {
    act.completed = payload.completed;
    act.completedAt = payload.completed ? new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : undefined;
    saveShiftStore(store);
  }
  return { success: true, data: JSON.parse(JSON.stringify(shift)) };
}

export async function mockRespondExtension(
  payload: RespondExtensionRequest
): Promise<{ success: boolean; message: string; data?: ShiftExecutionState }> {
  await new Promise((r) => setTimeout(r, 250));
  const store = loadShiftStore();
  const shift = store[payload.bookingId];
  if (!shift || !shift.pendingExtension) return { success: false, message: 'Không tìm thấy yêu cầu gia hạn.' };

  if (payload.approved) {
    shift.pendingExtension.status = AdjustmentStatus.ACCEPTED;
    shift.scheduledHours += shift.pendingExtension.extraHours;
    shift.totalAmount += shift.pendingExtension.extraAmount;
    const currentEndHour = parseInt(shift.endTime.split(':')[0], 10);
    shift.endTime = `${String(currentEndHour + shift.pendingExtension.extraHours).padStart(2, '0')}:00`;
    shift.pendingExtension = null;
    saveShiftStore(store);
    return {
      success: true,
      message: 'Đã đồng ý gia hạn ca trực thêm 1 giờ. Thời gian kết thúc mới: ' + shift.endTime,
      data: JSON.parse(JSON.stringify(shift)),
    };
  } else {
    shift.pendingExtension.status = AdjustmentStatus.REJECTED;
    shift.pendingExtension = null;
    saveShiftStore(store);
    return {
      success: true,
      message: 'Đã từ chối gia hạn ca trực. Thời gian ca giữ nguyên theo ban đầu.',
      data: JSON.parse(JSON.stringify(shift)),
    };
  }
}

export async function mockRejectInvalidPrescription(
  payload: RejectPrescriptionRequest
): Promise<{ success: boolean; message: string; data?: ShiftExecutionState }> {
  await new Promise((r) => setTimeout(r, 300));
  const store = loadShiftStore();
  const shift = store[payload.bookingId];
  if (shift) {
    shift.executionStatus = ExecutionStatus.CANCELLED;
    saveShiftStore(store);
  }
  return {
    success: true,
    message: `Đã hủy ca trực do y lệnh không hợp lệ (BR-15). Điều dưỡng không bị trừ TrustScore và được hưởng hỗ trợ di chuyển ${DEFAULT_TRAVEL_SUPPORT_VND.toLocaleString('vi-VN')}đ.`,
    data: shift ? JSON.parse(JSON.stringify(shift)) : undefined,
  };
}

export async function mockTriggerSos(
  _payload: SosAlertRequest
): Promise<{ success: boolean; message: string; emergencyId: string }> {
  await new Promise((r) => setTimeout(r, 100)); // Ultra-fast response
  const emergencyId = `SOS-${Date.now().toString(36).toUpperCase()}`;
  return {
    success: true,
    message: 'Tín hiệu SOS đã phát tới Cổng quản trị và điện thoại người nhà (< 2 giây)!',
    emergencyId,
  };
}

export async function mockSubmitCheckOut(
  payload: CheckOutRequest
): Promise<{ success: boolean; message: string; data?: ShiftExecutionState }> {
  await new Promise((r) => setTimeout(r, 300));
  const store = loadShiftStore();
  const shift = store[payload.bookingId];
  if (!shift) return { success: false, message: 'Không tìm thấy ca trực.' };

  // Mandatory Minimal Clinical Care Report Enforcement (BR-22 §2.2)
  if (!payload.finalVitals || !payload.finalVitals.heartRate || !payload.finalVitals.bloodPressureSystolic) {
    return {
      success: false,
      message: 'Bắt buộc phải đo và nhập chỉ số sinh tồn cuối ca trước khi check-out (BR-22).',
    };
  }

  if (!payload.handoverNote || payload.handoverNote.trim().length < 10) {
    return {
      success: false,
      message: 'Vui lòng nhập ghi chú dặn dò / bàn giao người nhà tối thiểu 10 ký tự.',
    };
  }

  shift.executionStatus = ExecutionStatus.COMPLETED;
  shift.checkedOutAt = payload.checkoutTime || new Date().toISOString();
  shift.handoverNotes = payload.handoverNote;
  shift.finalVitalSigns = payload.finalVitals;
  shift.vitalSigns.unshift(payload.finalVitals);

  saveShiftStore(store);
  return {
    success: true,
    message: 'Đã nộp Báo cáo ca tối thiểu và hoàn tất ca trực! Bắt đầu đếm ngược 24h quyết toán thù lao.',
    data: JSON.parse(JSON.stringify(shift)),
  };
}
