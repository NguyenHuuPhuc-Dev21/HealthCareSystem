/**
 * Core Shared Job Queue (BE-2) — Phase 0
 * Mọi hẹn giờ nghiệp vụ PHẢI đi qua đây. Cấm setTimeout tự phát.
 *
 * Hợp đồng nội bộ đã chốt với Dev A / Dev C:
 *   scheduleJob(jobName, payload, runAt, idempotencyKey)
 *   cancelJob(idempotencyKey)
 */
import { Queue, Worker, Job, UnrecoverableError } from 'bullmq';
import { Redis } from 'ioredis';

export interface JobContext {
  jobName: string;
  idempotencyKey: string;
  attempt: number;
}

export type JobHandler<T = unknown> = (payload: T, ctx: JobContext) => Promise<void>;

export interface JobQueueOptions {
  redisUrl?: string;
  queueName?: string;
  maxAttempts?: number;
  retryBackoffMs?: number;
  backlogAlertThreshold?: number;
  /** Đồng hồ inject được — dùng cho fake-clock test */
  now?: () => number;
}

interface Envelope {
  idempotencyKey: string;
  payload: unknown;
}

export interface BacklogReport {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  deadLetters: number;
  alert: boolean;
}

/** BullMQ cấm jobId chứa ":" và cấm jobId là số nguyên → encode + thêm tiền tố */
function toJobId(idempotencyKey: string): string {
  if (!idempotencyKey || !idempotencyKey.trim()) {
    throw new Error('[Core/Jobs] idempotencyKey is required');
  }
  return `k-${encodeURIComponent(idempotencyKey)}`;
}

export class JobQueueService {
  private readonly opts: Required<JobQueueOptions>;
  private connection?: Redis;
  private queue?: Queue;
  private dlq?: Queue;
  private worker?: Worker;
  private readonly handlers = new Map<string, JobHandler>();

  constructor(options: JobQueueOptions = {}) {
    this.opts = {
      redisUrl: options.redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379',
      queueName: options.queueName ?? process.env.JOB_QUEUE_NAME ?? 'healthcare-jobs',
      maxAttempts: options.maxAttempts ?? Number(process.env.JOB_MAX_ATTEMPTS ?? 5),
      retryBackoffMs: options.retryBackoffMs ?? 5_000,
      backlogAlertThreshold:
        options.backlogAlertThreshold ?? Number(process.env.JOB_BACKLOG_ALERT_THRESHOLD ?? 100),
      now: options.now ?? (() => Date.now()),
    };
  }

  // ---------- kết nối lười: import file này không tự mở Redis ----------
  private getConnection(): Redis {
    if (!this.connection) {
      // Worker của BullMQ bắt buộc maxRetriesPerRequest = null
      this.connection = new Redis(this.opts.redisUrl, { maxRetriesPerRequest: null });
    }
    return this.connection;
  }

  private getQueue(): Queue {
    if (!this.queue) this.queue = new Queue(this.opts.queueName, { connection: this.getConnection() });
    return this.queue;
  }

  private getDlq(): Queue {
    if (!this.dlq) this.dlq = new Queue(`${this.opts.queueName}-dlq`, { connection: this.getConnection() });
    return this.dlq;
  }

  // ---------- API dùng chung ----------
  public registerHandler<T>(jobName: string, handler: JobHandler<T>): void {
    if (this.handlers.has(jobName)) {
      throw new Error(`[Core/Jobs] Handler for "${jobName}" already registered`);
    }
    this.handlers.set(jobName, handler as JobHandler);
  }

  /** Hẹn 1 job chạy tại runAt. Gọi lại với cùng idempotencyKey → không tạo job mới. */
  public async scheduleJob<T>(
    jobName: string,
    payload: T,
    runAt: Date,
    idempotencyKey: string,
  ): Promise<{ jobId: string; created: boolean }> {
    const jobId = toJobId(idempotencyKey);
    const queue = this.getQueue();

    const existing = await queue.getJob(jobId);
    if (existing) return { jobId, created: false };

    const delay = Math.max(0, runAt.getTime() - this.opts.now());
    const data: Envelope = { idempotencyKey, payload };

    await queue.add(jobName, data, {
      jobId,
      delay,
      attempts: this.opts.maxAttempts,
      backoff: { type: 'exponential', delay: this.opts.retryBackoffMs },
      removeOnComplete: { age: 7 * 24 * 3600 }, // giữ 7 ngày để chặn hẹn trùng
      removeOnFail: { age: 30 * 24 * 3600 },
    });
    return { jobId, created: true };
  }

