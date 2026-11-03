import type { ClientBase } from 'pg';
import * as repo from './tier-lifecycle.repo';
import type { GphnSweepInput, GphnSweepResult } from './tier-lifecycle.types';

/**
 * FR-AUTH-02 / TC-AUTH-02 — quét hạn GPHN.
 * Gọi bên trong 1 transaction. Chạy lại nhiều lần an toàn (lần 2 không đổi gì).
 * Không phạt, không đụng tiền: payment_status giữ nguyên.
 */
export async function runGphnExpirySweep(client: ClientBase, input: GphnSweepInput): Promise<GphnSweepResult> {
  const demotedNurseIds = await repo.demoteExpiredTier2(client, input.today);
  const releasedBookings = await repo.releaseInvasiveBookingsAfterExpiry(client, input.today, input.now);

  // TODO(Phase 3, BE-2): matching-radar / job-board nhận các đơn MATCHING này để điều phối lại
  // TODO(Dev C): dispatchNotification() báo điều dưỡng bị hạ tier + khách có ca bị đổi người
  // TODO(Dev C): audit_logs — audit_action_enum chưa có giá trị cho "tự động hạ tier", cần migration

  return { demotedNurseIds, releasedBookings };
}