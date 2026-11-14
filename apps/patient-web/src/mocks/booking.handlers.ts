/**
 * Mock đặt ca — contract đề xuất, xem features/booking/booking.types.ts.
 *   POST /bookings/quote                    → bảng giá (backend tính; mock tính theo công thức FR-BOOK-01)
 *   POST /bookings/prescription/upload-url  → link tải ảnh y lệnh (PUT /mock-upload/:key đã có ở ekyc.handlers)
 *   POST /bookings                          → tạo ca: chuyển khoản → DRAFT giữ 15 phút · tiền mặt → MATCHING
 *   GET  /bookings · GET /bookings/:id      → danh sách / chi tiết (DRAFT quá hạn tự thành EXPIRED)
 *   POST /mock/bookings/:id/simulate-payment → giả lập webhook cổng thanh toán (chỉ có ở mock)
 *
 * Tài khoản 0905 123 456 có sẵn vài ca mẫu ở các trạng thái 3 trục khác nhau.
 */

import type {
  Booking,
  CreateBookingRequest,
  ExecutionStatus,
  PricingQuote,
} from '../features/booking/booking.types';
import { PRESCRIPTION_MAX_AGE_DAYS } from '../features/booking/booking.types';
import { SERVICE_CATEGORIES } from '../features/nurse-search/nurse-search.types';
import { initialKyc } from './ekyc.handlers';
import type { MockEkycStatus } from './ekyc.handlers';
import { fail, ok } from './mock-fetch';
import type { MockHandler, MockResult } from './mock-fetch';
import { getUserData, setUserData, userIdFromHeaders } from './mock-db';
import { NURSES } from './nurse-search.handlers';
import { loadMockProfiles } from './patient-profiles.handlers';


/* ----- Cấu hình giá giả lập (backend thật đọc từ service_categories + system_configs) ----- */

const BASE_RATE: Record<string, number> = {
  BEDSIDE_CARE: 50_000, // / giờ
  HYGIENE_FEEDING: 45_000, // / giờ
  VITAL_SIGNS: 120_000, // / lượt
  INJECTION: 150_000,
  IV_INFUSION: 250_000,
  WOUND_DRESSING: 180_000,
  CATHETER_CARE: 200_000,
};

const SURCHARGE_NIGHT = 0.2;
const SURCHARGE_HOLIDAY_MAJOR = 3.0;
const SURCHARGE_HOLIDAY_MINOR = 2.0;
const SURCHARGE_HEAVY = 0.15;
const PLATFORM_FEE_RATE = 0.15;
const PAYMENT_TIMEOUT_MS = 15 * 60_000;
const INVITE_TIMEOUT_MS = 15 * 60_000;

/** Danh sách ngày lễ giả lập — OD-01 chưa chốt nguồn dữ liệu lịch lễ chính thức. */
function holidayOf(d: Date): { name: string; rate: number } | null {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d); // YYYY-MM-DD
  if (ymd >= '2027-02-05' && ymd <= '2027-02-10') return { name: 'Tết Nguyên đán', rate: SURCHARGE_HOLIDAY_MAJOR };
  const md = ymd.slice(5);
  const minor: Record<string, string> = { '01-01': 'Tết Dương lịch', '04-30': 'Giải phóng miền Nam', '05-01': 'Quốc tế Lao động', '09-02': 'Quốc khánh' };
  return minor[md] ? { name: minor[md], rate: SURCHARGE_HOLIDAY_MINOR } : null;
}

const vnHour = (d: Date) => (d.getUTCHours() + 7) % 24;

