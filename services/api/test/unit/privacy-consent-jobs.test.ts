import { describe, it, expect } from "vitest";
import {
  RETENTION_SWEEP_JOB,
  registerPrivacyConsentJobs,
  type RecurringJobRegistry,
} from "../../src/modules/privacy-consent/privacy-consent.jobs";

function fakeQueue() {
  const handlers = new Map<string, () => Promise<void>>();
  const schedules: Array<{
    id: string;
    repeat: { pattern: string; tz?: string };
    jobName: string;
  }> = [];
  const queue: RecurringJobRegistry = {
    registerHandler: (name, handler) => {
      handlers.set(name, handler);
    },
    scheduleRecurring: async (id, repeat, jobName) => {
      schedules.push({ id, repeat, jobName });
    },
  };
  return { queue, handlers, schedules };
}

describe("privacy-consent jobs — đăng ký trên hàng đợi chung (unit)", () => {
  it("đăng ký handler privacy.retention-sweep và lịch chạy hằng ngày 03:00 giờ Việt Nam", async () => {
    const { queue, handlers, schedules } = fakeQueue();
    await registerPrivacyConsentJobs(queue, async () => ({
      anonymized: 0,
      skipped: 0,
    }));
    expect(RETENTION_SWEEP_JOB).toBe("privacy.retention-sweep");
    expect([...handlers.keys()]).toEqual(["privacy.retention-sweep"]);
    expect(schedules).toEqual([
      {
        id: "privacy.retention-sweep",
        repeat: { pattern: "0 3 * * *", tz: "Asia/Ho_Chi_Minh" },
        jobName: "privacy.retention-sweep",
      },
    ]);
  });

  it("khi job chạy, handler gọi đúng hàm sweep", async () => {
    const { queue, handlers } = fakeQueue();
    let calls = 0;
    await registerPrivacyConsentJobs(queue, async () => {
      calls += 1;
      return { anonymized: 2, skipped: 1 };
    });
    await handlers.get("privacy.retention-sweep")!();
    expect(calls).toBe(1);
  });
});
