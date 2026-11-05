import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "vitest";
import type { Pool } from "pg";
import { AppError } from "../../src/core/errors";
import {
  assertConsentActive,
  captureConsent,
} from "../../src/modules/privacy-consent/privacy-consent.service";
import { createTestPool, createTestUser } from "./helpers";

/**
 * Chạy trên PostgreSQL thật: chứng minh các cột do captureConsent tạo ra
 * ghi được vào patient_profiles (kể cả CHECK consent_timestamp) và
 * assertConsentActive đọc đúng trạng thái.
 */
describe("privacy-consent với PostgreSQL thật (integration)", () => {
  let pool: Pool;
  let customerId: string;

  beforeAll(() => {
    pool = createTestPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    customerId = await createTestUser(pool);
  });

  afterEach(async () => {
    await pool.query("DELETE FROM patient_profiles WHERE customer_id = $1", [
      customerId,
    ]);
    await pool.query("DELETE FROM users WHERE id = $1", [customerId]);
  });

  /** Mô phỏng cách BE-2 (patient-profiles) dùng captureConsent khi INSERT. */
  async function createProfile(): Promise<string> {
    const c = captureConsent({
      accepted: true,
      ip: "203.0.113.7",
      deviceId: "android-test",
    });
    const { rows } = await pool.query(
      `INSERT INTO patient_profiles
         (customer_id, full_name, location_type,
          data_consent_accepted, consent_timestamp, consent_ip, consent_device_id)
       VALUES ($1, 'Bệnh nhân test', 'HOME', $2, $3, $4, $5)
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

  async function errorOf(fn: () => Promise<unknown>): Promise<AppError> {
    try {
      await fn();
    } catch (err) {
      if (err instanceof AppError) return err;
      throw err;
    }
    throw new Error("expected an AppError");
  }

  it("cột từ captureConsent ghi được vào DB và lưu đủ IP, thiết bị", async () => {
    const id = await createProfile();
    const { rows } = await pool.query(
      "SELECT data_consent_accepted, consent_timestamp IS NOT NULL AS has_ts, consent_ip, consent_device_id FROM patient_profiles WHERE id = $1",
      [id],
    );
    expect(rows[0]).toEqual({
      data_consent_accepted: true,
      has_ts: true,
      consent_ip: "203.0.113.7",
      consent_device_id: "android-test",
    });
    await assertConsentActive(pool, id); // không ném lỗi
  });

  it('DB tự chặn hồ sơ "đã đồng ý" mà thiếu consent_timestamp (CHECK constraint)', async () => {
    await expect(
      pool.query(
        `INSERT INTO patient_profiles (customer_id, full_name, location_type, data_consent_accepted)
         VALUES ($1, 'x', 'HOME', TRUE)`,
        [customerId],
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it("rút đồng ý thì 403 CONSENT_REQUIRED", async () => {
    const id = await createProfile();
    // Rút đồng ý đúng quy ước của migration 0006: FALSE + ghi thời điểm rút
    await pool.query(
      "UPDATE patient_profiles SET data_consent_accepted = FALSE, consent_withdrawn_at = now() WHERE id = $1",
      [id],
    );
    const err = await errorOf(() => assertConsentActive(pool, id));
    expect(err.status).toBe(403);
    expect(err.code).toBe("CONSENT_REQUIRED");
  });

  it("hồ sơ đã xóa mềm thì 404", async () => {
    const id = await createProfile();
    await pool.query(
      "UPDATE patient_profiles SET deleted_at = now() WHERE id = $1",
      [id],
    );
    const err = await errorOf(() => assertConsentActive(pool, id));
    expect(err.status).toBe(404);
  });
});
