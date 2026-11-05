import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { runInTransaction } from "../../src/core/database";
import { captureConsent } from "../../src/modules/privacy-consent/privacy-consent.service";
import { runRetentionSweep } from "../../src/modules/privacy-consent/privacy-consent.jobs";
import { createTestPool, createTestUser } from "./helpers";

/**
 * Job privacy.retention-sweep (NFR-PRIV-02) trên PostgreSQL thật.
 * Dùng giờ thật và check-out cách đây 25 / 23 tháng, nên không đụng dữ liệu của các test khác
 * (các test khác chỉ có check-out gần đây). Kiểm tra theo từng hồ sơ, không theo tổng số.
 */
describe("privacy-consent — job dọn dữ liệu quá hạn lưu trữ (integration)", () => {
  let pool: Pool;
  let customerId: string;
  let serviceId: string;
  const now = new Date();

  beforeAll(async () => {
    pool = createTestPool();
    const { rows } = await pool.query(
      "SELECT id FROM service_categories ORDER BY code LIMIT 1",
    );
    serviceId = rows[0].id;
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    customerId = await createTestUser(pool);
  });

  function monthsAgo(months: number): Date {
    const d = new Date(now);
    d.setMonth(d.getMonth() - months);
    return d;
  }

  async function createProfile(): Promise<string> {
    const c = captureConsent({
      accepted: true,
      ip: "203.0.113.7",
      deviceId: "web",
    });
    const { rows } = await pool.query(
      `INSERT INTO patient_profiles
         (customer_id, full_name, dob, medical_history, address_text, location_type,
          data_consent_accepted, consent_timestamp, consent_ip, consent_device_id)
       VALUES ($1, 'Phạm Văn E', '1945-03-03', 'Suy tim', '5 Hai Bà Trưng', 'HOME', $2, $3, $4, $5)
       RETURNING id`,
      [
        customerId,
        c.data_consent_accepted,
        c.consent_timestamp,
        c.consent_ip,
        c.consent_device_id,
      ],
    );
    return rows[0].id;
  }

  async function addBooking(
    profileId: string,
    status: string,
    checkoutTime: Date | null,
  ): Promise<string> {
    const start = checkoutTime
      ? new Date(checkoutTime.getTime() - 4 * 3600_000)
      : new Date(now.getTime() + 24 * 3600_000);
    const { rows } = await pool.query(
      `INSERT INTO bookings
         (booking_code, customer_id, patient_profile_id, service_id, matching_mode, payment_method,
          start_time, end_time, base_amount, total_amount, execution_status)
       VALUES ($1, $2, $3, $4, 'JOB_BOARD', 'BANK_TRANSFER', $5, $6, 350000, 350000, $7)
       RETURNING id`,
      [
        `T-${randomUUID().slice(0, 12)}`,
        customerId,
        profileId,
        serviceId,
        start,
        new Date(start.getTime() + 4 * 3600_000),
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

  function sweep(retentionMonths = 24) {
    return runRetentionSweep({
      withTx: (fn) => runInTransaction(pool, fn),
      retentionMonths: async () => retentionMonths,
      now: () => now,
      batchSize: 2, // nhỏ để chạy qua nhiều lượt quét
    });
  }

  async function state(profileId: string) {
    const { rows } = await pool.query(
      "SELECT full_name, dob, medical_history, address_text, deleted_at FROM patient_profiles WHERE id = $1",
      [profileId],
    );
    return rows[0];
  }

  async function sweepAudits(profileId: string) {
    const { rows } = await pool.query(
      `SELECT actor_id, target_table, new_value FROM audit_logs
        WHERE action_type = 'DELETE_PATIENT_DATA' AND target_id = $1`,
      [profileId],
    );
    return rows;
  }

  it("MEDICAL_RECORD_RETENTION_MONTHS trong system_configs là 24", async () => {
    const { rows } = await pool.query(
      "SELECT config_value FROM system_configs WHERE config_key = 'MEDICAL_RECORD_RETENTION_MONTHS'",
    );
    expect(rows[0].config_value).toBe("24");
  });

  it("check-out gần nhất quá 24 tháng: ẩn danh + audit DELETE_PATIENT_DATA (actor NULL); chạy lại không làm gì thêm", async () => {
    const old = await createProfile();
    const lastCheckout = monthsAgo(25);
    await addBooking(old, "COMPLETED", monthsAgo(30));
    await addBooking(old, "COMPLETED", lastCheckout);

    await sweep();
    expect(await state(old)).toMatchObject({
      full_name: "Đã ẩn danh",
      dob: null,
      medical_history: null,
      address_text: null,
    });
    expect(new Date((await state(old)).deleted_at).toISOString()).toBe(
      now.toISOString(),
    );

    const audits = await sweepAudits(old);
    expect(audits.length).toBe(1);
    expect(audits[0]).toMatchObject({
      actor_id: null,
      target_table: "patient_profiles",
      new_value: {
        reason: "RETENTION_EXPIRED",
        retentionMonths: 24,
        lastCheckoutAt: lastCheckout.toISOString(),
      },
    });

    await sweep(); // idempotent
    expect((await sweepAudits(old)).length).toBe(1);
  });

  it("KHÔNG ẩn danh: check-out gần nhất mới 23 tháng, hoặc chưa từng check-out", async () => {
    const recent = await createProfile();
    await addBooking(recent, "COMPLETED", monthsAgo(30));
    await addBooking(recent, "COMPLETED", monthsAgo(23)); // ca gần nhất mới 23 tháng
    const never = await createProfile();
    await addBooking(never, "CANCELLED", null);

    await sweep();
    for (const id of [recent, never]) {
      expect((await state(id)).deleted_at).toBeNull();
      expect((await state(id)).full_name).toBe("Phạm Văn E");
      expect((await sweepAudits(id)).length).toBe(0);
    }
  });

  it("KHÔNG ẩn danh: còn khiếu nại OPEN / UNDER_REVIEW, hoặc còn ca sắp tới", async () => {
    const disputed = await createProfile();
    const b = await addBooking(disputed, "COMPLETED", monthsAgo(25));
    await pool.query(
      `INSERT INTO disputes (booking_id, raised_by_id, reason_code, description, status)
       VALUES ($1, $2, 'QUALITY', 'Khiếu nại test', 'UNDER_REVIEW')`,
      [b, customerId],
    );
    const upcoming = await createProfile();
    await addBooking(upcoming, "COMPLETED", monthsAgo(25));
    await addBooking(upcoming, "CONFIRMED", null); // ca sắp tới

    await sweep();
    for (const id of [disputed, upcoming]) {
      expect((await state(id)).deleted_at).toBeNull();
      expect((await sweepAudits(id)).length).toBe(0);
    }
  });

  it("số tháng lấy từ cấu hình: đặt 30 tháng thì hồ sơ 25 tháng vẫn được giữ", async () => {
    const p = await createProfile();
    await addBooking(p, "COMPLETED", monthsAgo(25));
    await sweep(30);
    expect((await state(p)).deleted_at).toBeNull();
    await sweep(24);
    expect((await state(p)).deleted_at).not.toBeNull();
  });
});
