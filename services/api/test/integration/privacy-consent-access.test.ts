import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { runInTransaction } from "../../src/core/database";
import { AppError } from "../../src/core/errors";
import {
  PrivacyConsentService,
  assertRecordAccess,
  captureConsent,
} from "../../src/modules/privacy-consent/privacy-consent.service";
import { createTestPool, createTestUser } from "./helpers";

/**
 * Cửa sổ xem bệnh án trên PostgreSQL thật: booking, shift_logs.checkout_time,
 * record_access_grants và dòng audit VIEW_MEDICAL_RECORD.
 * (Điều dưỡng test không bị xóa: audit_logs tham chiếu tới họ và audit không xóa được.)
 */
describe("privacy-consent — xem bệnh án (integration)", () => {
  let pool: Pool;
  let customerId: string;
  let nurseId: string;
  let otherNurseId: string;
  let profileId: string;
  let invasiveServiceId: string;
  const HOUR = 60 * 60 * 1000;

  beforeAll(async () => {
    pool = createTestPool();
    const { rows } = await pool.query(
      "SELECT id FROM service_categories WHERE is_invasive = TRUE ORDER BY code LIMIT 1",
    );
    invasiveServiceId = rows[0].id;
  });

  afterAll(async () => {
    await pool.end();
  });

  async function createNurse(): Promise<string> {
    const phone = `07${Math.floor(Math.random() * 1e8)
      .toString()
      .padStart(8, "0")}`;
    const { rows } = await pool.query(
      `INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Điều dưỡng test', 'NURSE', 'ACTIVE') RETURNING id`,
      [phone],
    );
    return rows[0].id;
  }

  beforeEach(async () => {
    customerId = await createTestUser(pool);
    nurseId = await createNurse();
    otherNurseId = await createNurse();
    const c = captureConsent({
      accepted: true,
      ip: "203.0.113.7",
      deviceId: "web",
    });
    const { rows } = await pool.query(
      `INSERT INTO patient_profiles
         (customer_id, full_name, dob, location_type, mobility_status, medical_history,
          data_consent_accepted, consent_timestamp, consent_ip, consent_device_id)
       VALUES ($1, 'Trần Văn B', '1948-05-02', 'HOME', 'BEDRIDDEN', 'Tăng huyết áp', $2, $3, $4, $5)
       RETURNING id`,
      [
        customerId,
        c.data_consent_accepted,
        c.consent_timestamp,
        c.consent_ip,
        c.consent_device_id,
      ],
    );
    profileId = rows[0].id;
  });

  /** Tạo booking; nếu có checkoutTime thì thêm shift_logs và đánh dấu COMPLETED. */
  async function createBooking(
    status: string,
    checkoutTime: Date | null = null,
  ): Promise<string> {
    const start = new Date("2026-11-03T01:00:00Z");
    const { rows } = await pool.query(
      `INSERT INTO bookings
         (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method,
          start_time, end_time, base_amount, total_amount, execution_status,
          prescription_image_url, prescription_issued_date)
       VALUES ($1, $2, $3, $4, $5, 'JOB_BOARD', 'BANK_TRANSFER', $6, $7, 350000, 350000, $8, $9, '2026-11-01')
       RETURNING id`,
      [
        `T-${randomUUID().slice(0, 12)}`,
        customerId,
        profileId,
        nurseId,
        invasiveServiceId,
        start,
        new Date(start.getTime() + 4 * HOUR),
        status,
        `prescription/${customerId}/${randomUUID()}.jpg`, // object key, đúng định dạng của core/storage
      ],
    );
    const bookingId = rows[0].id;
    if (checkoutTime) {
      await pool.query(
        "INSERT INTO shift_logs (booking_id, checkout_time) VALUES ($1, $2)",
        [bookingId, checkoutTime],
      );
    }
    return bookingId;
  }

  async function denialOf(fn: () => Promise<unknown>): Promise<AppError> {
    try {
      await fn();
    } catch (err) {
      if (err instanceof AppError) return err;
      throw err;
    }
    throw new Error("expected an AppError");
  }

  async function auditCount(bookingId: string): Promise<number> {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM audit_logs
        WHERE action_type = 'VIEW_MEDICAL_RECORD' AND target_id = $1 AND new_value->>'bookingId' = $2`,
      [profileId, bookingId],
    );
    return Number(rows[0].n);
  }

  function service(now: Date) {
    return new PrivacyConsentService({
      withTx: (fn) => runInTransaction(pool, fn),
      downloadUrl: async (key) => `https://signed.example/${key}?ttl=600`,
      recordAccessExpiryHours: async () => 12,
      now: () => now,
    });
  }

  it("RECORD_ACCESS_EXPIRY_HOURS trong system_configs là 12", async () => {
    const { rows } = await pool.query(
      "SELECT config_value FROM system_configs WHERE config_key = 'RECORD_ACCESS_EXPIRY_HOURS'",
    );
    expect(rows[0].config_value).toBe("12");
  });

  it("ca CONFIRMED: điều dưỡng được giao xem được; điều dưỡng khác bị 403 NOT_ASSIGNED", async () => {
    const bookingId = await createBooking("CONFIRMED");
    const ok = await assertRecordAccess(
      pool,
      { bookingId, nurseId },
      { expiryHours: 12 },
    );
    expect(ok).toEqual({
      patientProfileId: profileId,
      basis: "ACTIVE_BOOKING",
      accessUntil: null,
    });

    const err = await denialOf(() =>
      assertRecordAccess(
        pool,
        { bookingId, nurseId: otherNurseId },
        { expiryHours: 12 },
      ),
    );
    expect(err.status).toBe(403);
    expect(err.code).toBe("RECORD_ACCESS_DENIED");
    expect(err.details).toEqual({ reason: "NOT_ASSIGNED" });
  });

  it("ca COMPLETED: 11h59m sau check-out còn xem được, 12h00 thì 403 WINDOW_CLOSED", async () => {
    const checkout = new Date("2026-11-03T05:00:00Z");
    const bookingId = await createBooking("COMPLETED", checkout);

    const before = await assertRecordAccess(
      pool,
      { bookingId, nurseId },
      {
        expiryHours: 12,
        now: new Date(checkout.getTime() + 12 * HOUR - 60_000),
      },
    );
    expect(before.basis).toBe("POST_CHECKOUT_WINDOW");

    const err = await denialOf(() =>
      assertRecordAccess(
        pool,
        { bookingId, nurseId },
        { expiryHours: 12, now: new Date(checkout.getTime() + 12 * HOUR) },
      ),
    );
    expect(err.details).toEqual({ reason: "WINDOW_CLOSED" });
  });

  it("Admin cấp lại quyền: mở lại sau 12h, chỉ cho đúng điều dưỡng đó, hết hạn thì khóa", async () => {
    const checkout = new Date("2026-11-03T05:00:00Z");
    const bookingId = await createBooking("COMPLETED", checkout);
    const { rows: admins } = await pool.query(
      "SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1",
    );
    const grantUntil = new Date(checkout.getTime() + 30 * HOUR);
    await pool.query(
      `INSERT INTO record_access_grants (booking_id, nurse_id, granted_by, reason, expires_at)
       VALUES ($1, $2, $3, 'Đối chiếu khiếu nại', $4)`,
      [bookingId, nurseId, admins[0].id, grantUntil],
    );

    const at20h = new Date(checkout.getTime() + 20 * HOUR);
    const ok = await assertRecordAccess(
      pool,
      { bookingId, nurseId },
      { expiryHours: 12, now: at20h },
    );
    expect(ok).toEqual({
      patientProfileId: profileId,
      basis: "ADMIN_GRANT",
      accessUntil: grantUntil,
    });

    const afterGrant = await denialOf(() =>
      assertRecordAccess(
        pool,
        { bookingId, nurseId },
        { expiryHours: 12, now: grantUntil },
      ),
    );
    expect(afterGrant.details).toEqual({ reason: "WINDOW_CLOSED" });
  });

  it("rút đồng ý: kể cả ca đang CONFIRMED cũng 403 CONSENT_WITHDRAWN", async () => {
    const bookingId = await createBooking("CONFIRMED");
    await pool.query(
      "UPDATE patient_profiles SET data_consent_accepted = FALSE, consent_withdrawn_at = now() WHERE id = $1",
      [profileId],
    );
    const err = await denialOf(() =>
      assertRecordAccess(pool, { bookingId, nurseId }, { expiryHours: 12 }),
    );
    expect(err.details).toEqual({ reason: "CONSENT_WITHDRAWN" });
  });

  it("booking không tồn tại hoặc id sai định dạng: 404 BOOKING_NOT_FOUND", async () => {
    for (const bookingId of [randomUUID(), "not-a-uuid"]) {
      const err = await denialOf(() =>
        assertRecordAccess(pool, { bookingId, nurseId }, { expiryHours: 12 }),
      );
      expect(err.status).toBe(404);
      expect(err.code).toBe("BOOKING_NOT_FOUND");
    }
  });

  it("getMedicalRecord: trả dữ liệu + link đơn thuốc 10 phút, và GHI audit VIEW_MEDICAL_RECORD mỗi lần xem", async () => {
    const bookingId = await createBooking("IN_PROGRESS");
    const svc = service(new Date());

    const view = await svc.getMedicalRecord(nurseId, bookingId, "198.51.100.9");
    expect(view.patient).toMatchObject({
      fullName: "Trần Văn B",
      dob: "1948-05-02",
      mobilityStatus: "BEDRIDDEN",
    });
    expect(view.access).toEqual({ basis: "ACTIVE_BOOKING", accessUntil: null });
    expect(view.prescription?.imageUrl).toMatch(
      /^https:\/\/signed\.example\/prescription\//,
    );
    expect(view.prescription?.imageUrlExpiresInSeconds).toBe(600);
    expect(await auditCount(bookingId)).toBe(1);

    await svc.getMedicalRecord(nurseId, bookingId, "198.51.100.9");
    expect(await auditCount(bookingId)).toBe(2); // mọi lần xem đều được ghi
  });

  it("getMedicalRecord bị từ chối thì KHÔNG trả dữ liệu và KHÔNG ghi audit", async () => {
    const bookingId = await createBooking("CONFIRMED");
    const err = await denialOf(() =>
      service(new Date()).getMedicalRecord(otherNurseId, bookingId, null),
    );
    expect(err.code).toBe("RECORD_ACCESS_DENIED");
    expect(await auditCount(bookingId)).toBe(0);
  });
});
