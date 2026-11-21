/**
 * Mock huỷ ca + theo dõi hoàn tiền theo ma trận §5.2 — contract đề xuất, xem features/refunds/refunds.types.ts.
 *   GET  /bookings/:id/cancel-preview → phí huỷ / số tiền hoàn theo thời điểm (kịch bản 1–3)
 *   POST /bookings/:id/cancel         → huỷ ca; đơn chuyển khoản đã trả tiền thì tạo khoản hoàn (PROCESSING → REFUNDED sau ~8 giây)
 *   GET  /refunds                     → danh sách hoàn tiền
 *
 * Tài khoản 0905 123 456 có sẵn 3 khoản hoàn mẫu (kịch bản 9, 2, 8).
 */

import type { Booking } from '../features/booking/booking.types';
import type { CancelPreview, RefundRecord, RefundScenario } from '../features/refunds/refunds.types';
import { loadMockBookings, saveMockBookings, unauthorized } from './booking.handlers';
import { fail, ok } from './mock-fetch';
import type { MockHandler } from './mock-fetch';
import { getUserData, setUserData, userIdFromHeaders } from './mock-db';

const PROCESSING_MS = 8_000;
const iso = (ms: number) => new Date(ms).toISOString();

const SAMPLE_REFUNDS: RefundRecord[] = [
  {
    refundId: 'r-3', bookingId: null, bookingCode: 'HC-2026-1012', serviceLabel: 'Thay băng, cắt chỉ', scenario: 'NURSE_NO_SHOW',
    amountPaid: 180_000, refundAmount: 180_000, refundPercent: 100, nurseCompensation: 0, platformShare: 0, voucherAmount: 50_000,
    status: 'PROCESSING', createdAt: iso(Date.now() - 20 * 60_000), refundedAt: null,
  },
  {
    refundId: 'r-2', bookingId: null, bookingCode: 'HC-2026-1003', serviceLabel: 'Chăm sóc tại giường (ca 4–24 giờ)', scenario: 'CUSTOMER_CANCEL_NEAR',
    amountPaid: 400_000, refundAmount: 320_000, refundPercent: 80, nurseCompensation: 60_000, platformShare: 20_000, voucherAmount: 0,
    status: 'REFUNDED', createdAt: '2026-10-27T03:10:00Z', refundedAt: '2026-10-27T03:40:00Z',
  },
  {
    refundId: 'r-1', bookingId: null, bookingCode: 'HC-2026-0998', serviceLabel: 'Theo dõi sinh hiệu', scenario: 'UNMATCHED_EXPIRED',
    amountPaid: 120_000, refundAmount: 120_000, refundPercent: 100, nurseCompensation: 0, platformShare: 0, voucherAmount: 0,
    status: 'REFUNDED', createdAt: '2026-10-20T05:00:00Z', refundedAt: '2026-10-20T05:20:00Z',
  },
];

function loadRefunds(userId: string): RefundRecord[] {
  const list = getUserData<RefundRecord[]>(userId, 'refunds', userId === 'u-patient-verified' ? SAMPLE_REFUNDS : []);
  const now = Date.now();
  let changed = false;
  const next = list.map((r) => {
    if (r.status === 'PROCESSING' && now - Date.parse(r.createdAt) >= PROCESSING_MS && r.scenario !== 'NURSE_NO_SHOW') {
      changed = true;
      return { ...r, status: 'REFUNDED' as const, refundedAt: iso(Date.parse(r.createdAt) + PROCESSING_MS) };
    }
    return r;
  });
  if (changed) setUserData(userId, 'refunds', next);
  return next;
}

