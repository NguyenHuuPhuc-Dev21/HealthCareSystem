import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { PenaltyReason, TxType } from '@healthcare-system/shared';
import { closePool, query, withTransaction, type Queryable } from '../../src/core/database';
import { buildObjectKey } from '../../src/core/storage';
import { deductPenalty } from '../../src/modules/deposits/deposits.ledger';
import { DepositsService } from '../../src/modules/deposits/deposits.service';
import { DisputesService } from '../../src/modules/disputes/disputes.service';
import { holdEscrow } from '../../src/modules/gateway-webhooks/gateway-webhooks.ledger';
import { settleShift } from '../../src/modules/settlements/settlements.service';
import { postNurseEntry } from '../../src/modules/wallets-ledger/wallets-ledger.ledger';
import type { Notice } from '../../src/modules/notifications/notifications.types';
import { createTestPool, createTestUser, findOrCreateAdmin } from './helpers';

/**
 * disputes (BE-3 · Phase 6 · FR-DISP-01/02 · ADR-0004 D3) trên PostgreSQL 16 thật (migration 0001 → 0022):
 *  - mở khiếu nại (2 chiều, trong ca hoặc ≤ 24h sau check-out) → đóng băng quyết toán; 1 khiếu nại / ca;
 *  - phản hồi của bên kia (1 lần, trước hạn) → UNDER_REVIEW; ảnh bằng chứng do chính người đó tải lên;
 *  - Admin: RESOLVED_CUSTOMER → hoàn 100% escrow, −25 TrustScore, trừ ký quỹ bồi thường (không kháng cáo được);
 *           RESOLVED_NURSE → giải ngân 85% (hoặc để job quét trả sau khi check-out); có audit;
 *  - kháng cáo khoản phạt ký quỹ: chấp nhận → PENALTY_REVERSAL.
 */
