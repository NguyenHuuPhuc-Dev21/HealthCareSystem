import { describe, it, expect } from "vitest";
import { AppError } from "../../src/core/errors";
import { checkGrantExpiry } from "../../src/modules/privacy-consent/privacy-consent.policy";
import { PrivacyConsentService } from "../../src/modules/privacy-consent/privacy-consent.service";

const NOW = new Date("2026-11-03T10:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const after = (ms: number) => new Date(NOW.getTime() + ms);

/** Service whose DB must never be touched: withTx throws if called. */
function serviceWithoutDb() {
  let dbCalls = 0;
  const service = new PrivacyConsentService({
    withTx: async () => {
      dbCalls += 1;
      throw new Error("DB must not be touched");
    },
    downloadUrl: async () => "unused",
    recordAccessExpiryHours: async () => 12,
    recordAccessGrantMaxHours: async () => 24,
    now: () => NOW,
  });
  return { service, dbCalls: () => dbCalls };
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

describe("checkGrantExpiry — thời hạn Admin cấp lại quyền (unit)", () => {
  it("trong khoảng (now, now + 24h] là hợp lệ, kể cả đúng 24h00", () => {
    expect(checkGrantExpiry(after(1), NOW, 24)).toBeNull();
    expect(checkGrantExpiry(after(2 * HOUR), NOW, 24)).toBeNull();
    expect(checkGrantExpiry(after(24 * HOUR), NOW, 24)).toBeNull();
  });

  it("bằng hoặc trước thời điểm hiện tại: NOT_IN_FUTURE", () => {
    expect(checkGrantExpiry(NOW, NOW, 24)).toBe("NOT_IN_FUTURE");
    expect(checkGrantExpiry(after(-HOUR), NOW, 24)).toBe("NOT_IN_FUTURE");
  });

  it("quá 24h dù chỉ 1 ms: EXCEEDS_MAX_HOURS", () => {
    expect(checkGrantExpiry(after(24 * HOUR + 1), NOW, 24)).toBe(
      "EXCEEDS_MAX_HOURS",
    );
  });

  it("số giờ lấy từ cấu hình: đổi thành 6h thì 6h01 bị từ chối", () => {
    expect(checkGrantExpiry(after(6 * HOUR + 60_000), NOW, 6)).toBe(
      "EXCEEDS_MAX_HOURS",
    );
  });
});

describe("PrivacyConsentService — kiểm tra đầu vào trước khi chạm DB (unit)", () => {
  it("grantRecordAccess: expiresAt quá hạn tối đa → 400 VALIDATION_ERROR, không chạm DB", async () => {
    const { service, dbCalls } = serviceWithoutDb();
    const err = await errorOf(() =>
      service.grantRecordAccess(
        "10000000-0000-0000-0000-000000000001",
        "40000000-0000-0000-0000-000000000001",
        {
          nurseId: "20000000-0000-0000-0000-00000000000a",
          reason: "Đối chiếu khiếu nại #D-1",
          expiresAt: after(25 * HOUR),
        },
        null,
      ),
    );
    expect(err.status).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.details).toEqual({
      field: "expiresAt",
      reason: "EXCEEDS_MAX_HOURS",
      maxHours: 24,
    });
    expect(dbCalls()).toBe(0);
  });

  it("grantRecordAccess: bookingId sai định dạng → 404 BOOKING_NOT_FOUND, không chạm DB", async () => {
    const { service, dbCalls } = serviceWithoutDb();
    const err = await errorOf(() =>
      service.grantRecordAccess(
        "10000000-0000-0000-0000-000000000001",
        "not-a-uuid",
        {
          nurseId: "20000000-0000-0000-0000-00000000000a",
          reason: "Đối chiếu khiếu nại #D-1",
          expiresAt: after(HOUR),
        },
        null,
      ),
    );
    expect(err.status).toBe(404);
    expect(err.code).toBe("BOOKING_NOT_FOUND");
    expect(dbCalls()).toBe(0);
  });

  it("withdrawConsent: profileId sai định dạng → 403 FORBIDDEN, không chạm DB", async () => {
    const { service, dbCalls } = serviceWithoutDb();
    const err = await errorOf(() =>
      service.withdrawConsent("10000000-0000-0000-0000-000000000001", "abc"),
    );
    expect(err.status).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
    expect(dbCalls()).toBe(0);
  });
});
