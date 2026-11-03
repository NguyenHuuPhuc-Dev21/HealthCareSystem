import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { JobScheduler } from "../../src/core/notifications";
/**
 * Integration test chạy trên PostgreSQL 16 thật đã chạy migration 0001.
 * CI: biến DATABASE_URL trỏ tới healthcare_test. Ở máy mình: Docker (healthcare_dev).
 */
export function createTestPool(): Pool {
  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgrespassword@localhost:5432/healthcare_dev";
  return new Pool({ connectionString, max: 5 });
}
/** Tạo 1 tài khoản PATIENT tạm thời, trả về id. */
export async function createTestUser(pool: Pool): Promise<string> {
  const phone = `09${Math.floor(Math.random() * 1e8)
    .toString()
    .padStart(8, "0")}`;
  const { rows } = await pool.query(
    `INSERT INTO users (phone, full_name, role, status) VALUES ($1, $2, 'PATIENT', 'ACTIVE') RETURNING id`,
    [phone, `Integration test ${randomUUID().slice(0, 8)}`],
  );
  return rows[0].id;
}

/** Xóa tài khoản tạm và các thông báo của nó. */
export async function deleteTestUser(
  pool: Pool,
  userId: string,
): Promise<void> {
  await pool.query("DELETE FROM notifications WHERE user_id = $1", [userId]);
  await pool.query("DELETE FROM users WHERE id = $1", [userId]);
}
interface ScheduledJob {
  jobName: string;
  payload: unknown;
  idempotencyKey: string;
  runAt: number;
  done: boolean;
}

/**
 * Hàng đợi giả có đồng hồ giả (test strategy: thời gian là biến của test,
 * không bao giờ sleep thật). Job chỉ chạy khi test "tua" đồng hồ qua giờ hẹn.
 */
export class FakeClockScheduler implements JobScheduler {
  now = 0;
  readonly jobs: ScheduledJob[] = [];
  private readonly handlers = new Map<
    string,
    (payload: any) => Promise<void>
  >();

  registerHandler<T>(
    jobName: string,
    handler: (payload: T) => Promise<void>,
  ): void {
    this.handlers.set(jobName, handler as (payload: any) => Promise<void>);
  }

  async scheduleJob<T>(
    jobName: string,
    payload: T,
    runAt: Date,
    idempotencyKey: string,
  ): Promise<{ created: boolean }> {
    // Giống hàng đợi thật (core/jobs): mỗi idempotencyKey chỉ được đăng ký 1 lần
    if (this.jobs.some((job) => job.idempotencyKey === idempotencyKey)) {
      return { created: false };
    }
    this.jobs.push({ jobName, payload, idempotencyKey, runAt: runAt.getTime(), done: false });
    return { created: true };
  }

  /** Tua đồng hồ tới trước ms mili-giây, chạy mọi job đã đến hạn. */
  async advance(ms: number): Promise<void> {
    this.now += ms;
    for (const job of this.jobs) {
      if (!job.done && job.runAt <= this.now) {
        job.done = true;
        await this.handlers.get(job.jobName)!(job.payload);
      }
    }
  }

  /** Chạy lại 1 job đã chạy rồi, để chứng minh handler idempotent. */
  async rerun(idempotencyKey: string): Promise<void> {
    const job = this.jobs.find((j) => j.idempotencyKey === idempotencyKey)!;
    await this.handlers.get(job.jobName)!(job.payload);
  }
}

/**
 * Lấy id 1 user ADMIN có sẵn trong DB, không có thì tạo mới.
 * Test không dùng cứng id của seed, nên chạy được với mọi phiên bản seed.
 * (audit_logs tham chiếu tới user này nên không bao giờ xóa nó.)
 */
export async function findOrCreateAdmin(pool: Pool): Promise<string> {
  const found = await pool.query(
    "SELECT id FROM users WHERE role = 'ADMIN' ORDER BY created_at LIMIT 1",
  );
  if (found.rows.length > 0) return found.rows[0].id;
  const phone = `08${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`;
  const { rows } = await pool.query(
    "INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Integration test admin', 'ADMIN', 'ACTIVE') RETURNING id",
    [phone],
  );
  return rows[0].id;
}