function previewOf(b: Booking): CancelPreview {
  const hours = (Date.parse(b.startAt) - Date.now()) / 3_600_000;
  const scenario: RefundScenario = hours > 12 ? 'CUSTOMER_CANCEL_EARLY' : hours >= 2 ? 'CUSTOMER_CANCEL_NEAR' : 'CUSTOMER_CANCEL_LATE';
  const feePercent = scenario === 'CUSTOMER_CANCEL_EARLY' ? 0 : scenario === 'CUSTOMER_CANCEL_NEAR' ? 20 : 50;
  const nursePct = scenario === 'CUSTOMER_CANCEL_NEAR' ? 15 : scenario === 'CUSTOMER_CANCEL_LATE' ? 40 : 0;
  const platformPct = feePercent - nursePct;
  // Chỉ đơn chuyển khoản đã trả tiền mới có hoàn tiền; tiền mặt / chưa thanh toán thì không có khoản nào được thu hay hoàn.
  const paid = b.paymentMethod === 'BANK_TRANSFER' && b.paymentStatus === 'ESCROW_HELD' ? b.pricing.totalAmount : 0;
  const cut = (p: number) => Math.round((paid * p) / 100);
  return {
    bookingId: b.id,
    scenario,
    hoursBeforeStart: Math.round(hours * 10) / 10,
    paymentMethod: b.paymentMethod,
    amountPaid: paid,
    feePercent,
    refundPercent: 100 - feePercent,
    refundAmount: paid - cut(feePercent),
    nurseCompensation: cut(nursePct),
    platformShare: cut(platformPct),
  };
}

export const refundHandlers: Record<string, MockHandler> = {
  'GET /api/v1/bookings/:id/cancel-preview': (_body, { headers, params }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    const b = loadMockBookings(userId).find((x) => x.id === params.id);
    if (!b) return fail(403, 'FORBIDDEN', 'Không có quyền truy cập ca này.');
    if (!['DRAFT', 'MATCHING', 'CONFIRMED'].includes(b.executionStatus)) return fail(409, 'BOOKING_NOT_CANCELLABLE', 'Ca này không còn huỷ được.');
    if (Date.parse(b.startAt) <= Date.now()) return fail(409, 'SHIFT_STARTED', 'Ca đã đến giờ bắt đầu nên không huỷ được theo cách này.');
    return ok(previewOf(b));
  },

  'POST /api/v1/bookings/:id/cancel': (_body, { headers, params }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    const list = loadMockBookings(userId);
    const i = list.findIndex((x) => x.id === params.id);
    if (i < 0) return fail(403, 'FORBIDDEN', 'Không có quyền truy cập ca này.');
    const b = list[i];
    if (!['DRAFT', 'MATCHING', 'CONFIRMED'].includes(b.executionStatus)) return fail(409, 'BOOKING_NOT_CANCELLABLE', 'Ca này không còn huỷ được.');
    if (Date.parse(b.startAt) <= Date.now()) return fail(409, 'SHIFT_STARTED', 'Ca đã đến giờ bắt đầu nên không huỷ được theo cách này.');

    const p = previewOf(b);
    const paid = p.amountPaid > 0;
    const updated: Booking = {
      ...b,
      executionStatus: 'CANCELLED',
      paymentStatus: paid ? 'REFUNDED' : b.paymentStatus,
      escrow: null,
      paymentExpiresAt: null,
      bankTransfer: null,
    };
    list[i] = updated;
    saveMockBookings(userId, list);

    let refund: RefundRecord | null = null;
    if (paid) {
      refund = {
        refundId: `r-${Date.now()}`,
        bookingId: b.id,
        bookingCode: b.code,
        serviceLabel: b.serviceLabel,
        scenario: p.scenario,
        amountPaid: p.amountPaid,
        refundAmount: p.refundAmount,
        refundPercent: p.refundPercent,
        nurseCompensation: p.nurseCompensation,
        platformShare: p.platformShare,
        voucherAmount: 0,
        status: 'PROCESSING',
        createdAt: iso(Date.now()),
        refundedAt: null,
      };
      setUserData(userId, 'refunds', [refund, ...loadRefunds(userId)]);
    }
    return ok({ booking: updated, refund });
  },

  'GET /api/v1/refunds': (_body, { headers }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    return ok({ items: loadRefunds(userId) });
  },
};
