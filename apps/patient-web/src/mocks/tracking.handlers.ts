/**
 * Mock theo dõi ca (Phase 4) — contract đề xuất, xem features/booking-tracking/booking-tracking.types.ts.
 *   GET  /bookings/:id/tracking               → trạng thái, selfie check-in, sinh hiệu, nhật ký, gia hạn, SOS
 *   POST /bookings/:id/extend/quote           → giá gia hạn
 *   POST /bookings/:id/extend                 → yêu cầu gia hạn (chuyển khoản: chờ nạp escrow → chờ điều dưỡng; tiền mặt: chờ điều dưỡng)
 *   POST /bookings/:id/sos                    → gia đình bấm SOS
 *   GET  /sos-alerts?status=OPEN · POST /sos-alerts/:id/acknowledge
 *   POST /mock/…                              → giả lập cổng thanh toán / Admin đóng SOS (chỉ có ở mock)
 *
 * Sinh hiệu và nhật ký được sinh theo thời gian thực từ giờ check-in (mỗi 15 phút một lần đo).
 * Điều dưỡng "đồng ý" gia hạn sau ~6 giây; gia hạn 4 giờ bị từ chối vì "vướng ca kế tiếp" để thử nhánh lỗi.
 */

import type {
  BookingTracking,
  CareActivity,
  ExtendQuote,
  ShiftExtension,
  SosAlert,
  VitalReading,
} from '../features/booking-tracking/booking-tracking.types';
import { EXTENSION_WINDOW_MINUTES, MAX_EXTENSION_HOURS } from '../features/booking-tracking/booking-tracking.types';
import type { Booking } from '../features/booking/booking.types';
import { computeQuote, loadMockBookings, saveMockBookings, unauthorized } from './booking.handlers';
import { fail, ok } from './mock-fetch';
import type { MockHandler } from './mock-fetch';
import { getUserData, setUserData, userIdFromHeaders } from './mock-db';
import { NURSES } from './nurse-search.handlers';
import { loadMockProfiles } from './patient-profiles.handlers';

const MIN = 60_000;
const NURSE_REPLY_MS = 6_000;
const READING_EVERY_MIN = 15;

const ACTIVITY_TEXTS = [
  'Xác nhận tình trạng người bệnh, đo sinh hiệu đầu ca',
  'Hỗ trợ vệ sinh cá nhân, thay tã/quần áo',
  'Xoay trở, kê gối chống loét tỳ đè',
  'Hỗ trợ ăn nhẹ, uống nước theo hướng dẫn',
  'Nhắc và hỗ trợ uống thuốc theo toa của bác sĩ',
  'Vận động nhẹ tại giường theo hướng dẫn phục hồi chức năng',
  'Dọn dẹp khu vực chăm sóc, ghi chép bàn giao',
];

const iso = (ms: number) => new Date(ms).toISOString();

