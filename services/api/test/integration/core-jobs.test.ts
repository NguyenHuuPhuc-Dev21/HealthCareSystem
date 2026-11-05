import { afterEach, describe, expect, it } from 'vitest';
import { JobQueueService } from '../../src/core/jobs';

const REDIS = process.env.REDIS_TEST_URL ?? 'redis://localhost:6379/15'; // DB 15, tách khỏi dữ liệu dev
let svc: JobQueueService | undefined;

function newService(extra: Partial<ConstructorParameters<typeof JobQueueService>[0]> = {}) {
  svc = new JobQueueService({
    redisUrl: REDIS,
    queueName: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    maxAttempts: 2,
    retryBackoffMs: 10,
    ...extra,
  });
  return svc;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(cond: () => boolean | Promise<boolean>, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await cond()) return;
    await sleep(50);
  }
  throw new Error('waitFor timeout');
}

afterEach(async () => {
  await svc?.close();
  svc = undefined;
});

describe('core/jobs', () => {
  it('chạy handler đúng lúc runAt, không chạy sớm', async () => {
    const s = newService();
    const calls: unknown[] = [];
    s.registerHandler('t.run', async (p) => { calls.push(p); });
    s.startWorker();

    await s.scheduleJob('t.run', { bookingId: 'b1' }, new Date(Date.now() + 500), 'run:b1');
    await sleep(200);
    expect(calls).toHaveLength(0);
    await waitFor(() => calls.length === 1);
    expect(calls[0]).toEqual({ bookingId: 'b1' });
  });

  it('idempotency: hẹn 2 lần cùng key → chỉ chạy 1 lần', async () => {
    const s = newService();
    let count = 0;
    s.registerHandler('t.idem', async () => { count++; });
    s.startWorker();

    const a = await s.scheduleJob('t.idem', {}, new Date(), 'settlement:b2');
    const b = await s.scheduleJob('t.idem', {}, new Date(), 'settlement:b2');
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    await waitFor(() => count === 1);
    await sleep(300);
    expect(count).toBe(1);
  });

  it('cancelJob: hủy job chưa chạy thì handler không bao giờ chạy', async () => {
    const s = newService();
    let count = 0;
    s.registerHandler('t.cancel', async () => { count++; });
    s.startWorker();

    await s.scheduleJob('t.cancel', {}, new Date(Date.now() + 800), 'settlement:b3');
    expect(await s.cancelJob('settlement:b3')).toBe(true);
    await sleep(1200);
    expect(count).toBe(0);
  });

  it('hết retry → vào DLQ và checkBacklog báo động', async () => {
    const s = newService();
    let attempts = 0;
    s.registerHandler('t.fail', async () => { attempts++; throw new Error('boom'); });
    s.startWorker();

    await s.scheduleJob('t.fail', {}, new Date(), 'fail:b4');
    await waitFor(async () => (await s.checkBacklog()).deadLetters === 1);
    expect(attempts).toBe(2);
    expect((await s.checkBacklog()).alert).toBe(true);
  });

  it('fake clock: delay được tính theo đồng hồ inject', async () => {
    const fakeNow = Date.now() - 10 * 60_000; // đồng hồ giả chậm 10 phút
    const s = newService({ now: () => fakeNow });
    await s.scheduleJob('t.clock', {}, new Date(), 'clock:b5'); // runAt = giờ thật → còn 10 phút
    expect(await s.getJobState('clock:b5')).toBe('delayed');
  });
}, 20_000);