import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { runInTransaction } from "../../src/core/database";
import { AppError } from "../../src/core/errors";
import {
  PrivacyConsentService,
  assertConsentActive,
  assertRecordAccess,
  captureConsent,
} from "../../src/modules/privacy-consent/privacy-consent.service";
import { createTestPool, createTestUser, findOrCreateAdmin } from "./helpers";

/**
 * Admin cấp lại quyền xem (contract §3) và khách rút đồng ý (contract §4) trên PostgreSQL thật.
 * (User test không bị xóa: audit_logs / record_access_grants tham chiếu tới họ.)
 */
describe("privacy-consent — cấp lại quyền & rút đồng ý (integration)", () => {
  let pool: Pool;
  let adminId: string;
  let customerId: string;
  let nurseId: string;
  let otherNurseId: string;
  let profileId: string;
  let serviceId: string;
  const HOUR = 60 * 60 * 1000;

  beforeAll(async () => {
    pool = createTestPool();
    adminId = await findOrCreateAdmin(pool);
    const { rows } = await pool.query(
      "SELECT id FROM service_categories ORDER BY code LIMIT 1",
    );
    serviceId = rows[0].id;
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

  async function createProfile(ownerId: string): Promise<string> {
    const c = captureConsent({
      accepted: true,
      ip: "203.0.113.7",
      deviceId: "web",
    });
    const { rows } = await pool.query(
      `INSERT INTO patient_profiles
         (customer_id, full_name, location_type, data_consent_accepted, consent_timestamp, consent_ip, consent_device_id)
       VALUES ($1, 'Trần Văn C', 'HOME', $2, $3, $4, $5)
       RETURNING id`,
      [
        ownerId,
        c.data_consent_accepted,
        c.consent_timestamp,
        c.consent_ip,
        c.consent_device_id,
      ],
    );
    return rows[0].id;
  }

  beforeEach(async () => {
    customerId = await createTestUser(pool);
    nurseId = await createNurse();
    otherNurseId = await createNurse();
    profileId = await createProfile(customerId);
  });

  /** Booking của nurseId; nếu có checkoutTime thì thêm shift_logs. */
  async function createBooking(
    status: string,
    checkoutTime: Date | null = null,
  ): Promise<string> {
    const start = new Date(Date.now() - 30 * HOUR);
    const { rows } = await pool.query(
      `INSERT INTO bookings
         (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method,
          start_time, end_time, base_amount, total_amount, execution_status)
       VALUES ($1, $2, $3, $4, $5, 'JOB_BOARD', 'BANK_TRANSFER', $6, $7, 350000, 350000, $8)
       RETURNING id`,
      [
        `T-${randomUUID().slice(0, 12)}`,
        customerId,
        profileId,
        nurseId,
        serviceId,
        start,
        new Date(start.getTime() + 4 * HOUR),
        status,
      ],
    );
    if (checkoutTime) {
      await pool.query(
        "INSERT INTO shift_logs (booking_id, checkout_time) VALUES ($1, $2)",
        [rows[0].id, checkoutTime],
      );
    }
    return rows[0].id;
  }

  function service(now: Date) {
    return new PrivacyConsentService({
      withTx: (fn) => runInTransaction(pool, fn),
      downloadUrl: async (key) => `https://signed.example/${key}`,
      recordAccessExpiryHours: async () => 12,
      recordAccessGrantMaxHours: async () => 24,
      now: () => now,
    });
  }

  async function errorOf(fn: () => Promise<unknown>): Promise<AppError> {
    try {
      await fn();
    } catch (err) {
      if (err instanceof AppError) return err;
      throw err;
    }
    throw new Error("expected an AppError");
  }

  async function grantCount(bookingId: string): Promise<number> {
    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM record_access_grants WHERE booking_id = $1",
      [bookingId],
    );
    return Number(rows[0].n);
  }

  async function grantAuditCount(bookingId: string): Promise<number> {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM audit_logs
        WHERE action_type = 'GRANT_RECORD_ACCESS' AND new_value->>'bookingId' = $1`,
      [bookingId],
    );
    return Number(rows[0].n);
  }

  // ---- §3 Admin cấp lại quyền -------------------------------------------------

  it("RECORD_ACCESS_GRANT_MAX_HOURS trong system_configs là 24", async () => {
    const { rows } = await pool.query(
      "SELECT config_value FROM system_configs WHERE config_key = 'RECORD_ACCESS_GRANT_MAX_HOURS'",
    );
    expect(rows[0].config_value).toBe("24");
  });

  it("Admin cấp lại quyền: lưu grant + audit GRANT_RECORD_ACCESS, điều dưỡng xem lại được (ADMIN_GRANT)", async () => {
    const now = new Date();
    const bookingId = await createBooking(
      "COMPLETED",
      new Date(now.getTime() - 20 * HOUR),
    ); // cửa sổ 12h đã đóng
    const before = await errorOf(() =>
      assertRecordAccess(
        pool,
        { bookingId, nurseId },
        { expiryHours: 12, now },
      ),
    );
    expect(before.details).toEqual({ reason: "WINDOW_CLOSED" });

    const expiresAt = new Date(now.getTime() + 2 * HOUR);
    const view = await service(now).grantRecordAccess(
      adminId,
      bookingId,
      { nurseId, reason: "Đối chiếu khiếu nại #D-102", expiresAt },
      "198.51.100.20",
    );
    expect(view.expiresAt).toBe(expiresAt.toISOString());

    const { rows } = await pool.query(
      "SELECT booking_id, nurse_id, granted_by, reason, expires_at FROM record_access_grants WHERE id = $1",
      [view.grantId],
    );
    expect(rows[0]).toMatchObject({
      booking_id: bookingId,
      nurse_id: nurseId,
      granted_by: adminId,
      reason: "Đối chiếu khiếu nại #D-102",
    });
    expect(new Date(rows[0].expires_at).toISOString()).toBe(
      expiresAt.toISOString(),
    );

    const audit = await pool.query(
      `SELECT actor_id, target_table, ip_address, new_value FROM audit_logs
        WHERE action_type = 'GRANT_RECORD_ACCESS' AND target_id = $1`,
      [view.grantId],
    );
    expect(audit.rows.length).toBe(1);
    expect(audit.rows[0]).toMatchObject({
      actor_id: adminId,
      target_table: "record_access_grants",
      ip_address: "198.51.100.20",
      new_value: { bookingId, nurseId, expiresAt: expiresAt.toISOString() },
    });

    const after = await assertRecordAccess(
      pool,
      { bookingId, nurseId },
      { expiryHours: 12, now },
    );
    expect(after.basis).toBe("ADMIN_GRANT");
  });

  it("expiresAt quá 24h hoặc ở quá khứ: 400 VALIDATION_ERROR, không lưu gì", async () => {
    const now = new Date();
    const bookingId = await createBooking(
      "COMPLETED",
      new Date(now.getTime() - 20 * HOUR),
    );
    for (const expiresAt of [
      new Date(now.getTime() + 24 * HOUR + 60_000),
      new Date(now.getTime() - 60_000),
    ]) {
      const err = await errorOf(() =>
        service(now).grantRecordAccess(
          adminId,
          bookingId,
          { nurseId, reason: "Đối chiếu khiếu nại #D-102", expiresAt },
          null,
        ),
      );
      expect(err.status).toBe(400);
      expect(err.code).toBe("VALIDATION_ERROR");
    }
    expect(await grantCount(bookingId)).toBe(0);
    expect(await grantAuditCount(bookingId)).toBe(0);
  });

  it("nurseId không phải điều dưỡng của booking: 409 NURSE_NOT_ON_BOOKING, không lưu grant/audit", async () => {
    const now = new Date();
    const bookingId = await createBooking(
      "COMPLETED",
      new Date(now.getTime() - 20 * HOUR),
    );
    const err = await errorOf(() =>
      service(now).grantRecordAccess(
        adminId,
        bookingId,
        {
          nurseId: otherNurseId,
          reason: "Đối chiếu khiếu nại #D-102",
          expiresAt: new Date(now.getTime() + HOUR),
        },
        null,
      ),
    );
    expect(err.status).toBe(409);
    expect(err.code).toBe("NURSE_NOT_ON_BOOKING");
    expect(await grantCount(bookingId)).toBe(0);
    expect(await grantAuditCount(bookingId)).toBe(0);
  });

  it("booking không tồn tại: 404 BOOKING_NOT_FOUND", async () => {
    const now = new Date();
    const err = await errorOf(() =>
      service(now).grantRecordAccess(
        adminId,
        randomUUID(),
        {
          nurseId,
          reason: "Đối chiếu khiếu nại #D-102",
          expiresAt: new Date(now.getTime() + HOUR),
        },
        null,
      ),
    );
    expect(err.status).toBe(404);
    expect(err.code).toBe("BOOKING_NOT_FOUND");
  });

  // ---- §4 Khách rút đồng ý ----------------------------------------------------

  it("chủ hồ sơ rút đồng ý: 200, DB ghi FALSE + consent_withdrawn_at, điều dưỡng bị chặn ngay", async () => {
    const bookingId = await createBooking("CONFIRMED");
    await assertRecordAccess(pool, { bookingId, nurseId }, { expiryHours: 12 }); // trước khi rút: xem được

    const now = new Date();
    const view = await service(now).withdrawConsent(customerId, profileId);
    expect(view).toEqual({
      consent: "WITHDRAWN",
      withdrawnAt: now.toISOString(),
    });

    const { rows } = await pool.query(
      "SELECT data_consent_accepted, consent_withdrawn_at FROM patient_profiles WHERE id = $1",
      [profileId],
    );
    expect(rows[0].data_consent_accepted).toBe(false);
    expect(new Date(rows[0].consent_withdrawn_at).toISOString()).toBe(
      now.toISOString(),
    );

    const denied = await errorOf(() =>
      assertRecordAccess(pool, { bookingId, nurseId }, { expiryHours: 12 }),
    );
    expect(denied.details).toEqual({ reason: "CONSENT_WITHDRAWN" });
    const noBooking = await errorOf(() => assertConsentActive(pool, profileId));
    expect(noBooking.code).toBe("CONSENT_REQUIRED");
  });

  it("rút lần 2: 409 CONSENT_ALREADY_WITHDRAWN, thời điểm rút lần đầu giữ nguyên", async () => {
    const first = new Date();
    await service(first).withdrawConsent(customerId, profileId);
    const err = await errorOf(() =>
      service(new Date(first.getTime() + HOUR)).withdrawConsent(
        customerId,
        profileId,
      ),
    );
    expect(err.status).toBe(409);
    expect(err.code).toBe("CONSENT_ALREADY_WITHDRAWN");
    const { rows } = await pool.query(
      "SELECT consent_withdrawn_at FROM patient_profiles WHERE id = $1",
      [profileId],
    );
    expect(new Date(rows[0].consent_withdrawn_at).toISOString()).toBe(
      first.toISOString(),
    );
  });

  it("không phải chủ hồ sơ: 403 FORBIDDEN, hồ sơ không bị đổi", async () => {
    const stranger = await createTestUser(pool);
    const err = await errorOf(() =>
      service(new Date()).withdrawConsent(stranger, profileId),
    );
    expect(err.status).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
    const { rows } = await pool.query(
      "SELECT data_consent_accepted FROM patient_profiles WHERE id = $1",
      [profileId],
    );
    expect(rows[0].data_consent_accepted).toBe(true);
  });

  it("hồ sơ đã xóa mềm hoặc không tồn tại: 403 FORBIDDEN", async () => {
    await pool.query(
      "UPDATE patient_profiles SET deleted_at = now() WHERE id = $1",
      [profileId],
    );
    for (const id of [profileId, randomUUID()]) {
      const err = await errorOf(() =>
        service(new Date()).withdrawConsent(customerId, id),
      );
      expect(err.status).toBe(403);
      expect(err.code).toBe("FORBIDDEN");
    }
  });
});