function computeQuote(serviceCode: string, startAt: string, endAt: string, weightKg: number | null, mobility: string): PricingQuote {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const hours = Math.max(1, Math.round((end.getTime() - start.getTime()) / 3_600_000));
  const perHour = SERVICE_CATEGORIES.find((s) => s.code === serviceCode)?.unit === 'PER_HOUR';
  const rate = BASE_RATE[serviceCode] ?? 0;
  const baseAmount = perHour ? rate * hours : rate;

  let nightHours = 0;
  for (let i = 0; i < hours; i++) {
    const h = vnHour(new Date(start.getTime() + i * 3_600_000));
    if (h >= 22 || h < 6) nightHours++;
  }
  const nightSurcharge = Math.round(baseAmount * SURCHARGE_NIGHT * (nightHours / hours));
  const holiday = holidayOf(start);
  const holidaySurcharge = holiday ? Math.round(baseAmount * holiday.rate) : 0;
  const heavy = (weightKg ?? 0) >= 80 || mobility === 'BEDRIDDEN';
  const heavyPatientSurcharge = heavy ? Math.round(baseAmount * SURCHARGE_HEAVY) : 0;
  const totalAmount = baseAmount + nightSurcharge + holidaySurcharge + heavyPatientSurcharge;

  return {
    hours,
    baseAmount,
    nightSurcharge,
    nightHours,
    holidaySurcharge,
    holidayName: holiday?.name ?? null,
    heavyPatientSurcharge,
    platformFee: Math.round(totalAmount * PLATFORM_FEE_RATE),
    platformFeeRate: PLATFORM_FEE_RATE,
    totalAmount,
  };
}

/* ----- Dữ liệu ----- */

const sampleQuote = (total: number): PricingQuote => ({
  hours: 8, baseAmount: total, nightSurcharge: 0, nightHours: 0, holidaySurcharge: 0, holidayName: null,
  heavyPatientSurcharge: 0, platformFee: Math.round(total * 0.15), platformFeeRate: 0.15, totalAmount: total,
});

const SAMPLE_BASE = {
  paymentExpiresAt: null, bankTransfer: null, invitedNurse: null, prescriptionReview: null, isInvasive: false,
  patientProfileId: '11111111-1111-4111-8111-111111111111', patientName: 'Nguyễn Thị Hoa',
} as const;

const SAMPLE: Booking[] = [
  {
    ...SAMPLE_BASE, id: 'b-1050', code: 'HC-2026-1050', serviceCode: 'BEDSIDE_CARE', serviceLabel: 'Chăm sóc tại giường (ca 4–24 giờ)',
    startAt: '2026-11-14T13:00:00Z', endAt: '2026-11-14T21:00:00Z', paymentMethod: 'BANK_TRANSFER', pricing: sampleQuote(400_000),
    executionStatus: 'CONFIRMED', paymentStatus: 'ESCROW_HELD', disputeStatus: 'NONE', matchingMode: 'DIRECT_REQUEST',
    invitedNurse: { nurseId: 'n-mai', fullName: 'Trần Thị Mai', respondBy: null }, createdAt: '2026-11-13T02:00:00Z',
  },
  {
    ...SAMPLE_BASE, id: 'b-1042', code: 'HC-2026-1042', serviceCode: 'WOUND_DRESSING', serviceLabel: 'Thay băng, cắt chỉ', isInvasive: true,
    startAt: '2026-11-10T02:00:00Z', endAt: '2026-11-10T03:00:00Z', paymentMethod: 'BANK_TRANSFER', pricing: sampleQuote(180_000),
    executionStatus: 'COMPLETED', paymentStatus: 'ESCROW_HELD', disputeStatus: 'OPEN', matchingMode: 'JOB_BOARD',
    prescriptionReview: 'APPROVED', createdAt: '2026-11-08T02:00:00Z',
  },
  {
    ...SAMPLE_BASE, id: 'b-1031', code: 'HC-2026-1031', serviceCode: 'HYGIENE_FEEDING', serviceLabel: 'Vệ sinh, hỗ trợ ăn uống',
    startAt: '2026-11-02T01:00:00Z', endAt: '2026-11-02T05:00:00Z', paymentMethod: 'BANK_TRANSFER', pricing: sampleQuote(180_000),
    executionStatus: 'COMPLETED', paymentStatus: 'SETTLED', disputeStatus: 'NONE', matchingMode: 'JOB_BOARD', createdAt: '2026-10-30T02:00:00Z',
  },
  {
    ...SAMPLE_BASE, id: 'b-1020', code: 'HC-2026-1020', serviceCode: 'VITAL_SIGNS', serviceLabel: 'Theo dõi sinh hiệu',
    startAt: '2026-10-25T02:00:00Z', endAt: '2026-10-25T03:00:00Z', paymentMethod: 'BANK_TRANSFER', pricing: sampleQuote(120_000),
    executionStatus: 'EXPIRED', paymentStatus: 'UNPAID', disputeStatus: 'NONE', matchingMode: null, createdAt: '2026-10-24T02:00:00Z',
  },
];

