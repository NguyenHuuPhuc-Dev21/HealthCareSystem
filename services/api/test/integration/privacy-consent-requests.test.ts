import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "vitest";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { runInTransaction } from "../../src/core/database";
import { AppError } from "../../src/core/errors";
import {
  PrivacyConsentService,
  assertConsentActive,
  captureConsent,
} from "../../src/modules/privacy-consent/privacy-consent.service";
import { createTestPool, createTestUser, findOrCreateAdmin } from "./helpers";

/**
 * Yêu cầu xóa / ẩn danh dữ liệu (contract §4) trên PostgreSQL thật.
 * (User, hồ sơ, booking test không bị xóa: audit_logs / bookings tham chiếu tới họ.)
 */
describe("privacy-consent — yêu cầu xóa / ẩn danh (integration)", () => {
  let pool: Pool;
  let adminId: string;
  let customerId: string;
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

  async function createProfile(ownerId: string): Promise<string> {
    const c = captureConsent({
      accepted: true,
      ip: "203.0.113.7",
      deviceId: "web",
    });
    const { rows } = await pool.query(
      `INSERT INTO patient_profiles
         (customer_id, full_name, dob, gender, weight_kg, medical_history, address_text, location_type, lat, lng,
          data_consent_accepted, consent_timestamp, consent_ip, consent_device_id)
       VALUES ($1, 'Lê Thị D', '1950-01-15', 'FEMALE', 55.5, 'Tiểu đường', '12 Lê Lợi, Q.1', 'HOME', 10.77, 106.69,
               $2, $3, $4, $5)
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
    profileId = await createProfile(customerId);
  });

  afterEach(async () => {
    // Keep the shared DB tidy: requests are plain records (no audit/ledger references them).
    await pool.query("DELETE FROM privacy_requests WHERE customer_id = $1", [
      customerId,
    ]);
  });

  async function createBookingWithDispute(
    disputeStatus: string,
  ): Promise<string> {
    const start = new Date(Date.now() - 30 * HOUR);
    const { rows } = await pool.query(
      `INSERT INTO bookings
         (booking_code, customer_id, patient_profile_id, service_id, matching_mode, payment_method,
          start_time, end_time, base_amount, total_amount, execution_status)
       VALUES ($1, $2, $3, $4, 'JOB_BOARD', 'BANK_TRANSFER', $5, $6, 350000, 350000, 'COMPLETED')
       RETURNING id`,
      [
        `T-${randomUUID().slice(0, 12)}`,
        customerId,
        profileId,
        serviceId,
        start,
        new Date(start.getTime() + 4 * HOUR),
      ],
    );
    await pool.query(
      `INSERT INTO disputes (booking_id, raised_by_id, reason_code, description, status)
       VALUES ($1, $2, 'QUALITY', 'Khiếu nại test', $3)`,
      [rows[0].id, customerId, disputeStatus],
    );
    return rows[0].id;
  }

  function service(now: Date = new Date()) {
    return new PrivacyConsentService({
      withTx: (fn) => runInTransaction(pool, fn),
      downloadUrl: async (key) => `https://signed.example/${key}`,
      recordAccessExpiryHours: async () => 12,
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

  async function deleteAuditCount(): Promise<number> {
    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM audit_logs WHERE action_type = 'DELETE_PATIENT_DATA' AND target_id = $1",
      [profileId],
    );
    return Number(rows[0].n);
  }

  async function profileRow() {
    const { rows } = await pool.query(
      `SELECT full_name, dob, gender, weight_kg, medical_history, address_text, lat, lng,
              consent_ip, consent_device_id, deleted_at
         FROM patient_profiles WHERE id = $1`,
      [profileId],
    );
    return rows[0];
  }

  // ---- PATIENT ---------------------------------------------------------------

  it("chủ hồ sơ tạo yêu cầu: PENDING, lưu đúng loại; tạo lần 2 khi còn PENDING → 409 REQUEST_ALREADY_PENDING", async () => {
    const created = await service().createPrivacyRequest(
      customerId,
      profileId,
      "ANONYMIZE",
    );
    expect(created.status).toBe("PENDING");
    const { rows } = await pool.query(
      "SELECT customer_id, patient_profile_id, request_type, status FROM privacy_requests WHERE id = $1",
      [created.requestId],
    );
    expect(rows[0]).toEqual({
      customer_id: customerId,
      patient_profile_id: profileId,
      request_type: "ANONYMIZE",
      status: "PENDING",
    });

    const err = await errorOf(() =>
      service().createPrivacyRequest(customerId, profileId, "DELETE"),
    );
    expect(err.status).toBe(409);
    expect(err.code).toBe("REQUEST_ALREADY_PENDING");
  });

  it("không phải chủ hồ sơ / hồ sơ không tồn tại: 403 FORBIDDEN, không tạo gì", async () => {
    const stranger = await createTestUser(pool);
    for (const [user, id] of [
      [stranger, profileId],
      [customerId, randomUUID()],
    ]) {
      const err = await errorOf(() =>
        service().createPrivacyRequest(user, id, "DELETE"),
      );
      expect(err.status).toBe(403);
      expect(err.code).toBe("FORBIDDEN");
    }
    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM privacy_requests WHERE patient_profile_id = $1",
      [profileId],
    );
    expect(Number(rows[0].n)).toBe(0);
  });

  it("GET /privacy-requests: chỉ thấy yêu cầu của mình, mới nhất trước", async () => {
    const secondProfile = await createProfile(customerId);
    const a = await service(new Date(Date.now() - HOUR)).createPrivacyRequest(
      customerId,
      profileId,
      "DELETE",
    );
    const b = await service().createPrivacyRequest(
      customerId,
      secondProfile,
      "ANONYMIZE",
    );
    await pool.query(
      "UPDATE privacy_requests SET created_at = now() - interval '1 hour' WHERE id = $1",
      [a.requestId],
    );

    const stranger = await createTestUser(pool);
    expect(await service().listMyPrivacyRequests(stranger)).toEqual([]);

    const mine = await service().listMyPrivacyRequests(customerId);
    expect(mine.map((r) => r.requestId)).toEqual([b.requestId, a.requestId]);
    expect(mine[0]).toMatchObject({
      customerId,
      patientProfileId: secondProfile,
      requestType: "ANONYMIZE",
      status: "PENDING",
      processedAt: null,
    });
  });

  // ---- ADMIN -----------------------------------------------------------------

  it("GET /admin/privacy-requests: lọc theo status, có total và phân trang", async () => {
    const created = await service().createPrivacyRequest(
      customerId,
      profileId,
      "DELETE",
    );
    const first = await service().listPrivacyRequests({
      status: "PENDING",
      limit: 1,
      offset: 0,
    });
    expect(first.total).toBeGreaterThan(0);
    expect(first.items.length).toBe(1);
    expect(first.items.every((r) => r.status === "PENDING")).toBe(true);

    // Oldest first: the request created last is on the last page.
    const last = await service().listPrivacyRequests({
      status: "PENDING",
      limit: 1,
      offset: first.total - 1,
    });
    expect(last.items[0].requestId).toBe(created.requestId);
    expect(last).toMatchObject({
      limit: 1,
      offset: first.total - 1,
      total: first.total,
    });
  });

  it("Admin DONE: ẩn danh hồ sơ, ghi audit DELETE_PATIENT_DATA, yêu cầu thành DONE; booking vẫn còn", async () => {
    const bookingId = await createBookingWithDispute("RESOLVED_CUSTOMER"); // khiếu nại đã đóng → không chặn
    const { requestId } = await service().createPrivacyRequest(
      customerId,
      profileId,
      "DELETE",
    );
    const now = new Date();

    const result = await service(now).decidePrivacyRequest(
      adminId,
      requestId,
      "DONE",
      "Khách yêu cầu qua hotline",
      "198.51.100.30",
    );
    expect(result).toEqual({ requestId, status: "DONE" });

    expect(await profileRow()).toMatchObject({
      full_name: "Đã ẩn danh",
      dob: null,
      weight_kg: null,
      medical_history: null,
      address_text: null,
      lat: null,
      lng: null,
      consent_ip: null,
      consent_device_id: null,
    });
    expect(new Date((await profileRow()).deleted_at).toISOString()).toBe(
      now.toISOString(),
    );

    const req = await pool.query(
      "SELECT status, processed_by, processed_at FROM privacy_requests WHERE id = $1",
      [requestId],
    );
    expect(req.rows[0].status).toBe("DONE");
    expect(req.rows[0].processed_by).toBe(adminId);
    expect(new Date(req.rows[0].processed_at).toISOString()).toBe(
      now.toISOString(),
    );

    const audit = await pool.query(
      `SELECT actor_id, target_table, ip_address, new_value FROM audit_logs
        WHERE action_type = 'DELETE_PATIENT_DATA' AND target_id = $1`,
      [profileId],
    );
    expect(audit.rows.length).toBe(1);
    expect(audit.rows[0]).toMatchObject({
      actor_id: adminId,
      target_table: "patient_profiles",
      ip_address: "198.51.100.30",
      new_value: {
        requestId,
        requestType: "DELETE",
        note: "Khách yêu cầu qua hotline",
      },
    });

    const booking = await pool.query("SELECT id FROM bookings WHERE id = $1", [
      bookingId,
    ]);
    expect(booking.rows.length).toBe(1); // hồ sơ tài chính giữ nguyên
    const gone = await errorOf(() => assertConsentActive(pool, profileId));
    expect(gone.code).toBe("PATIENT_PROFILE_NOT_FOUND"); // không đặt lịch được nữa
    const again = await errorOf(() =>
      service().createPrivacyRequest(customerId, profileId, "DELETE"),
    );
    expect(again.code).toBe("FORBIDDEN"); // hồ sơ đã xóa thì không truy cập được nữa
  });

  it("còn khiếu nại OPEN / UNDER_REVIEW: DONE bị 409 PROFILE_UNDER_DISPUTE, không đổi gì", async () => {
    for (const status of ["OPEN", "UNDER_REVIEW"]) {
      await pool.query("DELETE FROM privacy_requests WHERE customer_id = $1", [
        customerId,
      ]);
      // Close earlier disputes so each status is tested on its own.
      await pool.query(
        "UPDATE disputes SET status = 'RESOLVED_NURSE' WHERE booking_id IN (SELECT id FROM bookings WHERE patient_profile_id = $1)",
        [profileId],
      );
      await createBookingWithDispute(status);
      const { requestId } = await service().createPrivacyRequest(
        customerId,
        profileId,
        "ANONYMIZE",
      );
      const err = await errorOf(() =>
        service().decidePrivacyRequest(adminId, requestId, "DONE", null, null),
      );
      expect(err.status).toBe(409);
      expect(err.code).toBe("PROFILE_UNDER_DISPUTE");

      expect((await profileRow()).full_name).toBe("Lê Thị D");
      expect((await profileRow()).deleted_at).toBeNull();
      const req = await pool.query(
        "SELECT status FROM privacy_requests WHERE id = $1",
        [requestId],
      );
      expect(req.rows[0].status).toBe("PENDING");
      expect(await deleteAuditCount()).toBe(0);
    }
  });

  it("Admin REJECTED: yêu cầu thành REJECTED, hồ sơ giữ nguyên, không audit; xử lý lần 2 → 409 REQUEST_NOT_PENDING", async () => {
    const { requestId } = await service().createPrivacyRequest(
      customerId,
      profileId,
      "DELETE",
    );
    const result = await service().decidePrivacyRequest(
      adminId,
      requestId,
      "REJECTED",
      "Thiếu xác minh",
      null,
    );
    expect(result).toEqual({ requestId, status: "REJECTED" });
    expect((await profileRow()).full_name).toBe("Lê Thị D");
    expect(await deleteAuditCount()).toBe(0);

    const err = await errorOf(() =>
      service().decidePrivacyRequest(adminId, requestId, "DONE", null, null),
    );
    expect(err.status).toBe(409);
    expect(err.code).toBe("REQUEST_NOT_PENDING");
    expect((await profileRow()).deleted_at).toBeNull();
  });

  it("yêu cầu không tồn tại: 404 REQUEST_NOT_FOUND", async () => {
    const err = await errorOf(() =>
      service().decidePrivacyRequest(adminId, randomUUID(), "DONE", null, null),
    );
    expect(err.status).toBe(404);
    expect(err.code).toBe("REQUEST_NOT_FOUND");
  });
});
