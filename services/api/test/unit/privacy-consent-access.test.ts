import { describe, it, expect } from "vitest";
import { decideRecordAccess } from "../../src/modules/privacy-consent/privacy-consent.policy";
import type { RecordAccessFacts } from "../../src/modules/privacy-consent/privacy-consent.types";

const NURSE = "20000000-0000-0000-0000-00000000000a";
const OTHER_NURSE = "20000000-0000-0000-0000-00000000000b";
const PROFILE = "30000000-0000-0000-0000-000000000001";
const EXPIRY_HOURS = 12;
const CHECKOUT = new Date("2026-11-03T10:00:00.000Z");
const HOUR = 60 * 60 * 1000;

function facts(overrides: Partial<RecordAccessFacts> = {}): RecordAccessFacts {
  return {
    bookingId: "40000000-0000-0000-0000-000000000001",
    assignedNurseId: NURSE,
    executionStatus: "CONFIRMED",
    patientProfileId: PROFILE,
    consentActive: true,
    profileDeleted: false,
    checkoutTime: null,
    grantUntil: null,
    ...overrides,
  };
}

const at = (ms: number) => new Date(CHECKOUT.getTime() + ms);

describe("decideRecordAccess — cửa sổ xem bệnh án (unit)", () => {
  it("CONFIRMED và IN_PROGRESS: điều dưỡng được giao xem được, chưa có hạn kết thúc", () => {
    for (const status of ["CONFIRMED", "IN_PROGRESS"]) {
      const r = decideRecordAccess(
        facts({ executionStatus: status }),
        NURSE,
        EXPIRY_HOURS,
        CHECKOUT,
      );
      expect(r).toEqual({
        allowed: true,
        patientProfileId: PROFILE,
        basis: "ACTIVE_BOOKING",
        accessUntil: null,
      });
    }
  });

  it("điều dưỡng KHÁC luôn bị chặn NOT_ASSIGNED, kể cả khi ca đang diễn ra", () => {
    const r = decideRecordAccess(
      facts({ executionStatus: "IN_PROGRESS" }),
      OTHER_NURSE,
      EXPIRY_HOURS,
      CHECKOUT,
    );
    expect(r).toEqual({ allowed: false, reason: "NOT_ASSIGNED" });
  });

  it("chưa có điều dưỡng được giao (nurse_id NULL): NOT_ASSIGNED", () => {
    const r = decideRecordAccess(
      facts({ assignedNurseId: null }),
      NURSE,
      EXPIRY_HOURS,
      CHECKOUT,
    );
    expect(r).toEqual({ allowed: false, reason: "NOT_ASSIGNED" });
  });

  it("rút đồng ý hoặc hồ sơ đã xóa: CONSENT_WITHDRAWN", () => {
    expect(
      decideRecordAccess(
        facts({ consentActive: false }),
        NURSE,
        EXPIRY_HOURS,
        CHECKOUT,
      ),
    ).toEqual({
      allowed: false,
      reason: "CONSENT_WITHDRAWN",
    });
    expect(
      decideRecordAccess(
        facts({ profileDeleted: true }),
        NURSE,
        EXPIRY_HOURS,
        CHECKOUT,
      ),
    ).toEqual({
      allowed: false,
      reason: "CONSENT_WITHDRAWN",
    });
  });

  it("COMPLETED: 11h59m sau check-out vẫn xem được, hạn = check-out + 12h", () => {
    const r = decideRecordAccess(
      facts({ executionStatus: "COMPLETED", checkoutTime: CHECKOUT }),
      NURSE,
      EXPIRY_HOURS,
      at(12 * HOUR - 60_000),
    );
    expect(r).toEqual({
      allowed: true,
      patientProfileId: PROFILE,
      basis: "POST_CHECKOUT_WINDOW",
      accessUntil: at(12 * HOUR),
    });
  });

  it("COMPLETED: đúng 12h00 sau check-out là bị khóa (WINDOW_CLOSED)", () => {
    const r = decideRecordAccess(
      facts({ executionStatus: "COMPLETED", checkoutTime: CHECKOUT }),
      NURSE,
      EXPIRY_HOURS,
      at(12 * HOUR),
    );
    expect(r).toEqual({ allowed: false, reason: "WINDOW_CLOSED" });
  });

  it("số giờ lấy từ cấu hình: đổi thành 6h thì 6h01 đã bị khóa", () => {
    const r = decideRecordAccess(
      facts({ executionStatus: "COMPLETED", checkoutTime: CHECKOUT }),
      NURSE,
      6,
      at(6 * HOUR + 60_000),
    );
    expect(r).toEqual({ allowed: false, reason: "WINDOW_CLOSED" });
  });

  it("CANCELLED / EXPIRED (không có quyền cấp lại): WINDOW_CLOSED", () => {
    for (const status of ["CANCELLED", "EXPIRED", "DRAFT", "MATCHING"]) {
      const r = decideRecordAccess(
        facts({ executionStatus: status }),
        NURSE,
        EXPIRY_HOURS,
        CHECKOUT,
      );
      expect(r).toEqual({ allowed: false, reason: "WINDOW_CLOSED" });
    }
  });

  it("quá 12h nhưng Admin đã cấp lại quyền còn hạn: ADMIN_GRANT", () => {
    const grantUntil = at(30 * HOUR);
    const r = decideRecordAccess(
      facts({
        executionStatus: "COMPLETED",
        checkoutTime: CHECKOUT,
        grantUntil,
      }),
      NURSE,
      EXPIRY_HOURS,
      at(20 * HOUR),
    );
    expect(r).toEqual({
      allowed: true,
      patientProfileId: PROFILE,
      basis: "ADMIN_GRANT",
      accessUntil: grantUntil,
    });
  });

  it("quyền cấp lại hết hạn đúng lúc expires_at", () => {
    const grantUntil = at(30 * HOUR);
    const r = decideRecordAccess(
      facts({
        executionStatus: "COMPLETED",
        checkoutTime: CHECKOUT,
        grantUntil,
      }),
      NURSE,
      EXPIRY_HOURS,
      grantUntil,
    );
    expect(r).toEqual({ allowed: false, reason: "WINDOW_CLOSED" });
  });

  it("quyền cấp lại KHÔNG vượt qua việc rút đồng ý", () => {
    const r = decideRecordAccess(
      facts({
        executionStatus: "COMPLETED",
        checkoutTime: CHECKOUT,
        grantUntil: at(30 * HOUR),
        consentActive: false,
      }),
      NURSE,
      EXPIRY_HOURS,
      at(20 * HOUR),
    );
    expect(r).toEqual({ allowed: false, reason: "CONSENT_WITHDRAWN" });
  });

  it("cả cửa sổ 12h và quyền cấp lại cùng còn: báo cái hết hạn muộn hơn", () => {
    const grantUntil = at(15 * HOUR);
    const r = decideRecordAccess(
      facts({
        executionStatus: "COMPLETED",
        checkoutTime: CHECKOUT,
        grantUntil,
      }),
      NURSE,
      EXPIRY_HOURS,
      at(1 * HOUR),
    );
    expect(r).toMatchObject({
      allowed: true,
      basis: "ADMIN_GRANT",
      accessUntil: grantUntil,
    });
  });
});
