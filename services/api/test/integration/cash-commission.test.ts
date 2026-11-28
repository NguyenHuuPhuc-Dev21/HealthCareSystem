import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { TxType } from '@healthcare-system/shared';
import { closePool, query, withTransaction, type Queryable } from '../../src/core/database';
import { CashCommissionService } from '../../src/modules/cash-commission/cash-commission.service';
import { signData } from '../../src/modules/gateway-webhooks/gateway-webhooks.policy';
import { GatewayWebhooksService } from '../../src/modules/gateway-webhooks/gateway-webhooks.service';
import { postNurseEntry } from '../../src/modules/wallets-ledger/wallets-ledger.ledger';
import { WalletsLedgerService } from '../../src/modules/wallets-ledger/wallets-ledger.service';
import { createTestPool, createTestUser } from './helpers';

/**
 * cash-commission (BE-3 · Phase 5 · FR-PAY-02 phần tiền mặt) trên PostgreSQL 16 thật (migration 0001 → 0021):
 *  - danh sách hoa hồng ca tiền mặt (OVERDUE / UNPAID / PAID), link VietQR "HH…" một mã cho mỗi ca;
 *  - chuyển khoản qua webhook HMAC → 1 dòng COMMISSION_PAYMENT KHÔNG đụng số dư ví / ký quỹ → ca SETTLED; chống lặp;
 *  - quá hạn chưa nộp → SUSPENDED (COMMISSION_OVERDUE); nộp đủ → ACTIVE lại (chỉ khoá do module này).
 */
