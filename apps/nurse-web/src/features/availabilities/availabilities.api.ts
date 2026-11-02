import { apiClient } from '../../lib/api-client';

export async function updateAvailabilities(schedules: any[], timeOffExceptions: any[]) {
  return apiClient<{ updated: boolean }>('/nurse/availabilities', {
    method: 'PUT',
    body: JSON.stringify({ recurring_schedules: schedules, time_off_exceptions: timeOffExceptions }),
  });
}

