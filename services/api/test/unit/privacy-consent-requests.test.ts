import { describe, it, expect } from "vitest";
import { AppError } from "../../src/core/errors";
import {
  createPrivacyRequestBodySchema,
  decidePrivacyRequestBodySchema,
  listPrivacyRequestsQuerySchema,
} from "../../src/modules/privacy-consent/privacy-consent.schema";
import { PrivacyConsentService } from "../../src/modules/privacy-consent/privacy-consent.service";

const CUSTOMER = "10000000-0000-0000-0000-000000000001";
const ADMIN = "10000000-0000-0000-0000-0000000000ad";

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

describe("privacy-requests — kiểm tra đầu vào (unit)", () => {
  it("POST body: chỉ nhận DELETE / ANONYMIZE và UUID, không nhận trường lạ", () => {
    const ok = createPrivacyRequestBodySchema.safeParse({
      patientProfileId: CUSTOMER,
      requestType: "ANONYMIZE",
    });
    expect(ok.success).toBe(true);
    expect(
      createPrivacyRequestBodySchema.safeParse({
        patientProfileId: CUSTOMER,
        requestType: "EXPORT",
      }).success,
    ).toBe(false);
    expect(
      createPrivacyRequestBodySchema.safeParse({
        patientProfileId: "abc",
        requestType: "DELETE",
      }).success,
    ).toBe(false);
    expect(
      createPrivacyRequestBodySchema.safeParse({
        patientProfileId: CUSTOMER,
        requestType: "DELETE",
        status: "DONE",
      }).success,
    ).toBe(false);
  });

  it("GET admin query: mặc định limit 20 offset 0; limit chỉ 1–100", () => {
    const d = listPrivacyRequestsQuerySchema.safeParse({});
    expect(d.success && d.data).toEqual({ limit: 20, offset: 0 });
    const q = listPrivacyRequestsQuerySchema.safeParse({
      status: "PENDING",
      limit: "5",
      offset: "10",
    });
    expect(q.success && q.data).toEqual({
      status: "PENDING",
      limit: 5,
      offset: 10,
    });
    for (const limit of ["0", "101", "abc"]) {
      expect(listPrivacyRequestsQuerySchema.safeParse({ limit }).success).toBe(
        false,
      );
    }
    expect(
      listPrivacyRequestsQuerySchema.safeParse({ status: "OPEN" }).success,
    ).toBe(false);
  });

  it("PATCH body: decision chỉ DONE / REJECTED, note tối đa 500 ký tự", () => {
    expect(
      decidePrivacyRequestBodySchema.safeParse({ decision: "DONE" }).success,
    ).toBe(true);
    expect(
      decidePrivacyRequestBodySchema.safeParse({
        decision: "REJECTED",
        note: "Không đủ căn cứ",
      }).success,
    ).toBe(true);
    expect(
      decidePrivacyRequestBodySchema.safeParse({ decision: "PENDING" }).success,
    ).toBe(false);
    expect(
      decidePrivacyRequestBodySchema.safeParse({
        decision: "DONE",
        note: "x".repeat(501),
      }).success,
    ).toBe(false);
  });

  it("createPrivacyRequest: profileId sai định dạng → 403 FORBIDDEN, không chạm DB", async () => {
    const { service, dbCalls } = serviceWithoutDb();
    const err = await errorOf(() =>
      service.createPrivacyRequest(CUSTOMER, "abc", "DELETE"),
    );
    expect(err.status).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
    expect(dbCalls()).toBe(0);
  });

  it("decidePrivacyRequest: requestId sai định dạng → 404 REQUEST_NOT_FOUND, không chạm DB", async () => {
    const { service, dbCalls } = serviceWithoutDb();
    const err = await errorOf(() =>
      service.decidePrivacyRequest(ADMIN, "abc", "DONE", null, null),
    );
    expect(err.status).toBe(404);
    expect(err.code).toBe("REQUEST_NOT_FOUND");
    expect(dbCalls()).toBe(0);
  });
});