function selfieDataUri(name: string, watermark: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5fb3a1"/><stop offset="1" stop-color="#166b58"/></linearGradient></defs>
<rect width="480" height="360" fill="url(#g)"/><circle cx="240" cy="140" r="58" fill="#ffffff" opacity=".9"/>
<path d="M120 330c10-80 70-110 120-110s110 30 120 110z" fill="#ffffff" opacity=".9"/>
<text x="240" y="150" font-family="sans-serif" font-size="30" font-weight="700" text-anchor="middle" fill="#166b58">${name
    .split(' ')
    .slice(-2)
    .map((w) => w[0])
    .join('')}</text>
<rect y="318" width="480" height="42" fill="#000" opacity=".55"/>
<text x="12" y="344" font-family="monospace" font-size="15" fill="#fff">${watermark}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function vitalAt(k: number, at: number): VitalReading {
  return {
    id: `v-${k}`,
    recordedAt: iso(at),
    pulse: 72 + ((k * 7) % 9),
    temperatureC: 36.5 + ((k * 3) % 6) / 10,
    systolic: 118 + ((k * 5) % 12),
    diastolic: 76 + ((k * 3) % 8),
    spo2: 96 + (k % 3),
    note: k === 0 ? 'Đo đầu ca' : null,
  };
}

const extKey = (bookingId: string) => `ext:${bookingId}`;

/** Chuyển trạng thái gia hạn theo thời gian (điều dưỡng phản hồi, hết hạn thanh toán) và cộng giờ khi được xác nhận. */
function settleExtensions(userId: string, booking: Booking): { booking: Booking; extensions: ShiftExtension[] } {
  const now = Date.now();
  let b = booking;
  let changed = false;
  const list = getUserData<Array<ShiftExtension & { repliedAt?: number }>>(userId, extKey(b.id), []).map((e) => {
    if (e.status === 'AWAITING_PAYMENT' && e.paymentExpiresAt && Date.parse(e.paymentExpiresAt) <= now) {
      changed = true;
      return { ...e, status: 'EXPIRED' as const, bankTransfer: null };
    }
    if (e.status === 'AWAITING_NURSE' && e.repliedAt && e.repliedAt <= now) {
      changed = true;
      if (e.hours >= MAX_EXTENSION_HOURS) return { ...e, status: 'DECLINED' as const };
      b = { ...b, endAt: iso(Date.parse(b.endAt) + e.hours * 60 * MIN) };
      return { ...e, status: 'CONFIRMED' as const };
    }
    return e;
  });
  if (changed) {
    setUserData(userId, extKey(b.id), list);
    const all = loadMockBookings(userId).map((x) => (x.id === b.id ? b : x));
    saveMockBookings(userId, all);
  }
  return { booking: b, extensions: list };
}

const sosList = (userId: string) => getUserData<SosAlert[]>(userId, 'sos', []);

function buildTracking(userId: string, booking: Booking): BookingTracking {
  const { booking: b, extensions } = settleExtensions(userId, booking);
  const now = Date.now();
  const profile = loadMockProfiles(userId).find((p) => p.id === b.patientProfileId);
  const nurse = b.invitedNurse
    ? NURSES.find((n) => n.nurseId === b.invitedNurse!.nurseId)
    : b.executionStatus === 'CONFIRMED' || b.executionStatus === 'IN_PROGRESS' || b.executionStatus === 'COMPLETED' ? NURSES[0] : undefined;

  const started = b.executionStatus === 'IN_PROGRESS' || b.executionStatus === 'COMPLETED';
  const checkInAt = started ? Date.parse(b.startAt) + 2 * MIN : null;
  const checkOutAt = b.executionStatus === 'COMPLETED' ? Date.parse(b.endAt) : null;
  const upto = Math.min(now, checkOutAt ?? now);

  const lat = profile?.lat ?? 16.0717;
  const lng = profile?.lng ?? 108.2208;

  const vitals: VitalReading[] = [];
  const activities: CareActivity[] = [];
  if (checkInAt) {
    for (let k = 0; checkInAt + k * READING_EVERY_MIN * MIN <= upto; k++) vitals.push(vitalAt(k, checkInAt + k * READING_EVERY_MIN * MIN));
    for (let k = 0; checkInAt + (k * 25 + 5) * MIN <= upto; k++) {
      activities.push({ id: `a-${k}`, at: iso(checkInAt + (k * 25 + 5) * MIN), text: ACTIVITY_TEXTS[k % ACTIVITY_TEXTS.length] });
    }
  }

  const emergency = sosList(userId).find((a) => a.bookingId === b.id && a.status !== 'CLOSED') ?? null;

  return {
    bookingId: b.id,
    code: b.code,
    serviceLabel: b.serviceLabel,
    patientName: b.patientName,
    addressText: profile?.addressText ?? null,
    paymentMethod: b.paymentMethod,
    executionStatus: b.executionStatus,
    scheduledStartAt: b.startAt,
    scheduledEndAt: b.endAt,
    nurse: nurse ? { nurseId: nurse.nurseId, fullName: nurse.fullName, avatarUrl: null, tier: nurse.tier } : null,
    checkIn: checkInAt
      ? {
          at: iso(checkInAt),
          selfieUrl: selfieDataUri(nurse?.fullName ?? 'DD', `${iso(checkInAt).slice(0, 19).replace('T', ' ')} · ${lat.toFixed(4)}, ${lng.toFixed(4)}`),
          distanceMeters: 38,
          lat,
          lng,
          watermark: `${iso(checkInAt).slice(0, 19).replace('T', ' ')} · ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        }
      : null,
    checkOutAt: checkOutAt ? iso(checkOutAt) : null,
    vitals,
    activities,
    emergency,
    extensions: [...extensions].reverse(),
    serverTime: iso(now),
  };
}

function findBooking(userId: string, id: string) {
  return loadMockBookings(userId).find((b) => b.id === id);
}

export const trackingHandlers: Record<string, MockHandler> = {
  'GET /api/v1/bookings/:id/tracking': (_body, { headers, params }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    const b = findBooking(userId, params.id);
    return b ? ok(buildTracking(userId, b)) : fail(403, 'FORBIDDEN', 'Không có quyền truy cập ca này.');
  },

  'POST /api/v1/bookings/:id/extend/quote': (body: { hours?: number }, { headers, params }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    const b = findBooking(userId, params.id);
    if (!b) return fail(403, 'FORBIDDEN', 'Không có quyền truy cập ca này.');
    const hours = Number(body?.hours);
    if (!Number.isInteger(hours) || hours < 1 || hours > MAX_EXTENSION_HOURS) return fail(400, 'VALIDATION_ERROR', 'Gia hạn theo bội số 1 giờ, tối đa 4 giờ.');
    const profile = loadMockProfiles(userId).find((p) => p.id === b.patientProfileId);
    const quote = computeQuote(b.serviceCode, b.endAt, iso(Date.parse(b.endAt) + hours * 60 * MIN), profile?.weightKg ?? null, profile?.mobilityStatus ?? 'NORMAL');
    return ok({ ...quote, hours } satisfies ExtendQuote);
  },

  'POST /api/v1/bookings/:id/extend': (body: { hours?: number }, { headers, params }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    const b0 = findBooking(userId, params.id);
    if (!b0) return fail(403, 'FORBIDDEN', 'Không có quyền truy cập ca này.');
    const { booking: b, extensions } = settleExtensions(userId, b0);
    const hours = Number(body?.hours);
    if (!Number.isInteger(hours) || hours < 1 || hours > MAX_EXTENSION_HOURS) return fail(400, 'VALIDATION_ERROR', 'Gia hạn theo bội số 1 giờ, tối đa 4 giờ.');
    if (b.executionStatus !== 'IN_PROGRESS') return fail(409, 'BOOKING_NOT_IN_PROGRESS', 'Chỉ gia hạn được khi ca đang thực hiện.');
    const remainingMin = (Date.parse(b.endAt) - Date.now()) / MIN;
    if (remainingMin > EXTENSION_WINDOW_MINUTES) return fail(409, 'EXTENSION_WINDOW_CLOSED', `Chỉ gia hạn được trong ${EXTENSION_WINDOW_MINUTES} phút cuối của ca.`);
    if (remainingMin <= 0) return fail(409, 'SHIFT_ENDED', 'Ca đã kết thúc.');
    if (extensions.some((e) => e.status === 'AWAITING_PAYMENT' || e.status === 'AWAITING_NURSE')) {
      return fail(409, 'EXTENSION_PENDING', 'Đang có một yêu cầu gia hạn chưa hoàn tất.');
    }
    if (hours >= MAX_EXTENSION_HOURS) {
      // Mô phỏng điều dưỡng vướng ca kế tiếp (BR-14 §2.5): backend thật trả lỗi ngay khi kiểm tra lịch.
      return fail(409, 'NEXT_SHIFT_CONFLICT', 'Điều dưỡng có ca kế tiếp nên không gia hạn được số giờ này. Hãy thử số giờ ít hơn.');
    }
    const profile = loadMockProfiles(userId).find((p) => p.id === b.patientProfileId);
    const quote = computeQuote(b.serviceCode, b.endAt, iso(Date.parse(b.endAt) + hours * 60 * MIN), profile?.weightKg ?? null, profile?.mobilityStatus ?? 'NORMAL');
    const bank = b.paymentMethod === 'BANK_TRANSFER';
    const now = Date.now();
    const ext: ShiftExtension & { repliedAt?: number } = {
      id: `x-${now}`,
      hours,
      amount: quote.totalAmount,
      paymentMethod: b.paymentMethod,
      status: bank ? 'AWAITING_PAYMENT' : 'AWAITING_NURSE',
      createdAt: iso(now),
      bankTransfer: bank
        ? { bankName: 'Ngân hàng mô phỏng (VietQR)', accountNumber: '0123456789', accountName: 'CONG TY CARENEST', transferContent: `CARENEST GH ${b.code.slice(-4)}` }
        : null,
      paymentExpiresAt: bank ? iso(now + 15 * MIN) : null,
      repliedAt: bank ? undefined : now + NURSE_REPLY_MS,
    };
    setUserData(userId, extKey(b.id), [...extensions, ext]);
    return { status: 201, body: { success: true, data: ext } };
  },

  'POST /api/v1/mock/bookings/:id/extensions/:extId/simulate-payment': (_body, { headers, params }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    const list = getUserData<Array<ShiftExtension & { repliedAt?: number }>>(userId, extKey(params.id), []);
    const i = list.findIndex((e) => e.id === params.extId);
    if (i < 0) return fail(404, 'NOT_FOUND', 'Không tìm thấy yêu cầu gia hạn.');
    if (list[i].status !== 'AWAITING_PAYMENT') return fail(409, 'EXTENSION_NOT_PAYABLE', 'Yêu cầu này không còn chờ thanh toán.');
    list[i] = { ...list[i], status: 'AWAITING_NURSE', bankTransfer: null, paymentExpiresAt: null, repliedAt: Date.now() + NURSE_REPLY_MS };
    setUserData(userId, extKey(params.id), list);
    return ok(list[i]);
  },

  'POST /api/v1/bookings/:id/sos': (body: { lat?: number; lng?: number }, { headers, params }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    const b = findBooking(userId, params.id);
    if (!b) return fail(403, 'FORBIDDEN', 'Không có quyền truy cập ca này.');
    if (b.executionStatus !== 'IN_PROGRESS') return fail(409, 'BOOKING_NOT_IN_PROGRESS', 'SOS chỉ dùng được khi ca đang thực hiện.');
    const existing = sosList(userId).find((a) => a.bookingId === b.id && a.status !== 'CLOSED');
    if (existing) return ok(existing);
    const t = buildTracking(userId, b);
    const alert: SosAlert = {
      alertId: `sos-${Date.now()}`,
      bookingId: b.id,
      bookingCode: b.code,
      patientName: b.patientName,
      nurseName: t.nurse?.fullName ?? null,
      raisedAt: new Date().toISOString(),
      raisedBy: 'FAMILY',
      status: 'ACTIVE',
      lat: body?.lat ?? t.checkIn?.lat ?? null,
      lng: body?.lng ?? t.checkIn?.lng ?? null,
      latestVitals: t.vitals[t.vitals.length - 1] ?? null,
      acknowledgedAt: null,
      closedAt: null,
    };
    setUserData(userId, 'sos', [alert, ...sosList(userId)]);
    return { status: 201, body: { success: true, data: alert } };
  },

  'GET /api/v1/sos-alerts': (_body, { headers }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    return ok({ items: sosList(userId).filter((a) => a.status !== 'CLOSED') });
  },

  'POST /api/v1/sos-alerts/:id/acknowledge': (_body, { headers, params }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    const list = sosList(userId);
    const i = list.findIndex((a) => a.alertId === params.id);
    if (i < 0) return fail(403, 'FORBIDDEN', 'Không có quyền với cảnh báo này.');
    if (list[i].status === 'ACTIVE') list[i] = { ...list[i], status: 'ACKNOWLEDGED', acknowledgedAt: new Date().toISOString() };
    setUserData(userId, 'sos', list);
    return ok(list[i]);
  },

  'POST /api/v1/mock/sos-alerts/:id/close': (_body, { headers, params }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    const list = sosList(userId);
    const i = list.findIndex((a) => a.alertId === params.id);
    if (i < 0) return fail(404, 'NOT_FOUND', 'Không tìm thấy cảnh báo.');
    list[i] = { ...list[i], status: 'CLOSED', closedAt: new Date().toISOString() };
    setUserData(userId, 'sos', list);
    return ok(list[i]);
  },
};