const load = (userId: string): Booking[] => {
  const list = getUserData<Booking[]>(userId, 'bookings', userId === 'u-patient-verified' ? SAMPLE : []);
  let changed = false;
  const now = Date.now();
  const next = list.map((b) => {
    if (b.executionStatus === 'DRAFT' && b.paymentExpiresAt && Date.parse(b.paymentExpiresAt) <= now) {
      changed = true;
      return { ...b, executionStatus: 'EXPIRED' as ExecutionStatus, paymentExpiresAt: null, bankTransfer: null };
    }
    return b;
  });
  if (changed) setUserData(userId, 'bookings', next);
  return next;
};

const save = (userId: string, list: Booking[]) => setUserData(userId, 'bookings', list);
const unauthorized = () => fail(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn');

function profileOf(userId: string, id: string) {
  return loadMockProfiles(userId).find((p) => p.id === id);
}

/** Kiểm tra chung của quote + create. Trả lỗi hoặc dữ liệu đã nạp. */
function validateBase(userId: string, body: Partial<CreateBookingRequest>) {
  const service = SERVICE_CATEGORIES.find((s) => s.code === body?.serviceCode);
  if (!service) return { error: fail(400, 'VALIDATION_ERROR', 'Dịch vụ không hợp lệ.') };
  if (!body.startAt || !body.endAt || Date.parse(body.endAt) <= Date.parse(body.startAt)) {
    return { error: fail(400, 'VALIDATION_ERROR', 'Khung giờ không hợp lệ.') };
  }
  const profile = profileOf(userId, body.patientProfileId ?? '');
  if (!profile) return { error: fail(403, 'FORBIDDEN', 'Không có quyền truy cập hồ sơ này.') };
  return { service, profile };
}

export const bookingHandlers: Record<string, MockHandler> = {
  'POST /api/v1/bookings/quote': (body: Partial<CreateBookingRequest>, { headers }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    const v = validateBase(userId, body);
    if ('error' in v) return v.error as MockResult;
    return ok(computeQuote(v.service.code, body.startAt!, body.endAt!, v.profile.weightKg, v.profile.mobilityStatus));
  },

  'POST /api/v1/bookings/prescription/upload-url': (body: { contentType?: string }, { headers }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(body?.contentType ?? '')) {
      return fail(400, 'FILE_TYPE_NOT_ALLOWED', 'Chỉ nhận ảnh JPG, PNG hoặc WebP.');
    }
    const objectKey = `prescription-mock/${userId}/${Date.now()}`;
    return ok({ objectKey, uploadUrl: `/api/v1/mock-upload/${encodeURIComponent(objectKey)}`, contentType: body.contentType, expiresInSeconds: 600 });
  },

  'POST /api/v1/bookings': (body: Partial<CreateBookingRequest>, { headers }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    const v = validateBase(userId, body);
    if ('error' in v) return v.error as MockResult;
    const { service, profile } = v;

    if (!profile.consent.accepted) return fail(403, 'CONSENT_NOT_ACTIVE', 'Hồ sơ này chưa có đồng ý xử lý dữ liệu sức khỏe.');
    const kyc = getUserData<MockEkycStatus>(userId, 'ekyc', initialKyc(userId));
    if (profile.locationType === 'HOME' && kyc.kycStatus !== 'VERIFIED') {
      return fail(403, 'KYC_REQUIRED', 'Cần xác thực CCCD (eKYC) trước khi đặt chăm sóc tại nhà.');
    }
    if (Date.parse(body.startAt!) <= Date.now()) return fail(400, 'VALIDATION_ERROR', 'Giờ bắt đầu phải ở tương lai.');
    if (body.paymentMethod !== 'BANK_TRANSFER' && body.paymentMethod !== 'CASH') {
      return fail(400, 'VALIDATION_ERROR', 'Vui lòng chọn phương thức thanh toán.');
    }

    const invasive = service.group === 'INVASIVE';
    if (invasive) {
      const p = body.prescription;
      if (!p?.imageKey || !p.issuedDate) return fail(400, 'PRESCRIPTION_REQUIRED', 'Dịch vụ thủ thuật cần ảnh y lệnh của bác sĩ.');
      const ageDays = (Date.now() - Date.parse(`${p.issuedDate}T00:00:00`)) / 86_400_000;
      if (Number.isNaN(ageDays) || ageDays < 0 || ageDays > PRESCRIPTION_MAX_AGE_DAYS) {
        return fail(400, 'PRESCRIPTION_EXPIRED', `Y lệnh phải được kê trong vòng ${PRESCRIPTION_MAX_AGE_DAYS} ngày gần nhất.`);
      }
    }

    const invited = body.invitedNurseId ? NURSES.find((n) => n.nurseId === body.invitedNurseId) : null;
    if (body.invitedNurseId && !invited) return fail(404, 'NURSE_NOT_FOUND', 'Không tìm thấy điều dưỡng được mời.');
    if (invited && invasive && invited.tier !== 'TIER_2_SPECIALIST') {
      return fail(403, 'TIER_NOT_ALLOWED', 'Điều dưỡng này (Cấp 1) không thực hiện được thủ thuật y tế.');
    }

    const pricing = computeQuote(service.code, body.startAt!, body.endAt!, profile.weightKg, profile.mobilityStatus);
    const now = Date.now();
    const bank = body.paymentMethod === 'BANK_TRANSFER';
    const seq = 1100 + load(userId).length;
    const urgent = Date.parse(body.startAt!) - now <= 6 * 3_600_000;
    const matchingMode: Booking['matchingMode'] = invited ? 'DIRECT_REQUEST' : urgent ? 'RADAR' : 'JOB_BOARD';

    const booking: Booking = {
      id: `b-${seq}-${now}`,
      code: `HC-2026-${seq}`,
      serviceCode: service.code,
      serviceLabel: service.label,
      isInvasive: invasive,
      patientProfileId: profile.id,
      patientName: profile.fullName,
      startAt: body.startAt!,
      endAt: body.endAt!,
      paymentMethod: body.paymentMethod,
      pricing,
      executionStatus: bank ? 'DRAFT' : 'MATCHING',
      paymentStatus: 'UNPAID',
      disputeStatus: 'NONE',
      paymentExpiresAt: bank ? new Date(now + PAYMENT_TIMEOUT_MS).toISOString() : null,
      bankTransfer: bank
        ? { bankName: 'Ngân hàng mô phỏng (VietQR)', accountNumber: '0123456789', accountName: 'CONG TY CARENEST', transferContent: `CARENEST ${seq}` }
        : null,
      invitedNurse: invited
        ? { nurseId: invited.nurseId, fullName: invited.fullName, respondBy: bank ? null : new Date(now + INVITE_TIMEOUT_MS).toISOString() }
        : null,
      matchingMode: bank ? null : matchingMode,
      prescriptionReview: invasive ? 'PENDING' : null,
      createdAt: new Date(now).toISOString(),
    };
    save(userId, [booking, ...load(userId)]);
    return { status: 201, body: { success: true, data: booking } };
  },

  'GET /api/v1/bookings': (_body, { headers }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    return ok({ items: [...load(userId)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  },

  'GET /api/v1/bookings/:id': (_body, { headers, params }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    const found = load(userId).find((b) => b.id === params.id);
    return found ? ok(found) : fail(403, 'FORBIDDEN', 'Không có quyền truy cập ca này.');
  },

  // Giả lập webhook cổng thanh toán: khoá tiền vào escrow rồi đưa ca vào ghép điều dưỡng
  'POST /api/v1/mock/bookings/:id/simulate-payment': (_body, { headers, params }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    const list = load(userId);
    const i = list.findIndex((b) => b.id === params.id);
    if (i < 0) return fail(403, 'FORBIDDEN', 'Không có quyền truy cập ca này.');
    const b = list[i];
    if (b.executionStatus !== 'DRAFT') return fail(409, 'BOOKING_NOT_PAYABLE', 'Ca này không còn ở trạng thái chờ thanh toán.');
    const urgent = Date.parse(b.startAt) - Date.now() <= 6 * 3_600_000;
    list[i] = {
      ...b,
      executionStatus: 'MATCHING',
      paymentStatus: 'ESCROW_HELD',
      paymentExpiresAt: null,
      matchingMode: b.invitedNurse ? 'DIRECT_REQUEST' : urgent ? 'RADAR' : 'JOB_BOARD',
      invitedNurse: b.invitedNurse ? { ...b.invitedNurse, respondBy: new Date(Date.now() + INVITE_TIMEOUT_MS).toISOString() } : null,
    };
    save(userId, list);
    return ok(list[i]);
  },
};