describe('disputes (integration)', () => {
  let pool: Pool;
  let service: DisputesService;
  let deposits: DepositsService;
  let admin: string;
  let serviceId: string;
  let customer: { id: string; profile: string };
  const HOUR = 3_600_000;
  const deps = {
    read: { query },
    withTx: <T>(fn: (db: Queryable) => Promise<T>) => withTransaction((c) => fn(c)),
    downloadUrl: async (k: string) => `signed://${k}`,
    uploadUrl: async (k: string) => `put://${k}`,
  };
  const tx = <T>(fn: (db: Queryable) => Promise<T>) => withTransaction((c) => fn(c));
  const evidenceOf = (userId: string) => buildObjectKey('dispute-evidence', userId, 'image/jpeg');

  async function createNurse(): Promise<string> {
    const phone = `01${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
    const { rows } = await pool.query(
      "INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Điều dưỡng khiếu nại', 'NURSE', 'ACTIVE') RETURNING id",
      [phone],
    );
    const id: string = rows[0].id;
    await pool.query(`INSERT INTO nurse_profiles (user_id, tier, profile_status) VALUES ($1, 'TIER_1_BASIC', 'ACTIVE')`, [id]);
    await tx((db) => postNurseEntry(db, { userId: id, bookingId: null, txType: TxType.TOPUP, balance: 'DEPOSIT', delta: 300_000, idempotencyKey: `test-dp:${randomUUID()}`, externalRef: 'T' }));
    return id;
  }

  // Each shift gets its own 5-hour slot further back in time, so two shifts of the same nurse never
  // overlap (ex_bookings_nurse_no_overlap).
  let slot = 0;
  async function shift(nurseId: string, o: { checkoutHoursAgo?: number | null; status?: string; payment?: string } = {}) {
    const start = Date.now() - 30 * HOUR - slot++ * 5 * HOUR;
    const code = `HC-P${randomUUID().slice(0, 10)}`;
    const cash = o.payment === 'CASH';
    const { rows } = await pool.query(
      `INSERT INTO bookings
         (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method,
          start_time, end_time, base_amount, platform_fee, total_amount, execution_status, payment_status)
       VALUES ($1, $2, $3, $4, $5, 'JOB_BOARD', $6::payment_method_enum, $7, $8, 500000, 75000, 500000,
               $9::execution_status_enum, $10::payment_status_enum)
       RETURNING id`,
      [code, customer.id, customer.profile, nurseId, serviceId, o.payment ?? 'BANK_TRANSFER', new Date(start), new Date(start + 4 * HOUR),
        o.status ?? 'COMPLETED', cash ? 'UNPAID' : 'ESCROW_HELD'],
    );
    const id: string = rows[0].id;
    if (!cash) await tx((db) => holdEscrow(db, { customerId: customer.id, bookingId: id, amount: 500_000, idempotencyKey: `escrow-hold:test-${id}`, externalRef: 'FT' }));
    if (o.checkoutHoursAgo !== null) {
      await pool.query(`INSERT INTO shift_logs (booking_id, checkin_time, checkout_time) VALUES ($1, $2, $3)`, [
        id, new Date(start), new Date(Date.now() - (o.checkoutHoursAgo ?? 2) * HOUR),
      ]);
    }
    return { id, code };
  }

  const bookingOf = async (id: string) =>
    (await pool.query(`SELECT dispute_status::text AS d, payment_status::text AS p FROM bookings WHERE id = $1`, [id])).rows[0];
  const nurseOf = async (id: string) =>
    (await pool.query(
      `SELECT np.trust_score AS t, w.available_balance::int AS a, w.deposit_balance::int AS dep
         FROM nurse_profiles np JOIN wallets w ON w.user_id = np.user_id WHERE np.user_id = $1`,
      [id],
    )).rows[0];

  beforeAll(async () => {
    pool = createTestPool();
    service = new DisputesService(deps);
    deposits = new DepositsService({ ...deps, custodyAccount: () => null });
    admin = await findOrCreateAdmin(pool);
    serviceId = (await pool.query(`SELECT id FROM service_categories WHERE code = 'SRV_WOUND_CARE'`)).rows[0].id;
    const id = await createTestUser(pool);
    const p = await pool.query(
      `INSERT INTO patient_profiles (customer_id, full_name, dob, weight_kg, mobility_status, address_text, location_type, lat, lng,
                                     data_consent_accepted, consent_timestamp)
       VALUES ($1, 'Hoàng Thị Yến', '1952-12-12', 50, 'NORMAL', '9 Pasteur', 'HOME', 16.09, 108.24, TRUE, now()) RETURNING id`,
      [id],
    );
    customer = { id, profile: p.rows[0].id };
  });

  afterAll(async () => {
    await pool.end();
    await closePool();
  });

  it('opening freezes the settlement; one per booking; parties only; within the window; own evidence only', async () => {
    const nurse = await createNurse();
    const b = await shift(nurse);
    const ev = evidenceOf(customer.id);
    const { dispute_id } = await service.open(customer.id, b.id, { category: 'PREMATURE_ABANDONMENT', description: 'Điều dưỡng về sớm 45 phút so với lịch.', evidenceKeys: [ev] });
    expect(await bookingOf(b.id)).toMatchObject({ d: 'OPEN' });
    expect(await tx((db) => settleShift(db, b.id, 'CUSTOMER_CONFIRMED', Date.now()))).toEqual({ settled: false, reason: 'DISPUTE_OPEN' });

    await expect(service.open(nurse, b.id, { description: 'Gia đình to tiếng với tôi trong ca.', evidenceKeys: [] })).rejects.toMatchObject({ status: 409, code: 'DISPUTE_EXISTS' });
    await expect(service.open(await createTestUser(pool), b.id, { description: 'Không liên quan tới ca này.', evidenceKeys: [] })).rejects.toMatchObject({ status: 403 });
    const late = await shift(nurse, { checkoutHoursAgo: 25 });
    await expect(service.open(customer.id, late.id, { description: 'Khiếu nại quá muộn sau ca.', evidenceKeys: [] })).rejects.toMatchObject({ code: 'DISPUTE_WINDOW_CLOSED' });
    const other = await shift(nurse);
    await expect(service.open(customer.id, other.id, { description: 'Dùng ảnh của người khác.', evidenceKeys: [evidenceOf(nurse)] })).rejects.toMatchObject({ code: 'INVALID_EVIDENCE' });
    await expect(service.open(customer.id, other.id, { category: 'NOPE', description: 'Danh mục không hợp lệ.', evidenceKeys: [] })).rejects.toMatchObject({ status: 400 });

    const dto = await service.get(customer.id, false, dispute_id);
    expect(dto).toMatchObject({ bookingId: b.id, bookingCode: b.code, openedBy: 'PATIENT', category: 'PREMATURE_ABANDONMENT', status: 'OPEN', kind: 'BOOKING', resolution: null, nurseRebuttal: null });
    expect(dto.evidences).toEqual([expect.objectContaining({ id: ev, url: `signed://${ev}`, uploadedBy: 'PATIENT' })]);
    expect(Date.parse(dto.rebuttalDueAt!)).toBeGreaterThan(Date.now() + 23 * HOUR);
  });

  it('rebuttal: the other side, once, before the deadline → UNDER_REVIEW; evidence upload URLs for parties', async () => {
    const nurse = await createNurse();
    const b = await shift(nurse, { status: 'IN_PROGRESS', checkoutHoursAgo: null });
    const { dispute_id } = await service.open(customer.id, b.id, { category: 'CLINICAL_PROTOCOL_VIOLATION', description: 'Đo huyết áp sai quy trình.', evidenceKeys: [] });

    const urls = await service.evidenceUploadUrls(nurse, dispute_id, ['huyet-ap.jpg', 'phac-do.pdf']);
    expect(urls).toHaveLength(2);
    expect(urls[0]!.fileId.startsWith(`dispute-evidence/${nurse}/`)).toBe(true);
    expect(urls[0]!.uploadUrl).toBe(`put://${urls[0]!.fileId}`);
    await expect(service.evidenceUploadUrls(nurse, dispute_id, ['clip.mp4'])).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE_TYPE' });
    await expect(service.evidenceUploadUrls(await createTestUser(pool), dispute_id, ['a.jpg'])).rejects.toMatchObject({ status: 404 });

    await expect(service.rebut(customer.id, dispute_id, 'Người mở không được tự phản hồi.', [])).rejects.toMatchObject({ status: 403, code: 'NOT_COUNTER_PARTY' });
    expect(await service.rebut(nurse, dispute_id, 'Tôi đã đo lại 2 lần cách nhau 5 phút theo phác đồ.', [urls[0]!.fileId])).toEqual({ updated: true });
    await expect(service.rebut(nurse, dispute_id, 'Gửi phản hồi lần thứ hai cho cùng khiếu nại.', [])).rejects.toMatchObject({ code: 'ALREADY_SUBMITTED' });
    expect(await bookingOf(b.id)).toMatchObject({ d: 'UNDER_REVIEW' });

    const dto = await service.get(nurse, false, dispute_id);
    expect(dto.status).toBe('UNDER_REVIEW');
    expect(dto.nurseRebuttal).toMatchObject({ content: 'Tôi đã đo lại 2 lần cách nhau 5 phút theo phác đồ.' });
    expect(dto.nurseRebuttal!.evidences).toEqual([expect.objectContaining({ id: urls[0]!.fileId, uploadedBy: 'NURSE' })]);
    expect((await service.listForNurse(nurse)).map((x) => x.id)).toContain(dispute_id);
    expect((await service.listForCustomer(customer.id)).map((x) => x.id)).toContain(dispute_id);
    expect((await service.get(admin, true, dispute_id)).id).toBe(dispute_id);
    await expect(service.get(await createTestUser(pool), false, dispute_id)).rejects.toMatchObject({ status: 404 });

    // After the deadline nobody can rebut any more.
    const c = await shift(nurse, { status: 'IN_PROGRESS', checkoutHoursAgo: null });
    const second = await service.open(customer.id, c.id, { description: 'Thái độ không chuyên nghiệp.', evidenceKeys: [] });
    const later = new DisputesService({ ...deps, now: () => Date.now() + 25 * HOUR });
    await expect(later.rebut(nurse, second.dispute_id, 'Phản hồi gửi sau khi đã quá hạn.', [])).rejects.toMatchObject({ code: 'REBUTTAL_WINDOW_CLOSED' });
  });

  it('RESOLVED_CUSTOMER: 100% escrow refund, −25 TrustScore, deposit damages (not appealable), audited, final', async () => {
    const nurse = await createNurse();
    const b = await shift(nurse);
    const { dispute_id } = await service.open(customer.id, b.id, { category: 'UNPROFESSIONAL_CONDUCT', description: 'Điều dưỡng to tiếng với người bệnh.', evidenceKeys: [] });
    const before = await nurseOf(nurse);

    await expect(service.resolve(admin, dispute_id, { resolution: 'RESOLVED_CUSTOMER', notes: 'ngắn' })).rejects.toMatchObject({ status: 400 });
    const r = await service.resolve(admin, dispute_id, { resolution: 'RESOLVED_CUSTOMER', notes: 'Có video xác nhận hành vi to tiếng.', depositDeduction: 50_000 });
    expect(r).toMatchObject({ outcome: 'RESOLVED_CUSTOMER', refunded: 500_000, released: false, trustScoreDelta: -25, depositDeducted: 50_000 });
    expect(await bookingOf(b.id)).toEqual({ d: 'RESOLVED_CUSTOMER', p: 'REFUNDED' });
    expect(await nurseOf(nurse)).toEqual({ t: before.t - 25, a: 0, dep: 250_000 });

    const [penalty] = await deposits.listPenalties(nurse);
    expect(penalty).toMatchObject({ reason: 'DISPUTE_UPHELD', amount: 50_000, disputeId: dispute_id, appealDeadline: null });
    const audit = await pool.query(`SELECT action_type::text AS a, actor_id FROM audit_logs WHERE target_id = $1`, [dispute_id]);
    expect(audit.rows).toEqual([{ a: 'RESOLVE_DISPUTE', actor_id: admin }]);

    const dto = await service.get(customer.id, false, dispute_id);
    expect(dto.resolution).toMatchObject({ outcome: 'RESOLVED_CUSTOMER', refundedToPatient: true, releasedToNurse: false, trustScoreDelta: -25, depositDeducted: 50_000 });
    await expect(service.resolve(admin, dispute_id, { resolution: 'RESOLVED_NURSE', notes: 'Đổi ý sau khi đã xử xong.' })).rejects.toMatchObject({ code: 'DISPUTE_CLOSED' });
  });

  it('RESOLVED_NURSE: the 85% is released now if checked out, otherwise by the settlement sweep after check-out', async () => {
    const nurse = await createNurse();
    const b = await shift(nurse);
    const one = await service.open(customer.id, b.id, { description: 'Khiếu nại không có căn cứ rõ ràng.', evidenceKeys: [] });
    expect(await service.resolve(admin, one.dispute_id, { resolution: 'RESOLVED_NURSE', notes: 'Không đủ bằng chứng, giải ngân cho điều dưỡng.' })).toMatchObject({ released: true, refunded: 0 });
    expect(await bookingOf(b.id)).toEqual({ d: 'RESOLVED_NURSE', p: 'SETTLED' });
    expect((await nurseOf(nurse)).a).toBe(425_000);
    expect((await pool.query(`SELECT release_amount::int AS r FROM disputes WHERE id = $1`, [one.dispute_id])).rows[0].r).toBe(425_000);

    const running = await shift(nurse, { status: 'IN_PROGRESS', checkoutHoursAgo: null });
    const two = await service.open(nurse, running.id, { category: 'UNPROFESSIONAL_CONDUCT', description: 'Gia đình yêu cầu việc ngoài chuyên môn.', evidenceKeys: [] });
    expect(await service.resolve(admin, two.dispute_id, { resolution: 'RESOLVED_NURSE', notes: 'Điều dưỡng làm đúng phạm vi chuyên môn.' })).toMatchObject({ released: false });
    await pool.query(`UPDATE bookings SET execution_status = 'COMPLETED' WHERE id = $1`, [running.id]);
    await pool.query(`INSERT INTO shift_logs (booking_id, checkin_time, checkout_time) VALUES ($1, now() - interval '30 hours', now() - interval '25 hours')`, [running.id]);
    expect(await tx((db) => settleShift(db, running.id, 'COOLING_ELAPSED', Date.now()))).toMatchObject({ settled: true });
    expect((await nurseOf(nurse)).a).toBe(850_000);
  });

  it('penalty appeal: upheld → PENALTY_REVERSAL; no rebuttal on an appeal', async () => {
    const nurse = await createNurse();
    const b = await shift(nurse, { status: 'COMPLETED' });
    await pool.query(`UPDATE bookings SET execution_status = 'CANCELLED' WHERE id = $1`, [b.id]);
    const p = await tx((db) => deductPenalty(db, { nurseId: nurse, bookingId: b.id, reason: PenaltyReason.NURSE_LATE_CANCEL, amount: 100_000, slaRuleRef: 'SRS §5.2 row 7' }, Date.now()));
    const { disputeId } = await deposits.appealPenalty(nurse, p!.transactionId, { reason: 'Tôi đã báo hủy trước 13 tiếng, có tin nhắn làm bằng chứng.' });
    expect((await nurseOf(nurse)).dep).toBe(200_000);

    const dto = await service.get(nurse, false, disputeId);
    expect(dto).toMatchObject({ kind: 'PENALTY_APPEAL', appealedTransactionId: p!.transactionId, penaltyAmount: 100_000, penaltyReason: 'NURSE_LATE_CANCEL', slaRule: 'SRS §5.2 row 7', openedBy: 'NURSE' });
    await expect(service.rebut(customer.id, disputeId, 'Khách không phản hồi được kháng cáo phạt.', [])).rejects.toMatchObject({ code: 'NOT_APPLICABLE' });

    expect(await service.resolve(admin, disputeId, { resolution: 'RESOLVED_NURSE', notes: 'Tin nhắn hủy ca gửi trước 13 tiếng là hợp lệ.' })).toMatchObject({ penaltyReversed: true, refunded: 0 });
    expect((await nurseOf(nurse)).dep).toBe(300_000);
    expect((await deposits.listPenalties(nurse))[0]).toMatchObject({ reversed: true });
    expect(await bookingOf(b.id)).toMatchObject({ d: 'NONE' }); // an appeal never touches the booking's dispute status
  });

  it('notifications (Phase 6): the other side on open, the opener on rebuttal, both sides on the decision — after commit', async () => {
    const sent: Notice[] = [];
    const notifying = new DisputesService({ ...deps, notify: async (n) => void sent.push(n) });
    const nurse = await createNurse();
    const b = await shift(nurse);
    const { dispute_id } = await notifying.open(customer.id, b.id, { category: 'UNPROFESSIONAL_CONDUCT', description: 'Điều dưỡng đến muộn 40 phút.', evidenceKeys: [] });
    expect(sent).toEqual([expect.objectContaining({ userId: nurse, type: 'DISPUTE_OPENED', priority: 'HIGH', bookingId: b.id, data: expect.objectContaining({ disputeId: dispute_id, bookingCode: b.code }) })]);

    await notifying.rebut(nurse, dispute_id, 'Tôi báo trễ do kẹt xe và đã xin phép gia đình.', []);
    expect(sent[1]).toMatchObject({ userId: customer.id, type: 'DISPUTE_UPDATED' });

    await notifying.resolve(admin, dispute_id, { resolution: 'RESOLVED_CUSTOMER', notes: 'Đến muộn quá 15 phút không báo trước.', depositDeduction: 20_000 });
    expect(sent.slice(2).map((n) => [n.userId, n.type])).toEqual([
      [nurse, 'DISPUTE_RESOLVED'],
      [customer.id, 'DISPUTE_RESOLVED'],
      [nurse, 'DEPOSIT_PENALTY'],
    ]);
    expect(sent[3].body).toContain('500.000đ');

    // A refused request sends nothing.
    sent.length = 0;
    await expect(notifying.open(customer.id, b.id, { description: 'Mở lần hai cho cùng ca.', evidenceKeys: [] })).rejects.toBeTruthy();
    expect(sent).toEqual([]);
  });
});