  /** Hủy job CHƯA chạy. Trả false nếu không có, đang chạy hoặc đã chạy xong. */
  public async cancelJob(idempotencyKey: string): Promise<boolean> {
    const job = await this.getQueue().getJob(toJobId(idempotencyKey));
    if (!job) return false;
    const state = await job.getState();
    if (state === 'delayed' || state === 'waiting' || state === 'prioritized') {
      await job.remove();
      return true;
    }
    return false;
  }

  public async getJobState(idempotencyKey: string): Promise<string | null> {
    const job = await this.getQueue().getJob(toJobId(idempotencyKey));
    return job ? job.getState() : null;
  }

  /** Job định kỳ (vd: quét GPHN 02:00 hằng ngày). Gọi lại nhiều lần vẫn chỉ 1 lịch. */
  public async scheduleRecurring(
    schedulerId: string,
    repeat: { pattern: string; tz?: string } | { every: number },
    jobName: string,
    payload: unknown = null,
  ): Promise<void> {
    const repeatOpts =
      'pattern' in repeat ? { pattern: repeat.pattern, tz: repeat.tz ?? 'Asia/Ho_Chi_Minh' } : repeat;
    await this.getQueue().upsertJobScheduler(schedulerId, repeatOpts, {
      name: jobName,
      data: { idempotencyKey: schedulerId, payload } as Envelope,
      opts: {
        attempts: this.opts.maxAttempts,
        backoff: { type: 'exponential', delay: this.opts.retryBackoffMs },
      },
    });
  }

  public startWorker(concurrency = 5): void {
    if (this.worker) return;

    this.worker = new Worker(
      this.opts.queueName,
      async (job: Job<Envelope>) => {
        const handler = this.handlers.get(job.name);
        if (!handler) {
          // không retry vô ích — đẩy thẳng vào DLQ
          throw new UnrecoverableError(`No handler registered for job "${job.name}"`);
        }
        await handler(job.data.payload, {
          jobName: job.name,
          idempotencyKey: job.data.idempotencyKey,
          attempt: job.attemptsMade + 1,
        });
      },
      { connection: this.getConnection(), concurrency },
    );

    // Dead-letter queue: chỉ khi đã hết lượt retry
    this.worker.on('failed', async (job, err) => {
      if (!job) return;
      const unrecoverable = err?.name === 'UnrecoverableError';
      const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
      if (!unrecoverable && !exhausted) return;
      try {
        await this.getDlq().add(
          job.name,
          {
            originalJobId: job.id,
            data: job.data,
            error: err?.message,
            failedAt: new Date(this.opts.now()).toISOString(),
          },
          { jobId: job.id },
        );
        console.error(`[Core/Jobs][DLQ] ${job.name} (${job.id}) → dead-letter: ${err?.message}`);
      } catch (e) {
        console.error('[Core/Jobs] Failed to write DLQ entry', e);
      }
    });
  }

  /** Cảnh báo tồn đọng. TODO Phase 1+: gọi dispatchNotification() của Dev C tới Admin */
  public async checkBacklog(): Promise<BacklogReport> {
    const c = await this.getQueue().getJobCounts('waiting', 'active', 'delayed', 'failed');
    const d = await this.getDlq().getJobCounts('waiting');
    const report: BacklogReport = {
      waiting: c.waiting ?? 0,
      active: c.active ?? 0,
      delayed: c.delayed ?? 0,
      failed: c.failed ?? 0,
      deadLetters: d.waiting ?? 0,
      alert: false,
    };
    report.alert = report.waiting > this.opts.backlogAlertThreshold || report.deadLetters > 0;
    if (report.alert) console.warn('[Core/Jobs][ALERT] Job backlog / dead letters', report);
    return report;
  }

  public async close(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await this.dlq?.close();
    await this.connection?.quit();
    this.worker = this.queue = this.dlq = this.connection = undefined;
  }
}

export const jobs = new JobQueueService();
export const scheduleJob = jobs.scheduleJob.bind(jobs);
export const cancelJob = jobs.cancelJob.bind(jobs);