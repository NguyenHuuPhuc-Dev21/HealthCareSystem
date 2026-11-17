/**
 * Theo dõi ca đang thực hiện (Phase 4 · FR-SHIFT-01…05 · BR-07, BR-15, BR-22, BR-23).
 *
 * ⚠️ Backend chưa có contract cho các endpoint theo dõi/gia hạn/SOS (docs/api/README.md chỉ liệt kê
 * `POST /bookings/:id/extend`, `check-in`, `check-out`). Hình dạng dưới đây là ĐỀ XUẤT (camelCase),
 * cần BE xác nhận. "Thời gian thực" hiện làm bằng hỏi lại định kỳ; backend thật dùng WebSocket (FR-SHIFT-02).
 */

import type { BankTransferInfo, ExecutionStatus, PricingQuote } from '../booking/booking.types';

export interface TrackedNurse {
  nurseId: string;
  fullName: string;
  avatarUrl: string | null;
  tier: 'TIER_1_BASIC' | 'TIER_2_SPECIALIST';
}

/** Ảnh selfie check-in: chụp trực tiếp trong app (không cho tải từ thư viện), đóng dấu giờ + toạ độ từ phía server. */
export interface CheckInEvidence {
  at: string;
  selfieUrl: string;
  /** Khoảng cách tới địa chỉ chăm sóc lúc check-in (m); phải ≤ 200 m mới check-in được. */
  distanceMeters: number;
  lat: number;
  lng: number;
  /** Dòng chữ đã đóng dấu trên ảnh, vd. "2026-11-16 08:02:11 · 16.0717, 108.2208" */
  watermark: string;
}

export interface VitalReading {
  id: string;
  recordedAt: string;
  pulse: number | null; // lần/phút
  temperatureC: number | null;
  systolic: number | null; // mmHg
  diastolic: number | null;
  spo2: number | null; // %
  note?: string | null;
}

export interface CareActivity {
  id: string;
  at: string;
  text: string;
}

export type SosStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'CLOSED';

/** Cảnh báo khẩn cấp phát tới gia đình + Admin (BR-23). Gia đình luôn gọi 115 trước; nền tảng chỉ báo tin và định vị. */
export interface SosAlert {
  alertId: string;
  bookingId: string;
  bookingCode: string;
  patientName: string;
  nurseName: string | null;
  raisedAt: string;
  /** Ai bấm SOS: điều dưỡng (app điều dưỡng) hay người nhà tại hiện trường (web này) */
  raisedBy: 'NURSE' | 'FAMILY';
  status: SosStatus;
  lat: number | null;
  lng: number | null;
  latestVitals: VitalReading | null;
  acknowledgedAt: string | null;
  closedAt: string | null;
}

export type ExtensionStatus = 'AWAITING_PAYMENT' | 'AWAITING_NURSE' | 'CONFIRMED' | 'DECLINED' | 'EXPIRED';

/** Yêu cầu gia hạn theo bội số 1 giờ (FR-SHIFT-03). */
export interface ShiftExtension {
  id: string;
  hours: number;
  amount: number;
  paymentMethod: 'BANK_TRANSFER' | 'CASH';
  status: ExtensionStatus;
  createdAt: string;
  /** Chuyển khoản: nạp thêm vào escrow trước khi gia hạn có hiệu lực */
  bankTransfer: BankTransferInfo | null;
  paymentExpiresAt: string | null;
}

export interface BookingTracking {
  bookingId: string;
  code: string;
  serviceLabel: string;
  patientName: string;
  addressText: string | null;
  paymentMethod: 'BANK_TRANSFER' | 'CASH';
  executionStatus: ExecutionStatus;
  scheduledStartAt: string;
  /** Giờ kết thúc hiện hành (đã cộng các lần gia hạn đã xác nhận) */
  scheduledEndAt: string;
  nurse: TrackedNurse | null;
  checkIn: CheckInEvidence | null;
  checkOutAt: string | null;
  vitals: VitalReading[];
  activities: CareActivity[];
  emergency: SosAlert | null;
  extensions: ShiftExtension[];
  /** Thời điểm server trả dữ liệu — dùng để tính độ lệch đồng hồ và hiển thị "cập nhật lúc" */
  serverTime: string;
}

export interface ExtendQuote extends PricingQuote {
  hours: number;
}

/** Cho phép gia hạn từ 30 phút trước giờ kết thúc (FR-SHIFT-03, BR-13 §2.4). */
export const EXTENSION_WINDOW_MINUTES = 30;
export const MAX_EXTENSION_HOURS = 4;
