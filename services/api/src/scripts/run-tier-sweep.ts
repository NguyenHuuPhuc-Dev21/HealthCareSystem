/**
 * Dev/QA helper (BE-2): run the GPHN expiry sweep ONCE, now, instead of waiting for 00:05.
 *   npx tsx src/scripts/run-tier-sweep.ts        (from services/api, needs DATABASE_URL + REDIS_URL)
 * Same code path as the worker job; redispatch jobs go to the real shared queue.
 */
import 'dotenv/config';
import { closePool, query, withTransaction } from '../core/database';
import { describeError } from '../core/errors';
import { jobs } from '../core/jobs';
import { runGphnExpirySweep } from '../modules/tier-lifecycle/tier-lifecycle.jobs';

async function main() {
  const result = await runGphnExpirySweep({
    withTx: (fn) => withTransaction(fn),
    read: { query },
    scheduler: jobs,
  });
  console.log('[run-tier-sweep]', result);
}

main()
  .catch((err) => {
    console.error('[run-tier-sweep] failed:', describeError(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await jobs.close();
    await closePool();
  });
