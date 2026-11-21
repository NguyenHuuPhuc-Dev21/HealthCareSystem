/**
 * matching-radar jobs on the shared queue (BE-2 · Phase 3 · FR-BOOK-03).
 *   matching-radar.wave        one Radar wave of one booking (wave 1 schedules wave 2)
 *   matching-radar.redispatch  a booking lost its nurse (scheduled by tier-lifecycle) → find a new one
 * Both handlers are idempotent: a wave never offers a nurse twice (one offer per booking + nurse),
 * and a booking that is no longer MATCHING is left alone.
 */
import { REDISPATCH_JOB, type RedispatchPayload } from '../tier-lifecycle/tier-lifecycle.types';
import { getMatchingRadarService, type MatchingRadarService } from './matching-radar.service';
import { RADAR_WAVE_JOB, type RadarWavePayload } from './matching-radar.types';

export function registerMatchingRadarJobs(
  queue: { registerHandler<T>(jobName: string, handler: (payload: T) => Promise<void>): void },
  service: MatchingRadarService = getMatchingRadarService(),
): void {
  queue.registerHandler<RadarWavePayload>(RADAR_WAVE_JOB, async (payload) => {
    const r = await service.runWave(payload);
    console.log(
      `[matching-radar] booking ${payload.bookingId} wave ${payload.wave}: ` +
        (r.dispatched ? `${r.offered.length} nurse(s) offered within ${r.radiusKm} km` : 'nothing to dispatch'),
    );
  });
  queue.registerHandler<RedispatchPayload>(REDISPATCH_JOB, async (payload) => {
    const r = await service.redispatch(payload);
    console.log(`[matching-radar] redispatch booking ${payload.bookingId}: ${r.matchingMode ?? 'no longer matching'}`);
  });
}