describe('cash-commission (integration)', () => {
  let pool: Pool;
  let service: CashCommissionService;
  let webhooks: GatewayWebhooksService;
  let wallets: WalletsLedgerService;
  let serviceId: string;
  let customer: { id: string; profile: string };
  const SECRET = 'integration-commission-secret';
  const HOUR = 3_600_000;
  const ACCOUNT = { bankBin: '970422', bankName: 'MB Bank (sandbox)', accountNumber: '0000000000', accountName: 'CARENEST' };
  const deps = { read: { query }, withTx: <T>(fn: (db: Queryable) => Promise<T>) => withTransaction((c) => fn(c)) };
  const ref = () => `FT-HH-${randomUUID().slice(0, 12)}`;
  const pay = (orderCode: string, amount: number, reference: string) => {
    const data = { orderCode, amount, reference, description: orderCode, transactionDateTime: new Date().toISOString() };
    return webhooks.handleEscrowWebhook({ code: '00', desc: 'success', success: true, data, signature: signData(data, SECRET) });
  };

  async function createNurse(): Promise<string> {
    const phone = `07${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
    const { rows } = await pool.query(
      "INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Điều dưỡng tiền mặt', 'NURSE', 'ACTIVE') RETURNING id",
      [phone],
    );
    const id: string = rows[0].id;
    await pool.query(`INSERT INTO nurse_profiles (user_id, tier, profile_status) VALUES ($1, 'TIER_1_BASIC', 'ACTIVE')`, [id]);
    await withTransaction(async (db) => {
      await postNurseEntry(db, { userId: id, bookingId: null, txType: TxType.TOPUP, balance: 'DEPOSIT', delta: 300_000, idempotencyKey: `test-cc:${randomUUID()}`, externalRef: 'T' });
      await postNurseEntry(db, { userId: id, bookingId: null, txType: TxType.ESCROW_RELEASE, balance: 'AVAILABLE', delta: 120_000, idempotencyKey: `test-cc:${randomUUID()}`, externalRef: null });
    });
    return id;
  }

  async function cashShift(nurseId: string, o: { dueInHours: number | null; status?: string; payment?: string }): Promise<{ id: string; code: string }> {
    const start = Date.now() - 30 * HOUR;
    const code = `HC-K${randomUUID().slice(0, 10)}`;
    const { rows } = await pool.query(
      `INSERT INTO bookings
         (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method,
          start_time, end_time, base_amount, platform_fee, total_amount, execution_status, payment_status, commission_due_at)
       VALUES ($1, $2, $3, $4, $5, 'JOB_BOARD', $6::payment_method_enum, $7, $8, 500000, 75000, 500000,
               $9::execution_status_enum, 'UNPAID', $10)
       RETURNING id`,
      [code, customer.id, customer.profile, nurseId, serviceId, o.payment ?? 'CASH', new Date(start), new Date(start + 4 * HOUR),
        o.status ?? 'COMPLETED', o.dueInHours === null ? null : new Date(Date.now() + o.dueInHours * HOUR)],
    );
    return { id: rows[0].id, code };
  }

  const profileOf = async (id: string) =>
    (await pool.query(`SELECT profile_status::text AS s, suspended_reason AS r FROM nurse_profiles WHERE user_id = $1`, [id])).rows[0];
  const balancesOf = async (id: string) =>
    (await pool.query(`SELECT available_balance::int AS a, deposit_balance::int AS d FROM wallets WHERE user_id = $1`, [id])).rows[0];

  beforeAll(async () => {
    pool = createTestPool();
    service = new CashCommissionService({ ...deps, receivingAccount: () => ACCOUNT });
    wallets = new WalletsLedgerService(deps);
    webhooks = new GatewayWebhooksService({ read: pool, withTx: deps.withTx, secret: () => SECRET, receivingAccount: () => ACCOUNT, startRadar: async () => {} });
    serviceId = (await pool.query(`SELECT id FROM service_categories WHERE code = 'SRV_WOUND_CARE'`)).rows[0].id;
    const id = await createTestUser(pool);
    const p = await pool.query(
      `INSERT INTO patient_profiles (customer_id, full_name, dob, weight_kg, mobility_status, address_text, location_type, lat, lng,
                                     data_consent_accepted, consent_timestamp)
       VALUES ($1, 'Vũ Văn Tâm', '1949-09-09', 61, 'NORMAL', '7 Nguyễn Huệ', 'HOME', 16.08, 108.23, TRUE, now()) RETURNING id`,
      [id],
    );
    customer = { id, profile: p.rows[0].id };
  });

  afterAll(async () => {
    await pool.end();
    await closePool();
  });

  it('lists the commissions, overdue first; one VietQR code per booking; only for her own completed cash shift', async () => {
    const nurse = await createNurse();
    const later = await cashShift(nurse, { dueInHours: 20 });
    const late = await cashShift(nurse, { dueInHours: -1 });
    const debts = await service.listDebts(nurse);
    expect(debts.map((d) => [d.bookingCode, d.status, d.commissionAmount, d.bookingAmount])).toEqual([
      [late.code, 'OVERDUE', 75_000, 500_000],
      [later.code, 'UNPAID', 75_000, 500_000],
    ]);

    const link = await service.createPaymentLink(nurse, later.id);
    expect(link).toMatchObject({ amount: 75_000, bankName: ACCOUNT.bankName, accountNumber: ACCOUNT.accountNumber });
    expect(link.transferContent).toMatch(/^HH[A-Z2-9]{12}$/);
    expect(link.qrCode).toContain(link.transferContent);
    expect((await service.createPaymentLink(nurse, later.id)).transferContent).toBe(link.transferContent);

    await expect(service.createPaymentLink(await createNurse(), later.id)).rejects.toMatchObject({ status: 403 });
    const transfer = await cashShift(nurse, { dueInHours: 20, payment: 'BANK_TRANSFER' });
    await expect(service.createPaymentLink(nurse, transfer.id)).rejects.toMatchObject({ status: 400, code: 'NOT_CASH_BOOKING' });
    const running = await cashShift(nurse, { dueInHours: null, status: 'IN_PROGRESS' });
    await expect(service.createPaymentLink(nurse, running.id)).rejects.toMatchObject({ status: 409, code: 'COMMISSION_NOT_DUE' });
  });

  it('paid through the webhook: one COMMISSION_PAYMENT, no balance touched, booking SETTLED; replays never pay twice', async () => {
    const nurse = await createNurse();
    const b = await cashShift(nurse, { dueInHours: 10 });
    const link = await service.createPaymentLink(nurse, b.id);
    const before = await balancesOf(nurse);

    await expect(pay(link.transferContent, 70_000, ref())).resolves.toMatchObject({ outcome: 'AMOUNT_MISMATCH', bookingId: b.id });
    const reference = ref();
    await expect(pay(link.transferContent, 75_000, reference)).resolves.toMatchObject({ outcome: 'COMMISSION_PAID', bookingId: b.id });
    await expect(pay(link.transferContent, 75_000, reference)).resolves.toMatchObject({ outcome: 'DUPLICATE' });
    await expect(pay(link.transferContent, 75_000, ref())).resolves.toMatchObject({ outcome: 'COMMISSION_RETURNED' });

    expect(await balancesOf(nurse)).toEqual(before); // never from available or deposit (FR-PAY-02, BR-05)
    const tx = await pool.query(`SELECT tx_type::text, amount::int, external_ref FROM wallet_transactions WHERE idempotency_key = $1`, [`commission:${b.id}`]);
    expect(tx.rows).toEqual([{ tx_type: 'COMMISSION_PAYMENT', amount: 75_000, external_ref: reference }]);
    expect((await pool.query(`SELECT payment_status::text AS p FROM bookings WHERE id = $1`, [b.id])).rows[0].p).toBe('SETTLED');
    expect((await service.listDebts(nurse))[0]).toMatchObject({ bookingId: b.id, status: 'PAID', paidAt: expect.any(String) });
    await expect(service.createPaymentLink(nurse, b.id)).rejects.toMatchObject({ code: 'COMMISSION_ALREADY_PAID' });

    const history = await wallets.listTransactions(nurse, { type: 'COMMISSION_PAYMENT' });
    expect(history.items.map((t) => [t.amount, t.bookingCode])).toEqual([[-75_000, b.code]]);
  });

  it('overdue → SUSPENDED (COMMISSION_OVERDUE); paying every overdue commission → ACTIVE again', async () => {
    const nurse = await createNurse();
    const a = await cashShift(nurse, { dueInHours: -2 });
    const c = await cashShift(nurse, { dueInHours: -1 });
    expect((await service.runOverdueSweep()).suspended).toBeGreaterThanOrEqual(1);
    expect(await profileOf(nurse)).toEqual({ s: 'SUSPENDED', r: 'COMMISSION_OVERDUE' });
    expect(await wallets.getSummary(nurse)).toMatchObject({ isSuspended: true, suspendedReason: 'COMMISSION_OVERDUE' });

    const linkA = await service.createPaymentLink(nurse, a.id);
    await pay(linkA.transferContent, 75_000, ref());
    expect((await profileOf(nurse)).s).toBe('SUSPENDED'); // one still overdue

    const linkC = await service.createPaymentLink(nurse, c.id);
    await pay(linkC.transferContent, 75_000, ref());
    expect(await profileOf(nurse)).toEqual({ s: 'ACTIVE', r: null });
    await service.runOverdueSweep();
    expect((await profileOf(nurse)).s).toBe('ACTIVE');
  });

  it('a suspension for another reason is never lifted by paying a commission', async () => {
    const nurse = await createNurse();
    const b = await cashShift(nurse, { dueInHours: -1 });
    await pool.query(`UPDATE nurse_profiles SET profile_status = 'SUSPENDED', suspended_reason = 'TRUST_SCORE_BELOW_THRESHOLD' WHERE user_id = $1`, [nurse]);
    const link = await service.createPaymentLink(nurse, b.id);
    await pay(link.transferContent, 75_000, ref());
    expect(await profileOf(nurse)).toEqual({ s: 'SUSPENDED', r: 'TRUST_SCORE_BELOW_THRESHOLD' });
  });
});
