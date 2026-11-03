import type { ClientBase } from 'pg';
import { ExecutionStatus, NurseTier } from '@healthcare-system/shared';
import type { ReleasedBooking } from './tier-lifecycle.types';

/** GPHN còn hiệu lực hết ngày gphn_expiry_date → hết hạn khi gphn_expiry_date < today */
export async function demoteExpiredTier2(client: ClientBase, today: string): Promise<string[]> {
  const { rows } = await client.query<{ user_id: string }>(
    `UPDATE nurse_profiles
        SET tier = $2, updated_at = now()
      WHERE tier = $3
        AND gphn_expiry_date IS NOT NULL
        AND gphn_expiry_date < $1::date
      RETURNING user_id`,
    [today, NurseTier.TIER_1_BASIC, NurseTier.TIER_2_SPECIALIST],
  );
  return rows.map((r) => r.user_id);
}

/** Gỡ điều dưỡng khỏi ca xâm lấn CONFIRMED nằm sau ngày GPHN hết hạn → trả về MATCHING để điều phối lại */
export async function releaseInvasiveBookingsAfterExpiry(
  client: ClientBase,
  today: string,
  now: Date,
): Promise<ReleasedBooking[]> {
  const { rows } = await client.query<ReleasedBooking>(
    `UPDATE bookings b
        SET nurse_id = NULL,
            execution_status = $3,
            updated_at = now()
       FROM nurse_profiles np, service_categories s
      WHERE b.nurse_id = np.user_id
        AND s.id = b.service_id
        AND s.is_invasive = TRUE
        AND b.execution_status = $4
        AND np.gphn_expiry_date < $1::date
        AND b.start_time > $2
        AND (b.start_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date > np.gphn_expiry_date
      RETURNING b.id, b.booking_code, np.user_id AS previous_nurse_id`,
    [today, now, ExecutionStatus.MATCHING, ExecutionStatus.CONFIRMED],
  );
  return rows;
}